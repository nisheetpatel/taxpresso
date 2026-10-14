// Geneva filing side (SPEC.md section 10). So far: the official form map (every page, section and
// rubric code of the declaration, cited), the items the tax engine and the ledger give per rubric,
// the copy panel that places them on the form for manual entry (10.5), and the check of the
// official PDF against it before the user transmits (10.4). Fill plans for browser filling come
// later (10.1 to 10.3).
export * from './form.js';
// Geneva behind the canton interface (packages/rules-ch, canton.ts).
export { filing, FORMS } from './canton.js';
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
  type CopyLabels,
  type CopyPanel,
  type CopyPanelInput,
  type CopyRow,
  type CopySection,
  type Lang,
} from './copy-panel.js';
export {
  reconcileDeclaration,
  type ByEyeLine,
  type CheckCell,
  type CheckColumn,
  type CheckLine,
  type CheckOutcome,
  type CheckRow,
  type CheckSection,
  type ComputedLine,
  type DeclarationCheck,
  type PrintedLine,
  type ReconcileInput,
} from './reconcile.js';
