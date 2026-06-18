# Plan 006: Add a test that every served prompt file exists and is non-trivial

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat e7f9278..HEAD -- src/tools/steps/steps.service.ts tests/integration`
> If `steps.service.ts` changed since this plan was written, re-read the step
> count and entrypoint list before writing assertions.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: tests
- **Planned at**: commit `e7f9278`, 2026-06-18

## Why this matters

The entire product is the set of prompt `.md` files served by `get_step`,
`get_entrypoint`, and `get_master_prompt`. The mapping from step number to file
path lives in `STEP_DEFINITIONS` and `ENTRYPOINT_MAP` in
`src/tools/steps/steps.service.ts`. If a prompt file is renamed, moved, or
deleted without updating those maps — or vice versa — nothing catches it until a
real MCP client calls the tool and gets a `NotFoundError` at runtime. There is
currently no test asserting the served files actually exist. This plan adds one
cheap data-driven integration test that loads every step (0–14), every
entrypoint, and the master prompt against the real prompts directory and asserts
each returns substantial content. It turns a class of silent runtime breakages
into a CI failure.

## Current state

- `src/tools/steps/steps.service.ts` defines `STEP_DEFINITIONS` (steps 0–14;
  step 8 has an empty `file` and is resolved via `getEntrypoint`) and
  `ENTRYPOINT_MAP` (the 5 project types → `entrypoints/*.md`). The master prompt
  is loaded from `masters/MASTER.md` by `getMasterPrompt()`.
- The five project types are `'http-api' | 'library' | 'cli' | 'worker' | 'mcp-server'`
  (`src/tools/steps/steps.types.ts:1`, `PROJECT_TYPES`).
- Integration tests live in `tests/integration/` and run against the **real**
  prompts directory: `tests/setup.ts` sets
  `process.env.PROMPTS_DIR = <repo>/.claude/commands` before tests load. So a
  test that calls the real `loadPrompt`/`StepsService` will read actual files.
- Existing integration test `tests/integration/server.test.ts` already spot-checks
  that `get_step` step 0, one entrypoint, and the master prompt return >100 chars
  — but it does NOT cover all 15 steps or all 5 entrypoints. This plan closes
  that gap exhaustively.
- The Vitest config picks up `*.test.ts` and `*.spec.ts` (existing files use
  both); `tests/setup.ts` is wired as the setup file (it runs because the
  existing integration test relies on the `PROMPTS_DIR` it sets).

Pattern to follow — `StepsService` is constructed with the real `loadPrompt`:

```ts
// src/lib/container.ts
import { loadPrompt } from './prompt-loader.js';
export const stepsService = new StepsService(loadPrompt);
```

You can either import the shared `stepsService` from `../../src/lib/container.js`
or construct `new StepsService(loadPrompt)` directly. Importing the container is
simpler and matches how the running server wires it.

## Commands you will need

| Purpose            | Command                                   | Expected on success |
|--------------------|-------------------------------------------|---------------------|
| Run the new test   | `npm test -- prompt-files`                | new tests pass      |
| Full test suite    | `npm test`                                | all pass (25 + new) |
| Typecheck          | `npm run typecheck`                       | exit 0              |

## Scope

**In scope**:
- `tests/integration/prompt-files.test.ts` (create)

**Out of scope**:
- `src/**` — do not export `STEP_DEFINITIONS` or change the service to make
  testing easier. Drive everything through the existing public methods
  (`getStep`, `getEntrypoint`, `getMasterPrompt`).
- `tests/setup.ts` — it already sets `PROMPTS_DIR`; do not modify it.
- The existing `server.test.ts` — leave it; the new file is additive.

## Git workflow

- Branch: `advisor/006-prompt-file-test`
- Commit message style: conventional commits. Example:
  `test: assert every served prompt file exists and is non-trivial`
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Create the data-driven prompt-file test

Create `tests/integration/prompt-files.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { stepsService } from '../../src/lib/container.js';
import { PROJECT_TYPES } from '../../src/tools/steps/steps.types.js';

const MIN_LENGTH = 100; // a real prompt file is far longer; this catches empty/missing/stub files

describe('served prompt files', () => {
  // Steps 0–14, excluding step 8 (entrypoint-specific, covered below).
  const stepNumbers = Array.from({ length: 15 }, (_, i) => i).filter((n) => n !== 8);

  it.each(stepNumbers)('step %i returns substantial prompt content', async (step) => {
    const content = await stepsService.getStep(step);
    expect(content.length).toBeGreaterThan(MIN_LENGTH);
  });

  it.each([...PROJECT_TYPES])('entrypoint for %s returns substantial content', async (type) => {
    const content = await stepsService.getEntrypoint(type);
    expect(content.length).toBeGreaterThan(MIN_LENGTH);
  });

  it('step 8 resolves to the entrypoint for a project type', async () => {
    const content = await stepsService.getStep(8, 'mcp-server');
    expect(content.length).toBeGreaterThan(MIN_LENGTH);
  });

  it('master prompt returns substantial content', async () => {
    const content = await stepsService.getMasterPrompt();
    expect(content.length).toBeGreaterThan(MIN_LENGTH);
  });
});
```

This calls the real `loadPrompt` (via the container) against the real
`.claude/commands` directory set by `tests/setup.ts`. A missing or renamed file
throws `NotFoundError`, failing the relevant case.

**Verify**: `npm test -- prompt-files` → all cases pass (14 step cases + 5
entrypoint cases + step-8 + master = 21 assertions).

### Step 2: Confirm the whole suite still passes

**Verify**: `npm test` → all pass; the total count is 25 + the new file's
tests. Note the new count for the README status update.

## Test plan

This plan *is* the test. Coverage:
- Happy path: every step 0–14 (step 8 via entrypoint), every project-type
  entrypoint, and the master prompt load successfully and return >100 chars.
- Regression it prevents: a `STEP_DEFINITIONS`/`ENTRYPOINT_MAP` entry pointing
  at a missing/renamed file (would throw `NotFoundError`), or an accidentally
  emptied prompt file (would fail the length assertion).
- Structural pattern: modeled after `tests/integration/server.test.ts`, which
  already uses the real `PROMPTS_DIR` and the same `>100` length heuristic.

## Done criteria

ALL must hold:

- [ ] `tests/integration/prompt-files.test.ts` exists
- [ ] `npm test -- prompt-files` passes (21 cases)
- [ ] `npm test` passes with the increased total count
- [ ] `npm run typecheck` exits 0
- [ ] `git diff --name-only` shows only the new test file
- [ ] `plans/README.md` status row for 006 updated

## STOP conditions

Stop and report back if:

- Any prompt file genuinely fails to load — that means a real broken reference
  exists in `STEP_DEFINITIONS`/`ENTRYPOINT_MAP` (a finding, not a test bug).
  Report which step/entrypoint failed; do not lower `MIN_LENGTH` to make it pass.
- `import { stepsService } from '../../src/lib/container.js'` fails to resolve —
  the container path drifted; locate the exported `stepsService` and adjust the
  import (it is a one-symbol re-point, not a redesign).
- The test count or step numbering assumption (steps 0–14, step 8 special) no
  longer matches `steps.service.ts` after the drift check — report.

## Maintenance notes

- When a new step or project type is added, this test automatically covers it
  via `PROJECT_TYPES` and the `length: 15` range — no test edit needed, as long
  as the new prompt file exists. That is the point.
- If the step range ever changes from 0–14, update the `Array.from({ length: 15 })`
  bound and the step-8 exclusion.
- Reviewer should confirm the test reads the *real* prompts dir (via the
  container + `tests/setup.ts`), not a mock — a mocked loader would defeat the
  purpose.
