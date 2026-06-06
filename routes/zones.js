import { Router } from 'express';
import { listZones, getZone, createZone, deleteZone } from '../data/zones.js';
import { getAccount } from '../data/accounts.js';
import { isValidCfId } from '../lib/cloudflare.js';

const router = Router();

router.get('/zones', (req, res) => {
  try {
    const accountId = req.query.accountId != null ? Number(req.query.accountId) : null;
    res.json(listZones(accountId));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/zones', (req, res) => {
  try {
    const { account_id, zone_identifier, name } = req.body;
    if (!account_id || !zone_identifier || !name) {
      return res.status(400).json({ error: 'account_id, zone_identifier, and name are required' });
    }
    // HIGH-2 fix: validate zone_identifier is a Cloudflare 32-hex ID before storing/using in API URLs
    if (!isValidCfId(zone_identifier)) {
      return res.status(400).json({ error: 'zone_identifier must be a valid 32-character Cloudflare zone ID' });
    }
    const account = getAccount(Number(account_id));
    if (!account) return res.status(404).json({ error: 'Account not found' });
    const zone = createZone({ account_id: Number(account_id), zone_identifier, name });
    res.status(201).json(zone);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/zones/:id', (req, res) => {
  try {
    const zone = getZone(Number(req.params.id));
    if (!zone) return res.status(404).json({ error: 'Zone not found' });
    deleteZone(Number(req.params.id));
    res.status(204).end();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
