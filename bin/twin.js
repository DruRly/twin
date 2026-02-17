#!/usr/bin/env node

import { init } from '../src/init.js';

const command = process.argv[2];

if (!command || command === 'init') {
  init();
} else if (command === '--help' || command === '-h') {
  console.log(`
twin - encode your decision-making DNA

Usage:
  twin init    Interview yourself, generate your .twin file
  twin --help  Show this message
`);
} else {
  console.log(`Unknown command: ${command}`);
  console.log(`Run "twin --help" for usage.`);
  process.exit(1);
}
