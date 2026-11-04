#!/usr/bin/env node
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const sqlFile = path.resolve(__dirname, 'clean_database.sql');

console.log('🧹 Cleaning SnapPick database (preserving users & profiles)...');

try {
  const result = execSync(`supabase db query --linked -f "${sqlFile}"`, {
    cwd: rootDir,
    encoding: 'utf-8',
    stdio: 'pipe',
  });
  console.log(result);
  console.log('✅ Database cleaned successfully! All transactional & scan data cleared.');
} catch (error) {
  console.error('❌ Failed to clean database:', error.message);
  if (error.stdout) console.error(error.stdout.toString());
  if (error.stderr) console.error(error.stderr.toString());
  process.exit(1);
}

