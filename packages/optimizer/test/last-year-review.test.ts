// "Last year's return, reviewed" on the synthetic demo households (SPEC.md section 13, item 9):
// the lines are the ones of test/fixtures/dupont-declaration-2025.pdf and
// ribeiro-declaration-2025.pdf, as the prior-declaration reader stores them. Every expected figure
// is worked out by hand in the comments; the cantonal tax itself comes from the engine's scale,
// which the golden tests check, so here it is compared with assess() run on hand-written items.
import { readFileSync } from 'node:fs';
import {
  assess,
  engineInputFromFacts,
  objectionDeadline,
  type AssessmentView,
  type ItemAmount,
  type PriorLine,
} from '@taxpresso/rules-ge';
import { describe, expect, it } from 'vitest';
import { ASSESSMENT_FINAL, reviewLastYear, type ReviewInput } from '../src/index.js';

const CHF = (n: number) => Math.round(n * 100);
const lock = JSON.parse(
  readFileSync(new URL('../../../docs/sources/lock.json', import.meta.url), 'utf8'),
) as Record<string, { status: string }>;
const cited = (source: string) => lock[source.split(' ')[0]!]?.status;

type Who = PriorLine['person'];
/** One printed line: form, code, whose, ICC and IFD in francs (undefined: column empty). */
const line = (
  form: PriorLine['form'],
  code: string,
  person: Who,
  icc?: number,
  ifd?: number,
  more: Partial<PriorLine> = {},
): PriorLine => ({
  form,
  code,
  person,
  occurrence: 1,
  status: 'extracted',
  page: { PG2: 2, PG3: 3, PG4: 4, A1: 5, A2: 6 }[form],
  ...(icc !== undefined ? { icc: CHF(icc) } : {}),
  ...(ifd !== undefined ? { ifd: CHF(ifd) } : {}),
  ...more,
});

// Dupont: a married couple in Vernier with one child, printed by GeTax.
const DUPONT: PriorLine[] = [
  line('PG2', '11.00', 'p1', 98_000, 98_000),
  line('PG2', '21.00', 'p2', 52_000, 52_000),
  line('PG2', '14.00', 'household', 1_250, 1_250),
  line('PG2', '16.00', 'household', 3_600, 3_600),
  line('PG2', '91.00', 'household', 154_850, 154_850),
  line('PG2', '98.12', 'household', 0),
  line('PG3', '91.00', 'household', 154_850, 154_850),
  line('PG3', '31.00', 'p1', 20_184, 21_617),
  line('PG3', '41.00', 'p2', 18_340, 19_140),
  line('PG3', '52.00', 'household', 14_820, 3_700),
  line('PG3', '55.00', 'household', 450, 450),
  line('PG3', '59.00', 'household', 6_000, 6_000),
  line('PG3', '92.20', 'household', 95_056, 103_943),
  line('PG3', '71.00', 'household', 1_525, 0),
  line('PG3', '92.40', 'household', 93_531, 103_943),
  line('PG3', '73.10', 'household', 500),
  line('PG3', '73.20', 'household', undefined, 500),
  line('PG3', '74.00', 'household', 0, 0),
  line('PG4', '14.00', 'household', 185_400),
  line('PG4', '16.70', 'household', 12_000),
  line('PG4', '91.00', 'household', 197_400),
  line('PG4', '55.00', 'household', 15_000),
  line('PG4', '51.50', 'household', 120_000),
  line('PG4', '95.00', 'household', 182_400),
  line('PG4', '99.00', 'household', 62_400),
  line('A1', '11.10', 'p1', 98_000, 98_000),
  line('A1', '11.15', 'p1', 0, 0),
  line('A1', '11.00', 'p1', 98_000, 98_000),
  line('A1', '31.10', 'p1', 5_880, 5_880),
  line('A1', '31.12', 'p1', 4_900, 4_900),
  line('A1', '31.20', 'p1', undefined, 2_617),
  line('A1', '31.50', 'p1', 1_812),
  line('A1', '31.40', 'p1', 7_000, 7_000),
  line('A1', '31.70', 'p1', 534),
  line('A1', '31.71', 'p1', undefined, 1_200),
  line('A1', '31.00', 'p1', 20_126, 21_597),
  line('A2', '21.10', 'p2', 52_000, 52_000),
  line('A2', '21.00', 'p2', 52_000, 52_000),
  line('A2', '41.10', 'p2', 3_120, 3_120),
  line('A2', '41.10', 'p2', 0, 0, { suffix: 'r' }),
  line('A2', '41.12', 'p2', 2_600, 2_600),
  line('A2', '41.30', 'p2', 5_000, 5_000),
  line('A2', '41.40', 'p2', 7_000, 7_000),
  line('A2', '41.50', 'p2', 1_389),
  line('A2', '41.20', 'p2', undefined, 2_000),
  line('A2', '41.00', 'p2', 19_109, 19_720),
];

