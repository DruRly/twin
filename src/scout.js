import { readFile, writeFile, readdir, access } from 'node:fs/promises';
import { constants } from 'node:fs';
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

// Never read credential or secret files, regardless of project type
const CREDENTIAL_PATTERNS = [
  /^\.env(\..*)?$/,   // .env, .env.local, .env.production, etc.
  /\.pem$/,
  /\.key$/,
  /\.p12$/,
  /\.pfx$/,
  /\.keystore$/,
  /\.secret$/,
];

const BINARY_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.ico',
  '.pdf', '.zip', '.tar', '.gz', '.bz2', '.7z',
  '.wasm', '.ttf', '.woff', '.woff2', '.eot', '.otf',
  '.mp4', '.mp3', '.mov', '.avi', '.wav',
  '.exe', '.dll', '.so', '.dylib', '.bin',
]);

const FILE_CHAR_LIMIT = 3000;

function isSkippedFile(name) {
  if (CREDENTIAL_PATTERNS.some((p) => p.test(name))) return true;
  const dot = name.lastIndexOf('.');
  if (dot !== -1 && BINARY_EXTENSIONS.has(name.slice(dot))) return true;
  return false;
}

async function readProjectFiles(cwd) {
  const sections = [];
  let entries;
  try {
    entries = await readdir(cwd, { withFileTypes: true });
  } catch {
    return '';
  }
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (isSkippedFile(entry.name)) continue;
    let content = await readIfExists(resolve(cwd, entry.name));
    if (!content) continue;
    if (content.length > FILE_CHAR_LIMIT) {
      content = content.slice(0, FILE_CHAR_LIMIT) + '\n... (truncated)';
    }
    sections.push(`### ${entry.name}\n${content}`);
  }
  return sections.join('\n\n');
}

const SCOUT_RETRIES = 2;
const SCOUT_RETRY_DELAY = 15_000;

const MEMORY_PROMPT = `You are a project historian. You receive information about an existing codebase and your response IS the project memory document.

Your job is to return a clear, accurate autobiographical memory of the project — as if you had been there from the start. A developer's AI twin will read your response before planning the next features, so it must be grounded in what actually exists, not speculation.

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
- Your entire response must be the Markdown content and nothing else. No preamble, no explanation, no file operations.`;

const PRODUCT_PROMPT = `You are reading an existing software project. Your response must be the product context document and nothing else.

Respond with ONLY the following format — no preamble, no explanation, no file operations:

# Product

## What
[One paragraph describing what this project is and what it does]

## Who
[One sentence describing who this is built for]`;

export async function scout() {
  const cwd = process.cwd();

  // Fail fast before spending tokens if we can't write output files
  try {
    await access(cwd, constants.W_OK);
  } catch {
    console.error('\n  Cannot write to this directory. Check permissions and try again.\n');
    return;
  }

  console.log(dim('  Scouting project...'));

  console.log(dim('  Reading git history...'));
  const history = await gitLog(cwd);

  console.log(dim('  Reading project structure...'));
  const tree = await buildTree(cwd);

  console.log(dim('  Reading project files...'));
  const files = await readProjectFiles(cwd);

  let projectData = '';
  if (tree) projectData += `## Directory structure\n${tree}\n`;
  if (history) projectData += `\n## Git history (last 50 commits)\n${history}\n`;
  if (files) projectData += `\n## Project files\n${files}\n`;

  if (!projectData.trim()) {
    console.log('  Nothing to scout — no files or git history found.');
    return;
  }

  // Write project-memory.md
  let stopSpinner = startSpinner('Synthesizing project memory...');
  let raw;
  for (let attempt = 0; attempt <= SCOUT_RETRIES; attempt++) {
    try {
      raw = await callLLM(MEMORY_PROMPT, projectData + '\n\nReturn the project memory now.');
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

  await writeFile(resolve(cwd, 'project-memory.md'), raw.trim() + '\n', 'utf-8');

  // Derive product.md so twin plan needs no Q&A on existing projects
  let productRaw;
  let stopProductSpinner = startSpinner('Deriving product context...');
  for (let attempt = 0; attempt <= SCOUT_RETRIES; attempt++) {
    try {
      productRaw = await callLLM(PRODUCT_PROMPT, projectData);
      stopProductSpinner();
      break;
    } catch (err) {
      stopProductSpinner();
      if (attempt < SCOUT_RETRIES) {
        console.log(dim(`  API error — retrying in ${SCOUT_RETRY_DELAY / 1000}s...`));
        await sleep(SCOUT_RETRY_DELAY);
        stopProductSpinner = startSpinner('Deriving product context...');
      } else {
        console.log(dim('  Could not derive product.md — twin plan will ask setup questions manually.'));
        productRaw = null;
      }
    }
  }

  if (productRaw) {
    await writeFile(resolve(cwd, 'product.md'), productRaw.trim() + '\n', 'utf-8');
  }

  console.log(`\n${bar}`);
  console.log(bold('  Scout complete'));
  console.log(dim('  project-memory.md written'));
  if (productRaw) console.log(dim('  product.md written — twin plan will skip setup questions'));
  console.log(dim('  Run twin plan to generate stories.'));
  console.log(bar + '\n');
}
