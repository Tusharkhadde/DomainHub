import mysql from 'mysql2/promise';
import pg from 'pg';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Parse int8 (BIGINT) as Number in JS so IDs and counts match MySQL behavior
pg.types.setTypeParser(20, (val) => val === null ? null : Number(val));
// Parse date (1082) as YYYY-MM-DD string to avoid timezone shifting and ISO formatting
pg.types.setTypeParser(1082, (val) => val);

let client;
let pool;
let sqliteDb;

function configuredClient() {
  const configured = process.env.DB_CLIENT;
  if (configured) return configured;
  return process.env.DATABASE_URL || process.env.NEON_DATABASE_URL ? 'postgres' : 'mysql';
}

async function initSqlite() {
  const {DatabaseSync} = await import('node:sqlite');
  const dataDir = path.resolve(__dirname, '../../data');
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, {recursive: true});
  const dbPath = path.join(dataDir, 'domain_hub.sqlite');
  sqliteDb = new DatabaseSync(dbPath);
  sqliteDb.exec('PRAGMA foreign_keys = ON;');
  pool = sqliteDb;
}

export async function initDb() {
  client = configuredClient();
  if (client === 'mysql') {
    pool = mysql.createPool({
      host: process.env.MYSQL_HOST,
      port: Number(process.env.MYSQL_PORT || 3306),
      user: process.env.MYSQL_USER,
      password: process.env.MYSQL_PASSWORD,
      database: process.env.MYSQL_DATABASE,
      waitForConnections: true,
      connectionLimit: 10,
      decimalNumbers: false,
      dateStrings: true
    });
  } else if (client === 'postgres') {
    const connectionString = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL;
    if (!connectionString) {
      console.log('\n[db] DATABASE_URL is not set. Using built-in local SQLite storage.');
      console.log('[db] When ready to use Neon, add DATABASE_URL=postgresql://... in backend/.env\n');
      client = 'sqlite';
      await initSqlite();
      return pool;
    }
    pool = new pg.Pool({connectionString, ssl: {rejectUnauthorized: false}});
  } else if (client === 'sqlite') {
    await initSqlite();
  } else {
    throw new Error('DB_CLIENT must be mysql, postgres, or sqlite');
  }
  return pool;
}

export function dialect() {
  return client || configuredClient();
}

export function getPool() {
  return pool;
}

function normalize(sql) {
  if (client !== 'postgres') return sql;
  let n = 0;
  return sql.replace(/\?/g, () => `$${++n}`);
}

function cleanSqliteSql(sql) {
  return sql.replace(/\s+FOR\s+UPDATE/gi, '');
}

export async function query(sql, params = []) {
  if (client === 'mysql') {
    const [rows] = await pool.execute(sql, params);
    return rows;
  }
  if (client === 'sqlite') {
    const cleaned = cleanSqliteSql(sql);
    const upper = cleaned.trim().toUpperCase();
    if (upper.startsWith('SELECT')) {
      const stmt = sqliteDb.prepare(cleaned);
      const rows = stmt.all(...params);
      return rows.map(r => ({...r}));
    }
    const stmt = sqliteDb.prepare(cleaned);
    const res = stmt.run(...params);
    return {affectedRows: res.changes, insertId: Number(res.lastInsertRowid)};
  }
  const result = await pool.query(normalize(sql), params);
  return result.rows;
}

export async function transaction(work) {
  if (client === 'sqlite') {
    sqliteDb.exec('BEGIN IMMEDIATE');
    const tx = {
      query: async (sql, params = []) => {
        const cleaned = cleanSqliteSql(sql);
        const upper = cleaned.trim().toUpperCase();
        if (upper.startsWith('SELECT')) {
          const stmt = sqliteDb.prepare(cleaned);
          const rows = stmt.all(...params);
          return rows.map(r => ({...r}));
        }
        const stmt = sqliteDb.prepare(cleaned);
        const res = stmt.run(...params);
        return {affectedRows: res.changes, insertId: Number(res.lastInsertRowid)};
      },
      insert: async (sql, params = []) => {
        const cleaned = cleanSqliteSql(sql);
        const stmt = sqliteDb.prepare(cleaned);
        const res = stmt.run(...params);
        return Number(res.lastInsertRowid);
      }
    };
    try {
      const out = await work(tx);
      sqliteDb.exec('COMMIT');
      return out;
    } catch (e) {
      try { sqliteDb.exec('ROLLBACK'); } catch {}
      throw e;
    }
  }

  const conn = client === 'mysql' ? await pool.getConnection() : await pool.connect();
  const tx = {
    query: async (sql, params = []) => {
      if (client === 'mysql') {
        const [rows] = await conn.execute(sql, params);
        return rows;
      }
      return (await conn.query(normalize(sql), params)).rows;
    },
    insert: async (sql, params = []) => {
      if (client === 'mysql') {
        const [r] = await conn.execute(sql, params);
        return r.insertId;
      }
      const res = await conn.query(normalize(sql) + ' RETURNING id', params);
      const id = res.rows[0]?.id;
      return id !== undefined ? Number(id) : undefined;
    }
  };

  try {
    if (client === 'mysql') await conn.beginTransaction();
    else await conn.query('BEGIN');
    const out = await work(tx);
    if (client === 'mysql') await conn.commit();
    else await conn.query('COMMIT');
    return out;
  } catch (e) {
    try {
      if (client === 'mysql') await conn.rollback();
      else await conn.query('ROLLBACK');
    } catch {}
    throw e;
  } finally {
    if (client === 'mysql') conn.release();
    else conn.release();
  }
}

export async function closeDb() {
  if (client === 'sqlite') {
    sqliteDb?.close();
    return;
  }
  await pool?.end();
}