// Ribeiro: single in Meyrin, one employer, printed by GeTax.
const RIBEIRO: PriorLine[] = [
  line('PG2', '11.00', 'p1', 64_000, 64_000),
  line('PG2', '91.00', 'household', 64_000, 64_000),
  line('PG3', '91.00', 'household', 64_000, 64_000),
  line('PG3', '31.00', 'p1', 9_200, 9_900),
  line('PG3', '52.00', 'household', 6_100, 1_800),
  line('PG3', '73.10', 'household', 0),
  line('A1', '11.10', 'p1', 64_000, 64_000),
  line('A1', '11.00', 'p1', 64_000, 64_000),
  line('A1', '31.10', 'p1', 3_840, 3_840),
  line('A1', '31.12', 'p1', 3_200, 3_200),
  line('A1', '31.40', 'p1', 0, 0),
  line('A1', '31.00', 'p1', 9_200, 9_900),
];

const dupont = (over: Partial<ReviewInput> = {}): ReviewInput => ({
  lines: DUPONT,
  declarationYear: 2025,
  taxYear: 2026,
  household: { commune: 'vernier', couple: true, children: 1, custody: 'with_household' },
  from: { commune: 'declaration', couple: 'declaration', children: 'answers' },
  room2026: { p1: 0, p2: CHF(7_258) },
  today: '2026-10-14',
  ...over,
});
const ribeiro = (over: Partial<ReviewInput> = {}): ReviewInput => ({
  lines: RIBEIRO,
  declarationYear: 2025,
  taxYear: 2026,
  household: { commune: 'meyrin', couple: false, children: 0 },
  from: { commune: 'declaration', couple: 'declaration' },
  today: '2026-10-14',
  ...over,
});

const item = (code: string, person: ItemAmount['person'], francs: number): ItemAmount => ({
  code,
  person,
  amount: CHF(francs),
});

