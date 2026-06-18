# Plan 011: Thread per-tool response field names from Create mode into the generated `fields` description

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If any
> STOP condition occurs, stop and report — do not improvise. When done, update
> the status row in `plans/README.md` unless a reviewer told you they maintain it.
>
> **Drift check (run first)**: this plan must be applied on a tree that ALREADY
> contains plan 007 (`shared/00-create.md`) and the trio 008/009/010 (the
> field-selection changes in `entrypoints/mcp-server.md` + `shared/05-validation.md`).
> Confirm with:
> `test -f .claude/commands/shared/00-create.md && grep -q selectFields .claude/commands/entrypoints/mcp-server.md && echo READY`
> If it does not print `READY`, STOP — you are on the wrong base (see "Base" below).

## Status

- **Priority**: P3
- **Effort**: M
- **Risk**: LOW
- **Depends on**: 007 (Create mode) and 008 (field-selection) must both be present
- **Category**: direction
- **Planned at**: commit `c20d1ef`, 2026-06-18
- **Base**: apply on an integration tree = `c20d1ef` + branch `advisor/007-create-mode` + branch `advisor/008-010-fieldselect-commands-install`. Those two branches are disjoint and merge cleanly.

## Why this matters

Plan 008 gave every generated tool an optional `fields: string[]` param (client-side
projection). But the agent calling the tool has no way to know *which* field names
are valid — it must guess. Plan 007's Create mode already knows them: the
`BUILD_SPEC` template carries `responseFields` per operation, and an OpenAPI
response schema exposes its top-level properties. Plan 007 deliberately parked the
hand-off ("Put them nowhere in the manifest … consumed by the field-selection
feature at Step 8"). This plan closes that loop: Create mode records each tool's
response field names in the manifest, and the generated tool's `fields` param
`.describe()` enumerates them — so the agent sees `Available: Name, Id, Status` and
asks for exactly what it needs. Backward compatible: when field names are unknown
(rewrite mode), the list is empty and behavior is unchanged.

## Current state (on the integration tree)

**Manifest schema** — `src/tools/manifest/manifest.schema.ts`, the `mcpTools`
array (lines 49–58 at `c20d1ef`):

```typescript
  mcpTools: z
    .array(
      z.object({
        name: z.string(),
        module: z.string(),
        description: z.string(),
        file: z.string(),
      }),
    )
    .default([]),
```

**Audit schema doc** — `shared/00-audit.md` mcpTools entry (line 55–57):

```jsonc
  "mcpTools": [
    { "name": "<tool name>", "module": "<logical group>", "description": "<one line>", "file": "<relative>" }
  ],
```

**Create mode** — `shared/00-create.md` (from plan 007) currently contains a parked
hand-off. The relevant passage reads (paraphrased — locate the paragraph beginning
"**Field projection metadata**"):

> Field projection metadata … Put them nowhere in the manifest; they are consumed
> by `entrypoints/mcp-server.md`'s field-selection feature at Step 8. (If
> field-selection is not yet implemented, ignore response fields here.)

The `BUILD_SPEC` template in the same file already has, per operation:
`"responseFields": ["<top-level field name>", "..."]`.

**Field-selection convention** — `shared/05-validation.md` rule 5 (from plan 008):

```markdown
5. Every tool input schema must include an optional field-selection parameter:
   `fields: z.array(z.string()).optional().describe('Return only these top-level fields; omit for all fields.')`.
```

**Generated server** — `entrypoints/mcp-server.md` references `selectFields`
(from plan 008). Tool schemas live in the `<module>.schema.ts` pattern.

The `validate_manifest` tests (`src/tools/manifest/__tests__/manifest.service.spec.ts`
and `tests/integration/server.test.ts`) use a manifest WITHOUT `responseFields`;
they must keep passing (the new field defaults to `[]`).

## Commands you will need

