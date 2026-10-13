// Last year's Geneva declaration (SPEC.md section 5.4): recognised from its page codes and rubric
// lines, read into form data (rubric codes and amounts, civil status, commune), never identity.
export { hasAmountShape, parseAmount } from './amount.js';
export { layoutCells, lineText, linesFromText, type TextItem } from './layout.js';
export { localizePriorWarning, priorWarning, type PriorWarningCode } from './messages.js';
export { detectPriorDeclaration, parsePriorDeclaration, type ParseOptions } from './parse.js';
export {
  MAX_DECLARATION_PAGES,
  noTextWarning,
  pdfPages,
  readPriorDeclaration,
  type PdfPages,
} from './pdf.js';
export type {
  Cell,
  CivilStatus,
  CommuneLookup,
  Line,
  PageInput,
  PriorDeclaration,
  PriorFormPage,
  PriorItem,
  PriorPerson,
  PriorTaxpayer,
  PriorWarning,
} from './types.js';
