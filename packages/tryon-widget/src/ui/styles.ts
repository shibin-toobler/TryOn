/**
 * All widget CSS, injected into the shadow root — nothing here can touch the
 * merchant's page and nothing on their page can touch this.
 *
 * Fonts are system stacks on purpose: a webfont means a network request the
 * merchant's CSP may block, and a flash of unstyled text on their site.
 */
export const styles = `
:host {
  --tryon-ink: #171719;
  --tryon-muted: #77747a;
  --tryon-paper: #f6f4f0;
  --tryon-line: #dedbd5;
  --tryon-accent: #d06c4f;
  --tryon-panel: #fbfaf7;
  --tryon-serif: Georgia, 'Times New Roman', serif;
  --tryon-sans: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;

  all: initial;
  font-family: var(--tryon-sans);
  color: var(--tryon-ink);
}

*, *::before, *::after { box-sizing: border-box; }

button {
  font: inherit; color: inherit; border: 0; background: none;
  cursor: pointer; padding: 0; margin: 0;
}
img { display: block; width: 100%; height: 100%; object-fit: cover; }
h2, h3, h4, p { margin: 0; }

.eyebrow {
  font-size: 9px; letter-spacing: .18em; text-transform: uppercase;
  color: var(--tryon-muted); display: inline-flex; align-items: center; gap: 6px;
}
.primary, .secondary {
  display: inline-flex; align-items: center; justify-content: center; gap: 9px;
  padding: 13px 20px; border-radius: 999px; font-size: 12px; font-weight: 600;
  transition: transform .15s ease, opacity .15s ease;
}
.primary { background: var(--tryon-ink); color: #fff; }
.secondary { background: transparent; border: 1px solid #c9c5bf; }
.primary:hover, .secondary:hover { transform: translateY(-1px); }
.primary:disabled, .secondary:disabled { opacity: .5; cursor: not-allowed; transform: none; }
.primary.small { padding: 10px 15px; font-size: 11px; }
.secondary.small { padding: 10px 15px; font-size: 11px; }

/* ── First-run modal — the "upload your photo" step ─────────────────────── */
.backdrop {
  position: fixed; inset: 0; z-index: 2147483000;
  background: rgba(20,19,21,.52); backdrop-filter: blur(8px);
  display: grid; place-items: center; padding: 30px;
  animation: tryon-fade .22s ease;
}
.studio {
  width: min(460px, 96vw); min-height: 520px;
  background: #fff; position: relative;
  display: flex; flex-direction: column;
  border-radius: 26px; padding: 52px 48px 36px;
  box-shadow: 0 30px 90px rgba(0,0,0,.24);
  animation: tryon-rise .28s cubic-bezier(.2,.8,.3,1);
}
.close {
  position: absolute; right: 17px; top: 17px; width: 36px; height: 36px;
  border-radius: 50%; background: rgba(255,255,255,.82);
  display: grid; place-items: center; z-index: 4;
}
.visual { display: none; }
.upload-drop {
  min-height: 440px;
  border: 1.5px dashed #bdbdb8;
  border-radius: 18px;
  background: linear-gradient(145deg, #f0efff, #f5f6ec);
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  text-align: center; padding: 40px;
}
.upload-drop h2 {
  font-family: 'Playfair Display', serif; font-size: clamp(30px, 3.4vw, 42px);
  line-height: 1.02; margin: 0 0 15px; font-weight: 500; letter-spacing: -.04em;
}
.upload-drop .lede {
  font-size: 13px; line-height: 1.6; color: var(--tryon-muted);
  max-width: 370px; margin-bottom: 24px;
}
.upload-drop .fine { font-size: 9px; color: #999; margin-top: 13px; line-height: 1.6; }
.ghost-btn {
  border: 1px solid #c9c9c4; background: rgba(255,255,255,.35);
  height: 47px; border-radius: 99px; padding: 0 20px;
  display: inline-flex; align-items: center; justify-content: center; gap: 8px; font-size: 12px; font-weight: 600;
  transition: transform .15s ease;
}
.ghost-btn:hover { transform: translateY(-1px); }
.upload-btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 9px;
  padding: 14px 21px; border-radius: 999px; background: var(--tryon-ink);
  color: #fff; font-size: 12px; font-weight: 600; cursor: pointer;
  transition: transform .15s ease;
}
.upload-btn:hover { transform: translateY(-1px); }
.upload-btn.is-busy { opacity: .6; pointer-events: none; }
.upload-btn input, .change-photo input { display: none; }

/* ── Persistent floating panel — every try-on after the first upload ────── */
.floating-studio {
  position: fixed; z-index: 2147482000; right: 16px; top: 88px; bottom: 16px;
  width: 360px; background: rgba(251,250,247,.98);
  border: 1px solid rgba(222,219,213,.95); border-radius: 24px;
  box-shadow: 0 20px 55px rgba(27,24,20,.14); backdrop-filter: blur(18px);
  display: flex; flex-direction: column; overflow: hidden;
  animation: tryon-slide .3s cubic-bezier(.2,.8,.3,1);
}
.panel-top {
  padding: 18px 18px 12px; display: flex;
  justify-content: space-between; align-items: flex-start; gap: 12px;
}
.panel-top .eyebrow { margin-bottom: 7px; font-size: 8px; }
.panel-top h3 {
  font-family: var(--tryon-serif); font-size: 26px; font-weight: 500; line-height: 1.05;
}
.panel-close {
  width: 31px; height: 31px; border-radius: 50%; background: #efede8;
  display: grid; place-items: center; flex: 0 0 31px;
}
.panel-stage {
  flex: 1; min-height: 0; margin: 0 10px; border-radius: 18px;
  background: #e8e2d9; overflow: hidden; position: relative;
}
.model-preview { height: 100%; position: relative; }
.model-preview > img { cursor: zoom-in; }
.preview-shade {
  position: absolute; inset: 0; pointer-events: none;
  background: linear-gradient(180deg, rgba(16,15,18,0) 50%, rgba(16,15,18,.5) 100%);
}
/* Sits opposite the look chip so it never covers the garment name. */
.preview-expand {
  position: absolute; right: 12px; top: 12px; z-index: 3;
  width: 32px; height: 32px; border-radius: 10px;
  display: grid; place-items: center; color: #fff;
  background: rgba(20,19,21,.42); border: 1px solid rgba(255,255,255,.22);
  backdrop-filter: blur(10px); cursor: pointer; opacity: .85;
  transition: opacity .15s ease, background .15s ease;
}
.preview-expand:hover { opacity: 1; background: rgba(20,19,21,.6); }
.preview-expand:focus-visible { outline: 2px solid #fff; outline-offset: 2px; opacity: 1; }
.look-chip {
  position: absolute; left: 12px; top: 12px; z-index: 3; max-width: calc(100% - 24px);
  display: flex; align-items: center; gap: 8px; padding: 8px 11px; border-radius: 12px;
  background: rgba(20,19,21,.42); border: 1px solid rgba(255,255,255,.22);
  backdrop-filter: blur(10px); color: #fff;
}
.look-chip b { display: block; font-size: 11px; font-weight: 600; }
.look-chip small { display: block; font-size: 9px; opacity: .82; margin-top: 2px; }
.sim-badge {
  position: absolute; right: 12px; top: 12px; z-index: 3;
  font-size: 8px; letter-spacing: .12em; text-transform: uppercase;
  padding: 5px 8px; border-radius: 99px; color: #fff;
  background: rgba(20,19,21,.5); border: 1px solid rgba(255,255,255,.28);
  backdrop-filter: blur(10px);
}

/* Session strip — under the image, not over it, so every look is labelled and
   the garment names stay readable. */
.strip-wrap { padding: 10px 16px 0; }
.strip-head {
  font-size: 10.5px; font-weight: 700; letter-spacing: .07em; text-transform: uppercase;
  color: var(--tryon-muted); margin: 0 0 7px;
}
.strip {
  display: flex; gap: 8px; overflow-x: auto; padding-bottom: 5px;
  scrollbar-width: thin;
}
.shot {
  flex: 0 0 66px; padding: 0; border-radius: 10px; overflow: hidden;
  border: 1px solid var(--tryon-line); background: #fff;
  display: flex; flex-direction: column; text-align: left; cursor: pointer;
  transition: border-color .13s, box-shadow .13s;
}
.shot:hover { border-color: var(--tryon-accent); }
.shot.on {
  border-color: var(--tryon-accent);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--tryon-accent) 26%, transparent);
}
.shot img { width: 100%; aspect-ratio: 3 / 4; object-fit: cover; display: block; }
.shot span {
  font-size: 9.5px; line-height: 1.3; color: var(--tryon-muted);
  padding: 4px 5px 5px;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
}
.shot.on span { color: var(--tryon-ink); font-weight: 600; }
.shot[aria-disabled=true] { opacity: .5; pointer-events: none; }

/* Stage states */
.empty-model, .stage-message {
  height: 100%; padding: 26px 24px; text-align: center;
  display: flex; flex-direction: column; justify-content: center; align-items: center;
}
.upload-orb {
  width: 58px; height: 58px; border-radius: 50%; background: #f7f4ee;
  display: grid; place-items: center; margin-bottom: 16px;
}
.empty-model h4, .stage-message h4 {
  font-family: var(--tryon-serif); font-size: 25px; font-weight: 500; margin-bottom: 9px;
}
.empty-model p, .stage-message p {
  font-size: 11px; line-height: 1.65; color: var(--tryon-muted);
  max-width: 235px; margin-bottom: 17px;
}
.helper { font-size: 9px; color: #96918c; margin-top: 11px; line-height: 1.5; max-width: 220px; }

.generating { position: absolute; inset: 0; z-index: 5; display: grid; place-items: center; }
.generating .veil { position: absolute; inset: 0; background: rgba(246,244,240,.72); backdrop-filter: blur(3px); }
.generating .shimmer {
  position: absolute; inset: 0; overflow: hidden;
  -webkit-mask-image: linear-gradient(#000, #000); mask-image: linear-gradient(#000, #000);
}
.generating .shimmer::after {
  content: ''; position: absolute; inset: 0;
  background: linear-gradient(105deg, transparent 35%, rgba(255,255,255,.75) 50%, transparent 65%);
  animation: tryon-sweep 1.9s ease-in-out infinite;
}
.generating .label {
  position: relative; z-index: 2; text-align: center; padding: 0 22px;
}
.generating .label b { display: block; font-family: var(--tryon-serif); font-size: 21px; font-weight: 500; margin-bottom: 6px; }
.generating .label span { display: block; font-size: 10px; color: var(--tryon-muted); line-height: 1.6; }
.generating .spark { display: inline-flex; margin-bottom: 12px; animation: tryon-pulse 1.6s ease-in-out infinite; }

.stage-message.is-error h4 { font-size: 21px; }
.stage-message .error-icon { color: var(--tryon-accent); margin-bottom: 12px; }

.panel-info {
  display: flex; justify-content: space-between; align-items: center; gap: 10px;
  padding: 11px 18px 0; font-size: 9px; color: var(--tryon-muted);
}
.panel-info .who { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.panel-info b { color: var(--tryon-ink); }
.panel-info .links { display: flex; gap: 10px; flex: 0 0 auto; }
.change-photo, .remove-photo {
  font-size: 9px; color: var(--tryon-muted); text-decoration: underline;
  text-underline-offset: 2px; cursor: pointer;
}
.change-photo:hover, .remove-photo:hover { color: var(--tryon-ink); }

.panel-footer {
  padding: 11px 18px 15px; display: flex; gap: 7px; align-items: center;
}
.panel-footer > .note { font-size: 9px; line-height: 1.55; color: var(--tryon-muted); }
.panel-footer .primary, .panel-footer .secondary { flex: 1; }

/* ── Launcher pill: reopens a panel the shopper closed ──────────────────── */
.launcher {
  position: fixed; right: 18px; bottom: 18px; z-index: 2147482000;
  display: inline-flex; align-items: center; gap: 8px;
  padding: 12px 17px; border-radius: 999px; background: var(--tryon-ink); color: #fff;
  font-size: 11px; font-weight: 600; box-shadow: 0 10px 30px rgba(27,24,20,.28);
  animation: tryon-rise .25s ease;
}
.launcher:hover { transform: translateY(-2px); }

.sr-only {
  position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
  overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0;
}

@keyframes tryon-fade { from { opacity: 0 } to { opacity: 1 } }
@keyframes tryon-rise { from { opacity: 0; transform: translateY(12px) } to { opacity: 1; transform: none } }
@keyframes tryon-slide { from { opacity: 0; transform: translateX(24px) } to { opacity: 1; transform: none } }
@keyframes tryon-sweep { 0% { transform: translateX(-100%) } 60%, 100% { transform: translateX(100%) } }
@keyframes tryon-pulse { 0%, 100% { opacity: .45; transform: scale(.94) } 50% { opacity: 1; transform: scale(1) } }

@media (max-width: 1100px) {
  .floating-studio { width: 330px; }
}
@media (max-width: 900px) {
  .studio { grid-template-columns: 1fr; height: 92vh; overflow: auto; }
  .visual { height: 40vh; min-height: 240px; }
  .backdrop { padding: 0; }
  .upload { padding: 32px 24px; }
  .floating-studio {
    top: auto; left: 10px; right: 10px; bottom: 10px;
    width: auto; height: 76vh; max-height: 650px;
  }
  .panel-top { padding: 14px 15px 9px; }
  .panel-top h3 { font-size: 22px; }
  .strip-wrap { padding: 8px 14px 0; }
  .shot { flex-basis: 58px; }
  .panel-info { padding: 8px 14px 0; }
  .panel-footer { padding: 8px 14px 12px; }
}

/* ── Full-size viewer ─────────────────────────────────────────────────────
   Above the panel, since it is opened from inside it. */

/* MODAL OVERLAY — dark backdrop with centered modal */
.viewer {
  position: fixed; inset: 0; z-index: 2147483100;
  background: rgba(0, 0, 0, 0.55);
  display: flex; justify-content: center; align-items: center;
  padding: 40px; box-sizing: border-box;
}

/* MODAL CONTAINER — large centered card, auto-sizing width */
.viewer-layout {
  display: flex; width: max-content; max-width: 95vw;
  height: 100%; max-height: 85vh;
  background: #fff; border-radius: 14px;
  overflow: hidden;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.25);
}

/* LEFT — preview image (matches 2:3 aspect ratio of generated images) */
.viewer-main {
  height: 100%; aspect-ratio: 2 / 3;
  position: relative; overflow: hidden;
  background: #f0eeea;
}

/* RIGHT — sidebar */
.viewer-sidebar {
  width: 380px; flex-shrink: 0;
  background: #fff;
  display: flex; flex-direction: column;
  border-left: 1px solid #eee;
  overflow-y: auto;
}

/* -- Sidebar header ---------------------------------------------------- */
.viewer-sidebar-header {
  position: relative; padding: 48px 40px 28px;
}
.viewer-sidebar-header .viewer-x {
  position: absolute; right: 20px; top: 20px;
  width: 36px; height: 36px; border-radius: 50%;
  background: transparent; border: 1px solid #ddd;
  display: grid; place-items: center;
  color: var(--tryon-ink); cursor: pointer;
  transition: background 0.15s;
}
.viewer-sidebar-header .viewer-x:hover { background: #f5f5f5; }
.viewer-sidebar-header .eyebrow {
  font-size: 10px; font-weight: 600; letter-spacing: 0.15em;
  text-transform: uppercase; color: #888; margin-bottom: 12px;
}
.viewer-sidebar-header h3 {
  font-family: var(--tryon-serif); font-size: 32px;
  font-weight: 400; line-height: 1.15; margin: 0; color: var(--tryon-ink);
}

/* -- Product card ------------------------------------------------------ */
.viewer-product {
  display: flex; align-items: center; gap: 16px;
  padding: 0 40px 28px;
}
.viewer-product .product-thumb {
  width: 48px; height: 64px; border-radius: 6px;
  overflow: hidden; flex-shrink: 0;
  border: 1px solid #eee;
}
.viewer-product .product-thumb img {
  width: 100%; height: 100%; object-fit: cover; display: block;
}
.viewer-product .product-info { flex: 1; min-width: 0; }
.viewer-product .product-name {
  font-size: 14px; font-weight: 600; margin-bottom: 4px;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.viewer-product .product-meta {
  font-size: 12px; color: #888;
}

/* -- Divider ----------------------------------------------------------- */
.viewer-divider { border: 0; border-top: 1px solid #eee; margin: 0 40px; }

/* -- Recently tried ---------------------------------------------------- */
.viewer-history {
  display: flex; flex-direction: column; padding: 28px 0 0;
}
.history-header {
  display: flex; justify-content: space-between; align-items: center;
  padding: 0 40px 14px;
  font-size: 11px; font-weight: 500; color: #888;
}
.viewer-history-list {
  display: flex; gap: 12px; padding: 0 40px 28px;
  overflow-x: auto; scrollbar-width: none;
}
.viewer-history-list::-webkit-scrollbar { display: none; }

.viewer-sidebar .shot {
  flex: 0 0 72px; height: auto; border-radius: 6px;
  border: 1px solid #eee; background: #fff;
  overflow: hidden; display: flex; flex-direction: column;
  cursor: pointer; transition: border-color 0.15s; padding: 0;
}
.viewer-sidebar .shot img {
  width: 100%; height: 80px; object-fit: cover; display: block;
}
.viewer-sidebar .shot span {
  font-size: 9px; padding: 5px 6px; line-height: 1.2;
  text-align: left; white-space: nowrap;
  overflow: hidden; text-overflow: ellipsis;
  color: #888;
}
.viewer-sidebar .shot:hover { border-color: #aaa; }
.viewer-sidebar .shot.on {
  border-color: var(--tryon-ink);
  box-shadow: 0 0 0 1px var(--tryon-ink);
}
.viewer-sidebar .shot.on span { color: var(--tryon-ink); font-weight: 600; }

/* -- Footer actions ---------------------------------------------------- */
.viewer-footer {
  padding: 20px 40px 36px; margin-top: auto;
}
.viewer-actions {
  display: flex; gap: 12px; margin-bottom: 16px;
}
.viewer-actions .secondary {
  flex: 1; height: 48px; font-size: 13px; font-weight: 500;
  display: inline-flex; align-items: center; justify-content: center; gap: 8px;
  border-radius: 99px; border: 1px solid #ddd; background: #fff;
  color: var(--tryon-ink); cursor: pointer; transition: background 0.15s;
}
.viewer-actions .secondary:hover { background: #f8f8f8; }
.viewer-actions .primary {
  flex: 1; height: 48px; font-size: 13px; font-weight: 500;
  display: inline-flex; align-items: center; justify-content: center; gap: 8px;
  border-radius: 99px; border: none; background: #1a1a1a; color: #fff;
  cursor: pointer; transition: opacity 0.15s;
}
.viewer-actions .primary:hover { opacity: 0.88; }
.viewer-note {
  font-size: 11px; color: #aaa; text-align: center; margin: 0;
}

/* -- Floating pill on the image ---------------------------------------- */
.viewer-pill {
  position: absolute; left: 20px; bottom: 20px; z-index: 10;
  display: inline-flex; align-items: center; gap: 10px;
  padding: 10px 16px; background: rgba(255,255,255,0.95);
  border-radius: 6px; font-size: 12px; font-weight: 500;
  color: var(--tryon-ink);
  box-shadow: 0 2px 12px rgba(0,0,0,0.12);
}
.viewer-pill .pill-sparkle {
  display: inline-flex; align-items: center; justify-content: center;
  width: 22px; height: 22px; background: #f0f0f0; border-radius: 50%;
}
.pill-action {
  margin-left: 6px; color: #4361ee; cursor: pointer;
  text-decoration: underline; text-underline-offset: 2px;
  font-size: 12px;
}
.viewer-file-input, .viewer-file-input-btn { display: none; }

/* -- Responsive -------------------------------------------------------- */
@media (max-width: 900px) {
  .viewer-layout {
    flex-direction: column;
  }
  .viewer-main { flex: 0 0 50%; min-height: 260px; }
  .viewer-sidebar {
    flex: 1 1 auto; width: 100%;
    border-left: none; border-top: 1px solid #eee;
  }
  .viewer-pill { left: 12px; bottom: 12px; }
}

/* -- Image ------------------------------------------------------------- */
.viewer-image {
  width: 100%; height: 100%; object-fit: cover; display: block;
}

@media (max-width: 640px) {
  .viewer-cap { display: none; }
}

@media (prefers-reduced-motion: reduce) {
  *, *::after { animation: none !important; transition: none !important; }
}
`;
