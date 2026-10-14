// The figures on the Geneva reference pages (/<lang>/geneva/), read at build time from the rules
// engines' own cited constants: Geneva's in packages/rules-ge, the federal ones every canton shares
// in packages/rules-ch. No tax figure is typed here: each one comes from a constant, with that
// constant's citation (manifest id plus page or article), and the citation is looked up in
// docs/sources/manifest.json for the official document's title and address. An id that isn't in
// the manifest fails the build. Anything the code doesn't hold yet is left out, never guessed
// (CLAUDE.md, SPEC.md section 7b). The years below only say which module a figure comes from; a
// test checks each against the tax year of the document it cites.
//
// The modules are imported one by one: their only imports are type imports, which Node drops when
// it runs TypeScript, so `node build.ts` needs no bundler.

import manifest from '../../docs/sources/manifest.json' with { type: 'json' };
import { ICC_2025_PROFESSIONAL_FLAT } from '../../packages/rules-ge/src/2025/icc.ts';
import { ICC_OBJECTION_2026 } from '../../packages/rules-ge/src/2026/objection.ts';
import { COMMUNE_CENTIMES_2026, COMMUNES_2026 } from '../../packages/rules-ge/src/2026/communes.ts';
import {
  IFD_2026_CHILD_TAX_REDUCTION,
  IFD_2026_DEDUCTIONS,
  IFD_PROFESSIONAL_FLAT_RATE_BP,
} from '../../packages/rules-ch/src/ifd/2026.ts';
import {
  LPP_BUYIN_FACTS,
  PILLAR3A_2025,
  PILLAR3A_CATCHUP_2026,
  PILLAR3A_CATCHUP_FACTS,
} from '../../packages/rules-ch/src/pension/buy-ins.ts';
import {
  PILLAR3A_2026,
  PILLAR3A_2026_FACTS,
} from '../../packages/rules-ch/src/pension/pillar3a.ts';
import { IFD_OBJECTION } from '../../packages/rules-ch/src/ifd/objection.ts';
import { TOU_FACTS, touDeadline } from '../../packages/rules-ge/src/2026/tou.ts';

/** The tax year of the 2026 modules above. */
export const TAX_YEAR = 2026;

/** The deadlines to object: Geneva's (LPFisc) and the federal one (LIFD). */
const OBJECTION_2026 = { icc: ICC_OBJECTION_2026, ifd: IFD_OBJECTION };

/** One place in an official document. */
export interface Citation {
  /** The manifest id. */
  id: string;
  /** Page, article or paragraph, as the code cites it: "p. 7 (chiffre 13)", "art. 39 al. 1". */
  at: string;
  /** The document's official title (French). */
  title: string;
  /** Its address, opened at the page for a PDF. */
  href: string;
  /** The tax year the document is for, if it is for one (laws aren't). */
  taxYear: number | null;
}

interface Entry {
  id: string;
  title: string;
  url: string;
  format: string;
  tax_year: number | null;
}
const ENTRIES = new Map((manifest.entries as Entry[]).map((e) => [e.id, e]));

/**
 * The documents a constant cites. A source reads "id place; id place", for example
 * "ch-na-law-lifd art. 132 al. 1 (p. 71)" or "ge-na-law-risp art. 8 al. 1; ch-na-law-lifd p. 51".
 */
export function cite(...sources: string[]): Citation[] {
  const parts = [...new Set(sources.flatMap((s) => s.split(/;\s*/).map((p) => p.trim())))];
  return parts.map((part) => {
    const m = /^([a-z0-9]+(?:-[a-z0-9]+)+)(?:\s+(.+))?$/.exec(part);
    if (!m) throw new Error(`Unreadable citation "${part}"`);
    const [, id = '', at = ''] = m;
    const entry = ENTRIES.get(id);
    if (!entry) throw new Error(`Citation ${id} is not in docs/sources/manifest.json`);
    const page = entry.format === 'pdf' ? /\bp\. (\d+)/.exec(at)?.[1] : undefined;
    return {
      id,
      at,
      title: entry.title,
      href: page ? `${entry.url}#page=${page}` : entry.url,
      taxYear: entry.tax_year,
    };
  });
}

