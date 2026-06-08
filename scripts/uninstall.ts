/**
 * Removes mcp-forge from Claude Desktop and Claude Code CLI.
 * Also removes /forge-* slash commands from ~/.claude/commands/.
 * Run with: npm run uninstall
 *
 * - Removes only the mcp-forge entry from each config
 * - Preserves all other MCP servers untouched
 * - Writes a .bak backup before modifying each file
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SERVER_KEY = 'mcp-forge';
const GLOBAL_COMMANDS_DIR = path.join(os.homedir(), '.claude', 'commands');

// ─── Config path helpers ──────────────────────────────────────────────────────

function getClaudeDesktopConfigPath(): string {
  switch (process.platform) {
    case 'darwin':
      return path.join(os.homedir(), 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json');
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

function getClaudeCodeConfigPath(): string {
  return path.join(os.homedir(), '.claude.json');
}

// ─── JSON helpers ─────────────────────────────────────────────────────────────

function readJson(filePath: string): Record<string, unknown> {
  if (!fs.existsSync(filePath)) return {};
  const raw = fs.readFileSync(filePath, 'utf-8').trim();
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    console.error(`\n  Config at ${filePath} is not valid JSON — please fix it manually.\n`);
    process.exit(1);
  }
}

function writeJson(filePath: string, data: Record<string, unknown>): void {
  const backupPath = filePath + '.bak';
  if (fs.existsSync(filePath)) fs.copyFileSync(filePath, backupPath);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
}

// ─── Removal ─────────────────────────────────────────────────────────────────

function deregister(configPath: string, label: string): void {
  if (!fs.existsSync(configPath)) {
    console.log(`\n  ${label}: config not found — nothing to remove.`);
    return;
  }

  const config = readJson(configPath);
  const mcpServers = config['mcpServers'] as Record<string, unknown> | undefined;

  if (!mcpServers || !(SERVER_KEY in mcpServers)) {
    console.log(`\n  ${label}: ${SERVER_KEY} not registered — nothing to remove.`);
    return;
  }

  delete mcpServers[SERVER_KEY];
  if (Object.keys(mcpServers).length === 0) delete config['mcpServers'];

  writeJson(configPath, config);
  console.log(`\n  Removed from ${label}`);
  console.log(`  Config: ${configPath}`);
}

function removeCommands(): void {
  if (!fs.existsSync(GLOBAL_COMMANDS_DIR)) {
    console.log(`\n  Slash commands: directory not found — nothing to remove.`);
    return;
  }

  const files = fs
    .readdirSync(GLOBAL_COMMANDS_DIR)
    .filter(f => f.startsWith('forge-') && f.endsWith('.md'));

  if (files.length === 0) {
    console.log(`\n  Slash commands: no /forge-* commands found — nothing to remove.`);
    return;
  }

  for (const file of files) {
    fs.unlinkSync(path.join(GLOBAL_COMMANDS_DIR, file));
  }

  console.log(`\n  Removed slash commands from: ${GLOBAL_COMMANDS_DIR}`);
  console.log(`  Removed: ${files.map(f => `/${f.replace('.md', '')}`).join('  ')}`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

function main(): void {
  deregister(getClaudeDesktopConfigPath(), 'Claude Desktop');
  deregister(getClaudeCodeConfigPath(),    'Claude Code   ');
  removeCommands();

  console.log('\n  Remaining manual steps:');
  console.log('    1. Restart Claude Desktop (if it is running)');
  console.log('    2. If you ran "npm link", unlink with:');
  console.log('         npm unlink -g mcp-forge');
  console.log('    3. Delete this folder:');
  console.log(`         ${ROOT}`);
  console.log();
}

main();
