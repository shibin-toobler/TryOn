import { Generation, WidgetState } from '../types';
import { icons } from './icons';
import { esc, formatPrice, fromHtml, on } from './dom';

export interface PanelHandlers {
  onClose(): void;
  onSelectLook(generation: Generation | null): void;
  onChangePhoto(file: File): void;
  onRemovePhoto(): void;
  onRetry(): void;
  onUpload(file: File): void;
  /** Opens the full-size zoomable view of whatever is currently on the stage. */
  onExpand(): void;
}

/**
 * The persistent floating studio. Stays open while the shopper keeps browsing,
 * with every completed look pinned into the dock overlaid on the image.
 */
export function renderPanel(state: WidgetState, handlers: PanelHandlers): HTMLElement {
  const { photo, current, pendingProduct, recent, stage } = state;

  const node = fromHtml(`
    <aside class="floating-studio" role="complementary" aria-label="Virtual try-on studio">
      <div class="panel-top">
        <div>
          <p class="eyebrow">${icons.sparkles(12)} Try-on</p>
          <h3>${esc(panelTitle(state))}</h3>
        </div>
        <button class="panel-close" type="button" aria-label="Close try-on panel">${icons.close(17)}</button>
      </div>

      <div class="panel-stage">${renderStage(state)}</div>

      ${renderStrip(state)}

      ${
        photo
          ? `<div class="panel-info">
               <span class="who">${esc(subtitle(state))}</span>
               <span class="links">
                 <label class="change-photo">Change photo<input type="file" accept="image/jpeg,image/png,image/webp"></label>
                 <button class="remove-photo" type="button">Delete</button>
               </span>
             </div>`
          : ''
      }

      <div class="panel-footer">${renderFooter(state)}</div>
    </aside>
  `);

  on(node, '.panel-close', 'click', handlers.onClose);
  on(node, '.remove-photo', 'click', handlers.onRemovePhoto);
  on(node, '.retry', 'click', handlers.onRetry);

  on(node, '.change-photo input', 'change', (_event, element) => {
    const file = (element as HTMLInputElement).files?.[0];
    if (file) handlers.onChangePhoto(file);
  });

  on(node, '.empty-model input[type=file]', 'change', (_event, element) => {
    const file = (element as HTMLInputElement).files?.[0];
    if (file) handlers.onUpload(file);
  });

  // Both the image itself and the corner button open the full view — the button
  // is what makes it discoverable, the image is what people actually click.
  const expand = (): void => {
    const image = node.querySelector<HTMLImageElement>('.model-preview > img');
    if (!image || stage === 'generating') return;
    handlers.onExpand();
  };
  on(node, '.preview-expand', 'click', expand);
  on(node, '.model-preview > img', 'click', expand);

  on(node, '.shot', 'click', (_event, element) => {
    const id = element.dataset.generationId;
    if (!id) {
      handlers.onSelectLook(null);
      return;
    }
    const look = recent.find((g) => g.id === id);
    if (look) handlers.onSelectLook(look);
  });

  // Generating is a busy state — do not let a second click queue another render.
  if (stage === 'generating') {
    node.querySelectorAll<HTMLElement>('.shot').forEach((shot) => {
      shot.setAttribute('aria-disabled', 'true');
    });
  }

  // --- Drag and Drop Logic ---
  const topBar = node.querySelector<HTMLElement>('.panel-top');
  if (topBar) {
    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let startLeft = 0;
    let startTop = 0;

    // Default cursor for the header is grab
    topBar.style.cursor = 'grab';
    topBar.style.userSelect = 'none';

    topBar.addEventListener('pointerdown', (e) => {
      // Don't drag if they clicked the close button
      if ((e.target as HTMLElement).closest('.panel-close')) return;
      
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      const rect = node.getBoundingClientRect();
      startLeft = rect.left;
      startTop = rect.top;
      
      // Detach from responsive right/bottom constraints to allow free movement
      node.style.right = 'auto';
      node.style.bottom = 'auto';
      node.style.left = `${startLeft}px`;
      node.style.top = `${startTop}px`;
      node.style.maxHeight = 'none';
      
      // Disable CSS animation/transition during drag for immediate response
      node.style.animation = 'none';
      node.style.transition = 'none';
      
      // Change cursor to grabbing while dragging
      topBar.style.cursor = 'grabbing';
      topBar.setPointerCapture(e.pointerId);
    });

    topBar.addEventListener('pointermove', (e) => {
      if (!isDragging) return;
      e.preventDefault();
      
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      
      let newLeft = startLeft + dx;
      let newTop = startTop + dy;
      
      // Constrain panel so it cannot be dragged completely off-screen
      newLeft = Math.max(0, Math.min(newLeft, window.innerWidth - 40));
      newTop = Math.max(0, Math.min(newTop, window.innerHeight - 40));
      
      node.style.left = `${newLeft}px`;
      node.style.top = `${newTop}px`;
    });

    const endDrag = (e: PointerEvent) => {
      if (!isDragging) return;
      isDragging = false;
      // Revert cursor back to grab
      topBar.style.cursor = 'grab';
      topBar.releasePointerCapture(e.pointerId);
    };

    topBar.addEventListener('pointerup', endDrag);
    topBar.addEventListener('pointercancel', endDrag);
  }

  void pendingProduct;
  void current;
  return node;
}

