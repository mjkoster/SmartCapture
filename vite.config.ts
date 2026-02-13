import { defineConfig } from 'vite';
import { resolve } from 'path';
import { copyFileSync, mkdirSync, existsSync } from 'fs';

/**
 * Vite config for building a Chrome MV3 extension.
 *
 * Builds multiple entry points (service worker, content script, popup, options)
 * and copies the manifest + icons into the dist folder.
 *
 * Note: content_scripts cannot use ES module format in MV3, so we use 'es'
 * for the service worker (which supports type: module) and rely on Vite's
 * bundling to inline all imports into each entry point.
 */
export default defineConfig({
  build: {
    target: 'ES2020',
    outDir: 'dist',
    emptyOutDir: true,
    // Inline everything — no dynamic imports / code splitting.
    // This ensures content-script.js is a single self-contained file.
    rollupOptions: {
      input: {
        'service-worker': resolve(__dirname, 'src/background/service-worker.ts'),
        'content-script': resolve(__dirname, 'src/content/content-script.ts'),
        popup: resolve(__dirname, 'src/ui/popup/popup.html'),
        options: resolve(__dirname, 'src/ui/options/options.html'),
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
        // Use es format — service worker declares type: module in manifest.
        // Content script: we'll rely on inlining (no dynamic imports).
        format: 'es',
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  plugins: [
    {
      name: 'copy-extension-files',
      writeBundle() {
        // Copy manifest.json
        copyFileSync(
          resolve(__dirname, 'manifest.json'),
          resolve(__dirname, 'dist/manifest.json'),
        );

        // Create icons directory and copy placeholder icons
        const iconsDir = resolve(__dirname, 'dist/icons');
        if (!existsSync(iconsDir)) {
          mkdirSync(iconsDir, { recursive: true });
        }

        // Copy icons if they exist
        const srcIcons = resolve(__dirname, 'public/icons');
        for (const size of ['icon-16.png', 'icon-48.png', 'icon-128.png']) {
          const src = resolve(srcIcons, size);
          if (existsSync(src)) {
            copyFileSync(src, resolve(iconsDir, size));
          }
        }
      },
    },
  ],
});
