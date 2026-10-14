// TOU (taxation ordinaire ultérieure): compulsory cases, the comparison, the deadline. Synthetic
// households only (Ana Ribeiro, Meyrin, single parent with one child, taxed at source).
import { describe, expect, it } from 'vitest';
import {
  type HouseholdInput,
  ordinaryTaxEstimator,
  type TouInput,
  touPlan,
  type TouPerson,
} from '../src/index.js';

const CHF = (n: number) => n * 100;

const ribeiro: HouseholdInput = {
  couple: false,
  children: 1,
  custody: 'with_household',
  commune: 'meyrin',
  people: [
    { person: 'p1', hasPensionFund: true, paidCentimes: CHF(5_000), netCentimes: CHF(70_000) },
  ],
};
const ana: TouPerson = {
  person: 'p1',
  taxedAtSource: true,
  tou: 'no',
  grossCentimes: CHF(80_000),
  working: true,
  withheld: { centimes: CHF(9_850), from: 'stated' },
};
const input = (over: Partial<TouInput> = {}): TouInput => ({
  taxYear: 2026,
  today: '2026-10-13',
  household: ribeiro,
  people: [ana],
  otherIncome: false,
  taxableWealth: false,
  deductions: [{ person: 'p1', kind: 'pillar3a', centimes: CHF(5_000) }],
  ...over,
});

describe('TOU comparison', () => {
  it('puts the tax withheld next to the ordinary tax with the deductions TOU allows', () => {
    const tou = touPlan(input());
    const ordinary = ordinaryTaxEstimator(ribeiro)!.taxWith([
      { person: 'p1', kind: 'pillar3a', centimes: CHF(5_000) },
    ]);
    expect(tou.applies).toBe(true);
    expect(tou.ordinary).toEqual(ordinary);
    expect(tou.withheld?.totalCentimes).toBe(CHF(9_850));
    expect(tou.differenceCentimes).toBe(CHF(9_850) - ordinary.totalCentimes);
    expect(tou.compulsory).toBe('no');
    // None of the compulsory cases: a real choice, with the comparison.
    expect(tou.mode).toBe('choice');
    expect(tou.assumptions).toEqual(expect.arrayContaining(['income_tax_only', 'icc_2025_scale']));
    // Flat deductions only make the ordinary tax too high here: said the TOU way round.
    expect(tou.assumptions).toContain('ordinary_may_be_lower');
    expect(tou.assumptions).not.toContain('flat_deductions_only');
  });

  it('gives more back with a pension fund buy-in, which only counts with TOU', () => {
    const without = touPlan(input()).differenceCentimes!;
    const withBuyIn = touPlan(
      input({
        deductions: [
          { person: 'p1', kind: 'pillar3a', centimes: CHF(5_000) },
          { person: 'p1', kind: 'lpp_buyin', centimes: CHF(10_000) },
        ],
      }),
    ).differenceCentimes!;
    expect(withBuyIn).toBeGreaterThan(without);
  });

  it('shows no difference until every person taxed at source has a figure', () => {
    const tou = touPlan(input({ people: [{ ...ana, withheld: undefined }] }));
    expect(tou.missingWithheld).toEqual(['p1']);
    expect(tou.differenceCentimes).toBeUndefined();
    expect(tou.ordinary).toBeDefined();
  });

  it('flags a tax withheld estimated from the tariff, and values still to confirm', () => {
    const tou = touPlan(
      input({
        people: [{ ...ana, withheld: { centimes: CHF(9_000), from: 'tariff', tariff: 'H1N' } }],
        unconfirmed: true,
      }),
    );
    expect(tou.assumptions).toEqual(
      expect.arrayContaining(['withheld_from_tariff', 'values_to_confirm']),
    );
  });

  it('does not compare a couple where one is taxed at source and the other, with income, is not', () => {
    const couple: HouseholdInput = {
      ...ribeiro,
      couple: true,
      people: [
        ...ribeiro.people,
        { person: 'p2', hasPensionFund: true, paidCentimes: 0, netCentimes: CHF(50_000) },
      ],
    };
    const tou = touPlan(
      input({
        household: couple,
        // An international civil servant, for one: income of their own, not taxed at source.
        people: [ana, { person: 'p2', taxedAtSource: false, working: true, ownIncome: true }],
      }),
    );
    expect(tou.problem).toBe('mixed_couple');
    expect(tou.differenceCentimes).toBeUndefined();
  });

  it('compares a couple whose spouse has no income of their own (barème B): not a mixed couple', () => {
    const couple: HouseholdInput = {
      ...ribeiro,
      couple: true,
      people: [...ribeiro.people, { person: 'p2', hasPensionFund: false, paidCentimes: 0 }],
    };
    const tou = touPlan(
      input({
        household: couple,
        people: [ana, { person: 'p2', taxedAtSource: false, working: false }],
      }),
    );
    expect(tou.problem).toBeUndefined();
    expect(tou.missingWithheld).toEqual([]);
    expect(tou.differenceCentimes).toBe(CHF(9_850) - tou.ordinary!.totalCentimes);
  });

  it('counts the benefits of a spouse on unemployment in the ordinary tax', () => {
    const people = [
      ...ribeiro.people,
      { person: 'p2' as const, hasPensionFund: false, paidCentimes: 0 },
    ];
    const without = touPlan(
      input({
        household: { ...ribeiro, couple: true, people },
        people: [
          ana,
          {
            person: 'p2',
            taxedAtSource: true,
            tou: 'no',
            grossCentimes: CHF(30_000),
            working: true,
            withheld: { centimes: CHF(1_500), from: 'certificate' },
          },
        ],
      }),
    );
    const withBenefits = touPlan(
      input({
        household: {
          ...ribeiro,
          couple: true,
          people: [people[0]!, { ...people[1]!, replacementCentimes: CHF(30_000) }],
        },
        people: [
          ana,
          {
            person: 'p2',
            taxedAtSource: true,
            tou: 'no',
            grossCentimes: CHF(30_000),
            working: true,
            withheld: { centimes: CHF(1_500), from: 'certificate' },
          },
        ],
      }),
    );
    expect(withBenefits.ordinary!.totalCentimes).toBeGreaterThan(without.ordinary!.totalCentimes);
    expect(withBenefits.withheld?.totalCentimes).toBe(CHF(11_350));
    expect(withBenefits.assumptions).not.toContain('no_income_for_some');
  });

  it('fails closed without the benefits attestation, or with a pension it does not count', () => {
    expect(touPlan(input({ people: [{ ...ana, benefitsUnknown: true }] })).problem).toBe(
      'benefits_unknown',
    );
    const pension = touPlan(input({ people: [{ ...ana, uncounted: true }] }));
    expect(pension.problem).toBe('income_not_counted');
    expect(pension.ordinary).toBeUndefined();
  });

  it('does nothing for a household not taxed at source', () => {
    const tou = touPlan(input({ people: [{ ...ana, taxedAtSource: false }] }));
    expect(tou.applies).toBe(false);
    expect(tou.ordinary).toBeUndefined();
  });
});

