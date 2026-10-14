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

/** The same three amounts for tax year 2025 (ge-2025-source-directives p. 50, ch. 8.2.1). */
export const TOU_2025_GROSS_THRESHOLD: Cited<number> = {
  value: 12_000_000,
  source: 'ge-na-law-risp art. 7 al. 1, al. 3; ge-2025-source-directives p. 50',
};
export const TOU_2025_OTHER_INCOME_THRESHOLD: Cited<number> = {
  value: 300_000,
  source: 'ge-2025-source-directives p. 50',
};
export const TOU_2025_WEALTH_FREE: Cited<{
  single: number;
  coupleOrSingleParent: number;
  perDependant: number;
}> = {
  value: { single: 8_763_200, coupleOrSingleParent: 17_526_400, perDependant: 4_381_600 },
  source: 'ge-2025-source-directives p. 50',
};

export interface TouThresholds {
  gross: Cited<number>;
  otherIncome: Cited<number>;
  wealthFree: typeof TOU_2026_WEALTH_FREE;
}

/** The compulsory-TOU amounts of a tax year; a year without directives throws (fail closed). */
export function touThresholds(taxYear: number): TouThresholds {
  if (taxYear === 2026) {
    return {
      gross: TOU_2026_GROSS_THRESHOLD,
      otherIncome: TOU_2026_OTHER_INCOME_THRESHOLD,
      wealthFree: TOU_2026_WEALTH_FREE,
    };
  }
  if (taxYear === 2025) {
    return {
      gross: TOU_2025_GROSS_THRESHOLD,
      otherIncome: TOU_2025_OTHER_INCOME_THRESHOLD,
      wealthFree: TOU_2025_WEALTH_FREE,
    };
  }
  throw new Error(`No compulsory-TOU amounts for ${taxYear} in Taxpresso (2025, 2026).`);
}

/**
 * Who is taxed at source, and what the benefits replacing pay are, per tax year: the law and the
 * directives' pages (the derivation itself is data: data/ge/2026/questionnaire.yaml, derive).
 */
export const SOURCE_TAX_SUBJECT: Record<
  2025 | 2026,
  { who: string; benefits: string; notOnPension: string; toOrdinary: string; salaried: string }
> = {
  2025: {
    who: 'ge-na-law-lisp art. 1 al. 1 and 2; ge-2025-source-directives p. 6 (ch. 1.1.1, 1.1.2)',
    benefits:
      'ge-na-law-lisp art. 2 al. 2 let. b; ge-na-law-risp art. 3; ge-2025-source-directives p. 11 (ch. 3.1.3.2)',
    notOnPension: 'ge-2025-source-directives p. 11 (ch. 3.1.3.2)',
    toOrdinary: 'ge-na-law-risp art. 10 al. 1 and 2; ge-2025-source-directives p. 55 (ch. 9.3.1)',
    salaried: 'ge-2025-source-directives p. 5',
  },
  2026: {
    who: 'ge-na-law-lisp art. 1 al. 1 and 2; ge-2026-source-directives p. 6 (ch. 1.1.1, 1.1.2)',
    benefits:
      'ge-na-law-lisp art. 2 al. 2 let. b; ge-na-law-risp art. 3; ge-2026-source-directives p. 11 (ch. 3.1.3.2)',
    notOnPension: 'ge-2026-source-directives p. 11 (ch. 3.1.3.2)',
    toOrdinary: 'ge-na-law-risp art. 10 al. 1 and 2; ge-2026-source-directives p. 56 (ch. 9.3.1)',
    salaried: 'ge-2026-source-directives p. 5',
  },
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

/**
 * Where the facts about source tax the TOU card adds are written: TOU in place, the gross of the
 * CHF 120,000 with benefits, the benefits an insurance taxes itself, a couple only half taxed at
 * source. Kept apart from TOU_FACTS, which every household's plans carry.
 */
export const SOURCE_TAX_FACTS = {
  /**
   * TOU already in place: it stays, and the tax office sends a declaration every year without a new
   * DRIS/TOU form.
   */
  inPlace: 'ge-na-law-lisp art. 4 al. 5, art. 5 al. 5; ge-2026-source-directives p. 51 and 52',
  /** The gross for the CHF 120,000 counts the benefits taxed at source with the salary. */
  grossWithBenefits: 'ge-na-law-risp art. 7 al. 2; ge-na-law-lisp art. 2 al. 2 let. a and b',
  /** Benefits an insurance pays itself are taxed at barème G; its attestation states the tax. */
  benefitsTaxedByInsurer: 'ge-2026-source-directives p. 23 (ch. 4.2.12) and p. 28 (ch. 5.2.2.5)',
  /** One spouse taxed at source and the other not (an international civil servant, for one). */
  mixedCouple: 'ge-2026-source-directives p. 25 and 26 (ch. 5.2.1.2, 5.2.1.3)',
} as const;
