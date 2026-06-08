# mcp-forge

An MCP stdio server that serves the **mcp-forge** prompt library — a deterministic, enterprise-grade system for rewriting any Node.js project to production-quality TypeScript.

Connect this server to any MCP client and call its tools to retrieve the exact prompts needed to rewrite a project step by step. The same source code always produces the same output — deterministic by design.

**Supported project types:** `http-api` · `library` · `cli` · `worker` · `mcp-server`

## Tools

| Tool | Description |
|---|---|
| `list_steps` | List all 15 rewrite steps. Pass `projectType` to see which steps apply or are skipped. |
| `get_step` | Get the full prompt for a specific step (0–14). Step 8 requires `projectType`. |
| `get_entrypoint` | Get the Step 8 entrypoint prompt for a given project type. |
| `get_master_prompt` | Get the single-pass master prompt for small projects (< 2 000 lines). |
| `validate_manifest` | Validate an `AUDIT_MANIFEST` JSON string produced by Step 0. |

## Setup

```bash
git clone https://github.com/Flagler-County-BoCC/mcp-forge
cd mcp-forge
npm install
npm run setup
```

`npm run setup` builds the project and automatically registers it in Claude Desktop's config file. It detects your OS, finds the right config path, and merges the entry without touching any other servers you have configured.

Restart Claude Desktop after running setup.

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

## How to use it

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

| Variable | Default | Description |
|---|---|---|
| `PROMPTS_DIR` | `.claude/commands` (relative to the binary) | Override the prompts directory location |
| `NODE_ENV` | `development` | Environment |
| `LOG_LEVEL` | `info` | pino log level |

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
