# Step 9 — Test Suite

## Prerequisites
- Steps 0–8 applied.

## Objective
Generate a complete test suite appropriate to the project type. Tests must be deterministic and isolated — no shared mutable state between test cases.

## vitest.config.ts — all types

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      thresholds: { lines: 80, functions: 80, branches: 75, statements: 80 },
      include: ['src/**/*.ts'],
      exclude: [
        'src/server.ts',    // http-api
        'src/stdio.ts',     // mcp-server
        'src/worker.ts',    // worker
        'src/index.ts',     // cli/library barrel
        'src/**/*.types.ts',
        'src/**/*.schema.ts',
      ],
    },
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
  },
});
```

## tests/setup.ts — all types

```typescript
import { config } from 'dotenv';
config({ path: '.env.test' });

import { afterEach, vi } from 'vitest';
afterEach(() => { vi.restoreAllMocks(); });
```

---

## Unit Test Convention — by projectType

### http-api, worker — src/modules/<domain>/__tests__/<domain>.service.spec.ts

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { <Domain>Service } from '../<domain>.service.js';
import type { I<Domain>Repository } from '../<domain>.types.js';

const mockRepo: I<Domain>Repository = {
  findById: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(),
};

describe('<Domain>Service', () => {
  let service: <Domain>Service;
  beforeEach(() => { service = new <Domain>Service(mockRepo); });

  describe('get<Domain>ById', () => {
    it('returns the item when found', async () => {
      vi.mocked(mockRepo.findById).mockResolvedValueOnce({ id: 'test-uuid-0001' });
      const result = await service.get<Domain>ById('test-uuid-0001');
      expect(result).toMatchObject({ id: 'test-uuid-0001' });
    });

    it('throws NotFoundError when not found', async () => {
      vi.mocked(mockRepo.findById).mockResolvedValueOnce(null);
      await expect(service.get<Domain>ById('test-uuid-9999'))
        .rejects.toMatchObject({ code: 'NOT_FOUND', statusCode: 404 });
    });
  });
});
```

### mcp-server — src/tools/<module>/__tests__/<module>.tool.spec.ts

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { register<Module>Tools } from '../<module>.tool.js';
import { <module>Service } from '../../../lib/container.js';

vi.mock('../../../lib/container.js');

describe('<module> MCP tools', () => {
  let server: McpServer;

  beforeEach(() => {
    server = new McpServer({ name: 'test-server', version: '0.0.0' });
    register<Module>Tools(server);
  });

  describe('<prefix>-list-<module>', () => {
    it('returns formatted JSON on success', async () => {
      vi.mocked(<module>Service.list<Module>).mockResolvedValueOnce([{ id: 'test-item-0001' }]);
      const result = await server.callTool('<prefix>-list-<module>', {});
      expect(result.isError).toBeFalsy();
      expect(result.content[0]).toMatchObject({ type: 'text' });
      const parsed = JSON.parse((result.content[0] as { text: string }).text);
      expect(parsed).toEqual(expect.arrayContaining([expect.objectContaining({ id: 'test-item-0001' })]));
    });

    it('returns isError:true on ExternalServiceError', async () => {
      vi.mocked(<module>Service.list<Module>).mockRejectedValueOnce(
        new ExternalServiceError('ExternalAPI', 'Unauthorized', 401)
      );
      const result = await server.callTool('<prefix>-list-<module>', {});
      expect(result.isError).toBe(true);
      expect((result.content[0] as { text: string }).text).toMatch(/EXTERNAL_SERVICE_ERROR/);
    });
  });
});
```

### library — src/modules/<feature>/__tests__/<feature>.spec.ts

```typescript
import { describe, it, expect } from 'vitest';
import { <featureName> } from '../<feature>.js';

describe('<featureName>', () => {
  it('returns expected output for valid input', () => {
    const result = <featureName>({ /* valid input */ });
    expect(result).toMatchObject({ /* expected shape */ });
  });

  it('throws ValidationError for invalid input', () => {
    expect(() => <featureName>(null))
      .toThrow(expect.objectContaining({ code: 'VALIDATION_ERROR' }));
  });
});
```

### cli — src/commands/<command>/__tests__/<command>.spec.ts

```typescript
import { describe, it, expect, vi } from 'vitest';
import { Command } from 'commander';
import { register<Command>Command } from '../<command-name>.command.js';
import { <command>Service } from '../../../lib/container.js';

