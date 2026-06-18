# Entrypoint — mcp-server

> This file is consumed by Step 8 of the rewrite process. Apply when `AUDIT_MANIFEST.projectType === "mcp-server"`.

## Architecture Overview

```
src/stdio.ts          ← process entry; connects StdioServerTransport; never imported by tests
src/server.ts         ← McpServer factory; registers all tools; importable with no side effects
src/tools/<module>/   ← one folder per logical tool group (module)
src/lib/
  container.ts        ← wires HTTP client → services; exports service instances
  http-client.ts      ← axios/got client with auth interceptors + error normalization
src/config/           ← zod-validated env (from Step 2)
src/errors/           ← AppError hierarchy (from Step 4)
```

---

## src/server.ts — McpServer Factory

```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { config } from './config/index.js';
import { register<Module>Tools } from './tools/<module>/<module>.tool.js';
// one import per module in AUDIT_MANIFEST.mcpTools[*].module (deduplicated)

export function createServer(): McpServer {
  const server = new McpServer({
    name: config.app?.name ?? '<projectName>',
    version: process.env['npm_package_version'] ?? '0.0.0',
  });

  // Register tools in alphabetical module order
  register<Module>Tools(server);
  // ...

  return server;
}
```

`server.ts` must NOT call `server.connect()` — that is `stdio.ts`'s job. This makes `server.ts` testable without side effects.

---

## src/stdio.ts — Process Entry

```typescript
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createServer } from './server.js';
import { logger } from './lib/logger.js';
import { config } from './config/index.js';

async function main(): Promise<void> {
  const server = createServer();
  const transport = new StdioServerTransport();

  await server.connect(transport);

  logger.info(
    {
      app: config.app?.name ?? 'mcp-server',
      env: config.env,
      profile: config.mcp?.activeProfile ?? 'default',
    },
    'MCP stdio server started',
  );
}

process.on('SIGTERM', () => {
  logger.info('SIGTERM received — shutting down');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received — shutting down');
  process.exit(0);
});

process.on('unhandledRejection', (reason) => {
  logger.fatal({ reason }, 'Unhandled promise rejection');
  process.exit(1);
});

void main().catch((err) => {
  logger.fatal({ err }, 'Failed to start MCP server');
  process.exit(1);
});
```

---

## src/tools/<module>/<module>.tool.ts — Tool Registration

One file per logical module group (e.g., `service`, `time`, `agreements`). Each file exports one `register<Module>Tools(server)` function.

```typescript
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { validate } from '../../lib/validate.js';
import { selectFields } from '../../lib/select-fields.js';
import { handleToolError } from '../../lib/tool-error-handler.js';
import {
  List<Module>Schema,
  Get<Module>ByIdSchema,
  Create<Module>Schema,
} from './<module>.schema.js';
import { <module>Service } from '../../lib/container.js';
import { createLogger } from '../../lib/logger.js';

const log = createLogger({ module: '<module>Tool' });

export function register<Module>Tools(server: McpServer): void {

  // ---- list<Module> ----
  server.tool(
    '<prefix>-list-<module>',
    'List <module> records with optional filters. Returns paginated JSON.',
    List<Module>Schema.shape,          // pass the zod shape directly to McpServer
    async (params): Promise<CallToolResult> => {
      const input = validate(List<Module>Schema, params);
      log.debug({ input }, '<prefix>-list-<module> called');
      try {
        const result = await <module>Service.list<Module>(input);
        const projected = selectFields(result, input.fields);
        return { content: [{ type: 'text', text: JSON.stringify(projected, null, 2) }] };
      } catch (err) {
        return handleToolError(err, '<prefix>-list-<module>');
      }
    },
  );

  // ---- get<Module>ById ----
  server.tool(
    '<prefix>-get-<module>',
    'Get a single <module> record by ID.',
    Get<Module>ByIdSchema.shape,
    async (params): Promise<CallToolResult> => {
      const input = validate(Get<Module>ByIdSchema, params);
      log.debug({ input }, '<prefix>-get-<module> called');
      try {
        const result = await <module>Service.get<Module>ById(input.id);
        const projected = selectFields(result, input.fields);
        return { content: [{ type: 'text', text: JSON.stringify(projected, null, 2) }] };
      } catch (err) {
        return handleToolError(err, '<prefix>-get-<module>');
      }
    },
  );

  // Add one server.tool() call per tool in AUDIT_MANIFEST.mcpTools where module === '<module>'
}
```

