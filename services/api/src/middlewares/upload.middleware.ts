import multer from 'multer';
import { env } from '../config/env';
import { AppError } from '../utils/errors';

const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp']);

/**
 * Memory storage: the buffer goes straight to the storage driver, so nothing
 * ever lands in an unmanaged temp directory.
 */
export const uploadPhoto = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.storage.maxUploadBytes, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED.has(file.mimetype)) {
      cb(AppError.badRequest('Photo must be a JPEG, PNG or WebP image.'));
      return;
    }
    cb(null, true);
  },
}).single('photo');
