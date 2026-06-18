# Plan 004: Make the CI "MCP smoke test" actually able to fail

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat e7f9278..HEAD -- .github/workflows/ci.yml`
> If the workflow changed since this plan was written, compare the "Current
> state" excerpt against the live file before proceeding.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: 001 and 002 should land first (so the rest of CI is green and
  this step is reached), but not strictly required.
- **Category**: dx
- **Planned at**: commit `e7f9278`, 2026-06-18

## Why this matters

The final CI step is named "MCP smoke test" but ends in `|| true`, which
discards the exit code, and it never inspects the server's output. It can never
fail — a server that crashes on startup, prints a stack trace, or emits no
JSON-RPC response at all would still pass. It is verification theater. This plan
makes it assert that the built `dist/stdio.js` actually starts and returns a
valid JSON-RPC `initialize` result identifying the server, so a broken build
binary is caught.

## Current state

`.github/workflows/ci.yml:32-35`:

```yaml
      - name: MCP smoke test
        run: |
          echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"ci-smoke","version":"0.0.0"}}}' \
          | timeout 5 node dist/stdio.js || true
```

Facts that constrain the fix:
- The server (`src/stdio.ts`, compiled to `dist/stdio.js`) is a stdio MCP
  server: it reads JSON-RPC lines from stdin and writes responses to stdout.
  All logging goes to **stderr** (`src/lib/logger.ts` — destination fd 2), so
  stdout contains only JSON-RPC framing.
- An `initialize` response is a JSON-RPC result whose `result.serverInfo.name`
  is `mcp-forge` (set in `src/server.ts:8` — `name: 'mcp-forge'`).
- This step runs after `npm run build`, so `dist/stdio.js` exists.
- The runner is `ubuntu-latest`; `bash`, `timeout`, and `grep` are available.

## Commands you will need

This change is to CI YAML; verify it locally by running the same shell snippet
against a freshly built binary.

| Purpose       | Command              | Expected on success |
|---------------|----------------------|---------------------|
| Build         | `npm run build`      | exit 0, `dist/stdio.js` exists |
| Local smoke   | (the Step 1 snippet) | prints `smoke test passed`, exit 0 |

## Scope

**In scope**:
- `.github/workflows/ci.yml` — only the `MCP smoke test` step.

**Out of scope**:
- Every other CI step (typecheck, lint, format, test, build) — leave untouched.
- `src/**` — do not change the server to make the test pass; the server already
  responds correctly.
- Adding a separate smoke-test script file — keep it inline in the workflow
  (the assertion is three lines; a new file is unnecessary).

## Git workflow

- Branch: `advisor/004-real-smoke-test`
- Commit message style: conventional commits. Example:
  `ci: assert the mcp smoke test actually returns an initialize result`
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Replace the smoke-test step with one that asserts the response

Replace lines 32–35 of `.github/workflows/ci.yml` with:

```yaml
      - name: MCP smoke test
        run: |
          OUT=$(printf '%s\n' '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"ci-smoke","version":"0.0.0"}}}' | timeout 5 node dist/stdio.js)
          echo "server stdout: $OUT"
          echo "$OUT" | grep -q '"result"' || { echo "FAIL: no JSON-RPC result in server output"; exit 1; }
          echo "$OUT" | grep -q 'mcp-forge'  || { echo "FAIL: server did not identify as mcp-forge"; exit 1; }
          echo "smoke test passed"
```

Why this works: stdout carries only JSON-RPC (logs go to stderr), so `$OUT` is
the `initialize` response. `timeout 5` caps the wait — even if the server keeps
running after stdin EOF, the response has already been written and captured, and
the assertions run against `$OUT` regardless of how the process exited. There is
no `|| true`, so a missing/invalid response fails the job.

**Verify (locally)**: run, from the repo root after `npm run build`:

```bash
OUT=$(printf '%s\n' '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"ci-smoke","version":"0.0.0"}}}' | timeout 5 node dist/stdio.js)
echo "$OUT" | grep -q '"result"' && echo "$OUT" | grep -q 'mcp-forge' && echo "smoke test passed"
```

Expected: prints `smoke test passed`.

### Step 2: Confirm the YAML is well-formed

The repo has no YAML linter; confirm indentation matches the surrounding steps
(6 spaces for `- name:`, 8 for `run:`). Re-read the file and check the new step
aligns with the `- run: npm run build` step above it.

**Verify**: `git diff .github/workflows/ci.yml` shows only the smoke-test step
changed, with consistent indentation.

## Test plan

This is a CI-only change with no application code. The "test" is the local
reproduction in Step 1's Verify block — it must print `smoke test passed`
against the real built binary. No unit tests to add.

## Done criteria

ALL must hold:

- [ ] The `MCP smoke test` step no longer contains `|| true`
- [ ] The step greps the server output for `"result"` and `mcp-forge` and
      `exit 1`s on either failure
- [ ] Local reproduction (Step 1 Verify) prints `smoke test passed` after `npm run build`
- [ ] `git diff --name-only` shows only `.github/workflows/ci.yml`
- [ ] `plans/README.md` status row for 004 updated

## STOP conditions

Stop and report back if:

- The local reproduction does NOT print `smoke test passed` — the built binary
  is not returning an initialize result as assumed. Capture `$OUT` and report;
  do not weaken the assertion to make it pass.
- The server name in `src/server.ts` is no longer `mcp-forge` (drift) — the
  `grep -q 'mcp-forge'` assertion would need the new name; report rather than
  guessing.

## Maintenance notes

- If the MCP protocol version or the `initialize` response shape changes in a
  future `@modelcontextprotocol/sdk` upgrade, the `"result"` grep is the
  resilient assertion; the `mcp-forge` grep depends only on the server name and
  should remain stable.
- Reviewer should confirm there is no `|| true` or other exit-code suppression
  anywhere in the step.
- This is a coarse smoke test by design (does the binary start and speak
  stdio?). Deep behavior is covered by `tests/integration/server.test.ts`; do
  not duplicate that coverage in CI shell.