### Tool Naming Convention

Tool names follow the pattern `<module-prefix>-<verb>-<noun>`:
- Prefix is the short alias for the module (e.g., `svc` for service, `time` for time entries)
- Verb: `list`, `get`, `create`, `update`, `delete`, `search`
- Noun: the resource name

Derive tool names and prefixes directly from `AUDIT_MANIFEST.mcpTools[*].name`. Do not invent tool names.

### Tool Handler Rules

1. Every tool handler wraps its service call in `try/catch` — never propagates unhandled errors.
2. On error: call `handleToolError(err, toolName)` and return the result (never re-throw).
3. On success: project the result with `selectFields(result, input.fields)` and
   return `{ content: [{ type: 'text', text: JSON.stringify(projected, null, 2) }] }`.
4. Log the tool call at `debug` level with the validated input before calling the service.
5. Never call `process.exit()` inside a tool handler.
6. For write operations (POST/PATCH equivalent): check `config.mcp.requireConfirm` and `config.mcp.enableDryRun`; if confirm is required and not provided, return a `isError: false` message asking the caller to re-invoke with `confirm: true`.

### Write Gate Pattern

```typescript
// For any tool that mutates state:
if (config.mcp.requireConfirm && !input.confirm && !input.dryRun) {
  return {
    content: [{
      type: 'text',
      text: 'This operation will modify data. Re-invoke with confirm=true to proceed, or dryRun=true to preview.',
    }],
    isError: false,
  };
}
if (input.dryRun) {
  return {
    content: [{ type: 'text', text: `[DRY RUN] Would ${verb} ${noun}: ${JSON.stringify(input, null, 2)}` }],
    isError: false,
  };
}
```

---

## src/lib/tool-error-handler.ts

```typescript
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { AppError } from '../errors/index.js';
import { createLogger } from './logger.js';

const log = createLogger({ module: 'toolErrorHandler' });

export function handleToolError(err: unknown, toolName: string): CallToolResult {
  if (err instanceof AppError) {
    if (!err.isOperational) {
      log.error({ err, toolName }, 'Non-operational error in tool');
    } else {
      log.warn({ err, toolName }, 'Operational error in tool');
    }
    return {
      content: [{ type: 'text', text: `Error [${err.code}]: ${err.message}` }],
      isError: true,
    };
  }
  log.error({ err, toolName }, 'Unexpected error in tool');
  return {
    content: [{ type: 'text', text: 'An unexpected error occurred. Check server logs.' }],
    isError: true,
  };
}
```

---

## src/lib/select-fields.ts — Response Projection

```typescript
/**
 * Client-side field projection. Returns only the requested top-level fields.
 * - Objects: keep only keys in `fields`.
 * - Arrays of objects: project each element.
 * - Anything else, or empty/undefined `fields`: return unchanged.
 * ponytail: top-level keys only; deep dot-paths are a future extension if needed.
 */
export function selectFields<T>(data: T, fields?: string[]): unknown {
  if (!fields || fields.length === 0) return data;
  const pick = (obj: Record<string, unknown>): Record<string, unknown> => {
    const out: Record<string, unknown> = {};
    for (const f of fields) {
      if (f in obj) out[f] = obj[f];
    }
    return out;
  };
  if (Array.isArray(data)) {
    return data.map((item) =>
      item && typeof item === 'object' ? pick(item as Record<string, unknown>) : item,
    );
  }
  if (data && typeof data === 'object') {
    return pick(data as Record<string, unknown>);
  }
  return data;
}
```

---

## src/lib/http-client.ts — External API Client

See `shared/07-services.md` for the full pattern. For MCP servers calling ConnectWise-style APIs:

```typescript
import axios, { type AxiosInstance, type AxiosRequestConfig } from 'axios';
import { config } from '../config/index.js';
import { createLogger } from './logger.js';
import { ExternalServiceError } from '../errors/index.js';

const log = createLogger({ module: 'httpClient' });

export function createApiClient(): AxiosInstance {
  const client = axios.create({
    baseURL: `https://${config.cw.server}/${config.cw.apiPath}`,
    timeout: config.cw.timeoutMs,
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
  });

  client.interceptors.request.use((req: AxiosRequestConfig) => {
    req.auth = {
      username: `${config.cw.company}+${config.cw.pub}`,
      password: config.cw.priv,
    };
    req.headers = {
      ...req.headers,
      clientId: config.cw.clientId,
    };
    return req;
  });

  client.interceptors.response.use(
    (res) => res,
    (err: unknown) => {
      const status = axios.isAxiosError(err) ? err.response?.status : undefined;
      const body = axios.isAxiosError(err) ? err.response?.data : undefined;
      const message = (body as { message?: string })?.message
        ?? (axios.isAxiosError(err) ? err.message : String(err));
      log.warn({ status, message, url: axios.isAxiosError(err) ? err.config?.url : undefined }, 'API error');
      throw new ExternalServiceError('ExternalAPI', message, status);
    },
  );

  return client;
}
```

---

## Profile & Allowlist Filtering

If `AUDIT_MANIFEST` shows profile/allowlist logic in the original code, generate `src/lib/profile.ts`:

```typescript
import { config } from '../config/index.js';

