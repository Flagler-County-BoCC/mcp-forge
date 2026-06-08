# Step 6 — Data-Access Layer (Repository Pattern)

## Prerequisites
- Steps 0–5 applied.
- `detectedOrm` from AUDIT_MANIFEST known.

## Project Type Gate

**If `projectType === "library"`:** Skip unless the library directly reads/writes a database (rare). Most libraries receive data as function arguments.

**If `projectType === "mcp-server"` AND no database dependency detected:** Skip. Replace with `src/lib/http-client.ts` — the external API client is the data access layer (see Step 8 entrypoint file).

**If `projectType === "mcp-server"` AND a database IS detected:** Apply this step in addition to the HTTP client from Step 8.

**All other types with a database:** Apply all rules below.

## Objective
Wrap all database access in a repository layer. No SQL query, ORM call, or database client reference may appear outside of a `*.repository.ts` file.

## Repository Interface Convention

Each repository must implement an interface defined in `<domain>.types.ts`:

```typescript
export interface I<Domain>Repository {
  findById(id: string): Promise<<Domain> | null>;
  findMany(filter: <Domain>Filter): Promise<{ items: <Domain>[]; total: number }>;
  create(data: Create<Domain>Input): Promise<<Domain>>;
  update(id: string, data: Update<Domain>Input): Promise<<Domain>>;
  delete(id: string): Promise<void>;
}
```

Implement only the methods the domain actually needs.

### Repository Class Structure

```typescript
export class <Domain>Repository implements I<Domain>Repository {
  private readonly log = createLogger({ module: '<domain>Repository' });

  constructor(private readonly db: <DbClientType>) {}

  async findById(id: string): Promise<<Domain> | null> {
    try {
      // ORM/query call here
    } catch (error) {
      this.log.error({ err: error, id }, 'findById failed');
      throw new InternalServerError('Database operation failed');
    }
  }
}
```

Rules:
1. Constructor takes the DB client via DI — never import `db` directly inside a repository.
2. Every method wraps its DB call in try/catch; on error log and throw `InternalServerError`.
3. `findById` returns `null` (not throws) when the record does not exist.
4. Return domain objects (typed), not raw ORM objects.

### If detectedOrm === "prisma"

- `db` type is `PrismaClient`.
- Use `prisma.$transaction([...])` for multi-step operations.
- Never use `prisma.$queryRaw` unless no typed API alternative exists.
- All `findMany` calls must include explicit `take` (limit) and `skip` (offset) with hard maximum of 1000.

### If detectedOrm === "knex"

- `db` type is `Knex`. Use `.returning('*')` on inserts/updates.
- Wrap multi-step operations in `db.transaction(async (trx) => { ... })`.

### If detectedOrm === "none"

- Use the `pg` package with a connection pool.
- Parameterized queries only — no string concatenation into SQL.
- Export a `pool: Pool` singleton from `src/lib/db.ts`.

### src/lib/db.ts — DB Client Singleton

```typescript
// Prisma: export const prisma = new PrismaClient({ log: [...] });
// Knex:   export const db = knex({ client: 'pg', connection: config.db.url, ... });
// pg:     export const pool = new Pool({ connectionString: config.db.url, max: 10 });
```

Connection pool `max` defaults to 10. Log DB query events only when `config.env !== 'production'`.

## Determinism Rules
- Repository methods may NOT call other repositories.
- One repository per domain module — no shared/generic repository base class.
- Pagination (`page`, `limit`) is resolved to `skip`/`take` inside the repository, not the service.
- Soft-delete fields (`deletedAt`, `isDeleted`) are filtered at the repository level.
