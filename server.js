import 'dotenv/config';
import express from 'express';
import session from 'express-session';
import sqliteStoreFactory from 'better-sqlite3-session-store';
import helmet from 'helmet';
import { randomBytes } from 'crypto';
import { fileURLToPath } from 'url';
import path from 'path';
import { requireAuth } from './middleware/requireAuth.js';
import { csrfProtect } from './middleware/csrfProtect.js';
import authRouter from './routes/auth.js';
import accountsRouter from './routes/accounts.js';
import zonesRouter from './routes/zones.js';
import recordsRouter from './routes/records.js';
import syncRouter from './routes/sync.js';
import statusRouter from './routes/status.js';
import settingsRouter from './routes/settings.js';
import { startScheduler } from './scheduler.js';
import { userCount, createUser } from './data/users.js';
import { migrateApiKeys } from './lib/crypto.js';
import { logger } from './lib/logger.js';
import db from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isProduction = process.env.NODE_ENV === 'production';

// C-1 fix: refuse to run in production with a missing, weak, or publicly-known
// (placeholder) session secret — any of those allow trivial session forgery.
const BANNED_SECRETS = new Set([
  'change-me-to-a-long-random-string-in-production',
  'change-me',
  'secret',
]);

function resolveSessionSecret() {
  const sessionSecret = process.env.SESSION_SECRET;
  if (isProduction) {
    if (!sessionSecret || sessionSecret.length < 32 || BANNED_SECRETS.has(sessionSecret)) {
      throw new Error('FATAL: SESSION_SECRET must be a unique random string of at least 32 characters in production');
    }
    return sessionSecret;
  }
  if (!sessionSecret) {
    logger.warn({ event: 'startup.no-session-secret' }, 'SESSION_SECRET not set — using an ephemeral key (dev only; sessions reset on restart)');
    return randomBytes(32).toString('hex');
  }
  return sessionSecret;
}

// H-1 fix: trust the reverse proxy so req.ip / req.secure reflect the real client
// (otherwise all IP-based rate limiting and lockout collapses to the proxy's IP).
// Configurable via TRUST_PROXY; defaults to the first hop.
function resolveTrustProxy() {
  const raw = process.env.TRUST_PROXY;
  if (raw === undefined) return 1;
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  const num = Number(raw);
  return Number.isFinite(num) ? num : raw;
}

export function createApp() {
  const app = express();

  app.set('trust proxy', resolveTrustProxy());

  // HIGH-3 fix: security headers via helmet
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc:  ["'self'"],
        scriptSrc:   ["'self'"],
        // M-8 fix: dropped 'unsafe-inline'. The bundled CSS is served as a linked
        // file ('self') and React applies component styles via the CSSOM, which
        // CSP does not restrict — verified there are no inline <style>/style=
        // attributes in the production build output.
        styleSrc:    ["'self'"],
        imgSrc:      ["'self'", 'data:'],
        connectSrc:  ["'self'", 'https://api.github.com'],
        fontSrc:     ["'self'"],
        frameSrc:    ["'none'"],
        objectSrc:   ["'none'"],
        baseUri:     ["'self'"],
      },
    },
  }));

  app.use(express.json({ limit: '1mb' }));

  const SqliteStore = sqliteStoreFactory(session);

  app.use(session({
    name: 'zkid',
    // H-3 fix: persist sessions in SQLite instead of the leaky in-memory store.
    store: new SqliteStore({
      client: db,
      expired: { clear: true, intervalMs: 15 * 60 * 1000 },
    }),
    secret: resolveSessionSecret(),
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      // M-1 fix: derive Secure from the (now trusted) X-Forwarded-Proto in
      // production so TLS-terminating proxies get a Secure cookie without a
      // separate HTTPS flag, while plain-HTTP LAN setups still work.
      secure: isProduction ? 'auto' : false,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  }));

  // Public health check route
  app.get('/health', (req, res) => {
    res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
  });

  // Public auth routes (login, me); logout/change-password enforce CSRF internally.
  app.use('/api', authRouter);

  // All other API routes require a valid session + CSRF token on mutating requests
  app.use('/api', requireAuth);
  app.use('/api', csrfProtect);   // HIGH-1 fix
  app.use('/api', accountsRouter);
  app.use('/api', zonesRouter);
  app.use('/api', recordsRouter);
  app.use('/api', syncRouter);
  app.use('/api', statusRouter);
  app.use('/api', settingsRouter);

  const publicDir = path.join(__dirname, 'frontend', 'dist');
  app.use(express.static(publicDir));

  // LOW-7 fix: return JSON 404 for unknown /api paths instead of serving HTML
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api/')) {
      return res.status(404).json({ error: 'Not found' });
    }
    res.sendFile(path.join(publicDir, 'index.html'));
  });

  // M-6 fix: central error handler so an uncaught throw never leaks a stack or
  // crashes the request without a clean JSON response.
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    logger.error({ event: 'request.unhandled', err: err?.message }, 'Unhandled request error');
    if (res.headersSent) return next(err);
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}

const app = createApp();
export default app;

async function bootstrap() {
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
}

// M-6 fix: never let a stray rejection/exception silently take the process down.
process.on('unhandledRejection', (reason) => {
  logger.error({ event: 'process.unhandledRejection', err: reason?.message ?? String(reason) }, 'Unhandled promise rejection');
});
process.on('uncaughtException', (err) => {
  logger.error({ event: 'process.uncaughtException', err: err?.message }, 'Uncaught exception');
});

// M-9 fix: only bootstrap (listen + scheduler + admin seed) when run directly, so
// the app can be imported by tests without side effects.
const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  bootstrap().catch((err) => {
    logger.error({ event: 'startup.fatal', err: err?.message }, 'Fatal startup error');
    process.exit(1);
  });
}
