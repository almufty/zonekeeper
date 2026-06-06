import { Router } from 'express';
import { listRecords, getRecord, createRecord, updateRecord, deleteRecord, listEnabledRecords } from '../data/records.js';
import { getLogForRecord } from '../data/syncLog.js';
import { getZone } from '../data/zones.js';
import { syncRecord } from '../scheduler.js';
import { isValidCfId } from '../lib/cloudflare.js';

const router = Router();

// MEDIUM-5: Cloudflare accepts ttl = 1 (auto) or 60–86400
function isValidTtl(ttl) {
  return Number.isInteger(ttl) && (ttl === 1 || (ttl >= 60 && ttl <= 86400));
}

router.get('/records', (req, res) => {
  try {
    const zoneId = req.query.zoneId != null ? Number(req.query.zoneId) : null;
    res.json(listRecords(zoneId));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/records/:id', (req, res) => {
  try {
    const record = getRecord(Number(req.params.id));
    if (!record) return res.status(404).json({ error: 'Record not found' });
    res.json(record);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/records', (req, res) => {
  try {
    const { zone_id, record_name, record_type = 'A', ttl = 3600, proxied, enabled, cloudflare_record_id } = req.body;
    if (!zone_id || !record_name) {
      return res.status(400).json({ error: 'zone_id and record_name are required' });
    }
    // MEDIUM-6: validate record_type
    if (!['A', 'AAAA'].includes(record_type)) {
      return res.status(400).json({ error: 'record_type must be "A" or "AAAA"' });
    }
    // MEDIUM-5: validate TTL
    const parsedTtl = Number(ttl);
    if (!isValidTtl(parsedTtl)) {
      return res.status(400).json({ error: 'ttl must be 1 (auto) or an integer between 60 and 86400' });
    }
    // HIGH-2: validate cloudflare_record_id if provided
    if (cloudflare_record_id && !isValidCfId(cloudflare_record_id)) {
      return res.status(400).json({ error: 'cloudflare_record_id must be a valid 32-character Cloudflare ID' });
    }
    const zone = getZone(Number(zone_id));
    if (!zone) return res.status(404).json({ error: 'Zone not found' });
    const record = createRecord({
      zone_id: Number(zone_id),
      record_name,
      record_type,
      ttl: parsedTtl,
      proxied,
      enabled,
      cloudflare_record_id: cloudflare_record_id || null,
    });
    res.status(201).json(record);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/records/:id', (req, res) => {
  try {
    const record = getRecord(Number(req.params.id));
    if (!record) return res.status(404).json({ error: 'Record not found' });

    // Explicitly pick and validate fields — don't pass raw req.body to data layer
    const allowed = ['record_name', 'record_type', 'zone_id', 'ttl', 'proxied', 'enabled', 'cloudflare_record_id'];
    const fields = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) fields[key] = req.body[key];
    }
    
    if (fields.record_type !== undefined) {
      if (!['A', 'AAAA'].includes(fields.record_type)) {
        return res.status(400).json({ error: 'record_type must be "A" or "AAAA"' });
      }
    }

    if (fields.zone_id !== undefined) {
      const zone = getZone(Number(fields.zone_id));
      if (!zone) return res.status(404).json({ error: 'Zone not found' });
      fields.zone_id = Number(fields.zone_id);
    }

    if (fields.ttl !== undefined) {
      const parsedTtl = Number(fields.ttl);
      if (!isValidTtl(parsedTtl)) {
        return res.status(400).json({ error: 'ttl must be 1 (auto) or an integer between 60 and 86400' });
      }
      fields.ttl = parsedTtl;
    }
    if (fields.cloudflare_record_id && !isValidCfId(fields.cloudflare_record_id)) {
      return res.status(400).json({ error: 'cloudflare_record_id must be a valid 32-character Cloudflare ID' });
    }

    const updated = updateRecord(Number(req.params.id), fields);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/records/:id', (req, res) => {
  try {
    const record = getRecord(Number(req.params.id));
    if (!record) return res.status(404).json({ error: 'Record not found' });
    deleteRecord(Number(req.params.id));
    res.status(204).end();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/records/:id/sync', async (req, res) => {
  try {
    const record = getRecord(Number(req.params.id));
    if (!record) return res.status(404).json({ error: 'Record not found' });

    const allEnabled = listEnabledRecords();
    const full = allEnabled.find(r => r.id === record.id);
    if (!full) return res.status(400).json({ error: 'Record is disabled or missing zone/account data' });

    const result = await syncRecord(full);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/records/:id/log', (req, res) => {
  try {
    const record = getRecord(Number(req.params.id));
    if (!record) return res.status(404).json({ error: 'Record not found' });
    // MEDIUM-3 fix: cap limit to prevent loading millions of rows
    const MAX_LIMIT = 500;
    const limit = Math.min(Math.max(1, Number(req.query.limit) || 50), MAX_LIMIT);
    res.json(getLogForRecord(Number(req.params.id), limit));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
