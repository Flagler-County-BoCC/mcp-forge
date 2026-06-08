# mcp-forge — Enterprise Node.js Rewrite System

## Purpose

This workspace is a **prompt library** for AI-driven rewrites of any Node.js project to enterprise/industry-standard quality. Every prompt is deterministic: given the same source code twice, the AI produces the same output twice.

**Supported project types:** `http-api` · `library` · `cli` · `worker` · `mcp-server`

Project type is auto-detected in Step 0 and all subsequent steps branch accordingly.

---

## Directory Layout

```
.claude/
  CLAUDE.md                   ← this file
  commands/
    shared/                   ← Steps 00–07, 09–14 (apply to all types, with conditional sections)
      00-audit.md             ← Audit source project, emit AUDIT_MANIFEST with projectType
      01-structure.md         ← Directory layout and package.json by projectType
      02-config.md            ← Zod-validated env, typed config object
      03-logging.md           ← pino structured logger (injected no-op for library type)
      04-errors.md            ← AppError hierarchy + ExternalServiceError
      05-validation.md        ← validate() helper, zod schema conventions
      06-database.md          ← Repository pattern (skip for library / mcp-server without DB)
      07-services.md          ← Service layer + HTTP client DI for mcp-server
      09-testing.md           ← Vitest config + unit/integration test patterns per type
      10-security.md          ← Security controls matrix per type
      11-observability.md     ← Health, metrics, tracing (scoped per type)
      12-ci.md                ← Docker + GitHub Actions CI per type
      13-finalize.md          ← ESLint flat config + completion checklist
      14-docs.md              ← Professional GitHub documentation
    entrypoints/              ← Step 08: one file per project type (most type-specific step)
      http-api.md             ← Controllers, routes, app.ts, server.ts
      library.md              ← Public barrel (src/index.ts), module pattern
      cli.md                  ← Commander commands, shebang, exit codes
      worker.md               ← Job handlers, scheduler, worker.ts
      mcp-server.md           ← McpServer factory, tool registration, tool-error-handler
    masters/
      MASTER.md               ← Universal single-pass prompt (auto-detects type, runs all phases)
```

---

## How to Use

### Option A — Single-pass (small projects, < 2 000 lines)
Use [`masters/MASTER.md`](commands/masters/MASTER.md). Feed your entire source code in context. The AI runs all 6 phases and emits every file.

### Option B — Incremental (large projects, recommended)
Run each step in order:
1. `shared/00-audit.md` → get `AUDIT_MANIFEST`
2. `shared/01-structure.md` through `shared/07-services.md` → scaffold
3. `entrypoints/<projectType>.md` → entrypoint layer (Step 8)
4. `shared/09-testing.md` through `shared/13-finalize.md` → cross-cutting
5. `shared/14-docs.md` → GitHub docs

Each step produces a reviewable diff before applying the next.

---

## Determinism Contract

1. All decisions that *could* vary are resolved by explicit rules (no "choose the best approach").
2. Tool/library choices are pinned to exact package names and minimum semver ranges.
3. File paths, naming conventions, and export shapes are fully specified.
4. `projectType` is immutable once set in Step 0 — never changes mid-rewrite.
5. The AI emits a machine-readable `AUDIT_MANIFEST` before writing any file.

---

## Core Standards

| Concern | Choice |
|---|---|
| Runtime | Node.js ≥ 22 LTS |
| Language | TypeScript 5.x (strict) |
| Package manager | npm with lockfile |
| Linter | ESLint flat-config + `@typescript-eslint` |
| Formatter | Prettier |
| Logging | pino (JSON, structured) |
| Validation | zod |
| HTTP framework | Fastify v4 or Express v5 (detected or defaulted) |
| CLI framework | Commander v12 (detected or defaulted) |
| Queue | BullMQ v5 (detected or defaulted) |
| MCP transport | `@modelcontextprotocol/sdk` stdio (always for mcp-server) |
| ORM/query | Prisma or Knex (detected or defaulted) |
| Testing | Vitest + Supertest (http-api) / in-process McpServer (mcp-server) / execa (cli) |
| CI | GitHub Actions |
| Containers | Docker multi-stage (http-api, worker, mcp-server optional) |

---

## Adding a New Project Type

1. Add a detection rule to `shared/00-audit.md` (priority-ordered table).
2. Add a directory layout section to `shared/01-structure.md`.
3. Add a row to the controls matrix in `shared/10-security.md`.
4. Add an applicability row to `shared/11-observability.md` and `shared/12-ci.md`.
5. Add a test pattern section to `shared/09-testing.md`.
6. Create `entrypoints/<new-type>.md` with the entrypoint scaffolding.
7. Update the entrypoint routing table in `masters/MASTER.md` (Phase 4, step 15).
8. Update this file.
