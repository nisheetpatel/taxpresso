// Basel-Landschaft filing side (SPEC.md section 10): the form map of the Basel-Landschaft return
// (pages 2 to 4, codes and German labels as printed, cited) and the values to type on it from
// Basel-Landschaft's engine, which the shared copy panel (@taxpresso/filing-ge, buildCopyPanel) lays
// out in the form's order. The check of the official PDF is Geneva's only for now.
export {
  BL_FORM_NOTE,
  BL_PAGE_IDS,
  baselLandFormMap,
  FORM_BL_2025,
  FORM_BL_2026,
  type BlPageId,
} from './form-map.js';
export { BL_COPY_LABELS, baselLandFormItems, baselLandLineOf } from './items.js';
// Basel-Landschaft behind the canton interface (packages/rules-ch, canton.ts).
export { filing } from './canton.js';
