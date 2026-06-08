import { AppError, type ErrorContext } from './AppError.js';

export class NotFoundError extends AppError {
  constructor(message: string, context?: ErrorContext) {
    super(message, 404, 'NOT_FOUND', true, context);
  }
}

export class BadRequestError extends AppError {
  constructor(message: string, context?: ErrorContext) {
    super(message, 400, 'BAD_REQUEST', true, context);
  }
}

export class InternalServerError extends AppError {
  constructor(message: string, context?: ErrorContext) {
    super(message, 500, 'INTERNAL_SERVER_ERROR', false, context);
  }
}
