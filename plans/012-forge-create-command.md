# Plan 012: Add the missing `/forge-create` slash command for Create mode

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If any
> STOP condition occurs, stop and report — do not improvise. When done, update
> the status row in `plans/README.md` unless a reviewer told you they maintain it.
>
> **Drift check (run first)**: `git diff --stat a3e502d..HEAD -- templates/.claude/commands scripts/setup.ts src/tools/steps/steps.tool.ts`
> If those changed since this plan was written, compare the "Current state" excerpts
> to the live files before proceeding.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: 007 (the `get_create_prompt` tool must exist — it does, on `main`)
- **Category**: dx
- **Planned at**: commit `a3e502d`, 2026-06-18

## Why this matters

Plan 007 added Create mode as the `get_create_prompt` MCP tool, but mcp-forge also
ships user-facing `/forge-*` slash commands (installed globally by `npm run setup`),
and **no `/forge-create` command was added**. The result: a user in Claude Code
sees `/forge-audit`, `/forge-plan`, `/forge-step`, `/forge-rewrite` — but has no
command to actually invoke Create mode. The feature is reachable only by calling
the raw MCP tool by name. This plan adds the missing slash command so "create a new
MCP from a spec" is a first-class command like the others.

## Current state

Installed slash-command templates (`templates/.claude/commands/`):

```
forge-audit.md
forge-plan.md
forge-rewrite.md
forge-step.md
```

There is no `forge-create.md`. The `get_create_prompt` tool exists in
`src/tools/steps/steps.tool.ts` (line 84). `scripts/setup.ts` copies every
`forge-*.md` automatically — its filter is `f.startsWith('forge-') && f.endsWith('.md')`
— so a new `forge-create.md` is installed by `npm run setup` with no code change.

Existing template format to match — `templates/.claude/commands/forge-rewrite.md`:

```markdown
Run a complete single-pass enterprise rewrite of this project using mcp-forge.
Best for projects under 2,000 lines. For larger projects, use /forge-audit instead.

Steps:
1. Call the `get_master_prompt` tool from mcp-forge
2. Apply the returned master prompt to the entire codebase — read every source file first
3. Detect the project type automatically as part of the rewrite (the master prompt handles this)
4. Emit every rewritten file in full
5. Show a final summary of all changes made and the detected project type
```

README "Slash commands in Claude Code" table currently lists the four commands;
it needs a `/forge-create` row (check `README.md` for the table — it has columns
`| Command | Description |`).

## Commands you will need

| Purpose      | Command                  | Expected |
|--------------|--------------------------|----------|
| Tests        | `npm test`               | 49 passed (unchanged — this adds a template + README row, no runtime change) |
| Format check | `npm run format:check`   | exit 0 for tracked code/README (`.claude/commands` and worktrees aside) |
| List installed (after setup, optional) | `ls ~/.claude/commands/forge-*.md` | includes `forge-create.md` |

> Note on `format:check`: if `.claude/worktrees/` or an untracked `plans/` exists in
> your tree, `npm run format:check` may report files there — that is pre-existing
> local noise, not caused by this plan. Confirm your two changed files
> (`forge-create.md`, `README.md`) are Prettier-clean specifically.

## Scope

**In scope**:
- `templates/.claude/commands/forge-create.md` (create)
- `README.md` (add a `/forge-create` row to the slash-commands table)

**Out of scope**:
- `scripts/setup.ts` — no change needed; the `forge-*` glob already picks up the new file.
- `src/**` — the `get_create_prompt` tool already exists; do not modify it.
- `.claude/commands/**` (the served prompt library) — this plan is about mcp-forge's
  own user-facing slash commands, not the generated-server command templates.

## Git workflow

- Branch: `advisor/012-forge-create-command`
- Commit style: conventional commits. Example:
  `feat: add /forge-create slash command for Create mode`
- Do NOT push or merge to `main` — the maintainer merges.

## Steps

### Step 1: Create the `forge-create.md` template

Create `templates/.claude/commands/forge-create.md` with this content verbatim:

```markdown
Create a brand-new, hardened MCP server from an API specification using mcp-forge.
Use this when there is NO existing project to rewrite — you are generating one from
scratch. To improve an existing project instead, use /forge-audit.

Steps:
1. Call the `get_create_prompt` tool from mcp-forge
2. Apply the returned Create-mode prompt to produce the manifest:
   - If an OpenAPI/Swagger document (openapi.json, openapi.yaml, swagger.json) is
     available, use it as the source.
   - Otherwise, fill in the BUILD_SPEC template the prompt provides (project name,
     base URL, auth, operations, and each operation's response fields).
3. Emit the AUDIT_MANIFEST JSON block (projectType will be "mcp-server"), with one
   mcpTools entry per operation and responseFields populated per tool.
4. Call the `validate_manifest` tool to confirm the manifest is valid. If it reports
   errors, fix them and re-validate before continuing.
5. Generate the server from the manifest: apply steps 1–7 via `get_step`, then
   `get_entrypoint` for mcp-server (step 8), then steps 9–14. Write every file in full.
6. Show a summary: the tools generated, modules, the environment variables the user
   must set, and the next action — `npm install && npm run setup` to build and
   register the new server.

Note: this produces a NEW project. Run it in an empty directory (or one you intend
to populate), not on top of unrelated code.
```

**Verify**: `test -f templates/.claude/commands/forge-create.md && head -1 templates/.claude/commands/forge-create.md`
→ file exists, first line mentions creating a new MCP server.

### Step 2: Update the README — intro framing + slash command + workflow

The Tools table and the "Using the MCP tools directly" section already document
`get_create_prompt` and "Creating a new MCP server" (added by plan 007). Three
gaps remain — fix all three.

**2a — Broaden the intro framing.** The project is still described as rewrite-only,
which contradicts Create mode. In `README.md` change the opening description
(line ~3) from:

```markdown
An MCP stdio server that serves the **mcp-forge** prompt library — a deterministic, enterprise-grade system for rewriting any Node.js project to production-quality TypeScript.
```

to:

```markdown
An MCP stdio server that serves the **mcp-forge** prompt library — a deterministic, enterprise-grade system for creating new, or rewriting existing, Node.js projects (including MCP servers) to production-quality TypeScript.
```

And in the next paragraph (line ~5), add a sentence noting both modes, e.g. append:
"Rewrite an existing project step by step, or generate a brand-new MCP server from
an API spec with Create mode."

**2b — Add the slash-command row.** In the "Slash commands in Claude Code" table
(columns `| Command | Description |`), add a row (place it after `/forge-audit`):

```markdown
| `/forge-create`                 | Create a brand-new MCP server from an OpenAPI doc or BUILD_SPEC (no existing project needed). |
```

**2c — Show create in the "Typical workflow" block.** After the existing rewrite
workflow fenced block, add a short create alternative:

```markdown
**Or — create a new MCP server from scratch:**

```
/forge-create
```

Supply an OpenAPI document or fill in the BUILD_SPEC when prompted; mcp-forge
generates the whole server (steps 1–14 + the mcp-server entrypoint).
```

**Verify**:
- `grep -c "/forge-create" README.md` → ≥ 2 (slash table + workflow)
- `grep -ci "creating new, or rewriting" README.md` → 1 (intro broadened)

### Step 3: Gates

**Verify**:
- `npm test` → 49 passed (unchanged)
- `npx prettier --check templates/.claude/commands/forge-create.md README.md` → both clean
  (run `npx prettier --write` on them if not, they are in scope)

## Test plan

No automated test covers slash-command templates (they are plain instruction files
copied by setup). The verification is: the file exists with the right content
(Step 1), the README documents it (Step 2), and the existing 49 tests still pass
(nothing runtime changed). Do not add a forge unit test for a markdown template.

Optional manual confirmation (not required for done): run `npm run setup` and check
`ls ~/.claude/commands/forge-create.md` exists — but `npm run setup` mutates the
user's global config, so only do this if you intend to actually install.

## Done criteria

ALL must hold:

- [ ] `templates/.claude/commands/forge-create.md` exists and calls `get_create_prompt`
- [ ] `README.md` intro mentions creating (not just rewriting), the slash-commands
      table has a `/forge-create` row, and the "Typical workflow" shows a create option
- [ ] `npm test` → 49 passed
- [ ] `forge-create.md` and `README.md` are Prettier-clean
- [ ] `git diff --name-only` shows only those two files
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report if:

- `get_create_prompt` is NOT found in `src/tools/steps/steps.tool.ts` (the drift
  check shows 007 was reverted) — the command would reference a non-existent tool.
- `scripts/setup.ts`'s template filter no longer matches `forge-*.md` (it was
  changed) — then a setup.ts change WOULD be needed; report rather than editing it.

## Maintenance notes

- The four existing `/forge-*` commands plus this one are mcp-forge's own UX. If a
  future MCP tool is added that users should invoke directly, add a matching
  `forge-*.md` here too.
- This is distinct from the *generated-server* command templates (plan 009, in
  `entrypoints/mcp-server.md`) — those are about the servers mcp-forge builds, not
  mcp-forge itself.
- Reviewer should confirm the command references the real tool name
  (`get_create_prompt`) exactly.
