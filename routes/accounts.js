import { Router } from 'express';
import { listAccounts, getAccount, getAccountWithKey, createAccount, updateAccount, deleteAccount } from '../data/accounts.js';
import { getZones, listDnsRecords, isValidCfId } from '../lib/cloudflare.js';

const router = Router();

router.get('/accounts', (req, res) => {
  try {
    res.json(listAccounts());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/accounts/:id', (req, res) => {
  try {
    const account = getAccount(Number(req.params.id));
    if (!account) return res.status(404).json({ error: 'Account not found' });
    res.json(account);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// HIGH-4: dedicated endpoint to reveal the decrypted API key
router.get('/accounts/:id/key', (req, res) => {
  try {
    const account = getAccountWithKey(Number(req.params.id));
    if (!account) return res.status(404).json({ error: 'Account not found' });
    res.json({ auth_key: account.auth_key });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/accounts', (req, res) => {
  try {
    const { name, auth_email, auth_method, auth_key } = req.body;
    if (!name || !auth_email || !auth_method || !auth_key) {
      return res.status(400).json({ error: 'name, auth_email, auth_method, and auth_key are required' });
    }
    if (!['global', 'token'].includes(auth_method)) {
      return res.status(400).json({ error: 'auth_method must be "global" or "token"' });
    }
    const account = createAccount({ name, auth_email, auth_method, auth_key });
    res.status(201).json(account);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/accounts/:id', (req, res) => {
  try {
    const account = getAccount(Number(req.params.id));
    if (!account) return res.status(404).json({ error: 'Account not found' });

    // Explicitly pick fields — only update auth_key if a non-empty value is supplied
    const { name, auth_email, auth_method, auth_key } = req.body;
    const fields = {};
    if (name       !== undefined) fields.name       = name;
    if (auth_email !== undefined) fields.auth_email = auth_email;
    if (auth_method !== undefined) {
      if (!['global', 'token'].includes(auth_method)) {
        return res.status(400).json({ error: 'auth_method must be "global" or "token"' });
      }
      fields.auth_method = auth_method;
    }
    if (auth_key && auth_key !== '') fields.auth_key = auth_key;

    const updated = updateAccount(Number(req.params.id), fields);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/accounts/:id', (req, res) => {
  try {
    const account = getAccount(Number(req.params.id));
    if (!account) return res.status(404).json({ error: 'Account not found' });
    deleteAccount(Number(req.params.id));
    res.status(204).end();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/accounts/:id/verify', async (req, res) => {
  try {
    const account = getAccountWithKey(Number(req.params.id));
    if (!account) return res.status(404).json({ error: 'Account not found' });
    const zones = await getZones(account);
    res.json(zones.map(z => ({ id: z.id, name: z.name, status: z.status })));
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

router.get('/accounts/:id/zones/:zoneId/records', async (req, res) => {
  try {
    // HIGH-2: validate zoneId format before using in API URL
    if (!isValidCfId(req.params.zoneId)) {
      return res.status(400).json({ error: 'Invalid zone ID format' });
    }
    const account = getAccountWithKey(Number(req.params.id));
    if (!account) return res.status(404).json({ error: 'Account not found' });
    const records = await listDnsRecords(account, req.params.zoneId);
    res.json(records.map(r => ({ id: r.id, name: r.name, content: r.content, ttl: r.ttl, proxied: r.proxied })));
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

export default router;