/** A figure, formatted for the page's language when it is rendered. */
export type Figure =
  /** An amount in centimes. */
  | { chf: number }
  /** A share in basis points (2000 = 20 %). */
  | { pct: number }
  /** A count or a year. */
  | { n: number }
  /** Communal centimes in hundredths (4549 = 45.49). */
  | { centimes: number }
  /** A day, YYYY-MM-DD. */
  | { date: string };

/** One cited statement: which tax and year it is for, its figures and where they are written. */
export interface Line {
  tax: 'icc' | 'ifd' | 'both';
  year: number;
  /** Fill the {placeholders} of the line's copy. */
  figures: Record<string, Figure>;
  sources: Citation[];
}

// ---------------------------------------------------------------------------------------------
// Communal tax rates

export const COMMUNES = {
  year: TAX_YEAR,
  rows: COMMUNES_2026.map((c) => ({ name: c.name, centimes: COMMUNE_CENTIMES_2026.value[c.slug] })),
  sources: cite(COMMUNE_CENTIMES_2026.source),
  /** The communal centimes are worked out on the base tax (impôt de base). */
  basis: cite('ge-2025-icc-tariff-pdf p. 4'),
};

// ---------------------------------------------------------------------------------------------
// Pillar 3a

const pillar3aRow = (year: number, limits: typeof PILLAR3A_2026) => ({
  year,
  withFund: { chf: limits.value.capWithPensionFund },
  share: { pct: limits.value.shareWithoutPensionFundBp },
  withoutFund: { chf: limits.value.capWithoutPensionFund },
  sources: cite(limits.source),
});

export const PILLAR3A = {
  rows: [pillar3aRow(TAX_YEAR, PILLAR3A_2026), pillar3aRow(2025, PILLAR3A_2025)],
  catchUp: {
    tax: 'both',
    year: TAX_YEAR,
    figures: {
      cap: { chf: PILLAR3A_CATCHUP_2026.value.capInYear },
      from: { n: PILLAR3A_CATCHUP_2026.value.firstGapYear },
      years: { n: PILLAR3A_CATCHUP_2026.value.lookbackYears },
    },
    sources: cite(PILLAR3A_CATCHUP_2026.source),
  } satisfies Line,
  paidInYear: cite(PILLAR3A_2026_FACTS.paidInYearOnly),
  /** LIPP art. 31 let. c: 3a payments are deducted "au sens et dans les limites du droit fédéral". */
  cantonal: cite(PILLAR3A_CATCHUP_FACTS.cantonalToo),
};

// ---------------------------------------------------------------------------------------------
// Deadlines

export const DEADLINE_IDS = [
  'pillar3a',
  'lppBuyin',
  'tou',
  'objectionIcc',
  'objectionIfd',
] as const;
export type DeadlineId = (typeof DEADLINE_IDS)[number];

/** The last day of the tax year: payments count for the year they are made in. */
const lastDay = `${TAX_YEAR}-12-31`;

export const DEADLINES: Record<DeadlineId, Line> = {
  pillar3a: {
    tax: 'both',
    year: TAX_YEAR,
    figures: { date: { date: lastDay } },
    sources: cite(PILLAR3A_2026_FACTS.paidInYearOnly),
  },
  lppBuyin: {
    tax: 'both',
    year: TAX_YEAR,
    figures: { date: { date: lastDay } },
    sources: cite(LPP_BUYIN_FACTS.paidInYear),
  },
  tou: {
    tax: 'both',
    year: TAX_YEAR,
    figures: { date: { date: touDeadline(TAX_YEAR) } },
    sources: cite(TOU_FACTS.deadline, TOU_FACTS.irrevocable),
  },
  objectionIcc: {
    tax: 'icc',
    year: TAX_YEAR,
    figures: { days: { n: OBJECTION_2026.icc.days.value } },
    sources: cite(OBJECTION_2026.icc.days.source, OBJECTION_2026.icc.counting),
  },
  objectionIfd: {
    tax: 'ifd',
    year: TAX_YEAR,
    figures: { days: { n: OBJECTION_2026.ifd.days.value } },
    sources: cite(OBJECTION_2026.ifd.days.source, OBJECTION_2026.ifd.counting),
  },
};

