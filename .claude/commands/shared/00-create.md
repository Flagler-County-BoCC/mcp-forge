# Step 0 (Create Mode) — Generate the Manifest from an API Spec

> Use this INSTEAD of `shared/00-audit.md` when creating a NEW mcp-server from an
> API specification rather than rewriting existing code. Output is the SAME
> `AUDIT_MANIFEST` shape consumed by every downstream step — only the source
> differs. After this step, run Steps 1–14 and `entrypoints/mcp-server.md`
> exactly as for a rewrite.

## Role
You are a senior architect generating an MCP server from an API specification.
You produce deterministic output: the same spec twice yields an identical manifest.

## Input — pick the FIRST that applies
1. **OpenAPI / Swagger document** (`openapi.json`, `openapi.yaml`, `swagger.json`)
   present in the project or provided by the user. Preferred — machine-readable.
2. **BUILD_SPEC** (below) — a structured block the user fills in when no OpenAPI
   document exists.

Do NOT explore live API docs or infer endpoints from prose. If neither input is
available, STOP and ask the user to provide one.

## BUILD_SPEC template (use only when there is no OpenAPI document)
```jsonc
// BUILD_SPEC
{
  "name": "<kebab-case project name>",
  "baseUrl": "<https://api.example.com/v1>",
  "auth": "<none | apiKey | basic | bearer>",
  "authEnvPrefix": "<UPPER_SNAKE prefix, e.g. ACME>",
  "operations": [
    {
      "operationId": "<camelCase, e.g. getComputer>",
      "method": "<GET|POST|PUT|PATCH|DELETE>",
      "path": "</computers/{id}>",
      "tag": "<logical group, e.g. computers>",
      "summary": "<one line>",
      "responseFields": ["<top-level field name>", "..."]
    }
  ]
}
```

## Derivation rules (apply identically every run)

**projectName**: OpenAPI `info.title` slugified to kebab-case; or BUILD_SPEC `name`.

**projectType**: always `"mcp-server"`. **mcpTransport**: always `"stdio"`.
**detectedFramework**: `"@modelcontextprotocol/sdk"`. **detectedLanguage**:
`"typescript"`. **detectedOrm**/**detectedTestRunner**: `"none"`/`"vitest"`.

**One `mcpTools` entry per operation** (each path × method = one operation):
- `name` = `<module-prefix>-<verb>-<noun>` where:
  - `verb` by HTTP method: GET→`get` (or `list` if the path has no trailing
    `{param}`), POST→`create`, PUT/PATCH→`update`, DELETE→`delete`.
  - `noun` = the LAST non-parameter path segment, lowercased, **used verbatim
    (do NOT singularize/pluralize — English rules are not deterministic)**.
  - `module-prefix` = the operation `tag` (OpenAPI) or `tag` (BUILD_SPEC),
    lowercased and kebab-cased; if absent, the FIRST path segment.
  - If `operationId` is present, use it kebab-cased ONLY to disambiguate two
    operations that would otherwise collide; never as the primary name.
- `module` = the `module-prefix` above.
- `description` = operation `summary` trimmed to one line (or OpenAPI
  `description` first line).
- `file` = `src/tools/<module>/<module>.tool.ts`.

**environmentVariables** (derive from auth):
- baseUrl → `<authEnvPrefix>_BASE_URL` (`isSensitive: false`, `hasDefault: false`).
- `apiKey` → `<authEnvPrefix>_API_KEY` (`isSensitive: true`).
- `basic` → `<authEnvPrefix>_USER` (false) and `<authEnvPrefix>_PASS` (true).
- `bearer` → `<authEnvPrefix>_TOKEN` (true).
- `none` → none.

**Field projection metadata**: for each tool, record the operation's
`responseFields` (BUILD_SPEC) or the response schema's top-level property names
(OpenAPI) in the `description` is NOT enough — instead append them to the manifest
`findings` array is NOT correct either. Put them nowhere in the manifest; they
are consumed by `entrypoints/mcp-server.md`'s field-selection feature at Step 8.
(If field-selection is not yet implemented, ignore response fields here.)

**Determinism rules**:
- Sort `mcpTools` alphabetically by `name`; sort `environmentVariables` by `name`.
- Use forward-slash relative paths, no leading `./`.
- Resolve `projectType` and every name BEFORE emitting; never emit a partial then revise.

## Output
1. The `AUDIT_MANIFEST` JSON block (same fenced `// AUDIT_MANIFEST` label and the
   exact schema from `shared/00-audit.md` — fill `mcpTools`, set the unused
   arrays `exportedSymbols`/`cliCommands`/`publicApiRoutes` to `[]`).
2. A short **Plan** section: count of tools, modules (sorted), and which env vars
   the user must set before running.

Do not write any source files in this step.
