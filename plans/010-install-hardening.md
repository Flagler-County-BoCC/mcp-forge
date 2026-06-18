# Plan 010: Harden the generated cross-OS install scripts (atomic config writes)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If any
> STOP condition occurs, stop and report — do not improvise. When done, update
> the status row in `plans/README.md` unless a reviewer told you they maintain it.
>
> **Drift check (run first)**: `git diff --stat c20d1ef..HEAD -- .claude/commands/entrypoints/mcp-server.md`
> If the file changed since this plan was written, compare the "Current state"
> excerpts to the live file before proceeding; on mismatch, STOP.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none. **Interaction**: edits `entrypoints/mcp-server.md` (shared
  with plans 008 and 009) — run 008/009/010 on one branch to avoid conflicts.
- **Category**: bug
- **Planned at**: commit `c20d1ef`, 2026-06-18

## Why this matters

`entrypoints/mcp-server.md` instructs every generated mcp-server to ship a
`scripts/setup.ts` / `scripts/uninstall.ts` that registers the server in Claude
Desktop and Claude Code. The embedded `writeJson` rewrites `~/.claude.json` (and
the Desktop config) **non-atomically** — `fs.writeFileSync` directly onto the
live file. `~/.claude.json` holds all of a user's Claude Code state across every
project; a crash/full-disk mid-write truncates it, breaking every project, and
the single `.bak` is overwritten each run.

mcp-forge already fixed this exact bug in its OWN scripts (plan 003, merged at
`814b925`: write to a temp file, then `fs.renameSync` over the target — atomic on
one filesystem). But the **template that generates this code for other projects
still carries the old non-atomic version**. This plan propagates the proven fix
into the generator so every newly generated server is safe too. The cross-OS path
resolution (darwin/win32/linux) is already correct and stays as-is — "any OS" is
about the config-path matrix, which is complete.

## Current state

`entrypoints/mcp-server.md` embeds the buggy `writeJson` twice.

In the `scripts/setup.ts` block (lines 363–369):

```typescript
function writeJson(filePath: string, data: Record<string, unknown>): void {
  const backupPath = filePath + '.bak';
  if (fs.existsSync(filePath)) fs.copyFileSync(filePath, backupPath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  // NEVER use PowerShell ConvertFrom-Json | ConvertTo-Json — it silently drops unknown fields.
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
}
```

In the `scripts/uninstall.ts` block (lines 478–482):

```typescript
function writeJson(filePath: string, data: Record<string, unknown>): void {
  const backupPath = filePath + '.bak';
  if (fs.existsSync(filePath)) fs.copyFileSync(filePath, backupPath);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
}
```

The "Key implementation rules for both scripts" list (lines 521–527) currently
says "Always write a `.bak` file before modifying any config" but does not mention
atomicity.

For reference, the fix already applied to mcp-forge's own `scripts/setup.ts`
(commit `814b925`) is:

```typescript
function writeJson(filePath: string, data: Record<string, unknown>): void {
  if (fs.existsSync(filePath)) fs.copyFileSync(filePath, filePath + '.bak');
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tmpPath = filePath + '.tmp';
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
  fs.renameSync(tmpPath, filePath); // atomic replace — live file is never partially written
}
```

The prompt library is prettier-ignored, so editing this `.md` does not affect
`npm run format:check`.

## Commands you will need

| Purpose      | Command                  | Expected |
|--------------|--------------------------|----------|
| Tests        | `npm test`               | 46 pass (unchanged) |
| Format check | `npm run format:check`   | exit 0   |
| Helper typecheck | (Step 3 — scratch)   | exit 0   |

## Scope

**In scope**:
- `.claude/commands/entrypoints/mcp-server.md` — the two embedded `writeJson`
  functions and the "Key implementation rules" list.

**Out of scope**:
- mcp-forge's OWN `scripts/setup.ts` / `scripts/uninstall.ts` — already fixed by
  plan 003 at `814b925`; do not touch them.
- The OS path-resolution `switch` blocks — already correct for darwin/win32/linux.
- Adding new clients (Cursor, VS Code) — out of scope for this plan (it is about
  hardening, not breadth); note as a follow-up only.

## Git workflow

- Branch: `advisor/010-install-hardening` (or the shared 008/009/010 branch)
- Commit style: conventional commits. Example:
  `fix: generated install scripts write config atomically (temp + rename)`

## Steps

### Step 1: Make the `setup.ts` `writeJson` atomic

