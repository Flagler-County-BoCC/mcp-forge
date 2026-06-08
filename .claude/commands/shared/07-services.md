# Step 7 — Service Layer (Business Logic)

## Prerequisites
- Steps 0–6 applied.

## Objective
Implement the service layer — the only place where business logic lives. Services coordinate data-access clients (repositories or HTTP clients) and other services. They have no knowledge of HTTP responses, MCP protocol, CLI output, or queue mechanics.

## Service Class Convention — all project types

```typescript
export class <Domain>Service {
  private readonly log = createLogger({ module: '<domain>Service' });

  constructor(
    private readonly <domain>Repo: I<Domain>Repository, // or httpClient for mcp-server
    // other dependencies injected here
  ) {}

  async get<Domain>ById(id: string): Promise<<Domain>> {
    const item = await this.<domain>Repo.findById(id);
    if (!item) throw new NotFoundError(`<Domain> with id '${id}' not found`);
    return item;
  }
}
```

Rules:
1. Receive all dependencies via constructor injection — never `new Repository()` or `new HttpClient()` inside a service.
2. Return domain types — never HTTP responses, MCP `CallToolResult`, CLI strings, or raw queue messages.
3. Throw `AppError` subclasses for all business-rule violations.
4. Methods are `async` and return `Promise<T>` (never callbacks).
5. Never import `req`, `res`, `reply`, job objects, or MCP SDK types.
6. Never import `config` unless the service genuinely needs an app-level config value.

## mcp-server: HTTP Client as Data Access

For `mcp-server` projects that call an external REST API (no local DB), the HTTP client takes the place of a repository:

### src/lib/http-client.ts

```typescript
import axios, { type AxiosInstance } from 'axios';
import { config } from '../config/index.js';
import { createLogger } from './logger.js';
import { ExternalServiceError } from '../errors/index.js';

const log = createLogger({ module: 'httpClient' });

export function createHttpClient(baseURL: string): AxiosInstance {
  const client = axios.create({
    baseURL,
    timeout: config.cw.timeoutMs,
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
  });

  // Request interceptor: attach auth
  client.interceptors.request.use((req) => {
    req.auth = { username: `${config.cw.company}+${config.cw.pub}`, password: config.cw.priv };
    req.headers['clientId'] = config.cw.clientId;
    return req;
  });

  // Response interceptor: normalize errors
  client.interceptors.response.use(
    (res) => res,
    (err: unknown) => {
      const status = axios.isAxiosError(err) ? err.response?.status : undefined;
      const message = axios.isAxiosError(err) ? (err.response?.data as { message?: string })?.message ?? err.message : String(err);
      log.warn({ status, message }, 'External API error');
      throw new ExternalServiceError('ExternalAPI', message, status);
    },
  );

  return client;
}
```

Services receive the HTTP client via DI, just as they would receive a repository.

## Dependency Injection Container — src/lib/container.ts

```typescript
// For http-api / worker with DB:
import { prisma } from './db.js';
import { <Domain>Repository } from '../modules/<domain>/<domain>.repository.js';
import { <Domain>Service } from '../modules/<domain>/<domain>.service.js';

export const <domain>Repository = new <Domain>Repository(prisma);
export const <domain>Service = new <Domain>Service(<domain>Repository);

// For mcp-server with external HTTP API:
import { createHttpClient } from './http-client.js';
import { <Module>Service } from '../tools/<module>/<module>.service.js';

const apiClient = createHttpClient(`https://${config.cw.server}/${config.cw.apiPath}`);

export const <module>Service = new <Module>Service(apiClient);
```

Rules:
- One entry per module: HTTP client / repositories first, then services.
- Export only service instances from container — not repositories or HTTP clients.
- The MCP server registration in `src/server.ts` imports services from container.

## Transaction Support

- Prisma: accept optional `tx?: PrismaClient` parameter; default to global `prisma`.
- Knex/pg: accept optional `trx?: Transaction` parameter.
- Never expose transaction management to callers (controllers, tool handlers, job handlers).

## Determinism Rules
- One service class per domain module.
- Service method names: `verb + DomainNoun` (e.g., `listTickets`, `createTimeEntry`, `getBoard`).
- Services must not log protocol-specific context (HTTP headers, MCP tool names, CLI flags).
- Cross-domain operations belong in the calling service.
