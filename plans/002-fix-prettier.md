# Plan 002: Make `npm run format:check` pass without reformatting the prompt library

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat e7f9278..HEAD`
> If many files changed since this plan was written, re-run
> `npm run format:check` to get the current list before proceeding.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: MED
- **Depends on**: none (independent of 001, but land both before declaring CI green)
- **Category**: dx
- **Planned at**: commit `e7f9278`, 2026-06-18

## Why this matters

`npm run format:check` exits 1 — Prettier reports 33 files with style issues —
and CI (`.github/workflows/ci.yml`) runs it as a gate, so the pipeline is red.
The fix is to format the source files. The complication: 33 flagged files
include the 14 prompt `.md` files under `.claude/commands/` and 3 under
`templates/.claude/commands/`. **Those prompt files are the product** — they are
served verbatim to MCP clients, and the project's stated contract
(`.claude/CLAUDE.md`, "Determinism Contract") is that prompt content is
byte-stable. Running Prettier over them would rewrap prose, renumber lists, and
change the exact bytes clients receive. So this plan excludes the prompt library
from Prettier via `.prettierignore`, then formats everything else.

## Current state

- No `.prettierignore` file exists. Prettier respects `.gitignore` (so
  `dist/`, `node_modules/`, `coverage/` are already skipped) but there is no
  mechanism excluding the prompt library.
- `.prettierrc.json` config:
  ```json
  { "semi": true, "singleQuote": true, "trailingComma": "all", "printWidth": 100, "tabWidth": 2, "endOfLine": "lf" }
  ```
- `npm run format` is `prettier --write .`; `npm run format:check` is
  `prettier --check .` (see `package.json` scripts).
- The 33 flagged files fall into three groups:
  1. **Prompt library — must NOT be reformatted**: `.claude/commands/shared/*.md`
     (00-audit through 14-docs, 14 files), `templates/.claude/commands/forge-*.md`
     (3 files).
  2. **README** (`README.md`) — documentation, safe to format.
  3. **Source / config**: `scripts/setup.ts`, `scripts/uninstall.ts`,
     `src/config/env.ts`, `src/stdio.ts`, `src/tools/manifest/manifest.schema.ts`,
     `src/tools/manifest/__tests__/manifest.service.spec.ts` — safe to format.

## Commands you will need

| Purpose        | Command                  | Expected on success         |
|----------------|--------------------------|-----------------------------|
| Format check   | `npm run format:check`   | "All matched files use Prettier code style!", exit 0 |
| Format write   | `npm run format`         | exit 0                      |
| List flagged   | `npm run format:check`   | (read the `[warn]` lines)   |
| Typecheck      | `npm run typecheck`      | exit 0                      |
| Tests          | `npm test`               | 25 passed                   |

## Scope

**In scope**:
- `.prettierignore` (create)
- All non-prompt files Prettier flags (README, scripts, src config/schema/spec)
  — modified by `prettier --write`, not by hand.

**Out of scope** (do NOT modify the bytes of):
- `.claude/commands/**` — the prompt library served to clients. Excluded via
  `.prettierignore`, never hand-edited here.
- `templates/.claude/commands/**` — slash-command templates copied to users'
  `~/.claude/commands/`. Also excluded.
- `.prettierrc.json` — do not change the Prettier rules; the goal is to satisfy
  the existing rules, not redefine them.

## Git workflow

- Branch: `advisor/002-fix-prettier`
- Commit message style: conventional commits. Example:
  `chore: format source files and exclude prompt library from prettier`
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Create `.prettierignore` excluding the prompt library

Create `.prettierignore` in the repo root with this content:

```
# Build & deps (also covered by .gitignore, listed for clarity)
dist/
coverage/
node_modules/

# Prompt library — served verbatim to MCP clients; must stay byte-stable
# per the Determinism Contract in .claude/CLAUDE.md. Do not let Prettier rewrap.
.claude/commands/
templates/.claude/commands/
```

**Verify**: `npm run format:check 2>&1 | grep -c '.claude/commands'` → `0`
(the prompt files are no longer flagged).

### Step 2: Format the remaining files

Run:

```
npm run format
```

This rewrites README and the flagged source/config files to match
`.prettierrc.json`. It must NOT touch anything under `.claude/commands/` or
`templates/` (Step 1 excluded them).

**Verify**:
- `git diff --name-only -- .claude/commands templates` → empty (no prompt files changed)
- `npm run format:check` → "All matched files use Prettier code style!", exit 0

### Step 3: Confirm nothing else broke

**Verify**:
- `npm run typecheck` → exit 0
- `npm test` → 25 passed

## Test plan

No new tests — formatting is non-functional. The existing suite passing after
`prettier --write` confirms no source semantics changed.

- Verification: `npm test` → 25 passed.

## Done criteria

ALL must hold:

- [ ] `.prettierignore` exists and lists `.claude/commands/` and `templates/.claude/commands/`
- [ ] `npm run format:check` exits 0
- [ ] `git diff --name-only -- .claude/commands templates` is empty
- [ ] `npm run typecheck` exits 0 and `npm test` → 25 passed
- [ ] `plans/README.md` status row for 002 updated

## STOP conditions

Stop and report back if:

- `prettier --write` modifies any file under `.claude/commands/` or
  `templates/` — the ignore file is not taking effect; do not commit and report.
- `npm test` fails after formatting — formatting should never change behavior;
  investigate the diff before proceeding.
- `npm run format:check` still reports files you did not expect after Steps 1–2
  (e.g. a new file type) — report the list rather than guessing at new ignores.

## Maintenance notes

- The Prettier gate now covers source + README only. If the team later *wants*
  the prompt files Prettier-formatted, that is a deliberate decision that
  changes the bytes clients receive — it should be its own PR with the prompt
  diffs reviewed, not folded in here.
- Reviewer should scrutinize the `git diff` on `.claude/commands/` is empty and
  that the README diff is whitespace-only.
- This plan is independent of plan 001, but CI is only green once both 001
  (lint) and 002 (format) land.
