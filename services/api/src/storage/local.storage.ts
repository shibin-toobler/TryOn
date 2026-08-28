import fs from 'fs/promises';
import path from 'path';
import { StorageDriver, StoredObject } from './storage.interface';
import { env } from '../config/env';
import { token } from '../utils/ids';
import { AppError } from '../utils/errors';

const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export class LocalStorageDriver implements StorageDriver {
  readonly name = 'local';

  constructor(private readonly root: string = env.storage.dir) {}

  private resolve(key: string): string {
    const full = path.resolve(this.root, key);
    // Refuse anything that escapes the storage root via ../ in a key.
    if (!full.startsWith(path.resolve(this.root))) {
      throw AppError.badRequest('Invalid storage key.');
    }
    return full;
  }

  async save(prefix: string, data: Buffer, mimeType: string): Promise<StoredObject> {
    const ext = EXTENSIONS[mimeType] ?? 'bin';
    const key = `${prefix}/${Date.now()}-${token(12)}.${ext}`;
    const full = this.resolve(key);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, data);
    return { key, bytes: data.byteLength, mimeType };
  }

  async read(key: string): Promise<Buffer> {
    try {
      return await fs.readFile(this.resolve(key));
    } catch {
      throw AppError.notFound('Stored file not found.');
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await fs.unlink(this.resolve(key));
    } catch {
      // Already gone — deleting is idempotent by design.
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      await fs.access(this.resolve(key));
      return true;
    } catch {
      return false;
    }
  }

  async urlFor(key: string): Promise<string> {
    return `${env.publicBaseUrl}/files/${key}`;
  }
}