function panelTitle(state: WidgetState): string {
  if (!state.photo) return 'See it on you.';
  switch (state.stage) {
    case 'generating':
      return 'Styling your look…';
    case 'error':
      return 'That did not work.';
    case 'ready':
      return 'Your look.';
    default:
      return 'Ready when you are.';
  }
}

function subtitle(state: WidgetState): string {
  if (state.stage === 'generating' && state.pendingProduct) {
    return `Rendering ${state.pendingProduct.name}`;
  }
  if (state.current?.product?.name) {
    const { name, price, currency } = state.current.product;
    const priceLabel = price && currency ? ` · ${formatPrice(price, currency)}` : '';
    return `${name}${priceLabel}`;
  }
  return 'Your photo';
}

function renderStage(state: WidgetState): string {
  const { photo, current, stage } = state;

  // Errors win over every other state, including "no photo yet" — otherwise a
  // failure before the first upload (a bad SKU, an unreachable API) is silent.
  if (stage === 'error') {
    return `
      <div class="stage-message is-error" role="alert">
        <span class="error-icon">${icons.alert(22)}</span>
        <h4>We could not render that</h4>
        <p>${esc(state.error ?? 'Something went wrong.')}</p>
        ${
          photo
            ? `<button class="secondary small retry" type="button">${icons.refresh(14)} Try again</button>`
            : ''
        }
      </div>`;
  }

  if (!photo) {
    return `
      <div class="empty-model">
        <div class="upload-orb">${icons.imagePlus(25)}</div>
        <h4>Start with your photo</h4>
        <p>Upload once, then keep browsing. Your photo stays here while you try different looks.</p>
        <label class="upload-btn">${icons.upload(15)} Upload photo
          <input type="file" accept="image/jpeg,image/png,image/webp">
        </label>
        <span class="helper">Full-body photo works best · JPG, PNG or WebP</span>
      </div>`;
  }

  // The image on the stage: the finished render if there is one, else the photo.
  const imageUrl = current?.resultUrl ?? photo.url;
  const alt = current?.product?.name ? `You wearing ${current.product.name}` : 'Your uploaded photo';

  return `
    <div class="model-preview">
      <img src="${esc(imageUrl)}" alt="${esc(alt)}">
      <div class="preview-shade"></div>
      ${
        // Hidden mid-render: the generating overlay covers the image anyway, so
        // the button would be a control that visibly does nothing.
        stage === 'generating'
          ? ''
          : `<button class="preview-expand" type="button" aria-label="View full size">
               ${icons.expand(15)}
             </button>`
      }
      ${
        current?.product?.name
          ? `<div class="look-chip">${icons.sparkles(13)}<span>
               <b>${esc(current.product.name)}</b>
               <small>${current.simulated ? 'Simulated preview' : 'AI try-on'}</small>
             </span></div>`
          : ''
      }
      ${current?.simulated ? '<span class="sim-badge">Simulated</span>' : ''}
      ${stage === 'generating' ? renderGenerating(state) : ''}
    </div>`;
}

