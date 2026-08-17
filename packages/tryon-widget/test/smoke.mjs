/**
 * End-to-end smoke test for the built plugin, run against a live API.
 *
 *   node test/smoke.mjs <publishableKey> [apiUrl]
 *
 * Loads dist/tryon.js into a jsdom page that mimics a merchant storefront and
 * walks the two entry paths the plugin has:
 *   1. no photo on file  -> first-run upload modal
 *   2. photo on file     -> straight into the floating panel, render starts
 */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import assert from 'assert';
import { JSDOM, VirtualConsole } from 'jsdom';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const KEY = process.argv[2];
const API = (process.argv[3] ?? 'http://localhost:4000').replace(/\/$/, '');

if (!KEY) {
  console.error('usage: node test/smoke.mjs <publishableKey> [apiUrl]');
  process.exit(1);
}

const bundle = readFileSync(path.join(root, 'dist/tryon.js'), 'utf8');

const PAGE = `<!doctype html><html><body>
  <button class="try" data-tryon-product="SELENE-001">Try on 1</button>
  <button class="try" data-tryon-product="SELENE-002" data-tryon-url="/p/satin-slip">Try on 2</button>
</body></html>`;

function makePage() {
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', (e) => console.error('  [jsdom]', e.message));

  const dom = new JSDOM(PAGE, {
    url: 'http://localhost:3000/',
    runScripts: 'outside-only',
    pretendToBeVisual: true,
    virtualConsole,
  });

  const { window } = dom;
  // jsdom ships no fetch; hand it Node's, plus the multipart primitives.
  Object.assign(window, {
    fetch: (input, init) => fetch(input, init),
    FormData,
    File,
    Blob,
    Headers,
    Request,
    Response,
  });

  window.eval(bundle);
  return { dom, window };
}

const settle = (ms) => new Promise((r) => setTimeout(r, ms));

/** Waits for a selector inside the widget's shadow root. */
async function waitForShadow(window, selector, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const host = window.document.getElementById('tryon-widget-root');
    const found = host?.shadowRoot?.querySelector(selector);
    if (found) return found;
    if (Date.now() > deadline) {
      const html = host?.shadowRoot?.innerHTML?.slice(0, 600) ?? '(no shadow root)';
      throw new Error(`timed out waiting for "${selector}".\nShadow root was:\n${html}`);
    }
    await settle(200);
  }
}

const shadow = (window) =>
  window.document.getElementById('tryon-widget-root')?.shadowRoot ?? null;

/** Case 1: a brand-new visitor must be asked for a photo. */
async function testFirstRunModal() {
  console.log('\n1. First-time shopper -> upload modal');
  const { window } = makePage();

  window.TryOn.init({ key: KEY, apiUrl: API });
  await waitForShadow(window, 'style');

  window.document.querySelector('[data-tryon-product="SELENE-001"]').click();

  const backdrop = await waitForShadow(window, '.backdrop');
  const root = shadow(window);

  assert.ok(backdrop, 'modal backdrop should render');
  assert.ok(root.querySelector('.upload input[type=file]'), 'modal offers a file input');
  assert.ok(!root.querySelector('.floating-studio'), 'panel must NOT open before a photo exists');

  const heading = root.querySelector('.upload h2').textContent.trim();
  const garment = root.querySelector('.visual-chip')?.textContent.trim();
  console.log(`   modal headline: "${heading}"`);
  console.log(`   garment chip:   "${garment}"`);
  assert.match(garment, /Silk Column Dress/, 'chip names the clicked product');

  // Escape closes it.
  window.document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape' }));
  await settle(150);
  assert.ok(!shadow(window).querySelector('.backdrop'), 'Escape closes the modal');
  console.log('   ✓ modal shown, names the product, closes on Escape');
}

/**
 * Case 2: a returning visitor whose photo is already on file. Uploads the photo
 * through the API first, then hands the widget that visitor token the way
 * localStorage would.
 */
