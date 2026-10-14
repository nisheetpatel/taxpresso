import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Replaced by esbuild at build time (scripts/build.mjs) and by vitest (vitest.config.ts).
declare const __TAXPRESSO_VERSION__: string | undefined;

/** The tax year this release prepares (SPEC.md section 1). Product scope, not a tax constant. */
export const CURRENT_TAX_YEAR = 2026;

export const UI_LANGUAGES = ['en', 'fr', 'de', 'it'] as const;
export type UiLanguage = (typeof UI_LANGUAGES)[number];

export interface Config {
  version: string;
  taxYear: number;
  /** User-visible folder holding documents and the ledger (manifest user_config `vault_path`). */
  vaultPath: string;
  uiLanguage: UiLanguage;
  /** Folder with the built UI: `dashboard/` (localhost page) and `views/` (MCP Apps resources). */
  uiDir: string;
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
