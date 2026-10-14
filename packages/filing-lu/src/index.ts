// Lucerne filing side (SPEC.md section 10): the form map of the Lucerne return (form B, the securities
// list's summary, pages 2 to 4, Ziffern and German labels as printed, cited) and of the optional
// Ergänzungsblatt Direkte Bundessteuer, and the values to type on them from Lucerne's engine, which
// the shared copy panel (@taxpresso/filing-ge, buildCopyPanel) lays out in the form's order. The
// check of the official PDF is Geneva's only for now.
export {
  FORM_LU_2025,
  FORM_LU_2026,
  LU_FORM_NOTE,
  LU_PAGE_IDS,
  lucerneFormMap,
  type LuPageId,
} from './form-map.js';
export { LU_COPY_LABELS, lucerneFormItems, lucerneLineOf } from './items.js';
// Lucerne behind the canton interface (packages/rules-ch, canton.ts).
export { filing } from './canton.js';
