import { spawn } from 'node:child_process';
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { unlinkSync } from 'node:fs';
import { resolve } from 'node:path';
import { runPlan } from './plan.js';
import { callLLM } from './llm.js';
import { findTwinPath, acquireTwinLock, releaseTwinLock } from './twin-global.js';

const COMPLETION_SIGNAL = '<twin>STORY_COMPLETE</twin>';
const ALL_DONE_SIGNAL = '<twin>ALL_COMPLETE</twin>';

async function readIfExists(path) {
  try {
    return await readFile(path, 'utf-8');
  } catch {
    return null;
  }
}

async function findTwinFile(cwd) {
  const twinPath = await findTwinPath(cwd);
  if (!twinPath) {
    console.error('No .twin file found. Run `npx twin-cli init` first.\n');
    process.exit(1);
  }
  return twinPath;
}

function buildPrompt(twinContent, twinFilename, prdContent, progressContent) {
  return `You are an autonomous builder working on a software project. You have two sources of truth:

1. **The twin file** (${twinFilename}) — this is the builder's taste, their decision-making DNA. Build the way they would build.
2. **prd.json** — the product requirements with user stories. Each story has a status: "open", "in_progress", or "done".

${progressContent ? '3. **progress.md** — notes from previous build runs. Read this to understand what was already tried and learned.\n' : ''}
## Your task

1. Read prd.json and find stories that are not "done"
2. Pick ONE story — the single story YOU think should be built next based on the twin's taste and the current state of the codebase
3. Build that ONE story. Write real, working code. Follow the acceptance criteria.
4. When the story's acceptance criteria are met, update prd.json: set that story's status to "done" and add "completedAt" with the current ISO timestamp
5. Append to progress.md what you built, what files changed, and any learnings
6. Commit your work with a clear message
7. Output ${COMPLETION_SIGNAL} when you finish the story
8. If ALL stories in prd.json are "done" after completing yours, output ${ALL_DONE_SIGNAL} instead

## Rules
- Build ONE story per run. Do not start a second story.
- Build real features, not stubs
- Follow the taste in the twin file — it tells you how this person builds
- If you get stuck, note what blocked you in progress.md and output ${COMPLETION_SIGNAL} anyway
- Do NOT ask questions. Make decisions based on the twin and the PRD.

## Twin file (${twinFilename})
${twinContent}

## prd.json
${prdContent}
${progressContent ? `\n## progress.md\n${progressContent}` : ''}
`;
}

function parseEvent(jsonLine) {
  try {
    const event = JSON.parse(jsonLine);

    // Text delta from assistant message streaming
    if (event.type === 'assistant' && event.message?.content) {
      const text = event.message.content
        .filter((block) => block.type === 'text')
        .map((block) => block.text)
        .join('');
      if (text) return { type: 'text', text };
    }

    // Partial streaming text delta
    if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
      return { type: 'text', text: event.delta.text };
    }

    // Tool use — show what Claude is doing
    if (event.type === 'content_block_start' && event.content_block?.type === 'tool_use') {
      const name = event.content_block.name || 'working';
      return { type: 'tool', name };
    }

    // Tool result
    if (event.type === 'content_block_start' && event.content_block?.type === 'tool_result') {
      return { type: 'tool_done' };
    }
  } catch {
    // Not valid JSON or unexpected shape — skip
  }
  return null;
}

function runIteration(prompt, cwd) {
  return new Promise((resolvePromise) => {
    const claude = spawn('claude', [
      '--print',
      '--dangerously-skip-permissions',
      '--output-format', 'stream-json',
    ], {
      cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env },
    });

    let output = '';
    let buffer = '';
    let lastActivity = Date.now();
    let statusLine = false; // true when a status line is showing
    let atLineStart = true; // track if cursor is at start of a line

    const TOOL_LABELS = {
      Read: 'Reading file',
      Write: 'Writing file',
      Edit: 'Editing file',
      Bash: 'Running command',
      Glob: 'Searching files',
      Grep: 'Searching code',
    };

    function clearStatus() {
      if (statusLine) {
        process.stdout.write('\r\x1b[K');
        statusLine = false;
      }
    }

    function showStatus(msg) {
      if (!atLineStart && !statusLine) {
        process.stdout.write('\n');
        atLineStart = true;
      }
      clearStatus();
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      process.stdout.write(`\r\x1b[2m${msg} (${elapsed}s)\x1b[0m`);
      statusLine = true;
    }

    // Heartbeat timer — show elapsed time while waiting
    const startTime = Date.now();
    const heartbeat = setInterval(() => {
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      const idle = Date.now() - lastActivity;
      if (idle > 5_000) {
        showStatus('Working...');
      }
    }, 5_000);

    claude.stdout.on('data', (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop(); // Keep incomplete last line in buffer

      for (const line of lines) {
        if (!line.trim()) continue;
        const event = parseEvent(line);
        if (!event) continue;

        lastActivity = Date.now();

        if (event.type === 'text') {
          clearStatus();
          output += event.text;
          // Hide completion signals from user — they're internal plumbing
          const display = event.text
            .replace(COMPLETION_SIGNAL, '')
            .replace(ALL_DONE_SIGNAL, '');
          if (display) {
            process.stdout.write(display);
            atLineStart = display.endsWith('\n');
          }
        } else if (event.type === 'tool') {
          const label = TOOL_LABELS[event.name] || event.name;
          showStatus(label);
        } else if (event.type === 'tool_done') {
          clearStatus();
        }
      }
    });

    claude.stderr.on('data', (chunk) => {
      process.stderr.write(chunk);
    });

    claude.on('close', (code) => {
      clearInterval(heartbeat);
      clearStatus();
      // Process any remaining buffer
      if (buffer.trim()) {
        const event = parseEvent(buffer.trim());
        if (event?.type === 'text') {
          process.stdout.write(event.text);
          output += event.text;
        }
      }
      resolvePromise({ output, code });
    });

    claude.on('error', (err) => {
      clearInterval(heartbeat);
      if (err.code === 'ENOENT') {
        console.error('\nClaude Code is not installed or not in PATH.');
        console.error('Install it: https://docs.anthropic.com/en/docs/claude-code\n');
        process.exit(1);
      }
      console.error(`\nFailed to spawn Claude: ${err.message}\n`);
      process.exit(1);
    });

    claude.stdin.write(prompt);
    claude.stdin.end();
  });
}

// Dim helper for secondary/chrome text
const dim = (s) => `\x1b[2m${s}\x1b[0m`;
const bold = (s) => `\x1b[1m${s}\x1b[0m`;
const bar = dim('─'.repeat(60));

async function processSteer(cwd, twinPath, prdPath) {
  const steerPath = resolve(cwd, 'steer.md');
  const steerContent = await readIfExists(steerPath);
  if (!steerContent?.trim()) return;

  const twinContent = await readFile(twinPath, 'utf-8');
  const twinFilename = twinPath.split('/').pop();
  const prdContent = await readFile(prdPath, 'utf-8');
  const prd = JSON.parse(prdContent);

  const maxNum = prd.userStories.reduce((max, s) => {
    const m = s.id?.match(/\d+/);
    return m ? Math.max(max, parseInt(m[0], 10)) : max;
  }, 0);
  const nextId = `US-${String(maxNum + 1).padStart(3, '0')}`;

  // Send trimmed prd (id + title + status only) to reduce token count
  const prdSummary = prd.userStories
    .map((s) => `${s.id}: ${s.title} (${s.status})`)
    .join('\n');

  const result = await callLLM(
    'You process developer steering input for a build loop. Output valid JSON only — no prose, no markdown fences.',
    [
      'Steering input from developer:',
      steerContent,
      '',
      `Existing stories:\n${prdSummary}`,
      '',
      `${twinFilename}:\n${twinContent}`,
      '',
      `Next available story id: ${nextId} (increment for each additional story)`,
      '',
      'Output JSON with this exact shape:',
      '{',
      '  "newStories": [],    // stories to add to prd.json (id, title, userStory, acceptanceCriteria array, status:"open"), empty array if none',
      '  "twinAppend": null   // text to append to the twin file if this input reveals something clear about the developer\'s taste, or null if nothing clear can be inferred',
      '}',
    ].join('\n')
  );

  let json;
  try {
    json = JSON.parse(result.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim());
  } catch {
    console.log(dim('  steer: could not parse response, skipping.'));
    return;
  }

  if (json.newStories?.length > 0) {
    prd.userStories.push(...json.newStories);
    await writeFile(prdPath, JSON.stringify(prd, null, 2), 'utf-8');
    console.log('');
    for (const s of json.newStories) {
      console.log(dim('  + ') + `${s.id}  ${s.title}`);
    }
  }

  if (json.twinAppend) {
    const lockPath = await acquireTwinLock(twinPath);
    try {
      const current = await readFile(twinPath, 'utf-8');
      await writeFile(twinPath, current.trimEnd() + '\n\n' + json.twinAppend + '\n', 'utf-8');
      console.log(dim(`  Updated ${twinFilename}`));
    } finally {
      await releaseTwinLock(lockPath);
    }
  }

  // Clear steer.md so it isn't re-processed next cycle
  await writeFile(steerPath, '', 'utf-8');
}

async function logPriorityJustification(twinContent, prdContent, storyNum, synthesisPath) {
  const justification = await callLLM(
    'You are a prioritization oracle. Answer in 1-3 sentences only. No preamble.',
    `Twin file:\n${twinContent}\n\nprd.json:\n${prdContent}\n\nIf you could only ship one story this cycle, which would it be and why? Reference the twin file reasoning explicitly.`
  );
  const existing = await readIfExists(synthesisPath) || '';
  const entry = `\n## Story ${storyNum} — ${new Date().toISOString()}\n\n**Priority justification:** ${justification}\n`;
  await writeFile(synthesisPath, existing + entry, 'utf-8');
}

const STORY_RETRIES = 2;
const STORY_RETRY_DELAYS = [10_000, 30_000]; // 10s, then 30s

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// Show an overwriting status line while an async operation runs, then clear it.
// msg can be a string, or an array of [afterSeconds, message] milestones.
async function withStatus(msg, fn) {
  const milestones = Array.isArray(msg)
    ? msg.slice().sort((a, b) => a[0] - b[0])
    : [[0, msg]];
  const start = Date.now();
  let shown = false;
  const timer = setInterval(() => {
    const elapsed = Math.round((Date.now() - start) / 1000);
    const current = milestones.filter(([s]) => elapsed >= s).pop()[1];
    process.stdout.write(`\r${dim(`${current} (${elapsed}s)`)}`);
    shown = true;
  }, 3_000);
  try {
    return await fn();
  } finally {
    clearInterval(timer);
    if (shown) process.stdout.write('\r\x1b[K');
  }
}

function summary(totalBuilt, cycles, elapsed) {
  const mins = Math.round(elapsed / 60000);
  const time = mins > 0 ? ` in ${mins}m` : '';
  const cycleNote = cycles > 1 ? ` across ${cycles} cycles` : '';
  return `${totalBuilt} stories built${cycleNote}${time}`;
}

export async function build({ maxStories = 3, loop = false, maxMinutes = null } = {}) {
  const cwd = process.cwd();
  const startTime = Date.now();
  const timeLimitMs = maxMinutes ? maxMinutes * 60 * 1000 : null;

  // Write lock file so twin steer knows a build is running
  const lockPath = resolve(cwd, '.twin-lock');
  await writeFile(lockPath, String(process.pid), 'utf-8');
  process.on('exit', () => { try { unlinkSync(lockPath); } catch {} });

  // Clean exit on Ctrl+C — finish current story, then stop
  let stopping = false;
  process.on('SIGINT', () => {
    if (stopping) process.exit(1); // Second Ctrl+C forces exit
    stopping = true;
    console.log(dim('\n\nStopping after current story finishes...\n'));
  });

  // Find twin file
  const twinPath = await findTwinFile(cwd);
  const twinFilename = twinPath.split('/').pop();

  // Read prd.json — required
  const prdPath = resolve(cwd, 'prd.json');
  const prdContent = await readIfExists(prdPath);
  if (!prdContent) {
    console.error('No prd.json found. Run `npx twin-cli plan` first.\n');
    process.exit(1);
  }

  // Check if there are open stories
  const prd = JSON.parse(prdContent);
  const openStories = prd.userStories.filter((s) => s.status !== 'done');
  if (openStories.length === 0 && !loop) {
    console.log('All stories are done.\n');
    console.log('  npx twin-cli plan             # plan the next batch, then build');
    console.log('  npx twin-cli build --loop     # plan and build automatically\n');
    process.exit(0);
  }
  // In loop mode with no open stories, the while loop will trigger planning

  console.log('');
  console.log(bar);
  console.log(bold(`  twin build${loop ? ' --loop' : ''}`));
  console.log(dim(`  ${twinFilename}`));
  if (loop) {
    const limits = [];
    if (maxStories !== Infinity) limits.push(`${maxStories} stories`);
    if (maxMinutes) limits.push(`${maxMinutes} min`);
    console.log(dim(`  ${limits.length > 0 ? limits.join(' · ') : 'no limit — Ctrl+C to stop'}`));
  } else {
    const storiesThisRun = Math.min(maxStories, openStories.length);
    console.log(dim(`  ${openStories.length} remaining · building ${storiesThisRun}`));
  }
  console.log(bar);
  console.log('');

  let totalBuilt = 0;
  let cycle = 1;

  while (totalBuilt < maxStories) {
    // Check if user requested stop
    if (stopping) {
      console.log(bar);
      console.log(bold('  Stopped'));
      console.log(dim(`  ${summary(totalBuilt, cycle, Date.now() - startTime)}`));
      console.log(bar);
      console.log('');
      break;
    }

    // Re-read twin each cycle (user may tweak mid-run)
    const twinContent = await readFile(twinPath, 'utf-8');

    // Process any steering input before deciding what to build next
    await withStatus([
      [0,   'Applying your steer...'],
      [20,  'Still working...'],
      [60,  'Your message is detailed — taking a moment...'],
      [120, 'Almost there...'],
    ], () => processSteer(cwd, twinPath, prdPath)).catch(() => {});

    // Re-read prd.json (steer or previous story may have updated it)
    const currentPrdContent = await readFile(prdPath, 'utf-8');
    const currentPrd = JSON.parse(currentPrdContent);
    const remaining = currentPrd.userStories.filter((s) => s.status !== 'done');

    // No open stories — either plan more or exit
    if (remaining.length === 0) {
      if (!loop) {
        console.log('');
        console.log(bar);
        console.log(bold('  All stories complete'));
        console.log(dim(`  ${summary(totalBuilt, cycle, Date.now() - startTime)}`));
        console.log(bar);
        console.log('\n  npx twin-cli plan             # plan the next batch, then build');
        console.log('  npx twin-cli build --loop     # plan and build automatically\n');
        break;
      }

      // Loop mode — ask the twin to plan the next batch
      console.log('');
      console.log(bar);
      console.log(bold(`  Cycle ${cycle} complete`));
      console.log(bar);
      console.log('');

      const newStories = await withStatus('Planning...', () => runPlan(cwd));

      if (newStories.length === 0) {
        console.log(bar);
        console.log(bold('  Your twin has built everything it would build right now.'));
        console.log(dim(`  ${summary(totalBuilt, cycle, Date.now() - startTime)}`));
        console.log(bar);
        console.log('');
        break;
      }

      console.log(`Planned ${newStories.length} new stories:`);
      for (const story of newStories) {
        console.log(dim(`  ${story.id}`) + ` ${story.title}`);
      }
      console.log('');
      cycle++;
      continue; // Back to top of while loop to build them
    }

    // Check time limit before starting next story
    if (timeLimitMs && (Date.now() - startTime) >= timeLimitMs) {
      const mins = Math.round((Date.now() - startTime) / 60000);
      console.log(bar);
      console.log(bold('  Time limit reached'));
      console.log(dim(`  ${summary(totalBuilt, cycle, Date.now() - startTime)}`));
      console.log(bar);
      console.log('');
      break;
    }

    // Build one story
    const storyNum = totalBuilt + 1;

    console.log('');
    console.log(bar);
    if (maxStories === Infinity) {
      console.log(bold(`  Story ${storyNum}`));
    } else {
      console.log(bold(`  Story ${storyNum} of ${maxStories}`));
    }
    console.log(bar);
    console.log('');

    const progressContent = await readIfExists(resolve(cwd, 'progress.md'));

    // Log priority justification to synthesis.md before building
    await withStatus('Thinking...', () =>
      logPriorityJustification(twinContent, currentPrdContent, storyNum, resolve(cwd, 'synthesis.md'))
    ).catch(() => {});

    const prompt = buildPrompt(twinContent, twinFilename, currentPrdContent, progressContent);

    let succeeded = false;
    for (let attempt = 0; attempt <= STORY_RETRIES; attempt++) {
      if (attempt > 0) {
        const delay = STORY_RETRY_DELAYS[attempt - 1];
        console.log(dim(`\n  API error — retrying in ${delay / 1000}s...\n`));
        await sleep(delay);
      }

      const { output, code } = await runIteration(prompt, cwd);

      if (code !== 0) {
        if (attempt < STORY_RETRIES) continue; // retry
        console.log(dim(`\nClaude exited with code ${code} after ${STORY_RETRIES + 1} attempts. Skipping story.\n`));
        // Log the failure to progress.md so the next run knows
        const progressPath = resolve(cwd, 'progress.md');
        const existing = await readIfExists(progressPath) || '';
        const note = `\n## Skipped story (${new Date().toISOString()})\nClaude exited with code ${code} after ${STORY_RETRIES + 1} attempts. Story was not counted.\n`;
        await writeFile(progressPath, existing + note, 'utf-8');
        break;
      }

      succeeded = true;
      if (output.includes(COMPLETION_SIGNAL) || output.includes(ALL_DONE_SIGNAL)) {
        const afterPrd = JSON.parse(await readFile(prdPath, 'utf-8'));
        const left = afterPrd.userStories.filter((s) => s.status !== 'done');
        if (left.length > 0) {
          console.log(dim(`\nStory done. ${left.length} open in prd.json.\n`));
        }
      }
      break;
    }

    if (succeeded) totalBuilt++;
  }

  if (totalBuilt > 0 && totalBuilt >= maxStories) {
    console.log(bar);
    console.log(bold(`  Done`));
    console.log(dim(`  ${summary(totalBuilt, cycle, Date.now() - startTime)}`));
    console.log(bar);
    if (!loop) {
      console.log('\n  npx twin-cli build            # keep building');
      console.log('  npx twin-cli build --loop     # build and plan automatically\n');
    }
    console.log('');
  }
}
