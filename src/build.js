import { spawn } from 'node:child_process';
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';

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
    console.error('No .twin file found. Run `twin init` first.\n');
    process.exit(1);
  }
  return resolve(cwd, twinFiles[0]);
}

function buildPrompt(twinContent, twinFilename, prdContent, progressContent) {
  return `You are an autonomous builder working on a software project. You have two sources of truth:

1. **The twin file** (${twinFilename}) — this is the builder's taste, their decision-making DNA. Build the way they would build.
2. **prd.json** — the product requirements with user stories. Each story has a status: "open", "in_progress", or "done".

${progressContent ? '3. **progress.md** — notes from previous build iterations. Read this to understand what was already tried and learned.\n' : ''}
## Your task

1. Read prd.json and find stories that are not "done"
2. Pick the story YOU think should be built next based on the twin's taste and what makes sense given the current state of the codebase
3. Build it. Write real, working code. Follow the acceptance criteria.
4. When the story's acceptance criteria are met, update prd.json: set that story's status to "done" and add "completedAt" with the current ISO timestamp
5. Append to progress.md what you built, what files changed, and any learnings for future iterations
6. Output ${COMPLETION_SIGNAL} when you finish a story
7. If ALL stories in prd.json are "done", output ${ALL_DONE_SIGNAL} instead

## Rules
- Build real features, not stubs
- Follow the taste in the twin file — it tells you how this person builds
- Commit your work with a clear message after completing a story
- If you get stuck, note what blocked you in progress.md and move on to a different story
- Do NOT ask questions. Make decisions based on the twin and the PRD.

## Twin file (${twinFilename})
${twinContent}

## prd.json
${prdContent}
${progressContent ? `\n## progress.md\n${progressContent}` : ''}
`;
}

function extractTextFromEvent(jsonLine) {
  try {
    const event = JSON.parse(jsonLine);

    // Text delta from assistant message streaming
    if (event.type === 'assistant' && event.message?.content) {
      // Full message content (final)
      return event.message.content
        .filter((block) => block.type === 'text')
        .map((block) => block.text)
        .join('');
    }

    // Partial streaming text delta
    if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
      return event.delta.text;
    }

    // Result message with text
    if (event.type === 'result' && event.result) {
      return null; // Already captured via deltas
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
    let hasReceivedText = false;

    // Heartbeat timer — show elapsed time while waiting
    const startTime = Date.now();
    const heartbeat = setInterval(() => {
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      if (!hasReceivedText) {
        process.stdout.write(`\rWorking... (${elapsed}s)`);
      }
    }, 10_000);

    claude.stdout.on('data', (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop(); // Keep incomplete last line in buffer

      for (const line of lines) {
        if (!line.trim()) continue;
        const text = extractTextFromEvent(line);
        if (text) {
          if (!hasReceivedText) {
            // Clear the heartbeat line on first real output
            process.stdout.write('\r\x1b[K');
            hasReceivedText = true;
          }
          process.stdout.write(text);
          output += text;
        }
      }
    });

    claude.stderr.on('data', (chunk) => {
      process.stderr.write(chunk);
    });

    claude.on('close', (code) => {
      clearInterval(heartbeat);
      // Process any remaining buffer
      if (buffer.trim()) {
        const text = extractTextFromEvent(buffer.trim());
        if (text) {
          process.stdout.write(text);
          output += text;
        }
      }
      if (!hasReceivedText) {
        process.stdout.write('\r\x1b[K'); // Clear heartbeat line
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

export async function build(maxIterations = 5) {
  const cwd = process.cwd();

  // Find twin file
  const twinPath = await findTwinFile(cwd);
  const twinFilename = twinPath.split('/').pop();
  const twinContent = await readFile(twinPath, 'utf-8');

  // Read prd.json — required
  const prdPath = resolve(cwd, 'prd.json');
  const prdContent = await readIfExists(prdPath);
  if (!prdContent) {
    console.error('No prd.json found. Run `twin plan` first.\n');
    process.exit(1);
  }

  // Check if there are open stories
  const prd = JSON.parse(prdContent);
  const openStories = prd.userStories.filter((s) => s.status !== 'done');
  if (openStories.length === 0) {
    console.log('All stories in prd.json are already done. Run `twin plan` to generate more.\n');
    process.exit(0);
  }

  console.log(`\n--- twin build ---`);
  console.log(`Using ${twinFilename}`);
  console.log(`${openStories.length} stories remaining in prd.json`);
  console.log(`Max iterations: ${maxIterations}\n`);

  for (let i = 1; i <= maxIterations; i++) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`  Iteration ${i} of ${maxIterations}`);
    console.log(`${'='.repeat(60)}\n`);

    // Re-read files each iteration (they may have been updated)
    const currentPrd = await readFile(prdPath, 'utf-8');
    const progressContent = await readIfExists(resolve(cwd, 'progress.md'));

    const prompt = buildPrompt(twinContent, twinFilename, currentPrd, progressContent);
    const { output, code } = await runIteration(prompt, cwd);

    if (code !== 0) {
      console.log(`\nClaude exited with code ${code}. Continuing to next iteration...\n`);
    }

    // Check completion signals
    if (output.includes(ALL_DONE_SIGNAL)) {
      console.log(`\n${'='.repeat(60)}`);
      console.log('  All stories complete!');
      console.log(`${'='.repeat(60)}`);
      console.log('\nNext step — plan more features:');
      console.log('  twin plan\n');
      break;
    }

    if (output.includes(COMPLETION_SIGNAL)) {
      // Re-read PRD to check remaining stories
      const updatedPrd = JSON.parse(await readFile(prdPath, 'utf-8'));
      const remaining = updatedPrd.userStories.filter((s) => s.status !== 'done');
      if (remaining.length === 0) {
        console.log(`\n${'='.repeat(60)}`);
        console.log('  All stories complete!');
        console.log(`${'='.repeat(60)}`);
        console.log('\nNext step — plan more features:');
        console.log('  twin plan\n');
        break;
      }
      console.log(`\nStory complete. ${remaining.length} remaining.\n`);
    }

    if (i === maxIterations) {
      console.log(`\nReached max iterations (${maxIterations}). Run \`twin build\` again to continue.\n`);
    }
  }
}
