/**
 * Registers mcp-forge in Claude Desktop's config file.
 * Run with: npm run setup
 *
 * - Detects config path per OS (macOS / Windows / Linux)
 * - Merges the entry non-destructively (preserves other MCP servers)
 * - Creates the config file if it doesn't exist yet
 * - Requires dist/stdio.js to be built first
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BINARY = path.join(ROOT, 'dist', 'stdio.js');
const SERVER_KEY = 'mcp-forge';

function getConfigPath(): string {
  switch (process.platform) {
    case 'darwin':
      return path.join(
        os.homedir(),
        'Library',
        'Application Support',
        'Claude',
        'claude_desktop_config.json',
      );
    case 'win32':
      return path.join(
        process.env['APPDATA'] ?? path.join(os.homedir(), 'AppData', 'Roaming'),
        'Claude',
        'claude_desktop_config.json',
      );
    default:
      return path.join(os.homedir(), '.config', 'Claude', 'claude_desktop_config.json');
  }
}

function readConfig(configPath: string): Record<string, unknown> {
  if (!fs.existsSync(configPath)) return {};
  const raw = fs.readFileSync(configPath, 'utf-8').trim();
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    console.error(`\nExisting config at ${configPath} is not valid JSON.`);
    console.error('Please fix it manually before running setup.\n');
    process.exit(1);
  }
}

function printManualInstructions(): void {
  console.log('\nAdd this to your MCP client config manually:\n');
  console.log(
    JSON.stringify(
      { mcpServers: { [SERVER_KEY]: { command: 'node', args: [BINARY] } } },
      null,
      2,
    ),
  );
  console.log();
}

function main(): void {
  // Must be built before setup
  if (!fs.existsSync(BINARY)) {
    console.error('\n  Build not found. Run this first:\n');
    console.error('    npm run build\n');
    console.error('  Then re-run:\n');
    console.error('    npm run setup\n');
    process.exit(1);
  }

  const configPath = getConfigPath();
  const configDir = path.dirname(configPath);

  // If the Claude config directory doesn't exist, Claude Desktop may not be installed
  if (!fs.existsSync(configDir)) {
    console.warn('\n  Claude Desktop config directory not found:');
    console.warn(`  ${configDir}\n`);
    console.warn('  Claude Desktop may not be installed, or its config is in a custom location.');
    printManualInstructions();
    process.exit(0);
  }

  const config = readConfig(configPath);
  const mcpServers = (config['mcpServers'] as Record<string, unknown> | undefined) ?? {};
  const isUpdate = SERVER_KEY in mcpServers;

  mcpServers[SERVER_KEY] = { command: 'node', args: [BINARY] };
  config['mcpServers'] = mcpServers;

  fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n', 'utf-8');

  const action = isUpdate ? 'Updated' : 'Registered';
  console.log(`\n  ${action} ${SERVER_KEY} in Claude Desktop config.`);
  console.log(`  Config: ${configPath}`);
  console.log(`  Binary: ${BINARY}`);
  console.log('\n  Restart Claude Desktop to apply the change.\n');
}

main();
