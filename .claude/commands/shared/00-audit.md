# Step 0 — Project Audit

## Role
You are a senior Node.js architect performing a pre-rewrite audit.

## Objective
Produce a **structured JSON manifest** that all subsequent rewrite steps will consume. Do not modify any source files in this step.

## Instructions

1. Read every file in the project tree (excluding `node_modules`, `.git`, `dist`, `build`, `coverage`).
2. Populate the JSON schema below — fill every field exactly; do not add or remove keys.
3. Output the manifest as a fenced `json` code block with the label `// AUDIT_MANIFEST`.
4. After the manifest, output a **Findings** section (markdown) listing issues found, one bullet per issue. Each bullet must include: severity (`CRITICAL | HIGH | MEDIUM | LOW`), file path (relative), and a single sentence description.
5. Do not suggest fixes in this step.

## Project Type Detection

Evaluate rules top-to-bottom; use the **first** match.

| Priority | Rule | projectType |
|---|---|---|
| 1 | Any source file imports `@modelcontextprotocol/sdk` OR entry filename contains `stdio` AND no HTTP `listen()` call | `mcp-server` |
| 2 | `package.json` has a `"bin"` field | `cli` |
| 3 | Entry point contains `listen(` / `createServer(` / `.listen(` (HTTP server) | `http-api` |
| 4 | `package.json` has `"main"` or `"exports"` and no server listen call | `library` |
| 5 | Entry point contains queue consumer, cron, job processor, event loop with no HTTP | `worker` |
| 6 | None of the above match | `http-api` |

## Output Schema

```jsonc
// AUDIT_MANIFEST
{
  "schemaVersion": "3.0.0",
  "projectName": "<string — from package.json name or directory name>",
  "projectType": "<http-api | library | cli | worker | mcp-server>",
  "detectedFramework": "<express | fastify | koa | hapi | commander | yargs | meow | bullmq | @modelcontextprotocol/sdk | none>",
  "detectedOrm": "<prisma | knex | sequelize | typeorm | mongoose | none>",
  "detectedTestRunner": "<jest | vitest | mocha | tap | none>",
  "detectedLanguage": "<typescript | javascript>",
  "nodeVersionRequired": "<string — from .nvmrc, .node-version, or engines field, else null>",
  "isPublishedPackage": false,
  "entryPoints": ["<relative path>"],

  "exportedSymbols": [
    { "name": "<export name>", "kind": "<function | class | constant | type>", "file": "<relative>" }
  ],
  "cliCommands": [
    { "command": "<command name>", "description": "<one line>", "file": "<relative>" }
  ],
  "publicApiRoutes": [
    { "method": "<GET|POST|PUT|PATCH|DELETE>", "path": "<express-style path>", "file": "<relative>" }
  ],
  "mcpTools": [
    { "name": "<tool name>", "module": "<logical group>", "description": "<one line>", "file": "<relative>", "responseFields": [] }
  ],
  "mcpTransport": "<stdio | sse | http | null>",

  "environmentVariables": [
    { "name": "<VAR_NAME>", "usedIn": ["<relative path>"], "hasDefault": false, "isSensitive": false }
  ],
  "externalDependencies": [
    { "name": "<package>", "version": "<current>", "outdated": false, "hasCVE": false }
  ],
  "testCoverage": {
    "exists": false,
    "coveragePercent": null
  },
  "hasDockerfile": false,
  "hasCIConfig": false,
  "hasLinter": false,
  "hasFormatter": false,
  "hasErrorHandling": false,
  "hasStructuredLogging": false,
  "hasInputValidation": false,
  "findings": []
}
```

## Field Population Rules

- `exportedSymbols` — populate only for `library`. Set to `[]` otherwise.
- `cliCommands` — populate only for `cli`. Set to `[]` otherwise.
- `publicApiRoutes` — populate only for `http-api`. Set to `[]` otherwise.
- `mcpTools` — populate only for `mcp-server`. Set to `[]` otherwise.
- `mcpTransport` — populate only for `mcp-server` (`"stdio"` is the default); set to `null` otherwise.
- `isPublishedPackage` — `true` if `package.json` has `"private": false` or no `"private"` field and `"version"` is not `"0.0.0"`.
- `detectedFramework` for `mcp-server`: always `"@modelcontextprotocol/sdk"` if detected.
- `responseFields` — populate only in Create mode (from the API spec). In rewrite
  mode set to `[]` (response field names cannot be reliably inferred from source).

## Determinism Rules
- Always use exact relative paths (forward-slash separated, no leading `./`).
- `isSensitive` = true if the variable name matches: `*_KEY`, `*_SECRET`, `*_TOKEN`, `*_PASSWORD`, `*_PASS`, `*_DSN`, `*_URL`, `*_PUB`, `*_PRIV` (case-insensitive suffix match).
- Sort all arrays alphabetically by their first string field.
- `hasCVE` must be `false` unless you detect a known vulnerable version in your training data; never guess.
- `projectType` must be resolved before any other field.
