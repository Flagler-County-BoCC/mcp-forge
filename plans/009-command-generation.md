# Plan 009: Generate commands about the target MCP's tools (raw-API + business-logic tiers), not forge meta-commands

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
- **Effort**: M
- **Risk**: MED
- **Depends on**: none. **Interaction**: edits `entrypoints/mcp-server.md` (shared
  with plans 008 and 010) — run 008/009/010 on one branch to avoid conflicts.
- **Category**: direction
- **Planned at**: commit `c20d1ef`, 2026-06-18

## Why this matters

When a generated mcp-server ships slash commands, the instructions in
`entrypoints/mcp-server.md` currently tell it to ship **mcp-forge's own**
meta-commands — `audit`, `plan`, `step`, `rewrite`. Those commands are about
*running mcp-forge on a codebase*; they have nothing to do with the API the
generated server actually wraps. A generated ConnectWise server should ship
commands that *call ConnectWise tools*, not a `forge-audit` command.

The owner wants two tiers of generated commands, about the target MCP's own tools:
1. **Raw-API commands** — one thin command per MCP tool (mechanical, 1:1, fully
   deterministic).
2. **Business-logic commands** — higher-level workflows that compose several
   tools. These are judgment-based, so to preserve the determinism guarantee they
   are generated **only from an explicit user-supplied list** (decision already
   made), never inferred.

## Current state

`entrypoints/mcp-server.md` "templates/.claude/commands/" section (lines 530–557)
is the offending instruction. Verbatim (lines 536–557):

```markdown
Minimum set for an mcp-server project:

```
templates/
  .claude/
    commands/
      <prefix>-audit.md     ← Step 0: audit codebase, emit AUDIT_MANIFEST
      <prefix>-plan.md      ← list applicable steps for this project type
      <prefix>-step.md      ← apply a numbered step (uses $ARGUMENTS)
      <prefix>-rewrite.md   ← single-pass rewrite for small projects
```

Each file is a plain-English instruction block that calls MCP tools. Example (`<prefix>-audit.md`):

```markdown
Audit this codebase using <projectName>.

1. Call the `<tool_name>` tool from <projectName> to get the Step 0 audit prompt
2. Apply the audit prompt: read every source file, analyze structure and dependencies
3. Emit a complete AUDIT_MANIFEST JSON block
4. Summarize findings: projectType detected, key dependencies, total line count, gaps found
```
```

These four commands (`audit/plan/step/rewrite`) are mcp-forge's own tools — they
are wrong for a generated server. The real tool list for a generated server lives
in `AUDIT_MANIFEST.mcpTools[*].name`, with the naming convention defined at lines
152–159 (`<module-prefix>-<verb>-<noun>`).

The prompt library is prettier-ignored, so editing this `.md` does not affect
`npm run format:check`. Other prompt files reference command templates
(`shared/14-docs.md`, `shared/13-finalize.md`, `shared/01-structure.md`,
`shared/09-testing.md`) but the entrypoint is the authoritative generator spec;
this plan fixes the entrypoint and checks the others don't contradict it.

## Commands you will need

| Purpose      | Command                  | Expected |
|--------------|--------------------------|----------|
| Tests        | `npm test`               | 46 pass (unchanged) |
| Format check | `npm run format:check`   | exit 0   |
| Cross-check  | `grep -rn ...` (Step 3)  | as specified |

## Scope

**In scope**:
- `.claude/commands/entrypoints/mcp-server.md` — replace the templates/commands
  section (lines 530–557) with the two-tier spec below.

**Out of scope**:
- mcp-forge's OWN `templates/.claude/commands/forge-*.md` — those are correct for
  mcp-forge itself; do not touch them.
- Rewriting `shared/14-docs.md` etc. — only read them for contradictions (Step 3);
  do not edit unless Step 3 finds a direct contradiction, and if it does, STOP and
  report rather than expanding scope.
- Auto-inferring business-logic commands — explicitly rejected; generate them only
  from a user-supplied list.

## Git workflow

- Branch: `advisor/009-command-generation` (or the shared 008/009/010 branch)
- Commit style: conventional commits. Example:
  `feat: generated commands target the MCP's own tools (raw + business tiers)`

## Steps

### Step 1: Replace the templates/commands section

In `entrypoints/mcp-server.md`, replace the entire section from line 530
(`## templates/.claude/commands/ — Slash Command Templates`) through line 557
(end of the audit-command example, before the `---` and "Determinism Rules") with
the following:

````markdown
## templates/.claude/commands/ — Slash Command Templates

Generate slash commands **about this server's own tools** — never mcp-forge's
meta-commands. `npm run setup` copies these to `~/.claude/commands/` for global
use. There are two tiers.

### Tier 1 — Raw-API commands (always generated, one per tool)

For EVERY tool in `AUDIT_MANIFEST.mcpTools`, generate exactly one command file.
This is mechanical and deterministic — one tool, one command, no judgment.

- File name: `<tool-name>.md` (the tool name verbatim, e.g. `svc-get-ticket.md`).
- Body (fill `<tool-name>`, `<projectName>`, and the tool's parameters from its
  schema):

```markdown
Call the `<tool-name>` tool from <projectName>.

Arguments (from the tool's input schema):
- <param>: <type> — <description> (<required|optional, default>)
- fields: string[] — optional; return only these fields.

Pass the user's `$ARGUMENTS` as the tool arguments. Return the tool's result
verbatim. Do not add interpretation.
```

