// Types for check-plugin.mjs (the Claude plugin's pre-submission check), for its test.
export const MAX_FILE: number;
export const HELD_FILE: number;
export const HELD_COUNT: number;
export const README_WORDS: number;

export interface PluginCheck {
  /** What would block the submission, stop validation, or stop the plugin installing. */
  errors: string[];
  /** What would hold the version for an Anthropic reviewer. */
  held: string[];
  files: { path: string; size: number }[];
}

export function checkPlugin(dir: string): Promise<PluginCheck>;
export function checkZip(file: string, dir: string): Promise<string[]>;
export function readZip(file: string): Promise<{ name: string; data: Buffer }[]>;
export function countWords(markdown: string): number;
export function unreadable(code: string): string | undefined;