describe('when TOU is compulsory', () => {
  const reason = (tou: ReturnType<typeof touPlan>, id: string) =>
    tou.reasons.find((r) => r.id === id)?.status;

  it('from CHF 120,000 gross salary in the year (RISP art. 7)', () => {
    const at = (gross: number) =>
      touPlan(input({ people: [{ ...ana, grossCentimes: CHF(gross) }] }));
    expect(at(119_999).compulsory).toBe('no');
    expect(at(120_000).compulsory).toBe('yes');
    expect(reason(at(120_000), 'gross')).toBe('yes');
    expect(at(120_000).reasons[0]?.source).toMatch(/ge-na-law-risp art. 7/);
  });

  it('with other income, taxable wealth or a previous TOU', () => {
    expect(touPlan(input({ otherIncome: true })).compulsory).toBe('yes');
    expect(touPlan(input({ taxableWealth: true })).compulsory).toBe('yes');
    expect(touPlan(input({ people: [{ ...ana, tou: 'already' }] })).compulsory).toBe('yes');
  });

  it('is a fact, not a choice: no comparison when compulsory or already in place', () => {
    const compulsory = touPlan(input({ otherIncome: true }));
    expect(compulsory.mode).toBe('compulsory');
    expect(compulsory.ordinary).toBeUndefined();
    expect(compulsory.differenceCentimes).toBeUndefined();
    // The tax withheld still shows: it counts towards the ordinary tax.
    expect(compulsory.withheld?.totalCentimes).toBe(CHF(9_850));
    const inPlace = touPlan(input({ people: [{ ...ana, tou: 'already' }] }));
    expect(inPlace.mode).toBe('in_place');
    expect(inPlace.ordinary).toBeUndefined();
    expect(touPlan(input({ otherIncome: undefined })).mode).toBe('unknown');
  });

  it('counts benefits in the CHF 120,000 and decides as soon as the known part reaches it', () => {
    const at = (p: Partial<TouPerson>) => touPlan(input({ people: [{ ...ana, ...p }] }));
    // Salary 100,000 and benefits 25,000 taxed at source: compulsory (RISP art. 7 al. 2).
    expect(at({ grossCentimes: CHF(125_000) }).compulsory).toBe('yes');
    // The benefits not known yet, the salary alone over the limit: compulsory anyway.
    expect(at({ grossCentimes: undefined, grossAtLeastCentimes: CHF(121_000) }).mode).toBe(
      'compulsory',
    );
    // Not over the limit with what is known: not known yet, never "no".
    expect(at({ grossCentimes: undefined, grossAtLeastCentimes: CHF(90_000) }).compulsory).toBe(
      'unknown',
    );
  });

  it('uses the 2025 amounts for 2025, and refuses a year without them', () => {
    const tou = touPlan(input({ taxYear: 2025, today: '2025-10-01' }));
    expect(tou.thresholds.wealthFree.single).toBe(8_763_200);
    expect(tou.reasons.find((r) => r.id === 'gross')?.source).toMatch(
      /ge-2025-source-directives p\. 50/,
    );
    expect(() => touPlan(input({ taxYear: 2027 }))).toThrow(/2027/);
  });

  it('is unknown while an answer is missing, never "no"', () => {
    const tou = touPlan(input({ otherIncome: undefined }));
    expect(tou.compulsory).toBe('unknown');
    expect(reason(tou, 'other_income')).toBe('unknown');
    expect(touPlan(input({ people: [{ ...ana, grossCentimes: undefined }] })).compulsory).toBe(
      'unknown',
    );
  });

  it('asks to check a couple where one spouse has no activity (listed on one AFC page only)', () => {
    const couple: HouseholdInput = {
      ...ribeiro,
      couple: true,
      people: [...ribeiro.people, { person: 'p2', hasPensionFund: false, paidCentimes: 0 }],
    };
    const tou = touPlan(
      input({
        household: couple,
        // A spouse without any activity is not taxed at source (nothing to tax).
        people: [ana, { person: 'p2', taxedAtSource: false, working: false }],
      }),
    );
    expect(reason(tou, 'spouse_without_activity')).toBe('check');
    expect(tou.compulsory).toBe('check');
    expect(tou.mode).toBe('check');
    expect(tou.reasons.find((r) => r.id === 'spouse_without_activity')?.source).toBe(
      'ge-na-tou-quand-page',
    );
    // Only Ana is taxed at source, and her figure is known: the comparison shows.
    expect(tou.missingWithheld).toEqual([]);
    expect(tou.differenceCentimes).toBeDefined();
  });

  it('flags the tariff C correction when both spouses work', () => {
    const couple: HouseholdInput = {
      ...ribeiro,
      couple: true,
      people: [
        ...ribeiro.people,
        { person: 'p2', hasPensionFund: true, paidCentimes: 0, netCentimes: CHF(40_000) },
      ],
    };
    const tou = touPlan(
      input({
        household: couple,
        people: [
          ana,
          {
            person: 'p2',
            taxedAtSource: true,
            tou: 'no',
            grossCentimes: CHF(45_000),
            working: true,
            withheld: { centimes: CHF(3_000), from: 'certificate' },
          },
        ],
      }),
    );
    expect(tou.assumptions).toContain('tariff_c_correction');
    expect(tou.withheld?.totalCentimes).toBe(CHF(12_850));
    expect(tou.differenceCentimes).toBe(CHF(12_850) - tou.ordinary!.totalCentimes);
  });
});

describe('the deadline', () => {
  it('is 31 March of the following year, and says when it has passed', () => {
    expect(touPlan(input()).deadline).toBe('2027-03-31');
    expect(touPlan(input({ today: '2027-03-31' })).deadlinePassed).toBe(false);
    expect(touPlan(input({ today: '2027-04-01' })).deadlinePassed).toBe(true);
    expect(touPlan(input()).facts.irrevocable).toMatch(/ge-na-law-risp art. 8 al. 1/);
  });
});
