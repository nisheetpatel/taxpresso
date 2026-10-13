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
  tou: 'considering',
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

  it('does not compare a couple where only one person is taxed at source', () => {
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
        people: [ana, { person: 'p2', taxedAtSource: false, working: true }],
      }),
    );
    expect(tou.problem).toBe('mixed_couple');
    expect(tou.differenceCentimes).toBeUndefined();
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
        people: [ana, { person: 'p2', taxedAtSource: true, tou: 'considering', working: false }],
      }),
    );
    expect(reason(tou, 'spouse_without_activity')).toBe('check');
    expect(tou.compulsory).toBe('check');
    expect(tou.reasons.find((r) => r.id === 'spouse_without_activity')?.source).toBe(
      'ge-na-tou-quand-page',
    );
    // The spouse has no figure: no comparison yet.
    expect(tou.missingWithheld).toEqual(['p2']);
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
            tou: 'considering',
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