describe('last year’s tax, recomputed with the 2025 rules', () => {
  it('Dupont: the printed items give the printed totals, and the engine the tax', () => {
    const r = reviewLastYear(dupont());
    expect(r.status).toBe('ready');
    // ICC: 154,850 less 31.00 20,184, 41.00 18,340, 52.00 14,820, 55.00 450, 59.00 6,000
    // (= 59,794) is 92.20 = 95,056; less 71.00 1,525 is 92.40 = 93,531; less 73.10 500: 93,031.
    // IFD: 154,850 less 21,617 + 19,140 + 3,700 + 450 + 6,000 (= 50,907) is 103,943 for 92.20 and
    // 92.40 (71.00 is 0); less 73.20 500: 103,443.
    expect(r.recomputed!.taxableIncome).toEqual({ icc: CHF(93_031), ifd: CHF(103_443) });
    // Wealth: 185,400 + 12,000 = 197,400; less 15,000 debts = 182,400; less 120,000 (51.50 as
    // printed) = 62,400.
    expect(r.recomputed!.taxableWealth).toBe(CHF(62_400));
    // IFD, married scale (ch-2025-ifd-frais-professionnels-progression p. 3): 103,443 read at
    // 103,400; from 94,900 the tax is 1,561 plus 5 per further 100: 85 x 5 = 425, so 1,986; less
    // 263 for the child (p. 2): 1,723.
    expect(r.recomputed!.ifd).toBe(CHF(1_723));
    // The cantonal tax is the engine's, on the same items written out by hand.
    const hand = assess({
      taxYear: 2025,
      commune: 'vernier',
      couple: true,
      splitting: 'full',
      ifdScale: 'married',
      ifdChildReductions: 1,
      wealthCharges: 1,
      singleWithChildren: false,
      iccItems: [
        item('11.00', 'p1', 98_000),
        item('21.00', 'p2', 52_000),
        item('14.00', 'household', 1_250),
        item('16.00', 'household', 3_600),
        item('31.00', 'p1', -20_184),
        item('41.00', 'p2', -18_340),
        item('52.00', 'household', -14_820),
        item('55.00', 'household', -450),
        item('59.00', 'household', -6_000),
        item('71.00', 'household', -1_525),
        item('73.10', 'household', -500),
      ],
      wealthItems: [
        item('14.00', 'household', 185_400),
        item('16.70', 'household', 12_000),
        item('55.00', 'household', -15_000),
        item('51.50', 'household', -120_000),
      ],
      ifdItems: [],
    });
    expect(r.recomputed!.icc).toBe(hand.icc.taxes.total.amount);
    expect(r.recomputed!.total).toBe(r.recomputed!.icc + r.recomputed!.ifd);
    // Every total printed matches: 91.00, 92.20 and 92.40 in both columns, 91.00, 95.00 and 99.00
    // on the wealth page.
    expect(r.checks.map((c) => [c.id, c.column, c.matches])).toEqual([
      ['gross_income', 'icc', true],
      ['subtotal_9220', 'icc', true],
      ['subtotal_9240', 'icc', true],
      ['gross_income', 'ifd', true],
      ['subtotal_9220', 'ifd', true],
      ['subtotal_9240', 'ifd', true],
      ['gross_wealth', 'icc', true],
      ['net_wealth', 'icc', true],
      ['taxable_wealth', 'icc', true],
    ]);
    expect(r.needsOk).toBe(true);
    expect(r.assumptions).toContain('home_commune_only');
    expect(r.assumptions).toContain('children_from_answers');
  });

  it('Ribeiro: taxable income and the federal tax, by hand', () => {
    const r = reviewLastYear(ribeiro());
    // ICC 64,000 - 9,200 - 6,100 = 48,700; IFD 64,000 - 9,900 - 1,800 = 52,300.
    expect(r.recomputed!.taxableIncome).toEqual({ icc: CHF(48_700), ifd: CHF(52_300) });
    // IFD, single scale: from 43,500 the tax is 229.20 plus 2.64 per further 100; 52,300 is 88
    // steps: 229.20 + 232.32 = 461.52, rounded down to 5 centimes: 461.50.
    expect(r.recomputed!.ifd).toBe(CHF(461.5));
    expect(r.recomputed!.taxableWealth).toBe(0);
  });

  it('says "check this" when a printed total differs from the items read', () => {
    const misread = DUPONT.map((l) =>
      l.form === 'PG3' && l.code === '92.20' ? { ...l, icc: CHF(95_000) } : l,
    );
    const r = reviewLastYear(dupont({ lines: misread }));
    const c = r.checks.find((x) => x.id === 'subtotal_9220' && x.column === 'icc')!;
    // 95,056 from the items against 95,000 printed: 56 more.
    expect(c).toMatchObject({ matches: false, printed: CHF(95_000), difference: CHF(56) });
  });

  it('puts the assessed tax next to it, when last year’s assessment is in the folder', () => {
    const r0 = reviewLastYear(dupont());
    const view: AssessmentView = {
      docId: 'd_assessment',
      taxes: ['icc', 'ifd'],
      notificationDate: '2026-09-15',
      deadlines: (['icc', 'ifd'] as const).map((t) => objectionDeadline('2026-09-15', t)),
      items: [],
      totals: [{ key: 'assessment.tax_amount', assessed: r0.recomputed!.total + CHF(50) }],
      unconfirmed: 1,
    };
    const r = reviewLastYear(dupont({ assessments: [view] }));
    expect(r.checks.at(-1)).toMatchObject({
      id: 'assessed_tax',
      column: 'total',
      from: 'assessment',
      matches: false,
      difference: -CHF(50),
      needsOk: true,
    });
    // 15 September + 30 days is Thursday 15 October 2026 (LPFisc art. 39 and 41, LIFD art. 132
    // and 133): not passed on the 14th, passed on the 16th.
    expect(r.assessments[0]!.deadlines.map((d) => [d.tax, d.date, d.passed])).toEqual([
      ['icc', '2026-10-15', false],
      ['ifd', '2026-10-15', false],
    ]);
    const later = reviewLastYear(dupont({ assessments: [view], today: '2026-10-16' }));
    expect(later.assessments[0]!.deadlines.every((d) => d.passed)).toBe(true);
    expect(r.final).toBe(ASSESSMENT_FINAL);
  });
});

