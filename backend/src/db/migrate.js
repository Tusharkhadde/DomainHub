import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {dialect, getPool, query} from './adapter.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const sqlDir = path.resolve(__dirname, '../../sql');

export async function ensureSchema() {
  const client = dialect();
  const pool = getPool();
  if (!pool) return;

  if (client === 'postgres') {
    const tables = await query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name='users'"
    );
    if (tables.length > 0) {
      console.log('[db] PostgreSQL tables already exist.');
      return;
    }
    console.log('[db] Creating PostgreSQL schema and seeding sample data...');
    const schemaSql = fs.readFileSync(path.join(sqlDir, 'schema.postgres.sql'), 'utf8').replace(/^\uFEFF/, '');
    const sampleSql = fs.readFileSync(path.join(sqlDir, 'sample.postgres.sql'), 'utf8').replace(/^\uFEFF/, '');

    await pool.query(schemaSql);
    await pool.query(sampleSql);
    console.log('[db] PostgreSQL schema and sample data initialized successfully.');
  } else if (client === 'mysql') {
    const tables = await query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='users'"
    );
    if (tables.length > 0) {
      console.log('[db] MySQL tables already exist.');
      return;
    }
    console.log('[db] Creating MySQL schema and seeding sample data...');
    const schemaSql = fs.readFileSync(path.join(sqlDir, 'schema.mysql.sql'), 'utf8').replace(/^\uFEFF/, '');
    const sampleSql = fs.readFileSync(path.join(sqlDir, 'sample.mysql.sql'), 'utf8').replace(/^\uFEFF/, '');

    const statements = [...schemaSql.split(';'), ...sampleSql.split(';')];
    for (const statement of statements) {
      const trimmed = statement.trim();
      if (!trimmed || trimmed.toLowerCase().startsWith('use ') || trimmed.toLowerCase().startsWith('create database')) continue;
      await pool.query(trimmed);
    }
    console.log('[db] MySQL schema and sample data initialized successfully.');
  }
}

// Standalone execution: node src/db/migrate.js
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  (async () => {
    try {
      const dotenv = await import('dotenv');
      dotenv.config({path: path.resolve(__dirname, '../../.env')});
      dotenv.config();
      const {initDb, closeDb} = await import('./adapter.js');
      initDb();
      await ensureSchema();
      await closeDb();
      console.log('[db] Done.');
      process.exit(0);
    } catch (err) {
      console.error('[db] Migration failed:', err.message);
      process.exit(1);
    }
  })();
}
