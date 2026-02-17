import { spawn } from 'node:child_process';

export async function callLLM(systemPrompt, userMessage) {
  const prompt = `${systemPrompt}\n\n${userMessage}`;

  const output = await new Promise((resolve, reject) => {
    const claude = spawn('claude', ['--print'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env },
    });

    let stdout = '';
    let stderr = '';

    claude.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    claude.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    claude.on('close', (code) => {
      if (code !== 0) {
        console.error(`Claude Code exited with code ${code}.`);
        if (stderr) console.error(stderr);
        process.exit(1);
      }
      resolve(stdout.trim());
    });

    claude.on('error', (err) => {
      if (err.code === 'ENOENT') {
        console.error('\nClaude Code is not installed or not in PATH.');
        console.error('Install it: https://docs.anthropic.com/en/docs/claude-code\n');
        process.exit(1);
      }
      console.error(`\nFailed to spawn Claude: ${err.message}\n`);
      process.exit(1);
    });

    claude.stdin.write(prompt);
    claude.stdin.end();
  });

  if (!output) {
    console.error('No content returned from Claude Code.');
    process.exit(1);
  }

  return output;
}
