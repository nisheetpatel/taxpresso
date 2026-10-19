// Types for zip-folder.mjs (the Claude plugin's zip), for the plugin check's test.
export function walk(dir: string): Promise<string[]>;
export function zipFolder(dir: string, top: string): Promise<Buffer>;
