// Zurich filing side (SPEC.md section 10): the form map of the Zurich return (pages, sections,
// codes and German labels as printed, cited) and the values to type on it from Zurich's engine,
// which the shared copy panel (@taxpresso/filing-ge, buildCopyPanel) lays out in the form's
// order. The check of the official PDF is Geneva's only for now.
export {
  FORM_ZH_2025,
  FORM_ZH_2026,
  ZH_PAGE_IDS,
  zurichFormMap,
  type ZhPageId,
} from './form-map.js';
export { ZH_COPY_LABELS, zurichFormItems, zurichLineOf } from './items.js';
// Zurich behind the canton interface (packages/rules-ch, canton.ts).
export { filing } from './canton.js';
