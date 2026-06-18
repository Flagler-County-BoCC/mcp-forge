# Plan 003: Write `~/.claude.json` atomically in setup/uninstall to prevent corrupting global Claude state

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat e7f9278..HEAD -- scripts/setup.ts scripts/uninstall.ts`
> If either file changed since this plan was written, compare the "Current
> state" excerpts against the live code before proceeding; on a mismatch, treat
> it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `e7f9278`, 2026-06-18

## Why this matters

`scripts/setup.ts` and `scripts/uninstall.ts` rewrite `~/.claude.json` — the
file that holds **all** of a user's Claude Code state across every project
(project history, MCP registrations, settings). Both use a `writeJson` helper
that calls `fs.writeFileSync(filePath, ...)` directly on the live file. If the
process is interrupted mid-write (crash, `Ctrl-C`, full disk), the user's global
config is left truncated/corrupted — affecting every project, not just
mcp-forge. The current `.bak` backup is also overwritten on every run, so a
second `setup` after a bad state can clobber the only good copy. The fix is a
standard atomic write: serialize to a temp file, then `rename` it over the
target (atomic on a single filesystem). This converts a rare-but-catastrophic
failure into a no-op.

## Current state

Both scripts contain an identical `writeJson`:

`scripts/setup.ts:60-65`:
```ts
function writeJson(filePath: string, data: Record<string, unknown>): void {
  const backupPath = filePath + '.bak';
  if (fs.existsSync(filePath)) fs.copyFileSync(filePath, backupPath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
}
```

`scripts/uninstall.ts:54-58` (same body, minus the `mkdirSync` line):
```ts
function writeJson(filePath: string, data: Record<string, unknown>): void {
  const backupPath = filePath + '.bak';
  if (fs.existsSync(filePath)) fs.copyFileSync(filePath, backupPath);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
}
```

Both files import `fs`, `path`, `os` from `node:*` at the top. These scripts are
run via `tsx` (`npm run setup` / `npm run uninstall`), are NOT part of the build
(`tsconfig.build.json` compiles `src/` only), and are NOT linted (`npm run lint`
targets `src tests`). So changes here cannot break the build or the lint gate.

The write targets are `~/.claude.json` (Claude Code) and the per-OS Claude
Desktop config — both large, shared JSON files.

## Commands you will need

| Purpose       | Command                          | Expected on success |
|---------------|----------------------------------|---------------------|
| Typecheck     | `npm run typecheck`              | exit 0              |
| Dry-run setup | (see Step 3 — uses a temp HOME)  | exit 0, file valid  |
| Tests         | `npm test`                       | 25 passed (unchanged) |

## Scope

**In scope**:
- `scripts/setup.ts` — replace the body of `writeJson`
- `scripts/uninstall.ts` — replace the body of `writeJson`

**Out of scope**:
- `src/**` — none of the runtime server code writes config files.
- The `.bak` semantics beyond what Step 1 specifies — keeping a single
  last-state `.bak` is acceptable once writes are atomic (corruption can no
  longer happen). Do not over-engineer timestamped backups.
- The Claude Desktop / Claude Code path-resolution logic — leave untouched.

## Git workflow

- Branch: `advisor/003-atomic-config-writes`
- Commit message style: conventional commits. Example:
  `fix: write claude config atomically via temp file + rename`
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Make `writeJson` atomic in `scripts/setup.ts`

Replace the `writeJson` function body so it writes to a temp file and renames it
over the target. `fs.renameSync` is atomic on a single filesystem and overwrites
the destination on both POSIX and Windows:

```ts
function writeJson(filePath: string, data: Record<string, unknown>): void {
  if (fs.existsSync(filePath)) fs.copyFileSync(filePath, filePath + '.bak');
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tmpPath = filePath + '.tmp';
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
  fs.renameSync(tmpPath, filePath); // atomic replace — live file is never partially written
}
```

**Verify**: `npm run typecheck` → exit 0.

### Step 2: Apply the same change in `scripts/uninstall.ts`

`uninstall.ts`'s `writeJson` currently lacks the `mkdirSync` line (it never
creates a new config). Add the atomic temp+rename, and keep it tolerant of a
missing parent dir for symmetry:

```ts
function writeJson(filePath: string, data: Record<string, unknown>): void {
  if (fs.existsSync(filePath)) fs.copyFileSync(filePath, filePath + '.bak');
  const tmpPath = filePath + '.tmp';
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
  fs.renameSync(tmpPath, filePath);
}
```

**Verify**: `npm run typecheck` → exit 0.

### Step 3: Smoke-test setup against a throwaway HOME (no real config touched)

Run setup with `HOME` and `APPDATA` pointed at a temp directory so the real
`~/.claude.json` is never touched, then confirm the written file is valid JSON
and no `.tmp` file is left behind:

```bash
TMPHOME="$(mktemp -d)"
npm run build
HOME="$TMPHOME" APPDATA="$TMPHOME/AppData/Roaming" npx tsx scripts/setup.ts
echo "--- written config ---"
node -e "JSON.parse(require('fs').readFileSync('$TMPHOME/.claude.json','utf8')); console.log('valid JSON')"
test ! -e "$TMPHOME/.claude.json.tmp" && echo "no leftover .tmp"
rm -rf "$TMPHOME"
```

**Verify**: output contains `valid JSON` and `no leftover .tmp`, and the command
exits 0. (The script may print a warning that Claude Desktop's config dir was
not found under the temp HOME — that is expected and fine.)

## Test plan

No unit tests exist for the scripts (they are install glue, not part of the
build/test surface) and adding a test harness for filesystem-mutating install
scripts is out of proportion to the change. The Step 3 smoke test against a
throwaway HOME is the verification. Do not add a Vitest suite for `scripts/`.

- Verification: Step 3 smoke test passes; `npm test` still → 25 passed
  (unchanged — scripts are not in the test surface).

## Done criteria

ALL must hold:

- [ ] Both `writeJson` functions write to `*.tmp` then `fs.renameSync` over the target
- [ ] `npm run typecheck` exits 0
- [ ] Step 3 smoke test prints `valid JSON` and `no leftover .tmp`, exits 0
- [ ] `git diff --name-only` shows only `scripts/setup.ts` and `scripts/uninstall.ts`
- [ ] `plans/README.md` status row for 003 updated

## STOP conditions

Stop and report back if:

- The drift check shows either script changed since `e7f9278` and the
  `writeJson` excerpt no longer matches.
- The Step 3 smoke test leaves a `.tmp` file behind or writes invalid JSON —
  the rename is not completing; report rather than shipping.
- `fs.renameSync` raises `EXDEV` (cross-device link) in the smoke test — this
  means temp and target are on different filesystems; report so the temp-file
  location can be reconsidered (it should be the same dir as the target, which
  this plan already does).

## Maintenance notes

- The temp file lives in the same directory as the target (e.g.
  `~/.claude.json.tmp`), which guarantees `rename` stays on one filesystem and
  is therefore atomic. If a future change moves the temp file to `os.tmpdir()`,
  the atomicity guarantee is lost (cross-device rename falls back to copy) —
  don't do that.
- Reviewer should confirm the temp path and target path share a parent
  directory.
- Deferred (not in this plan): rotating/timestamped backups. With atomic writes
  the live file can no longer be corrupted, so the single `.bak` is sufficient;
  revisit only if users report wanting multi-generation backups.
