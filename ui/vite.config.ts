import { defineConfig } from 'vite';

// The dashboard is served by the extension on 127.0.0.1 under a strict CSP
// (extension/src/dashboard.ts): no inline scripts or styles, every asset a file.
//
// Two builds (ui/src/shared/distribution.ts): `vite build` for the .mcpb, into dist/dashboard;
// `vite build --mode plugin` for the Claude plugin, into dist/plugin/dashboard. The plugin's is
// readable (not minified) and split into files under 256 KiB, as Anthropic's plugin directory asks
// (docs/spikes/S4.md).
export default defineConfig(({ mode }) => {
  const plugin = mode === 'plugin';
  return {
    base: '/',
    define: { __TAXPRESSO_DISTRIBUTION__: JSON.stringify(plugin ? 'plugin' : 'mcpb') },
    build: {
      outDir: plugin ? 'dist/plugin/dashboard' : 'dist/dashboard',
      emptyOutDir: true,
      assetsInlineLimit: 0,
      modulePreload: { polyfill: false },
      ...(plugin && {
        minify: false,
        rolldownOptions: {
          output: {
            // Cutting the app into files by size leaves import cycles between them; strict
            // execution order runs each module when it is first needed, in the source's order,
            // so a cycle can't call a function before its file has run.
            strictExecutionOrder: true,
            codeSplitting: {
              groups: [
                { name: 'vendor', test: /[\\/]node_modules[\\/]/, maxSize: 200 * 1024 },
                { name: 'dashboard', maxSize: 200 * 1024 },
              ],
            },
          },
        },
      }),
    },
  };
});
