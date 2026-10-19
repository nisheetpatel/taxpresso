// Types for split-plan.mjs (how the plugin's server is split into files), for its test.
export interface Metafile {
  inputs: Record<string, { imports: { path: string; kind: string; external?: boolean }[] }>;
  outputs: Record<string, { inputs: Record<string, { bytesInOutput: number }> }>;
}

export function planSplit(
  meta: Metafile,
  entry: string,
  budget: number,
  apart?: RegExp[],
): { entries: string[]; chunks: { modules: string[]; bytes: number }[] };
