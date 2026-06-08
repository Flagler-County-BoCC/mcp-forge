import { ZodError, type ZodSchema } from 'zod';
import { ValidationError } from '../errors/index.js';

export function validate<T>(schema: ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new ValidationError(result.error as ZodError);
  }
  return result.data;
}
