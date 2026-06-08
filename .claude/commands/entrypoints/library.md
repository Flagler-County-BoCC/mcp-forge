# Entrypoint — library

> This file is consumed by Step 8 of the rewrite process. Apply when `AUDIT_MANIFEST.projectType === "library"`.

## src/index.ts — Public Barrel

```typescript
// Export every public symbol. Nothing else.
export { <Feature> } from './modules/<feature>/<feature>.js';
export type { <FeatureOptions>, <FeatureResult> } from './modules/<feature>/<feature>.types.js';
// One export line per symbol in AUDIT_MANIFEST.exportedSymbols
```

Rules:
1. `src/index.ts` is the **only** public entry. Internal helpers are never re-exported.
2. Export types separately with `export type { ... }` — never mix value and type exports on one line.
3. No default export — named exports only.
4. Every symbol in `AUDIT_MANIFEST.exportedSymbols` must be re-exported here.

## Module Implementation Pattern

```typescript
// src/modules/<feature>/<feature>.ts
import type { LibraryLogger } from '../../lib/logger.js';
import { createLogger } from '../../lib/logger.js';
import type { <Feature>Options, <Feature>Result } from './<feature>.types.js';
import { <Feature>InputSchema } from './<feature>.schema.js';
import { validate } from '../../lib/validate.js';

export function <featureName>(
  input: unknown,
  options?: <Feature>Options & { logger?: LibraryLogger },
): <Feature>Result {
  const log = createLogger(options?.logger);
  const parsed = validate(<Feature>InputSchema, input);
  log.debug({ parsed }, '<featureName> called');
  // implementation
  return result;
}
```

Rules:
1. Every exported function validates its inputs with `validate()`.
2. Async functions return `Promise<T>` — never use callbacks.
3. Functions throw `AppError` subclasses on business-rule violations.
4. No global mutable state — no module-level variables that change after first import.
5. All configuration is passed as function parameters, not read from `process.env`.
6. Accept an optional `logger?: LibraryLogger` parameter and call `createLogger(logger)` at top of function.

## Determinism Rules
- `src/index.ts` is the only file consumers may import — verify no internal paths leak through re-exports.
- Libraries have no `server.ts`, `app.ts`, `stdio.ts`, or any process entry file.
