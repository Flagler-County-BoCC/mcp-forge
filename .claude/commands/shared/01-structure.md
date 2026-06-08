# Step 1 — Project Structure & package.json

## Prerequisites
- `AUDIT_MANIFEST` from Step 0 must be in context.
- `projectType` must be resolved.

## Objective
Establish the canonical directory layout and `package.json` that every subsequent step will extend. Layout varies by `projectType`.

---

## Directory Layout

Select the layout that matches `AUDIT_MANIFEST.projectType`. Apply it exactly — do not mix layouts.

### projectType: "http-api"

```
src/
  config/
  errors/
  lib/
  middleware/
  modules/
    <domain>/
      <domain>.controller.ts
      <domain>.service.ts
      <domain>.repository.ts
      <domain>.schema.ts
      <domain>.types.ts
      __tests__/
  routes/
  app.ts
  server.ts
tests/
  integration/
  e2e/
prisma/           (if ORM detected)
.env.example
.env.test
Dockerfile
docker-compose.yml
```

### projectType: "library"

```
src/
  errors/
  lib/
  modules/
    <feature>/
      <feature>.ts
      <feature>.types.ts
      <feature>.schema.ts
      __tests__/
        <feature>.spec.ts
  index.ts
tests/
  integration/
.env.test         (only if the library hits external services)
```

No `config/env.ts`, no `middleware/`, no `server.ts`, no `app.ts`, no `Dockerfile`.

### projectType: "cli"

```
src/
  commands/
    <command-name>/
      <command-name>.command.ts
      <command-name>.options.ts
      <command-name>.types.ts
      __tests__/
        <command-name>.spec.ts
  config/
  errors/
  lib/
  index.ts
tests/
  integration/
.env.example
.env.test
```

No `middleware/`, no `routes/`, no `app.ts`, no `server.ts`.

### projectType: "worker"

```
src/
  config/
  errors/
  lib/
  jobs/
    <job-name>/
      <job-name>.handler.ts
      <job-name>.schema.ts
      <job-name>.types.ts
      __tests__/
        <job-name>.spec.ts
  queues/
  scheduler.ts
  worker.ts
tests/
  integration/
.env.example
.env.test
Dockerfile
docker-compose.yml
```

No `middleware/`, no `routes/`, no `app.ts`, no `server.ts`.

### projectType: "mcp-server"

```
src/
  config/
  errors/
  lib/
    logger.ts
    validate.ts
    http-client.ts    # typed HTTP client for external API calls
    container.ts      # DI — wires clients, services, tool registrations
  tools/
    <module>/
      <module>.tool.ts      # McpServer tool registration + handler
      <module>.schema.ts    # zod schemas for tool inputs/outputs
      <module>.types.ts
      __tests__/
        <module>.tool.spec.ts
  server.ts           # McpServer factory (no connect() call)
  stdio.ts            # process entry — connects StdioServerTransport
tests/
  integration/
    <module>.tool.test.ts
scripts/
  setup.ts            # registers in Claude Desktop + Claude Code; installs slash commands
  uninstall.ts        # de-registers; removes slash commands
templates/
  .claude/
    commands/
      <prefix>-audit.md
      <prefix>-plan.md
      <prefix>-step.md
      <prefix>-rewrite.md
.env.example
.env.test
```

No `middleware/`, no `routes/`, no `app.ts`. No HTTP server. `server.ts` creates the `McpServer`; `stdio.ts` connects the transport. `scripts/setup.ts` is mandatory — see `entrypoints/mcp-server.md` for the full implementation.

Domain names for `tools/<module>/` come from `AUDIT_MANIFEST.mcpTools[*].module` (deduplicated, sorted).

---

## package.json Requirements

Rules that apply to **all** project types:
1. `"type": "module"` — ESM only.
2. `engines.node` must be `">=22.0.0"`.
3. Never use `"*"` or `"latest"` as a version specifier.

### Scripts by projectType

**http-api:**
```json
{
  "build":            "tsc -p tsconfig.build.json",
  "start":            "node dist/server.js",
  "dev":              "tsx watch src/server.ts",
  "lint":             "eslint src tests",
  "lint:fix":         "eslint src tests --fix",
  "format":           "prettier --write .",
  "format:check":     "prettier --check .",
  "test":             "vitest run",
  "test:watch":       "vitest",
  "test:coverage":    "vitest run --coverage",
  "test:integration": "vitest run tests/integration",
  "typecheck":        "tsc --noEmit"
}
```

**library:**
```json
{
  "build":          "tsc -p tsconfig.build.json",
  "lint":           "eslint src tests",
  "lint:fix":       "eslint src tests --fix",
  "format":         "prettier --write .",
  "format:check":   "prettier --check .",
  "test":           "vitest run",
  "test:watch":     "vitest",
  "test:coverage":  "vitest run --coverage",
  "typecheck":      "tsc --noEmit",
  "prepublishOnly": "npm run typecheck && npm run lint && npm run test && npm run build"
}
```

Also add:
```json
{
  "main":    "./dist/index.js",
  "types":   "./dist/index.d.ts",
  "exports": { ".": { "import": "./dist/index.js", "types": "./dist/index.d.ts" } },
  "files":   ["dist", "README.md", "CHANGELOG.md"]
}
```

