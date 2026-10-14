// Zug filing side (SPEC.md section 10): the form map of Zug's main form K (pages 2 to 4, codes and
// German labels as printed, cited) and the values to type on it from Zug's engine, which the shared
// copy panel (@taxpresso/filing-ge, buildCopyPanel) lays out in the form's order. The check of the
// official PDF is Geneva's only for now.
export {
  FORM_ZG_2025,
  FORM_ZG_2026,
  ZG_FORM_NOTE,
  ZG_PAGE_IDS,
  zugFormMap,
  type ZgPageId,
} from './form-map.js';
export { ZG_COPY_LABELS, zugFormItems, zugLineOf } from './items.js';
// Zug behind the canton interface (packages/rules-ch, canton.ts).
export { filing } from './canton.js';
