# Plan 008: Give every generated MCP tool client-side field selection (`fields`)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If any
> STOP condition occurs, stop and report — do not improvise. When done, update
> the status row in `plans/README.md` unless a reviewer told you they maintain it.
>
> **Drift check (run first)**: `git diff --stat c20d1ef..HEAD -- .claude/commands/entrypoints/mcp-server.md .claude/commands/shared/05-validation.md`
> If either file changed since this plan was written, compare the "Current state"
> excerpts to the live files before proceeding; on mismatch, STOP.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: none. **Interaction**: edits `entrypoints/mcp-server.md`, which
  plans 009 and 010 also edit — execute 008/009/010 in one chained pass (or
  sequentially on the same branch) to avoid merge conflicts on that file.
- **Category**: direction
- **Planned at**: commit `c20d1ef`, 2026-06-18

## Why this matters

Generated MCP tools return the **entire** upstream response —
`entrypoints/mcp-server.md` hard-codes `JSON.stringify(result, null, 2)` in every
handler. When an agent calls `getComputer` it only wants `Name`, but it receives
every field, burning context tokens on irrelevant data and degrading the agent's
focus. The owner wants every endpoint to let the caller select returned fields
(e.g. ask `getComputer` for only `Name`).

Decision already made: **client-side projection, always** — every tool accepts an
optional `fields: string[]`; the server fetches the full response, then projects
down before returning. This works on any upstream API (no dependence on the API
supporting a `fields=` param) and guarantees the context-token saving regardless.

This plan changes the *generation instructions* so every newly generated/rewritten
mcp-server tool gets this for free. It does not modify mcp-forge's own server.

## Current state

`entrypoints/mcp-server.md` tool handler template (lines 115–146) returns the full
object. The `list` handler (lines 115–129):

```typescript
  server.tool(
    '<prefix>-list-<module>',
    'List <module> records with optional filters. Returns paginated JSON.',
    List<Module>Schema.shape,
    async (params): Promise<CallToolResult> => {
      const input = validate(List<Module>Schema, params);
      log.debug({ input }, '<prefix>-list-<module> called');
      try {
        const result = await <module>Service.list<Module>(input);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      } catch (err) {
        return handleToolError(err, '<prefix>-list-<module>');
      }
    },
  );
```

The "Tool Handler Rules" (lines 161–168) enumerate handler conventions (rule 3:
"On success: return `{ content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }`").

`shared/05-validation.md` "mcp-server: Tool Input Schemas" (lines 60–82) defines
the schema convention. Current example (lines 67–74):

```typescript
export const ListTicketsSchema = z.object({
  board:       z.string().optional(),
  status:      z.string().optional(),
  page:        z.coerce.number().int().min(1).default(1),
  pageSize:    z.coerce.number().int().min(1).max(100).default(50),
});
```

`src/lib/` in a generated project already holds `validate.ts`,
`tool-error-handler.ts`, `logger.ts`, `container.ts`, `http-client.ts` — adding a
`select-fields.ts` sibling matches the layout (`entrypoints/mcp-server.md` lines
10–14). The prompt library is prettier-ignored, so editing these `.md` files does
not affect `npm run format:check`.

## Commands you will need

| Purpose      | Command                  | Expected |
|--------------|--------------------------|----------|
| Tests        | `npm test`               | 46 pass (unchanged — this plan edits prompts, not forge src) |
| Format check | `npm run format:check`   | exit 0   |
| Helper typecheck | (Step 3 — scratch file) | exit 0 |

## Scope

**In scope**:
- `.claude/commands/entrypoints/mcp-server.md` — add the `fields` param to the
  handler template, add a `src/lib/select-fields.ts` section, update Tool Handler
  Rules and Determinism Rules.
- `.claude/commands/shared/05-validation.md` — add `fields` to the mcp-server
  tool-schema convention.

**Out of scope**:
- mcp-forge's own `src/**` — this plan changes what *generated* servers look like,
  not forge itself. Do not add field-selection to forge's `steps.tool.ts`.
- Server-side / upstream `fields=` passthrough — explicitly rejected in favor of
  universal client-side projection. Do not add it.
- Nested/deep projection beyond what Step 2 specifies.

## Git workflow

- Branch: `advisor/008-field-selection` (or the shared 008/009/010 branch)
- Commit style: conventional commits. Example:
  `feat: generated MCP tools support client-side field selection`

## Steps

### Step 1: Add the `fields` convention to `shared/05-validation.md`

In `shared/05-validation.md`, in the "mcp-server: Tool Input Schemas" section,
after the "Rules for MCP tool schemas" list (after line 81), add:

```markdown
5. Every tool input schema must include an optional field-selection parameter:
   `fields: z.array(z.string()).optional().describe('Return only these top-level fields; omit for all fields.')`.
   This lets AI callers request just the fields they need (e.g. only `Name` from a
   computer record), keeping irrelevant data out of the model's context.
```

And update the example schema to include it (add as the last property):

```typescript
  fields:      z.array(z.string()).optional(),
```

**Verify**: `grep -c "fields-selection\|field-selection\|fields:" .claude/commands/shared/05-validation.md` → ≥ 1.

### Step 2: Add the `select-fields.ts` helper section to `entrypoints/mcp-server.md`

