import { loadPrompt } from './prompt-loader.js';
import { StepsService } from '../tools/steps/steps.service.js';
import { ManifestService } from '../tools/manifest/manifest.service.js';

export const stepsService = new StepsService(loadPrompt);
export const manifestService = new ManifestService();
