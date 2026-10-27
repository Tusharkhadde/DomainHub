import 'dotenv/config';
import {createApp} from './app.js';
import {dialect,initDb} from './repositories/database.js';
const required=['JWT_SECRET','FRONTEND_URL'];
const dbClient=dialect();
if(dbClient==='mysql')required.push('MYSQL_HOST','MYSQL_USER','MYSQL_DATABASE');else if(dbClient==='postgres'){if(!process.env.DATABASE_URL&&!process.env.NEON_DATABASE_URL)required.push('DATABASE_URL');}else throw new Error('DB_CLIENT must be mysql or postgres');
for(const key of required)if(!process.env[key])throw new Error(`Missing required environment variable: ${key}`);
if(process.env.JWT_SECRET.length<32)throw new Error('JWT_SECRET must contain at least 32 characters');
initDb();const app=createApp();app.listen(Number(process.env.PORT||4000),()=>console.log(`Domain Hub API listening on ${process.env.PORT||4000}`));
