import { readFile, writeFile, readdir } from 'node:fs/promises';
import { resolve, basename } from 'node:path';
import { callLLM } from './llm.js';
import { createPrompter } from './prompt.js';

const TASK_SYSTEM_PROMPT = `You are a taste-aware product planner. You receive:
1. A .twin file — the builder's decision-making DNA (how they think, what they value)
2. A product.md — what they're building, for whom, and where it stands
3. Optionally, a status.md — recent progress
4. Optionally, an existing prd.json — stories already planned (avoid duplicating these)

Your job: generate 3-5 atomic capabilities — things a user can DO after they're built. Not stubs, not refactors, not "set up X." Real, demoable features.

Rules:
- Match the builder's taste. If they ship fast, suggest quick wins. If they want polish, suggest completeness.
- Order by priority — most impactful first
- Use plain language, no jargon
- Do NOT duplicate anything already in the existing tasks

You MUST respond with valid JSON only. No markdown, no code fences, no explanation. Just the JSON object.

Schema:
{
  "project": "short project name",
  "description": "one-line project description",
  "userStories": [
    {
      "id": "US-001",
      "title": "short capability title",
      "description": "As a [user], I can [do thing] so that [value].",
      "acceptanceCriteria": ["criterion 1", "criterion 2"],
      "status": "open",
      "whyNow": "one sentence: why this is the right next thing"
    }
  ]
}

Every story MUST have "status": "open". Do not include priority numbers — ordering in the array IS the priority.`;

async function readIfExists(path) {
  try {
    return await readFile(path, 'utf-8');
  } catch {
    return null;
  }
}

async function bootstrapProduct() {
  console.log('\nNo product.md found. Let\'s set up your project context.\n');

  const prompter = createPrompter();

  const what = await prompter.ask('What are you building?');
  const who = await prompter.ask('Who is it for?');
  prompter.close();

  const content = `# Product\n\n## What\n${what}\n\n## Who\n${who}\n`;

  const outPath = resolve(process.cwd(), 'product.md');
  await writeFile(outPath, content, 'utf-8');
  console.log(`\nWrote ${outPath}`);
  return content;
}

const PLAN_RETRIES = 2;
const PLAN_RETRY_DELAY = 15_000; // 15s

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function parseLLMJson(raw) {
  // Strip markdown code fences if the LLM wraps its response
  let cleaned = raw.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
  }
  return JSON.parse(cleaned);
}

/**
 * Headless plan — callable from the build loop.
 * Requires product.md and a .twin file to already exist.
 * Returns the array of NEW stories added (empty if the twin has nothing to add).
 */
export async function runPlan(cwd) {
  const files = await readdir(cwd);
  const twinFiles = files.filter((f) => f.endsWith('.twin'));
  if (twinFiles.length === 0) return [];

  const twinPath = resolve(cwd, twinFiles[0]);
  const twin = await readFile(twinPath, 'utf-8');

  const productPath = resolve(cwd, 'product.md');
  const product = await readIfExists(productPath);
  if (!product) return []; // Can't plan without product context

  const statusPath = resolve(cwd, 'status.md');
  const prdPath = resolve(cwd, 'prd.json');
  const status = await readIfExists(statusPath);
  const existingPrd = await readIfExists(prdPath);

  let userMessage = `## .twin file\n${twin}\n\n## product.md\n${product}`;
  if (status) {
    userMessage += `\n\n## status.md\n${status}`;
  }
  if (existingPrd) {
    userMessage += `\n\n## Existing prd.json (do NOT duplicate these stories)\n${existingPrd}`;
  }
  userMessage += '\n\nGenerate the next 3-5 capabilities as JSON.';

  let raw;
  for (let attempt = 0; attempt <= PLAN_RETRIES; attempt++) {
    try {
      raw = await callLLM(TASK_SYSTEM_PROMPT, userMessage);
      break;
    } catch (err) {
      if (attempt < PLAN_RETRIES) {
        console.log(`\x1b[2m  API error — retrying plan in ${PLAN_RETRY_DELAY / 1000}s...\x1b[0m`);
        await sleep(PLAN_RETRY_DELAY);
      } else {
        console.error(`Planning failed after ${PLAN_RETRIES + 1} attempts: ${err.message}`);
        return [];
      }
    }
  }

  let prd;
  try {
    prd = parseLLMJson(raw);
  } catch {
    return [];
  }

  if (!prd.project) {
    prd.project = basename(cwd);
  }

  const newStories = prd.userStories || [];

  // Merge with existing stories
  if (existingPrd) {
    try {
      const existing = JSON.parse(existingPrd);
      const existingStories = existing.userStories || [];
      prd.userStories = [...existingStories, ...newStories];
      if (!prd.project && existing.project) prd.project = existing.project;
      if (!prd.description && existing.description) prd.description = existing.description;
    } catch {
      // If existing prd.json is malformed, just use the new one
    }
  }

  await writeFile(prdPath, JSON.stringify(prd, null, 2) + '\n', 'utf-8');
  return newStories;
}

/**
 * Interactive plan — called from `twin plan` CLI command.
 * Bootstraps product.md if missing, prints stories to console.
 */
export async function plan() {
  // Find *.twin file — required
  const cwd = process.cwd();
  const files = await readdir(cwd);
  const twinFiles = files.filter((f) => f.endsWith('.twin'));
  if (twinFiles.length === 0) {
    console.error('No .twin file found. Run `npx twin-cli init` first.\n');
    process.exit(1);
  }
  if (twinFiles.length > 1) {
    console.log(`Found multiple .twin files: ${twinFiles.join(', ')}. Using ${twinFiles[0]}.`);
  }
  console.log(`Using ${twinFiles[0]}\n`);

  // Read or bootstrap product.md
  const productPath = resolve(cwd, 'product.md');
  let product = await readIfExists(productPath);
  if (!product) {
    product = await bootstrapProduct();
  }

  console.log('--- twin plan ---');
  console.log('Your twin is deciding what to build next...\n');

  const newStories = await runPlan(cwd);

  if (newStories.length === 0) {
    console.log('Your twin has nothing to add right now.\n');
    return;
  }

  // Print new stories to console
  for (const story of newStories) {
    console.log(`${story.id}. ${story.title}`);
    console.log(`   ${story.description}`);
    for (const ac of story.acceptanceCriteria) {
      console.log(`   - ${ac}`);
    }
    console.log('');
  }

  const prdPath = resolve(cwd, 'prd.json');
  console.log(`---`);
  console.log(`Wrote ${prdPath}`);
  console.log(`\nNext step — let your twin build it:`);
  console.log(`  npx twin-cli build`);
}
