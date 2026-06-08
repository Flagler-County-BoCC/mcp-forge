import pino from 'pino';
import { config } from '../config/index.js';

/**
 * IMPORTANT — MCP stdio servers use stdout exclusively for JSON-RPC.
 * All log output MUST go to stderr (fd 2), never stdout.
 *
 * - Development: pino-pretty → stderr (destination: 2)
 * - Production:  pino JSON    → stderr (process.stderr)
 */
export const logger =
  config.env !== 'production'
    ? pino({
        level: config.log.level,
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            ignore: 'pid,hostname',
            destination: 2, // stderr — never stdout
          },
        },
      })
    : pino({ level: config.log.level }, process.stderr);

export function createLogger(bindings: Record<string, unknown>): pino.Logger {
  return logger.child(bindings);
}
