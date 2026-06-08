# Step 11 — Observability (Metrics, Tracing, Health)

## Prerequisites
- Steps 0–10 applied.

## Applicability by projectType

| Feature | http-api | library | cli | worker | mcp-server |
|---|---|---|---|---|---|
| HTTP health endpoints | Required | Skip | Skip | Skip | Skip |
| Prometheus metrics | Required | Skip | Skip | Optional | Skip |
| OpenTelemetry tracing | Required | Skip | Skip | Required | Skip |
| Startup log line | n/a | n/a | n/a | Required | Required |

**library:** Skip this entire step.
**cli:** Skip this entire step (short-lived process).
**mcp-server:** Skip HTTP health, Prometheus, and OTel — the startup log line from Step 8 is the only required observability signal. See the mcp-server section below.
**worker:** Skip HTTP health; apply OTel and startup log only.
**http-api:** Apply all sections.

---

## Health Checks — http-api only

### src/routes/health.routes.ts

```typescript
router.get('/health', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString(), version: process.env['npm_package_version'] ?? 'unknown' });
});

router.get('/health/ready', async (_req, res) => {
  try {
    await checkDatabaseConnection();
    res.json({ status: 'ready' });
  } catch {
    res.status(503).json({ status: 'not ready', error: 'database unavailable' });
  }
});

router.get('/health/live', (_req, res) => res.json({ status: 'alive' }));
```

`checkDatabaseConnection`: Prisma → `await prisma.$queryRaw\`SELECT 1\`` | Knex → `await db.raw('SELECT 1')` | pg → `await pool.query('SELECT 1')`.

Health routes must NOT require authentication and must NOT be rate-limited.

## Metrics — http-api only

Add to dependencies: `prom-client ^15.0.0`

### src/lib/metrics.ts

```typescript
import client from 'prom-client';
const register = new client.Registry();
client.collectDefaultMetrics({ register });

export const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [register],
});

export const httpRequestTotal = new client.Counter({
  name: 'http_requests_total', help: 'Total HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

export { register };
```

Expose `GET /metrics` protected by `Authorization: Bearer <METRICS_TOKEN>` in production.

## OpenTelemetry — http-api and worker only

Add to dependencies: `@opentelemetry/sdk-node ^0.52.0`, `@opentelemetry/api ^1.8.0`

### src/lib/tracing.ts

```typescript
import { NodeSDK } from '@opentelemetry/sdk-node';
import { config } from '../config/index.js';

let sdk: NodeSDK | undefined;

export function initTracing(): void {
  if (config.env !== 'production') return;
  sdk = new NodeSDK({ serviceName: '<projectName>' });
  sdk.start();
}

export async function shutdownTracing(): Promise<void> {
  await sdk?.shutdown();
}
```

Call `initTracing()` at top of `src/server.ts` / `src/worker.ts`. Call `await shutdownTracing()` in graceful shutdown.

## mcp-server: Startup Log Requirement

The startup log line emitted in `src/stdio.ts` (from the entrypoint step) serves as the only required observability signal. It must include:

```typescript
logger.info({
  app: '<projectName>',
  env: config.env,
  profile: config.mcp.activeProfile,
  // Add any module/tool counts if available
}, 'MCP stdio server started');
```

This log line is machine-parseable by the host process (Cursor, Claude Desktop) to confirm successful startup. Do not change its format.

## Determinism Rules
- Prometheus metric names: `<namespace>_<name>_<unit>` (snake_case, no dashes).
- Default histogram buckets are fixed as listed above.
- `/metrics` endpoint is at root level (not under `/api/v1/`).
- Health routes are at `/health`, `/health/ready`, `/health/live` — never versioned.
- OTel SDK start errors must be caught and logged — never crash the server.