vi.mock('../../../lib/container.js');

describe('<command-name> command', () => {
  it('calls service with validated options', async () => {
    vi.mocked(<command>Service.<method>).mockResolvedValueOnce({ result: 'ok' });
    const program = new Command();
    register<Command>Command(program);
    await program.parseAsync(['node', 'test', '<command-name>', '--flag', 'value']);
    expect(<command>Service.<method>).toHaveBeenCalledWith(
      expect.objectContaining({ flag: 'value' })
    );
  });
});
```

---

## Integration Test Convention — by projectType

### http-api — tests/integration/<domain>.test.ts

```typescript
import { describe, it, expect } from 'vitest';
import supertest from 'supertest';
import { createApp } from '../../src/app.js';

const app = createApp();

describe('GET /api/v1/<domain>/:id', () => {
  it('returns 200 with valid id', async () => {
    const res = await supertest(app).get('/api/v1/<domain>/test-uuid-0001').expect(200);
    expect(res.body).toMatchObject({ success: true });
  });
  it('returns 404 for unknown id', async () => {
    const res = await supertest(app).get('/api/v1/<domain>/test-uuid-9999').expect(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
  it('returns 422 for invalid id format', async () => {
    const res = await supertest(app).get('/api/v1/<domain>/not-a-uuid').expect(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});
```

### mcp-server — tests/integration/<module>.tool.test.ts

```typescript
import { describe, it, expect, beforeAll } from 'vitest';
import { createServer } from '../../src/server.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

// Integration tests call tools on a real McpServer instance.
// Services hit the real external API only if SPEC_PATH and CW_* vars are set in .env.test.
// Otherwise, mock the container (see unit tests).

describe('<module> tool integration', () => {
  let server: McpServer;

  beforeAll(() => {
    server = createServer();
  });

  it('server registers tools without throwing', () => {
    expect(server).toBeDefined();
  });

  it('<prefix>-list-<module> returns valid structure for empty filter', async () => {
    const result = await server.callTool('<prefix>-list-<module>', {});
    // Content is text regardless of success/error
    expect(result.content).toHaveLength(1);
    expect(result.content[0]).toMatchObject({ type: 'text' });
  });
});
```

### library — tests/integration/<feature>.test.ts

Import only from `src/index.ts`. If the library calls external services, use `.env.test` credentials.

### cli — tests/integration/<command>.test.ts

```typescript
import { describe, it, expect, beforeAll } from 'vitest';
import { execa } from 'execa';

// Requires a prior `npm run build`
describe('<command-name> integration', () => {
  it('exits 0 for valid args', async () => {
    const { exitCode } = await execa('node', ['dist/index.js', '<command-name>', '--help']);
    expect(exitCode).toBe(0);
  });
  it('exits 1 for missing required arg', async () => {
    const { exitCode } = await execa('node', ['dist/index.js', '<command-name>'], { reject: false });
    expect(exitCode).toBe(1);
  });
});
```

---

## Minimum Required Test Cases — by projectType

**http-api:** per route — happy path, 404 (for `:id` params), 422 (body/params), one business-rule error.

**mcp-server:** per tool — success (valid input), `isError:true` on `ExternalServiceError`, `isError:true` on `ValidationError`, write-gate response for mutating tools (if applicable).

**library:** per exported function — happy path, `ValidationError` for invalid input, one edge case.

**cli:** per command — success exit 0, failure exit 1, missing required arg.

**worker:** per handler — valid payload, `ValidationError` for invalid payload, idempotency check.

## Determinism Rules
- Test IDs use fixed strings: `'test-<entity>-0001'`, `'test-<entity>-0002'`, etc.
- No `setTimeout` or `sleep` in tests.
- Tests must pass in any order and in parallel (`pool: 'forks'`).
- Never `console.log` in tests — logging is silenced by `NODE_ENV=test`.
- Mock only at the service/container boundary — never mock `AppError` classes or `validate()`.
