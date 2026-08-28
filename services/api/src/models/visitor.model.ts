import { Schema, model, Document, Types } from 'mongoose';

/**
 * An anonymous shopper. Identified only by a random token the widget keeps in
 * localStorage — no email, no account, nothing that identifies a real person
 * beyond the photo they choose to upload.
 */
export interface VisitorDoc extends Document {
  _id: Types.ObjectId;
  merchant: Types.ObjectId;
  token: string;
  /** The photo currently powering the panel. Null until the first upload. */
  activePhoto: Types.ObjectId | null;
  lastSeenAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const visitorSchema = new Schema<VisitorDoc>(
  {
    merchant: { type: Schema.Types.ObjectId, ref: 'Merchant', required: true, index: true },
    token: { type: String, required: true, unique: true, index: true },
    activePhoto: { type: Schema.Types.ObjectId, ref: 'Photo', default: null },
    lastSeenAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

export const VisitorModel = model<VisitorDoc>('Visitor', visitorSchema);
