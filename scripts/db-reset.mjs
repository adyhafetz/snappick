#!/usr/bin/env node
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const cleanScript = path.resolve(__dirname, 'db-clean.mjs');
const seedScript = path.resolve(__dirname, 'db-seed.mjs');

console.log('🔄 Resetting SnapPick test data (clean + seed)...\n');

try {
  execSync(`node "${cleanScript}"`, { stdio: 'inherit' });
  console.log('');
  execSync(`node "${seedScript}"`, { stdio: 'inherit' });
  console.log('\n🎉 SnapPick test environment is completely fresh and seeded!');
} catch {
  process.exit(1);
}

