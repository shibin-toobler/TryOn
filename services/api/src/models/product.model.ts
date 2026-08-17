import { Schema, model, Document, Types } from 'mongoose';

export type GarmentCategory = 'dress' | 'top' | 'bottom' | 'outerwear' | 'full_outfit';

export interface ProductDoc extends Document {
  _id: Types.ObjectId;
  merchant: Types.ObjectId;
  /** The merchant's own SKU — what `data-tryon-product` on their page refers to. */
  externalId: string;
  name: string;
  color: string;
  price: number;
  currency: string;
  /** Garment image handed to the model. Flat-lay or on-model both work. */
  imageUrl: string;
  description: string;
  category: GarmentCategory;
  /** Extra styling instructions appended to the generation prompt. */
  promptHint: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const productSchema = new Schema<ProductDoc>(
  {
    merchant: { type: Schema.Types.ObjectId, ref: 'Merchant', required: true, index: true },
    externalId: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    color: { type: String, default: '' },
    price: { type: Number, default: 0 },
    currency: { type: String, default: 'INR' },
    imageUrl: { type: String, required: true },
    description: { type: String, default: '' },
    category: {
      type: String,
      enum: ['dress', 'top', 'bottom', 'outerwear', 'full_outfit'],
      default: 'dress',
    },
    promptHint: { type: String, default: '' },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

// A SKU is unique per merchant, not globally.
productSchema.index({ merchant: 1, externalId: 1 }, { unique: true });

export const ProductModel = model<ProductDoc>('Product', productSchema);
