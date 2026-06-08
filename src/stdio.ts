import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createServer } from './server.js';
import { logger } from './lib/logger.js';
import { config } from './config/index.js';

process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down');
  process.exit(0);
});

process.on('unhandledRejection', (reason) => {
  logger.fatal({ reason }, 'Unhandled promise rejection');
  process.exit(1);
});

async function main(): Promise<void> {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.info(
    { env: config.env, promptsDir: config.prompts.dir },
    'mcp-forge started',
  );
}

void main().catch((err: unknown) => {
  logger.fatal({ err }, 'Fatal startup error');
  process.exit(1);
});
