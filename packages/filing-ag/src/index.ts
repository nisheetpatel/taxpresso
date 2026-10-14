// Aargau filing side (SPEC.md section 10): the form map of the Aargau return as the guide describes
// it (the main form 101.01 isn't published: the guide's section numbers, the sheets 101.02 to
// 101.07, flagged provisional) and the values to type on it from Aargau's engine, which the shared
// copy panel (@taxpresso/filing-ge, buildCopyPanel) lays out in the form's order. The check of the
// official PDF is Geneva's only for now.
export {
  AG_FORM_NOTE,
  AG_PAGE_IDS,
  aargauFormMap,
  FORM_AG_2025,
  FORM_AG_2026,
  type AgPageId,
} from './form-map.js';
export { AG_COPY_LABELS, aargauFormItems, aargauLineOf } from './items.js';
// Aargau behind the canton interface (packages/rules-ch, canton.ts).
export { filing } from './canton.js';
