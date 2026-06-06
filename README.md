# Zonekeeper — Cloudflare DDNS Manager

A self-hosted web app that replaces per-domain DDNS bash scripts with a single unified service. Manage every Cloudflare DNS record from one UI; the scheduler keeps them in sync with your current public IP automatically.

---

## Features

- Manage multiple Cloudflare accounts (Global API Key or API Token)
- Add any number of zones and A/AAAA records per account
- Automatic IP sync on a configurable interval (default 5 min, minimum 60 s)
- Force-sync individual records or all records at once
- Per-record sync history with status badges (updated / unchanged / error)
- Dashboard with live public IP, last-poll time, and recent activity feed
- Optional HTTP Basic Auth for an additional network-level barrier
- AES-256-GCM encryption for stored Cloudflare API credentials
- Single SQLite file — no external database

---

## Requirements

- **Node.js ≥ 22**
- npm

> **Note:** The backend uses [`better-sqlite3`](https://github.com/WiseLibs/better-sqlite3), not the experimental built-in `node:sqlite` module.

---

## Setup

```bash
# 1. Clone
git clone https://github.com/your-user/zonekeeper-ddns.git
cd zonekeeper-ddns

# 2. Install all dependencies (backend + frontend)
npm run install:all

# 3. Configure
cp .env.example .env
$EDITOR .env          # set SESSION_SECRET and ENCRYPTION_KEY at minimum

# 4. Build the frontend
npm run build         # outputs to frontend/dist/

# 5. Start
npm start
# → http://localhost:3000
```

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | HTTP port the server listens on |
| `DB_PATH` | `./zonekeeper.db` | Path to the SQLite database file |
| `POLL_INTERVAL` | `300` | Sync interval in **seconds** (minimum 60) |
| `LOG_RETENTION_DAYS` | `30` | Days of sync history to keep |
| `SESSION_SECRET` | *(required in prod)* | Secret for signing session cookies |
| `ENCRYPTION_KEY` | *(strongly recommended)* | 64-char hex key for encrypting stored API credentials |
| `ADMIN_USER` | `admin` | Username for first-run admin account |
| `ADMIN_PASS` | *(auto-generated)* | Password for first-run admin account |
| `AUTH_USER` | *(empty)* | HTTP Basic Auth username — both must be set to enable |
| `AUTH_PASS` | *(empty)* | HTTP Basic Auth password |
| `LOG_LEVEL` | `info` | Log level: `error` \| `warn` \| `info` \| `debug` |

### Generating secrets

```bash
# SESSION_SECRET and ENCRYPTION_KEY — 64 random hex chars each
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## Development

```bash
# Terminal 1 — backend with file-watch reload
npm run dev:backend

# Terminal 2 — Vite dev server (proxies /api → localhost:3000)
npm run dev:frontend
# → http://localhost:5173
```

To rebuild the frontend for production:

```bash
npm run build   # outputs to frontend/dist/
```

---

## Testing

```bash
npm test          # run tests once
npm run test:watch   # watch mode
```

---

## Cloudflare Credentials

**Global API Key** — found at [dash.cloudflare.com/profile/api-tokens](https://dash.cloudflare.com/profile/api-tokens) under "Global API Key". Use your account email as the email field.

**API Token** — create a token with `Zone › DNS › Edit` permissions scoped to the zones you want to manage.

Use the **Verify** button on the Accounts page to confirm credentials and browse your Cloudflare zones before adding records.

---

## Homelab Deployment

### systemd

Create `/etc/systemd/system/zonekeeper.service`:

```ini
[Unit]
Description=Zonekeeper DDNS Manager
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=zonekeeper
WorkingDirectory=/opt/zonekeeper
EnvironmentFile=/opt/zonekeeper/.env
ExecStart=/usr/bin/node server.js
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable --now zonekeeper
```

### Docker (unofficial)

```dockerfile
FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY . .
EXPOSE 3000
CMD ["node", "server.js"]
```

Build the frontend first (`npm run build`), then build the image. Pass env vars via `--env-file` and mount a volume for the database:

```bash
docker run -d \
  --name zonekeeper \
  --env-file .env \
  -v /data/zonekeeper:/app \
  -p 3000:3000 \
  zonekeeper
```

---

## Data

The SQLite database (`zonekeeper.db`) stores all accounts, zones, records, and sync history. Cloudflare API keys are encrypted at rest using AES-256-GCM when `ENCRYPTION_KEY` is configured. Back up the database by copying the file:

```bash
sqlite3 zonekeeper.db ".backup zonekeeper-backup.db"
```

Deleting an account cascades to its zones, records, and all sync log entries.
