# Step 10 — Security Hardening

## Prerequisites
- Steps 0–9 applied.

## Objective
Apply a fixed set of security controls appropriate to the project type.

## Controls Matrix

| Control | http-api | library | cli | worker | mcp-server |
|---|---|---|---|---|---|
| HTTP headers (helmet) | Required | Skip | Skip | Skip | Skip |
| Rate limiting | Required | Skip | Skip | Skip | Skip |
| Auth middleware (if auth routes) | Required | Skip | Skip | Skip | Skip |
| Tool allowlist / write gate | Skip | Skip | Skip | Skip | Required |
| Secret management | Required | Required | Required | Required | Required |
| No hardcoded secrets | Required | Required | Required | Required | Required |
| No eval / new Function | Required | Required | Required | Required | Required |
| .gitignore secrets | Required | Required | Required | Required | Required |
| Dependency audit | Required | Required | Required | Required | Required |
| Input validation (zod) | Step 5 | Step 5 | Step 8 | Step 8 | Step 8 |

**Skip the HTTP-specific sections below if `projectType !== "http-api"`.**

---

## HTTP Security Headers — http-api only

Already applied via `helmet` in the entrypoint. Verify `helmet()` is called with no arguments. Do NOT disable any default header.

Add Content-Security-Policy only if the project serves HTML:

```typescript
helmet({ contentSecurityPolicy: { directives: { defaultSrc: ["'self'"], scriptSrc: ["'self'"], styleSrc: ["'self'", "'unsafe-inline'"], imgSrc: ["'self'", 'data:', 'https:'] } } })
```

## Rate Limiting — http-api only

Add to dependencies: Express → `express-rate-limit ^7.0.0` | Fastify → `@fastify/rate-limit ^9.0.0`

```typescript
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 100, standardHeaders: 'draft-7', legacyHeaders: false }));
// Stricter on auth routes:
app.use('/api/v1/auth', rateLimit({ windowMs: 15 * 60 * 1000, max: 10 }));
```

## MCP Tool Allowlist — mcp-server only

The write gate and profile filtering are implemented in `entrypoints/mcp-server.md`. Verify:

1. `src/lib/profile.ts` exists and `isToolAllowedForProfile()` is called in `src/server.ts`.
2. Write operations check `config.mcp.requireConfirm` before executing.
3. `config.mcp.writeAllowlist` is parsed from env and consulted before any non-GET equivalent tool call.
4. `CW_PRIV`, `CW_PUB`, `CW_CLIENT_ID` are in the pino `redact.paths` list.

## Authentication Middleware — http-api only (if auth routes detected)

### src/middleware/auth.ts

```typescript
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import { UnauthorizedError } from '../errors/index.js';

export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) throw new UnauthorizedError('Missing token');
  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, config.auth.jwtSecret) as JwtPayload;
    req.user = payload;
    next();
  } catch {
    throw new UnauthorizedError('Invalid or expired token');
  }
}
```

Add: `jsonwebtoken ^9.0.0` and `@types/jsonwebtoken ^9.0.0`.

## Secret Management — all types

Scan all source files for violations and fix them:
1. No secret, key, token, or password may appear as a string literal in `src/`.
2. No `.env` file (other than `.env.example` and `.env.test`) may be committed — verify `.gitignore`.
3. All secrets read from `env` (from Step 2) — never via `process.env.X` inline in business code.

### .gitignore — Required Entries (all types)

```
node_modules/
dist/
coverage/
.env
.env.local
.env.*.local
*.log
*.pem
*.key
*.crt
```

## Dependency Audit — all types

List every dependency from AUDIT_MANIFEST with `hasCVE: true`. For each, specify the patched version and the `npm audit fix` command. Do not auto-upgrade — document the fix commands.

## Determinism Rules
- HTTP rate limit values (`windowMs: 15min`, `max: 100`, auth max: `10`) are fixed — do not vary by environment.
- MCP write gate check is mandatory if `config.mcp.requireConfirm` is present in the config.
- `.gitignore` entries are additive — never remove an existing entry.
- For mcp-server: the `redact.paths` list in `src/lib/logger.ts` must include credential field names specific to the external API.
