import { esc, fromHtml } from './dom';
import { Generation, WidgetState, Product } from '../types';
import { icons } from './icons';

/**
 * A standard image viewer: opens at a size that fits the screen, and zooms from
 * there under the shopper's control.
 *
 * The rule that makes it feel right is "fit, but never upscale on open" —
 * `min(1, fitScale)`. A 1024×1536 render shrinks to fit the window; a small
 * product cutout opens at its true size instead of being blown up into a blurry
 * wall. Either way the whole picture is visible before anything is magnified,
 * which is the thing a viewer is for. It also means the percentage in the
 * toolbar is honest: it is a percentage of the image's real pixels, not of
 * whatever size it happened to be laid out at.
 *
 * Zoom is anchored to the pointer rather than the centre, so the detail you
 * point at is the detail that grows — centre-anchored zoom sends whatever you
 * were inspecting sliding off screen.
 *
 * Pinch is handled because most shoppers are on a phone, where it is the only
 * zoom gesture anyone will try.
 *
 * Ported from the jewellery POC's ImageViewer, which had already been through
 * this on real tablets.
 */

const MIN_SCALE = 0.1;
const MAX_SCALE = 8;
const STEP = 1.25;

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

export interface ViewerHandlers {
  onClose(): void;
  onSelectLook(look: Generation): void;
  getProduct(sku: string): Product | null;
  onChangePhoto(file: File): void;
  onAddToBag(look: Generation | null): void;
}

export interface Viewer {
  element: HTMLElement;
  close(): void;
  update(state: WidgetState): void;
}

