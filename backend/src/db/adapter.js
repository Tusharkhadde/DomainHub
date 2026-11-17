import mysql from 'mysql2/promise';
import pg from 'pg';

// Parse int8 (BIGINT) as Number in JS so IDs and counts match MySQL behavior
pg.types.setTypeParser(20, (val) => val === null ? null : Number(val));
// Parse date (1082) as YYYY-MM-DD string to avoid timezone shifting and ISO formatting
pg.types.setTypeParser(1082, (val) => val);

let client;
let pool;

function configuredClient() {
  const configured = process.env.DB_CLIENT;
  if (configured) return configured;
  return process.env.DATABASE_URL || process.env.NEON_DATABASE_URL ? 'postgres' : 'mysql';
}

export function initDb() {
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
    if (!connectionString) throw new Error('Missing required environment variable: DATABASE_URL');
    pool = new pg.Pool({connectionString, ssl: {rejectUnauthorized: false}});
  } else {
    throw new Error('DB_CLIENT must be mysql or postgres');
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

export async function query(sql, params = []) {
  if (client === 'mysql') {
    const [rows] = await pool.execute(sql, params);
    return rows;
  }
  const result = await pool.query(normalize(sql), params);
  return result.rows;
}

export async function transaction(work) {
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
  await pool?.end();
}
