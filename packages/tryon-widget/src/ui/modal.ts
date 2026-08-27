import { Product, WidgetState } from '../types';
import { icons } from './icons';
import { esc, fromHtml, on } from './dom';

export interface ModalHandlers {
  onClose(): void;
  onUpload(file: File): void;
  onSkip?(): void;
}

/**
 * The first-run step: a shopper who has never uploaded a photo lands here.
 * Once a photo is on file this screen is never shown again — every later
 * try-on goes straight to the floating panel.
 */
export function renderModal(
  state: WidgetState,
  product: Product | null,
  handlers: ModalHandlers,
): HTMLElement {
  const headline = state.merchant?.theme.headline ?? "Let's see it on you.";
  const busy = state.uploading;

  const node = fromHtml(`
    <div class="backdrop" part="backdrop" role="dialog" aria-modal="true" aria-label="Virtual try-on">
      <div class="studio">
        <button class="close" type="button" aria-label="Close try-on">${icons.close(19)}</button>

        <div class="visual">
          ${product ? `<img src="${esc(product.imageUrl)}" alt="">` : ''}
          ${
            product
              ? `<span class="visual-chip">${icons.sparkles(13)} Next up · ${esc(product.name)}</span>`
              : ''
          }
        </div>

        <div class="upload">
          <div class="upload-icon">${icons.imagePlus(27)}</div>
          <p class="eyebrow">Your virtual model</p>
          <h2>${esc(headline)}</h2>
          <p class="lede">
            Upload one clear, full-body photo. It stays with you while you browse,
            so every look after this one appears instantly${product ? ` — starting with the ${esc(product.name)}` : ''}.
          </p>

          <label class="upload-btn${busy ? ' is-busy' : ''}">
            ${icons.upload(16)}
            <span class="upload-label">${busy ? 'Uploading…' : 'Upload photo'}</span>
            <input type="file" accept="image/jpeg,image/png,image/webp" ${busy ? 'disabled' : ''}>
          </label>

          ${
            handlers.onSkip
              ? `<button type="button" class="skip-btn" style="background:transparent;border:none;color:var(--tryon-ink);font-size:11px;font-weight:600;margin-top:12px;cursor:pointer;text-decoration:underline;">Skip & use default model</button>`
              : ''
          }

          ${state.error ? `<p class="fine" role="alert" style="color:var(--tryon-accent)">${esc(state.error)}</p>` : ''}

          <p class="fine">
            JPG, PNG or WebP · full body works best.<br>
            Your photo is used only to render your try-ons and you can delete it at any time.
          </p>
        </div>
      </div>
    </div>
  `);

  on(node, '.close', 'click', handlers.onClose);
  if (handlers.onSkip) on(node, '.skip-btn', 'click', handlers.onSkip);

  // Clicking the dimmed area closes; clicking inside the card must not.
  node.addEventListener('mousedown', (event) => {
    if (event.target === node) handlers.onClose();
  });

  on(node, '.upload-btn input', 'change', (_event, element) => {
    const file = (element as HTMLInputElement).files?.[0];
    if (file) handlers.onUpload(file);
  });

  return node;
}
