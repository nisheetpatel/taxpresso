// Fribourg filing side (SPEC.md section 10): the form map of the Fribourg return (the codes 1.110 to
// 7.910 and annexes 01 to 06, as the guide explains them, cited) and the values to type on it from
// Fribourg's engine, which the shared copy panel (@taxpresso/filing-ge, buildCopyPanel) lays out in
// the form's order. FriTax is a desktop program: the user types the values; the check of the official
// PDF is Geneva's only for now.
export {
  FORM_FR_2025,
  FORM_FR_2026,
  FR_FORM_NOTE,
  FR_FORM_NOTE_2025,
  FR_PAGE_IDS,
  fribourgFormMap,
  type FrPageId,
} from './form-map.js';
export { FR_COPY_LABELS, fribourgFormItems, fribourgLineOf } from './items.js';
// Fribourg behind the canton interface (packages/rules-ch, canton.ts).
export { filing } from './canton.js';
