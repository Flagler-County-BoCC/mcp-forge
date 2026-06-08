import { z } from 'zod';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// When compiled: dist/config/env.js → ../.. → project root → .claude/commands
const DEFAULT_PROMPTS_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../.claude/commands',
);

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.string().default('info'),
  PROMPTS_DIR: z.string().default(DEFAULT_PROMPTS_DIR),
});

let env: z.infer<typeof envSchema>;
try {
  env = envSchema.parse(process.env);
} catch (err) {
  console.error(
    'Environment validation failed:',
    err instanceof Error ? err.message : String(err),
  );
  process.exit(1);
}

export { env };
export type Env = typeof env;
