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
    const pool = getPool();
    const schemaSql = fs.readFileSync(path.join(sqlDir, 'schema.mysql.sql'), 'utf8').replace(/^\uFEFF/, '');
    const sampleSql = fs.readFileSync(path.join(sqlDir, 'sample.mysql.sql'), 'utf8').replace(/^\uFEFF/, '');

    const statements = [...schemaSql.split(';'), ...sampleSql.split(';')];
    for (const statement of statements) {
      const trimmed = statement.trim();
      if (!trimmed || trimmed.toLowerCase().startsWith('use ') || trimmed.toLowerCase().startsWith('create database')) continue;
      await pool.query(trimmed);
    }
    console.log('[db] MySQL schema and sample data initialized successfully.');
  } else if (client === 'sqlite') {
    const tables = await query(
      "SELECT name AS table_name FROM sqlite_master WHERE type='table' AND name='users'"
    );
    if (tables.length > 0) {
      console.log('[db] SQLite tables already exist.');
      return;
    }
    console.log('[db] Initializing SQLite schema and sample data...');
    const pool = getPool();
    pool.exec(`
      CREATE TABLE users(id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'USER', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
      CREATE TABLE tlds(id INTEGER PRIMARY KEY AUTOINCREMENT, extension TEXT NOT NULL UNIQUE, registration_price REAL NOT NULL, renewal_price REAL NOT NULL, active INTEGER NOT NULL DEFAULT 1);
      CREATE TABLE domains(id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, extension TEXT NOT NULL, owner_id INTEGER NOT NULL, expires_at TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(name,extension));
      CREATE TABLE orders(id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, domain_id INTEGER, order_type TEXT NOT NULL, amount REAL NOT NULL, status TEXT NOT NULL, request_key TEXT UNIQUE, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
      CREATE TABLE payments(id INTEGER PRIMARY KEY AUTOINCREMENT, order_id INTEGER NOT NULL UNIQUE, amount REAL NOT NULL, status TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
      CREATE TABLE dns_records(id INTEGER PRIMARY KEY AUTOINCREMENT, domain_id INTEGER NOT NULL, record_type TEXT NOT NULL, name TEXT NOT NULL, value TEXT NOT NULL, priority INTEGER, ttl INTEGER NOT NULL DEFAULT 3600);
      CREATE TABLE transfers(id INTEGER PRIMARY KEY AUTOINCREMENT, domain_id INTEGER NOT NULL, sender_id INTEGER NOT NULL, receiver_id INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'PENDING', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
      CREATE TABLE auctions(id INTEGER PRIMARY KEY AUTOINCREMENT, domain_id INTEGER NOT NULL, seller_id INTEGER NOT NULL, starting_price REAL NOT NULL, min_increment REAL NOT NULL, starts_at TEXT NOT NULL, ends_at TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'LIVE', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
      CREATE TABLE bids(id INTEGER PRIMARY KEY AUTOINCREMENT, auction_id INTEGER NOT NULL, bidder_id INTEGER NOT NULL, amount REAL NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);

      INSERT INTO users(id,name,email,password_hash,role) VALUES
      (1,'Domain Hub Admin','admin@domainhub.test','$2a$10$1OLCkDwv.pu9ROw69X8N.uzcK/MRywvtUXsyaSbmDvVsrxFmAbDx.','ADMIN'),
      (2,'Asha Rao','asha@example.test','$2a$10$1OLCkDwv.pu9ROw69X8N.uzcK/MRywvtUXsyaSbmDvVsrxFmAbDx.','USER'),
      (3,'Ravi Kumar','ravi@example.test','$2a$10$1OLCkDwv.pu9ROw69X8N.uzcK/MRywvtUXsyaSbmDvVsrxFmAbDx.','USER');
      INSERT INTO tlds(id,extension,registration_price,renewal_price) VALUES(1,'.com',12.99,14.99),(2,'.in',7.99,9.99),(3,'.dev',16.99,18.99);
      INSERT INTO domains(id,name,extension,owner_id,expires_at) VALUES(1,'asha','.com',2,date('now','+240 day')),(2,'ravi','.in',3,date('now','+20 day')),(3,'greenstudio','.dev',2,date('now','+300 day'));
      INSERT INTO orders(id,user_id,domain_id,order_type,amount,status) VALUES(1,2,1,'REGISTRATION',12.99,'COMPLETED'),(2,3,2,'REGISTRATION',7.99,'COMPLETED');
      INSERT INTO payments(order_id,amount,status) VALUES(1,12.99,'SUCCESS'),(2,7.99,'SUCCESS');
      INSERT INTO dns_records(domain_id,record_type,name,value,ttl) VALUES(1,'A','@','203.0.113.10',3600),(1,'TXT','@','domain-hub-demo',3600);
      INSERT INTO auctions(id,domain_id,seller_id,starting_price,min_increment,starts_at,ends_at,status) VALUES(1,3,2,25.00,2.50,datetime('now','-1 day'),datetime('now','+5 day'),'LIVE');
      INSERT INTO bids(auction_id,bidder_id,amount) VALUES(1,3,30.00);
    `);
    console.log('[db] SQLite schema and sample data initialized successfully.');
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
