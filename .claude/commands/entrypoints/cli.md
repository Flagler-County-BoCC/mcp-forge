# Entrypoint — cli

> This file is consumed by Step 8 of the rewrite process. Apply when `AUDIT_MANIFEST.projectType === "cli"`.

## src/index.ts — CLI Entry

```typescript
#!/usr/bin/env node
import { program } from 'commander';
import { register<Command>Command } from './commands/<command-name>/<command-name>.command.js';

program
  .name('<projectName>')
  .description('<one-line description from package.json>')
  .version(process.env['npm_package_version'] ?? '0.0.0');

// Register each command from AUDIT_MANIFEST.cliCommands
register<Command>Command(program);

program.parseAsync(process.argv).catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
```

The shebang `#!/usr/bin/env node` must be the literal first line of the compiled `dist/index.js`.

## src/commands/<command-name>/<command-name>.command.ts

```typescript
import type { Command } from 'commander';
import { validate } from '../../lib/validate.js';
import { <Command>OptionsSchema } from './<command-name>.options.js';
import { <command>Service } from '../../lib/container.js';
import { logger } from '../../lib/logger.js';

export function register<Command>Command(program: Command): void {
  program
    .command('<command-name>')
    .description('<description>')
    .option('--<flag>', '<description>')
    .argument('<arg>', '<description>')
    .action(async (arg: unknown, opts: unknown) => {
      const options = validate(<Command>OptionsSchema, { arg, ...opts });
      try {
        const result = await <command>Service.<method>(options);
        console.log(JSON.stringify(result, null, 2));
      } catch (error) {
        logger.error({ err: error }, 'Command failed');
        process.exit(1);
      }
    });
}
```

Rules:
1. One file per command; one `register<X>Command` function per file.
2. `console.log` is **only** permitted in command handler `.action()` callbacks — nowhere else in `src/`.
3. Exit codes: `0` = success, `1` = error, `2` = misuse (bad arguments — Commander handles this).
4. Never `process.exit()` outside of command `.action()` handlers and the top-level catch.
5. Validate all CLI arguments and options with `validate()`.

## src/commands/<command-name>/<command-name>.options.ts

```typescript
import { z } from 'zod';

export const <Command>OptionsSchema = z.object({
  // one field per CLI flag/argument
});

export type <Command>Options = z.infer<typeof <Command>OptionsSchema>;
```

## Determinism Rules
- Every command from `AUDIT_MANIFEST.cliCommands` must be registered in `src/index.ts`.
- No orphan command files — every command file must have a corresponding `register*` call.
- CLI projects have no `server.ts`, `app.ts`, or `stdio.ts`.
