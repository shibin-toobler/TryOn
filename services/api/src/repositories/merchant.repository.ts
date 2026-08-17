import { BaseRepository } from './base.repository';
import { MerchantModel, MerchantDoc } from '../models';

export class MerchantRepository extends BaseRepository<MerchantDoc> {
  constructor() {
    super(MerchantModel);
  }

  findByPublishableKey(key: string): Promise<MerchantDoc | null> {
    return this.findOne({ publishableKey: key, status: 'active' });
  }

  /** secretKey is `select: false`, so it has to be asked for explicitly. */
  findBySecretKey(key: string): Promise<MerchantDoc | null> {
    return MerchantModel.findOne({ secretKey: key, status: 'active' }).select('+secretKey').exec();
  }
}

export const merchantRepository = new MerchantRepository();
