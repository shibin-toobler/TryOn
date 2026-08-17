import { TryOnWidget } from './widget';
import { TryOnConfig } from './types';

declare global {
  interface Window {
    TryOn?: TryOnPublicApi;
  }
}

interface TryOnPublicApi {
  init(options: Partial<TryOnConfig> & { key?: string }): TryOnWidget;
  open(sku: string): void;
  openPanel(): void;
  close(): void;
  destroy(): void;
  instance: TryOnWidget | null;
  version: string;
}

const DEFAULTS: Omit<TryOnConfig, 'key' | 'apiUrl'> = {
  selector: '[data-tryon-product]',
  productAttribute: 'data-tryon-product',
  autoBind: true,
};

let instance: TryOnWidget | null = null;

/**
 * The tag that loaded us. `document.currentScript` is null for async scripts
 * once they execute, so fall back to finding ourselves by the key attribute.
 */
function findScript(): HTMLScriptElement | null {
  const current = document.currentScript as HTMLScriptElement | null;
  if (current?.dataset.tryonKey) return current;
  return document.querySelector<HTMLScriptElement>('script[data-tryon-key]');
}

function configFromScript(script: HTMLScriptElement | null): Partial<TryOnConfig> {
  if (!script) return {};

  const data = script.dataset;
  // Default the API base to wherever this bundle was served from, so the usual
  // one-attribute embed just works.
  const inferredApi = script.src ? new URL(script.src, window.location.href).origin : '';

  return {
    key: data.tryonKey ?? '',
    apiUrl: data.tryonApi ?? inferredApi,
    selector: data.tryonSelector ?? DEFAULTS.selector,
    productAttribute: data.tryonAttribute ?? DEFAULTS.productAttribute,
    autoBind: data.tryonAuto !== 'false',
  };
}

function init(options: Partial<TryOnConfig> = {}): TryOnWidget {
  if (instance) return instance;

  const fromScript = configFromScript(findScript());
  const config: TryOnConfig = {
    ...DEFAULTS,
    ...fromScript,
    ...options,
    key: options.key ?? fromScript.key ?? '',
    apiUrl: (options.apiUrl ?? fromScript.apiUrl ?? '').replace(/\/$/, ''),
  } as TryOnConfig;

  if (!config.key) {
    throw new Error('[TryOn] a publishable key is required (data-tryon-key="pk_…").');
  }
  if (!config.apiUrl) {
    throw new Error('[TryOn] could not determine the API URL. Set data-tryon-api.');
  }

  instance = new TryOnWidget(config);
  void instance.start();
  return instance;
}

const api: TryOnPublicApi = {
  init,
  open: (sku: string) => void (instance ?? init()).open(sku),
  openPanel: () => (instance ?? init()).openPanel(),
  close: () => instance?.close(),
  destroy: () => {
    instance?.destroy();
    instance = null;
  },
  get instance() {
    return instance;
  },
  version: '1.0.0',
};

window.TryOn = api;

// Auto-start when the tag carries a key. `defer`/`async` may land before or
// after DOMContentLoaded, so handle both.
function autoStart(): void {
  const script = findScript();
  if (!script?.dataset.tryonKey) return;
  try {
    init();
  } catch (error) {
    console.error((error as Error).message);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', autoStart, { once: true });
} else {
  autoStart();
}

export type { TryOnConfig };
