/**
 * Registers mcp-forge in Claude Desktop and Claude Code CLI.
 * Also installs /forge-* slash commands globally to ~/.claude/commands/.
 * Run with: npm run setup
 *
 * Claude Desktop — per-OS config file (claude_desktop_config.json)
 * Claude Code    — ~/.claude.json, mcpServers key, type: "stdio"
 *                  ~/.claude/commands/ — global slash commands (available in every project)
 *
 * Both config operations write a .bak backup before modifying.
 * Requires dist/stdio.js to be built first (handled by `npm run setup`).
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BINARY = path.join(ROOT, 'dist', 'stdio.js');
const SERVER_KEY = 'mcp-forge';
const TEMPLATES_DIR = path.join(ROOT, 'templates', '.claude', 'commands');
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
  // Claude Code reads MCP servers from ~/.claude.json (not ~/.claude/settings.json)
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
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
}

// ─── Registration ─────────────────────────────────────────────────────────────

function registerDesktop(configPath: string): void {
  const configDir = path.dirname(configPath);
  if (!fs.existsSync(configDir)) {
    console.warn(`\n  Claude Desktop: config directory not found — may not be installed.`);
    console.warn(`  Expected: ${configPath}`);
    return;
  }

  const config = readJson(configPath);
  const mcpServers = (config['mcpServers'] as Record<string, unknown> | undefined) ?? {};
  const isUpdate = SERVER_KEY in mcpServers;

  mcpServers[SERVER_KEY] = { command: 'node', args: [BINARY] };
  config['mcpServers'] = mcpServers;
  writeJson(configPath, config);

  console.log(`\n  ${isUpdate ? 'Updated' : 'Registered'} in Claude Desktop`);
  console.log(`  Config: ${configPath}`);
}

function registerClaudeCode(configPath: string): void {
  const config = readJson(configPath);
  const mcpServers = (config['mcpServers'] as Record<string, unknown> | undefined) ?? {};
  const isUpdate = SERVER_KEY in mcpServers;

  // Claude Code requires type: "stdio" for local process servers
  mcpServers[SERVER_KEY] = { type: 'stdio', command: 'node', args: [BINARY] };
  config['mcpServers'] = mcpServers;
  writeJson(configPath, config);

  console.log(`\n  ${isUpdate ? 'Updated' : 'Registered'} in Claude Code`);
  console.log(`  Config: ${configPath}`);
}

function installCommands(): void {
  if (!fs.existsSync(TEMPLATES_DIR)) {
    console.warn(`\n  Slash commands: templates directory not found — skipping.`);
    console.warn(`  Expected: ${TEMPLATES_DIR}`);
    return;
  }

  fs.mkdirSync(GLOBAL_COMMANDS_DIR, { recursive: true });

  const files = fs
    .readdirSync(TEMPLATES_DIR)
    .filter(f => f.startsWith('forge-') && f.endsWith('.md'));

  const installed: string[] = [];
  const updated: string[] = [];

  for (const file of files) {
    const src = path.join(TEMPLATES_DIR, file);
    const dest = path.join(GLOBAL_COMMANDS_DIR, file);
    const isUpdate = fs.existsSync(dest);
    fs.copyFileSync(src, dest);
    (isUpdate ? updated : installed).push(file.replace('.md', ''));
  }

  console.log(`\n  Slash commands installed to: ${GLOBAL_COMMANDS_DIR}`);
  if (installed.length) console.log(`  Installed: ${installed.map(f => `/${f}`).join('  ')}`);
  if (updated.length)   console.log(`  Updated:   ${updated.map(f => `/${f}`).join('  ')}`);
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

  registerDesktop(getClaudeDesktopConfigPath());
  registerClaudeCode(getClaudeCodeConfigPath());
  installCommands();

  console.log(`\n  Binary: ${BINARY}`);
  console.log('\n  Restart Claude Desktop to apply the change.');
  console.log('  Claude Code picks up the change automatically.\n');
}

main();
