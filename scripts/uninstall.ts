/**
 * Removes mcp-forge from Claude Desktop's config file.
 * Run with: npm run uninstall
 *
 * - Detects config path per OS (macOS / Windows / Linux)
 * - Removes only the mcp-forge entry — all other servers are preserved
 * - Writes a .bak backup before modifying
 * - Prints remaining manual steps (npm unlink, delete folder)
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
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
    console.error(`\n  Config at ${configPath} is not valid JSON.`);
    console.error('  Please fix it manually.\n');
    process.exit(1);
  }
}

function main(): void {
  const configPath = getConfigPath();

  if (!fs.existsSync(configPath)) {
    console.log('\n  Claude Desktop config not found — nothing to remove.');
    printRemainingSteps();
    return;
  }

  const config = readConfig(configPath);
  const mcpServers = config['mcpServers'] as Record<string, unknown> | undefined;

  if (!mcpServers || !(SERVER_KEY in mcpServers)) {
    console.log(`\n  ${SERVER_KEY} is not registered in Claude Desktop — nothing to remove.`);
    printRemainingSteps();
    return;
  }

  // Backup before modifying
  const backupPath = configPath + '.bak';
  fs.copyFileSync(configPath, backupPath);

  // Remove the entry
  delete mcpServers[SERVER_KEY];

  // Clean up empty mcpServers key entirely
  if (Object.keys(mcpServers).length === 0) {
    delete config['mcpServers'];
  }

  fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n', 'utf-8');

  console.log(`\n  Removed ${SERVER_KEY} from Claude Desktop config.`);
  console.log(`  Config: ${configPath}`);
  console.log(`  Backup: ${backupPath}`);
  console.log('\n  Restart Claude Desktop to apply the change.');
  printRemainingSteps();
}

function printRemainingSteps(): void {
  console.log('\n  Remaining manual steps:');
  console.log('    1. Restart Claude Desktop (if it is running)');
  console.log('    2. If you ran "npm link", unlink with:');
  console.log('         npm unlink -g mcp-forge');
  console.log('    3. Delete this folder:');
  console.log(`         ${ROOT}`);
  console.log();
}

main();
