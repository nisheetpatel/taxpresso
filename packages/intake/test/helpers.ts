import { readFileSync } from 'node:fs';

/** A synthetic broker export from test/fixtures/brokers (Dupont household). */
export const fixture = (name: string): Buffer =>
  readFileSync(new URL(`../../../test/fixtures/brokers/${name}`, import.meta.url));

export const bytes = (s: string): Uint8Array => new TextEncoder().encode(s);
