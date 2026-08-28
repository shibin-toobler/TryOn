import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';
import { AppError } from '../utils/errors';

type Source = 'body' | 'query' | 'params';

/** Replaces the raw input with the parsed, typed result on success. */
export function validate(schema: ZodSchema, source: Source = 'body') {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[source]);

    if (!result.success) {
      next(
        AppError.badRequest(
          'Request validation failed.',
          result.error.issues.map((issue) => ({
            field: issue.path.join('.') || source,
            message: issue.message,
          })),
        ),
      );
      return;
    }

    // req.query is a getter in Express 5; assign defensively.
    Object.defineProperty(req, source, { value: result.data, writable: true, configurable: true });
    next();
  };
}