export function isToolAllowedForProfile(toolName: string): boolean {
  const profiles = config.mcp?.profiles as Record<string, string[]> | undefined;
  const active = config.mcp?.activeProfile ?? 'admin';
  if (!profiles) return true;          // no profile config = allow all
  const prefixes = profiles[active];
  if (!prefixes) return false;
  if (prefixes.length === 0 || (prefixes.length === 1 && prefixes[0] === '')) return true; // admin
  return prefixes.some((prefix) => toolName.startsWith(prefix));
}
```

In `src/server.ts`, wrap each `register<Module>Tools` call:

```typescript
if (isToolAllowedForProfile('<prefix>-')) {
  register<Module>Tools(server);
}
```

---

---

## scripts/setup.ts — Client Registration

Every `mcp-server` project must ship a `scripts/setup.ts` that registers the server in both Claude Desktop and Claude Code with a single `npm run setup`. This removes the manual `mcpServers` editing step that breaks every time the user reinstalls.

```typescript
/**
 * Registers <projectName> in Claude Desktop and Claude Code CLI.
 * Also installs slash commands globally to ~/.claude/commands/.
 * Run with: npm run setup
 *
 * Claude Desktop — per-OS config file (claude_desktop_config.json)
 * Claude Code    — ~/.claude.json, mcpServers key, type: "stdio"
 *                  ~/.claude/commands/ — global slash commands (available in every project)
 *
 * Both config operations write a .bak backup before modifying.
 * Requires dist/stdio.js to be built first (handled by `npm run setup`).
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BINARY = path.join(ROOT, 'dist', 'stdio.js');
const SERVER_KEY = '<projectName>';
const TEMPLATES_DIR = path.join(ROOT, 'templates', '.claude', 'commands');
const GLOBAL_COMMANDS_DIR = path.join(os.homedir(), '.claude', 'commands');

function getClaudeDesktopConfigPath(): string {
  switch (process.platform) {
    case 'darwin':
      return path.join(os.homedir(), 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json');
    case 'win32':
      return path.join(
        process.env['APPDATA'] ?? path.join(os.homedir(), 'AppData', 'Roaming'),
        'Claude',
        'claude_desktop_config.json',
      );
    default:
      return path.join(os.homedir(), '.config', 'Claude', 'claude_desktop_config.json');
  }
}

function getClaudeCodeConfigPath(): string {
  // ~/.claude.json — NOT ~/.claude/settings.json (that file is for preferences, not MCP)
  return path.join(os.homedir(), '.claude.json');
}

function readJson(filePath: string): Record<string, unknown> {
  if (!fs.existsSync(filePath)) return {};
  const raw = fs.readFileSync(filePath, 'utf-8').trim();
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    console.error(`\n  Config at ${filePath} is not valid JSON — fix manually.\n`);
    process.exit(1);
  }
}

function writeJson(filePath: string, data: Record<string, unknown>): void {
  if (fs.existsSync(filePath)) fs.copyFileSync(filePath, filePath + '.bak');
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  // NEVER use PowerShell ConvertFrom-Json | ConvertTo-Json — it silently drops unknown fields.
  const tmpPath = filePath + '.tmp';
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
  fs.renameSync(tmpPath, filePath); // atomic replace — live config is never partially written
}

function registerDesktop(configPath: string): void {
  const configDir = path.dirname(configPath);
  if (!fs.existsSync(configDir)) {
    console.warn(`\n  Claude Desktop: config directory not found — may not be installed.`);
    return;
  }
  const config = readJson(configPath);
  const mcpServers = (config['mcpServers'] as Record<string, unknown> | undefined) ?? {};
  const isUpdate = SERVER_KEY in mcpServers;
  mcpServers[SERVER_KEY] = { command: 'node', args: [BINARY] };
  config['mcpServers'] = mcpServers;
  writeJson(configPath, config);
  console.log(`\n  ${isUpdate ? 'Updated' : 'Registered'} in Claude Desktop`);
  console.log(`  Config: ${configPath}`);
}

function registerClaudeCode(configPath: string): void {
  const config = readJson(configPath);
  const mcpServers = (config['mcpServers'] as Record<string, unknown> | undefined) ?? {};
  const isUpdate = SERVER_KEY in mcpServers;
  // Claude Code requires type: "stdio" for local process servers
  mcpServers[SERVER_KEY] = { type: 'stdio', command: 'node', args: [BINARY] };
  config['mcpServers'] = mcpServers;
  writeJson(configPath, config);
  console.log(`\n  ${isUpdate ? 'Updated' : 'Registered'} in Claude Code`);
  console.log(`  Config: ${configPath}`);
}

function installCommands(): void {
  if (!fs.existsSync(TEMPLATES_DIR)) return;
  fs.mkdirSync(GLOBAL_COMMANDS_DIR, { recursive: true });
  const files = fs.readdirSync(TEMPLATES_DIR).filter(f => f.endsWith('.md'));
  const installed: string[] = [];
  const updated: string[] = [];
  for (const file of files) {
    const dest = path.join(GLOBAL_COMMANDS_DIR, file);
    const isUpdate = fs.existsSync(dest);
    fs.copyFileSync(path.join(TEMPLATES_DIR, file), dest);
    (isUpdate ? updated : installed).push(file.replace('.md', ''));
  }
  console.log(`\n  Slash commands installed to: ${GLOBAL_COMMANDS_DIR}`);
  if (installed.length) console.log(`  Installed: ${installed.map(f => `/${f}`).join('  ')}`);
  if (updated.length)   console.log(`  Updated:   ${updated.map(f => `/${f}`).join('  ')}`);
}

function main(): void {
  if (!fs.existsSync(BINARY)) {
    console.error('\n  Build not found. Run `npm run build` first.\n');
    process.exit(1);
  }
  registerDesktop(getClaudeDesktopConfigPath());
  registerClaudeCode(getClaudeCodeConfigPath());
  installCommands();
  console.log(`\n  Binary: ${BINARY}`);
  console.log('\n  Restart Claude Desktop to apply the change.');
  console.log('  Claude Code picks up the change automatically.\n');
}

main();
```

---

## scripts/uninstall.ts — Client De-registration

```typescript
/**
 * Removes <projectName> from Claude Desktop and Claude Code.
 * Also removes slash commands from ~/.claude/commands/.
 * Run with: npm run uninstall
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SERVER_KEY = '<projectName>';
const GLOBAL_COMMANDS_DIR = path.join(os.homedir(), '.claude', 'commands');

function getClaudeDesktopConfigPath(): string {
  switch (process.platform) {
    case 'darwin':
      return path.join(os.homedir(), 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json');
    case 'win32':
      return path.join(
        process.env['APPDATA'] ?? path.join(os.homedir(), 'AppData', 'Roaming'),
        'Claude',
        'claude_desktop_config.json',
      );
    default:
      return path.join(os.homedir(), '.config', 'Claude', 'claude_desktop_config.json');
  }
}

function getClaudeCodeConfigPath(): string {
  return path.join(os.homedir(), '.claude.json');
}

function readJson(filePath: string): Record<string, unknown> {
  if (!fs.existsSync(filePath)) return {};
  const raw = fs.readFileSync(filePath, 'utf-8').trim();
  if (!raw) return {};
  try { return JSON.parse(raw) as Record<string, unknown>; }
  catch { console.error(`\n  ${filePath} is not valid JSON.\n`); process.exit(1); }
}

function writeJson(filePath: string, data: Record<string, unknown>): void {
  if (fs.existsSync(filePath)) fs.copyFileSync(filePath, filePath + '.bak');
  const tmpPath = filePath + '.tmp';
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
  fs.renameSync(tmpPath, filePath);
}

function deregister(configPath: string, label: string): void {
  if (!fs.existsSync(configPath)) {
    console.log(`\n  ${label}: not found — nothing to remove.`); return;
  }
  const config = readJson(configPath);
  const mcpServers = config['mcpServers'] as Record<string, unknown> | undefined;
  if (!mcpServers || !(SERVER_KEY in mcpServers)) {
    console.log(`\n  ${label}: ${SERVER_KEY} not registered — nothing to remove.`); return;
  }
  delete mcpServers[SERVER_KEY];
  if (Object.keys(mcpServers).length === 0) delete config['mcpServers'];
  writeJson(configPath, config);
  console.log(`\n  Removed from ${label}: ${configPath}`);
}

function removeCommands(): void {
  if (!fs.existsSync(GLOBAL_COMMANDS_DIR)) return;
  const files = fs.readdirSync(GLOBAL_COMMANDS_DIR).filter(f => f.endsWith('.md'));
  if (!files.length) return;
  for (const file of files) fs.unlinkSync(path.join(GLOBAL_COMMANDS_DIR, file));
  console.log(`\n  Removed ${files.length} slash command(s) from ${GLOBAL_COMMANDS_DIR}`);
}

function main(): void {
  deregister(getClaudeDesktopConfigPath(), 'Claude Desktop');
  deregister(getClaudeCodeConfigPath(),    'Claude Code');
  removeCommands();
  console.log('\n  Manual steps remaining:');
  console.log('    1. Restart Claude Desktop');
  console.log('    2. npm unlink -g <projectName>  (if you ran npm link)');
  console.log(`    3. Delete: ${ROOT}`);
  console.log();
}

main();
```

**Key implementation rules for both scripts:**
- Use `node:fs` / `JSON.parse` / `JSON.stringify` to read and write config files — never PowerShell `ConvertFrom-Json | ConvertTo-Json`, which silently drops unrecognized fields and corrupts configs.
- Write config atomically: serialize to `<file>.tmp`, then `fs.renameSync` it over
  the target (atomic on a single filesystem) so a crash mid-write can never leave
  a truncated config. Always copy the existing file to `<file>.bak` first.
- Claude Code MCP config is `~/.claude.json` (with `type: "stdio"` on each entry), NOT `~/.claude/settings.json` (that file is for editor preferences).
- Claude Desktop config is `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) | `%APPDATA%\Claude\claude_desktop_config.json` (Windows) | `~/.config/Claude/claude_desktop_config.json` (Linux).
- Slash commands go in `~/.claude/commands/` for global availability in every project.

---

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

---

## Determinism Rules

- `src/server.ts` must be importable in tests with no side effects (no `connect()` call).
- `src/stdio.ts` is the only file that calls `server.connect()`.
- Every tool in `AUDIT_MANIFEST.mcpTools` must have a corresponding `server.tool()` registration.
- Tool names are derived exactly from `AUDIT_MANIFEST.mcpTools[*].name` — never invented.
- All tool handlers use `try/catch` + `handleToolError` — never re-throw.
- Write operations (non-GET equivalent) must implement the write gate pattern if `config.mcp.requireConfirm` exists.
- `src/lib/container.ts` exports only service instances — never the raw HTTP client.
- `scripts/setup.ts` and `scripts/uninstall.ts` must be present — they are not optional.
- Config file manipulation must use `node:fs` + `JSON.parse`/`JSON.stringify` — never shell JSON tools.
- Every tool input schema includes optional `fields: string[]`; every handler
  applies `selectFields(result, input.fields)` before serializing.
- `src/lib/select-fields.ts` is present in every generated mcp-server.
- Generate one Tier-1 command per tool in `AUDIT_MANIFEST.mcpTools` (file name =
  tool name), sorted by name. Generate Tier-2 commands only from an explicit
  `BUSINESS_COMMANDS` list. Never generate mcp-forge meta-commands.
