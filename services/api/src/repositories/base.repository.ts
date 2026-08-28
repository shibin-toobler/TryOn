import { Document, FilterQuery, Model, QueryOptions, UpdateQuery, Types } from 'mongoose';

/**
 * Shared CRUD surface. Every concrete repository extends this, and nothing
 * outside `src/repositories` imports mongoose — swapping the data store means
 * rewriting this folder and nothing else.
 */
export abstract class BaseRepository<T extends Document> {
  protected constructor(protected readonly model: Model<T>) {}

  async create(data: Partial<T>): Promise<T> {
    const created = await this.model.create(data);
    return created;
  }

  async findById(id: string | Types.ObjectId, options?: QueryOptions): Promise<T | null> {
    if (!this.isValidId(id)) return null;
    return this.model.findById(id, null, options).exec();
  }

  async findOne(filter: FilterQuery<T>, options?: QueryOptions): Promise<T | null> {
    return this.model.findOne(filter, null, options).exec();
  }

  async find(filter: FilterQuery<T> = {}, options?: QueryOptions): Promise<T[]> {
    return this.model.find(filter, null, options).exec();
  }

  async updateById(id: string | Types.ObjectId, update: UpdateQuery<T>): Promise<T | null> {
    if (!this.isValidId(id)) return null;
    return this.model.findByIdAndUpdate(id, update, { new: true }).exec();
  }

  async deleteById(id: string | Types.ObjectId): Promise<boolean> {
    if (!this.isValidId(id)) return false;
    const res = await this.model.findByIdAndDelete(id).exec();
    return Boolean(res);
  }

  async count(filter: FilterQuery<T> = {}): Promise<number> {
    return this.model.countDocuments(filter).exec();
  }

  async exists(filter: FilterQuery<T>): Promise<boolean> {
    return Boolean(await this.model.exists(filter));
  }

  isValidId(id: string | Types.ObjectId): boolean {
    return Types.ObjectId.isValid(id);
  }
}
