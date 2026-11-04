#!/usr/bin/env node
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const sqlFile = path.resolve(__dirname, 'seed_comprehensive_data.sql');

console.log('🌱 Seeding SnapPick database with comprehensive UI/UX test data...');
console.log('   Users: test_a@gmail.com and test_b@gmail.com (password: 12345678)');

try {
  const result = execSync(`supabase db query --linked -f "${sqlFile}"`, {
    cwd: rootDir,
    encoding: 'utf-8',
    stdio: 'pipe',
  });
  console.log(result);
  console.log('✅ Database seeded successfully! All UI/UX flows populated.');
} catch (error) {
  console.error('❌ Failed to seed database:', error.message);
  if (error.stdout) console.error(error.stdout.toString());
  if (error.stderr) console.error(error.stderr.toString());
  process.exit(1);
}

