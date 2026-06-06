# Zonekeeper — Cloudflare DDNS Manager

A self-hosted web app that replaces per-domain DDNS bash scripts with a single unified service. Manage every Cloudflare DNS record from one UI; the scheduler keeps them in sync with your current public IP automatically.

---

## Features

- Manage multiple Cloudflare accounts (Global API Key or API Token)
- Add any number of zones and A records per account
- Automatic IP sync on a configurable interval (default 5 min)
- Force-sync individual records or all records at once
- Per-record sync history with status badges (updated / unchanged / error)
- Dashboard with live public IP, last-poll time, and recent activity feed
- Optional HTTP Basic Auth to password-protect the UI
- Single SQLite file — no external database

---

## Requirements

- **Node.js ≥ 22** (uses the built-in `node:sqlite` module, available since Node 22)
- npm

---

## Setup

```bash
# 1. Clone
git clone https://github.com/your-user/cloudflare-ddns-updater.git
cd cloudflare-ddns-updater

# 2. Install dependencies
npm run install:all

# 3. Configure
cp .env.example .env
$EDITOR .env

# 4. Build the frontend
npm run build

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
| `POLL_INTERVAL` | `300` | Sync interval in **seconds** |
| `AUTH_USER` | *(empty)* | Basic auth username — leave blank to disable auth |
| `AUTH_PASS` | *(empty)* | Basic auth password — leave blank to disable auth |

Both `AUTH_USER` **and** `AUTH_PASS` must be set to enable authentication. If either is empty, the UI is accessible without credentials.

---

## Development

Run backend and frontend dev servers in separate terminals:

```bash
# Terminal 1 — backend with file-watch reload
npm run dev:backend

# Terminal 2 — Vite dev server (proxies /api → localhost:3000)
npm run dev:frontend
# → http://localhost:5173
```

To rebuild the frontend for production:

```bash
npm run build   # outputs to backend/public/
```

---

## Cloudflare Credentials

**Global API Key** — found at [dash.cloudflare.com/profile/api-tokens](https://dash.cloudflare.com/profile/api-tokens) under "Global API Key". Use your account email as the email field.

**API Token** — create a token with `Zone › DNS › Edit` permissions scoped to the zones you want to manage. Leave the email field as the account email (still required for the `X-Auth-Email` header).

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
WorkingDirectory=/opt/zonekeeper/backend
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

No official image is published. A minimal Dockerfile:

```dockerfile
FROM node:22-alpine
WORKDIR /app
COPY backend/package.json .
RUN npm install --production
COPY backend/ .
COPY backend/public/ public/
EXPOSE 3000
CMD ["node", "server.js"]
```

Build the frontend first (`npm run build`), then build the image. Pass env vars via `--env-file` or `-e` flags at runtime. Mount a host volume for the database so it persists across container restarts:

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

The SQLite database (`zonekeeper.db`) stores all accounts, zones, records, and sync history. Back it up by copying the file while the server is idle, or use SQLite's online backup:

```bash
sqlite3 zonekeeper.db ".backup zonekeeper-backup.db"
```

Deleting an account cascades to its zones, records, and all sync log entries.
