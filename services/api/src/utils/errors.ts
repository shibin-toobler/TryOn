export class AppError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.details = details;
    Error.captureStackTrace?.(this, AppError);
  }

  static badRequest(message: string, details?: unknown) {
    return new AppError(400, 'bad_request', message, details);
  }
  static unauthorized(message = 'Missing or invalid API key.') {
    return new AppError(401, 'unauthorized', message);
  }
  static forbidden(message = 'Not allowed from this origin.') {
    return new AppError(403, 'forbidden', message);
  }
  static notFound(message = 'Resource not found.') {
    return new AppError(404, 'not_found', message);
  }
  static conflict(message: string) {
    return new AppError(409, 'conflict', message);
  }
  static payloadTooLarge(message: string) {
    return new AppError(413, 'payload_too_large', message);
  }
  static tooManyRequests(message: string) {
    return new AppError(429, 'rate_limited', message);
  }
  static upstream(message: string, details?: unknown) {
    return new AppError(502, 'provider_error', message, details);
  }
}

export const isAppError = (err: unknown): err is AppError => err instanceof AppError;
