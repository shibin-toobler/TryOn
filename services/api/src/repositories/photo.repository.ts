import { Types } from 'mongoose';
import { BaseRepository } from './base.repository';
import { PhotoModel, PhotoDoc } from '../models';

export class PhotoRepository extends BaseRepository<PhotoDoc> {
  constructor() {
    super(PhotoModel);
  }

  listForVisitor(visitor: Types.ObjectId): Promise<PhotoDoc[]> {
    return this.find({ visitor }, { sort: { createdAt: -1 } });
  }

  deleteForVisitor(visitor: Types.ObjectId): Promise<PhotoDoc[]> {
    return this.find({ visitor }).then(async (photos) => {
      await PhotoModel.deleteMany({ visitor }).exec();
      return photos;
    });
  }

  /** Rows Mongo's TTL index has not swept yet, so their files can be removed too. */
  findExpired(now = new Date()): Promise<PhotoDoc[]> {
    return this.find({ expiresAt: { $ne: null, $lte: now } });
  }
}

export const photoRepository = new PhotoRepository();
