// Basel-Stadt filing side (SPEC.md section 10): the form map of the Basel-Stadt return (the main
// form, forms B, K, Z, F and page 4 of form W: codes and German labels as printed, cited) and the
// values to type on it from Basel-Stadt's engine, which the shared copy panel (@taxpresso/filing-ge,
// buildCopyPanel) lays out in the form's order. The check of the official PDF is Geneva's only for
// now.
export {
  BS_FORM_NOTE,
  BS_PAGE_IDS,
  baselFormMap,
  FORM_BS_2025,
  FORM_BS_2026,
  type BsPageId,
} from './form-map.js';
export { BS_COPY_LABELS, baselFormItems, baselLineOf } from './items.js';
// Basel-Stadt behind the canton interface (packages/rules-ch, canton.ts).
export { filing } from './canton.js';