Generate one such file per tool, sorted by tool name. Do not group or omit.

### Tier 2 — Business-logic commands (only from an explicit list)

Generate a business-logic command ONLY for each entry the user provides in a
`BUSINESS_COMMANDS` list (in the spec/manifest or supplied directly). Never infer
business commands — inference is non-deterministic. Each entry has: a command
name, a one-line goal, and the ordered tools it composes.

- File name: `<command-name>.md`.
- Body:

```markdown
<goal sentence>.

Steps:
1. Call `<tool-a>` with <args derived from $ARGUMENTS>.
2. Use its result to call `<tool-b>` ...
3. Summarize for the user.

This command composes existing <projectName> tools; it adds no new capability.
```

If the user supplies no `BUSINESS_COMMANDS` list, generate ZERO Tier-2 files (the
raw tier alone is a complete, valid command set).

### Naming & determinism

- Tier-1 file names equal tool names exactly (`AUDIT_MANIFEST.mcpTools[*].name`).
- Tier-1 files are generated for ALL tools, sorted by name — no selection.
- Tier-2 files come only from the explicit list, in the order listed.
- Never generate `audit`/`plan`/`step`/`rewrite` commands — those are mcp-forge's
  own meta-commands and are meaningless in a generated server.
````

**Verify**:
- `grep -c "Raw-API commands" .claude/commands/entrypoints/mcp-server.md` → `1`
- `grep -c "Business-logic commands" .claude/commands/entrypoints/mcp-server.md` → `1`
- `grep -c "forge\|audit.md.*Step 0\|rewrite.md" .claude/commands/entrypoints/mcp-server.md` → `0` (the meta-command example is gone)

### Step 2: Add a Determinism Rule for command generation

In `entrypoints/mcp-server.md` "Determinism Rules" list (near line 561), add:

```markdown
- Generate one Tier-1 command per tool in `AUDIT_MANIFEST.mcpTools` (file name =
  tool name), sorted by name. Generate Tier-2 commands only from an explicit
  `BUSINESS_COMMANDS` list. Never generate mcp-forge meta-commands.
```

**Verify**: `grep -c "Tier-1 command per tool" .claude/commands/entrypoints/mcp-server.md` → `1`.

### Step 3: Cross-check other prompt files for contradictions

The minimum command set is referenced elsewhere. Confirm none still instruct
generating forge-style commands for a *generated* server:

```bash
grep -rn "forge-audit\|forge-plan\|forge-step\|forge-rewrite\|audit, emit AUDIT" \
  .claude/commands/shared/14-docs.md .claude/commands/shared/13-finalize.md \
  .claude/commands/shared/01-structure.md .claude/commands/shared/09-testing.md
```

**Verify**: returns nothing, OR only references to mcp-forge documenting ITSELF
(not instructions for generated servers). If a file instructs a *generated*
server to ship forge meta-commands, **STOP and report** — do not expand this
plan's scope to rewrite it; the reviewer will decide whether it needs its own plan.

### Step 4: Full gate

**Verify**:
- `npm run format:check` → exit 0
- `npm test` → 46 passed (unchanged)

## Test plan

This plan edits prompt content, not forge runtime code; forge's 46 tests are
unchanged and `prompt-files.test.ts` continues to assert the entrypoint loads and
is non-trivial. The substantive verification is the grep presence/absence checks
in Steps 1–3 — they prove the meta-command instruction is gone and the two-tier
spec is present. There is no automated test of generated-command correctness
(that needs an end-to-end generation run); do not fake one.

## Done criteria

ALL must hold:

- [ ] The templates/commands section describes Tier-1 (raw, 1-per-tool) and
      Tier-2 (business, list-only) and no longer shows `audit/plan/step/rewrite`
- [ ] A Determinism Rule for command generation is added
- [ ] Step 3 cross-check finds no generated-server instruction to ship forge meta-commands
- [ ] `npm run format:check` → exit 0 and `npm test` → 46 passed
- [ ] `git diff --name-only` shows only `entrypoints/mcp-server.md`
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report if:

- Step 3 finds another prompt file instructing generated servers to ship forge
  meta-commands — report it for a separate plan; do not rewrite it here.
- The drift check shows `entrypoints/mcp-server.md` changed since `c20d1ef` and the
  line-530–557 excerpt no longer matches (e.g. the section was already edited by
  plan 008/010 on the same branch — in that case re-locate the section by its
  `## templates/.claude/commands/` heading and proceed).
- You cannot determine a tool's parameters for the Tier-1 body — that means the
  manifest/schema link is unclear; report rather than guessing parameter names.

## Maintenance notes

- Tier-1 is the deterministic backbone (1 tool ⇒ 1 command). Tier-2 is opt-in by
  design — if the owner later wants curated default workflows, that is a new
  decision (auto-inference was deliberately rejected here to protect determinism).
- This shares `entrypoints/mcp-server.md` with plans 008 (field-selection) and
  010 (install hardening). If executed separately, expect a merge conflict on that
  file; prefer one chained branch.
- Reviewer should confirm the `forge`/`audit`/`rewrite` example is actually gone
  (Step 1's zero-match grep), not just supplemented.
