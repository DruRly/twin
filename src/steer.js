import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createPrompter } from './prompt.js';

export async function steer() {
  const cwd = process.cwd();
  const steerPath = resolve(cwd, 'steer.md');

  // Accept message as inline args or fall back to interactive prompt
  const inline = process.argv.slice(3).join(' ').trim();
  let message;

  if (inline) {
    message = inline;
  } else {
    const prompter = createPrompter();
    message = await prompter.ask('What do you want to tell your twin?');
    prompter.close();
  }

  if (!message) {
    console.log('No message provided. Nothing written.');
    process.exit(0);
  }

  await writeFile(steerPath, message, 'utf-8');
  console.log('\nSteer queued. Your twin will read it at the next story boundary.\n');
}
