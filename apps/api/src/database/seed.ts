import { readFile, readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required');

const directory = join(dirname(fileURLToPath(import.meta.url)), 'seeds');
const files = (await readdir(directory)).filter((name) => name.endsWith('.sql')).sort();
const pool = new Pool({ connectionString: databaseUrl, application_name: 'veyra-seeder' });
const client = await pool.connect();

try {
  for (const file of files) {
    await client.query('BEGIN');
    try {
      await client.query(await readFile(join(directory, file), 'utf8'));
      await client.query('COMMIT');
      process.stdout.write(`Applied seed ${file}\n`);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  }
} finally {
  client.release();
  await pool.end();
}
