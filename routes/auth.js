import { Router } from 'express';
import { randomBytes } from 'crypto';
import rateLimit from 'express-rate-limit';
import { getUserByUsername, verifyPassword, updatePassword } from '../data/users.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { refreshCsrfToken } from '../middleware/csrfProtect.js';
import { sendNotification } from '../lib/notifier.js';

const router = Router();
const loginFailures = new Map();
const lockedIps = new Map();

// CRITICAL-1 fix: rate-limit login attempts — 10 per 15 minutes per IP
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts — try again later.' },
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
  const valid = user && await verifyPassword(password, user.password_hash);
  if (!valid) {
    let failures = loginFailures.get(ip) || [];
    failures = failures.filter(t => now - t < 5 * 60 * 1000);
    failures.push(now);
    loginFailures.set(ip, failures);

    // Failed login notification
    const alertMsg = `⚠️ **Failed login attempt**\n• IP: \`${ip}\`\n• Username: \`${username}\``;
    sendNotification(alertMsg).catch(err => console.error('Failed to send login alert:', err.message));

    if (failures.length >= 5) {
      lockedIps.set(ip, now + 5 * 60 * 1000);
      loginFailures.delete(ip);
      const lockoutMsg = `🚨 **IP Locked Out**\n• IP: \`${ip}\` has been locked out for 5 minutes due to 5 failed login attempts.`;
      sendNotification(lockoutMsg).catch(err => console.error('Failed to send lockout alert:', err.message));
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

router.post('/auth/logout', (req, res) => {
  // LOW-4 fix: handle destroy errors
  req.session.destroy((err) => {
    if (err) {
      // Log but don't surface to client — still clear the cookie
      console.error('[auth] Session destroy error:', err.message);
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

router.post('/auth/change-password', requireAuth, async (req, res) => {
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
