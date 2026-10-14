// St. Gallen filing side (SPEC.md section 10): the form map of St. Gallen's return (Form 4 for each
// person, then Formular 1 pages 2 to 4, codes and German labels as printed, cited) and the values to
// type on it from St. Gallen's engine, which the shared copy panel (@taxpresso/filing-ge,
// buildCopyPanel) lays out in the form's order. The check of the official PDF is Geneva's only for
// now.
export {
  FORM_SG_2025,
  FORM_SG_2026,
  SG_FORM4_TOTAL,
  SG_FORM_NOTE,
  SG_PAGE_IDS,
  stGallenFormMap,
  type SgPageId,
} from './form-map.js';
export { SG_COPY_LABELS, stGallenFormItems, stGallenLineOf } from './items.js';
// St. Gallen behind the canton interface (packages/rules-ch, canton.ts).
export { filing } from './canton.js';
