# Step 14 — Professional GitHub Documentation

## Prerequisites
- `AUDIT_MANIFEST` from Step 0 in context.
- Steps 1–13 applied (package.json, routes, config, and CI all finalized).

## Objective
Generate a complete set of professional GitHub markdown files. Every file must be production-quality — suitable for a public or enterprise-internal open-source repository. No placeholder sections, no "TODO: fill this in" text.

## Files to Generate

```
README.md
CONTRIBUTING.md
CHANGELOG.md
SECURITY.md
CODE_OF_CONDUCT.md
.github/
  PULL_REQUEST_TEMPLATE.md
  ISSUE_TEMPLATE/
    bug_report.md
    feature_request.md
docs/
  API.md                (http-api: REST reference | mcp-server: Tool reference | library: Function reference)
  ARCHITECTURE.md
  ENVIRONMENT.md
```

---

## README.md

Structure (in this exact order). Adapt section names and content to the projectType — e.g., replace "API Reference" with "Tool Reference" for mcp-server, "Function Reference" for library, "Commands" for cli.

```markdown
# <projectName>

> <one-sentence description>

![CI](https://github.com/<org>/<repo>/actions/workflows/ci.yml/badge.svg)
![License](https://img.shields.io/github/license/<org>/<repo>)
![Node](https://img.shields.io/badge/node-%3E%3D22.0.0-brightgreen)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)

## Table of Contents
<!-- adapt to project type -->

## Overview

## Requirements

## Installation
\`\`\`bash
git clone ...
npm install
cp .env.example .env  # skip for library
\`\`\`

## Configuration
See [docs/ENVIRONMENT.md](docs/ENVIRONMENT.md).

## Usage
<!-- http-api: dev/prod/docker | mcp-server: MCP config block | cli: command examples | library: import + code example -->

## [API / Tool / Function] Reference
See [docs/API.md](docs/API.md).

## Testing
\`\`\`bash
npm test
npm run test:coverage
\`\`\`

## Project Structure

## Contributing
See [CONTRIBUTING.md](CONTRIBUTING.md).

## License
[MIT](LICENSE) © <year> <org or author>
```

### mcp-server README additions

Include a "MCP Configuration" section with ready-to-paste JSON for Cursor and Claude Desktop:

```markdown
## MCP Configuration

### Cursor (.cursor/mcp.json)
\`\`\`json
{
  "mcpServers": {
    "<projectName>": {
      "command": "node",
      "args": ["/absolute/path/to/<projectName>/dist/stdio.js"],
      "env": {
        "NODE_ENV": "production",
        "LOG_LEVEL": "info"
        // ... other required env vars from docs/ENVIRONMENT.md
      }
    }
  }
}
\`\`\`

### Claude Desktop (claude_desktop_config.json)
\`\`\`json
{
  "mcpServers": {
    "<projectName>": {
      "command": "node",
      "args": ["/absolute/path/to/<projectName>/dist/stdio.js"]
    }
  }
}
\`\`\`
```

---

## docs/API.md — adapt to projectType

### http-api
Full REST endpoint reference derived from `AUDIT_MANIFEST.publicApiRoutes`. Same format as prior version of this step.

### mcp-server
Tool reference derived from `AUDIT_MANIFEST.mcpTools`:

```markdown
# Tool Reference

This MCP server exposes the following tools. All tools return JSON text content.

## Error Handling
All tools return `isError: true` with an `Error [CODE]: message` string on failure — they never throw.

## Profiles
Tools are filtered by the active profile (`CW_ACTIVE_PROFILE`). See [docs/ENVIRONMENT.md](docs/ENVIRONMENT.md).

## <Module> Tools

### <prefix>-list-<module>
**Description:** <description from AUDIT_MANIFEST>

**Input:**
| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `field` | `string` | No | — | ... |

**Output:** JSON array of `<Module>` objects.

**Example:**
\`\`\`json
{ "board": "Managed Services", "pageSize": 25 }
\`\`\`
```

### library
Function reference derived from `AUDIT_MANIFEST.exportedSymbols`.

### cli
Command reference derived from `AUDIT_MANIFEST.cliCommands`.

---

## docs/ARCHITECTURE.md

Generate the architecture diagram appropriate to the projectType.

### mcp-server diagram

```
MCP Client (Cursor / Claude Desktop)
         │  JSON-RPC over stdio
         ▼
┌─────────────────────┐
│   StdioTransport     │  src/stdio.ts
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│    McpServer         │  src/server.ts — tool registry
└────────┬────────────┘
         │  tool call
         ▼
┌─────────────────────┐
│   Tool Handler       │  src/tools/<module>/<module>.tool.ts
│   (try/catch)        │  validates input → calls service → formats result
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│    Service           │  src/tools/<module>/<module>.service.ts
│    (business logic)  │  throws AppError subclasses
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│   HTTP Client        │  src/lib/http-client.ts
│   (axios + auth)     │  wraps upstream errors as ExternalServiceError
└────────┬────────────┘
         │  HTTPS
         ▼
  External REST API
  (ConnectWise / other)
```

---

## SECURITY.md — adapt security measures to projectType

For mcp-server, replace HTTP-specific measures with:

```markdown
## Security Measures in This Project
- Input validation with zod on every tool call.
- Credentials managed via environment variables — never committed to source.
- Write operations require `confirm=true` or `dryRun=true` (configurable).
- Profile-based tool filtering limits exposure to authorized operations.
- Upstream API errors are normalized — raw credentials never appear in error messages.
- Pino redaction removes credential fields from all log output.
- Dependencies audited with `npm audit` on every CI run.
```

---

## Remaining files (CONTRIBUTING.md, CHANGELOG.md, CODE_OF_CONDUCT.md, .github/*, docs/ENVIRONMENT.md)

Same content as described in prior version of this step. `docs/ENVIRONMENT.md` uses all variables from `AUDIT_MANIFEST.environmentVariables`.

---

## Determinism Rules
- Badge URLs use the exact GitHub Actions workflow filename from `shared/12-ci.md` (`ci.yml`).
- Content sourced from AUDIT_MANIFEST — do not invent routes, tools, commands, or env vars.
- Contributor Covenant text is reproduced verbatim (v2.1) — do not paraphrase.
- mcp-server README must include the MCP configuration section with Cursor and Claude Desktop examples.
- Architecture diagram must match the detected `projectType` — do not use the http-api diagram for mcp-server projects.
- Docs files use GitHub-Flavored Markdown (GFM).
