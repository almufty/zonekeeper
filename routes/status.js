import { Router } from 'express';
import { listRecords } from '../data/records.js';
import { getRecentLogs } from '../data/syncLog.js';
import { getLastPublicIp, getLastPollTime } from '../scheduler.js';

const router = Router();

router.get('/status', (req, res) => {
  try {
    const records = listRecords().map(r => ({
      id: r.id,
      record_name: r.record_name,
      last_ip: r.last_ip,
      last_status: r.last_status,
      last_checked_at: r.last_checked_at,
    }));
    const recentLogs = getRecentLogs(20);
    res.json({
      publicIp: getLastPublicIp(),
      lastPollTime: getLastPollTime(),
      records,
      recentLogs,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
