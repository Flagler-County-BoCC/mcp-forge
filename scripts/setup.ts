/**
 * Registers mcp-forge in Claude Desktop and Claude Code (CLI).
 * Run with: npm run setup
 *
 * Claude Desktop: detects config path per OS, merges entry non-destructively
 * Claude Code:    writes to ~/.claude/settings.json
 *
 * Both operations write a .bak backup before modifying.
 * Requires dist/stdio.js to be built first (handled by `npm run setup`).
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BINARY = path.join(ROOT, 'dist', 'stdio.js');
const SERVER_KEY = 'mcp-forge';
const SERVER_ENTRY = { command: 'node', args: [BINARY] };

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
  return path.join(os.homedir(), '.claude', 'settings.json');
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
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
}

// ─── Registration ─────────────────────────────────────────────────────────────

function register(configPath: string, label: string): void {
  const configDir = path.dirname(configPath);

  // For Claude Desktop, warn if the app doesn't appear to be installed
  const isDesktop = configPath.includes('Claude') && configPath.endsWith('claude_desktop_config.json');
  if (isDesktop && !fs.existsSync(configDir)) {
    console.warn(`\n  ${label}: config directory not found — Claude Desktop may not be installed.`);
    console.warn(`  Expected: ${configPath}`);
    return;
  }

  const config = readJson(configPath);
  const mcpServers = (config['mcpServers'] as Record<string, unknown> | undefined) ?? {};
  const isUpdate = SERVER_KEY in mcpServers;

  mcpServers[SERVER_KEY] = SERVER_ENTRY;
  config['mcpServers'] = mcpServers;

  writeJson(configPath, config);

  const action = isUpdate ? 'Updated' : 'Registered';
  console.log(`\n  ${action} in ${label}`);
  console.log(`  Config: ${configPath}`);
  console.log(`  Binary: ${BINARY}`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

function main(): void {
  if (!fs.existsSync(BINARY)) {
    console.error('\n  Build not found. Run this first:\n');
    console.error('    npm run build\n');
    console.error('  Then re-run:\n');
    console.error('    npm run setup\n');
    process.exit(1);
  }

  register(getClaudeDesktopConfigPath(), 'Claude Desktop');
  register(getClaudeCodeConfigPath(),    'Claude Code   ');

  console.log('\n  Restart Claude Desktop to apply the change.');
  console.log('  Claude Code picks up the change automatically.\n');
}

main();