In `entrypoints/mcp-server.md`, add a new section after the
`src/lib/tool-error-handler.ts` section (after line 220), titled
`## src/lib/select-fields.ts — Response Projection`, containing this helper
**verbatim**:

```typescript
/**
 * Client-side field projection. Returns only the requested top-level fields.
 * - Objects: keep only keys in `fields`.
 * - Arrays of objects: project each element.
 * - Anything else, or empty/undefined `fields`: return unchanged.
 * ponytail: top-level keys only; deep dot-paths are a future extension if needed.
 */
export function selectFields<T>(data: T, fields?: string[]): unknown {
  if (!fields || fields.length === 0) return data;
  const pick = (obj: Record<string, unknown>): Record<string, unknown> => {
    const out: Record<string, unknown> = {};
    for (const f of fields) {
      if (f in obj) out[f] = obj[f];
    }
    return out;
  };
  if (Array.isArray(data)) {
    return data.map((item) =>
      item && typeof item === 'object' ? pick(item as Record<string, unknown>) : item,
    );
  }
  if (data && typeof data === 'object') {
    return pick(data as Record<string, unknown>);
  }
  return data;
}
```

**Verify**: `grep -c "export function selectFields" .claude/commands/entrypoints/mcp-server.md` → `1`.

### Step 3: Confirm the helper is valid TypeScript (no repo mutation)

Copy the `selectFields` function into a scratch file OUTSIDE the repo and
typecheck it (this does not modify the working tree):

```bash
TMP="$(mktemp -d)/select-fields.ts"
# paste ONLY the selectFields function body into $TMP, then:
npx --yes tsc --noEmit --strict "$TMP"; echo "tsc exit $?"
rm -rf "$(dirname "$TMP")"
```

**Verify**: `tsc exit 0`. If it fails, the helper you embedded has a syntax/type
error — fix the embedded version and re-run.

### Step 4: Wire `fields` into the handler template

In `entrypoints/mcp-server.md`, update BOTH handler examples (the `list` handler
lines 115–129 and the `get` handler lines 131–146) so the success return applies
projection. Change each success line from:

```typescript
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
```

to:

```typescript
        const projected = selectFields(result, input.fields);
        return { content: [{ type: 'text', text: JSON.stringify(projected, null, 2) }] };
```

Add the import to the template's import list (near line 101
`import { validate } from '../../lib/validate.js';`):

```typescript
import { selectFields } from '../../lib/select-fields.js';
```

### Step 5: Update the Tool Handler Rules and Determinism Rules

In `entrypoints/mcp-server.md` "Tool Handler Rules" (lines 161–168), change rule 3
to mention projection:

```markdown
3. On success: project the result with `selectFields(result, input.fields)` and
   return `{ content: [{ type: 'text', text: JSON.stringify(projected, null, 2) }] }`.
```

Add a new "Determinism Rules" bullet (the list near line 561):

```markdown
- Every tool input schema includes optional `fields: string[]`; every handler
  applies `selectFields(result, input.fields)` before serializing.
- `src/lib/select-fields.ts` is present in every generated mcp-server.
```

**Verify**: `grep -c "selectFields" .claude/commands/entrypoints/mcp-server.md` → ≥ 3.

### Step 6: Full gate

**Verify**:
- `npm run format:check` → exit 0 (prompt files are prettier-ignored; no TS in forge changed)
- `npm test` → 46 passed (unchanged — this plan does not touch forge `src/`)

## Test plan

This plan edits prompt *content* (instructions for generating other projects),
not mcp-forge's runtime code, so the forge test count is unchanged (46). The
machine-checkable verifications are: the grep presence checks (Steps 1, 2, 5) and
the **standalone `tsc` typecheck of the embedded helper** (Step 3) — that is the
real correctness gate for the code this plan ships into generated projects. Do
not add a forge unit test for `selectFields` (it does not exist in forge's `src/`).

## Done criteria

ALL must hold:

- [ ] `shared/05-validation.md` documents the optional `fields` tool-schema param
- [ ] `entrypoints/mcp-server.md` has a `select-fields.ts` section, both handler
      examples apply `selectFields`, and the rules/determinism sections mention it
- [ ] The embedded `selectFields` helper passes `tsc --noEmit --strict` in a scratch file (Step 3)
- [ ] `npm run format:check` → exit 0 and `npm test` → 46 passed
- [ ] `git diff --name-only` shows only the two prompt files
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report if:

- The embedded `selectFields` will not typecheck under `--strict` after a
  reasonable fix — report the error rather than loosening it with `any`.
- The drift check shows either prompt file changed since `c20d1ef` and the
  excerpts no longer match (e.g. the handler template was already refactored).
- You conclude top-level-only projection is insufficient for the owner's needs
  (e.g. they need `address.city`) — STOP and report; deep projection is a
  deliberate non-goal of this plan and needs its own decision.

## Maintenance notes

- Projection is **top-level keys only** (a named ceiling in the helper comment).
  Nested dot-path selection (`address.city`) is the obvious extension if asked.
- This pairs with plan 007: Create mode can emit each tool's response field names
  so the generated tool's `fields` description can enumerate valid values. Not
  required for this plan to work (projection silently ignores unknown field names).
- Reviewer should confirm both handler examples (list AND get) were updated, and
  that the import path `../../lib/select-fields.js` matches the generated layout.
