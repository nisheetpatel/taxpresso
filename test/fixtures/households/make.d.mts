// Types for make.mjs (the filing kits' document generator: test tooling, never shipped).
import type { Kit } from './kits.mjs';

export interface KitDocument {
  file: string;
  kind: string;
  person: 'p1' | 'p2' | 'household';
  /** How Taxpresso reads it: its barcode, a broker export, last year's declaration, or Claude. */
  read: 'barcode' | 'export' | 'prior' | 'claude';
  bytes: Buffer;
  values?: [string, string, number, string | null][];
  official?: { security: string; officialValue: string; from: string }[];
}

export function money(centimes: number): string;
export function buildDocuments(kit: Kit, year: number): Promise<KitDocument[]>;
export function writeKit(kit: Kit): Promise<KitDocument[]>;
