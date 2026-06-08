import pino from 'pino';
import { config } from '../config/index.js';

export const logger = pino({
  level: config.log.level,
  ...(config.env !== 'production' && {
    transport: {
      target: 'pino-pretty',
      options: { colorize: true, ignore: 'pid,hostname' },
    },
  }),
  redact: {
    paths: ['*.password', '*.secret', '*.token', '*.apiKey', '*.authorization'],
    censor: '[REDACTED]',
  },
});

export function createLogger(bindings: Record<string, unknown>): pino.Logger {
  return logger.child(bindings);
}
