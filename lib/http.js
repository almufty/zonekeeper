import { logger } from './logger.js';

/**
 * Log a server-side error in full and return a generic message to the client.
 * H-4 fix: never leak internal error details (SQLite text, paths, stack) to callers.
 *
 * @param {import('express').Response} res
 * @param {unknown} err
 * @param {string} [event] structured log event name for correlation
 */
export function serverError(res, err, event = 'request.error') {
  logger.error({ event, err: err?.message }, 'Request failed');
  return res.status(500).json({ error: 'Internal server error' });
}
