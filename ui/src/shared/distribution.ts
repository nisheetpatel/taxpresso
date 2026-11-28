// Which build of the dashboard this is, fixed at build time (ui/vite.config.ts and
// ui/scripts/build-views.mjs; the server has the same flag, extension/scripts/build-common.mjs):
// - 'mcpb': the desktop extension for Claude Desktop (`pnpm build`);
// - 'plugin': the Claude plugin for Claude Code and Cowork (`pnpm build:plugin`);
// - 'chatgpt': the ChatGPT plugin for the ChatGPT desktop app (`pnpm build:chatgpt`,
//   docs/spikes/S6.md).
// Anything only one of them shows asks here, so the other build leaves its code out entirely.

declare const __TAXPRESSO_DISTRIBUTION__: string | undefined;

export type Distribution = 'mcpb' | 'plugin' | 'chatgpt';

/** This build's distribution: 'mcpb' unless the build said otherwise (tests and `vite dev`: 'mcpb'). */
export const DISTRIBUTION: Distribution =
  typeof __TAXPRESSO_DISTRIBUTION__ === 'string' &&
  (__TAXPRESSO_DISTRIBUTION__ === 'plugin' || __TAXPRESSO_DISTRIBUTION__ === 'chatgpt')
    ? __TAXPRESSO_DISTRIBUTION__
    : 'mcpb';

// What this build calls the assistant and its app. Everything the dashboard says that differs
// between Claude and ChatGPT is here, each written `(flag && ChatGPT's words) || Claude's words` on
// the build flag itself: esbuild (the in-chat view) folds that form even when it doesn't minify,
// where it would keep both sides of a `?:`. So a build holds its own words only, and
// scripts/check-chatgpt-plugin.mjs fails if the ChatGPT package names Claude anywhere. The server
// has the same (extension/src/config.ts).

/** The assistant the user talks to: every sentence that names it takes the name from here. */
export const ASSISTANT: string =
  (typeof __TAXPRESSO_DISTRIBUTION__ === 'string' &&
    __TAXPRESSO_DISTRIBUTION__ === 'chatgpt' &&
    'ChatGPT') ||
  'Claude';

/** The app Taxpresso runs in, as a sentence of each language names it ("It stops when … closes"). */
export const ASSISTANT_APP: Record<'en' | 'fr' | 'de' | 'it', string> = {
  en:
    (typeof __TAXPRESSO_DISTRIBUTION__ === 'string' &&
      __TAXPRESSO_DISTRIBUTION__ === 'chatgpt' &&
      'the ChatGPT desktop app') ||
    'Claude Desktop',
  fr:
    (typeof __TAXPRESSO_DISTRIBUTION__ === 'string' &&
      __TAXPRESSO_DISTRIBUTION__ === 'chatgpt' &&
      'l’application de bureau ChatGPT') ||
    'Claude Desktop',
  de:
    (typeof __TAXPRESSO_DISTRIBUTION__ === 'string' &&
      __TAXPRESSO_DISTRIBUTION__ === 'chatgpt' &&
      'die ChatGPT-Desktop-App') ||
    'Claude Desktop',
  it:
    (typeof __TAXPRESSO_DISTRIBUTION__ === 'string' &&
      __TAXPRESSO_DISTRIBUTION__ === 'chatgpt' &&
      'l’app desktop di ChatGPT') ||
    'Claude Desktop',
};

/**
 * Whether the filing page may show the café donation menu (SPEC.md section 12), once the user has
 * filed. The .mcpb only: the owner keeps it out of the plugins (docs/spikes/S4.md), and the plugin
 * checks (scripts/check-plugin.mjs, scripts/check-chatgpt-plugin.mjs) fail if its link reaches one.
 */
export function showsDonationMenu(distribution: Distribution = DISTRIBUTION): boolean {
  return distribution === 'mcpb';
}
