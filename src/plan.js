import { readFile, writeFile, readdir } from 'node:fs/promises';
import { resolve, basename } from 'node:path';
import { requireKey, checkKey, callLLM } from './llm.js';
import { createPrompter } from './prompt.js';

const TASK_SYSTEM_PROMPT = `You are a taste-aware product planner. You receive:
1. A .twin file — the builder's decision-making DNA (how they think, what they value)
2. A product.md — what they're building, for whom, and where it stands
3. Optionally, a status.md — recent progress
4. Optionally, existing tasks — already planned (avoid duplicating these)

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
      "priority": 1,
      "whyNow": "one sentence: why this is the right next thing"
    }
  ]
}`;

async function readIfExists(path) {
  try {
    return await readFile(path, 'utf-8');
  } catch {
    return null;
  }
}

async function bootstrapProduct() {
  console.log('\nNo product.md found. Let\'s set up your project context.');
  console.log('(2 quick questions — no AI involved, just capturing facts.)\n');

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

function parseLLMJson(raw) {
  // Strip markdown code fences if the LLM wraps its response
  let cleaned = raw.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
  }
  return JSON.parse(cleaned);
}

function prdToMarkdown(prd) {
  const lines = [];
  for (const story of prd.userStories) {
    lines.push(`## ${story.id}. ${story.title}`);
    lines.push(story.description);
    for (const ac of story.acceptanceCriteria) {
      lines.push(`- ${ac}`);
    }
    lines.push('');
    lines.push(`**Why now:** ${story.whyNow}`);
    lines.push('');
  }
  return lines.join('\n');
}

export async function plan() {
  const key = requireKey();

  console.log('\nChecking API connection...');
  await checkKey(key);
  console.log('Connected.\n');

  // Find *.twin file — required
  const cwd = process.cwd();
  const files = await readdir(cwd);
  const twinFiles = files.filter((f) => f.endsWith('.twin'));
  if (twinFiles.length === 0) {
    console.error('No .twin file found. Run `twin init` first.\n');
    process.exit(1);
  }
  if (twinFiles.length > 1) {
    console.log(`Found multiple .twin files: ${twinFiles.join(', ')}. Using ${twinFiles[0]}.`);
  }
  const twinPath = resolve(cwd, twinFiles[0]);
  const twin = await readFile(twinPath, 'utf-8');
  console.log(`Using ${twinFiles[0]}\n`);

  // Read or bootstrap product.md
  const productPath = resolve(process.cwd(), 'product.md');
  let product = await readIfExists(productPath);
  if (!product) {
    product = await bootstrapProduct();
  }

  // Read optional context files
  const statusPath = resolve(process.cwd(), 'status.md');
  const tasksPath = resolve(process.cwd(), 'tasks.md');
  const prdPath = resolve(process.cwd(), 'prd.json');
  const status = await readIfExists(statusPath);
  const existingTasks = await readIfExists(tasksPath);
  const existingPrd = await readIfExists(prdPath);

  // Assemble user message
  let userMessage = `## .twin file\n${twin}\n\n## product.md\n${product}`;
  if (status) {
    userMessage += `\n\n## status.md\n${status}`;
  }
  if (existingTasks) {
    userMessage += `\n\n## Existing tasks (do NOT duplicate these)\n${existingTasks}`;
  }
  if (existingPrd) {
    userMessage += `\n\n## Existing prd.json (do NOT duplicate these stories)\n${existingPrd}`;
  }
  userMessage += '\n\nGenerate the next 3-5 capabilities as JSON.';

  console.log('--- twin plan ---');
  console.log('Generating tasks that match your taste...\n');

  const raw = await callLLM(key, TASK_SYSTEM_PROMPT, userMessage);

  // Parse structured output
  let prd;
  try {
    prd = parseLLMJson(raw);
  } catch (e) {
    console.error('Failed to parse LLM response as JSON. Raw output:\n');
    console.error(raw);
    process.exit(1);
  }

  // Derive project name from cwd if LLM didn't provide one
  if (!prd.project) {
    prd.project = basename(process.cwd());
  }

  // Write prd.json
  await writeFile(prdPath, JSON.stringify(prd, null, 2) + '\n', 'utf-8');

  // Write human-readable tasks.md
  const today = new Date().toISOString().split('T')[0];
  const markdown = prdToMarkdown(prd);
  let tasksOutput;
  if (existingTasks) {
    tasksOutput = `${existingTasks.trimEnd()}\n\n---\n\n### Generated ${today}\n\n${markdown}`;
  } else {
    tasksOutput = `# Tasks\n\n### Generated ${today}\n\n${markdown}`;
  }
  await writeFile(tasksPath, tasksOutput, 'utf-8');

  // Print to console
  console.log(markdown);
  console.log(`---`);
  console.log(`Wrote ${prdPath} (structured, for agents)`);
  console.log(`Wrote ${tasksPath} (readable, for humans)`);
  console.log('\nHand prd.json to your AI agent or paste tasks.md into any chat.');
}
