import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { callLLM } from './llm.js';
import { ensureGlobalTwinDir } from './twin-global.js';

const SYSTEM_PROMPT = `You are a taste interpreter. You read someone's answers to 5 questions about how they build things, and you produce a .twin file — a Markdown document that encodes their decision-making DNA.

The .twin file has these sections:

# Twin — [Name or "Anonymous"]

## Execution Bias
- Speed vs polish preference
- How they start things
- Shipping philosophy

## Quality Compass
- How they define "done"
- What "good" means to them
- Standards they hold

## Decision-Making Style
- How they get unstuck
- How they evaluate tradeoffs
- Instincts and heuristics

## Strongly Held Beliefs
- Contrarian views
- Things they refuse to do
- Non-negotiable principles

## Anti-Patterns
- Things to avoid
- Red flags they watch for
- Patterns they reject

Rules:
- Write in second person ("You prefer...", "You believe...")
- Be specific and opinionated, not generic
- Use their actual words and phrasings when possible
- Each bullet should be a concrete, actionable heuristic — not a vague platitude
- If they didn't give enough signal for a section, write fewer bullets rather than making things up
- Keep it under 80 lines total
- No preamble, no explanation — just the .twin file content`;

export async function generateTwin(name, interviewText) {
  let content;
  try {
    content = await callLLM(
      SYSTEM_PROMPT,
      `The builder's name is ${name}.\n\nHere are the interview answers. Generate the .twin file.\n\n${interviewText}`,
    );
  } catch (err) {
    console.error(`\n${err.message}\n`);
    process.exit(1);
  }

  const filename = `${name.toLowerCase().replace(/[^a-z0-9]/g, '')}.twin`;
  const globalDir = await ensureGlobalTwinDir();
  const outPath = resolve(globalDir, filename);
  await writeFile(outPath, content, 'utf-8');
  console.log(`Done! Created ${outPath}\n`);
  console.log('Next step — plan what to build:');
  console.log('  npx twin-cli plan');
}
