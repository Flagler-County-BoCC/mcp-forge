import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StepsService } from '../steps.service.js';
import type { PromptLoader } from '../../../lib/prompt-loader.js';
import { BadRequestError, NotFoundError } from '../../../errors/index.js';

const MOCK_CONTENT = '# Mock Prompt Content';

function makeService(loader?: PromptLoader): StepsService {
  const load = loader ?? vi.fn<PromptLoader>().mockResolvedValue(MOCK_CONTENT);
  return new StepsService(load);
}

describe('StepsService.listSteps', () => {
  it('returns 15 steps when no projectType is given', () => {
    const svc = makeService();
    const steps = svc.listSteps();
    expect(steps).toHaveLength(15);
    expect(steps.every((s) => s.appliesToCurrentType === null)).toBe(true);
  });

  it('marks applicable and skipped steps for http-api', () => {
    const svc = makeService();
    const steps = svc.listSteps('http-api');
    const step2 = steps.find((s) => s.step === 2);
    const step6 = steps.find((s) => s.step === 6);
    expect(step2?.appliesToCurrentType).toBe(true);
    expect(step6?.appliesToCurrentType).toBe(true);
  });

  it('marks step 2 as skipped for library', () => {
    const svc = makeService();
    const steps = svc.listSteps('library');
    const step2 = steps.find((s) => s.step === 2);
    const step6 = steps.find((s) => s.step === 6);
    expect(step2?.appliesToCurrentType).toBe(false);
    expect(step6?.appliesToCurrentType).toBe(false);
  });

  it('marks step 11 as skipped for cli', () => {
    const svc = makeService();
    const steps = svc.listSteps('cli');
    const step11 = steps.find((s) => s.step === 11);
    expect(step11?.appliesToCurrentType).toBe(false);
  });
});

describe('StepsService.getStep', () => {
  let load: ReturnType<typeof vi.fn<PromptLoader>>;
  let svc: StepsService;

  beforeEach(() => {
    load = vi.fn<PromptLoader>().mockResolvedValue(MOCK_CONTENT);
    svc = new StepsService(load);
  });

  it('loads the correct file for step 0', async () => {
    const result = await svc.getStep(0);
    expect(load).toHaveBeenCalledWith('shared/00-audit.md');
    expect(result).toBe(MOCK_CONTENT);
  });

  it('loads the correct file for step 7', async () => {
    await svc.getStep(7);
    expect(load).toHaveBeenCalledWith('shared/07-services.md');
  });

  it('throws BadRequestError for step 8 without projectType', async () => {
    await expect(svc.getStep(8)).rejects.toBeInstanceOf(BadRequestError);
  });

  it('loads entrypoint for step 8 with projectType mcp-server', async () => {
    await svc.getStep(8, 'mcp-server');
    expect(load).toHaveBeenCalledWith('entrypoints/mcp-server.md');
  });

  it('propagates NotFoundError from the loader', async () => {
    load.mockRejectedValueOnce(new NotFoundError('Prompt file not found: shared/00-audit.md'));
    await expect(svc.getStep(0)).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe('StepsService.getEntrypoint', () => {
  it('loads the right entrypoint file for each project type', async () => {
    const cases: Array<[import('../steps.types.js').ProjectType, string]> = [
      ['http-api', 'entrypoints/http-api.md'],
      ['library', 'entrypoints/library.md'],
      ['cli', 'entrypoints/cli.md'],
      ['worker', 'entrypoints/worker.md'],
      ['mcp-server', 'entrypoints/mcp-server.md'],
    ];

    for (const [type, file] of cases) {
      const load = vi.fn<PromptLoader>().mockResolvedValue(MOCK_CONTENT);
      const svc = new StepsService(load);
      await svc.getEntrypoint(type);
      expect(load).toHaveBeenCalledWith(file);
    }
  });
});

describe('StepsService.getMasterPrompt', () => {
  it('loads masters/MASTER.md', async () => {
    const load = vi.fn<PromptLoader>().mockResolvedValue(MOCK_CONTENT);
    const svc = new StepsService(load);
    await svc.getMasterPrompt();
    expect(load).toHaveBeenCalledWith('masters/MASTER.md');
  });
});
