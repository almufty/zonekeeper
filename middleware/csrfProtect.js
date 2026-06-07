import { randomBytes } from 'crypto';
import { timingSafeEqual } from 'crypto';

const MUTATING = new Set(['POST', 'PUT', 'DELETE', 'PATCH']);

/**
 * Session-synchronizer-token CSRF protection.
 * - Skips GET / HEAD / OPTIONS.
 * - Skips the login route (no session yet).
 * - All other state-mutating requests must carry X-CSRF-Token matching req.session.csrfToken.
 */
export function csrfProtect(req, res, next) {
  if (!MUTATING.has(req.method)) return next();

  // Login may not have a session token yet — skip it.
  // L-2 fix: logout is no longer exempt; it is protected explicitly in the auth
  // router so a cross-site request cannot force-logout an authenticated user.
  if (req.path === '/auth/login') return next();

  const headerToken = req.headers['x-csrf-token'];
  const sessionToken = req.session?.csrfToken;

  if (!headerToken || !sessionToken) {
    return res.status(403).json({ error: 'CSRF validation failed' });
  }

  // Constant-time comparison to prevent timing oracle attacks
  try {
    const a = Buffer.from(headerToken);
    const b = Buffer.from(sessionToken);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      return res.status(403).json({ error: 'CSRF validation failed' });
    }
  } catch {
    return res.status(403).json({ error: 'CSRF validation failed' });
  }

  next();
}

/** Generate a fresh CSRF token and store it in the session. */
export function refreshCsrfToken(session) {
  session.csrfToken = randomBytes(32).toString('hex');
  return session.csrfToken;
}
