import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { handleToolError } from '../../lib/tool-error-handler.js';
import type { ManifestService } from './manifest.service.js';
import { ValidateManifestInputSchema } from './manifest.schema.js';

export function registerManifestTools(server: McpServer, manifestService: ManifestService): void {
  server.tool(
    'validate_manifest',
    'Validate an AUDIT_MANIFEST JSON string against the expected schema (produced by Step 0). Returns a list of validation errors, or confirms the manifest is valid.',
    ValidateManifestInputSchema.shape,
    async ({ manifestJson }): Promise<CallToolResult> => {
      try {
        const result = manifestService.validate(manifestJson);
        const text = result.valid
          ? 'AUDIT_MANIFEST is valid.'
          : `AUDIT_MANIFEST has ${result.errors.length} validation error(s):\n${result.errors.map((e) => `  • ${e}`).join('\n')}`;
        return {
          content: [{ type: 'text' as const, text }],
          isError: !result.valid,
        };
      } catch (err) {
        return handleToolError(err, 'validate_manifest');
      }
    },
  );
}
