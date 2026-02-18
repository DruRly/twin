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
  const maxStories = parseInt(parseFlag('--stories', '3'), 10);
  build(maxStories);
} else if (command === '--help' || command === '-h') {
  console.log(`
twin - your twin builds while you sleep

Usage:
  twin init                  Interview yourself, generate your .twin file
  twin plan                  Your twin decides what to build next
  twin build [--stories N]   Build N stories using Claude Code (default: 3)
  twin --help                Show this message
`);
} else {
  console.log(`Unknown command: ${command}`);
  console.log(`Run "twin --help" for usage.`);
  process.exit(1);
}
