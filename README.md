# mcp-forge

An MCP stdio server that serves the **mcp-forge** prompt library — a deterministic, enterprise-grade system for rewriting any Node.js project to production-quality TypeScript.

Connect this server to any MCP client and call its tools to retrieve the exact prompts needed to rewrite a project step by step. The same source code always produces the same output — deterministic by design.

**Supported project types:** `http-api` · `library` · `cli` · `worker` · `mcp-server`

## Tools

| Tool                | Description                                                                            |
| ------------------- | -------------------------------------------------------------------------------------- |
| `list_steps`        | List all 15 rewrite steps. Pass `projectType` to see which steps apply or are skipped. |
| `get_step`          | Get the full prompt for a specific step (0–14). Step 8 requires `projectType`.         |
| `get_entrypoint`    | Get the Step 8 entrypoint prompt for a given project type.                             |
| `get_master_prompt` | Get the single-pass master prompt for small projects (< 2 000 lines).                  |
| `validate_manifest` | Validate an `AUDIT_MANIFEST` JSON string produced by Step 0.                           |

## Setup

```bash
git clone <repo-url>
cd mcp-forge
npm install
npm run setup
```

`npm run setup` builds the project and automatically:

1. Registers the MCP server in Claude Desktop
2. Registers the MCP server in Claude Code (`~/.claude.json`)
3. Installs `/forge-*` slash commands globally to `~/.claude/commands/`

Restart Claude Desktop after running setup. Claude Code picks up changes automatically.

### Manual setup (Cursor or other MCP clients)

Add this to your client's MCP config:

```json
{
  "mcpServers": {
    "mcp-forge": {
      "command": "node",
      "args": ["/absolute/path/to/repo/dist/stdio.js"]
    }
  }
}
```

Build first if you haven't already: `npm run build`

> `PROMPTS_DIR` defaults to `.claude/commands` inside the repo — no environment variable needed.

## Slash commands in Claude Code

After `npm run setup`, the following commands are available globally in **any project** — no per-project setup required:

| Command                         | Description                                                                   |
| ------------------------------- | ----------------------------------------------------------------------------- |
| `/forge-audit`                  | Audit the codebase and emit an `AUDIT_MANIFEST`. Always start here.           |
| `/forge-plan [projectType]`     | List which steps apply to this project type. Run after audit.                 |
| `/forge-step <n> [projectType]` | Apply a specific step. Example: `/forge-step 3` or `/forge-step 8 mcp-server` |
| `/forge-rewrite`                | Single-pass full rewrite for small projects (< 2 000 lines).                  |

**Typical workflow:**

```
/forge-audit
/forge-plan
/forge-step 1
/forge-step 2
... (continue through the steps)
/forge-step 8 mcp-server
/forge-step 9
... through /forge-step 14
```

## Using the MCP tools directly

**Incremental rewrite (large projects, recommended):**

1. `get_step({ step: 0 })` → run the audit prompt, receive an `AUDIT_MANIFEST` JSON
2. `validate_manifest({ manifestJson: "..." })` → confirm it's valid
3. `list_steps({ projectType: "mcp-server" })` → see which steps apply
4. `get_step({ step: 1 })` → `get_step({ step: 7 })` → scaffold in order
5. `get_entrypoint({ projectType: "mcp-server" })` → entrypoint layer (Step 8)
6. `get_step({ step: 9 })` → `get_step({ step: 14 })` → testing, security, CI, docs

**Single-pass rewrite (small projects, < 2 000 lines):**

1. `get_master_prompt()` → paste your entire project source into context with the returned prompt

## Environment variables

| Variable      | Default                                     | Description                             |
| ------------- | ------------------------------------------- | --------------------------------------- |
| `PROMPTS_DIR` | `.claude/commands` (relative to the binary) | Override the prompts directory location |
| `NODE_ENV`    | `development`                               | Environment                             |
| `LOG_LEVEL`   | `info`                                      | pino log level                          |

## Development

```bash
npm run dev          # tsx watch mode
npm test             # run all tests (25 unit + integration)
npm run typecheck    # TypeScript check
npm run lint         # ESLint
npm run build        # compile to dist/
```

## Prompt library layout

```
.claude/commands/
  shared/          Steps 00–07, 09–14 (all project types, conditional sections)
  entrypoints/     Step 08 — one file per project type
  masters/         MASTER.md — universal single-pass prompt
```

## License

MIT
