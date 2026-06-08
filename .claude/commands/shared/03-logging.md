# Step 3 — Structured Logging

## Prerequisites
- Steps 0–2 applied.
- `config` object from `src/config/index.ts` available (except for `library` type — see below).

## Objective
Create a single `src/lib/logger.ts` module. Every log line must flow through this module — never `console.log`, `console.error`, or any other call directly, except in `src/config/env.ts` startup failure and CLI `.action()` handlers.

## Project Type Variant

### If projectType === "library"

Libraries must not own a logger — that causes duplicate logging and forces a pino version on the caller:

```typescript
import type pino from 'pino';

const noopLogger: pino.Logger = {
  trace: () => {}, debug: () => {}, info: () => {},
  warn: () => {},  error: () => {}, fatal: () => {},
  child: () => noopLogger,
} as unknown as pino.Logger;

export type LibraryLogger = Pick<pino.Logger, 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal' | 'child'>;

export function createLogger(base: LibraryLogger = noopLogger): LibraryLogger {
  return base.child({ library: '<projectName>' });
}
```

Every public function that needs logging accepts `logger?: LibraryLogger` and calls `createLogger(logger)`. **Skip the rest of this step for `library` type.**

---

### http-api / cli / worker

### src/lib/logger.ts

```typescript
import pino from 'pino';
import { config } from '../config/index.js';

export const logger = pino({
  level: config.env === 'test' ? 'silent' : (process.env['LOG_LEVEL'] ?? config.log?.level ?? 'info'),
  base: {
    service: '<projectName from AUDIT_MANIFEST>',
    version: process.env['npm_package_version'] ?? 'unknown',
    env: config.env,
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  ...(config.env !== 'production' && {
    transport: {
      target: 'pino-pretty',
      options: { colorize: true, translateTime: 'SYS:standard', ignore: 'pid,hostname' },
    },
  }),
  redact: {
    paths: [
      'password', 'passwd', 'secret', 'token', 'apiKey', 'api_key',
      'authorization', 'cookie', 'priv', 'privateKey', 'clientSecret',
      '*.password', '*.token', '*.secret', '*.priv', '*.privateKey',
    ],
    censor: '[REDACTED]',
  },
  serializers: {
    err: pino.stdSerializers.err,
    req: pino.stdSerializers.req,
    res: pino.stdSerializers.res,
  },
});

export function createLogger(context: Record<string, unknown>): pino.Logger {
  return logger.child(context);
}
```

---

### mcp-server

**CRITICAL — stdout is reserved exclusively for JSON-RPC protocol messages.**
Any log output on stdout will corrupt the MCP transport and cause JSON parse errors in the client.
All pino output MUST go to stderr (file descriptor 2) in every environment.

```typescript
import pino from 'pino';
import { config } from '../config/index.js';

/**
 * MCP stdio rule: stdout is for JSON-RPC only.
 * ALL log output goes to stderr — development and production alike.
 *
 * Dev:  pino-pretty → stderr (destination: 2)
 * Prod: pino JSON   → stderr (process.stderr)
 */
export const logger =
  config.env !== 'production'
    ? pino({
        level: config.env === 'test' ? 'silent' : (process.env['LOG_LEVEL'] ?? config.log?.level ?? 'info'),
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            ignore: 'pid,hostname',
            destination: 2, // stderr — never stdout
          },
        },
        redact: {
          paths: ['*.password', '*.token', '*.secret', '*.priv', '*.privateKey', '*.clientSecret'],
          censor: '[REDACTED]',
        },
      })
    : pino(
        {
          level: process.env['LOG_LEVEL'] ?? 'info',
          redact: {
            paths: ['*.password', '*.token', '*.secret', '*.priv', '*.privateKey', '*.clientSecret'],
            censor: '[REDACTED]',
          },
        },
        process.stderr, // explicit stderr destination for production
      );

export function createLogger(context: Record<string, unknown>): pino.Logger {
  return logger.child(context);
}
```

### mcp-server: Additional Redaction

For MCP servers that log API credentials, add to the `redact.paths` array:

```
'cw.pub', 'cw.priv', 'cw.clientId', '*.pub', '*.priv', '*.clientId'
```

### src/middleware/request-logger.ts — http-api only

Generate request-logging middleware that logs `req.method`, `req.url`, `req.id`, and on response `res.statusCode` + `responseTimeMs`.

For **Fastify**: use `fastify.addHook('onRequest', ...)` and `'onResponse'`.
For **Express**: use `(req, res, next) => {...}` middleware.

**Skip `request-logger.ts` for all non-http-api project types.**

## Determinism Rules
- Log level precedence (highest wins): `silent` (test) > `LOG_LEVEL` env var > `config.log.level` > `'info'` default.
- Redact list is fixed — do not reduce it.
- Child logger context key is always `module` (never `component`, `name`, or synonyms).
- http-api / cli / worker: production writes to stdout (never a file path in pino config).
- **mcp-server: ALL output goes to stderr in every environment. stdout is for JSON-RPC only. This is non-negotiable.**
