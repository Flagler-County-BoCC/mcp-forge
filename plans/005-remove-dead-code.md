# Plan 005: Delete unused error/validation scaffolding and de-duplicate the project-type schema

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat e7f9278..HEAD -- src/lib/validate.ts src/errors src/tools/manifest/manifest.schema.ts src/tools/steps/steps.schema.ts`
> If any in-scope file changed since this plan was written, re-run the grep
> checks in Step 1 before deleting anything.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: tech-debt
- **Planned at**: commit `e7f9278`, 2026-06-18

## Why this matters

Three pieces of code exist but are never used at runtime, left over from the
project's own scaffolding standards: the `validate()` helper in
`src/lib/validate.ts`, the `ValidationError` class, and the
`InternalServerError` class. The manifest service does its own `safeParse`
inline, so `validate()` is never imported anywhere. `ValidationError` is
imported only by the unused `validate.ts`. `InternalServerError` is exported but
never instantiated. Dead code in a *reference* tool like mcp-forge is
particularly costly — it teaches readers patterns that aren't actually wired up.
Additionally, the `ProjectType` enum schema is defined twice. This plan removes
the dead code and collapses the duplicate schema. It is pure deletion plus one
small import change — no behavior changes.

## Current state

**Dead code (verified at `e7f9278` — no importers):**

- `src/lib/validate.ts` — exports `validate<T>(schema, data)`. `grep -rn "lib/validate" src tests` returns **nothing** outside the file itself.
  ```ts
  export function validate<T>(schema: ZodSchema<T>, data: unknown): T {
    const result = schema.safeParse(data);
    if (!result.success) {
      throw new ValidationError(result.error as ZodError);
    }
    return result.data;
  }
  ```
- `src/errors/ValidationError.ts` — exports `ValidationError`. Used only by
  `src/lib/validate.ts` (itself dead) and re-exported from
  `src/errors/index.ts:3`.
- `src/errors/HttpErrors.ts:15-19` — `InternalServerError`. Exported from
  `src/errors/index.ts:2` but `grep -rn "InternalServerError" src tests` shows
  only its definition and the export line — never instantiated.

The error classes that ARE used: `NotFoundError` (thrown in
`src/lib/prompt-loader.ts`), `BadRequestError` (thrown in
`src/tools/steps/steps.service.ts`), and the base `AppError` (referenced in
`src/lib/tool-error-handler.ts`). Do not touch those.

**Duplicate schema:**

- `src/tools/steps/steps.schema.ts:4`:
  ```ts
  export const ProjectTypeSchema = z.enum(PROJECT_TYPES);
  ```
  (`PROJECT_TYPES` comes from `src/tools/steps/steps.types.ts:1`.)
- `src/tools/manifest/manifest.schema.ts:3-9` defines the same enum inline:
  ```ts
  export const ProjectTypeSchema = z.enum([
    'http-api', 'library', 'cli', 'worker', 'mcp-server',
  ]);
  ```
  `manifest.schema.ts` uses it on line 14 (`projectType: ProjectTypeSchema`).

`src/errors/index.ts` currently:
```ts
export { AppError } from './AppError.js';
export { NotFoundError, BadRequestError, InternalServerError } from './HttpErrors.js';
export { ValidationError } from './ValidationError.js';
```

## Commands you will need

| Purpose       | Command              | Expected on success |
|---------------|----------------------|---------------------|
| Typecheck     | `npm run typecheck`  | exit 0              |
| Lint          | `npm run lint`       | exit 0 (see note)   |
| Tests         | `npm test`           | 25 passed           |
| Find usages   | `grep -rn "<symbol>" src tests` | as specified per step |

> Note: `npm run lint` currently fails on `main` (plan 001 fixes it). If 001 has
> not landed yet, rely on `npm run typecheck` + `npm test` as the gate for this
> plan, and ignore pre-existing lint errors unrelated to your changes.

## Scope

**In scope**:
- `src/lib/validate.ts` (delete)
- `src/errors/ValidationError.ts` (delete)
- `src/errors/HttpErrors.ts` (remove `InternalServerError`)
- `src/errors/index.ts` (remove the two dead exports)
- `src/tools/manifest/manifest.schema.ts` (import `ProjectTypeSchema` instead of redefining)

**Out of scope**:
- `NotFoundError`, `BadRequestError`, `AppError` — actively used; do not touch.
- The redundant `ProjectTypeSchema.parse()` calls in `steps.tool.ts` — leave
  them; removing belt-and-suspenders validation is a separate judgment call and
  not worth the risk in a cleanup plan.
- `STEP_DEFINITIONS` descriptions that mention "ValidationError" /
  "InternalServerError" as prose (e.g. `steps.service.ts:39,46`) — those are
  prompt descriptions for the *served* library, not code references. Leave them.

## Git workflow

- Branch: `advisor/005-remove-dead-code`
- Commit message style: conventional commits. Example:
  `refactor: remove unused validate/ValidationError/InternalServerError and dedupe ProjectTypeSchema`
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Re-confirm the code is dead (do this before deleting)

Run and confirm each returns ONLY the lines noted:

```bash
grep -rn "lib/validate" src tests          # expect: no output
grep -rn "ValidationError" src tests        # expect: only src/lib/validate.ts, src/errors/ValidationError.ts, src/errors/index.ts
grep -rn "InternalServerError" src tests    # expect: only src/errors/HttpErrors.ts, src/errors/index.ts
```

**Verify**: output matches the expectations above. If any *other* file
references these symbols, STOP (see STOP conditions).

### Step 2: Delete the two dead files

```bash
git rm src/lib/validate.ts src/errors/ValidationError.ts
```

### Step 3: Remove `InternalServerError` from `HttpErrors.ts`

In `src/errors/HttpErrors.ts`, delete the entire `InternalServerError` class
(lines 15–19):

```ts
export class InternalServerError extends AppError {
  constructor(message: string, context?: ErrorContext) {
    super(message, 500, 'INTERNAL_SERVER_ERROR', false, context);
  }
}
```

Leave `NotFoundError` and `BadRequestError` intact.

### Step 4: Fix the error barrel

Replace `src/errors/index.ts` with:

```ts
export { AppError } from './AppError.js';
export { NotFoundError, BadRequestError } from './HttpErrors.js';
```

**Verify**: `npm run typecheck` → exit 0 (no dangling imports).

### Step 5: De-duplicate `ProjectTypeSchema`

In `src/tools/manifest/manifest.schema.ts`, replace the inline enum definition
(lines 3–9) with an import from the steps schema, which is the single source of
truth (it derives from `PROJECT_TYPES`):

```ts
import { z } from 'zod';
import { ProjectTypeSchema } from '../steps/steps.schema.js';
```

Remove the local `export const ProjectTypeSchema = z.enum([...])` block. Keep
the rest of the file (the `AuditManifestSchema` that uses `ProjectTypeSchema` on
line 14, and `ValidateManifestInputSchema`) unchanged.

If any other file imports `ProjectTypeSchema` from `manifest.schema.js`, keep it
exported by re-exporting: `export { ProjectTypeSchema } from '../steps/steps.schema.js';`
Check with: `grep -rn "manifest.schema" src tests | grep ProjectType`

**Verify**: `npm run typecheck` → exit 0.

### Step 6: Full gate

**Verify**:
- `npm run typecheck` → exit 0
- `npm test` → 25 passed
- `npm run lint` → exit 0 (only if plan 001 has landed; otherwise skip)

## Test plan

No new tests. This is dead-code removal; the existing 25 tests must still pass
unchanged, proving nothing live depended on the removed symbols. The manifest
tests (`src/tools/manifest/__tests__/manifest.service.spec.ts`) in particular
exercise the schema that now imports the deduplicated `ProjectTypeSchema`.

- Verification: `npm test` → 25 passed (no change in count).

## Done criteria

ALL must hold:

- [ ] `src/lib/validate.ts` and `src/errors/ValidationError.ts` no longer exist
- [ ] `grep -rn "InternalServerError\|ValidationError" src` returns no matches in `.ts` code (prose in prompt descriptions excluded)
- [ ] `manifest.schema.ts` imports `ProjectTypeSchema` rather than redefining it
- [ ] `npm run typecheck` exits 0 and `npm test` → 25 passed
- [ ] `plans/README.md` status row for 005 updated

## STOP conditions

Stop and report back if:

- Step 1's grep finds a usage of any removed symbol outside the files listed —
  the code is not dead; do not delete it.
- Removing `InternalServerError` breaks typecheck (something imports it that the
  grep missed) — report rather than re-adding piecemeal.
- `manifest.schema.ts`'s `ProjectTypeSchema` is imported by a file you did not
  expect and re-exporting (Step 5) does not resolve the typecheck — report.

## Maintenance notes

- After this, `src/errors/` exposes exactly the errors in use: `AppError`,
  `NotFoundError`, `BadRequestError`. If a future feature genuinely needs a
  validation or 500 error class, re-add it *with a call site* — don't reinstate
  speculative scaffolding.
- `ProjectTypeSchema` now lives only in `steps.schema.ts`, derived from
  `PROJECT_TYPES` in `steps.types.ts`. Adding a new project type means editing
  `PROJECT_TYPES` only; both tools pick it up.
- Reviewer should confirm the deleted symbols had no test-only usage that the
  grep in Step 1 would have caught.
