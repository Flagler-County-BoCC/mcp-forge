import { ZodError } from 'zod';
import { BadRequestError } from '../../errors/index.js';
import { AuditManifestSchema } from './manifest.schema.js';
import type { ManifestValidationResult } from './manifest.types.js';

export class ManifestService {
  validate(manifestJson: string): ManifestValidationResult {
    let parsed: unknown;
    try {
      parsed = JSON.parse(manifestJson) as unknown;
    } catch {
      throw new BadRequestError('manifestJson is not valid JSON.');
    }

    const result = AuditManifestSchema.safeParse(parsed);
    if (result.success) {
      return { valid: true, errors: [] };
    }

    const errors = (result.error as ZodError).issues.map(
      (i) => `${i.path.join('.') || '(root)'}: ${i.message}`,
    );
    return { valid: false, errors };
  }
}
