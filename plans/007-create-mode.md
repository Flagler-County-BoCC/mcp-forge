# Plan 007: Add a "Create" mode — generate a new MCP server from an API spec, deterministically

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan in
> `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat c20d1ef..HEAD -- .claude/commands/shared/00-audit.md .claude/commands/masters/MASTER.md src/tools/steps`
> If any in-scope file changed since this plan was written, compare the "Current
> state" excerpts against the live code before proceeding; on a mismatch, treat
> it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: L
- **Risk**: MED
- **Depends on**: none (but see "Interaction" — execute on its own branch; it is disjoint from plans 008/009/010 except it never touches `entrypoints/mcp-server.md`)
- **Category**: direction
- **Planned at**: commit `c20d1ef`, 2026-06-18

## Why this matters

Today mcp-forge can only **rewrite an existing** Node project: Step 0
(`shared/00-audit.md`) reads source files and emits an `AUDIT_MANIFEST`, and
every downstream step consumes that manifest. There is no way to **create a new
MCP server from scratch**. The owner wants exactly that — point the system at an
API specification and have it generate a hardened, standardized MCP server,
*reproducibly* (the same spec twice ⇒ near-identical code).

The elegant, low-risk way to add this: a new **Create mode** that produces the
*same* `AUDIT_MANIFEST` shape from an API spec instead of from source code. Once
the manifest exists, **all existing downstream steps (01–14 and
`entrypoints/mcp-server.md`) work unchanged** — they only ever read the manifest.
So this plan adds one new prompt file plus the wiring to serve it; it does not
rewrite the pipeline.

The hard part is determinism. Source-driven rewrites are pinned by the source;
spec-driven creation has latitude (naming, ordering, grouping). This plan makes
every such decision an explicit rule so creation is reproducible.

## Current state

**The manifest is the single contract.** `shared/00-audit.md` emits it; the
schema is enforced by `src/tools/manifest/manifest.schema.ts` and downstream
prompts read `AUDIT_MANIFEST.mcpTools[*]`. Key excerpt from
`shared/00-audit.md` (lines 30–58, the `mcp-server` fields):

```jsonc
// AUDIT_MANIFEST
{
  "schemaVersion": "3.0.0",
  "projectName": "<string>",
  "projectType": "<http-api | library | cli | worker | mcp-server>",
  "detectedFramework": "...",
  ...
  "mcpTools": [
    { "name": "<tool name>", "module": "<logical group>", "description": "<one line>", "file": "<relative>" }
  ],
  "mcpTransport": "<stdio | sse | http | null>",
  "environmentVariables": [
    { "name": "<VAR_NAME>", "usedIn": ["<relative path>"], "hasDefault": false, "isSensitive": false }
  ],
  ...
}
```

`entrypoints/mcp-server.md` line 159 makes the contract explicit: *"Derive tool
names and prefixes directly from `AUDIT_MANIFEST.mcpTools[*].name`. Do not invent
tool names."* — so if Create mode populates `mcpTools` correctly, the entrypoint
generates the server with no changes.

**How prompts are served.** `src/tools/steps/steps.service.ts` holds a hard-coded
`STEP_DEFINITIONS` array (steps 0–14) and exposes `getStep`, `getEntrypoint`,
`getMasterPrompt`. `getMasterPrompt()` is the pattern to copy (lines 161–163):

```ts
  async getMasterPrompt(): Promise<string> {
    return this.load('masters/MASTER.md');
  }
```

It is surfaced as an MCP tool in `src/tools/steps/steps.tool.ts` `get_master_prompt`
(lines 70–81) — a tool with **no input schema**:

```ts
  server.tool(
    'get_master_prompt',
    'Get the complete master prompt for single-pass rewrites...',
    async (): Promise<CallToolResult> => {
      try {
        const content = await stepsService.getMasterPrompt();
        return { content: [{ type: 'text' as const, text: content }] };
      } catch (err) {
        return handleToolError(err, 'get_master_prompt');
      }
    },
  );
```

> Note: plan 001 made the no-await handlers (`list_steps`, `validate_manifest`)
> synchronous, but `get_master_prompt` stays `async` because it awaits
> `getMasterPrompt()`. Your new `get_create_prompt` tool also awaits, so keep it
> `async`.

**Served prompt files live in three dirs only**: `shared/`, `entrypoints/`,
`masters/`. The top-level `.claude/commands/*.md` files are MOVED stubs (e.g.
`.claude/commands/00-audit.md` is just `# MOVED → shared/00-audit.md`) — do NOT
edit or add stubs there.

**Prettier ignores the prompt library** (`.prettierignore` excludes
`.claude/commands/`), so adding a `.md` there will not affect `npm run format:check`.

