import { z } from 'zod';

export const ProjectTypeSchema = z.enum([
  'http-api',
  'library',
  'cli',
  'worker',
  'mcp-server',
]);

export const AuditManifestSchema = z.object({
  schemaVersion: z.string(),
  projectName: z.string().min(1),
  projectType: ProjectTypeSchema,
  detectedFramework: z.string(),
  detectedOrm: z.enum(['prisma', 'knex', 'sequelize', 'typeorm', 'mongoose', 'none']),
  detectedTestRunner: z.enum(['jest', 'vitest', 'mocha', 'tap', 'none']),
  detectedLanguage: z.enum(['typescript', 'javascript']),
  nodeVersionRequired: z.string().nullable(),
  isPublishedPackage: z.boolean(),
  entryPoints: z.array(z.string()),
  exportedSymbols: z
    .array(
      z.object({
        name: z.string(),
        kind: z.enum(['function', 'class', 'constant', 'type']),
        file: z.string(),
      }),
    )
    .default([]),
  cliCommands: z
    .array(
      z.object({
        command: z.string(),
        description: z.string(),
        file: z.string(),
      }),
    )
    .default([]),
  publicApiRoutes: z
    .array(
      z.object({
        method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']),
        path: z.string(),
        file: z.string(),
      }),
    )
    .default([]),
  mcpTools: z
    .array(
      z.object({
        name: z.string(),
        module: z.string(),
        description: z.string(),
        file: z.string(),
      }),
    )
    .default([]),
  mcpTransport: z.enum(['stdio', 'sse', 'http']).nullable(),
  environmentVariables: z
    .array(
      z.object({
        name: z.string(),
        usedIn: z.array(z.string()),
        hasDefault: z.boolean(),
        isSensitive: z.boolean(),
      }),
    )
    .default([]),
  externalDependencies: z
    .array(
      z.object({
        name: z.string(),
        version: z.string(),
        outdated: z.boolean(),
        hasCVE: z.boolean(),
      }),
    )
    .default([]),
  testCoverage: z.object({
    exists: z.boolean(),
    coveragePercent: z.number().nullable(),
  }),
  hasDockerfile: z.boolean(),
  hasCIConfig: z.boolean(),
  hasLinter: z.boolean(),
  hasFormatter: z.boolean(),
  hasErrorHandling: z.boolean(),
  hasStructuredLogging: z.boolean(),
  hasInputValidation: z.boolean(),
  findings: z
    .array(
      z.object({
        severity: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']),
        file: z.string(),
        description: z.string(),
      }),
    )
    .default([]),
});

export const ValidateManifestInputSchema = z.object({
  manifestJson: z
    .string()
    .min(1)
    .describe('The AUDIT_MANIFEST as a JSON string produced by Step 0.'),
});
