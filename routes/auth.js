import { Router } from 'express';
import { getUserByUsername, verifyPassword, updatePassword } from '../data/users.js';
import { requireAuth } from '../middleware/requireAuth.js';

const router = Router();

router.post('/auth/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  const user = getUserByUsername(username);
  const valid = user && await verifyPassword(password, user.password_hash);
  if (!valid) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  req.session.regenerate((err) => {
    if (err) return res.status(500).json({ error: 'Session error' });
    req.session.userId = user.id;
    req.session.username = user.username;
    res.json({ username: user.username });
  });
});

router.post('/auth/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('zkid');
    res.json({ ok: true });
  });
});

router.get('/auth/me', (req, res) => {
  if (!req.session?.userId) return res.status(401).json({ error: 'Not authenticated' });
  res.json({ username: req.session.username });
});

router.post('/auth/change-password', requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Both passwords required' });
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'New password must be at least 8 characters' });
  }

  const user = getUserByUsername(req.session.username);
  if (!user || !(await verifyPassword(currentPassword, user.password_hash))) {
    return res.status(401).json({ error: 'Current password incorrect' });
  }

  await updatePassword(req.session.userId, newPassword);
  res.json({ ok: true });
});

export default router;
