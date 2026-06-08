import { AppError } from './AppError.js';
import type { ZodError } from 'zod';

export class ValidationError extends AppError {
  public readonly issues: ZodError['issues'];

  constructor(error: ZodError) {
    const message = error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    super(message, 422, 'VALIDATION_ERROR', true, { issues: error.issues });
    this.issues = error.issues;
  }
}
