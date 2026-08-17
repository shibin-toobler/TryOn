import { Schema, model, Document, Types } from 'mongoose';

export type GenerationStatus = 'queued' | 'processing' | 'succeeded' | 'failed';

/** One try-on render: this visitor's photo + this product, through the engine. */
export interface GenerationDoc extends Document {
  _id: Types.ObjectId;
  merchant: Types.ObjectId;
  visitor: Types.ObjectId;
  product: Types.ObjectId;
  photo: Types.ObjectId;
  status: GenerationStatus;
  provider: string;
  /** Populated once status === 'succeeded'. */
  resultKey: string | null;
  resultMimeType: string | null;
  /** True when the render came from the mock provider, so the UI can say so. */
  simulated: boolean;
  error: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  durationMs: number | null;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const generationSchema = new Schema<GenerationDoc>(
  {
    merchant: { type: Schema.Types.ObjectId, ref: 'Merchant', required: true, index: true },
    visitor: { type: Schema.Types.ObjectId, ref: 'Visitor', required: true, index: true },
    product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    photo: { type: Schema.Types.ObjectId, ref: 'Photo', required: true },
    status: {
      type: String,
      enum: ['queued', 'processing', 'succeeded', 'failed'],
      default: 'queued',
      index: true,
    },
    provider: { type: String, required: true },
    resultKey: { type: String, default: null },
    resultMimeType: { type: String, default: null },
    simulated: { type: Boolean, default: false },
    error: { type: String, default: null },
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    durationMs: { type: Number, default: null },
    expiresAt: { type: Date, default: null },
  },
  { timestamps: true },
);

generationSchema.index({ visitor: 1, createdAt: -1 });
generationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const GenerationModel = model<GenerationDoc>('Generation', generationSchema);