export function createViewer(
  initialState: WidgetState,
  handlers: ViewerHandlers,
): Viewer {
  let currentState = initialState;
  const { onClose, getProduct, onChangePhoto, onAddToBag } = handlers;

  const getDetails = (state: WidgetState) => {
    const src = state.current?.resultUrl ?? state.photo?.url ?? '';
    const caption = state.current?.product?.name ?? 'Your photo';
    const alt = state.current?.product?.name ? `You wearing ${state.current.product.name}` : 'Your photo';
    const product = state.current?.product?.externalId ? getProduct(state.current.product.externalId) : null;
    return { src, caption, alt, product };
  };

  const { src, caption, alt, product } = getDetails(currentState);

  const formatPrice = (p: Product | null) => {
    if (!p || p.price == null) return '';
    return p.currency === 'INR' ? `₹${p.price.toLocaleString('en-IN')}` : `$${p.price.toLocaleString()}`;
  };

  const element = fromHtml(`
    <div class="viewer" role="dialog" aria-modal="true" aria-label="${esc(caption || 'Image viewer')}">
      <div class="viewer-layout">
        
        <div class="viewer-main">
          <img src="${esc(src)}" alt="${esc(alt)}" class="viewer-image" draggable="false">
          
          <div class="viewer-pill">
            <span class="pill-sparkle">${icons.sparkles(12)}</span>
            <span class="pill-text viewer-pill-caption">Preview - ${esc(caption)}</span>
            <label class="pill-action">
              Change Photo
              <input type="file" accept="image/*" class="viewer-file-input">
            </label>
          </div>
        </div>
        
        <div class="viewer-sidebar">
          <div class="viewer-sidebar-header">
            <button class="viewer-x" type="button" aria-label="Close viewer">${icons.close(18)}</button>
            <div class="eyebrow">TRY-ON STUDIO</div>
            <h3>Your look, reimagined.</h3>
          </div>
          
          <div class="viewer-product">
            <div class="product-thumb">
              <img src="${esc(product?.imageUrl ?? src)}" alt="Product thumbnail">
            </div>
            <div class="product-info">
              <div class="product-name">${esc(caption)}</div>
              <div class="product-meta">${esc(product?.category ?? 'Fashion')} ${product?.price ? `- ${formatPrice(product)}` : ''}</div>
            </div>
          </div>
          
          <hr class="viewer-divider">
          
          <div class="viewer-history">
            <div class="history-header">
              <span class="history-title">Recently tried</span>
              <span class="history-count"></span>
            </div>
            <div class="viewer-history-list"></div>
          </div>
          
          <div class="viewer-footer">
            <div class="viewer-actions">
              <label class="secondary small viewer-change-btn">
                ${icons.refresh(12)} Change photo
                <input type="file" accept="image/*" class="viewer-file-input-btn">
              </label>
              <button class="primary small viewer-add-btn">
                Add to bag ${icons.bag(14)}
              </button>
            </div>
            <p class="viewer-note">Try-on preview · Compare your recent looks before choosing.</p>
          </div>
        </div>
        
      </div>
    </div>
  `);

  (element.querySelector('.viewer-x') as HTMLElement).addEventListener('click', onClose);
  
  // File inputs
  const onFileChange = (e: Event) => {
    const input = e.target as HTMLInputElement;
    if (input.files?.[0]) onChangePhoto(input.files[0]);
  };
  element.querySelector('.viewer-file-input')?.addEventListener('change', onFileChange);
  element.querySelector('.viewer-file-input-btn')?.addEventListener('change', onFileChange);
  
  // Add to bag
  element.querySelector('.viewer-add-btn')?.addEventListener('click', () => {
    onAddToBag(currentState.current);
  });

  const onKey = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      onClose();
    }
  };
  document.addEventListener('keydown', onKey, true);

  requestAnimationFrame(() => (element.querySelector('.viewer-x') as HTMLElement)?.focus());

  const renderHistory = () => {
    const list = element.querySelector('.viewer-history-list');
    if (!list) return;
    
    const looks = currentState.recent.filter((look) => Boolean(look.resultUrl));
    if (!looks.length && !currentState.photo) return;
    
    const countEl = element.querySelector('.history-count');
    if (countEl) countEl.textContent = looks.length > 0 ? `1/${looks.length}` : '';
    
    const shots: string[] = [];
    
    if (currentState.photo) {
      shots.push(
        `<button class="shot${!currentState.current ? ' on' : ''}" type="button" title="Your original photo" data-type="photo">
           <img src="${esc(currentState.photo.url)}" alt="Your photo">
           <span>Your photo</span>
         </button>`,
      );
    }
    
    looks.forEach((look) => {
      const label = look.product?.name ?? 'Look';
      shots.push(
        `<button class="shot${currentState.current?.id === look.id ? ' on' : ''}" type="button"
                 data-generation-id="${esc(look.id)}" title="${esc(label)}">
           <img src="${esc(look.resultUrl as string)}" alt="${esc(label)}">
           <span>${esc(label)}</span>
         </button>`,
      );
    });
    
    list.innerHTML = shots.join('');
    
    // Attach click listeners
    list.querySelectorAll('.shot').forEach((shot) => {
      shot.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        const id = target.dataset.generationId;
        if (!id) {
          handlers.onSelectLook(null as any); 
          return;
        }
        const look = currentState.recent.find(g => g.id === id);
        if (look) handlers.onSelectLook(look);
      });
    });
  };
  
  // Initial render
  renderHistory();

  return {
    element,
    close(): void {
      document.removeEventListener('keydown', onKey, true);
      element.remove();
    },
    update(newState: WidgetState): void {
      currentState = newState;
      const { src, caption, alt, product } = getDetails(currentState);
      
      const img = element.querySelector('.viewer-image') as HTMLImageElement;
      const pillCap = element.querySelector('.viewer-pill-caption');
      const dl = element.querySelector('.viewer-dl') as HTMLAnchorElement;
      
      const thumb = element.querySelector('.product-thumb img') as HTMLImageElement;
      const name = element.querySelector('.product-name');
      const meta = element.querySelector('.product-meta');
      
      if (img && img.src !== src) {
        img.src = src;
        img.alt = alt;
        if (dl) dl.href = src;
        if (pillCap) pillCap.textContent = `Preview - ${caption}`;
        
        if (thumb) thumb.src = product?.imageUrl ?? src;
        if (name) name.textContent = caption;
        if (meta) meta.textContent = `${product?.category ?? 'Fashion'} ${product?.price ? `- ${formatPrice(product)}` : ''}`;
      }
      
      renderHistory();
    }
  };
}
