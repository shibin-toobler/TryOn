import { esc, fromHtml } from './dom';

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

export interface Viewer {
  element: HTMLElement;
  close(): void;
}

export function createViewer(
  src: string,
  alt: string,
  caption: string,
  onClose: () => void,
): Viewer {
  const element = fromHtml(`
    <div class="viewer" role="dialog" aria-modal="true" aria-label="${esc(caption || 'Image viewer')}">
      <div class="viewer-stage">
        <img src="${esc(src)}" alt="${esc(alt)}" draggable="false" style="opacity:0">
      </div>
      <div class="viewer-bar">
        ${caption ? `<span class="viewer-cap">${esc(caption)}</span>` : ''}
        <button class="viewer-zo" type="button" aria-label="Zoom out">&minus;</button>
        <button class="viewer-pct" type="button" title="Reset to fit (0)">…</button>
        <button class="viewer-zi" type="button" aria-label="Zoom in">+</button>
        <button class="viewer-fit" type="button">Fit</button>
        <a class="viewer-dl" href="${esc(src)}" download title="Download">&darr;</a>
        <button class="viewer-x" type="button" aria-label="Close viewer">&times;</button>
      </div>
    </div>
  `);

  const stage = element.querySelector('.viewer-stage') as HTMLElement;
  const image = element.querySelector('img') as HTMLImageElement;
  const bar = element.querySelector('.viewer-bar') as HTMLElement;
  const pct = element.querySelector('.viewer-pct') as HTMLButtonElement;
  const fitBtn = element.querySelector('.viewer-fit') as HTMLButtonElement;
  const zoomInBtn = element.querySelector('.viewer-zi') as HTMLButtonElement;
  const zoomOutBtn = element.querySelector('.viewer-zo') as HTMLButtonElement;

  let natural: { w: number; h: number } | null = null;
  let fit = 1;
  let scale: number | null = null;
  let off = { x: 0, y: 0 };

  /** Scale at which the whole image fits the stage, never magnified past 1:1. */
  function measure(nat: { w: number; h: number } | null): number {
    const box = stage.getBoundingClientRect();
    if (!box.width || !nat) return 1;
    // Breathing room so the image never runs flush into the chrome.
    const f = Math.min((box.width - 48) / nat.w, (box.height - 48) / nat.h);
    return clamp(Math.min(1, f), MIN_SCALE, 1);
  }

  function paint(): void {
    if (!natural || scale === null) return;
    image.style.opacity = '1';
    image.style.width = `${natural.w}px`;
    image.style.height = `${natural.h}px`;
    // Half the UNSCALED size, which is what left/top:50% offsets against — the
    // transform then scales about that centred box. Layout centring cannot be
    // used here: transforms apply after layout, so a 1500px-tall image would
    // size a 1500px track inside a 700px stage and hang off the bottom.
    image.style.marginLeft = `${-natural.w / 2}px`;
    image.style.marginTop = `${-natural.h / 2}px`;
    image.style.transform = `translate(${off.x}px, ${off.y}px) scale(${scale})`;

    const atFit = Math.abs(scale - fit) < 0.001;
    pct.textContent = `${Math.round(scale * 100)}%`;
    fitBtn.disabled = atFit;
    zoomInBtn.disabled = scale >= MAX_SCALE;
    zoomOutBtn.disabled = scale <= MIN_SCALE;
    stage.classList.toggle('grab', scale > fit + 0.001);
  }

  function reset(): void {
    fit = measure(natural);
    scale = fit;
    off = { x: 0, y: 0 };
    paint();
  }

  /** Scale about a point in viewport coordinates, keeping that point stationary. */
  function zoomTo(next: number, originX: number, originY: number): void {
    if (scale === null) return;
    const s = clamp(next, MIN_SCALE, MAX_SCALE);
    const box = stage.getBoundingClientRect();
    // Pointer position relative to the stage centre, where the image sits.
    const px = originX - (box.left + box.width / 2);
    const py = originY - (box.top + box.height / 2);
    const k = s / scale;
    off = { x: px - (px - off.x) * k, y: py - (py - off.y) * k };
    scale = s;
    paint();
  }

  function zoomBy(factor: number): void {
    if (scale === null) return;
    const box = stage.getBoundingClientRect();
    zoomTo(scale * factor, box.left + box.width / 2, box.top + box.height / 2);
  }

  image.addEventListener('load', () => {
    natural = { w: image.naturalWidth, h: image.naturalHeight };
    reset();
  });
  if (image.complete && image.naturalWidth) {
    natural = { w: image.naturalWidth, h: image.naturalHeight };
    reset();
  }

  // A resize invalidates the fit scale. Re-fit only when the shopper has not
  // zoomed away from it — otherwise resizing throws away their zoom.
  const onResize = (): void => {
    if (!natural) return;
    const next = measure(natural);
    const wasAtFit = scale === null || Math.abs(scale - fit) < 0.001;
    fit = next;
    if (wasAtFit) {
      scale = next;
      off = { x: 0, y: 0 };
    }
    paint();
  };
  window.addEventListener('resize', onResize);

  // ── Toolbar ───────────────────────────────────────────────────────────────
  zoomInBtn.addEventListener('click', () => zoomBy(STEP));
  zoomOutBtn.addEventListener('click', () => zoomBy(1 / STEP));
  pct.addEventListener('click', () => reset());
  fitBtn.addEventListener('click', () => reset());
  (element.querySelector('.viewer-x') as HTMLElement).addEventListener('click', onClose);
  bar.addEventListener('click', (event) => event.stopPropagation());

  // ── Wheel ─────────────────────────────────────────────────────────────────
  // Non-passive so the page behind cannot scroll or browser-zoom under us.
  stage.addEventListener(
    'wheel',
    (event) => {
      event.preventDefault();
      if (scale === null) return;
      zoomTo(scale * Math.exp(-event.deltaY * 0.0015), event.clientX, event.clientY);
    },
    { passive: false },
  );

  // ── Pointer: one is a drag, two are a pinch ───────────────────────────────
  const pointers = new Map<number, { x: number; y: number }>();
  type Gesture =
    | { kind: 'pan'; x: number; y: number; off: { x: number; y: number } }
    | { kind: 'pinch'; startDist: number; startScale: number };
  let gesture: Gesture | null = null;
  // Distinguishes a click-to-close from the end of a drag.
  let moved = false;

  const dist = (a: { x: number; y: number }, b: { x: number; y: number }): number =>
    Math.hypot(a.x - b.x, a.y - b.y);

  stage.addEventListener('pointerdown', (event) => {
    if (event.button === 2) return;
    stage.setPointerCapture?.(event.pointerId);
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    moved = false;
    const pts = [...pointers.values()];
    gesture =
      pts.length === 2
        ? { kind: 'pinch', startDist: dist(pts[0], pts[1]), startScale: scale ?? 1 }
        : { kind: 'pan', x: event.clientX, y: event.clientY, off: { ...off } };
  });

  stage.addEventListener('pointermove', (event) => {
    if (!pointers.has(event.pointerId)) return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const pts = [...pointers.values()];
    if (!gesture) return;

    if (gesture.kind === 'pinch' && pts.length === 2) {
      moved = true;
      const mid = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
      zoomTo((gesture.startScale * dist(pts[0], pts[1])) / gesture.startDist, mid.x, mid.y);
      return;
    }

    if (gesture.kind === 'pan') {
      const dx = event.clientX - gesture.x;
      const dy = event.clientY - gesture.y;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) moved = true;
      // Panning a fitted image would just slide it around empty space.
      if (scale !== null && scale > fit + 0.001) {
        off = { x: gesture.off.x + dx, y: gesture.off.y + dy };
        paint();
      }
    }
  });

  const release = (event: PointerEvent): void => {
    pointers.delete(event.pointerId);
    if (pointers.size === 0) {
      gesture = null;
    } else if (pointers.size === 1) {
      // Second finger lifted — resume panning from where the first one is.
      const [p] = [...pointers.values()];
      gesture = { kind: 'pan', x: p.x, y: p.y, off: { ...off } };
    }
  };
  stage.addEventListener('pointerup', release);
  stage.addEventListener('pointercancel', release);

  /** Double-click is the familiar shortcut: jump to 1:1, or back to fit. */
  stage.addEventListener('dblclick', (event) => {
    if (scale !== null && scale > fit + 0.001) reset();
    else zoomTo(Math.max(1, fit * 3), event.clientX, event.clientY);
  });

  // Only a genuine click on the backdrop closes — never the end of a drag that
  // happened to finish outside the image.
  element.addEventListener('click', (event) => {
    if ((event.target === element || event.target === stage) && !moved) onClose();
  });

  const onKey = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') {
      event.preventDefault();
      // Stops the widget's own Escape handler from closing the panel too.
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key === '+' || event.key === '=') zoomBy(STEP);
    else if (event.key === '-' || event.key === '_') zoomBy(1 / STEP);
    else if (event.key === '0') reset();
  };
  // Capture phase, on the document: the shopper has not necessarily clicked
  // inside the viewer yet, and Escape must reach here before the panel's.
  document.addEventListener('keydown', onKey, true);

  requestAnimationFrame(() => (element.querySelector('.viewer-x') as HTMLElement)?.focus());

  return {
    element,
    close(): void {
      document.removeEventListener('keydown', onKey, true);
      window.removeEventListener('resize', onResize);
      element.remove();
    },
  };
}
