import { describe, it, expect } from 'vitest';
import { csrfProtect, refreshCsrfToken } from '../../middleware/csrfProtect.js';

function makeReq({ method = 'POST', path = '/accounts', csrfHeader, sessionToken } = {}) {
  return {
    method,
    path,
    headers: { 'x-csrf-token': csrfHeader },
    session: { csrfToken: sessionToken },
  };
}

function makeRes() {
  const res = { statusCode: null, body: null };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json   = (body)  => { res.body = body; return res; };
  return res;
}

describe('csrfProtect (HIGH-1)', () => {
  it('allows GET requests without a token', () => {
    const req  = makeReq({ method: 'GET' });
    const res  = makeRes();
    let called = false;
    csrfProtect(req, res, () => { called = true; });
    expect(called).toBe(true);
    expect(res.statusCode).toBeNull();
  });

  it('allows POST /auth/login without a token', () => {
    const req  = makeReq({ method: 'POST', path: '/auth/login' });
    const res  = makeRes();
    let called = false;
    csrfProtect(req, res, () => { called = true; });
    expect(called).toBe(true);
  });

  it('blocks POST with no X-CSRF-Token header', () => {
    const req = makeReq({ method: 'POST', sessionToken: 'abc', csrfHeader: undefined });
    const res = makeRes();
    csrfProtect(req, res, () => {});
    expect(res.statusCode).toBe(403);
  });

  it('blocks POST with mismatched token', () => {
    const req = makeReq({ method: 'POST', sessionToken: 'abc123', csrfHeader: 'wrong' });
    const res = makeRes();
    csrfProtect(req, res, () => {});
    expect(res.statusCode).toBe(403);
  });

  it('allows POST with matching token', () => {
    const token = 'a'.repeat(64);
    const req   = makeReq({ method: 'POST', sessionToken: token, csrfHeader: token });
    const res   = makeRes();
    let called  = false;
    csrfProtect(req, res, () => { called = true; });
    expect(called).toBe(true);
    expect(res.statusCode).toBeNull();
  });

  it('blocks DELETE with no session token', () => {
    const req = makeReq({ method: 'DELETE', sessionToken: undefined, csrfHeader: 'x' });
    const res = makeRes();
    csrfProtect(req, res, () => {});
    expect(res.statusCode).toBe(403);
  });
});

describe('refreshCsrfToken', () => {
  it('stores a 64-char hex token in the session', () => {
    const session = {};
    const token   = refreshCsrfToken(session);
    expect(typeof token).toBe('string');
    expect(token).toHaveLength(64);
    expect(/^[a-f0-9]+$/.test(token)).toBe(true);
    expect(session.csrfToken).toBe(token);
  });

  it('generates a different token each call', () => {
    const a = refreshCsrfToken({});
    const b = refreshCsrfToken({});
    expect(a).not.toBe(b);
  });
});
