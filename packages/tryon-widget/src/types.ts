export interface TryOnConfig {
  /** Merchant publishable key, pk_… */
  key: string;
  /** Base URL of the TryOn API. */
  apiUrl: string;
  /** Elements matching this selector open the widget on click. */
  selector: string;
  /** Attribute on those elements holding the merchant SKU. */
  productAttribute: string;
  /** Bind the document click listener automatically. */
  autoBind: boolean;
}

export interface Product {
  id: string;
  externalId: string;
  name: string;
  color: string;
  price: number;
  currency: string;
  imageUrl: string;
  description: string;
  category: string;
}

export interface Photo {
  id: string;
  url: string;
  uploadedAt: string;
  expiresAt: string | null;
}

export type GenerationStatus = 'queued' | 'processing' | 'succeeded' | 'failed';

export interface Generation {
  id: string;
  status: GenerationStatus;
  simulated: boolean;
  resultUrl: string | null;
  error: string | null;
  durationMs: number | null;
  createdAt: string;
  product: Partial<Product> & { id: string };
}

export interface Merchant {
  id: string;
  name: string;
  theme: { accent: string; headline: string };
}

export interface BootstrapResponse {
  merchant: Merchant;
  visitorToken: string;
  hasPhoto: boolean;
  photo: Photo | null;
  product: Product | null;
  recent: Generation[];
}

/** What the panel is currently doing — drives the whole stage render. */
export type StageState = 'empty' | 'idle' | 'generating' | 'ready' | 'error';

export interface WidgetState {
  ready: boolean;
  merchant: Merchant | null;
  visitorToken: string | null;
  photo: Photo | null;
  /** Look currently on the stage. Null means the bare photo is showing. */
  current: Generation | null;
  /** Product being rendered right now, for the loading copy. */
  pendingProduct: Product | null;
  recent: Generation[];
  stage: StageState;
  error: string | null;
  uploading: boolean;
  modalOpen: boolean;
  panelOpen: boolean;
}
