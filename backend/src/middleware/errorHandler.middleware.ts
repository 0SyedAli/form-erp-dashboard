import { Request, Response, NextFunction } from 'express';
import { AppError, sendError } from '../utils/apiResponse.js';
import { logger } from '../utils/logger.js';
import { env } from '../config/env.js';

export function errorHandler(
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  logger.error({ err }, 'Unhandled application error caught in middleware');

  // Operational AppError
  if (err instanceof AppError) {
    sendError(res, err.message, err.statusCode, err.code, err.details);
    return;
  }

  // Mongoose Validation Error
  if (err.name === 'ValidationError') {
    const details = Object.values(err.errors || {}).map((e: any) => ({
      field: e.path,
      message: e.message,
    }));
    sendError(res, 'Database schema validation failed', 400, 'DB_VALIDATION_ERROR', details);
    return;
  }

  // Mongoose CastError (invalid ObjectId, etc.)
  if (err.name === 'CastError') {
    sendError(
      res,
      `Invalid format for parameter "${err.path}": ${err.value}`,
      400,
      'INVALID_IDENTIFIER'
    );
    return;
  }

  // MongoDB Duplicate Key Error (E11000)
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern || {})[0] || 'field';
    sendError(
      res,
      `Duplicate value violates unique constraint on "${field}".`,
      409,
      'DUPLICATE_RESOURCE',
      { field }
    );
    return;
  }

  // Generic 500
  const message =
    env.NODE_ENV === 'production'
      ? 'An unexpected internal server error occurred.'
      : err.message || 'Internal server error';

  sendError(res, message, 500, 'INTERNAL_SERVER_ERROR', env.NODE_ENV === 'development' ? err.stack : undefined);
}

