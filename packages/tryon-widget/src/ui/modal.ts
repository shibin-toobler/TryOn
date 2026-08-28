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

        <div class="upload-drop">
          <div style="color:var(--tryon-accent); margin-bottom:25px;">
            ${icons.imagePlus(34)}
          </div>
          <h2>${esc(headline)}</h2>
          <p class="lede">
            Drop a clear full-body photo here to begin your AI try-on experience.
          </p>

          <label class="upload-btn${busy ? ' is-busy' : ''}">
            <span class="upload-label">${busy ? 'Uploading…' : 'Choose photo'}</span>
            ${icons.arrowRight(16)}
            <input type="file" accept="image/jpeg,image/png,image/webp" ${busy ? 'disabled' : ''}>
          </label>

          ${
            handlers.onSkip
              ? `<button type="button" class="skip-btn ghost-btn" style="margin-top:12px;">Skip & use default model</button>`
              : ''
          }

          ${state.error ? `<p class="fine" role="alert" style="color:var(--tryon-accent)">${esc(state.error)}</p>` : ''}

          <p class="fine">
            JPG or PNG · Your image stays connected to your profile
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