async function testReturningVisitorPanel() {
  console.log('\n2. Returning shopper (photo on file) -> panel + render');

  const boot = await fetch(`${API}/v1/widget/bootstrap`, {
    headers: { 'x-tryon-key': KEY },
  }).then((r) => r.json());

  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==',
    'base64',
  );
  const form = new FormData();
  form.append('visitorToken', boot.visitorToken);
  form.append('photo', new Blob([png], { type: 'image/png' }), 'me.png');

  const uploaded = await fetch(`${API}/v1/widget/photos`, {
    method: 'POST',
    headers: { 'x-tryon-key': KEY },
    body: form,
  }).then((r) => r.json());
  assert.ok(uploaded.photo?.url, 'photo upload should return a URL');
  console.log(`   seeded visitor ${boot.visitorToken} with a photo`);

  const { window } = makePage();
  window.localStorage.setItem('tryon.visitorToken', boot.visitorToken);
  window.TryOn.init({ key: KEY, apiUrl: API });

  // With a photo but no open panel, the launcher pill should appear.
  await waitForShadow(window, '.launcher');
  console.log('   ✓ launcher pill shown for a returning visitor');

  window.document.querySelector('[data-tryon-product="SELENE-002"]').click();

  // Panel opens immediately — no modal in this path.
  const panel = await waitForShadow(window, '.floating-studio');
  assert.ok(panel, 'panel should open');
  assert.ok(!shadow(window).querySelector('.backdrop'), 'no upload modal for a known visitor');

  await waitForShadow(window, '.generating');
  const busyTitle = shadow(window).querySelector('.panel-top h3').textContent.trim();
  console.log(`   generating state: "${busyTitle}"`);
  assert.match(
    shadow(window).querySelector('.generating .label b').textContent,
    /Satin Slip Dress/,
    'loading copy names the garment',
  );

  // Wait for the render to land.
  const chip = await waitForShadow(window, '.look-chip b', 60_000);
  const root = shadow(window);
  const img = root.querySelector('.model-preview img');
  const thumbs = root.querySelectorAll('.preview-thumb');

  console.log(`   result chip:    "${chip.textContent.trim()}"`);
  console.log(`   result image:   ${img.getAttribute('src')}`);
  console.log(`   dock thumbs:    ${thumbs.length}`);
  console.log(`   simulated badge: ${Boolean(root.querySelector('.sim-badge'))}`);

  assert.match(chip.textContent, /Satin Slip Dress/, 'chip names the rendered garment');
  assert.ok(img.getAttribute('src').startsWith('http'), 'stage shows the generated image');
  assert.ok(thumbs.length >= 2, 'dock holds "my photo" plus at least one look');
  assert.ok(
    root.querySelector('.panel-footer a.primary'),
    'footer links back to the product page',
  );
  assert.equal(
    root.querySelector('.panel-footer a.primary').getAttribute('href'),
    '/p/satin-slip',
    'link uses the trigger\'s data-tryon-url',
  );
  assert.ok(
    window.document.documentElement.classList.contains('tryon-panel-open'),
    'documentElement is marked while the panel is open',
  );

  // Selecting the "my photo" thumbnail goes back to the bare photo.
  thumbs[0].click();
  await settle(200);
  assert.ok(!shadow(window).querySelector('.look-chip'), 'first thumb shows the plain photo');
  console.log('   ✓ panel rendered the look, dock switches back to the photo');
}

/** Case 3: a bad SKU must fail visibly, not silently. */
async function testUnknownSku() {
  console.log('\n3. Unknown SKU -> error state');
  const { window } = makePage();
  window.TryOn.init({ key: KEY, apiUrl: API });
  await waitForShadow(window, 'style');

  const button = window.document.createElement('button');
  button.setAttribute('data-tryon-product', 'DOES-NOT-EXIST');
  window.document.body.appendChild(button);
  button.click();

  const message = await waitForShadow(window, '.stage-message.is-error p');
  console.log(`   error shown: "${message.textContent.trim().slice(0, 80)}…"`);
  assert.match(message.textContent, /No active product/, 'surfaces the API message');
  console.log('   ✓ error surfaced in the panel');
}

async function main() {
  console.log(`Running plugin smoke test against ${API}`);
  await testFirstRunModal();
  await testReturningVisitorPanel();
  await testUnknownSku();
  console.log('\nAll plugin smoke tests passed.\n');
}

main().catch((error) => {
  console.error('\nSMOKE TEST FAILED:', error.message);
  process.exit(1);
});
