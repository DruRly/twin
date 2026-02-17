import * as readline from 'node:readline';

/**
 * Ask a question and collect multi-line input.
 * Input ends when the user presses Enter on an empty line.
 * This handles voice-to-text and paste input that contains newlines.
 */
export function createPrompter() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  async function ask(question) {
    console.log(`\n${question}`);
    console.log('(Press Enter twice when done)');

    const lines = [];
    let lastWasEmpty = false;

    return new Promise((resolve) => {
      const onLine = (line) => {
        const trimmed = line.trim();

        if (trimmed === '' && (lastWasEmpty || lines.length > 0)) {
          // Double-enter or trailing blank after content = done
          rl.removeListener('line', onLine);
          resolve(lines.join('\n').trim());
          return;
        }

        if (trimmed === '' && lines.length === 0) {
          // Ignore leading blank lines (accidental enter)
          return;
        }

        lastWasEmpty = trimmed === '';
        if (trimmed !== '') {
          lines.push(trimmed);
          lastWasEmpty = false;
        }
      };

      process.stdout.write('> ');
      rl.on('line', onLine);
    });
  }

  function close() {
    rl.close();
  }

  return { ask, close };
}
