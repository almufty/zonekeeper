import 'dotenv/config';
import express from 'express';
import session from 'express-session';
import { randomBytes } from 'crypto';
import { fileURLToPath } from 'url';
import path from 'path';
import { requireAuth } from './middleware/requireAuth.js';
import authRouter from './routes/auth.js';
import accountsRouter from './routes/accounts.js';
import zonesRouter from './routes/zones.js';
import recordsRouter from './routes/records.js';
import syncRouter from './routes/sync.js';
import statusRouter from './routes/status.js';
import { startScheduler } from './scheduler.js';
import { userCount, createUser } from './data/users.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(express.json());

const sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret) {
  console.warn('Warning: SESSION_SECRET not set — sessions will not persist across restarts.');
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

// Public auth routes (login, logout, me)
app.use('/api', authRouter);

// All other API routes require a valid session
app.use('/api', requireAuth);
app.use('/api', accountsRouter);
app.use('/api', zonesRouter);
app.use('/api', recordsRouter);
app.use('/api', syncRouter);
app.use('/api', statusRouter);

const publicDir = path.join(__dirname, 'frontend', 'dist');
app.use(express.static(publicDir));

app.get('*', (req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

// First-run: create admin user if no users exist
if (userCount() === 0) {
  const adminUser = process.env.ADMIN_USER || 'admin';
  const adminPass = process.env.ADMIN_PASS;
  if (adminPass) {
    await createUser(adminUser, adminPass);
    console.log(`Admin user "${adminUser}" created.`);
  } else {
    const generated = randomBytes(16).toString('hex');
    await createUser(adminUser, generated);
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  First run — admin account created');
    console.log(`  username : ${adminUser}`);
    console.log(`  password : ${generated}`);
    console.log('  Change this in Settings after logging in.');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  }
}

const PORT = parseInt(process.env.PORT || '3000', 10);
app.listen(PORT, () => {
  console.log(`Zonekeeper running on http://localhost:${PORT}`);
});

startScheduler();
