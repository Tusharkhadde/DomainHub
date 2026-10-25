import {describe,it,expect} from 'vitest';
import request from 'supertest';
import {createApp} from './app.js';

const app=createApp();
describe('HTTP boundary',()=>{
  it('returns a health response',async()=>{const r=await request(app).get('/api/health');expect(r.status).toBe(200);expect(r.body.data.status).toBe('ok');});
  it('rejects protected requests without an HttpOnly session cookie',async()=>{const r=await request(app).get('/api/domains');expect(r.status).toBe(401);expect(r.body.error).toBe('Authentication required');});
  it('rejects incomplete registration input with a client error',async()=>{const r=await request(app).post('/api/auth/register').send({});expect(r.status).toBe(400);expect(r.body.error).toMatch(/name, email, and password/);});
  it('does not expose stack traces in API errors',async()=>{const r=await request(app).get('/api/admin/summary');expect(r.status).toBe(401);expect(JSON.stringify(r.body)).not.toMatch(/stack|sql/i);});
});
