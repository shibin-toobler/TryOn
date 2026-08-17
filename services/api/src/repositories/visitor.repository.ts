import { Types } from 'mongoose';
import { BaseRepository } from './base.repository';
import { VisitorModel, VisitorDoc } from '../models';

export class VisitorRepository extends BaseRepository<VisitorDoc> {
  constructor() {
    super(VisitorModel);
  }

  findByToken(merchant: Types.ObjectId, token: string): Promise<VisitorDoc | null> {
    return this.findOne({ merchant, token });
  }

  async touch(id: Types.ObjectId): Promise<void> {
    await VisitorModel.updateOne({ _id: id }, { $set: { lastSeenAt: new Date() } }).exec();
  }

  setActivePhoto(id: Types.ObjectId, photo: Types.ObjectId | null): Promise<VisitorDoc | null> {
    return this.updateById(id, { $set: { activePhoto: photo } });
  }
}

export const visitorRepository = new VisitorRepository();
