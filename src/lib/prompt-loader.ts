import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config/index.js';
import { NotFoundError } from '../errors/index.js';
import { createLogger } from './logger.js';

const log = createLogger({ module: 'promptLoader' });

export async function loadPrompt(relativePath: string): Promise<string> {
  const fullPath = path.resolve(config.prompts.dir, relativePath);
  log.debug({ path: fullPath }, 'Loading prompt file');
  try {
    return await fs.readFile(fullPath, 'utf-8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new NotFoundError(`Prompt file not found: ${relativePath}`, { path: fullPath });
    }
    throw err;
  }
}

export type PromptLoader = typeof loadPrompt;
