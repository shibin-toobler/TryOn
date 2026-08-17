import { BootstrapResponse, Generation, Photo, Product } from './types';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export class TryOnApi {
  constructor(
    private readonly baseUrl: string,
    private readonly key: string,
  ) {}

  private url(path: string, params: Record<string, string | number | undefined> = {}): string {
    const url = new URL(`${this.baseUrl.replace(/\/$/, '')}/v1/widget${path}`);
    Object.keys(params).forEach((name) => {
      const value = params[name];
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(name, String(value));
      }
    });
    return url.toString();
  }

  private async request<T>(url: string, init: RequestInit = {}): Promise<T> {
    let response: Response;
    try {
      response = await fetch(url, {
        ...init,
        headers: { 'x-tryon-key': this.key, ...(init.headers ?? {}) },
      });
    } catch {
      throw new ApiError(0, 'network_error', 'Could not reach the try-on service.');
    }

    if (response.status === 204) return undefined as T;

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      const error = (payload as { error?: { code?: string; message?: string } } | null)?.error;
      throw new ApiError(
        response.status,
        error?.code ?? 'unknown_error',
        error?.message ?? `Request failed (${response.status}).`,
      );
    }

    return payload as T;
  }

  bootstrap(visitorToken?: string | null, productId?: string): Promise<BootstrapResponse> {
    return this.request<BootstrapResponse>(
      this.url('/bootstrap', { visitorToken: visitorToken ?? undefined, productId }),
    );
  }

  getProduct(externalId: string): Promise<{ product: Product }> {
    return this.request<{ product: Product }>(
      this.url(`/products/${encodeURIComponent(externalId)}`),
    );
  }

  uploadPhoto(file: File, visitorToken?: string | null): Promise<{ visitorToken: string; photo: Photo }> {
    const form = new FormData();
    form.append('photo', file);
    if (visitorToken) form.append('visitorToken', visitorToken);

    // No Content-Type header — the browser sets the multipart boundary.
    return this.request<{ visitorToken: string; photo: Photo }>(this.url('/photos'), {
      method: 'POST',
      body: form,
    });
  }

  deletePhoto(visitorToken: string): Promise<void> {
    return this.request<void>(this.url('/photos'), {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ visitorToken }),
    });
  }

  requestTryOn(
    visitorToken: string,
    productId: string,
    force = false,
  ): Promise<{ cached: boolean; generation: Generation }> {
    return this.request<{ cached: boolean; generation: Generation }>(this.url('/tryon'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ visitorToken, productId, force }),
    });
  }

  getGeneration(visitorToken: string, id: string): Promise<{ generation: Generation }> {
    return this.request<{ generation: Generation }>(
      this.url(`/generations/${encodeURIComponent(id)}`, { visitorToken }),
    );
  }

  listRecent(visitorToken: string, limit = 12): Promise<{ generations: Generation[] }> {
    return this.request<{ generations: Generation[] }>(this.url('/generations', { visitorToken, limit }));
  }

  /**
   * Polls a queued render until it settles. Generation is slow and variable, so
   * the interval backs off rather than hammering a fixed 1s.
   */
  async waitForGeneration(
    visitorToken: string,
    id: string,
    onTick?: (generation: Generation) => void,
    timeoutMs = 150_000,
  ): Promise<Generation> {
    const deadline = Date.now() + timeoutMs;
    let delay = 1200;

    for (;;) {
      const { generation } = await this.getGeneration(visitorToken, id);
      onTick?.(generation);

      if (generation.status === 'succeeded' || generation.status === 'failed') {
        return generation;
      }
      if (Date.now() > deadline) {
        throw new ApiError(504, 'timeout', 'This is taking longer than expected. Please try again.');
      }

      await new Promise((resolve) => setTimeout(resolve, delay));
      delay = Math.min(delay * 1.25, 4000);
    }
  }
}
