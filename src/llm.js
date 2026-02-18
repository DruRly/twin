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
        const msg = stderr
          ? `Claude Code exited with code ${code}: ${stderr.trim()}`
          : `Claude Code exited with code ${code}.`;
        reject(new Error(msg));
        return;
      }
      resolve(stdout.trim());
    });

    claude.on('error', (err) => {
      if (err.code === 'ENOENT') {
        reject(new Error(
          'Claude Code is not installed or not in PATH.\n'
          + 'Install it: https://docs.anthropic.com/en/docs/claude-code'
        ));
        return;
      }
      reject(new Error(`Failed to spawn Claude: ${err.message}`));
    });

    claude.stdin.write(prompt);
    claude.stdin.end();
  });

  if (!output) {
    throw new Error('No content returned from Claude Code.');
  }

  return output;
}
