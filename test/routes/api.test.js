import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'path';
import os from 'os';
import fs from 'fs';
import request from 'supertest';

// Integration tests for the HTTP API (M-9). The app is imported with side effects
// disabled (no listen / scheduler) against a throwaway SQLite database.
//
// Note: the login rate limiter allows 10 attempts / 15 min / IP, so these tests
// deliberately log in sparingly and share one authenticated agent.

const TMP_DB = path.join(os.tmpdir(), `zk-test-${process.pid}-${Date.now()}.db`);

let app;
let agent;   // shared authenticated agent
let csrf;    // shared CSRF token
const PASSWORD = 'TestPassw0rd!!';

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  process.env.DB_PATH = TMP_DB;
  process.env.SESSION_SECRET = 'x'.repeat(48);
  process.env.ENCRYPTION_KEY = 'a'.repeat(64); // valid 32-byte hex key
  process.env.TRUST_PROXY = 'false';

  const serverMod = await import('../../server.js');
  app = serverMod.default;

  const users = await import('../../data/users.js');
  if (users.userCount() === 0) {
    await users.createUser('admin', PASSWORD);
  }

  agent = request.agent(app);
  const res = await agent.post('/api/auth/login').send({ username: 'admin', password: PASSWORD });
  expect(res.status).toBe(200);
  csrf = res.body.csrfToken;
});

afterAll(() => {
  for (const suffix of ['', '-shm', '-wal']) {
    try { fs.unlinkSync(TMP_DB + suffix); } catch { /* ignore */ }
  }
});

describe('health', () => {
  it('returns OK without auth', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('OK');
  });
});

describe('authentication', () => {
  it('rejects unauthenticated API access with 401', async () => {
    const res = await request(app).get('/api/accounts');
    expect(res.status).toBe(401);
  });

  it('issues a 64-char CSRF token on login', () => {
    expect(typeof csrf).toBe('string');
    expect(csrf.length).toBe(64);
  });
});

describe('CSRF enforcement', () => {
  it('blocks a mutating request without the CSRF token', async () => {
    const res = await agent.post('/api/accounts').send({
      name: 'x', auth_email: 'a@b.com', auth_method: 'token', auth_key: 'k',
    });
    expect(res.status).toBe(403);
  });
});

describe('accounts validation + encryption', () => {
  it('rejects an invalid auth_method', async () => {
    const res = await agent.post('/api/accounts').set('X-CSRF-Token', csrf).send({
      name: 'bad', auth_email: 'a@b.com', auth_method: 'nope', auth_key: 'k',
    });
    expect(res.status).toBe(400);
  });

  it('creates an account, hides the key on list, reveals it via the key endpoint', async () => {
    const create = await agent.post('/api/accounts').set('X-CSRF-Token', csrf).send({
      name: 'cf', auth_email: 'a@b.com', auth_method: 'token', auth_key: 'super-secret-key',
    });
    expect(create.status).toBe(201);
    expect(create.body.auth_key).toBeUndefined();

    const list = await agent.get('/api/accounts');
    expect(list.body.some(a => a.auth_key !== undefined)).toBe(false);

    const reveal = await agent.get(`/api/accounts/${create.body.id}/key`);
    expect(reveal.body.auth_key).toBe('super-secret-key'); // decrypts back to plaintext
  });
});

describe('records validation', () => {
  it('rejects an invalid ttl', async () => {
    const res = await agent.post('/api/records').set('X-CSRF-Token', csrf).send({
      zone_id: 1, record_name: 'x.example.com', ttl: 5,
    });
    expect(res.status).toBe(400);
  });
});

describe('zones validation', () => {
  it('rejects an invalid Cloudflare zone identifier', async () => {
    const res = await agent.post('/api/zones').set('X-CSRF-Token', csrf).send({
      account_id: 1, zone_identifier: 'not-a-valid-id', name: 'example.com',
    });
    expect(res.status).toBe(400);
  });
});

describe('settings secret masking (L-3)', () => {
  it('never returns raw secrets from the list endpoint', async () => {
    await agent.put('/api/settings').set('X-CSRF-Token', csrf).send({
      telegram_bot_token: '123:REAL_SECRET_TOKEN',
    });
    const res = await agent.get('/api/settings');
    expect(res.body.telegram_bot_token).not.toContain('REAL_SECRET_TOKEN');
    expect(res.body.telegram_bot_token_set).toBe(true);

    const reveal = await agent.get('/api/settings/reveal');
    expect(reveal.body.telegram_bot_token).toBe('123:REAL_SECRET_TOKEN');
  });
});

describe('restore validation (H-2 / M-3)', () => {
  it('rejects a malformed backup before wiping data', async () => {
    const before = (await agent.get('/api/accounts')).body.length;
    expect(before).toBeGreaterThan(0); // an account exists from the earlier test

    const res = await agent.post('/api/settings/restore').set('X-CSRF-Token', csrf).send({
      accounts: [{ name: 'x', auth_email: 'a@b.com', auth_method: 'INVALID', auth_key: 'k' }],
      zones: [],
      records: [],
    });
    expect(res.status).toBe(400);

    const after = (await agent.get('/api/accounts')).body.length;
    expect(after).toBe(before); // data untouched by the rejected restore
  });
});

describe('logout CSRF (L-2)', () => {
  it('blocks logout without a CSRF token, allows it with one', async () => {
    const freshAgent = request.agent(app);
    const login = await freshAgent.post('/api/auth/login').send({ username: 'admin', password: PASSWORD });
    expect(login.status).toBe(200);

    const blocked = await freshAgent.post('/api/auth/logout');
    expect(blocked.status).toBe(403);

    const ok = await freshAgent.post('/api/auth/logout').set('X-CSRF-Token', login.body.csrfToken);
    expect(ok.status).toBe(200);
  });
});
