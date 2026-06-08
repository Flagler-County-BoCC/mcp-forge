import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Point PROMPTS_DIR at the actual .claude/commands directory for integration tests.
// Unit tests mock the loadPrompt function instead.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
process.env['PROMPTS_DIR'] = path.resolve(__dirname, '../.claude/commands');
process.env['NODE_ENV'] = 'test';
process.env['LOG_LEVEL'] = 'silent';