**cli:**
```json
{
  "build":            "tsc -p tsconfig.build.json",
  "start":            "node dist/index.js",
  "dev":              "tsx src/index.ts",
  "lint":             "eslint src tests",
  "lint:fix":         "eslint src tests --fix",
  "format":           "prettier --write .",
  "format:check":     "prettier --check .",
  "test":             "vitest run",
  "test:watch":       "vitest",
  "test:coverage":    "vitest run --coverage",
  "typecheck":        "tsc --noEmit"
}
```

Also add: `"bin": { "<projectName>": "./dist/index.js" }`. Ensure `dist/index.js` has `#!/usr/bin/env node` as the first line.

**worker:**
```json
{
  "build":            "tsc -p tsconfig.build.json",
  "start":            "node dist/worker.js",
  "dev":              "tsx watch src/worker.ts",
  "lint":             "eslint src tests",
  "lint:fix":         "eslint src tests --fix",
  "format":           "prettier --write .",
  "format:check":     "prettier --check .",
  "test":             "vitest run",
  "test:watch":       "vitest",
  "test:coverage":    "vitest run --coverage",
  "test:integration": "vitest run tests/integration",
  "typecheck":        "tsc --noEmit"
}
```

**mcp-server:**
```json
{
  "build":            "tsc -p tsconfig.build.json",
  "start":            "node dist/stdio.js",
  "dev":              "tsx watch src/stdio.ts",
  "lint":             "eslint src tests",
  "lint:fix":         "eslint src tests --fix",
  "format":           "prettier --write .",
  "format:check":     "prettier --check .",
  "test":             "vitest run",
  "test:watch":       "vitest",
  "test:coverage":    "vitest run --coverage",
  "test:integration": "vitest run tests/integration",
  "typecheck":        "tsc --noEmit",
  "inspect":          "npx @modelcontextprotocol/inspector node dist/stdio.js",
  "setup":            "npm run build && tsx scripts/setup.ts",
  "uninstall":        "tsx scripts/uninstall.ts"
}
```

`inspect` allows local debugging via the MCP Inspector. `setup` builds then registers the server in Claude Desktop and Claude Code, and installs slash commands to `~/.claude/commands/`. `uninstall` reverses all registration.

### devDependencies — all project types

```
typescript           ^5.4.0
tsx                  ^4.7.0
vitest               ^1.5.0
@vitest/coverage-v8  ^1.5.0
eslint               ^9.0.0
@typescript-eslint/eslint-plugin  ^7.0.0
@typescript-eslint/parser         ^7.0.0
prettier             ^3.2.0
@types/node          ^22.0.0
pino-pretty          ^11.0.0
```

Add only when applicable:
- `supertest ^7.0.0` + `@types/supertest ^6.0.0` — **http-api only**
- `execa ^9.0.0` — **cli only**

### dependencies — by projectType

**All types:** `pino ^9.0.0`, `zod ^3.22.0`

**http-api only:** detected framework + `helmet` + `cors`

**library only:** `pino` is a `devDependency` and `peerDependency` — add to `peerDependencies`: `{ "pino": ">=8.0.0" }`

**cli only:** detected CLI framework (default `commander ^12.0.0`)

**worker only:** detected queue library (default `bullmq ^5.0.0`)

**mcp-server:** `@modelcontextprotocol/sdk ^1.0.0`, plus HTTP client for external API calls (`axios ^1.6.0` OR `got ^14.0.0` — keep detected one, default to `axios`)

## tsconfig.json — all types

The base `tsconfig.json` covers the full source tree (src, tests, scripts) for editor support and the `typecheck` command. It does **not** set `rootDir` — that belongs only in `tsconfig.build.json`. Mixing `rootDir: "src"` with `include: ["src", "tests"]` in the same tsconfig causes a TypeScript error (`File 'tests/...' is not under 'rootDir'`).

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "lib": ["ES2022"],
    "outDir": "dist",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "exactOptionalPropertyTypes": true,
    "forceConsistentCasingInFileNames": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "skipLibCheck": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src", "tests", "scripts"],
  "exclude": ["node_modules", "dist"]
}
```

`esModuleInterop: true` and `allowSyntheticDefaultImports: true` are required for default imports from `node:path`, `node:fs/promises`, and other CJS-originated modules.

## tsconfig.build.json — all types

The build config restricts compilation to `src/` only and sets `rootDir` to enforce the output shape. This is the config used by `tsc -p tsconfig.build.json`.

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist"
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist", "tests", "scripts"]
}
```

For **library** type, also add: `"declarationDir": "dist"` to `tsconfig.build.json`'s `compilerOptions`.

## .prettierrc.json — all types

```json
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2,
  "endOfLine": "lf"
}
```

## Determinism Rules
- Apply exactly one layout based on `projectType` — never mix.
- **library**: `src/index.ts` must export every public symbol.
- **cli**: every `bin` entry must have a `#!/usr/bin/env node` shebang.
- **mcp-server**: `src/server.ts` creates the `McpServer`; `src/stdio.ts` is the only file that calls `server.connect()`.
- Domain names come from: `publicApiRoutes` (http-api), `exportedSymbols` (library), `cliCommands` (cli), job file names (worker), `mcpTools[*].module` deduplicated (mcp-server).
- Do not add `supertest` or `execa` to mcp-server projects.
