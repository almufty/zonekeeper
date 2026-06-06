import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { basicAuth } from '../../middleware/basicAuth.js';

function makeReq(authHeader) {
  return { headers: { authorization: authHeader } };
}

function makeRes() {
  const res = { statusCode: null, body: null, headers: {} };
  res.status = (code) => { res.statusCode = code; return res; };
  res.send   = (body)  => { res.body = body; return res; };
  res.json   = (body)  => { res.body = body; return res; };
  res.set    = (k, v)  => { res.headers[k] = v; return res; };
  return res;
}

describe('basicAuth (MEDIUM-8, LOW-6)', () => {
  beforeEach(() => {
    process.env.AUTH_USER = 'admin';
    process.env.AUTH_PASS = 'secret';
  });
  afterEach(() => {
    delete process.env.AUTH_USER;
    delete process.env.AUTH_PASS;
  });

  it('allows requests with correct credentials', () => {
    const creds  = Buffer.from('admin:secret').toString('base64');
    const req    = makeReq(`Basic ${creds}`);
    const res    = makeRes();
    let called   = false;
    basicAuth(req, res, () => { called = true; });
    expect(called).toBe(true);
    expect(res.statusCode).toBeNull();
  });

  it('rejects requests with wrong password', () => {
    const creds = Buffer.from('admin:wrong').toString('base64');
    const req   = makeReq(`Basic ${creds}`);
    const res   = makeRes();
    basicAuth(req, res, () => {});
    expect(res.statusCode).toBe(401);
  });

  it('rejects requests with no Authorization header', () => {
    const req = makeReq(undefined);
    const res = makeRes();
    basicAuth(req, res, () => {});
    expect(res.statusCode).toBe(401);
    expect(res.headers['WWW-Authenticate']).toMatch(/Basic/);
  });

  it('rejects malformed Authorization header (no colon)', () => {
    const creds = Buffer.from('adminsecret').toString('base64');
    const req   = makeReq(`Basic ${creds}`);
    const res   = makeRes();
    basicAuth(req, res, () => {});
    expect(res.statusCode).toBe(401);
  });

  it('returns 500 when env vars are missing (misconfiguration guard)', () => {
    delete process.env.AUTH_USER;
    const req = makeReq('Basic ' + Buffer.from('admin:secret').toString('base64'));
    const res = makeRes();
    basicAuth(req, res, () => {});
    expect(res.statusCode).toBe(500);
  });
});