**Test that guards served files**: `tests/integration/prompt-files.test.ts`
loads every step/entrypoint/master via the real service and asserts length > 100.

`MASTER.md` Phase 1 (lines 35–40) is the single-pass audit entry you will add a
Create alternative to:

```
### Phase 1: Audit
1. Read every file (exclude node_modules, .git, dist, build, coverage).
2. Detect projectType using the priority-ordered rules in shared/00-audit.md.
3. Produce the AUDIT_MANIFEST JSON block.
4. Do not modify any files yet.
```

## Commands you will need

| Purpose      | Command                          | Expected on success |
|--------------|----------------------------------|---------------------|
| Install      | `npm ci`                         | exit 0              |
| Typecheck    | `npm run typecheck`              | exit 0              |
| Lint         | `npm run lint`                   | exit 0              |
| Format check | `npm run format:check`           | exit 0              |
| Tests        | `npm test`                       | all pass (currently 46; you add cases) |
| Read a served prompt back | `npm test -- prompt-files` | new create case passes |

## Scope

**In scope**:
- `.claude/commands/shared/00-create.md` (create — the new Create-mode prompt)
- `.claude/commands/masters/MASTER.md` (add a Create alternative to Phase 1)
- `src/tools/steps/steps.service.ts` (add `getCreatePrompt()`)
- `src/tools/steps/steps.tool.ts` (add `get_create_prompt` tool)
- `tests/integration/prompt-files.test.ts` (assert the new file loads)
- `tests/integration/server.test.ts` (assert the new tool is registered & returns content)
- `README.md` (document the new tool + Create workflow)

**Out of scope** (do NOT touch):
- `entrypoints/mcp-server.md` and any `shared/01`–`shared/14` step files — Create
  mode reuses them unchanged. If you find yourself editing a downstream step, the
  manifest you designed is wrong; STOP.
- The `AUDIT_MANIFEST` schema in `src/tools/manifest/manifest.schema.ts` — Create
  mode must emit the EXISTING shape, not a new one. Do not add fields.
- The top-level `.claude/commands/*.md` MOVED stubs.

## Git workflow

- Branch: `advisor/007-create-mode`
- Commit style: conventional commits (repo uses `feat:`, `fix:`, `docs:` — see
  `git log --oneline -5`). Example: `feat: add Create mode — generate an MCP server from an API spec`
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Write the Create-mode prompt file

Create `.claude/commands/shared/00-create.md` with the content below **verbatim**
(it is the instruction set a future agent follows; its determinism rules are the
whole point). Do not abbreviate or "improve" the rules:

````markdown
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
````

**Verify**: `test -f .claude/commands/shared/00-create.md && wc -l .claude/commands/shared/00-create.md`
→ file exists, > 60 lines.

### Step 2: Add a Create alternative to MASTER.md Phase 1

In `.claude/commands/masters/MASTER.md`, immediately AFTER the `### Phase 1: Audit`
block (after its line 4 "Do not modify any files yet."), add:

```markdown
### Phase 1 (alternative): Create

If you are CREATING a new mcp-server from an API spec rather than rewriting
existing source, follow `shared/00-create.md` instead of steps 1–4 above: ingest
the OpenAPI document or BUILD_SPEC and emit the `AUDIT_MANIFEST`. Then continue
from Phase 2 unchanged — `projectType` is `"mcp-server"`.
```

Do not modify any other part of MASTER.md.

**Verify**: `grep -c "Phase 1 (alternative): Create" .claude/commands/masters/MASTER.md` → `1`

### Step 3: Serve the new prompt via a `getCreatePrompt()` method

In `src/tools/steps/steps.service.ts`, add a method mirroring `getMasterPrompt`
(which loads `'masters/MASTER.md'`). Add directly below `getMasterPrompt`:

```ts
  async getCreatePrompt(): Promise<string> {
    return this.load('shared/00-create.md');
  }
```

**Verify**: `npm run typecheck` → exit 0.

### Step 4: Expose it as the `get_create_prompt` MCP tool

In `src/tools/steps/steps.tool.ts`, add a new tool registration mirroring
`get_master_prompt` (keep it `async` — it awaits). Add after the
`get_master_prompt` block:

```ts
  server.tool(
    'get_create_prompt',
    'Get the Create-mode prompt: generate a new mcp-server from an OpenAPI document or a BUILD_SPEC, emitting the same AUDIT_MANIFEST the rewrite steps consume.',
    async (): Promise<CallToolResult> => {
      try {
        const content = await stepsService.getCreatePrompt();
        return { content: [{ type: 'text' as const, text: content }] };
      } catch (err) {
        return handleToolError(err, 'get_create_prompt');
      }
    },
  );
```

