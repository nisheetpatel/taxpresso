// Bern filing side (SPEC.md section 10): the form map of the Bern return (forms 1 to 8, section
// numbers and German labels as printed, cited, and TaxMe's two summaries) and the values to type on
// it from Bern's engine, which the shared copy panel (@taxpresso/filing-ge, buildCopyPanel) lays
// out in the form's order. The check of the official PDF is Geneva's only for now.
export {
  BE_FORM_NOTE,
  BE_PAGE_IDS,
  bernFormMap,
  FORM_BE_2025,
  FORM_BE_2026,
  type BePageId,
} from './form-map.js';
export { BE_COPY_LABELS, bernFormItems, bernLineOf } from './items.js';
// Bern behind the canton interface (packages/rules-ch, canton.ts).
export { filing } from './canton.js';
