import { env } from './env.js';

export const config = {
  env: env.NODE_ENV,
  log: {
    level: env.LOG_LEVEL,
  },
  prompts: {
    dir: env.PROMPTS_DIR,
  },
} as const;

export type Config = typeof config;
