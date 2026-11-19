import dotenv from 'dotenv';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load backend/.env regardless of current working directory
dotenv.config({path: path.resolve(__dirname, '../.env')});
dotenv.config();

import {createApp} from './app.js';
import {dialect, initDb} from './repositories/database.js';
import {startAuctionSettlementWorker} from './workers/auctionSettlementWorker.js';
import {ensureSchema} from './db/migrate.js';

const required = ['JWT_SECRET', 'FRONTEND_URL'];
const dbClient = dialect();

if (dbClient === 'mysql') {
  required.push('MYSQL_HOST', 'MYSQL_USER', 'MYSQL_DATABASE');
} else if (dbClient === 'postgres') {
  if (!process.env.DATABASE_URL && !process.env.NEON_DATABASE_URL) {
    console.log('[DomainHub] Notice: No DATABASE_URL set. Running with built-in SQLite engine so all features work immediately out of the box.');
    console.log('[DomainHub] To connect your Neon Cloud DB anytime, paste DATABASE_URL in backend/.env.');
  }
} else if (dbClient !== 'sqlite') {
  throw new Error('DB_CLIENT must be mysql, postgres, or sqlite');
}

for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

if (process.env.JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET must contain at least 32 characters');
}

await initDb();

try {
  await ensureSchema();
} catch (err) {
  console.warn('[db] Note: Schema verification/migration skipped or failed:', err.message);
}

const stopAuctionSettlementWorker = startAuctionSettlementWorker();
const app = createApp();
const port = Number(process.env.PORT || 4000);
const server = app.listen(port, () => console.log(`Domain Hub API listening on ${port}`));
server.on('close', stopAuctionSettlementWorker);
