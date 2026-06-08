import { z } from 'zod';
import { PROJECT_TYPES } from './steps.types.js';

export const ProjectTypeSchema = z.enum(PROJECT_TYPES);

export const GetStepSchema = z.object({
  step: z.coerce
    .number()
    .int()
    .min(0)
    .max(14)
    .describe('Step number (0–14). Step 8 requires projectType.'),
  projectType: ProjectTypeSchema.optional().describe(
    'Required for step 8 to select the correct entrypoint file.',
  ),
});

export const ListStepsSchema = z.object({
  projectType: ProjectTypeSchema.optional().describe(
    'When provided, marks each step as applicable or skipped for that project type.',
  ),
});

export const GetEntrypointSchema = z.object({
  projectType: ProjectTypeSchema.describe('The project type to get entrypoint instructions for.'),
});
