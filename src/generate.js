import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

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

export async function generateTwin(apiKey, interviewText) {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-3-flash-preview',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `Here are the interview answers. Generate the .twin file.\n\n${interviewText}` },
      ],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error(`OpenRouter API error (${res.status}): ${err}`);
    process.exit(1);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    console.error('No content returned from API.');
    process.exit(1);
  }

  const outPath = resolve(process.cwd(), '.twin');
  await writeFile(outPath, content, 'utf-8');
  console.log(`Done! Your twin file is at: ${outPath}`);
  console.log('\nDrop this file into any project and your AI tools will know your taste.');
}
