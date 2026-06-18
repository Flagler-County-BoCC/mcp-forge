# Plan 001: Make `npm run lint` pass (currently 16 errors, CI is red)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat e7f9278..HEAD -- eslint.config.mjs src/tools/steps/steps.tool.ts src/tools/manifest/manifest.tool.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: dx
- **Planned at**: commit `e7f9278`, 2026-06-18

## Why this matters

`npm run lint` exits 1 with 16 errors on `main`. CI (`.github/workflows/ci.yml`)
runs `npm run lint` as a gate, so the pipeline is red and every PR inherits a
failing check. The errors are not real code defects — 14 are false `no-undef`
reports on Node globals (`process`, `NodeJS`) because the ESLint config never
declares Node globals, and 2 are `require-await` on handlers that are correctly
synchronous. This is a config bug plus two trivial signature fixes. mcp-forge
is itself a tool that tells *other* projects to keep lint green, so this matters
for credibility as much as for CI.

## Current state

Files:
- `eslint.config.mjs` — flat ESLint config. Extends `js.configs.recommended`
  (which enables `no-undef`) but declares no `languageOptions.globals`, so every
  reference to a Node global is flagged. TypeScript already performs
  undefined-identifier checking, so `no-undef` is redundant for `.ts` files —
  this is the [official typescript-eslint recommendation](https://typescript-eslint.io/troubleshooting/faqs/eslint/#i-get-errors-from-the-no-undef-rule-about-global-variables-not-being-defined-even-though-there-are-no-typescript-errors).
- `src/tools/steps/steps.tool.ts` — the `list_steps` handler (line 17) is
  declared `async` but contains no `await`.
- `src/tools/manifest/manifest.tool.ts` — the `validate_manifest` handler
  (line 12) is declared `async` but contains no `await`.

Exact lint failures:

```
src/lib/logger.ts:24       'process' is not defined           no-undef
src/lib/prompt-loader.ts:15 'NodeJS' is not defined           no-undef
src/server.ts:9            'process' is not defined           no-undef
src/stdio.ts:6,8,11,13,28  'process' is not defined           no-undef  (5×)
tests/setup.ts:7,8,9       'process' is not defined           no-undef  (3×)
src/tools/manifest/manifest.tool.ts:12  Async arrow function has no 'await'   @typescript-eslint/require-await
src/tools/steps/steps.tool.ts:17        Async arrow function has no 'await'   @typescript-eslint/require-await
```

Current `eslint.config.mjs` rules block (lines 21–28):

```js
    rules: {
      ...tsPlugin.configs['recommended-type-checked'].rules,
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/explicit-function-return-type': ['warn', { allowExpressions: true }],
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/require-await': 'error',
      'no-console': ['warn', { allow: ['error'] }],
    },
```

Current `list_steps` handler signature (`src/tools/steps/steps.tool.ts:17`):

```ts
    async ({ projectType }): Promise<CallToolResult> => {
```

Current `validate_manifest` handler signature (`src/tools/manifest/manifest.tool.ts:12`):

```ts
    async ({ manifestJson }): Promise<CallToolResult> => {
```

Note: `get_step`, `get_entrypoint`, and `get_master_prompt` handlers DO use
`await` and must stay `async`. Only the two handlers above are flagged.

## Commands you will need

| Purpose   | Command              | Expected on success |
|-----------|----------------------|---------------------|
| Lint      | `npm run lint`       | exit 0, no output   |
| Typecheck | `npm run typecheck`  | exit 0, no errors   |
| Tests     | `npm test`           | 25 passed           |

## Scope

**In scope** (the only files you should modify):
- `eslint.config.mjs`
- `src/tools/steps/steps.tool.ts`
- `src/tools/manifest/manifest.tool.ts`

**Out of scope** (do NOT touch):
- Any `.ts` source other than the two tool files above — do not "fix" the
  `no-undef` sites by editing source; the config change resolves all of them.
- `package.json` — do not add the `globals` npm package. Disabling `no-undef`
  for TS is the lighter, recommended fix and needs no new dependency.
- Prettier formatting concerns — that is plan 002.

## Git workflow

- Branch: `advisor/001-fix-eslint`
- Commit message style: conventional commits (repo uses `fix:`, `feat:`,
  `docs:` — see `git log --oneline -5`). Example: `fix: make eslint pass by disabling no-undef for TS and desyncing sync handlers`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Disable `no-undef` for TypeScript files

In `eslint.config.mjs`, add `'no-undef': 'off'` to the `rules` block. TypeScript
already reports use of undefined identifiers, so this rule only produces false
positives here. The block becomes:

```js
    rules: {
      ...tsPlugin.configs['recommended-type-checked'].rules,
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/explicit-function-return-type': ['warn', { allowExpressions: true }],
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/require-await': 'error',
      'no-console': ['warn', { allow: ['error'] }],
      'no-undef': 'off',
    },
```

**Verify**: `npm run lint 2>&1 | grep -c no-undef` → `0`

### Step 2: Make the two synchronous handlers non-`async`

In `src/tools/steps/steps.tool.ts`, change the `list_steps` handler signature
on line 17 from:

```ts
    async ({ projectType }): Promise<CallToolResult> => {
```

to:

```ts
    ({ projectType }): CallToolResult => {
```

In `src/tools/manifest/manifest.tool.ts`, change the `validate_manifest` handler
signature on line 12 from:

```ts
    async ({ manifestJson }): Promise<CallToolResult> => {
```

to:

```ts
    ({ manifestJson }): CallToolResult => {
```

Do not change the handler bodies. The MCP SDK's `server.tool` accepts a handler
returning either `CallToolResult` or `Promise<CallToolResult>`, so this is safe.

**Verify**: `npm run typecheck` → exit 0, no errors.

### Step 3: Confirm the full gate is green

**Verify**:
- `npm run lint` → exit 0, no output
- `npm test` → `25 passed`

## Test plan

No new tests. The existing integration suite
(`tests/integration/server.test.ts`) already exercises `list_steps` and
`validate_manifest` through the real MCP client — those 25 tests passing after
the signature change proves the handlers still work synchronously.

- Verification: `npm test` → 25 passed (no change in count).

## Done criteria

ALL must hold:

- [ ] `npm run lint` exits 0 with no output
- [ ] `npm run typecheck` exits 0
- [ ] `npm test` → 25 passed
- [ ] `git diff --name-only` shows only the 3 in-scope files changed
- [ ] `plans/README.md` status row for 001 updated to DONE

## STOP conditions

Stop and report back (do not improvise) if:

- The drift check shows `eslint.config.mjs` or either tool file changed since
  `e7f9278` and the excerpts above no longer match.
- After Step 1, `npm run lint` reports a *different* set of errors than the 16
  listed in "Current state" (the config or source drifted — investigate before
  proceeding).
- Removing `async` from a handler causes a typecheck error you cannot resolve by
  changing only the return annotation as shown — this means the SDK signature
  differs from the assumption; report it.

## Maintenance notes

- If a future contributor adds a genuinely undefined global, TypeScript — not
  ESLint — will catch it (`npm run typecheck`). That is intentional.
- If new tool handlers are added, keep handlers that don't `await` synchronous,
  or the `require-await` rule will flag them again.
- Reviewer should confirm no `globals` dependency was added to `package.json`.
