import { Types } from 'mongoose';
import { visitorRepository } from '../repositories/visitor.repository';
import { VisitorDoc } from '../models';
import { visitorToken } from '../utils/ids';
import { AppError } from '../utils/errors';

export class VisitorService {
  /**
   * Resolves the token the widget kept in localStorage, minting a fresh visitor
   * when it is absent or belongs to a different merchant. Tokens are scoped per
   * merchant, so one shopper on two stores is two unrelated visitors.
   */
  async resolve(merchant: Types.ObjectId, token?: string | null): Promise<VisitorDoc> {
    if (token) {
      const existing = await visitorRepository.findByToken(merchant, token);
      if (existing) {
        await visitorRepository.touch(existing._id);
        return existing;
      }
    }

    return visitorRepository.create({
      merchant,
      token: visitorToken(),
      activePhoto: null,
      lastSeenAt: new Date(),
    } as Partial<VisitorDoc>);
  }

  async require(merchant: Types.ObjectId, token: string): Promise<VisitorDoc> {
    const visitor = await visitorRepository.findByToken(merchant, token);
    if (!visitor) throw AppError.notFound('Unknown visitor. Reload the page to start a new session.');
    return visitor;
  }
}

export const visitorService = new VisitorService();
