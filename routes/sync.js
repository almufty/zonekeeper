import { Router } from 'express';
import { syncAll } from '../scheduler.js';

const router = Router();

router.post('/sync', async (req, res) => {
  try {
    const results = await syncAll();
    res.json({ results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
