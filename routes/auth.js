import { Router } from 'express';
import { randomBytes } from 'crypto';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { getUserByUsername, verifyPassword, updatePassword } from '../data/users.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { refreshCsrfToken, csrfProtect } from '../middleware/csrfProtect.js';
import { sendNotification } from '../lib/notifier.js';
import { logger } from '../lib/logger.js';

const router = Router();
const loginFailures = new Map();
const lockedIps = new Map();

// M-2 fix: a fixed dummy hash so a login for a non-existent user still performs a
// bcrypt comparison, equalizing response time and preventing username enumeration.
const DUMMY_HASH = bcrypt.hashSync('zonekeeper-timing-equalizer', 12);

const FAILURE_WINDOW_MS = 5 * 60 * 1000;
const LOCKOUT_MS = 5 * 60 * 1000;

// M-4 fix: periodically evict stale lockout/failure entries so the maps can't grow
// unbounded under a spray of distinct source IPs.
const SWEEP_INTERVAL_MS = 10 * 60 * 1000;
const sweepTimer = setInterval(() => {
  const now = Date.now();
  for (const [ip, expiry] of lockedIps) {
    if (now >= expiry) lockedIps.delete(ip);
  }
  for (const [ip, times] of loginFailures) {
    if (times.every(t => now - t >= FAILURE_WINDOW_MS)) loginFailures.delete(ip);
  }
}, SWEEP_INTERVAL_MS);
sweepTimer.unref?.();

// CRITICAL-1 fix: rate-limit login attempts — 10 per 15 minutes per IP
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts — try again later.' },
});

// L-1 fix: throttle password-change attempts so a hijacked session can't brute-force
// the current password.
const changePasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many password-change attempts — try again later.' },
});

// Password complexity: >= 12 chars, at least one upper, lower, and digit
function isStrongPassword(p) {
  return p.length >= 12 && /[A-Z]/.test(p) && /[a-z]/.test(p) && /\d/.test(p);
}

router.post('/auth/login', loginLimiter, async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  const ip = req.ip || req.socket.remoteAddress;
  const now = Date.now();

  if (lockedIps.has(ip)) {
    const expiry = lockedIps.get(ip);
    if (now < expiry) {
      const remaining = Math.ceil((expiry - now) / 1000 / 60);
      return res.status(403).json({ error: `Too many failed login attempts. Locked out for ${remaining} minute(s).` });
    } else {
      lockedIps.delete(ip);
    }
  }

  const user = getUserByUsername(username);
  // M-2 fix: always run a bcrypt comparison (against a dummy hash when the user is
  // missing) so timing does not reveal whether the username exists.
  const passwordMatches = await verifyPassword(password, user ? user.password_hash : DUMMY_HASH);
  const valid = !!user && passwordMatches;
  if (!valid) {
    let failures = loginFailures.get(ip) || [];
    failures = failures.filter(t => now - t < FAILURE_WINDOW_MS);
    failures.push(now);
    loginFailures.set(ip, failures);

    // Failed login notification
    const alertMsg = `⚠️ **Failed login attempt**\n• IP: \`${ip}\`\n• Username: \`${username}\``;
    sendNotification(alertMsg).catch(err => logger.error({ event: 'auth.alert.fail', err: err.message }, 'Failed to send login alert'));

    if (failures.length >= 5) {
      lockedIps.set(ip, now + LOCKOUT_MS);
      loginFailures.delete(ip);
      const lockoutMsg = `🚨 **IP Locked Out**\n• IP: \`${ip}\` has been locked out for 5 minutes due to 5 failed login attempts.`;
      sendNotification(lockoutMsg).catch(err => logger.error({ event: 'auth.alert.fail', err: err.message }, 'Failed to send lockout alert'));
      return res.status(403).json({ error: 'Too many failed login attempts. Locked out for 5 minutes.' });
    }

    return res.status(401).json({ error: 'Invalid credentials' });
  }

  // Clear failures on successful login
  loginFailures.delete(ip);

  req.session.regenerate((err) => {
    if (err) return res.status(500).json({ error: 'Session error' });
    req.session.userId   = user.id;
    req.session.username = user.username;
    // HIGH-1 / CSRF: generate token on fresh session
    const csrfToken = refreshCsrfToken(req.session);
    res.json({ username: user.username, csrfToken });
  });
});

router.post('/auth/logout', requireAuth, csrfProtect, (req, res) => {
  // LOW-4 fix: handle destroy errors
  req.session.destroy((err) => {
    if (err) {
      // Log but don't surface to client — still clear the cookie
      logger.error({ event: 'auth.logout.destroy', err: err.message }, 'Session destroy error');
    }
    res.clearCookie('zkid');
    res.json({ ok: true });
  });
});

router.get('/auth/me', (req, res) => {
  if (!req.session?.userId) return res.status(401).json({ error: 'Not authenticated' });
  // Lazily generate CSRF token if session predates our CSRF support
  if (!req.session.csrfToken) refreshCsrfToken(req.session);
  res.json({ username: req.session.username, csrfToken: req.session.csrfToken });
});

router.post('/auth/change-password', changePasswordLimiter, requireAuth, csrfProtect, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Both passwords required' });
  }

  // LOW-8 fix: enforce password complexity
  if (!isStrongPassword(newPassword)) {
    return res.status(400).json({
      error: 'New password must be at least 12 characters and include upper, lower, and a digit',
    });
  }

  const user = getUserByUsername(req.session.username);
  if (!user || !(await verifyPassword(currentPassword, user.password_hash))) {
    return res.status(401).json({ error: 'Current password incorrect' });
  }

  await updatePassword(req.session.userId, newPassword);

  // MEDIUM-4 fix: regenerate session after password change so old stolen sessions stop working
  const { userId, username } = req.session;
  req.session.regenerate((err) => {
    if (err) return res.status(500).json({ error: 'Session error' });
    req.session.userId   = userId;
    req.session.username = username;
    refreshCsrfToken(req.session);
    res.json({ ok: true });
  });
});

export default router;
