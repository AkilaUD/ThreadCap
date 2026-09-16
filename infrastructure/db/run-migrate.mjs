// Minimal SQL migrator: applies migrations/*.sql inside transactions.
// Marker format per file: `-- Up Migration` / `-- Down Migration` sections.
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const here = path.dirname(fileURLToPath(import.meta.url));
const dir = path.join(here, 'migrations');
const [dirCmd, target] = process.argv.slice(2);
if (!['up', 'down'].includes(dirCmd ?? '')) {
  console.error('usage: pnpm up | pnpm down [migration-name]');
  process.exit(1);
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is not set. See .env.example and docs/11-deployment.md §3.');
  process.exit(1);
}

const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await client.connect();
await client.query(`
  CREATE TABLE IF NOT EXISTS schema_migrations (
    name TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )
`);

const files = (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort();
const applied = new Set(
  (await client.query('SELECT name FROM schema_migrations')).rows.map((r) => r.name),
);
const toApply = dirCmd === 'up' ? files.filter((f) => !applied.has(f)) : [...files].reverse();

for (const file of target ? files.filter((f) => f === target) : toApply) {
  if (!file) continue;
  const sql = await readFile(path.join(dir, file), 'utf8');
  const up = extract(sql, 'Up Migration');
  const down = extract(sql, 'Down Migration');
  const chosen = dirCmd === 'up' ? up : down;
  if (!chosen) {
    console.warn(`  ! ${file}: no "${dirCmd === 'up' ? 'Up' : 'Down'}" section`);
    continue;
  }
  try {
    await client.query('BEGIN');
    await client.query(chosen);
    if (dirCmd === 'up') {
      await client.query('INSERT INTO schema_migrations (name) VALUES ($1) ON CONFLICT DO NOTHING', [file]);
    } else {
      await client.query('DELETE FROM schema_migrations WHERE name = $1', [file]);
    }
    await client.query('COMMIT');
    console.log(`  ${dirCmd === 'up' ? '+' : '-'} ${file}`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(`  ! ${file} failed:`, err);
    process.exit(1);
  }
}

await client.end();
console.log('done.');

function extract(sql, marker) {
  const esc = marker.replace(/ /g, '\\s+');
  const m = sql.match(new RegExp(`--\\s+${esc}\\s*\\n([\\s\\S]*?)(?=--\\s+(?:Down|Up)\\s*Migration|$)`, 'i'));
  return m ? m[1].trim() : null;
}