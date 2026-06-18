import type { PromptLoader } from '../../lib/prompt-loader.js';
import { BadRequestError } from '../../errors/index.js';
import type { ProjectType, StepInfo, StepListItem } from './steps.types.js';

const STEP_DEFINITIONS: StepInfo[] = [
  {
    step: 0,
    title: 'Project Audit',
    file: 'shared/00-audit.md',
    description: 'Audit source project; emit AUDIT_MANIFEST JSON with projectType.',
    appliesTo: 'all',
  },
  {
    step: 1,
    title: 'Directory Structure',
    file: 'shared/01-structure.md',
    description: 'Establish directory layout and package.json by project type.',
    appliesTo: 'all',
  },
  {
    step: 2,
    title: 'Config & Environment',
    file: 'shared/02-config.md',
    description: 'Zod-validated env parsing and typed config object.',
    appliesTo: ['http-api', 'cli', 'worker', 'mcp-server'],
    notes: 'Skipped for library — libraries must not parse process.env at load time.',
  },
  {
    step: 3,
    title: 'Structured Logging',
    file: 'shared/03-logging.md',
    description: 'pino logger setup (injected no-op logger for library type).',
    appliesTo: 'all',
  },
  {
    step: 4,
    title: 'Error Hierarchy',
    file: 'shared/04-errors.md',
    description: 'AppError class hierarchy, ExternalServiceError, and centralized error handling.',
    appliesTo: 'all',
  },
  {
    step: 5,
    title: 'Input Validation',
    file: 'shared/05-validation.md',
    description: 'validate() helper and zod schema conventions.',
    appliesTo: 'all',
  },
  {
    step: 6,
    title: 'Data Access Layer',
    file: 'shared/06-database.md',
    description: 'Repository pattern for database/persistence access.',
    appliesTo: ['http-api', 'cli', 'worker'],
    notes: 'Skipped for library and mcp-server unless they access a DB directly.',
  },
  {
    step: 7,
    title: 'Service Layer',
    file: 'shared/07-services.md',
    description: 'Business logic services, HTTP client, and DI container.',
    appliesTo: 'all',
  },
  {
    step: 8,
    title: 'Entrypoint Layer',
    file: '',
    description:
      'Project-type-specific entrypoint scaffolding. Use get_entrypoint or get_step with a projectType.',
    appliesTo: 'all',
  },
  {
    step: 9,
    title: 'Test Suite',
    file: 'shared/09-testing.md',
    description: 'Vitest config and test patterns per project type.',
    appliesTo: 'all',
  },
  {
    step: 10,
    title: 'Security Hardening',
    file: 'shared/10-security.md',
    description: 'Security controls matrix by project type.',
    appliesTo: 'all',
  },
  {
    step: 11,
    title: 'Observability',
    file: 'shared/11-observability.md',
    description: 'Metrics, tracing, and health checks.',
    appliesTo: ['http-api', 'worker', 'mcp-server'],
    notes: 'Skipped for library and cli.',
  },
  {
    step: 12,
    title: 'Docker & CI',
    file: 'shared/12-ci.md',
    description: 'Dockerfile (where applicable) and GitHub Actions CI pipeline.',
    appliesTo: 'all',
  },
  {
    step: 13,
    title: 'Finalize',
    file: 'shared/13-finalize.md',
    description: 'ESLint flat config and completion checklist.',
    appliesTo: 'all',
  },
  {
    step: 14,
    title: 'GitHub Documentation',
    file: 'shared/14-docs.md',
    description: 'Professional GitHub markdown files (README, CONTRIBUTING, CHANGELOG, etc.).',
    appliesTo: 'all',
  },
];

const ENTRYPOINT_MAP: Record<ProjectType, string> = {
  'http-api': 'entrypoints/http-api.md',
  library: 'entrypoints/library.md',
  cli: 'entrypoints/cli.md',
  worker: 'entrypoints/worker.md',
  'mcp-server': 'entrypoints/mcp-server.md',
};

export class StepsService {
  constructor(private readonly load: PromptLoader) {}

  listSteps(projectType?: ProjectType): StepListItem[] {
    return STEP_DEFINITIONS.map((step) => ({
      ...step,
      appliesToCurrentType:
        projectType === undefined
          ? null
          : step.appliesTo === 'all' || step.appliesTo.includes(projectType),
    }));
  }

  async getStep(step: number, projectType?: ProjectType): Promise<string> {
    if (step === 8) {
      if (!projectType) {
        throw new BadRequestError(
          'Step 8 is entrypoint-specific — provide projectType to get the correct instructions.',
        );
      }
      return this.getEntrypoint(projectType);
    }

    const def = STEP_DEFINITIONS.find((s) => s.step === step);
    if (!def) {
      throw new BadRequestError(`Unknown step number: ${step}`);
    }

    return this.load(def.file);
  }

  async getEntrypoint(projectType: ProjectType): Promise<string> {
    const file = ENTRYPOINT_MAP[projectType];
    return this.load(file);
  }

  async getMasterPrompt(): Promise<string> {
    return this.load('masters/MASTER.md');
  }

  async getCreatePrompt(): Promise<string> {
    return this.load('shared/00-create.md');
  }
}