In `entrypoints/mcp-server.md`, replace the `scripts/setup.ts` `writeJson`
(lines 363–369) with:

```typescript
function writeJson(filePath: string, data: Record<string, unknown>): void {
  if (fs.existsSync(filePath)) fs.copyFileSync(filePath, filePath + '.bak');
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  // NEVER use PowerShell ConvertFrom-Json | ConvertTo-Json — it silently drops unknown fields.
  const tmpPath = filePath + '.tmp';
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
  fs.renameSync(tmpPath, filePath); // atomic replace — live config is never partially written
}
```

### Step 2: Make the `uninstall.ts` `writeJson` atomic

Replace the `scripts/uninstall.ts` `writeJson` (lines 478–482) with:

```typescript
function writeJson(filePath: string, data: Record<string, unknown>): void {
  if (fs.existsSync(filePath)) fs.copyFileSync(filePath, filePath + '.bak');
  const tmpPath = filePath + '.tmp';
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
  fs.renameSync(tmpPath, filePath);
}
```

**Verify**: `grep -c "fs.renameSync(tmpPath, filePath)" .claude/commands/entrypoints/mcp-server.md` → `2`.

### Step 3: Confirm both embedded functions are valid TypeScript

Copy each new `writeJson` into a scratch file outside the repo (with a minimal
`import fs from 'node:fs'; import path from 'node:path';` header) and typecheck —
no repo mutation:

```bash
TMP="$(mktemp -d)/w.ts"
printf "import fs from 'node:fs';\nimport path from 'node:path';\n" > "$TMP"
# append ONE of the new writeJson functions to $TMP, then:
npx --yes tsc --noEmit --strict --module nodenext --moduleResolution nodenext "$TMP"; echo "tsc exit $?"
rm -rf "$(dirname "$TMP")"
```

**Verify**: `tsc exit 0`.

### Step 4: Update the "Key implementation rules" list

In the "Key implementation rules for both scripts" list (lines 521–527), change
the `.bak` bullet to also require atomicity:

```markdown
- Write config atomically: serialize to `<file>.tmp`, then `fs.renameSync` it over
  the target (atomic on a single filesystem) so a crash mid-write can never leave
  a truncated config. Always copy the existing file to `<file>.bak` first.
```

**Verify**: `grep -c "atomically\|renameSync" .claude/commands/entrypoints/mcp-server.md` → ≥ 2.

### Step 5: Full gate

**Verify**:
- `npm run format:check` → exit 0
- `npm test` → 46 passed (unchanged)

## Test plan

Prompt-content change only; forge's 46 tests are unchanged. The real correctness
gate is Step 3 — the embedded `writeJson` functions must typecheck under strict
nodenext. The grep checks confirm both copies were updated and the rules list
mentions atomicity. No end-to-end generation test is added (none exists); do not
fake one.

## Done criteria

ALL must hold:

- [ ] Both embedded `writeJson` functions use `<file>.tmp` + `fs.renameSync`
- [ ] Both embedded functions pass strict `tsc` in a scratch file (Step 3)
- [ ] The "Key implementation rules" list requires atomic writes
- [ ] `npm run format:check` → exit 0 and `npm test` → 46 passed
- [ ] `git diff --name-only` shows only `entrypoints/mcp-server.md`
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report if:

- The drift check shows `entrypoints/mcp-server.md` changed since `c20d1ef` and the
  `writeJson` excerpts no longer match (e.g. plans 008/009 already shifted line
  numbers on the same branch — in that case locate each `writeJson` by content and
  proceed; only STOP if the function bodies themselves differ from the excerpts).
- Step 3's strict typecheck fails after a reasonable fix — report rather than
  loosening types.

## Maintenance notes

- This mirrors plan 003 (which fixed mcp-forge's own scripts). If 003's approach
  is ever revised (e.g. timestamped backups), update this template to match so
  forge and the code it generates stay consistent.
- The temp file is in the same directory as the target, guaranteeing same-filesystem
  rename (atomic). Do not move it to `os.tmpdir()` — cross-device rename is not atomic.
- Follow-up explicitly deferred: registering generated servers in additional
  clients (Cursor `~/.cursor/mcp.json`, VS Code). That is breadth, not hardening,
  and belongs in its own plan.
- Reviewer should confirm BOTH `writeJson` copies (setup and uninstall) were
  updated — it is easy to fix one and miss the other.
