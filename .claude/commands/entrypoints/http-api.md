# Entrypoint — http-api

> This file is consumed by Step 8 of the rewrite process. Apply when `AUDIT_MANIFEST.projectType === "http-api"`.

## Controller Convention

```typescript
// src/modules/<domain>/<domain>.controller.ts
export class <Domain>Controller {
  constructor(private readonly service: <Domain>Service) {}

  async get<Domain>ById(req: Request, res: Response): Promise<void> {
    const { id } = validate(IdParamSchema, req.params);
    const result = await this.service.get<Domain>ById(id);
    res.status(200).json(ok(result));
  }
}
```

Rules:
1. Validate all inputs with `validate()` at the top of each method.
2. Use `ok()`, `created()`, or `paginated()` from `src/lib/response.ts` for all responses.
3. Wrap Express handlers with `asyncHandler` (see below) during route registration.
4. Controllers only receive service instances via constructor.

### src/lib/async-handler.ts (Express only)

```typescript
import type { Request, Response, NextFunction, RequestHandler } from 'express';
type AsyncFn = (req: Request, res: Response, next: NextFunction) => Promise<void>;
export function asyncHandler(fn: AsyncFn): RequestHandler {
  return (req, res, next) => void fn(req, res, next).catch(next);
}
```

## Routes — src/routes/<domain>.routes.ts

**Express:**
```typescript
import { Router } from 'express';
import { asyncHandler } from '../lib/async-handler.js';
import { <domain>Controller } from '../lib/container.js';

const router = Router();
router.get('/:id',  asyncHandler((req, res) => <domain>Controller.get<Domain>ById(req, res)));
router.post('/',    asyncHandler((req, res) => <domain>Controller.create<Domain>(req, res)));
export { router as <domain>Routes };
```

**Fastify:**
```typescript
import type { FastifyPluginAsync } from 'fastify';
export const <domain>Routes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/:id', handler);
  fastify.post('/', handler);
};
```

### src/routes/index.ts

Register all domain routers under their base path:

```typescript
// Express:
app.use('/api/v1/<domain>', <domain>Routes);
// Fastify:
app.register(<domain>Routes, { prefix: '/api/v1/<domain>' });
```

Base path is always `/api/v1/` unless AUDIT_MANIFEST routes already have a version prefix.

## src/app.ts

```typescript
export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: config.server.corsOrigin ?? '*', credentials: true }));
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(requestLogger);

  // Routes
  app.use('/api/v1/<domain>', <domain>Routes);

  // Health (before error handler)
  app.get('/health', (_req, res) => res.json({ status: 'ok', uptime: process.uptime() }));

  // Error handler — MUST be last
  app.use(errorHandler);

  return app;
}
```

`app.ts` must NOT call `listen()`.

## src/server.ts

```typescript
const app = createApp();
const server = app.listen(config.server.port, config.server.host, () => {
  logger.info({ port: config.server.port, env: config.env }, 'Server started');
});

process.on('SIGTERM', () => { logger.info('SIGTERM — shutting down'); server.close(() => process.exit(0)); });
process.on('SIGINT',  () => { logger.info('SIGINT — shutting down');  server.close(() => process.exit(0)); });
process.on('unhandledRejection', (reason) => { logger.fatal({ reason }, 'Unhandled rejection'); process.exit(1); });
```

## Required Additional Dependencies

```
helmet      ^8.0.0
cors        ^2.8.5
@types/cors ^2.8.17
```

## Determinism Rules
- Route paths are derived from `AUDIT_MANIFEST.publicApiRoutes` — do not invent new routes.
- `app.ts` must be importable in tests without side effects.
- Graceful shutdown waits for in-flight requests before `process.exit(0)`.
