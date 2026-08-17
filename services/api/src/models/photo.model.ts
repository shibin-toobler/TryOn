import { Schema, model, Document, Types } from 'mongoose';

/**
 * A shopper's uploaded body photo. `expiresAt` drives a TTL index, so Mongo
 * deletes the document on its own — the storage file is cleaned up alongside it
 * by the retention job.
 */
export interface PhotoDoc extends Document {
  _id: Types.ObjectId;
  merchant: Types.ObjectId;
  visitor: Types.ObjectId;
  storageKey: string;
  mimeType: string;
  bytes: number;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const photoSchema = new Schema<PhotoDoc>(
  {
    merchant: { type: Schema.Types.ObjectId, ref: 'Merchant', required: true, index: true },
    visitor: { type: Schema.Types.ObjectId, ref: 'Visitor', required: true, index: true },
    storageKey: { type: String, required: true },
    mimeType: { type: String, required: true },
    bytes: { type: Number, required: true },
    expiresAt: { type: Date, default: null },
  },
  { timestamps: true },
);

// TTL index: Mongo removes the row once expiresAt passes. Docs with a null
// expiresAt are never touched, which is what PHOTO_RETENTION_DAYS=0 produces.
photoSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const PhotoModel = model<PhotoDoc>('Photo', photoSchema);