describe('pillar 3a not paid in full', () => {
  it('Dupont: 7,000 each of 7,258 with a pension fund; the saving is the engine run again', () => {
    const r = reviewLastYear(dupont());
    // Both pay into a pension fund (31.12 4,900 and 41.12 2,600), so the 2025 limit is 7,258
    // (ge-2025-guide-declaration-pp p. 18): 258 each left.
    expect(r.missed3a.map((m) => [m.person, m.code, m.paid, m.fund, m.options[0]!.gap])).toEqual([
      ['p1', '31.40', CHF(7_000), 'yes', CHF(258)],
      ['p2', '41.40', CHF(7_000), 'yes', CHF(258)],
    ]);
    // Federal: 103,443 - 258 = 103,185, read at 103,100: 82 steps, 1,561 + 410 = 1,971, less 263:
    // 1,708. Before, 1,723: 15 less.
    const s = r.missed3a[0]!.options[0]!.saving!;
    expect(s.federalCentimes).toBe(CHF(15));
    expect(s.cantonalCentimes).toBeGreaterThan(0);
    expect(s.totalCentimes).toBe(s.cantonalCentimes + s.federalCentimes);
    expect(r.assumptions).toContain('others_as_declared');
  });

  it('Ribeiro: nothing paid, the full 7,258 left, and what it would have saved federally', () => {
    const m = reviewLastYear(ribeiro()).missed3a[0]!;
    expect(m).toMatchObject({ person: 'p1', paid: 0, fund: 'yes', fundFrom: 'declaration' });
    expect(m.options).toHaveLength(1);
    expect(m.options[0]!.gap).toBe(CHF(7_258));
    // 52,300 - 7,258 = 45,042, read at 45,000: 15 steps, 229.20 + 39.60 = 268.80. Before 461.50:
    // 192.70 less.
    expect(m.options[0]!.saving!.federalCentimes).toBe(CHF(192.7));
  });

  it('shows both limits when the pension fund isn’t known, and asks nothing to be guessed', () => {
    const lines = RIBEIRO.filter((l) => l.code !== '31.12');
    const m = reviewLastYear(ribeiro({ lines })).missed3a[0]!;
    expect(m.fund).toBe('unknown');
    // With a fund: 7,258. Without: 20 % of the earned income, 64,000 - 3,840 = 60,160, so 12,032
    // (at most 36,288).
    expect(m.options.map((o) => [o.hasPensionFund, o.limit, o.limitIsMaximum, o.gap])).toEqual([
      [true, CHF(7_258), false, CHF(7_258)],
      [false, CHF(12_032), false, CHF(12_032)],
    ]);
    // No catch-up figure while it isn't known.
    expect(reviewLastYear(ribeiro({ lines })).catchUp).toBeUndefined();
    // This year's answer is taken for last year, and said so.
    const said = reviewLastYear(ribeiro({ lines, hasPensionFundNow: { p1: false } }));
    expect(said.missed3a[0]).toMatchObject({ fund: 'no', fundFrom: 'answers' });
    expect(said.assumptions).toContain('pension_fund_2025_same');
  });
});

describe('what can still be done: the 3a catch-up', () => {
  it('hands the gap to the catch-up plan: after this year’s full payment, at most 7,258', () => {
    const cu = reviewLastYear(dupont()).catchUp!;
    expect([cu.year, cu.gapYear, cu.capInYear]).toEqual([2026, 2025, CHF(7_258)]);
    // p1 has no 2026 room left: possible now. p2 still has 7,258 of 2026 room: that comes first.
    expect(cu.people.map((p) => [p.person, p.status, p.catchUpCentimes])).toEqual([
      ['p1', 'possible', CHF(258)],
      ['p2', 'pay_this_year_first', CHF(258)],
    ]);
    expect(reviewLastYear(ribeiro()).catchUp!.people[0]!.catchUpCentimes).toBe(CHF(7_258));
  });

  it('has nothing for gaps before 2025, and no 3a limits for other years', () => {
    const r = reviewLastYear(dupont({ declarationYear: 2024 }));
    expect(r.status).toBe('unsupported');
    expect(r.unsupported).toEqual(['year']);
    expect(r.missed3a).toEqual([]);
    expect(r.catchUp).toBeUndefined();
  });
});

