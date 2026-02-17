import * as readline from 'node:readline';

const INPUT_TIMEOUT_MS = 1500;

export function createPrompter() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  async function ask(question) {
    console.log(`\n${question}`);

    const lines = [];
    let timer = null;

    return new Promise((resolve) => {
      const finish = () => {
        rl.removeListener('line', onLine);
        resolve(lines.join(' ').trim());
      };

      const resetTimer = () => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(finish, INPUT_TIMEOUT_MS);
      };

      const onLine = (line) => {
        const trimmed = line.trim();
        if (trimmed !== '') {
          lines.push(trimmed);
        }
        // If we have content, start/reset the timeout
        if (lines.length > 0) {
          resetTimer();
        }
      };

      process.stdout.write('> ');
      rl.on('line', onLine);

      // For single-line answers (keyboard), also resolve on first Enter after content
      // But give a moment for more lines to arrive (paste/voice)
    });
  }

  // Drain any leftover input between questions
  async function drain() {
    return new Promise((resolve) => setTimeout(resolve, 100));
  }

  async function askAndDrain(question) {
    const answer = await ask(question);
    await drain();
    return answer;
  }

  function close() {
    rl.close();
  }

  return { ask: askAndDrain, close };
}
