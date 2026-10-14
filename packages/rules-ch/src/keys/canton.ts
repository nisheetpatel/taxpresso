// The canton of the tax year (docs/design/cantons.md, section 3): the first question, before any
// other. The canton you lived in on 31 December taxes the whole year, also after a move from another
// canton during it: for the federal tax ch-na-law-lifd art. 105 al. 1 (p. 58); for the cantonal and
// communal tax, ge-2025-guide-declaration-pp p. 53, zh-2025-guide-natuerliche-personen p. 5 and 6,
// be-2025-wegleitung-np-de p. 10 (Seite 1), bl-2026-wegleitung p. 3 and 4, vd-2025-guide p. 6,
// bs-2025-guide-wegleitung p. 8, zg-2025-guide-wegleitung p. 24 (Zuzug aus einem anderen Kanton),
// lu-2025-guide-wegleitung p. 8 (Zuzug in den Kanton Luzern), sg-2025-guide-wegleitung p. 11 (Zuzug
// aus einem anderen Kanton), fr-2025-guide-instructions-generales p. 4 (arriving from another
// canton: taxable for the whole year), ti-2025-guide-istruzioni-pf-pdf p. 10 (Arrivo in Ticino di
// contribuenti provenienti da altri cantoni) and ag-2025-guide-wegleitung p. 7 and 8.
import type { KeyRegistry } from '@taxpresso/ledger';
import type { CantonCode } from '../canton.js';

/** The cantons Taxpresso prepares a return for, in the order the question lists them. */
export const SUPPORTED_CANTONS = [
  'GE',
  'ZH',
  'BE',
  'BL',
  'VD',
  'BS',
  'ZG',
  'LU',
  'SG',
  'FR',
  'TI',
  'AG',
] as const satisfies readonly CantonCode[];
export type SupportedCanton = (typeof SUPPORTED_CANTONS)[number];

/** The answers to the canton question: a supported canton, or another one (not supported yet). */
export const CANTON_ANSWERS = [...SUPPORTED_CANTONS, 'other'] as const;
export type CantonAnswer = (typeof CANTON_ANSWERS)[number];

export const KEYS_CANTON_2026 = {
  'profile.canton': {
    type: 'enum',
    values: CANTON_ANSWERS,
    perPerson: false,
    label: { en: 'Canton on 31 December', fr: 'Canton au 31 décembre' },
    source:
      'ch-na-law-lifd art. 105 al. 1 (p. 58); ge-2025-guide-declaration-pp p. 53; zh-2025-guide-natuerliche-personen p. 5 and 6; be-2025-wegleitung-np-de p. 10 (Seite 1); bl-2026-wegleitung p. 3 and 4; vd-2025-guide p. 6; bs-2025-guide-wegleitung p. 8 (Zuzug aus einem anderen Kanton); zg-2025-guide-wegleitung p. 24; lu-2025-guide-wegleitung p. 8; sg-2025-guide-wegleitung p. 11 (Zuzug aus einem anderen Kanton); fr-2025-guide-instructions-generales p. 4; ti-2025-guide-istruzioni-pf-pdf p. 10 (Arrivo in Ticino); ag-2025-guide-wegleitung p. 7 and 8',
  },
} as const satisfies KeyRegistry;

export const isSupportedCanton = (v: unknown): v is SupportedCanton =>
  (SUPPORTED_CANTONS as readonly unknown[]).includes(v);
