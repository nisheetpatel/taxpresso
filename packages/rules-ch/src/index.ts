// What every canton shares (docs/design/cantons.md, section 1): cited constants and exact integer
// arithmetic on centimes, the household input and the result's shapes, and the deduction rules
// that take each canton's cited parameters. Every constant is cited (SPEC.md section 7).
export {
  estimated,
  type BracketScale,
  type Cited,
  type FederalStep,
  type Param,
} from './core/cited.js';
export {
  bracketTax,
  chf,
  federalScaleTax,
  floorFranc,
  pct,
  percent,
  round5,
  roundCentime,
  roundFranc,
  roundTo,
  share5,
  shareFranc,
  Trace,
} from './core/calc.js';
export type * from './core/types.js';
export {
  donationDeduction,
  flatProfessional,
  mealsDeduction,
  medicalDeduction,
  pillar3aCapWithoutFund,
  twoEarnerFederal,
} from './core/rules.js';
