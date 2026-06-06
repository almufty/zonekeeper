// Simple structured JSON logger — no external deps.
// Outputs one JSON line per event to stdout (errors/warnings to stderr).
// Set LOG_LEVEL env var to: error | warn | info | debug  (default: info)

const LEVEL_VALUES = { error: 0, warn: 1, info: 2, debug: 3 };
const currentLevel = LEVEL_VALUES[process.env.LOG_LEVEL] ?? LEVEL_VALUES.info;

function log(level, dataOrMsg, msg) {
  if (LEVEL_VALUES[level] > currentLevel) return;

  const entry = {
    time: new Date().toISOString(),
    level,
    ...(typeof dataOrMsg === 'string'
      ? { msg: dataOrMsg }
      : { ...dataOrMsg, msg: msg ?? dataOrMsg.msg }),
  };

  const line = JSON.stringify(entry) + '\n';
  if (level === 'error' || level === 'warn') {
    process.stderr.write(line);
  } else {
    process.stdout.write(line);
  }
}

export const logger = {
  error: (data, msg) => log('error', data, msg),
  warn:  (data, msg) => log('warn',  data, msg),
  info:  (data, msg) => log('info',  data, msg),
  debug: (data, msg) => log('debug', data, msg),
};
