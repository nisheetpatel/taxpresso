import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Replaced by esbuild at build time (scripts/build-common.mjs) and by vitest (vitest.config.ts).
declare const __TAXPRESSO_VERSION__: string | undefined;
declare const __TAXPRESSO_DISTRIBUTION__: string | undefined;

/**
 * Which build runs: the desktop extension for Claude Desktop ('mcpb', also tests and development),
 * the Claude plugin for Claude Code and Cowork ('plugin', `pnpm build:plugin`), or the ChatGPT
 * plugin for the ChatGPT desktop app ('chatgpt', `pnpm build:chatgpt`, docs/spikes/S6.md).
 */
export type Distribution = 'mcpb' | 'plugin' | 'chatgpt';
export const DISTRIBUTION: Distribution =
  typeof __TAXPRESSO_DISTRIBUTION__ === 'string' &&
  (__TAXPRESSO_DISTRIBUTION__ === 'plugin' || __TAXPRESSO_DISTRIBUTION__ === 'chatgpt')
    ? __TAXPRESSO_DISTRIBUTION__
    : 'mcpb';

// What this build calls the assistant and its apps. Everything the server says that differs between
// Claude and ChatGPT is here, each written `(flag && ChatGPT's words) || Claude's words` on the
// build flag itself: esbuild folds that form even when it doesn't minify, where it would keep both
// sides of a `?:`. So a build holds its own words only, and scripts/check-chatgpt-plugin.mjs fails
// if the ChatGPT package names Claude anywhere. The UI has the same (ui/src/shared/distribution.ts).

/** The assistant the user talks to: every sentence that names it takes the name from here. */
export const ASSISTANT: string =
  (typeof __TAXPRESSO_DISTRIBUTION__ === 'string' &&
    __TAXPRESSO_DISTRIBUTION__ === 'chatgpt' &&
    'ChatGPT') ||
  'Claude';

/** The app the server runs in, as a sentence names it: "while … is running". */
export const ASSISTANT_APP: string =
  (typeof __TAXPRESSO_DISTRIBUTION__ === 'string' &&
    __TAXPRESSO_DISTRIBUTION__ === 'chatgpt' &&
    'the ChatGPT desktop app') ||
  'Claude Desktop';

/**
 * open_dashboard, for the assistant: where the dashboard stays while the user works. For ChatGPT,
 * only what OpenAI documents (docs/spikes/S6.md): a view can show in the conversation; nothing
 * about the app's buttons or panes, which nobody has looked at yet.
 */
export const KEEP_DASHBOARD_BESIDE: string =
  (typeof __TAXPRESSO_DISTRIBUTION__ === 'string' &&
    __TAXPRESSO_DISTRIBUTION__ === 'chatgpt' &&
    'Keep it beside the chat: it shows in the conversation where the app allows it; if it does not show there, give the user this link to open in a browser on this computer.') ||
  'Keep it beside the chat: in the chat it floats next to the conversation where the app allows it; in Cowork or the Code tab, open this link in the built-in browser pane next to the chat.';

/** get_status's runtime.distribution, described for the host. */
export const DISTRIBUTION_NOTE: string =
  (typeof __TAXPRESSO_DISTRIBUTION__ === 'string' &&
    __TAXPRESSO_DISTRIBUTION__ === 'chatgpt' &&
    'Set when this is the ChatGPT plugin (the ChatGPT desktop app).') ||
  'Set when this is the Claude plugin (Claude Code, Cowork), not the desktop extension.';

/**
 * Fills the assistant's name into texts that come from the libraries and the questionnaire data
 * (packages/, data/): they are pure and know no build, so they write `{assistant}` where a sentence
 * names it. The server calls this where it takes such a result, before anything reads it.
 */
export function named<T>(value: T): T {
  if (typeof value === 'string') return value.replaceAll('{assistant}', ASSISTANT) as T;
  if (Array.isArray(value)) return value.map(named) as T;
  if (
    value !== null &&
    typeof value === 'object' &&
    Object.getPrototypeOf(value) === Object.prototype
  )
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, named(v)])) as T;
  return value;
}

/**
 * The tax year this release prepares by default (SPEC.md section 1): the year that opens when the
 * user hasn't chosen another one (./years.ts). Product scope, not a tax constant.
 */
export const CURRENT_TAX_YEAR = 2026;

export const UI_LANGUAGES = ['en', 'fr', 'de', 'it'] as const;
export type UiLanguage = (typeof UI_LANGUAGES)[number];

export interface Config {
  version: string;
  /** The default tax year (CURRENT_TAX_YEAR); the open one is the user's choice (./years.ts). */
  taxYear: number;
  /** User-visible folder holding documents and the ledger (manifest user_config `vault_path`). */
  vaultPath: string;
  uiLanguage: UiLanguage;
  /** Folder with the built UI: `dashboard/` (localhost page) and `views/` (MCP Apps resources). */
  uiDir: string;
  /**
   * Today's date as YYYY-MM-DD, for what depends on it (a year that is over, the TOU deadline).
   * Absent: the computer's date. Tests give a fixed one.
   */
  today?: () => string;
}

export function defaultVaultPath(): string {
  return path.join(os.homedir(), 'Documents', 'Taxpresso');
}

export function isUiLanguage(value: unknown): value is UiLanguage {
  return typeof value === 'string' && (UI_LANGUAGES as readonly string[]).includes(value);
}

/**
 * Reads the configuration Claude Desktop passes through the manifest's `mcp_config.env`.
 * An unset or unsubstituted value (`${user_config...}`) falls back to the default.
 */
export function readConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const given = (name: string): string | undefined => {
    const value = env[name]?.trim();
    return value && !value.startsWith('${') ? value : undefined;
  };
  const language = given('TAXPRESSO_UI_LANGUAGE')?.toLowerCase() ?? 'en';
  // The bundle lives at <extension>/server/index.mjs and the UI at <extension>/ui.
  const bundledUiDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'ui');
  return {
    version: typeof __TAXPRESSO_VERSION__ === 'string' ? __TAXPRESSO_VERSION__ : '0.0.0-dev',
    taxYear: CURRENT_TAX_YEAR,
    vaultPath: path.resolve(given('TAXPRESSO_VAULT_PATH') ?? defaultVaultPath()),
    uiLanguage: isUiLanguage(language) ? language : 'en',
    uiDir: path.resolve(given('TAXPRESSO_UI_DIR') ?? bundledUiDir),
  };
}

/** Shows a path with the home folder as `~`, so results stay short and don't repeat the user name. */
export function displayPath(p: string): string {
  const home = os.homedir();
  return p === home || p.startsWith(home + path.sep) ? '~' + p.slice(home.length) : p;
}
