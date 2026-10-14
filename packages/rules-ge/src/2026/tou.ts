// Ordinary taxation after source tax (taxation ordinaire ultérieure, TOU) for Geneva residents,
// tax year 2026 (SPEC.md section 8, group C). Sources: the cantonal law and regulation on source
// tax (ge-na-law-lisp, ge-na-law-risp), the federal law (ch-na-law-lifd), the AFC's 2026 directives
// (ge-2026-source-directives) and its TOU pages (ge-2025-dris-tou-page, ge-na-tou-quand-page).
import type { Cited } from '@taxpresso/rules-ch';

/** Compulsory TOU: gross salary taxed at source of at least this much in the year (per spouse). */
export const TOU_2026_GROSS_THRESHOLD: Cited<number> = {
  value: 12_000_000,
  source: 'ge-na-law-risp art. 7 al. 1, al. 3; ge-2026-source-directives p. 51',
};

/** Compulsory TOU: yearly gross income not taxed at source of at least this much. */
export const TOU_2026_OTHER_INCOME_THRESHOLD: Cited<number> = {
  value: 300_000,
  source: 'ge-2026-source-directives p. 51; ge-na-tou-quand-page',
};

/**
 * Compulsory TOU: taxable wealth, meaning wealth above these social deductions on 31 December
 * 2026 (shown to the user so they can answer; Taxpresso doesn't compute wealth tax).
 */
export const TOU_2026_WEALTH_FREE: Cited<{
  single: number;
  coupleOrSingleParent: number;
  perDependant: number;
}> = {
  value: { single: 8_787_200, coupleOrSingleParent: 17_574_300, perDependant: 4_393_600 },
  source: 'ge-2026-source-directives p. 51',
};

/** Where each statement the TOU card makes is written. */
export const TOU_FACTS = {
  compulsoryCases: 'ge-na-law-lisp art. 4 al. 1; ge-2026-source-directives p. 51',
  previousTou: 'ge-2026-source-directives p. 51; ge-na-law-lisp art. 4 al. 5',
  /** Listed on the AFC's page only, not in the 2026 directives nor the law: see ge/NOTES.md. */
  spouseWithoutActivity: 'ge-na-tou-quand-page',
  onRequest: 'ge-na-law-lisp art. 5 al. 1; ch-na-law-lifd p. 51 (art. 89a al. 1)',
  deadline:
    'ge-na-law-risp art. 8 al. 1; ge-na-law-lisp art. 5 al. 3; ch-na-law-lifd p. 51 (art. 89a al. 3)',
  irrevocable: 'ge-na-law-risp art. 8 al. 1; ge-2026-source-directives p. 52',
  everyYearAfter: 'ge-na-law-lisp art. 5 al. 5 and art. 4 al. 5; ge-2026-source-directives p. 52',
  spouseIncluded: 'ge-na-law-lisp art. 5 al. 2; ch-na-law-lifd p. 51 (art. 89a al. 2)',
  withheldCredited: 'ge-na-law-lisp art. 4 al. 6; ch-na-law-lifd p. 51 (art. 89 al. 6)',
  /** Without TOU, 3a, pension fund buy-ins, childcare and the like don't lower the tax. */
  deductionsOnlyWithTou: 'ge-2026-source-directives p. 10; ge-na-law-lisp art. 5 al. 4',
  howToRequest: 'ge-2025-dris-tou-page; ge-2026-source-directives p. 52',
  lateOrInformalRefused: 'ge-2026-source-directives p. 52',
  drisOrTou: 'ge-2026-source-directives p. 50',
  /** Tariff C: the tax withheld may be corrected afterwards on both spouses' real incomes. */
  tariffCCorrection: 'ge-2026-source-directives p. 49',
} as const;

/** The day the request (or the announcement of a compulsory TOU) must reach the AFC. */
export function touDeadline(taxYear: number): string {
  return `${taxYear + 1}-03-31`;
}
