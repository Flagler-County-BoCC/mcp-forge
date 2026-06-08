# Step 5 — Input/Output Validation with Zod

## Prerequisites
- Steps 0–4 applied.
- Error classes from Step 4 available.

## Objective
Every module's public inputs must be validated with zod schemas. No unvalidated data may enter a service, tool handler, job handler, or command handler.

## Rules — all project types

### Schema File Conventions

Schema files live alongside the module they describe (`<domain>.schema.ts`, `<module>.schema.ts`, `<command>.options.ts`).

1. Name every schema with a `Schema` suffix: `CreateUserSchema`, `ServiceQuerySchema`, `ListTicketsSchema`.
2. Infer TypeScript types from schemas using `z.infer<typeof XxxSchema>` — never define a type manually if it duplicates a schema.
3. Use these field-level rules consistently:
   - String IDs: `z.string().uuid()` (UUID) or `z.string().cuid()` (CUID) — never bare `z.string()` for ID fields.
   - Emails: `z.string().email()`.
   - Dates from external sources: `z.coerce.date()`.
   - Enums: `z.enum([...])` with a `const` values array, never inline string literals.
   - Optional fields: `z.string().optional()` — never `z.union([z.string(), z.undefined()])`.
   - Nullable fields: `z.string().nullable()` — never `z.union([z.string(), z.null()])`.
   - Integers from env/CLI: `z.coerce.number().int()`.
   - Booleans from env/CLI: `z.coerce.boolean()`.
   - JSON-valued strings: `z.string().transform((s) => JSON.parse(s) as unknown)`.

### src/lib/validate.ts — Validation Helper

```typescript
import { type ZodSchema } from 'zod';
import { ValidationError } from '../errors/index.js';

export function validate<T>(schema: ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new ValidationError(result.error.issues);
  }
  return result.data;
}
```

All code must use `validate()` — never call `.parse()` or `.safeParse()` directly outside this helper.

## Response Helpers — http-api only

`src/lib/response.ts`:

```typescript
export function ok<T>(data: T) { return { success: true as const, data }; }
export function created<T>(data: T) { return { success: true as const, data }; }
export function paginated<T>(data: T[], total: number, page: number, limit: number) {
  return { success: true as const, data, meta: { total, page, limit } };
}
```

HTTP controllers use these helpers. Other project types do not need them.

## mcp-server: Tool Input Schemas

MCP tool schemas must also be compatible with the MCP SDK's tool registration, which accepts a zod schema directly:

```typescript
import { z } from 'zod';

export const ListTicketsSchema = z.object({
  board:       z.string().optional(),
  status:      z.string().optional(),
  page:        z.coerce.number().int().min(1).default(1),
  pageSize:    z.coerce.number().int().min(1).max(100).default(50),
});

export type ListTicketsInput = z.infer<typeof ListTicketsSchema>;
```

Rules for MCP tool schemas:
1. Every tool input schema must be a `z.object({...})` — never a primitive or union at the top level.
2. All numeric fields from tool inputs use `z.coerce.number()` — MCP clients may pass strings.
3. All boolean fields use `z.coerce.boolean()`.
4. Optional fields get sensible defaults (`.default(...)`) rather than being left truly optional, to improve the tool's usability by AI callers.

## Determinism Rules
- Schema files may not import from service or repository files — schemas are leaf-level modules.
- Never use `z.any()` or `z.unknown()` in domain/tool schemas (only permitted in `validate()` helper signature).
- For `http-api`: every entity field must appear in either an input or output schema.
- For `mcp-server`: every tool in `AUDIT_MANIFEST.mcpTools` must have a corresponding schema.
