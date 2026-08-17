import { Request, Response, NextFunction } from 'express';
import { MulterError } from 'multer';
import { AppError, isAppError } from '../utils/errors';
import { env } from '../config/env';
import { logger } from '../utils/logger';

export function notFoundHandler(req: Request, _res: Response, next: NextFunction): void {
  next(AppError.notFound(`No route for ${req.method} ${req.path}.`));
}

export function errorHandler(
  error: unknown,
  _req: Request,
  res: Response,
  // Express only treats a 4-arity function as an error handler.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
): void {
  let normalised: AppError;

  if (isAppError(error)) {
    normalised = error;
  } else if (error instanceof MulterError) {
    normalised =
      error.code === 'LIMIT_FILE_SIZE'
        ? AppError.payloadTooLarge('That photo is too large.')
        : AppError.badRequest(error.message);
  } else if ((error as { name?: string })?.name === 'ValidationError') {
    normalised = AppError.badRequest((error as Error).message);
  } else {
    normalised = new AppError(500, 'internal_error', 'Something went wrong on our side.');
    logger.error('unhandled error', error);
  }

  if (normalised.status >= 500) {
    logger.error(`${normalised.code}: ${normalised.message}`, error);
  }

  res.status(normalised.status).json({
    error: {
      code: normalised.code,
      message: normalised.message,
      ...(normalised.details ? { details: normalised.details } : {}),
      ...(env.isProduction ? {} : { stack: (error as Error)?.stack }),
    },
  });
}
