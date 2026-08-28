import { Request, Response, NextFunction } from 'express';
import { MerchantDoc } from '../models';
import { merchantService } from '../services/merchant.service';
import { env } from '../config/env';
import { AppError } from '../utils/errors';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      merchant?: MerchantDoc;
    }
  }
}

const bearer = (req: Request): string | null => {
  const header = req.header('authorization');
  if (!header?.toLowerCase().startsWith('bearer ')) return null;
  return header.slice(7).trim() || null;
};

/**
 * Widget routes. The publishable key is visible in merchant HTML by design, so
 * the origin allowlist — not the key — is what stops another site from using it.
 */
export async function requirePublishableKey(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const key = req.header('x-tryon-key') ?? (req.query.key as string | undefined);
    if (!key) throw AppError.unauthorized('Missing x-tryon-key header.');

    const merchant = await merchantService.requireByPublishableKey(key);
    const origin = req.header('origin');

    if (!merchantService.isOriginAllowed(merchant, origin)) {
      throw AppError.forbidden(
        `Origin "${origin ?? 'unknown'}" is not on this merchant's allowlist.`,
      );
    }

    req.merchant = merchant;
    next();
  } catch (error) {
    next(error);
  }
}

/** Admin routes. Secret key, server-to-server only. */
export async function requireSecretKey(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const key = bearer(req) ?? req.header('x-tryon-secret');
    if (!key) throw AppError.unauthorized('Missing Authorization: Bearer sk_... header.');

    req.merchant = await merchantService.requireBySecretKey(key);
    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Guards merchant creation, the one route no merchant key can authenticate
 * because it is what mints them.
 */
export function requireBootstrapToken(req: Request, _res: Response, next: NextFunction): void {
  const configured = env.security.adminBootstrapToken;

  if (!configured) {
    if (env.isProduction) {
      next(AppError.forbidden('ADMIN_BOOTSTRAP_TOKEN is not configured.'));
      return;
    }
    // Development convenience: unset token means open, so `npm run seed` works
    // on a fresh clone with no configuration at all.
    next();
    return;
  }

  const provided = bearer(req) ?? req.header('x-admin-token');
  if (provided !== configured) {
    next(AppError.unauthorized('Invalid admin bootstrap token.'));
    return;
  }
  next();
}
