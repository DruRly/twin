#!/usr/bin/env node

import { init } from '../src/init.js';
import { plan } from '../src/plan.js';
import { build } from '../src/build.js';

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
} else if (command === '--help' || command === '-h') {
  console.log(`
twin - your twin builds while you sleep

Usage:
  twin init                  Interview yourself, generate your .twin file
  twin plan                  Your twin decides what to build next
  twin build [--stories N]   Build N stories using Claude Code (default: 3)
  twin build --loop          Build, plan, build — fully autonomous
  twin build --loop --stories 20  Stop after 20 stories
  twin build --loop --minutes 30  Stop after 30 minutes
  twin --help                Show this message
`);
} else {
  console.log(`Unknown command: ${command}`);
  console.log(`Run "twin --help" for usage.`);
  process.exit(1);
}
