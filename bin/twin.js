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
  const maxIterations = parseInt(parseFlag('--max-iterations', '5'), 10);
  build(maxIterations);
} else if (command === '--help' || command === '-h') {
  console.log(`
twin - encode your decision-making DNA

Usage:
  twin init                    Interview yourself, generate your .twin file
  twin plan                    Generate tasks that match your taste
  twin build [--max-iterations N]  Build autonomously using Claude Code (default: 5)
  twin --help                  Show this message
`);
} else {
  console.log(`Unknown command: ${command}`);
  console.log(`Run "twin --help" for usage.`);
  process.exit(1);
}
