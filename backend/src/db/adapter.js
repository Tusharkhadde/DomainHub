import mysql from 'mysql2/promise';
import pg from 'pg';

let client;
let pool;

function configuredClient() {
  const configured = process.env.DB_CLIENT;
  if (configured) return configured;
  return process.env.DATABASE_URL || process.env.NEON_DATABASE_URL ? 'postgres' : 'mysql';
}

export function initDb() {
  client = configuredClient();
  if (client === 'mysql') pool = mysql.createPool({host:process.env.MYSQL_HOST,port:Number(process.env.MYSQL_PORT||3306),user:process.env.MYSQL_USER,password:process.env.MYSQL_PASSWORD,database:process.env.MYSQL_DATABASE,waitForConnections:true,connectionLimit:10,decimalNumbers:false});
  else if (client === 'postgres') {
    const connectionString = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL;
    if (!connectionString) throw new Error('Missing required environment variable: DATABASE_URL');
    pool = new pg.Pool({connectionString,ssl:{rejectUnauthorized:false}});
  }
  else throw new Error('DB_CLIENT must be mysql or postgres');
  return pool;
}
export function dialect(){return client || configuredClient();}
function normalize(sql){return client==='postgres'?sql.replace(/\?/g,()=>`$${++normalize.n}`):sql;}
export async function query(sql, params=[]){
  if(client==='mysql'){const [rows]=await pool.execute(sql,params);return rows;}
  normalize.n=0; const result=await pool.query(normalize(sql),params);return result.rows;
}
export async function transaction(work){
  const conn=client==='mysql'?await pool.getConnection():await pool.connect();
  const tx={query:async(sql,params=[])=>{if(client==='mysql'){const [rows]=await conn.execute(sql,params);return rows;}normalize.n=0;return (await conn.query(normalize(sql),params)).rows;},
    insert:async(sql,params=[])=>{if(client==='mysql'){const [r]=await conn.execute(sql,params);return r.insertId;}normalize.n=0;return (await conn.query(normalize(sql)+' RETURNING id',params)).rows[0]?.id;}};
  try{if(client==='mysql')await conn.beginTransaction();else await conn.query('BEGIN');const out=await work(tx);if(client==='mysql')await conn.commit();else await conn.query('COMMIT');return out;}
  catch(e){try{if(client==='mysql')await conn.rollback();else await conn.query('ROLLBACK');}catch{}throw e;}
  finally{if(client==='mysql')conn.release();else conn.release();}
}
export async function closeDb(){await pool?.end();}
