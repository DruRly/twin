import { createPrompter } from './prompt.js';
import { generateTwin } from './generate.js';

const QUESTIONS = [
  "When you start something new, do you plan first or build first?",
  "Do you ship something ugly that works, or wait until it's polished?",
  "How do you know when something is done?",
  "Describe something you built or created that you're proud of. What made it good?",
  "What do you believe about building things that most people would disagree with?",
];

export async function init() {
  console.log('\n--- twin init ---');
  console.log('Answer a few questions. Say as much or as little as you want.');
  console.log('Your answers will be used to generate your .twin file.\n');

  const prompter = createPrompter();

  const name = await prompter.ask('What should we call you? (First name is fine.)');

  const answers = [];
  for (const q of QUESTIONS) {
    const answer = await prompter.ask(q);
    answers.push({ question: q, answer });
  }
  prompter.close();

  const filename = `${name.toLowerCase().replace(/[^a-z0-9]/g, '')}.twin`;
  console.log(`\nGenerating ${filename}...\n`);

  const paired = answers.map((a) => `Q: ${a.question}\nA: ${a.answer}`).join('\n\n');
  await generateTwin(name, paired);
}
