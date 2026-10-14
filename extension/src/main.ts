// Entry point of the bundle Claude Desktop runs (server/index.mjs in the .mcpb).
// stdout carries MCP messages only; anything else goes to stderr.

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { setBarcodeWasmPath } from '@taxpresso/intake';
import { createApi } from './api.js';
import { readConfig } from './config.js';
import { Dashboard } from './dashboard.js';
import { createTaxpressoServer } from './server.js';
import { TaxYears } from './years.js';

// stdout is the MCP channel. Anything a library prints there by habit goes to stderr instead.
for (const level of ['log', 'info', 'debug'] as const) console[level] = console.error.bind(console);

const config = readConfig();
// The barcode reader's WebAssembly ships next to this bundle (extension/scripts/build.mjs) and is
// read from disk: never located or downloaded.
setBarcodeWasmPath(path.join(path.dirname(fileURLToPath(import.meta.url)), 'zxing_reader.wasm'));
// The tax years and the one the user has open (./years.ts): each year its own folder and workspace,
// whose canton is the user's first answer (./cantons.ts).
const years = new TaxYears(config);
const dashboard = new Dashboard({
  dir: path.join(config.uiDir, 'dashboard'),
  api: createApi(years),
});

const handle = serveStdio(() => createTaxpressoServer({ years, dashboard }), {
  onerror: (err) => console.error('[taxpresso]', err.message),
});

let stopping = false;
async function shutdown(): Promise<void> {
  if (stopping) return;
  stopping = true;
  await Promise.allSettled([dashboard.stop(), handle.close()]);
  process.exit(0);
}

// Claude Desktop ends the extension by closing stdin or by a signal.
process.stdin.on('end', () => void shutdown());
process.stdin.on('close', () => void shutdown());
process.on('SIGTERM', () => void shutdown());
process.on('SIGINT', () => void shutdown());
