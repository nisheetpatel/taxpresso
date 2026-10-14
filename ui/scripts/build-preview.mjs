#!/usr/bin/env node
// Dev tool: builds dist/preview/index.html, a page that hosts the dashboard MCP Apps view the way
// Claude Desktop does (sandboxed iframe + postMessage, the hosts' default CSP), so it can be seen
// without Claude Desktop. Run after `pnpm build` in ui/. Serve ui/dist with
// scripts/preview-serve.mjs to use the view against a real extension. Not part of the extension
// (extension/scripts/build.mjs copies only dist/dashboard and dist/views).

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const viewHtml = await readFile(path.join(root, 'dist/views/dashboard.html'), 'utf8');

const { outputFiles } = await build({
  entryPoints: [path.join(root, 'src/preview/view-host.ts')],
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
<title>Taxpresso · MCP Apps view preview</title>
<style>
  body { margin: 0; padding: 24px 16px; font: 14px/1.5 ui-sans-serif, system-ui, sans-serif; background: #f4f4f2; color: #16181b; }
  [data-theme='dark'] body { background: #262624; color: #f2f2ef; }
  main { max-width: 760px; margin: 0 auto; display: flex; flex-direction: column; gap: 16px; }
  .bar { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
  .bar button { font: inherit; padding: 6px 12px; border-radius: 8px; border: 1px solid #c9c9c4; background: transparent; color: inherit; cursor: pointer; }
  .bubble { align-self: flex-end; background: #e9e8e3; border-radius: 16px; padding: 10px 14px; }
  [data-theme='dark'] .bubble { background: #3a3936; }
  iframe { width: 100%; height: 240px; border: 1px solid #dcddd8; border-radius: 14px; background: transparent; }
  [data-theme='dark'] iframe { border-color: #3a3936; }
  [data-mode='fullscreen'] iframe { position: fixed; inset: 0; width: 100vw; height: 100vh !important; border: none; border-radius: 0; z-index: 10; }
  [data-mode='pip'] iframe { position: fixed; top: 16px; right: 16px; width: min(420px, calc(100vw - 32px)); height: calc(100vh - 120px) !important; z-index: 10; box-shadow: 0 12px 40px rgba(0, 0, 0, 0.22); }
  [data-mode='pip'] main { margin-left: max(16px, calc(50vw - 600px)); margin-right: 460px; }
  .composer { position: fixed; left: 50%; bottom: 16px; transform: translateX(-50%); width: min(680px, calc(100vw - 32px)); padding: 12px 16px; border-radius: 16px; background: #ffffff; color: #6b7078; box-shadow: 0 4px 24px rgba(0, 0, 0, 0.18); z-index: 20; }
  [data-theme='dark'] .composer { background: #30302e; color: #a8a8a3; }
  .muted { color: #6b7078; font-size: 12px; }
  ol { margin: 0; padding-left: 18px; }
  .spacer { height: 80px; }
</style>
</head>
<body>
<main>
  <p class="muted">Preview host: this page stands in for Claude Desktop. The view below is the real one from the extension.</p>
  <div class="bar"><button id="theme" type="button">Light or dark</button><button id="mode" type="button">Inline, beside the chat or full screen (host side)</button></div>
  <div class="bubble">Open my Taxpresso dashboard.</div>
  <iframe id="view" title="Taxpresso dashboard" sandbox="allow-scripts"></iframe>
  <ol id="log" class="muted"></ol>
  <div class="spacer"></div>
</main>
<div class="composer" aria-hidden="true">Reply to Claude… (the chat stays at hand)</div>
<script type="module">${outputFiles[0].text.replace(/<\/script/gi, '<\\/script')}</script>
</body>
</html>
`;
await mkdir(path.join(root, 'dist/preview'), { recursive: true });
await writeFile(path.join(root, 'dist/preview/index.html'), html);
console.log('dist/preview/index.html');
