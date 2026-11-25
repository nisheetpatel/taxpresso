// Which build of the dashboard this is, fixed at build time (ui/vite.config.ts and
// ui/scripts/build-views.mjs; the server has the same flag, extension/scripts/build-common.mjs):
// - 'mcpb': the desktop extension for Claude Desktop (`pnpm build`);
// - 'plugin': the Claude plugin for Claude Code and Cowork (`pnpm build:plugin`).
// Anything only one of them shows asks here, so the other build leaves its code out entirely.

declare const __TAXPRESSO_DISTRIBUTION__: string | undefined;

export type Distribution = 'mcpb' | 'plugin';

/** This build's distribution: 'mcpb' unless the build said 'plugin' (tests and `vite dev`: 'mcpb'). */
export const DISTRIBUTION: Distribution =
  typeof __TAXPRESSO_DISTRIBUTION__ === 'string' && __TAXPRESSO_DISTRIBUTION__ === 'plugin'
    ? 'plugin'
    : 'mcpb';

/**
 * Whether the filing page may show the café donation menu (SPEC.md section 12), once the user has
 * filed. The .mcpb only: the owner keeps it out of the Claude plugin (docs/spikes/S4.md), and the
 * plugin check (scripts/check-plugin.mjs) fails if its link reaches the plugin.
 */
export function showsDonationMenu(distribution: Distribution = DISTRIBUTION): boolean {
  return distribution === 'mcpb';
}
