import {afterEach,describe,expect,it} from 'vitest';
import {dialect} from './adapter.js';

const originalEnv={
  DB_CLIENT:process.env.DB_CLIENT,
  DATABASE_URL:process.env.DATABASE_URL,
  NEON_DATABASE_URL:process.env.NEON_DATABASE_URL
};

afterEach(()=>{
  for(const [key,value] of Object.entries(originalEnv)){
    if(value===undefined)delete process.env[key];
    else process.env[key]=value;
  }
});

describe('database client selection',()=>{
  it('keeps MySQL as the default when no PostgreSQL URL is configured',()=>{
    delete process.env.DB_CLIENT;
    delete process.env.DATABASE_URL;
    delete process.env.NEON_DATABASE_URL;
    expect(dialect()).toBe('mysql');
  });

  it('preserves explicit local MySQL configuration when a PostgreSQL URL exists',()=>{
    process.env.DB_CLIENT='mysql';
    process.env.DATABASE_URL='postgresql://example.invalid/database?sslmode=require';
    expect(dialect()).toBe('mysql');
  });

  it('selects PostgreSQL when DATABASE_URL is provided without DB_CLIENT',()=>{
    delete process.env.DB_CLIENT;
    process.env.DATABASE_URL='postgresql://example.invalid/database?sslmode=require';
    delete process.env.NEON_DATABASE_URL;
    expect(dialect()).toBe('postgres');
  });

  it('supports an explicit PostgreSQL client',()=>{
    process.env.DB_CLIENT='postgres';
    expect(dialect()).toBe('postgres');
  });

  it('recognizes the legacy Neon URL during configuration migration',()=>{
    delete process.env.DB_CLIENT;
    delete process.env.DATABASE_URL;
    process.env.NEON_DATABASE_URL='postgresql://example.invalid/database?sslmode=require';
    expect(dialect()).toBe('postgres');
  });
});
