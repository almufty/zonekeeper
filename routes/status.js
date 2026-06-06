import { Router } from 'express';
import { listRecords } from '../data/records.js';
import { getRecentLogs } from '../data/syncLog.js';
import { getLastPublicIpV4, getLastPublicIpV6, getLastPollTime } from '../scheduler.js';
import { getSetting } from '../data/settings.js';

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
    const pollInterval = parseInt(getSetting('poll_interval', process.env.POLL_INTERVAL || '300'), 10);
    
    res.json({
      publicIpV4: getLastPublicIpV4(),
      publicIpV6: getLastPublicIpV6(),
      lastPollTime: getLastPollTime(),
      pollInterval,
      records,
      recentLogs,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
