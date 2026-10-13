#!/usr/bin/env node
// Dev tool: builds dist/preview/index.html, a page that hosts the open_dashboard MCP Apps view the way
// Claude Desktop does (sandboxed iframe + postMessage), so it can be seen without Claude Desktop.
// Run after `pnpm build` in ui/. Not part of the extension (scripts/build.mjs copies only
// dist/dashboard and dist/views).

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const viewHtml = await readFile(path.join(root, 'dist/views/open-dashboard.html'), 'utf8');

const { outputFiles } = await build({
  entryPoints: [path.join(root, 'src/preview/card-host.ts')],
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: 'es2022',
  minify: true,
  write: false,
  legalComments: 'none',
  define: { __VIEW_HTML__: JSON.stringify(viewHtml) },
});

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Taxpresso · MCP Apps card preview</title>
<style>
  body { margin: 0; padding: 32px 16px; font: 14px/1.5 ui-sans-serif, system-ui, sans-serif; background: #f4f4f2; color: #16181b; }
  [data-theme='dark'] body { background: #262624; color: #f2f2ef; }
  main { max-width: 680px; margin: 0 auto; display: flex; flex-direction: column; gap: 16px; }
  .bubble { align-self: flex-end; background: #e9e8e3; border-radius: 16px; padding: 10px 14px; }
  [data-theme='dark'] .bubble { background: #3a3936; }
  iframe { width: 100%; height: 240px; border: 1px solid #dcddd8; border-radius: 14px; background: transparent; }
  [data-theme='dark'] iframe { border-color: #3a3936; }
  .muted { color: #6b7078; font-size: 12px; }
  ol { margin: 0; padding-left: 18px; }
</style>
</head>
<body>
<main>
  <p class="muted">Preview host: this page stands in for Claude Desktop. The card below is the real view from the extension.</p>
  <div class="bubble">Open my Taxpresso dashboard.</div>
  <iframe id="view" title="Taxpresso card" sandbox="allow-scripts"></iframe>
  <ol id="log" class="muted"></ol>
</main>
<script type="module">${outputFiles[0].text.replace(/<\/script/gi, '<\\/script')}</script>
</body>
</html>
`;
await mkdir(path.join(root, 'dist/preview'), { recursive: true });
await writeFile(path.join(root, 'dist/preview/index.html'), html);
console.log('dist/preview/index.html');
