import { Types } from 'mongoose';
import { photoRepository } from '../repositories/photo.repository';
import { visitorRepository } from '../repositories/visitor.repository';
import { PhotoDoc, VisitorDoc } from '../models';
import { storage } from '../storage';
import { env } from '../config/env';
import { AppError } from '../utils/errors';
import { logger } from '../utils/logger';

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export interface UploadInput {
  buffer: Buffer;
  mimeType: string;
  size: number;
}

export class PhotoService {
  private expiryDate(): Date | null {
    if (env.retention.photoDays <= 0) return null;
    return new Date(Date.now() + env.retention.photoDays * 24 * 60 * 60 * 1000);
  }

  /**
   * Stores a shopper photo and makes it the visitor's active one. The previous
   * photo is deleted immediately — we keep exactly one body photo per visitor,
   * which keeps the retention story simple and honest.
   */
  async upload(
    merchant: Types.ObjectId,
    visitor: VisitorDoc,
    input: UploadInput,
  ): Promise<PhotoDoc> {
    if (!ALLOWED_TYPES.has(input.mimeType)) {
      throw AppError.badRequest('Photo must be a JPEG, PNG or WebP image.');
    }
    if (input.size > env.storage.maxUploadBytes) {
      const mb = (env.storage.maxUploadBytes / (1024 * 1024)).toFixed(1);
      throw AppError.payloadTooLarge(`Photo must be smaller than ${mb} MB.`);
    }

    const previousId = visitor.activePhoto;

    const stored = await storage.save(
      `photos/${merchant.toString()}/${visitor._id.toString()}`,
      input.buffer,
      input.mimeType,
    );

    const photo = await photoRepository.create({
      merchant,
      visitor: visitor._id,
      storageKey: stored.key,
      mimeType: stored.mimeType,
      bytes: stored.bytes,
      expiresAt: this.expiryDate(),
    } as Partial<PhotoDoc>);

    await visitorRepository.setActivePhoto(visitor._id, photo._id);

    if (previousId) {
      await this.deleteById(previousId).catch((error) =>
        logger.warn('could not remove replaced photo', error),
      );
    }

    return photo;
  }

  async requireActive(visitor: VisitorDoc): Promise<PhotoDoc> {
    if (!visitor.activePhoto) {
      throw AppError.badRequest('Upload a photo before trying a product on.');
    }
    const photo = await photoRepository.findById(visitor.activePhoto);
    if (!photo) {
      await visitorRepository.setActivePhoto(visitor._id, null);
      throw AppError.badRequest('Your photo is no longer available. Upload a new one.');
    }
    return photo;
  }

  async getActive(visitor: VisitorDoc): Promise<PhotoDoc | null> {
    if (!visitor.activePhoto) return null;
    return photoRepository.findById(visitor.activePhoto);
  }

  /** Removes the row and the underlying file. Used by "delete my photo". */
  async deleteById(id: Types.ObjectId): Promise<void> {
    const photo = await photoRepository.findById(id);
    if (!photo) return;
    await storage.delete(photo.storageKey);
    await photoRepository.deleteById(id);
  }

  async deleteActive(visitor: VisitorDoc): Promise<void> {
    if (!visitor.activePhoto) return;
    await this.deleteById(visitor.activePhoto);
    await visitorRepository.setActivePhoto(visitor._id, null);
  }

  async readBytes(photo: PhotoDoc): Promise<Buffer> {
    return storage.read(photo.storageKey);
  }
}

export const photoService = new PhotoService();
