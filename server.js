import 'dotenv/config';
import express from 'express';
import session from 'express-session';
import helmet from 'helmet';
import { randomBytes } from 'crypto';
import { fileURLToPath } from 'url';
import path from 'path';
import { requireAuth } from './middleware/requireAuth.js';
import { basicAuth } from './middleware/basicAuth.js';
import { csrfProtect } from './middleware/csrfProtect.js';
import authRouter from './routes/auth.js';
import accountsRouter from './routes/accounts.js';
import zonesRouter from './routes/zones.js';
import recordsRouter from './routes/records.js';
import syncRouter from './routes/sync.js';
import statusRouter from './routes/status.js';
import { startScheduler } from './scheduler.js';
import { userCount, createUser } from './data/users.js';
import { migrateApiKeys } from './lib/crypto.js';
import { logger } from './lib/logger.js';
import db from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

// HIGH-3 fix: security headers via helmet
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc:  ["'self'"],
      scriptSrc:   ["'self'"],
      styleSrc:    ["'self'", "'unsafe-inline'"],
      imgSrc:      ["'self'", 'data:'],
      connectSrc:  ["'self'"],
      fontSrc:     ["'self'"],
      frameSrc:    ["'none'"],
      objectSrc:   ["'none'"],
      baseUri:     ["'self'"],
    },
  },
}));

app.use(express.json());

// HIGH-7 fix: enforce SESSION_SECRET in production
const sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('FATAL: SESSION_SECRET must be set in production');
  }
  logger.warn({ event: 'startup.no-session-secret' }, 'SESSION_SECRET not set — sessions will not persist across restarts (dev only)');
}

app.use(session({
  name: 'zkid',
  secret: sessionSecret || randomBytes(32).toString('hex'),
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production' && process.env.HTTPS === 'true',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  },
}));

// MEDIUM-8 fix: optional HTTP Basic Auth guard — mounts only when both vars are set
if (process.env.AUTH_USER && process.env.AUTH_PASS) {
  app.use(basicAuth);
  logger.info({ event: 'startup.basic-auth' }, 'HTTP Basic Auth enabled');
}

// Public auth routes (login, logout, me) — no CSRF check here
app.use('/api', authRouter);

// All other API routes require a valid session + CSRF token on mutating requests
app.use('/api', requireAuth);
app.use('/api', csrfProtect);   // HIGH-1 fix
app.use('/api', accountsRouter);
app.use('/api', zonesRouter);
app.use('/api', recordsRouter);
app.use('/api', syncRouter);
app.use('/api', statusRouter);

const publicDir = path.join(__dirname, 'frontend', 'dist');
app.use(express.static(publicDir));

// LOW-7 fix: return JSON 404 for unknown /api paths instead of serving HTML
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Not found' });
  }
  res.sendFile(path.join(publicDir, 'index.html'));
});

// CRITICAL-2 fix: encrypt any plaintext API keys left over from previous versions
migrateApiKeys(db);

// First-run: create admin user if no users exist
if (userCount() === 0) {
  const adminUser = process.env.ADMIN_USER || 'admin';
  const adminPass = process.env.ADMIN_PASS;
  if (adminPass) {
    await createUser(adminUser, adminPass);
    logger.info({ event: 'startup.admin-created', username: adminUser }, `Admin user "${adminUser}" created`);
  } else {
    const generated = randomBytes(16).toString('hex');
    await createUser(adminUser, generated);
    logger.info({ event: 'startup.admin-generated', username: adminUser }, 'First run — admin account created');
    process.stdout.write('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    process.stdout.write('  First run — admin account created\n');
    process.stdout.write(`  username : ${adminUser}\n`);
    process.stdout.write(`  password : ${generated}\n`);
    process.stdout.write('  Change this in Settings after logging in.\n');
    process.stdout.write('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n');
  }
}

const PORT = parseInt(process.env.PORT || '3000', 10);
app.listen(PORT, () => {
  logger.info({ event: 'startup.listen', port: PORT }, `Zonekeeper running on http://localhost:${PORT}`);
});

startScheduler();