| Purpose      | Command                  | Expected |
|--------------|--------------------------|----------|
| Install      | `npm ci`                 | exit 0   |
| Typecheck    | `npm run typecheck`      | exit 0   |
| Lint         | `npm run lint`           | exit 0   |
| Format check | `npm run format:check`   | exit 0   |
| Tests        | `npm test`               | 48 pass on the integration tree (007 adds 2 over c20d1ef's 46); +1 if you add the optional test |

## Scope

**In scope**:
- `src/tools/manifest/manifest.schema.ts` — add optional `responseFields`
- `.claude/commands/shared/00-audit.md` — document the field; rule: `[]` in rewrite mode
- `.claude/commands/shared/00-create.md` — populate `responseFields` from the spec (replace the parked hand-off)
- `.claude/commands/entrypoints/mcp-server.md` — `fields` `.describe()` enumerates responseFields when present
- `.claude/commands/shared/05-validation.md` — extend rule 5 with the enumeration guidance
- `src/tools/manifest/__tests__/manifest.service.spec.ts` — optional: one case with `responseFields`

**Out of scope**:
- The `selectFields` runtime helper (plan 008) — unchanged; projection already
  ignores unknown field names, so this is purely a usability/description nicety.
- Server-side field passthrough — still rejected.
- Making `00-audit` (rewrite mode) infer response fields from code — explicitly not
  attempted; rewrite mode sets `[]`.

## Git workflow

- This plan is applied on an integration branch the executor creates (see the
  executor dispatch). Commit message: conventional commits, e.g.
  `feat: enumerate available response fields in generated tools' fields param`
- Do NOT push or merge to `main` — the maintainer merges.

## Steps

### Step 1: Add `responseFields` to the manifest schema

In `src/tools/manifest/manifest.schema.ts`, add an optional `responseFields` to the
`mcpTools` object (default `[]` for backward compatibility):

```typescript
  mcpTools: z
    .array(
      z.object({
        name: z.string(),
        module: z.string(),
        description: z.string(),
        file: z.string(),
        responseFields: z.array(z.string()).default([]),
      }),
    )
    .default([]),
```

**Verify**: `npm run typecheck` → exit 0; `npm test` → existing tests still pass
(the test manifests omit `responseFields`; `.default([])` makes that valid).

### Step 2: Document it in the audit schema (rewrite mode emits `[]`)

In `shared/00-audit.md`, update the `mcpTools` schema entry to include
`responseFields`, and add a Field Population Rule. Change the entry to:

```jsonc
  "mcpTools": [
    { "name": "<tool name>", "module": "<logical group>", "description": "<one line>", "file": "<relative>", "responseFields": [] }
  ],
```

Add to "Field Population Rules":

```markdown
- `responseFields` — populate only in Create mode (from the API spec). In rewrite
  mode set to `[]` (response field names cannot be reliably inferred from source).
```

**Verify**: `grep -c "responseFields" .claude/commands/shared/00-audit.md` → ≥ 2.

### Step 3: Populate `responseFields` in Create mode

In `shared/00-create.md`, REPLACE the parked "Field projection metadata" paragraph
(the one ending "…ignore response fields here.") with:

```markdown
**Field projection metadata**: for each tool, set `responseFields` in its
`mcpTools` entry to the operation's response field names — `responseFields` from
the BUILD_SPEC operation, or the top-level property names of the OpenAPI response
schema (the `200`/`2xx` response body `schema.properties` keys), sorted
alphabetically. These let the generated tool tell callers which fields exist.
```

Also update the "Output" section's manifest instruction to mention filling
`responseFields` per tool.

**Verify**: `grep -c "responseFields" .claude/commands/shared/00-create.md` → ≥ 2;
`grep -c "ignore response fields here" .claude/commands/shared/00-create.md` → `0`.

### Step 4: Enumerate fields in the generated tool's `fields` describe()

In `shared/05-validation.md`, extend rule 5 (after the existing rule-5 text) with:

```markdown
   When `AUDIT_MANIFEST.mcpTools[*].responseFields` is non-empty for the tool,
   enumerate them in the describe: `.describe('Return only these fields; omit for
   all. Available: <comma-separated responseFields>.')`. When it is empty, use the
   generic describe text above.
```

In `entrypoints/mcp-server.md`, add a Determinism Rule bullet (in the
"Determinism Rules" list):

```markdown
- A tool's `fields` param `.describe()` enumerates that tool's
  `AUDIT_MANIFEST.mcpTools[*].responseFields` when non-empty; otherwise it uses the
  generic "omit for all fields" text. The `selectFields` runtime behavior is
  unchanged either way.
```

**Verify**: `grep -c "responseFields" .claude/commands/entrypoints/mcp-server.md` → ≥ 1;
`grep -c "Available:" .claude/commands/shared/05-validation.md` → ≥ 1.

### Step 5 (optional but recommended): add a manifest test case

In `src/tools/manifest/__tests__/manifest.service.spec.ts`, add a case asserting a
manifest with a `mcpTools` entry that INCLUDES `responseFields: ['Name','Id']`
validates successfully. Model it after the existing valid-manifest test in that
file.

**Verify**: `npm test` → all pass (count = prior + 1 if you added this case).

### Step 6: Full gate

**Verify** ALL:
- `npm run typecheck` → exit 0
- `npm run lint` → exit 0
- `npm run format:check` → exit 0
- `npm test` → all pass

## Test plan

- The load-bearing automated check is **backward compatibility**: existing
  `validate_manifest` tests (which omit `responseFields`) must still pass, proving
  `.default([])` works. Step 5 adds forward coverage (a manifest WITH
  `responseFields` validates).
- The prompt-content changes (00-audit, 00-create, 05-validation, entrypoint) are
  verified by the grep presence/absence checks — there is no end-to-end generation
  test (none exists); do not fake one.

## Done criteria

ALL must hold:

- [ ] `manifest.schema.ts` `mcpTools` has optional `responseFields` defaulting to `[]`
- [ ] `00-audit.md` documents it with the rewrite-mode `[]` rule
- [ ] `00-create.md` populates it from the spec and the parked hand-off text is gone
- [ ] `05-validation.md` + `entrypoints/mcp-server.md` enumerate it in the `fields` describe
- [ ] `npm run typecheck`, `npm run lint`, `npm run format:check` → exit 0
- [ ] `npm test` → all pass (existing manifest tests unchanged + any new case)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report if:

- The drift check does not print `READY` — you are not on the integration tree
  (007 + trio). Do not apply this plan on bare `main`.
- Adding `responseFields` breaks an existing `validate_manifest` test even with
  `.default([])` — that means a test asserts exact object shape; report it.
- You cannot locate the parked "Field projection metadata" paragraph in
  `00-create.md` (it may have been reworded) — report rather than guessing where to
  insert the population rule.

## Maintenance notes

- `responseFields` is optional metadata for *usability* only; the projection helper
  (`selectFields`) ignores unknown field names, so an empty or stale list never
  breaks field selection — it just makes the `fields` describe less helpful.
- If a future Create-mode source (beyond OpenAPI/BUILD_SPEC) is added, populate
  `responseFields` from it too, or accept an empty list (graceful degradation).
- Reviewer should confirm the existing manifest tests pass untouched (backward
  compatibility) and that rewrite mode still emits `[]`.
