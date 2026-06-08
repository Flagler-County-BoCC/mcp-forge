# Step 2 — Config & Environment Management

## Prerequisites
- `AUDIT_MANIFEST` from Step 0 in context.
- Step 1 file structure applied.

## Objective
Produce `src/config/env.ts` and `src/config/index.ts` that validate all environment variables at startup, fail fast with a clear error if any required variable is missing, and expose a typed, immutable config object to the rest of the application.

## Project Type Gate

**If `projectType === "library"`:** Skip this step entirely. Libraries must not parse `process.env` at module load — that is the caller's responsibility. Do not create `src/config/`.

**All other project types (`http-api`, `cli`, `worker`, `mcp-server`):** Apply all rules below.

## Rules

### src/config/env.ts

1. Import `zod` only — no other config library.
2. Define a `envSchema` using `z.object({...})`.
3. Every variable in `AUDIT_MANIFEST.environmentVariables` must appear as a field.
4. Apply these zod transforms by variable name pattern:
   - `*_PORT` → `z.coerce.number().int().min(1).max(65535)`
   - `*_URL` or `*_DSN` → `z.string().url()`
   - `*_MS` or `*_TIMEOUT*` → `z.coerce.number().int().positive()`
   - `*_RPS` or `*_RPM` or `*_LIMIT` or `*_SIZE` or `*_DAYS` → `z.coerce.number().int().positive()`
   - `*_ENABLED` or `*_DRY_RUN` or `*_CONFIRM*` → `z.coerce.boolean().default(false)`
   - Variables whose value is a JSON array or object (detected by value starting with `[` or `{`) → `z.string().transform((s) => JSON.parse(s) as unknown)`
   - `NODE_ENV` → `z.enum(['development', 'test', 'production']).default('development')`
   - All others → `z.string().min(1)` (unless `hasDefault: true`, then append `.default("<value>")`)
   - Sensitive variables (where `isSensitive: true`) → `.min(8)` minimum length
5. Parse with `envSchema.parse(process.env)` inside a try/catch.
6. On failure, `console.error` a formatted message listing every missing/invalid field, then `process.exit(1)`.
7. Export `env` as a `const` (not a function).

### src/config/index.ts

1. Import `env` from `./env.ts`.
2. Export a single `config` object grouped by the prefix of the env var (split on first `_`).
3. Special groupings that always apply:
   - `env.NODE_ENV` → `config.env`
   - `env.PORT` / `env.HOST` → `config.server.port` / `config.server.host`
   - `env.LOG_LEVEL` → `config.log.level`
4. Example shape for an mcp-server with `CW_*` variables:

```typescript
export const config = {
  env: env.NODE_ENV,
  log: { level: env.LOG_LEVEL ?? 'info' },
  cw: {
    server:    env.CW_SERVER,
    company:   env.CW_COMPANY,
    clientId:  env.CW_CLIENT_ID,
    pub:       env.CW_PUB,
    priv:      env.CW_PRIV,
    apiPath:   env.CW_API_PATH ?? 'v4_6_release',
    timeoutMs: env.CW_TIMEOUT_MS ?? 30000,
  },
  mcp: {
    activeProfile:    env.CW_ACTIVE_PROFILE ?? 'admin',
    profiles:         env.CW_PROFILES,           // already JSON.parsed by zod transform
    allowedOps:       env.CW_ALLOWED_OPERATIONS, // JSON array
    writeAllowlist:   env.CW_WRITE_ALLOWLIST,    // JSON array
    requireConfirm:   env.CW_REQUIRE_CONFIRM_WRITES,
    enableDryRun:     env.CW_ENABLE_DRY_RUN,
    defaultPageSize:  env.CW_DEFAULT_PAGE_SIZE ?? 50,
    maxPageSize:      env.CW_MAX_PAGE_SIZE ?? 100,
  },
} as const;
```

5. The object must be `as const` and never re-exported as mutable.

### .env.example

- Contain every variable from the manifest.
- Sensitive variables get value `CHANGE_ME`.
- Non-sensitive variables with a default get their default value.
- Non-sensitive variables without a default get a descriptive placeholder.
- Add a comment above each block of related variables.

### .env.test

- Contain safe test-only values for every required variable.
- `NODE_ENV=test`.
- Never use production-like URLs or credentials.
- For `mcp-server` projects: set `CW_ENABLED_MODULES` to the smallest valid subset; point `SPEC_PATH` to a test fixture file.

## Determinism Rules
- Group config fields by the prefix of the env var (split on first `_`).
- Field names are camelCase of the portion after the prefix (e.g., `CW_CLIENT_ID` → `cw.clientId`).
- If a variable has no prefix, it goes directly at the top level of `config`.
- JSON-valued env vars (arrays/objects) must use the `.transform` zod pattern — never `JSON.parse` inline in application code.
