import { WidgetState } from './types';

const STORAGE_KEY = 'tryon.visitorToken';

type Listener = (state: WidgetState) => void;

export const initialState: WidgetState = {
  ready: false,
  merchant: null,
  visitorToken: null,
  photo: null,
  current: null,
  pendingProduct: null,
  recent: [],
  stage: 'empty',
  error: null,
  uploading: false,
  modalOpen: false,
  panelOpen: false,
};

export class Store {
  private state: WidgetState = { ...initialState };
  private readonly listeners = new Set<Listener>();

  get(): WidgetState {
    return this.state;
  }

  set(patch: Partial<WidgetState>): void {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((listener) => listener(this.state));
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}

/**
 * The visitor token lives in localStorage so "upload once, keep browsing"
 * survives navigation and repeat visits. Private-mode browsers throw on access,
 * hence the guards — the widget still works, it just forgets between page loads.
 */
export function readVisitorToken(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function writeVisitorToken(token: string): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, token);
  } catch {
    // Storage unavailable; the session simply will not persist.
  }
}

export function clearVisitorToken(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // No-op.
  }
}
