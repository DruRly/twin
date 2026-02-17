import * as readline from 'node:readline';
import { generateTwin } from './generate.js';

const QUESTIONS = [
  "When you start something new, do you plan first or build first?",
  "Do you ship something ugly that works, or wait until it's polished?",
  "How do you know when something is done?",
"Describe something you built or created that you're proud of. What made it good?",
  "What do you believe about building things that most people would disagree with?",
];

function ask(rl, question) {
  return new Promise((resolve) => {
    console.log(`\n${question}`);
    rl.question('> ', (answer) => {
      resolve(answer.trim());
    });
  });
}

async function checkKey(key) {
  try {
    const res = await fetch('https://openrouter.ai/api/v1/models', {
      headers: { 'Authorization': `Bearer ${key}` },
    });
    if (!res.ok) {
      console.error(`\nAPI key check failed (${res.status}). Make sure your OPENROUTER_API_KEY is valid.`);
      console.log('Get one at https://openrouter.ai/keys\n');
      process.exit(1);
    }
  } catch (e) {
    console.error('\nCould not connect to OpenRouter. Check your internet connection.\n');
    process.exit(1);
  }
}

export async function init() {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) {
    console.log('\nSet your OpenRouter API key first:');
    console.log('  export OPENROUTER_API_KEY="your-key-here"');
    console.log('\nGet one at https://openrouter.ai/keys\n');
    process.exit(1);
  }

  console.log('\nChecking API connection...');
  await checkKey(key);
  console.log('Connected.\n');

  console.log('--- twin init ---');
  console.log('Answer 5 questions. Say as much or as little as you want.');
  console.log('Your answers will be used to generate your .twin file.\n');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const answers = [];
  for (const q of QUESTIONS) {
    const answer = await ask(rl, q);
    answers.push({ question: q, answer });
  }
  rl.close();

  console.log('\nGenerating your .twin file...\n');

  const paired = answers.map((a) => `Q: ${a.question}\nA: ${a.answer}`).join('\n\n');
  await generateTwin(key, paired);
}