**Verify**: `npm run typecheck` → exit 0; `npm run lint` → exit 0.

### Step 5: Add tests

In `tests/integration/prompt-files.test.ts`, add a case (after the master-prompt
`it`):

```ts
  it('create-mode prompt returns substantial content', async () => {
    const content = await stepsService.getCreatePrompt();
    expect(content.length).toBeGreaterThan(MIN_LENGTH);
  });
```

In `tests/integration/server.test.ts`, extend the `registers all expected tools`
test to also assert `expect(names).toContain('get_create_prompt');`, and add:

```ts
  it('get_create_prompt returns the create prompt', async () => {
    const result = await callTool(client, 'get_create_prompt', {});
    expect(result.isError).toBeFalsy();
    expect((result.content[0]?.text ?? '').length).toBeGreaterThan(100);
  });
```

**Verify**: `npm test` → all pass (was 46; now 48).

### Step 6: Document it in README.md

In `README.md`, add a row to the Tools table:
`| \`get_create_prompt\` | Generate a new MCP server from an OpenAPI doc or BUILD_SPEC. |`
and a short "Creating a new MCP server" subsection under "Using the MCP tools
directly" describing: call `get_create_prompt`, supply an OpenAPI doc or fill the
BUILD_SPEC, then run steps 1–14 + the mcp-server entrypoint as normal.

**Verify**: `grep -c "get_create_prompt" README.md` → ≥ 2.

### Step 7: Full gate

**Verify** ALL:
- `npm run typecheck` → exit 0
- `npm run lint` → exit 0
- `npm run format:check` → exit 0 (the new `.md` is prettier-ignored; README/TS must be clean — run `npm run format` if README formatting fails, it is in scope)
- `npm test` → 48 passed

## Test plan

- New tests: (a) `prompt-files.test.ts` asserts `getCreatePrompt()` loads real
  content; (b) `server.test.ts` asserts the `get_create_prompt` tool is
  registered and returns >100 chars. Model both after the existing
  `get_master_prompt` cases in the same files.
- Regression prevented: a missing/renamed `shared/00-create.md` or an unregistered
  tool fails CI instead of failing silently in a client.
- No test can verify *generated-code determinism* (that needs an end-to-end
  generation run) — that is validated by review of the derivation rules, not a
  unit test. Do not fake such a test.

## Done criteria

ALL must hold:

- [ ] `.claude/commands/shared/00-create.md` exists with the derivation + BUILD_SPEC rules
- [ ] `MASTER.md` has a "Phase 1 (alternative): Create" block
- [ ] `getCreatePrompt()` + `get_create_prompt` tool exist and are tested
- [ ] `npm run typecheck`, `npm run lint`, `npm run format:check` → exit 0
- [ ] `npm test` → 48 passed
- [ ] `README.md` documents the tool
- [ ] `git diff --name-only` shows only in-scope files (NO `entrypoints/` or `shared/01`–`14`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report (do not improvise) if:

- Making any naming derivation deterministic forces a choice not covered by the
  rules in Step 1 (e.g. two operations collide even after the `operationId`
  tie-breaker) — report the collision; do not invent an ad-hoc rule.
- You find you must edit a downstream step (`entrypoints/mcp-server.md`, any
  `shared/01`–`14`) to make Create mode work — that means the manifest design is
  wrong; STOP rather than patching downstream.
- The `AUDIT_MANIFEST` schema in `manifest.schema.ts` rejects a manifest your
  Create prompt would produce — reconcile by changing the prompt to fit the
  existing schema, never by widening the schema (out of scope).
- The drift check shows `00-audit.md`, `MASTER.md`, or `steps.service.ts` changed
  since `c20d1ef` and the excerpts no longer match.

## Maintenance notes

- Create mode is deliberately "just another way to produce the manifest." Keep it
  that way — when a new downstream step is added, it inherits Create support for
  free as long as it reads the manifest. If a future step needs create-only data,
  that is a manifest-schema change and a much larger discussion.
- The "do not singularize nouns" rule is a deterministic ceiling: tool names will
  read `get-computers` not `get-computer`. If the owner wants singular nouns,
  that requires a fixed irregular-plural table, not English heuristics.
- Reviewer should scrutinize the derivation rules in `00-create.md` for any place
  a model could legitimately make two different choices — that is where
  determinism leaks.
- Field-projection metadata (response field names per tool) is referenced but
  parked here; plan 008 (field-selection) is where it is consumed. If 008 lands,
  revisit `00-create.md` to emit response field names in a defined location.
