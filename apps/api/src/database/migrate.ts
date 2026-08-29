import { readFile, readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required');

const directory = join(dirname(fileURLToPath(import.meta.url)), 'migrations');
const files = (await readdir(directory)).filter((name) => name.endsWith('.up.sql')).sort();
const pool = new Pool({ connectionString: databaseUrl, application_name: 'veyra-migrator' });
const client = await pool.connect();

try {
  await client.query('SELECT pg_advisory_lock(hashtext($1))', ['veyra-schema-migrations']);
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  for (const file of files) {
    const alreadyApplied = await client.query<{ exists: boolean }>(
      'SELECT EXISTS (SELECT 1 FROM schema_migrations WHERE version = $1) AS exists',
      [file],
    );
    if (alreadyApplied.rows[0]?.exists) continue;

    const sql = await readFile(join(directory, file), 'utf8');
    await client.query('BEGIN');
    try {
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', [file]);
      await client.query('COMMIT');
      process.stdout.write(`Applied ${file}\n`);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  }
} finally {
  await client
    .query('SELECT pg_advisory_unlock(hashtext($1))', ['veyra-schema-migrations'])
    .catch(() => undefined);
  client.release();
  await pool.end();
}