describe('deductions that were empty: questions, never amounts', () => {
  it('Dupont: flat work costs, no meals, no commuting for B, no buy-in for A', () => {
    const q = reviewLastYear(dupont()).questions;
    expect(q.map((x) => [x.id, x.person, x.codes.join(' ')])).toEqual([
      ['professional_actual', 'p1', '31.50 31.20'],
      ['meals', 'p1', '31.60'],
      ['pension_buyin', 'p1', '31.30'],
      ['professional_actual', 'p2', '41.50 41.20'],
      ['commute', 'p2', '41.70 41.71'],
      ['meals', 'p2', '41.60'],
    ]);
    expect(q.every((x) => !('amount' in x))).toBe(true);
  });

  it('Ribeiro: medical costs, donations and childcare are asked when the page shows none', () => {
    const q = reviewLastYear(
      ribeiro({
        household: { commune: 'meyrin', couple: false, children: 1, custody: 'with_household' },
      }),
    ).questions;
    expect(q.map((x) => x.id)).toEqual([
      'commute',
      'meals',
      'pension_buyin',
      'childcare',
      'medical',
      'donations',
    ]);
  });
});

describe('what the review needs, and what it never does', () => {
  it('says what to drop in when there is no declaration', () => {
    expect(
      reviewLastYear({ lines: [], taxYear: 2026, household: {}, today: '2026-10-14' }),
    ).toMatchObject({
      status: 'none',
      missed3a: [],
      questions: [],
    });
  });

  it('needs the commune to recompute, and still shows the 3a gap and the questions', () => {
    const r = reviewLastYear(ribeiro({ household: { couple: false, children: 0 } }));
    expect(r.status).toBe('needs');
    expect(r.needs).toEqual(['commune']);
    expect(r.recomputed).toBeUndefined();
    expect(r.missed3a[0]!.options[0]!.gap).toBe(CHF(7_258));
    expect(r.missed3a[0]!.options[0]!.saving).toBeUndefined();
    expect(r.questions.length).toBeGreaterThan(0);
  });

  it('takes the year before when the declaration doesn’t print its year', () => {
    const r = reviewLastYear(ribeiro({ declarationYear: undefined }));
    expect([r.year, r.status]).toEqual([2025, 'ready']);
    expect(r.assumptions).toContain('year_not_printed');
  });

  it('doesn’t recompute when part of the income was taxable elsewhere (97.00)', () => {
    const r = reviewLastYear(
      ribeiro({ lines: [...RIBEIRO, line('PG3', '97.00', 'household', 5_000, 5_000)] }),
    );
    expect(r.unsupported).toEqual(['income_elsewhere']);
    expect(r.recomputed).toBeUndefined();
  });

  it('cites only documents of the sources library', () => {
    const r = reviewLastYear(dupont());
    const sources = [
      ...r.recomputed!.sources,
      ...r.missed3a.flatMap((m) => m.sources),
      ...r.questions.flatMap((q) => q.sources),
      ...r.catchUp!.sources,
      ...Object.values(r.catchUp!.facts),
      ...Object.values(ASSESSMENT_FINAL),
    ];
    for (const s of sources) expect(cited(s), s).toBe('ok');
  });

  it('never lets last year’s figures into this year’s calculation', () => {
    type Fact = Parameters<typeof engineInputFromFacts>[1][number];
    const fact = (
      key: string,
      person: Fact['person'],
      value: string | number,
      more = {},
    ): Fact => ({
      id: `f_${key}_${person}_${String(value)}`,
      key,
      person,
      taxYear: 2026,
      value,
      status: 'stated',
      source: { method: 'user', via: 'chat' },
      createdAt: '2026-10-14T00:00:00.000Z',
      ...more,
    });
    const answers = [
      fact('profile.civil_status', 'household', 'single'),
      fact('profile.commune', 'household', 'meyrin'),
    ];
    // Last year's lines as the reader stores them (prior.*, keys-prior.ts).
    const prior = RIBEIRO.map((l) =>
      fact(
        l.person === 'household' ? 'prior.household.icc' : 'prior.person.icc',
        l.person,
        l.icc ?? 0,
        {
          instance: `${l.form}-${l.code}`,
          status: 'extracted',
          source: { method: 'pdf_text', docId: 'd_prior', page: l.page },
        },
      ),
    );
    expect(engineInputFromFacts(2026, [...answers, ...prior], [])).toEqual(
      engineInputFromFacts(2026, answers, []),
    );
    // The review reads the lines and changes nothing in them.
    const frozen = Object.freeze(RIBEIRO.map((l) => Object.freeze({ ...l })));
    expect(() => reviewLastYear(ribeiro({ lines: frozen }))).not.toThrow();
  });
});