/** The tax office's page on when the return is due and how to ask for more time. */
export const FILING_PAGE = cite('ge-na-other-demander-delai');

// ---------------------------------------------------------------------------------------------
// Deductions

export const DEDUCTION_IDS = [
  'professional',
  'pillar3a',
  'pillar3aCatchUp',
  'lppBuyin',
  'insurance',
  'child',
  'married',
  'childTaxReduction',
] as const;
export type DeductionId = (typeof DEDUCTION_IDS)[number];

const ifd = IFD_2026_DEDUCTIONS.value;

export const DEDUCTIONS: Record<DeductionId, Line[]> = {
  professional: [
    {
      tax: 'icc',
      year: 2025,
      figures: {
        rate: { pct: ICC_2025_PROFESSIONAL_FLAT.value.rateBp },
        min: { chf: ICC_2025_PROFESSIONAL_FLAT.value.min },
        max: { chf: ICC_2025_PROFESSIONAL_FLAT.value.max },
      },
      sources: cite(ICC_2025_PROFESSIONAL_FLAT.source),
    },
    {
      tax: 'ifd',
      year: TAX_YEAR,
      figures: {
        rate: { pct: IFD_PROFESSIONAL_FLAT_RATE_BP.value },
        min: { chf: ifd.professionalMin },
        max: { chf: ifd.professionalMax },
      },
      sources: cite(IFD_2026_DEDUCTIONS.source, IFD_PROFESSIONAL_FLAT_RATE_BP.source),
    },
  ],
  pillar3a: [
    {
      tax: 'both',
      year: TAX_YEAR,
      figures: {
        withFund: { chf: PILLAR3A_2026.value.capWithPensionFund },
        share: { pct: PILLAR3A_2026.value.shareWithoutPensionFundBp },
        withoutFund: { chf: PILLAR3A_2026.value.capWithoutPensionFund },
      },
      sources: cite(PILLAR3A_2026.source, PILLAR3A_CATCHUP_FACTS.cantonalToo),
    },
  ],
  pillar3aCatchUp: [
    {
      ...PILLAR3A.catchUp,
      sources: cite(PILLAR3A_CATCHUP_2026.source, PILLAR3A_CATCHUP_FACTS.cantonalToo),
    },
  ],
  lppBuyin: [
    {
      tax: 'both',
      year: TAX_YEAR,
      figures: {},
      sources: cite(LPP_BUYIN_FACTS.capacityFromFund, LPP_BUYIN_FACTS.deductible),
    },
  ],
  insurance: [
    {
      tax: 'ifd',
      year: TAX_YEAR,
      figures: {
        married: { chf: ifd.insuranceMarried },
        other: { chf: ifd.insuranceOther },
        perChild: { chf: ifd.insurancePerChild },
      },
      sources: cite(IFD_2026_DEDUCTIONS.source),
    },
  ],
  child: [
    {
      tax: 'ifd',
      year: TAX_YEAR,
      figures: { amount: { chf: ifd.child } },
      sources: cite(IFD_2026_DEDUCTIONS.source),
    },
  ],
  married: [
    {
      tax: 'ifd',
      year: TAX_YEAR,
      figures: { amount: { chf: ifd.married } },
      sources: cite(IFD_2026_DEDUCTIONS.source),
    },
  ],
  childTaxReduction: [
    {
      tax: 'ifd',
      year: TAX_YEAR,
      figures: { amount: { chf: IFD_2026_CHILD_TAX_REDUCTION.value } },
      sources: cite(IFD_2026_CHILD_TAX_REDUCTION.source),
    },
  ],
};

/** The official guide's summary of the main deductions, which lists them all. */
export const DEDUCTIONS_GUIDE = cite('ge-2025-guide-declaration-pp p. 11');
