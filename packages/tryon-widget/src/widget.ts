import { ApiError, TryOnApi } from './api';
import { Store, readVisitorToken, writeVisitorToken, clearVisitorToken } from './store';
import { Generation, Product, TryOnConfig } from './types';
import { styles } from './ui/styles';
import { renderModal } from './ui/modal';
import { renderPanel } from './ui/panel';
import { createViewer, Viewer } from './ui/viewer';
import { icons } from './ui/icons';
import { fromHtml } from './ui/dom';

const HOST_ID = 'tryon-widget-root';

export class TryOnWidget {
  private readonly api: TryOnApi;
  private readonly store = new Store();
  private readonly productCache = new Map<string, Product>();

  private host: HTMLElement | null = null;
  private shadow: ShadowRoot | null = null;
  private container: HTMLElement | null = null;
  private booting: Promise<void> | null = null;
  /** Guards against a second render being queued while one is in flight. */
  private generating = false;
  /**
   * Lives on the shadow root rather than in `container`, which is emptied and
   * rebuilt on every state change — keeping it here is what lets a shopper stay
   * zoomed in while a new look finishes rendering behind them.
   */
  private viewer: Viewer | null = null;

  constructor(private readonly config: TryOnConfig) {
    this.api = new TryOnApi(config.apiUrl, config.key);
  }

  // ── lifecycle ───────────────────────────────────────────────────────────

  async start(): Promise<void> {
    this.mount();
    if (this.config.autoBind) this.bindTriggers();
    await this.boot();
  }

  private mount(): void {
    if (this.host) return;

    this.host = document.createElement('div');
    this.host.id = HOST_ID;
    // The host itself must not participate in the merchant's layout.
    this.host.style.cssText = 'all:initial;position:static;';

    this.shadow = this.host.attachShadow({ mode: 'open' });

    const style = document.createElement('style');
    style.textContent = styles;
    this.shadow.appendChild(style);

    this.container = document.createElement('div');
    this.shadow.appendChild(this.container);

    document.body.appendChild(this.host);

    this.store.subscribe(() => this.render());
    document.addEventListener('keydown', this.onKeydown);
  }

  destroy(): void {
    // Before the host goes: the viewer owns a document-level keydown listener.
    this.closeViewer();
    document.removeEventListener('keydown', this.onKeydown);
    document.removeEventListener('click', this.onDocumentClick, true);
    document.documentElement.classList.remove('tryon-panel-open');
    this.host?.remove();
    this.host = null;
    this.shadow = null;
    this.container = null;
  }

  /** One bootstrap per page load, shared by every caller. */
  private boot(): Promise<void> {
    if (this.booting) return this.booting;

    this.booting = (async () => {
      try {
        const data = await this.api.bootstrap(readVisitorToken());
        writeVisitorToken(data.visitorToken);

        const last = data.recent.find((g) => g.resultUrl) ?? null;
        this.store.set({
          ready: true,
          merchant: data.merchant,
          visitorToken: data.visitorToken,
          photo: data.photo,
          recent: data.recent,
          current: last,
          stage: data.photo ? (last ? 'ready' : 'idle') : 'empty',
        });
      } catch (error) {
        this.store.set({ ready: true, stage: 'empty', error: message(error) });
        // Leave it visible in the console — a bad key is a merchant setup bug.
        console.error('[TryOn] could not initialise:', message(error));
      }
    })();

    return this.booting;
  }

  // ── trigger binding ─────────────────────────────────────────────────────

  /**
   * Delegated at the document level, and in the capture phase, so it works with
   * content the merchant renders later (React, infinite scroll, quick-view
   * modals) without them re-registering anything.
   */
  private bindTriggers(): void {
    document.addEventListener('click', this.onDocumentClick, true);
  }

  private onDocumentClick = (event: MouseEvent): void => {
    const target = event.target as HTMLElement | null;
    const trigger = target?.closest?.(this.config.selector) as HTMLElement | null;
    if (!trigger) return;

    const sku = trigger.getAttribute(this.config.productAttribute);
    if (!sku) return;

    event.preventDefault();
    event.stopPropagation();
    void this.open(sku);
  };

  private onKeydown = (event: KeyboardEvent): void => {
    if (event.key !== 'Escape') return;
    const state = this.store.get();
    if (state.modalOpen) this.store.set({ modalOpen: false, pendingProduct: null });
    else if (state.panelOpen) this.store.set({ panelOpen: false });
  };

  // ── public actions ──────────────────────────────────────────────────────

  /**
   * The whole flow hinges here: no photo on file means the first-run upload
   * modal, a photo on file means straight into the panel and start rendering.
   */
  async open(sku: string): Promise<void> {
    await this.boot();

    let product: Product | null = null;
    try {
      product = await this.resolveProduct(sku);
    } catch (error) {
      console.error(`[TryOn] unknown product "${sku}":`, message(error));
      this.store.set({ panelOpen: true, error: message(error), stage: 'error' });
      return;
    }

    if (!this.store.get().photo) {
      this.store.set({ modalOpen: true, pendingProduct: product, error: null });
      return;
    }

    this.store.set({ panelOpen: true, error: null });
    await this.generate(product);
  }

  openPanel(): void {
    this.store.set({ panelOpen: true });
  }

  close(): void {
    this.store.set({ modalOpen: false, panelOpen: false, pendingProduct: null });
  }

  getState() {
    return this.store.get();
  }

  // ── internals ───────────────────────────────────────────────────────────

  private async resolveProduct(sku: string): Promise<Product> {
    const cached = this.productCache.get(sku);
    if (cached) return cached;

    const { product } = await this.api.getProduct(sku);
    this.productCache.set(sku, product);
    return product;
  }

