# Step 13 — Finalize: Lint, Format, Audit & Checklist

## Prerequisites
- Steps 0–12 applied.

## Objective
Apply the ESLint flat config, run a final consistency pass across all generated files, and produce a completion checklist tailored to the project type.

## ESLint Flat Config — eslint.config.mjs

```javascript
import eslint from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import prettier from 'eslint-config-prettier';

export default [
  eslint.configs.recommended,
  {
    files: ['src/**/*.ts', 'tests/**/*.ts'],
    languageOptions: {
      parser: tsparser,
      parserOptions: { project: './tsconfig.json', ecmaVersion: 2022, sourceType: 'module' },
    },
    plugins: { '@typescript-eslint': tseslint },
    rules: {
      ...tseslint.configs['recommended-type-checked'].rules,
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/explicit-function-return-type': ['warn', { allowExpressions: true }],
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/await-thenable': 'error',
      'no-console': 'error',
      'no-debugger': 'error',
      'no-eval': 'error',
      'eqeqeq': ['error', 'always'],
      'curly': ['error', 'all'],
    },
  },
  {
    // Relax rules for test files
    files: ['**/*.spec.ts', '**/*.test.ts', 'tests/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
    },
  },
  {
    // Allow console.log in CLI action handlers
    files: ['src/commands/**/*.command.ts'],
    rules: { 'no-console': 'off' },
  },
  { ignores: ['dist/', 'coverage/', 'node_modules/'] },
  prettier,
];
```

Add to `devDependencies`: `@eslint/js ^9.0.0`, `eslint-config-prettier ^9.1.0`.

## Final Consistency Checklist

Output as markdown checkboxes — mark `[x]` if satisfied or `[ ]` with a one-line note if not.

### Structure (all types)
- [ ] Directory layout matches the layout for this `projectType` in `shared/01-structure.md`
- [ ] `src/lib/container.ts` wires all dependencies
- [ ] No cross-layer imports (controllers/tools/handlers don't import repositories directly)

### Structure (http-api only)
- [ ] `src/app.ts` exports `createApp()` and does NOT call `listen()`
- [ ] `src/server.ts` is the only file calling `listen()`

### Structure (mcp-server only)
- [ ] `src/server.ts` exports `createServer()` and does NOT call `server.connect()`
- [ ] `src/stdio.ts` is the only file calling `server.connect()`
- [ ] Every tool in `AUDIT_MANIFEST.mcpTools` has a `server.tool()` registration
- [ ] `src/lib/tool-error-handler.ts` exists and is used by all tool handlers

### Config & Secrets (all except library)
- [ ] No string literal secrets in any `src/` file
- [ ] All env vars validated in `src/config/env.ts`
- [ ] `.env.example` lists every env var
- [ ] `.env` and `.env.local` are in `.gitignore`
- [ ] JSON-valued env vars use `.transform((s) => JSON.parse(s))` in zod schema

### Logging (all types)
- [ ] No `console.log` or `console.error` in `src/` except: config startup failure, CLI `.action()` handlers
- [ ] `logger` is `silent` in test environment
- [ ] All log calls use child loggers with `{ module: '...' }`
- [ ] Sensitive fields (`priv`, `secret`, `token`, etc.) are in the redact list

### Errors (all types)
- [ ] All `catch` blocks re-throw an `AppError` subclass or call `handleToolError` (mcp-server)
- [ ] No errors swallowed silently
- [ ] `ExternalServiceError` used for all upstream API failures (mcp-server, worker, http-api)

### Validation (all types)
- [ ] Every tool/controller/handler validates inputs with `validate()` before calling service
- [ ] No `z.any()` in domain/tool schemas
- [ ] MCP tool schemas use `z.coerce.number()` and `z.coerce.boolean()` for all numeric/boolean fields

### Testing (all types)
- [ ] Every entry in `AUDIT_MANIFEST.mcpTools` / `publicApiRoutes` / `cliCommands` has at least one test
- [ ] Coverage thresholds are set (80% lines/functions)
- [ ] Unit tests use `vi.fn()` mocks — no real network calls or DB connections

### Security (all types)
- [ ] No `eval()` or `new Function()` anywhere
- [ ] Sensitive vars in `.gitignore`
- [ ] `npm audit` passes at `--audit-level=high`

### Security (http-api only)
- [ ] `helmet()` applied in `app.ts`
- [ ] Rate limiting applied globally and on auth routes

### Docker & CI (http-api, worker, mcp-server)
- [ ] Dockerfile uses non-root user
- [ ] `.dockerignore` excludes `.env` files
- [ ] CI runs lint, typecheck, tests on every PR
- [ ] `concurrency.cancel-in-progress: true` in CI workflow

### Dependencies (all types)
- [ ] No `"*"` or `"latest"` version specifiers
- [ ] All packages from `shared/01-structure.md` standards list present at correct minimum versions

## Determinism Rules
- Output the checklist with every item evaluated — never partially complete it.
- Skip checklist sections that do not apply to the detected `projectType`.
- Items marked `[ ]` must include a one-line note explaining what was found.
