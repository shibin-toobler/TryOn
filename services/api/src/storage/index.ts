import { StorageDriver } from './storage.interface';
import { LocalStorageDriver } from './local.storage';
import { S3StorageDriver } from './s3.storage';
import { CloudinaryStorageDriver } from './cloudinary.storage';
import { env } from '../config/env';
import { logger } from '../utils/logger';

function build(): StorageDriver {
  if (env.storage.driver === 's3') {
    return new S3StorageDriver();
  }
  if (env.storage.driver === 'cloudinary') {
    return new CloudinaryStorageDriver();
  }
  return new LocalStorageDriver();
}

let instance: StorageDriver | null = null;

/**
 * Lazily resolved so a missing driver config surfaces as a startup error from
 * assertEnv rather than at import time.
 */
function resolve(): StorageDriver {
  if (!instance) {
    instance = build();
    logger.info(`storage driver: ${instance.name}`);
  }
  return instance;
}

/**
 * Proxy so `storage` can be imported anywhere while the concrete driver is
 * still built on first use.
 */
export const storage: StorageDriver = {
  get name() {
    return resolve().name;
  },
  save: (prefix, data, mimeType) => resolve().save(prefix, data, mimeType),
  read: (key) => resolve().read(key),
  delete: (key) => resolve().delete(key),
  urlFor: (key) => resolve().urlFor(key),
  exists: (key) => resolve().exists(key),
};

export type { StorageDriver, StoredObject } from './storage.interface';
