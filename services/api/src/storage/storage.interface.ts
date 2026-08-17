export interface StoredObject {
  key: string;
  bytes: number;
  mimeType: string;
}

/**
 * Binary storage for shopper photos and generated renders. The local driver
 * writes to disk; an S3/GCS driver only has to satisfy this contract.
 */
export interface StorageDriver {
  readonly name: string;
  save(prefix: string, data: Buffer, mimeType: string): Promise<StoredObject>;
  read(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  /** Browser-reachable URL for a stored object. */
  urlFor(key: string): string;
  exists(key: string): Promise<boolean>;
}
