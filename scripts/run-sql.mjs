#!/usr/bin/env node
// Runs a SQL file against the linked Supabase project without the Supabase CLI (for machines where the CLI is blocked).
//
//   node scripts/run-sql.mjs <file.sql> --yes [--record]
//
// Setup: copy scripts/.env.example to scripts/.env.local (ignored by Git) and set SUPABASE_DB_URL to the connection
// string from Supabase, Connect, "Session pooler". It contains the database password: never commit it or paste it in chat.
//
// Safety:
//   * Needs --yes, because it changes the remote project.
//   * Refuses to connect unless the connection string belongs to this project (see EXPECTED_PROJECT_REF below).
//   * The whole file is sent as one simple query; the seed and reset files wrap themselves in begin/commit.
//   * --record adds a migration file (supabase/migrations/<version>_<name>.sql) to Supabase's migration history
//     after it ran successfully, which is what `supabase db push` would have done.
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const EXPECTED_PROJECT_REF = 'yhlkounkbtfowpaygnks';
const here = path.dirname(fileURLToPath(import.meta.url));

function loadEnv(file) {
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
}
loadEnv(path.join(here, '.env.local'));

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith('--'));
if (!file) {
  console.error('Usage: node scripts/run-sql.mjs <file.sql> --yes [--record]');
  process.exit(2);
}
if (!args.includes('--yes')) {
  console.error('This changes the remote Supabase project. Add --yes to continue.');
  process.exit(2);
}
const url = process.env.SUPABASE_DB_URL;
if (!url) {
  console.error('SUPABASE_DB_URL is not set. Copy scripts/.env.example to scripts/.env.local and fill it in.');
  process.exit(2);
}
if (!url.includes(EXPECTED_PROJECT_REF)) {
  console.error(`The connection string does not belong to project ${EXPECTED_PROJECT_REF}. Nothing was run.`);
  process.exit(2);
}

const full = path.resolve(process.cwd(), file);
if (!existsSync(full)) {
  console.error(`File not found: ${full}`);
  process.exit(2);
}
const sql = readFileSync(full, 'utf8');

const host = new URL(url).host;
console.log(`Running ${path.relative(process.cwd(), full)} on ${host} ...`);

// Supabase's pooler uses a certificate chain Node does not trust by default; the connection is still encrypted.
const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false }, statement_timeout: 300000 });
try {
  await client.connect();
  const started = Date.now();
  let results = await client.query(sql);
  if (!Array.isArray(results)) results = [results];
  const shown = results.filter((r) => r.rows && r.rows.length > 0 && r.command === 'SELECT');
  for (const r of shown.slice(-2)) console.table(r.rows.slice(0, 40));
  console.log(`Done in ${((Date.now() - started) / 1000).toFixed(1)} s (${results.length} statements).`);

  if (args.includes('--record')) {
    const m = path.basename(full).match(/^(\d{14}|\d{8,})_(.+)\.sql$/);
    if (!m || !full.includes(`${path.sep}migrations${path.sep}`)) throw new Error('--record only works on a file in supabase/migrations named <version>_<name>.sql');
    await client.query('insert into supabase_migrations.schema_migrations (version, name) values ($1, $2) on conflict (version) do nothing', [m[1], m[2]]);
    console.log(`Recorded migration ${m[1]} (${m[2]}).`);
  }
} catch (e) {
  try {
    await client.query('rollback');
  } catch {}
  console.error(`Failed: ${e.message}`);
  if (e.position) console.error(`At character ${e.position} of the file.`);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => undefined);
}
