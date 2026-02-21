import { readFile, writeFile, readdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { spawn } from 'node:child_process';
import { callLLM } from './llm.js';

const dim = (s) => `\x1b[2m${s}\x1b[0m`;
const bold = (s) => `\x1b[1m${s}\x1b[0m`;
const bar = dim('─'.repeat(60));

async function readIfExists(path) {
  try {
    return await readFile(path, 'utf-8');
  } catch {
    return null;
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function startSpinner(label) {
  const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  let i = 0;
  let secs = 0;
  const isTTY = process.stdout.isTTY;
  if (isTTY) process.stdout.write(dim(`  ${label} ${frames[0]} 0s`));
  const interval = setInterval(() => {
    i = (i + 1) % frames.length;
    if (i === 0) secs++;
    if (isTTY) process.stdout.write(`\r${dim(`  ${label} ${frames[i]} ${secs}s`)}`);
  }, 100);
  return () => {
    clearInterval(interval);
    if (isTTY) process.stdout.write('\r\x1b[K');
  };
}

async function gitLog(cwd) {
  return new Promise((resolve) => {
    const proc = spawn('git', ['log', '--oneline', '--stat', '-50'], { cwd });
    let out = '';
    proc.stdout.on('data', (d) => (out += d));
    proc.on('close', (code) => {
      if (code !== 0) resolve(null);
      else resolve(out.trim() || null);
    });
    proc.on('error', () => resolve(null));
  });
}

const SKIP_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', 'coverage',
  '.next', '.cache', 'vendor', '.turbo', 'out',
]);

async function buildTree(dir, depth = 0) {
  if (depth > 3) return '';
  let output = '';
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return '';
  }
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    if (entry.isDirectory() && SKIP_DIRS.has(entry.name)) continue;
    const indent = '  '.repeat(depth);
    if (entry.isDirectory()) {
      output += `${indent}${entry.name}/\n`;
      output += await buildTree(join(dir, entry.name), depth + 1);
    } else {
      output += `${indent}${entry.name}\n`;
    }
  }
  return output;
}

const ALLOWLIST = [
  'README.md',
  'package.json',
  'tsconfig.json',
  '.env.example',
  '.eslintrc',
  '.eslintrc.json',
  '.eslintrc.js',
  'biome.json',
  '.prettierrc',
  'Makefile',
  'prd.json',
  'synthesis.md',
];

async function readAllowlisted(cwd) {
  const sections = [];
  for (const filename of ALLOWLIST) {
    const content = await readIfExists(resolve(cwd, filename));
    if (content) {
      sections.push(`### ${filename}\n${content}`);
    }
  }
  return sections.join('\n\n');
}

const SCOUT_RETRIES = 2;
const SCOUT_RETRY_DELAY = 15_000;

const SYSTEM_PROMPT = `You are a project historian. You receive information about an existing codebase and produce a single Markdown document: project-memory.md.

Your job is to write a clear, accurate autobiographical memory of the project — as if you had been there from the start. A developer's AI twin will read this before planning the next features, so it must be grounded in what actually exists, not speculation.

Cover these areas (skip any where you have no evidence):
- What has been built: key features, modules, patterns visible in the structure and history
- How the project is structured: architecture, entry points, notable conventions
- What the commit history reveals: decisions made, things tried, evolution over time
- What is conspicuously absent given the project type: obvious gaps or missing pieces
- What the current state suggests about priority: where momentum is, what's growing, what's stalled

Rules:
- Be factual. Only assert what the evidence supports.
- Be concise. A developer should be able to read this in two minutes.
- Use plain Markdown headers and bullet points. No tables, no code fences.
- Do not repeat the raw data back. Synthesize it.
- Output ONLY the Markdown content. No preamble, no explanation.`;

export async function scout() {
  const cwd = process.cwd();

  console.log(dim('  Scouting project...'));

  console.log(dim('  Reading git history...'));
  const history = await gitLog(cwd);

  console.log(dim('  Reading project structure...'));
  const tree = await buildTree(cwd);

  console.log(dim('  Reading project files...'));
  const files = await readAllowlisted(cwd);

  let userMessage = '';
  if (tree) userMessage += `## Directory structure\n${tree}\n`;
  if (history) userMessage += `\n## Git history (last 50 commits)\n${history}\n`;
  if (files) userMessage += `\n## Project files\n${files}\n`;

  if (!userMessage.trim()) {
    console.log('  Nothing to scout — no files or git history found.');
    return;
  }

  userMessage += '\n\nWrite project-memory.md now.';

  let stopSpinner = startSpinner('Synthesizing project memory...');
  let raw;
  for (let attempt = 0; attempt <= SCOUT_RETRIES; attempt++) {
    try {
      raw = await callLLM(SYSTEM_PROMPT, userMessage);
      stopSpinner();
      break;
    } catch (err) {
      stopSpinner();
      if (attempt < SCOUT_RETRIES) {
        console.log(dim(`  API error — retrying in ${SCOUT_RETRY_DELAY / 1000}s...`));
        await sleep(SCOUT_RETRY_DELAY);
        stopSpinner = startSpinner('Synthesizing project memory...');
      } else {
        console.error(`Scout failed after ${SCOUT_RETRIES + 1} attempts: ${err.message}`);
        return;
      }
    }
  }

  const outPath = resolve(cwd, 'project-memory.md');
  await writeFile(outPath, raw.trim() + '\n', 'utf-8');

  console.log(`\n${bar}`);
  console.log(bold('  Scout complete'));
  console.log(dim('  project-memory.md written. Run twin plan to use it.'));
  console.log(bar + '\n');
}
