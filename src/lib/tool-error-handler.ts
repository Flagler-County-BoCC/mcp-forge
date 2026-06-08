import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { AppError } from '../errors/index.js';
import { createLogger } from './logger.js';

const log = createLogger({ module: 'toolErrorHandler' });

export function handleToolError(err: unknown, toolName: string): CallToolResult {
  if (err instanceof AppError) {
    const logFn = err.isOperational ? log.warn.bind(log) : log.error.bind(log);
    logFn({ err, toolName }, 'Tool returned operational error');
    return {
      content: [{ type: 'text' as const, text: `Error [${err.code}]: ${err.message}` }],
      isError: true,
    };
  }
  log.error({ err, toolName }, 'Unexpected error in tool handler');
  return {
    content: [{ type: 'text' as const, text: 'An unexpected error occurred.' }],
    isError: true,
  };
}
