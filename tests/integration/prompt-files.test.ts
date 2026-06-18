import { describe, it, expect } from 'vitest';
import { stepsService } from '../../src/lib/container.js';
import { PROJECT_TYPES } from '../../src/tools/steps/steps.types.js';

const MIN_LENGTH = 100; // a real prompt file is far longer; this catches empty/missing/stub files

describe('served prompt files', () => {
  // Steps 0–14, excluding step 8 (entrypoint-specific, covered below).
  const stepNumbers = Array.from({ length: 15 }, (_, i) => i).filter((n) => n !== 8);

  it.each(stepNumbers)('step %i returns substantial prompt content', async (step) => {
    const content = await stepsService.getStep(step);
    expect(content.length).toBeGreaterThan(MIN_LENGTH);
  });

  it.each([...PROJECT_TYPES])('entrypoint for %s returns substantial content', async (type) => {
    const content = await stepsService.getEntrypoint(type);
    expect(content.length).toBeGreaterThan(MIN_LENGTH);
  });

  it('step 8 resolves to the entrypoint for a project type', async () => {
    const content = await stepsService.getStep(8, 'mcp-server');
    expect(content.length).toBeGreaterThan(MIN_LENGTH);
  });

  it('master prompt returns substantial content', async () => {
    const content = await stepsService.getMasterPrompt();
    expect(content.length).toBeGreaterThan(MIN_LENGTH);
  });

  it('create-mode prompt returns substantial content', async () => {
    const content = await stepsService.getCreatePrompt();
    expect(content.length).toBeGreaterThan(MIN_LENGTH);
  });
});
