import { build, context } from 'esbuild';
import { fileURLToPath } from 'url';
import path from 'path';

const root = path.dirname(fileURLToPath(import.meta.url));
const watch = process.argv.includes('--watch');

/**
 * Single self-contained IIFE. It runs on merchant pages we do not control, so:
 * no globals leak, no runtime dependencies, ES2019 to cover older browsers.
 */
const options = {
  entryPoints: [path.join(root, 'src/index.ts')],
  outfile: path.join(root, 'dist/tryon.js'),
  bundle: true,
  format: 'iife',
  // Safari 15 is the floor: esbuild refuses to emit destructuring for Safari 13
  // and 14 because of a bug in those engines, and cannot downlevel it either.
  target: ['es2019', 'chrome80', 'firefox78', 'safari15'],
  minify: !watch,
  sourcemap: watch ? 'inline' : false,
  legalComments: 'none',
  banner: {
    js: '/* TryOn widget — embeddable virtual try-on. */',
  },
};

if (watch) {
  const ctx = await context(options);
  await ctx.watch();
  console.log('tryon widget: watching for changes…');
} else {
  const result = await build({ ...options, metafile: true });
  const bytes = Object.values(result.metafile.outputs)[0]?.bytes ?? 0;
  console.log(`tryon widget: built dist/tryon.js (${(bytes / 1024).toFixed(1)} kB)`);
}
