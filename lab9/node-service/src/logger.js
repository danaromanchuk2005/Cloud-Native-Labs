const os = require('os');
const pino = require('pino');

const REPLICA_NAME = process.env.HOSTNAME || os.hostname();

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  base: {
    service: 'node-api',
    replica: REPLICA_NAME,
    pid: process.pid
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: {
    level: (label) => ({ level: label.toUpperCase() })
  },
  redact: {
    paths: [
      'req.headers.authorization',
      'headers.authorization',
      '*.password',
      '*.password_hash',
      '*.accessToken',
      '*.refreshToken',
      'password',
      'token'
    ],
    censor: '[REDACTED]'
  }
});

module.exports = { logger, REPLICA_NAME };