/**
 * Every look from this session, as a labelled strip under the image.
 *
 * Two things this gets right that an unlabelled dock overlaid on the photo did
 * not: each thumbnail says which garment it is, so a shopper comparing three
 * dresses can tell them apart without clicking through; and the heading counts
 * the looks they have rendered — the original photo is in the strip so they can
 * flip back to it, but it is not one of their looks and is not counted as one.
 */
function renderStrip(state: WidgetState): string {
  const { photo, current, recent } = state;
  if (!photo) return '';

  const looks = recent.filter((look) => Boolean(look.resultUrl));
  // Nothing rendered yet: the strip would only be the photo they can already see.
  if (!looks.length) return '';

  const shots: string[] = [
    `<button class="shot${!current ? ' on' : ''}" type="button" title="Your original photo">
       <img src="${esc(photo.url)}" alt="Your photo">
       <span>Your photo</span>
     </button>`,
  ];

  looks.forEach((look) => {
    const label = look.product?.name ?? 'Look';
    shots.push(
      `<button class="shot${current?.id === look.id ? ' on' : ''}" type="button"
               data-generation-id="${esc(look.id)}" title="${esc(label)}">
         <img src="${esc(look.resultUrl as string)}" alt="${esc(label)}">
         <span>${esc(label)}</span>
       </button>`,
    );
  });

  return `
    <div class="strip-wrap">
      <div class="strip-head">
        ${looks.length} look${looks.length === 1 ? '' : 's'} this session · tap to compare
      </div>
      <div class="strip">${shots.join('')}</div>
    </div>`;
}

function renderGenerating(state: WidgetState): string {
  const name = state.pendingProduct?.name ?? 'your look';
  return `
    <div class="generating" role="status" aria-live="polite">
      <div class="veil"></div>
      <div class="shimmer"></div>
      <div class="label">
        <span class="spark">${icons.sparkles(22)}</span>
        <b>Putting ${esc(name)} on you</b>
        <span>This usually takes 15–30 seconds. Keep browsing — we will drop it in here when it is ready.</span>
      </div>
    </div>`;
}

function renderFooter(state: WidgetState): string {
  if (!state.photo) {
    return '<span class="note">Upload a photo to start trying looks on.</span>';
  }
  if (state.stage === 'generating') {
    return '<span class="note">Working on it…</span>';
  }
  if (state.current?.resultUrl) {
    return `
      <button class="secondary small retry" type="button">${icons.refresh(14)} Redo</button>
      <a class="primary small" href="${esc(productHref(state))}">View product ${icons.arrowRight(14)}</a>`;
  }
  return '<span class="note">Choose <b>Try on</b> on any product to see it here.</span>';
}

/**
 * Merchants can point a look back at their own PDP by tagging the trigger with
 * data-tryon-url; without it the button is inert, so it degrades to a no-op.
 */
function productHref(state: WidgetState): string {
  const sku = state.current?.product?.externalId;
  if (!sku) return '#';

  // CSS.escape is missing in older engines, so fall back to scanning.
  const trigger =
    typeof CSS !== 'undefined' && typeof CSS.escape === 'function'
      ? document.querySelector<HTMLElement>(`[data-tryon-product="${CSS.escape(sku)}"]`)
      : Array.from(document.querySelectorAll<HTMLElement>('[data-tryon-product]')).find(
          (el) => el.getAttribute('data-tryon-product') === sku,
        ) ?? null;

  return trigger?.dataset.tryonUrl ?? trigger?.closest('a')?.getAttribute('href') ?? '#';
}
