# Step 4 — Error Hierarchy & Centralized Error Handling

## Prerequisites
- Steps 0–3 applied.

## Objective
Define a typed error hierarchy in `src/errors/` and a centralized error handler appropriate to the project type. No handler or tool may ever throw a raw `Error` — all thrown errors must be instances of the defined hierarchy.

## Error Class Definitions — all project types

### src/errors/AppError.ts

```typescript
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;
  public readonly context?: Record<string, unknown>;

  constructor(
    message: string,
    statusCode: number,
    code: string,
    isOperational = true,
    context?: Record<string, unknown>,
  ) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    // Guard required by exactOptionalPropertyTypes: assigning `undefined` to an optional
    // property is a type error when that flag is on. Use the if-guard pattern instead.
    if (context !== undefined) {
      this.context = context;
    }
    Error.captureStackTrace(this, this.constructor);
  }
}
```

### src/errors/HttpErrors.ts — all project types

Generate these subclasses (exactly these, no extras):

| Class | statusCode | code |
|---|---|---|
| `BadRequestError` | 400 | `BAD_REQUEST` |
| `UnauthorizedError` | 401 | `UNAUTHORIZED` |
| `ForbiddenError` | 403 | `FORBIDDEN` |
| `NotFoundError` | 404 | `NOT_FOUND` |
| `ConflictError` | 409 | `CONFLICT` |
| `UnprocessableEntityError` | 422 | `UNPROCESSABLE_ENTITY` |
| `TooManyRequestsError` | 429 | `TOO_MANY_REQUESTS` |
| `InternalServerError` | 500 | `INTERNAL_SERVER_ERROR` |
| `ServiceUnavailableError` | 503 | `SERVICE_UNAVAILABLE` |

Each class takes `(message: string, context?: Record<string, unknown>)` and calls `super(message, <statusCode>, '<CODE>', true, context)`.

`InternalServerError` must set `isOperational = false`.

Note: `http-api` projects use these classes for HTTP responses. Other project types (`mcp-server`, `worker`, `cli`, `library`) use the same classes but they represent logical error categories — the `statusCode` field is used for classification, not HTTP responses.

### src/errors/ValidationError.ts

```typescript
import type { ZodIssue } from 'zod';
import { AppError } from './AppError.js';

export class ValidationError extends AppError {
  public readonly issues: ZodIssue[];

  constructor(issues: ZodIssue[]) {
    super('Validation failed', 422, 'VALIDATION_ERROR', true);
    this.issues = issues;
  }
}
```

### src/errors/ExternalServiceError.ts — mcp-server, worker, http-api

For projects that call external APIs or services, add this class:

```typescript
import { AppError } from './AppError.js';

export class ExternalServiceError extends AppError {
  public readonly service: string;
  public readonly upstreamStatusCode?: number;

  constructor(
    service: string,
    message: string,
    upstreamStatusCode?: number,
    context?: Record<string, unknown>,
  ) {
    super(`${service}: ${message}`, 502, 'EXTERNAL_SERVICE_ERROR', true, context);
    this.service = service;
    this.upstreamStatusCode = upstreamStatusCode;
  }
}
```

Add `ExternalServiceError` to `src/errors/index.ts` for `mcp-server` and `worker` types. Omit for `library` and `cli` unless they call external services.

### src/errors/index.ts

Re-export all error classes from a single barrel file.

## Error Handler — by projectType

### http-api (Express) — src/middleware/error-handler.ts

```typescript
import type { ErrorRequestHandler } from 'express';
export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => { ... };
```

Must be the LAST middleware. Log only if `!err.isOperational || err.statusCode >= 500`.

### http-api (Fastify) — src/errors/fastify-error-handler.ts

```typescript
export function errorHandler(error: FastifyError | Error, request: FastifyRequest, reply: FastifyReply): void { ... }
```

Register with `fastify.setErrorHandler(errorHandler)` in `app.ts`.

### mcp-server — tool-level error handling

MCP tools must never throw unhandled errors — all errors are caught inside the tool handler and returned as `CallToolResult` with `isError: true`. The centralized pattern lives in `src/lib/tool-error-handler.ts`:

```typescript
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { AppError } from '../errors/index.js';
import { createLogger } from './logger.js';

const log = createLogger({ module: 'toolErrorHandler' });

export function handleToolError(err: unknown, toolName: string): CallToolResult {
  if (err instanceof AppError) {
    if (!err.isOperational) {
      log.error({ err, toolName }, 'Non-operational error in tool');
    }
    return {
      content: [{ type: 'text', text: `Error [${err.code}]: ${err.message}` }],
      isError: true,
    };
  }

  log.error({ err, toolName }, 'Unexpected error in tool');
  return {
    content: [{ type: 'text', text: 'An unexpected error occurred' }],
    isError: true,
  };
}
```

Every MCP tool handler wraps its body in `try/catch` and calls `handleToolError(err, toolName)` in the catch block — never re-throws.

### worker — job-level error handling

Workers catch errors per job handler and throw `AppError` subclasses. The queue library handles retries. `isOperational = false` errors must log and **not** retry.

### cli — command-level error handling

CLI commands catch errors in `.action()` callbacks, log via logger, and `process.exit(1)`. Never propagate to top-level unhandled rejection.

**`exactOptionalPropertyTypes` rule:** When `tsconfig.json` has `exactOptionalPropertyTypes: true` (required by this standard), you cannot write `this.optionalProp = maybeUndefined` — TypeScript treats `undefined` as an invalid assignment to an optional property declared as `prop?: T`. Use the guard pattern `if (value !== undefined) { this.prop = value; }` for every optional property set from a possibly-undefined parameter. Apply this same guard anywhere optional properties are assigned from optional parameters throughout the codebase.

## Determinism Rules
- `ExternalServiceError` must be the only error class that wraps upstream API errors — never re-use `InternalServerError` for external failures.
- Error class names must match the table exactly — no renames.
- `isOperational = false` errors trigger `process.exit(1)` after logging in `http-api` and `worker` production only.
- MCP tool handlers must NEVER re-throw — always return `isError: true` result.
