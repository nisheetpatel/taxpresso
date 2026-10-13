// Geneva filing side (SPEC.md section 10). So far: the official form map (every page, section and
// rubric code of the declaration, cited), the items the tax engine and the ledger give per rubric,
// and the copy panel that places them on the form for manual entry (10.5). Fill plans for browser
// filling and the reconciliation against the official PDF come later (10.1 to 10.4).
export * from './form.js';
export { FORM_2025, FORM_PAGES_2025, FORM_RUBRICS_2025 } from './2025/form-map.js';
export { COMMUNE_CODES_2025, COMMUNE_CODES_2025_SOURCE } from './2025/commune-codes.js';
export { FORM_2026 } from './2026/form-map.js';
export {
  ENGINE_RUBRICS_2026,
  itemsFromLedger,
  LEDGER_ROUTES_2026,
  mergeItems,
  NOT_ON_THE_FORM_2026,
  type LedgerInput,
  type LedgerRoute,
  type UnplacedValue,
} from './2026/ledger-map.js';
export {
  buildCopyPanel,
  COLUMN_LABELS,
  enteredValue,
  formPersonOf,
  PART_LABELS,
  type CopyGroup,
  type CopyPanel,
  type CopyPanelInput,
  type CopyRow,
  type CopySection,
  type Lang,
} from './copy-panel.js';
