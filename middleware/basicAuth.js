import { timingSafeEqual } from 'crypto';

// MEDIUM-8 / LOW-6 fix: fixed implementation of optional HTTP Basic Auth.
// - Only mounted when both AUTH_USER and AUTH_PASS env vars are set (see server.js).
// - Uses constant-time comparison to prevent timing-oracle attacks.
// - Fails closed: returns 401 if credentials are missing or wrong.

export function basicAuth(req, res, next) {
  const expectedUser = process.env.AUTH_USER;
  const expectedPass = process.env.AUTH_PASS;

  // Should not be mounted if vars are absent, but guard defensively
  if (!expectedUser || !expectedPass) {
    return res.status(500).json({ error: 'Basic Auth is misconfigured on the server' });
  }

  const header = req.headers.authorization || '';
  if (!header.startsWith('Basic ')) {
    res.set('WWW-Authenticate', 'Basic realm="Zonekeeper"');
    return res.status(401).send('Unauthorized');
  }

  const decoded = Buffer.from(header.slice(6), 'base64').toString('utf8');
  const colon   = decoded.indexOf(':');
  if (colon === -1) {
    res.set('WWW-Authenticate', 'Basic realm="Zonekeeper"');
    return res.status(401).send('Unauthorized');
  }

  const reqUser = decoded.slice(0, colon);
  const reqPass = decoded.slice(colon + 1);

  // Constant-time comparison — prevents timing-oracle attacks
  const userBuf     = Buffer.from(reqUser);
  const expectedBuf = Buffer.from(expectedUser);
  const passBuf     = Buffer.from(reqPass);
  const expPassBuf  = Buffer.from(expectedPass);

  const userMatch = userBuf.length === expectedBuf.length && timingSafeEqual(userBuf, expectedBuf);
  const passMatch = passBuf.length === expPassBuf.length  && timingSafeEqual(passBuf, expPassBuf);

  if (userMatch && passMatch) return next();

  res.set('WWW-Authenticate', 'Basic realm="Zonekeeper"');
  res.status(401).send('Unauthorized');
}
