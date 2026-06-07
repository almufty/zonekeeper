import { Router } from 'express';
import { syncAll } from '../scheduler.js';
import { serverError } from '../lib/http.js';

const router = Router();

router.post('/sync', async (req, res) => {
  try {
    const results = await syncAll();
    res.json({ results });
  } catch (err) {
    serverError(res, err, 'sync.error');
  }
});

export default router;
