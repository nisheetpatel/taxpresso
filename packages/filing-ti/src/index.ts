// Ticino filing side (SPEC.md section 10): the form map of Ticino's return (Modulo 4 for each
// person, Moduli 6 and 5, then Modulo 1 pages 2 to 4, numbers and Italian labels, cited) and the
// values to type on it from Ticino's engine, which the shared copy panel (@taxpresso/filing-ge,
// buildCopyPanel) lays out in the form's order. The check of the official PDF is Geneva's only for
// now.
export {
  FORM_TI_2025,
  FORM_TI_2026,
  TI_FORM_KEYS,
  TI_FORM_NOTE,
  TI_MODULO4_TOTAL,
  TI_PAGE_IDS,
  ticinoFormMap,
  type TiPageId,
} from './form-map.js';
export { TI_COPY_LABELS, ticinoFormItems, ticinoLineOf } from './items.js';
// Ticino behind the canton interface (packages/rules-ch, canton.ts).
export { filing } from './canton.js';
