import { describe, it, expect } from 'vitest';
import { ManifestService } from '../manifest.service.js';
import { BadRequestError } from '../../../errors/index.js';

const VALID_MANIFEST = {
  schemaVersion: '3.0.0',
  projectName: 'my-project',
  projectType: 'mcp-server',
  detectedFramework: 'none',
  detectedOrm: 'none',
  detectedTestRunner: 'vitest',
  detectedLanguage: 'typescript',
  nodeVersionRequired: '22',
  isPublishedPackage: false,
  entryPoints: ['src/stdio.ts'],
  exportedSymbols: [],
  cliCommands: [],
  publicApiRoutes: [],
  mcpTools: [
    {
      name: 'my-tool',
      module: 'core',
      description: 'Does a thing',
      file: 'src/tools/core/core.tool.ts',
    },
  ],
  mcpTransport: 'stdio',
  environmentVariables: [],
  externalDependencies: [],
  testCoverage: { exists: true, coveragePercent: 82 },
  hasDockerfile: false,
  hasCIConfig: false,
  hasLinter: true,
  hasFormatter: true,
  hasErrorHandling: true,
  hasStructuredLogging: true,
  hasInputValidation: true,
  findings: [],
};

describe('ManifestService.validate', () => {
  const svc = new ManifestService();

  it('returns valid=true for a correct manifest', () => {
    const result = svc.validate(JSON.stringify(VALID_MANIFEST));
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('throws BadRequestError for non-JSON input', () => {
    expect(() => svc.validate('not json')).toThrow(BadRequestError);
  });

  it('returns valid=false with errors when required fields are missing', () => {
    const bad = { ...VALID_MANIFEST, projectName: '', projectType: 'unknown-type' };
    const result = svc.validate(JSON.stringify(bad));
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.some((e) => e.includes('projectType'))).toBe(true);
  });

  it('returns valid=false when projectType is invalid', () => {
    const bad = { ...VALID_MANIFEST, projectType: 'webapp' };
    const result = svc.validate(JSON.stringify(bad));
    expect(result.valid).toBe(false);
  });

  it('accepts all valid project types', () => {
    for (const type of ['http-api', 'library', 'cli', 'worker', 'mcp-server']) {
      const manifest = { ...VALID_MANIFEST, projectType: type };
      const result = svc.validate(JSON.stringify(manifest));
      expect(result.valid, `projectType ${type} should be valid`).toBe(true);
    }
  });
});
