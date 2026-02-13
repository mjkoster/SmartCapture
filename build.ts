/**
 * Build script for Smart Capture Chrome extension.
 *
 * Uses esbuild (bundled with tsx) to bundle each entry point,
 * then copies manifest, HTML, CSS, and icons to dist/.
 *
 * Run: tsx build.ts
 */

import { execSync } from 'child_process';
import { cpSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'fs';
import { resolve, dirname } from 'path';

const ROOT = dirname(new URL(import.meta.url).pathname);
const DIST = resolve(ROOT, 'dist');
const ESBUILD = '/usr/local/lib/node_modules_global/lib/node_modules/tsx/node_modules/.bin/esbuild';

// Clean dist
if (existsSync(DIST)) rmSync(DIST, { recursive: true });
mkdirSync(DIST, { recursive: true });
mkdirSync(resolve(DIST, 'icons'), { recursive: true });

console.log('[build] Cleaned dist/');

// Bundle entry points
const entries = [
  { input: 'src/background/service-worker.ts', output: 'dist/service-worker.js', format: 'esm' },
  { input: 'src/content/content-script.ts', output: 'dist/content-script.js', format: 'iife' },
  { input: 'src/ui/popup/popup.ts', output: 'dist/popup.js', format: 'esm' },
  { input: 'src/ui/options/options.ts', output: 'dist/options.js', format: 'esm' },
];

for (const entry of entries) {
  console.log(`[build] Bundling ${entry.input}`);
  const cmd = `${ESBUILD} ${entry.input} --bundle --format=${entry.format} --target=es2020 --outfile=${entry.output}`;
  execSync(cmd, { cwd: ROOT, stdio: 'inherit' });
}

// Copy manifest
cpSync(resolve(ROOT, 'manifest.json'), resolve(DIST, 'manifest.json'));

// Copy and patch popup HTML (change .ts → .js)
const popupHtml = readFileSync(resolve(ROOT, 'src/ui/popup/popup.html'), 'utf-8')
  .replace('type="module" src="popup.ts"', 'type="module" src="popup.js"');
writeFileSync(resolve(DIST, 'popup.html'), popupHtml);
cpSync(resolve(ROOT, 'src/ui/popup/popup.css'), resolve(DIST, 'popup.css'));

// Copy and patch options HTML
const optionsHtml = readFileSync(resolve(ROOT, 'src/ui/options/options.html'), 'utf-8')
  .replace('type="module" src="options.ts"', 'type="module" src="options.js"');
writeFileSync(resolve(DIST, 'options.html'), optionsHtml);
cpSync(resolve(ROOT, 'src/ui/options/options.css'), resolve(DIST, 'options.css'));

// Copy icons if present
const srcIcons = resolve(ROOT, 'public/icons');
if (existsSync(srcIcons)) {
  cpSync(srcIcons, resolve(DIST, 'icons'), { recursive: true });
}

console.log('[build] Done! Extension ready in dist/');
