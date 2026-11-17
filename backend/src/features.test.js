import {beforeEach, describe, expect, it, vi} from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';

process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long!';
process.env.FRONTEND_URL = 'http://localhost:5173';

const {queryMock, transactionMock} = vi.hoisted(() => ({
  queryMock: vi.fn(),
  transactionMock: vi.fn()
}));

vi.mock('./repositories/database.js', () => ({
  query: queryMock,
  transaction: transactionMock,
  dialect: () => 'postgres',
  initDb: vi.fn(),
  closeDb: vi.fn(),
  getPool: vi.fn()
}));

import {createApp} from './app.js';

const app = createApp();

function authCookie(payload = {id: 2, name: 'Asha Rao', email: 'asha@example.test', role: 'USER'}) {
  const token = jwt.sign(payload, process.env.JWT_SECRET, {expiresIn: '1h'});
  return [`session=${token}`];
}

function adminCookie() {
  return authCookie({id: 1, name: 'Admin', email: 'admin@domainhub.test', role: 'ADMIN'});
}

describe('Full DomainHub Feature Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryMock.mockResolvedValue([]);
    transactionMock.mockImplementation(async work =>
      work({
        query: vi.fn().mockResolvedValue([]),
        insert: vi.fn().mockResolvedValue(1)
      })
    );
  });

  // 1. Health
  it('GET /api/health -> returns status ok', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({status: 'ok'});
  });

  // 2. Auth - Register & Login
  it('POST /api/auth/register -> registers a new user', async () => {
    const txInsert = vi.fn().mockResolvedValue(4);
    transactionMock.mockImplementation(async work => work({query: vi.fn(), insert: txInsert}));

    const res = await request(app).post('/api/auth/register').send({
      name: 'Maya Patel',
      email: 'maya@example.test',
      password: 'Password123!'
    });
    expect(res.status).toBe(201);
    expect(res.body.data).toEqual({
      id: 4,
      name: 'Maya Patel',
      email: 'maya@example.test',
      role: 'USER'
    });
  });

  it('POST /api/auth/login -> logs in with valid credentials and sets session cookie', async () => {
    const bcrypt = await import('bcryptjs');
    const hash = await bcrypt.hash('Password123!', 10);
    queryMock.mockResolvedValueOnce([
      {id: 2, name: 'Asha Rao', email: 'asha@example.test', password_hash: hash, role: 'USER'}
    ]);

    const res = await request(app).post('/api/auth/login').send({
      email: 'asha@example.test',
      password: 'Password123!'
    });
    expect(res.status).toBe(200);
    expect(res.body.data.email).toBe('asha@example.test');
    expect(res.headers['set-cookie']).toBeDefined();
    expect(res.headers['set-cookie'][0]).toMatch(/session=/);
  });

  it('GET /api/auth/me -> returns authenticated user profile', async () => {
    const res = await request(app).get('/api/auth/me').set('Cookie', authCookie());
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      id: 2,
      name: 'Asha Rao',
      email: 'asha@example.test',
      role: 'USER'
    });
  });

  it('POST /api/auth/logout -> clears session cookie', async () => {
    const res = await request(app).post('/api/auth/logout');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ok: true});
  });

  // 3. Search
  it('GET /api/search -> checks domain availability and returns pricing', async () => {
    queryMock.mockImplementation(async sql => {
      if (sql.includes('FROM tlds')) {
        return [{id: 1, extension: '.com', registration_price: '12.99', renewal_price: '14.99'}];
      }
      return [];
    });

    const res = await request(app).get('/api/search?domain=mybrandnewdomain.com');
    expect(res.status).toBe(200);
    expect(res.body.data[0]).toMatchObject({
      name: 'mybrandnewdomain',
      extension: '.com',
      available: true,
      registrationPrice: '12.99',
      renewalPrice: '14.99'
    });
  });

  // 4. Dashboard
  it('GET /api/dashboard -> returns user metrics and recent orders', async () => {
    queryMock.mockImplementation(async sql => {
      if (sql.includes('SELECT expires_at FROM domains')) {
        return [{expires_at: '2027-10-10'}];
      }
      if (sql.includes('SELECT COUNT(*) total FROM auctions')) {
        return [{total: 2}];
      }
      if (sql.includes('FROM orders o')) {
        return [{id: 1, order_type: 'REGISTRATION', amount: '12.99', status: 'COMPLETED'}];
      }
      return [];
    });

    const res = await request(app).get('/api/dashboard').set('Cookie', authCookie());
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      totalDomains: 1,
      liveAuctions: 2,
      recentOrders: expect.any(Array)
    });
  });

  // 5. My Domains
  it('GET /api/domains -> lists user domains with status and renewal price', async () => {
    queryMock.mockResolvedValueOnce([
      {id: 1, name: 'asha', extension: '.com', owner_id: 2, expires_at: '2027-10-10', renewal_price: '14.99'}
    ]);

    const res = await request(app).get('/api/domains').set('Cookie', authCookie());
    expect(res.status).toBe(200);
    expect(res.body.data[0]).toMatchObject({
      name: 'asha',
      extension: '.com',
      status: 'ACTIVE',
      renewalPrice: '14.99'
    });
  });

  // 6. Register Domain
  it('POST /api/domains/register -> registers an available domain', async () => {
    const txQuery = vi.fn(async sql => {
      if (sql.includes('FROM domains WHERE name=')) return [];
      if (sql.includes('FROM tlds WHERE extension=')) return [{registration_price: '12.99'}];
      return [];
    });
    const txInsert = vi.fn(async sql => {
      if (sql.includes('INSERT INTO domains')) return 10;
      if (sql.includes('INSERT INTO orders')) return 20;
      return 30;
    });
    transactionMock.mockImplementation(async work => work({query: txQuery, insert: txInsert}));

    const res = await request(app)
      .post('/api/domains/register')
      .set('Cookie', authCookie())
      .send({domain: 'newcoolproject.com'});

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      id: 10,
      domain: 'newcoolproject.com',
      orderId: 20
    });
  });

  // 7. Renew Domain
  it('POST /api/domains/:id/renew -> extends expiry date and creates renewal order', async () => {
    const txQuery = vi.fn(async sql => {
      if (sql.includes('FROM orders WHERE request_key=')) return [];
      if (sql.includes('FROM domains WHERE id=')) return [{id: 1, owner_id: 2, extension: '.com', expires_at: '2027-01-01'}];
      if (sql.includes('FROM auctions WHERE domain_id=')) return [];
      if (sql.includes('FROM tlds WHERE extension=')) return [{renewal_price: '14.99'}];
      return [];
    });
    const txInsert = vi.fn().mockResolvedValue(25);
    transactionMock.mockImplementation(async work => work({query: txQuery, insert: txInsert}));

    const res = await request(app)
      .post('/api/domains/1/renew')
      .set('Cookie', authCookie())
      .set('Idempotency-Key', 'idempotent-key-123')
      .send();

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      orderId: 25,
      expiresAt: '2028-01-01'
    });
  });

  // 8. Orders
  it('GET /api/orders -> returns user order history', async () => {
    queryMock.mockResolvedValueOnce([
      {id: 1, order_type: 'REGISTRATION', amount: '12.99', status: 'COMPLETED', payment_status: 'SUCCESS'}
    ]);

    const res = await request(app).get('/api/orders').set('Cookie', authCookie());
    expect(res.status).toBe(200);
    expect(res.body.data[0].order_type).toBe('REGISTRATION');
  });

  // 9. DNS Records
  it('GET /api/domains/:id/dns -> returns DNS records for domain', async () => {
    queryMock.mockImplementation(async sql => {
      if (sql.includes('FROM domains WHERE id=')) return [{id: 1}];
      if (sql.includes('FROM dns_records WHERE domain_id=')) {
        return [{id: 1, domain_id: 1, record_type: 'A', name: '@', value: '203.0.113.10', ttl: 3600}];
      }
      return [];
    });

    const res = await request(app).get('/api/domains/1/dns').set('Cookie', authCookie());
    expect(res.status).toBe(200);
    expect(res.body.data[0].record_type).toBe('A');
  });

  it('POST /api/domains/:id/dns -> adds a DNS record', async () => {
    const txQuery = vi.fn().mockResolvedValue([{id: 1}]);
    const txInsert = vi.fn().mockResolvedValue(5);
    transactionMock.mockImplementation(async work => work({query: txQuery, insert: txInsert}));

    const res = await request(app)
      .post('/api/domains/1/dns')
      .set('Cookie', authCookie())
      .send({record_type: 'CNAME', name: 'www', value: 'example.com', ttl: 3600});

    expect(res.status).toBe(201);
    expect(res.body.data).toEqual({id: 5});
  });

  it('PUT /api/dns/:id -> updates a DNS record', async () => {
    const txQuery = vi.fn().mockResolvedValue([{id: 1}]);
    transactionMock.mockImplementation(async work => work({query: txQuery, insert: vi.fn()}));

    const res = await request(app)
      .put('/api/dns/5')
      .set('Cookie', authCookie())
      .send({record_type: 'A', name: '@', value: '192.0.2.1', ttl: 3600});

    expect(res.status).toBe(200);
  });

  it('DELETE /api/dns/:id -> deletes a DNS record', async () => {
    const txQuery = vi.fn().mockResolvedValue([{id: 1}]);
    transactionMock.mockImplementation(async work => work({query: txQuery, insert: vi.fn()}));

    const res = await request(app).delete('/api/dns/5').set('Cookie', authCookie());
    expect(res.status).toBe(200);
  });

  // 10. Transfers
  it('GET /api/transfers -> returns transfers list', async () => {
    queryMock.mockResolvedValueOnce([
      {id: 1, domain_id: 1, name: 'asha', extension: '.com', sender_email: 'asha@example.test', receiver_email: 'ravi@example.test', status: 'PENDING'}
    ]);

    const res = await request(app).get('/api/transfers').set('Cookie', authCookie());
    expect(res.status).toBe(200);
    expect(res.body.data[0].sender_email).toBe('asha@example.test');
  });

  it('POST /api/domains/:id/transfers -> initiates a transfer to another user', async () => {
    const txQuery = vi.fn(async sql => {
      if (sql.includes('FROM domains WHERE id=')) return [{id: 1, owner_id: 2}];
      if (sql.includes("FROM auctions WHERE domain_id=? AND status='LIVE'")) return [];
      if (sql.includes("FROM transfers WHERE domain_id=? AND status='PENDING'")) return [];
      if (sql.includes('FROM users WHERE email=')) return [{id: 3}];
      return [];
    });
    const txInsert = vi.fn().mockResolvedValue(10);
    transactionMock.mockImplementation(async work => work({query: txQuery, insert: txInsert}));

    const res = await request(app)
      .post('/api/domains/1/transfers')
      .set('Cookie', authCookie())
      .send({receiverEmail: 'ravi@example.test'});

    expect(res.status).toBe(201);
    expect(res.body.data).toEqual({id: 10});
  });

  it('POST /api/transfers/:id/accept -> receiver accepts pending transfer', async () => {
    const txQuery = vi.fn(async sql => {
      if (sql.includes('SELECT domain_id FROM transfers')) return [{domain_id: 1}];
      if (sql.includes('SELECT * FROM domains WHERE id=')) return [{id: 1, owner_id: 2}];
      if (sql.includes('SELECT * FROM transfers WHERE id=')) return [{id: 10, domain_id: 1, sender_id: 2, receiver_id: 3, status: 'PENDING'}];
      if (sql.includes("FROM auctions WHERE domain_id=? AND status='LIVE'")) return [];
      return [];
    });
    transactionMock.mockImplementation(async work => work({query: txQuery, insert: vi.fn()}));

    // Calling as receiver (user id 3)
    const receiverCookie = authCookie({id: 3, name: 'Ravi Kumar', email: 'ravi@example.test', role: 'USER'});
    const res = await request(app).post('/api/transfers/10/accept').set('Cookie', receiverCookie);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({status: 'ACCEPTED'});
  });

  // 11. Auctions & Bids
  it('GET /api/auctions/live -> lists live auctions', async () => {
    queryMock.mockImplementation(async sql => {
      if (sql.includes("FROM auctions WHERE status='LIVE' AND ends_at<=")) return [];
      if (sql.includes('FROM auctions a JOIN domains d')) {
        return [{id: 1, domain_id: 3, name: 'greenstudio', extension: '.dev', starting_price: '25.00', highest_bid: '30.00', status: 'LIVE'}];
      }
      return [];
    });

    const res = await request(app).get('/api/auctions/live').set('Cookie', authCookie());
    expect(res.status).toBe(200);
    expect(res.body.data[0].highest_bid).toBe('30.00');
  });

  it('POST /api/domains/:id/auctions -> creates a new auction listing', async () => {
    const txQuery = vi.fn(async sql => {
      if (sql.includes('FROM domains WHERE id=')) return [{id: 1, owner_id: 2}];
      if (sql.includes("FROM auctions WHERE domain_id=? AND status='LIVE'")) return [];
      return [];
    });
    const txInsert = vi.fn().mockResolvedValue(12);
    transactionMock.mockImplementation(async work => work({query: txQuery, insert: txInsert}));

    const startsAt = new Date().toISOString();
    const endsAt = new Date(Date.now() + 86400000 * 5).toISOString();

    const res = await request(app)
      .post('/api/domains/1/auctions')
      .set('Cookie', authCookie())
      .send({
        starting_price: '20.00',
        min_increment: '2.00',
        starts_at: startsAt,
        ends_at: endsAt
      });

    expect(res.status).toBe(201);
    expect(res.body.data).toEqual({id: 12});
  });

  it('POST /api/auctions/:id/bids -> places a valid bid', async () => {
    const txQuery = vi.fn(async sql => {
      if (sql.includes('FROM auctions WHERE id=')) {
        return [{id: 1, seller_id: 2, starting_price: '25.00', min_increment: '2.50', status: 'LIVE', starts_at: new Date(Date.now() - 3600000).toISOString(), ends_at: new Date(Date.now() + 3600000).toISOString()}];
      }
      if (sql.includes('FROM bids WHERE auction_id=')) return [{amount: '30.00'}];
      return [];
    });
    const txInsert = vi.fn().mockResolvedValue(99);
    transactionMock.mockImplementation(async work => work({query: txQuery, insert: txInsert}));

    // Bid by user id 3 (not the seller)
    const bidderCookie = authCookie({id: 3, name: 'Ravi', email: 'ravi@example.test', role: 'USER'});
    const res = await request(app)
      .post('/api/auctions/1/bids')
      .set('Cookie', bidderCookie)
      .send({amount: '35.00'});

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      id: 99,
      minimumNext: '37.50'
    });
  });

  // 12. Admin Features
  it('GET /api/admin/summary -> returns summary metrics for admin', async () => {
    queryMock.mockImplementation(async sql => {
      if (sql.includes('SELECT COALESCE(SUM(amount)')) return [{revenue: '150.00'}];
      if (sql.includes('FROM payments GROUP BY status')) return [{status: 'SUCCESS', count: 3}];
      if (sql.includes('FROM domains WHERE expires_at BETWEEN')) return [{id: 1, name: 'asha', extension: '.com', expires_at: '2026-12-01'}];
      if (sql.includes("FROM auctions WHERE status='LIVE'")) return [{count: 2}];
      if (sql.includes("FROM auctions WHERE status IN ('CLOSED','UNSOLD')")) return [{count: 1}];
      return [];
    });

    const res = await request(app).get('/api/admin/summary').set('Cookie', adminCookie());
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      revenue: '150.00',
      liveAuctions: 2,
      closedAuctions: 1
    });
  });

  it('GET /api/admin/tlds & PUT /api/admin/tlds/:id -> manages TLD pricing', async () => {
    queryMock.mockResolvedValueOnce([
      {id: 1, extension: '.com', registration_price: '12.99', renewal_price: '14.99', active: true}
    ]);

    const getRes = await request(app).get('/api/admin/tlds').set('Cookie', adminCookie());
    expect(getRes.status).toBe(200);
    expect(getRes.body.data[0].extension).toBe('.com');

    queryMock.mockResolvedValueOnce({affectedRows: 1});
    const putRes = await request(app)
      .put('/api/admin/tlds/1')
      .set('Cookie', adminCookie())
      .send({registration_price: '13.99', renewal_price: '15.99'});

    expect(putRes.status).toBe(200);
  });

  it('GET /api/admin/orders -> returns all customer orders for admin', async () => {
    queryMock.mockResolvedValueOnce([
      {id: 1, order_type: 'REGISTRATION', amount: '12.99', status: 'COMPLETED'},
      {id: 2, order_type: 'RENEWAL', amount: '14.99', status: 'COMPLETED'}
    ]);

    const res = await request(app).get('/api/admin/orders').set('Cookie', adminCookie());
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(2);
  });

  it('rejects regular users from accessing admin routes with 403', async () => {
    const res = await request(app).get('/api/admin/summary').set('Cookie', authCookie());
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Administrator access required');
  });
});
