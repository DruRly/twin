#!/usr/bin/env node

import { execSync } from 'node:child_process';
import { readFile, unlink } from 'node:fs/promises';
import { resolve } from 'node:path';
import { init } from '../src/init.js';
import { plan } from '../src/plan.js';
import { build } from '../src/build.js';
import { steer } from '../src/steer.js';
import { scout } from '../src/scout.js';
import { findTwinPath } from '../src/twin-global.js';

const command = process.argv[2];

function parseFlag(flag, defaultValue) {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return defaultValue;
  return process.argv[idx + 1];
}

if (!command || command === 'init') {
  init();
} else if (command === 'plan') {
  plan();
} else if (command === 'build') {
  const loop = process.argv.includes('--loop');
  const storiesFlag = parseFlag('--stories', null);
  const minutesFlag = parseFlag('--minutes', null);
  const maxStories = storiesFlag ? parseInt(storiesFlag, 10) : (loop ? Infinity : 3);
  const maxMinutes = minutesFlag ? parseInt(minutesFlag, 10) : null;
  build({ maxStories, loop, maxMinutes });
} else if (command === 'steer') {
  steer();
} else if (command === 'scout') {
  scout();
} else if (command === 'show') {
  const twinPath = await findTwinPath(process.cwd());
  if (!twinPath) {
    console.error('No .twin file found. Run `npx twin-cli init` first.\n');
    process.exit(1);
  }
  const content = await readFile(twinPath, 'utf-8');
  console.log(`\n${twinPath}\n`);
  console.log(content);
} else if (command === 'rollback') {
  const cwd = process.cwd();
  const checkpointPath = resolve(cwd, '.twin-checkpoint');
  let sha;
  try {
    sha = (await readFile(checkpointPath, 'utf-8')).trim();
  } catch {
    console.log('\nNo checkpoint found. Nothing to roll back.\n');
    process.exit(0);
  }
  // Find an available branch name to save the run
  const date = new Date().toISOString().slice(0, 10);
  let branchName = `twin/saved-${date}`;
  let suffix = 2;
  while (true) {
    try {
      execSync(`git rev-parse --verify ${branchName}`, { cwd, stdio: 'ignore' });
      branchName = `twin/saved-${date}-${suffix}`;
      suffix++;
    } catch {
      break;
    }
  }
  try {
    execSync(`git branch ${branchName}`, { cwd, stdio: 'pipe' });
    execSync(`git reset --hard ${sha}`, { cwd, stdio: 'inherit' });
    await unlink(checkpointPath);
    console.log(`\nRolled back. Your run is saved on branch ${branchName}.\n`);
  } catch (err) {
    console.error(`\nRollback failed: ${err.message}\n`);
    process.exit(1);
  }
} else if (command === '--help' || command === '-h') {
  console.log(`
twin - your twin builds while you sleep

Usage:
  twin init                       Interview yourself, generate your .twin file
  twin plan                       Your twin decides what to build next
  twin build [--stories N]        Build N stories using Claude Code (default: 3)
  twin build --loop               Build, plan, build — fully autonomous
  twin build --loop --stories 20  Stop after 20 stories
  twin build --loop --minutes 30  Stop after 30 minutes
  twin rollback                   Undo the last build run (saves work to a branch)
  twin steer [message]            Tell your twin what to build next
  twin scout                      Learn an existing project before planning
  twin show                       Print your twin file and its location
  twin --help                     Show this message
`);
} else {
  console.log(`Unknown command: ${command}`);
  console.log(`Run "twin --help" for usage.`);
  process.exit(1);
}
