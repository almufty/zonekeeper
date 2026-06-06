import { Router } from 'express';
import { listRecords, getRecord, createRecord, updateRecord, deleteRecord, listEnabledRecords } from '../data/records.js';
import { getLogForRecord } from '../data/syncLog.js';
import { getZone } from '../data/zones.js';
import { syncRecord } from '../scheduler.js';

const router = Router();

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
    const { zone_id, record_name, ttl, proxied, enabled, cloudflare_record_id } = req.body;
    if (!zone_id || !record_name) {
      return res.status(400).json({ error: 'zone_id and record_name are required' });
    }
    const zone = getZone(Number(zone_id));
    if (!zone) return res.status(404).json({ error: 'Zone not found' });
    const record = createRecord({ zone_id: Number(zone_id), record_name, ttl, proxied, enabled, cloudflare_record_id });
    res.status(201).json(record);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/records/:id', (req, res) => {
  try {
    const record = getRecord(Number(req.params.id));
    if (!record) return res.status(404).json({ error: 'Record not found' });
    const updated = updateRecord(Number(req.params.id), req.body);
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
    const limit = req.query.limit ? Number(req.query.limit) : 50;
    res.json(getLogForRecord(Number(req.params.id), limit));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
