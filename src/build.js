import { spawn } from 'node:child_process';
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { runPlan } from './plan.js';

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
  const files = await readdir(cwd);
  const twinFiles = files.filter((f) => f.endsWith('.twin'));
  if (twinFiles.length === 0) {
    console.error('No .twin file found. Run `npx twin-cli init` first.\n');
    process.exit(1);
  }
  return resolve(cwd, twinFiles[0]);
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

export async function build({ maxStories = 3, loop = false } = {}) {
  const cwd = process.cwd();

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
    console.log('All stories are done. Plan the next batch:\n  npx twin-cli plan\n');
    process.exit(0);
  }
  // In loop mode with no open stories, the while loop will trigger planning

  console.log(`\n--- twin build${loop ? ' --loop' : ''} ---`);
  console.log(`Using ${twinFilename}`);
  if (loop) {
    console.log(`Building up to ${maxStories} stories across plan cycles\n`);
  } else {
    const storiesThisRun = Math.min(maxStories, openStories.length);
    console.log(`${openStories.length} stories remaining — building ${storiesThisRun}\n`);
  }

  let totalBuilt = 0;
  let cycle = 1;

  while (totalBuilt < maxStories) {
    // Re-read twin each cycle (user may tweak mid-run)
    const twinContent = await readFile(twinPath, 'utf-8');

    // Re-read prd.json (previous story or plan cycle may have updated it)
    const currentPrdContent = await readFile(prdPath, 'utf-8');
    const currentPrd = JSON.parse(currentPrdContent);
    const remaining = currentPrd.userStories.filter((s) => s.status !== 'done');

    // No open stories — either plan more or exit
    if (remaining.length === 0) {
      if (!loop) {
        console.log(`\n${'='.repeat(60)}`);
        console.log('  All stories complete!');
        console.log(`${'='.repeat(60)}`);
        console.log('\nNext step — plan more features:');
        console.log('  npx twin-cli plan\n');
        break;
      }

      // Loop mode — ask the twin to plan the next batch
      console.log(`\n${'='.repeat(60)}`);
      console.log(`  Cycle ${cycle} complete — all stories done`);
      console.log(`  Your twin is planning the next batch...`);
      console.log(`${'='.repeat(60)}\n`);

      const newStories = await runPlan(cwd);

      if (newStories.length === 0) {
        console.log(`\n${'='.repeat(60)}`);
        console.log('  Your twin has built everything it would build right now.');
        console.log(`${'='.repeat(60)}`);
        console.log(`\n${totalBuilt} stories built across ${cycle} cycle${cycle === 1 ? '' : 's'}.\n`);
        break;
      }

      console.log(`Planned ${newStories.length} new stories:`);
      for (const story of newStories) {
        console.log(`  ${story.id}. ${story.title}`);
      }
      console.log('');
      cycle++;
      continue; // Back to top of while loop to build them
    }

    // Build one story
    totalBuilt++;
    const storyNum = totalBuilt;
    const cap = loop ? maxStories : Math.min(maxStories, openStories.length);

    console.log(`\n${'='.repeat(60)}`);
    console.log(`  Story ${storyNum} of ${cap}`);
    console.log(`${'='.repeat(60)}\n`);

    const progressContent = await readIfExists(resolve(cwd, 'progress.md'));
    const prompt = buildPrompt(twinContent, twinFilename, currentPrdContent, progressContent);
    const { output, code } = await runIteration(prompt, cwd);

    if (code !== 0) {
      console.log(`\nClaude exited with code ${code}. Moving to next story...\n`);
      continue;
    }

    if (output.includes(COMPLETION_SIGNAL) || output.includes(ALL_DONE_SIGNAL)) {
      const afterPrd = JSON.parse(await readFile(prdPath, 'utf-8'));
      const left = afterPrd.userStories.filter((s) => s.status !== 'done');
      if (left.length > 0) {
        console.log(`\nStory done. ${left.length} remaining.\n`);
      }
      // If left.length === 0, the top of the while loop handles it
    }
  }

  if (totalBuilt >= maxStories) {
    console.log(`\nBuilt ${totalBuilt} stories.${loop ? '' : ' Keep going:\n  npx twin-cli build'}\n`);
  }
}
