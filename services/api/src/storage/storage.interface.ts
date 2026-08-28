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
  /**
   * Browser-reachable URL for a stored object. Asynchronous because signing one
   * can be: S3 presigning is an async SDK call, and local/Cloudinary just
   * resolve immediately.
   */
  urlFor(key: string): Promise<string>;
  exists(key: string): Promise<boolean>;
}
