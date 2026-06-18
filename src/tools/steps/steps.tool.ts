import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { handleToolError } from '../../lib/tool-error-handler.js';
import type { StepsService } from './steps.service.js';
import {
  GetStepSchema,
  ListStepsSchema,
  GetEntrypointSchema,
  ProjectTypeSchema,
} from './steps.schema.js';

export function registerStepsTools(server: McpServer, stepsService: StepsService): void {
  server.tool(
    'list_steps',
    'List all rewrite steps (0–14) in order. Optionally filter by projectType to see which steps apply or are skipped.',
    ListStepsSchema.shape,
    ({ projectType }): CallToolResult => {
      try {
        const parsed = projectType ? ProjectTypeSchema.parse(projectType) : undefined;
        const steps = stepsService.listSteps(parsed);
        const lines = steps.map((s) => {
          const applies =
            s.appliesToCurrentType === null
              ? ''
              : s.appliesToCurrentType
                ? ' [APPLIES]'
                : ' [SKIP]';
          const notes = s.notes ? `\n     note: ${s.notes}` : '';
          return `Step ${String(s.step).padStart(2, '0')} — ${s.title}${applies}\n     ${s.description}${notes}`;
        });
        return {
          content: [{ type: 'text' as const, text: lines.join('\n\n') }],
        };
      } catch (err) {
        return handleToolError(err, 'list_steps');
      }
    },
  );

  server.tool(
    'get_step',
    'Get the full prompt content for a specific step (0–14). For step 8 (Entrypoint Layer), you must provide projectType.',
    GetStepSchema.shape,
    async ({ step, projectType }): Promise<CallToolResult> => {
      try {
        const parsed = projectType ? ProjectTypeSchema.parse(projectType) : undefined;
        const content = await stepsService.getStep(step, parsed);
        return { content: [{ type: 'text' as const, text: content }] };
      } catch (err) {
        return handleToolError(err, 'get_step');
      }
    },
  );

  server.tool(
    'get_entrypoint',
    'Get the entrypoint-specific instructions (Step 8) for a given project type (http-api, library, cli, worker, mcp-server).',
    GetEntrypointSchema.shape,
    async ({ projectType }): Promise<CallToolResult> => {
      try {
        const parsed = ProjectTypeSchema.parse(projectType);
        const content = await stepsService.getEntrypoint(parsed);
        return { content: [{ type: 'text' as const, text: content }] };
      } catch (err) {
        return handleToolError(err, 'get_entrypoint');
      }
    },
  );

  server.tool(
    'get_master_prompt',
    'Get the complete master prompt for single-pass rewrites of small projects (< 2000 lines). Handles all project types automatically.',
    async (): Promise<CallToolResult> => {
      try {
        const content = await stepsService.getMasterPrompt();
        return { content: [{ type: 'text' as const, text: content }] };
      } catch (err) {
        return handleToolError(err, 'get_master_prompt');
      }
    },
  );
}
