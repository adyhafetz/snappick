#!/usr/bin/env node
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const sqlFile = path.resolve(__dirname, 'seed_pilot_data.sql');

console.log('Seeding pilot (sample) data for the public dashboard...');

try {
  const result = execSync(`supabase db query --linked -f "${sqlFile}"`, { cwd: rootDir, encoding: 'utf-8', stdio: 'pipe' });
  console.log(result);
} catch (error) {
  console.error('Failed:', error.message);
  if (error.stdout) console.error(error.stdout.toString());
  if (error.stderr) console.error(error.stderr.toString());
  process.exit(1);
}
