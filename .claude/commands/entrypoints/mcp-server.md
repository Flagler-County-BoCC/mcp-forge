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
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
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
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
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
3. On success: return `{ content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }`.
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

## Determinism Rules

- `src/server.ts` must be importable in tests with no side effects (no `connect()` call).
- `src/stdio.ts` is the only file that calls `server.connect()`.
- Every tool in `AUDIT_MANIFEST.mcpTools` must have a corresponding `server.tool()` registration.
- Tool names are derived exactly from `AUDIT_MANIFEST.mcpTools[*].name` — never invented.
- All tool handlers use `try/catch` + `handleToolError` — never re-throw.
- Write operations (non-GET equivalent) must implement the write gate pattern if `config.mcp.requireConfirm` exists.
- `src/lib/container.ts` exports only service instances — never the raw HTTP client.
