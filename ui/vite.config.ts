import { defineConfig } from 'vite';

// The dashboard is served by the extension on 127.0.0.1 under a strict CSP
// (extension/src/dashboard.ts): no inline scripts or styles, every asset a file.
export default defineConfig({
  base: '/',
  build: {
    outDir: 'dist/dashboard',
    emptyOutDir: true,
    assetsInlineLimit: 0,
    modulePreload: { polyfill: false },
  },
});