  private async generate(product: Product, force = false): Promise<void> {
    const { visitorToken } = this.store.get();
    if (!visitorToken || this.generating) return;

    this.generating = true;
    this.store.set({
      stage: 'generating',
      pendingProduct: product,
      current: null,
      error: null,
    });

    try {
      const { generation, cached } = await this.api.requestTryOn(
        visitorToken,
        product.externalId,
        force,
      );

      const settled =
        cached && generation.status === 'succeeded'
          ? generation
          : await this.api.waitForGeneration(visitorToken, generation.id);

      if (settled.status !== 'succeeded' || !settled.resultUrl) {
        this.store.set({
          stage: 'error',
          error: settled.error ?? 'The render did not complete.',
          pendingProduct: null,
        });
        return;
      }

      this.store.set({
        stage: 'ready',
        current: settled,
        recent: dedupe([settled, ...this.store.get().recent]),
        pendingProduct: null,
        error: null,
      });
    } catch (error) {
      this.store.set({ stage: 'error', error: message(error), pendingProduct: null });
    } finally {
      this.generating = false;
    }
  }

  private async upload(file: File): Promise<void> {
    this.store.set({ uploading: true, error: null });

    try {
      const { visitorToken, photo } = await this.api.uploadPhoto(
        file,
        this.store.get().visitorToken,
      );
      writeVisitorToken(visitorToken);

      const pending = this.store.get().pendingProduct;
      this.store.set({
        uploading: false,
        visitorToken,
        photo,
        current: null,
        modalOpen: false,
        panelOpen: true,
        stage: 'idle',
        error: null,
      });

      // Whatever they clicked before we asked for a photo now renders.
      if (pending) await this.generate(pending);
    } catch (error) {
      this.store.set({ uploading: false, error: message(error) });
    }
  }

  private async uploadDefault(): Promise<void> {
    this.store.set({ uploading: true, error: null });
    try {
      const url = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=900&q=80';
      const response = await fetch(url);
      const blob = await response.blob();
      const file = new File([blob], 'default-model.jpg', { type: blob.type });
      await this.upload(file);
    } catch (error) {
      this.store.set({ uploading: false, error: 'Could not load default model. Please try again.' });
    }
  }

  private async removePhoto(): Promise<void> {
    const { visitorToken } = this.store.get();
    if (!visitorToken) return;

    try {
      await this.api.deletePhoto(visitorToken);
    } catch (error) {
      console.warn('[TryOn] could not delete photo:', message(error));
    }

    clearVisitorToken();
    this.productCache.clear();
    this.store.set({
      photo: null,
      current: null,
      recent: [],
      pendingProduct: null,
      stage: 'empty',
      panelOpen: false,
      error: null,
    });
    // A new token is minted so the cleared visitor starts genuinely fresh.
    this.booting = null;
    void this.boot();
  }

  // ── rendering ───────────────────────────────────────────────────────────

  /** Opens the zoomable full view. Re-opening replaces whatever was showing. */
  private openViewer(url: string, alt: string, caption: string): void {
    if (!this.shadow) return;
    this.closeViewer();
    this.viewer = createViewer(url, alt, caption, () => this.closeViewer());
    this.shadow.appendChild(this.viewer.element);
  }

  private closeViewer(): void {
    this.viewer?.close();
    this.viewer = null;
  }

  private render(): void {
    if (!this.container) return;

    const state = this.store.get();
    this.container.textContent = '';

    // Documented hook: merchants can reflow their layout around the open panel.
    document.documentElement.classList.toggle(
      'tryon-panel-open',
      state.panelOpen && !state.modalOpen,
    );

    if (state.modalOpen) {
      this.container.appendChild(
        renderModal(state, state.pendingProduct, {
          onClose: () => this.store.set({ modalOpen: false, pendingProduct: null, error: null }),
          onUpload: (file) => void this.upload(file),
          onSkip: () => void this.uploadDefault(),
        }),
      );
    }

    if (state.panelOpen && !state.modalOpen) {
      this.container.appendChild(
        renderPanel(state, {
          onClose: () => {
            this.closeViewer();
            this.store.set({ panelOpen: false });
          },
          onSelectLook: (look: Generation | null) =>
            this.store.set({ current: look, stage: look ? 'ready' : 'idle', error: null }),
          onChangePhoto: (file) => void this.upload(file),
          onRemovePhoto: () => void this.removePhoto(),
          onRetry: () => {
            const product = state.pendingProduct ?? this.lastProduct(state.current);
            if (product) void this.generate(product, true);
          },
          onUpload: (file) => void this.upload(file),
          onExpand: (url, alt, caption) => this.openViewer(url, alt, caption),
        }),
      );
    }

    if (state.ready && state.photo && !state.panelOpen && !state.modalOpen) {
      const launcher = fromHtml(
        `<button class="launcher" type="button">${icons.sparkles(14)} Try-on studio</button>`,
      );
      launcher.addEventListener('click', () => this.openPanel());
      this.container.appendChild(launcher);
    }
  }

  private lastProduct(generation: Generation | null): Product | null {
    const sku = generation?.product?.externalId;
    return sku ? this.productCache.get(sku) ?? null : null;
  }
}

const dedupe = (looks: Generation[]): Generation[] => {
  const seen = new Set<string>();
  return looks.filter((look) => (seen.has(look.id) ? false : seen.add(look.id) && true)).slice(0, 12);
};

const message = (error: unknown): string =>
  error instanceof ApiError || error instanceof Error
    ? error.message
    : 'Something went wrong. Please try again.';
