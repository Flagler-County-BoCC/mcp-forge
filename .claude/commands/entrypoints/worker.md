# Entrypoint — worker

> This file is consumed by Step 8 of the rewrite process. Apply when `AUDIT_MANIFEST.projectType === "worker"`.

## src/worker.ts — Process Entry

```typescript
import { config } from './config/index.js';
import { logger } from './lib/logger.js';
import { startScheduler, stopScheduler } from './scheduler.js';

async function main(): Promise<void> {
  logger.info({ env: config.env }, 'Worker starting');
  await startScheduler();
  logger.info('Worker ready — consuming jobs');
}

async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, 'Shutting down worker');
  await stopScheduler();
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT',  () => void shutdown('SIGINT'));
process.on('unhandledRejection', (reason) => {
  logger.fatal({ reason }, 'Unhandled promise rejection');
  process.exit(1);
});

void main();
```

## src/scheduler.ts — Job Registration

```typescript
export async function startScheduler(): Promise<void> {
  // Register each job from AUDIT_MANIFEST job handlers
  // e.g. queue.process('<job-name>', concurrency, <job-name>Handler);
}

export async function stopScheduler(): Promise<void> {
  // Gracefully close queue connections
}
```

## src/jobs/<job-name>/<job-name>.handler.ts

```typescript
import { validate } from '../../lib/validate.js';
import { <JobName>PayloadSchema } from './<job-name>.schema.js';
import { <jobName>Service } from '../../lib/container.js';
import { createLogger } from '../../lib/logger.js';

const log = createLogger({ module: '<job-name>Handler' });

export async function <jobName>Handler(job: Job): Promise<void> {
  const payload = validate(<JobName>PayloadSchema, job.data);
  log.info({ jobId: job.id }, '<job-name> started');
  await <jobName>Service.<method>(payload);
  log.info({ jobId: job.id }, '<job-name> completed');
}
```

Rules:
1. Every handler validates its payload with `validate()` before processing.
2. Handlers must be idempotent — running the same job twice must not cause double side-effects.
3. Log job start and completion with `jobId` in context.
4. Handlers throw `AppError` subclasses on business failures; the queue library handles retries.
5. Never call `process.exit()` inside a handler.

## Determinism Rules
- `src/worker.ts` is the only process entry — only file calling `startScheduler()`.
- `src/scheduler.ts` is the only place jobs are registered — no inline registration in handler files.
- Worker projects have no `app.ts`, `stdio.ts`, or HTTP server.
