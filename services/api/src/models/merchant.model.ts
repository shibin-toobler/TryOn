import { Schema, model, Document, Types } from 'mongoose';

export interface MerchantDoc extends Document {
  _id: Types.ObjectId;
  name: string;
  publishableKey: string;
  secretKey: string;
  /** Origins allowed to load the widget. Empty or ['*'] means any origin. */
  allowedOrigins: string[];
  status: 'active' | 'suspended';
  theme: {
    accent: string;
    /** Copy shown on the first-run upload modal. */
    headline: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const merchantSchema = new Schema<MerchantDoc>(
  {
    name: { type: String, required: true, trim: true },
    publishableKey: { type: String, required: true, unique: true, index: true },
    secretKey: { type: String, required: true, unique: true, select: false },
    allowedOrigins: { type: [String], default: [] },
    status: { type: String, enum: ['active', 'suspended'], default: 'active' },
    theme: {
      accent: { type: String, default: '#d06c4f' },
      headline: { type: String, default: "Let's see it on you." },
    },
  },
  { timestamps: true },
);

export const MerchantModel = model<MerchantDoc>('Merchant', merchantSchema);
