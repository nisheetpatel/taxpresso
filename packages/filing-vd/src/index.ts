// Vaud filing side (SPEC.md section 10): the form map of the Vaud return (form 21010's pages 2 to 4
// and annexes 01 to 05, codes and French labels as printed, cited, and the guide's worksheet for the
// federal tax) and the values to type on it from Vaud's engine, which the shared copy panel
// (@taxpresso/filing-ge, buildCopyPanel) lays out in the form's order. The check of the official
// PDF is Geneva's only for now.
export {
  FORM_VD_2025,
  FORM_VD_2026,
  VD_FORM_NOTE,
  VD_PAGE_IDS,
  vaudFormMap,
  type VdPageId,
} from './form-map.js';
export { VD_COPY_LABELS, vaudFormItems, vaudLineOf } from './items.js';
// Vaud behind the canton interface (packages/rules-ch, canton.ts).
export { filing } from './canton.js';
