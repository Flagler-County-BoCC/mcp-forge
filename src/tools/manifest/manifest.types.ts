import type { z } from 'zod';
import type { AuditManifestSchema } from './manifest.schema.js';

export type AuditManifest = z.infer<typeof AuditManifestSchema>;

export interface ManifestValidationResult {
  valid: boolean;
  errors: string[];
}
