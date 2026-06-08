import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { stepsService, manifestService } from './lib/container.js';
import { registerStepsTools } from './tools/steps/steps.tool.js';
import { registerManifestTools } from './tools/manifest/manifest.tool.js';

export function createServer(): McpServer {
  const server = new McpServer({
    name: 'mcp-forge',
    version: process.env['npm_package_version'] ?? '1.0.0',
  });

  registerStepsTools(server, stepsService);
  registerManifestTools(server, manifestService);

  // NEVER calls server.connect() — stdio.ts is the sole entry point
  return server;
}
