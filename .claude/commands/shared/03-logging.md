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

### All other project types (http-api, cli, worker, mcp-server)

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

Rules:
1. Production (`config.env === 'production'`): no `transport` — raw JSON to stdout.
2. Test (`config.env === 'test'`): level is `silent` — no output during tests.
3. Every module calls `createLogger({ module: 'moduleName' })` and uses the child — never imports `logger` directly in business logic.

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
- Production writes to stdout only (never a file path in pino config).
