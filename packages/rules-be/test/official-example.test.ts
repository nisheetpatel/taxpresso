// The official worked examples for Bern, line by line as printed.
//
// be-2025-steuererklaerung-formulare-de: the 2025 return filled in for a sample taxpayer, "Tim
// Schmutz", single, Münchenbuchsee, reformed, employed with a side job, no household of his own
// (form 1.2), forms 1 to 8 (p. 1 to 8) and TaxMe's summary of the cantonal and communal tax down to
// the taxable income (35,611) and wealth (12,753) (p. 9). It prints no tax: the taxes below are
// worked out by hand from the tariff and the multipliers, not printed by the canton.
//
// be-na-deductions-taxinfo-zweiverdienerabzug: the canton's four examples of the two-earner
// deduction for the cantonal and communal tax.
import { describe, expect, it } from 'vitest';
import {
  assess,
  beParamsFor,
  computeReturn,
  donationDeduction,
  flatShare,
  insuranceDeduction,
  mealsDeduction,
  medicalDeduction,
  modestIncomeDeduction,
  NOTE,
  twoEarnerDeduction,
  type BeEngineInput,
  type ItemAmount,
} from '../src/index.js';

const chf = (francs: number) => Math.round(francs * 100);
const amt = (francs: number) => ({ value: chf(francs) });
const line = (code: string, francs: number, person: ItemAmount['person'] = 'household') => ({
  code,
  person,
  amount: chf(francs),
});

describe('Specimen 2025, Tim Schmutz (be-2025-steuererklaerung-formulare-de)', () => {
  const A = beParamsFor(2025).amounts;

  it('6.2 Auswärtige Verpflegung (p. 6): 220 days x 15 = 3,300, at most 3,200', () => {
    expect(mealsDeduction(220, false, A.meals.value)).toBe(chf(3_200));
  });

  it('6.4 Übrige Berufskosten (p. 6): 3 % of 50,000 = 1,500, at least 2,000', () => {
    expect(flatShare(chf(50_000), A.professionalFlat.value)).toBe(chf(2_000));
  });

  it('6.5 Berufskosten Nebenerwerb (p. 6, p. 9): 20 % of 2,700 = 540, at least 800', () => {
    expect(flatShare(chf(2_700), A.sideJobFlat.value)).toBe(chf(800));
  });

  it('4.2 Versicherungsprämien (p. 4, p. 9): 2,640 + 44 interest = 2,684, the fixed 2,450', () => {
    const r = insuranceDeduction(A.insurance.value, {
      couple: false,
      contributing: true,
      childWeight: 0,
      paid: chf(2_684),
    });
    expect(r.deduction).toBe(chf(2_450));
  });

  it('5.3 and 5.4 (p. 5, p. 9): donations 100; medical 2,400 less 5 % of 41,344 = 333', () => {
    expect(donationDeduction(chf(100), chf(41_344), A.donations.value).deduction).toBe(chf(100));
    expect(medicalDeduction(chf(2_400), chf(41_344), A.medicalThresholdBp.value)).toEqual({
      threshold: chf(2_067),
      deduction: chf(333),
    });
  });

  it('no modest-income deduction: 35,611 + 10 % of 12,753 is far above 16,700', () => {
    const r = modestIncomeDeduction(A.modestIncome.value, {
      couple: false,
      childWeight: 0,
      assessable: chf(35_611 + 1_275),
    });
    expect(r.deduction).toBe(0);
  });

  // TaxMe's summary (p. 9), as printed, column "Steuerbar".
  const incomeItems = [
    line('2.21-haupt', 50_000, 'p1'),
    line('2.21-neben', 2_700, 'p1'),
    line('3.0-ertrag', 44),
    line('3.0-kosten', -10),
    line('4.2', -2_450),
    line('6.1', -2_140, 'p1'),
    line('6.2', -3_200, 'p1'),
    line('6.4', -2_000, 'p1'),
    line('6.5', -800, 'p1'),
    line('6.6', -800, 'p1'),
    line('allgemein', -5_300),
    line('5.3', -100),
    line('5.4', -333),
  ];
  const wealthItems = [line('3.0-vermoegen', 10_153), line('4.1', 2_600)];

  it('the totals of the summary (p. 9) from its lines', () => {
    const r = assess({
      taxYear: 2025,
      commune: 546,
      tariff: 'other',
      church: { confession: 'reformed' },
      incomeItems,
      wealthItems,
    });
    expect(r.grossIncome.amount).toBe(chf(52_734));
    expect(r.totalDeductions.amount).toBe(chf(-11_390));
    expect(r.netIncome.amount).toBe(chf(41_344));
    expect(r.personalDeductions.amount).toBe(chf(-5_733));
    expect(r.taxableIncome.amount).toBe(chf(35_611));
    expect(r.wealth.grossWealth.amount).toBe(chf(12_753));
    expect(r.wealth.taxableWealth.amount).toBe(chf(12_753));
  });

  it('the taxes, by hand: tariff Art. 42 Abs. 2, Münchenbuchsee, reformed', () => {
    // 35,611 taken as 35,600: 1,319.25 (be-2025-tariff-einkommen-alleinstehende p. 2). Wealth
    // 12,753 is under 100,000: no wealth tax. Canton 2.975: 3,924.76875, 3,924.77. Münchenbuchsee
    // 1.64: 2,163.57. Reformed 0.1955: 257.913375, 257.91. Total 6,346.25.
    const r = assess({
      taxYear: 2025,
      commune: 546,
      tariff: 'other',
      church: { confession: 'reformed' },
      incomeItems,
      wealthItems,
    });
    expect(r.taxes.simpleIncome.amount).toBe(chf(1_319.25));
    expect(r.taxes.simpleWealth.amount).toBe(0);
    expect(r.taxes.cantonal.amount).toBe(chf(3_924.77));
    expect(r.taxes.communal.amount).toBe(chf(2_163.57));
    expect(r.taxes.church?.amount).toBe(chf(257.91));
    expect(r.taxes.wealthCap).toBeNull();
    expect(r.taxes.total.amount).toBe(chf(6_346.25));
  });

  it('the same return from the household’s facts', () => {
    // The net salaries as the certificates give them (box 11); bike 700 and public transport
    // 1,440 given as one cost of 2,140 (the input has one way to work per person); the accounts
    // of form 3, the car (600) and gold (2,000) of form 4.1.
    const input: BeEngineInput = {
      taxYear: 2025,
      commune: 546,
      civilStatus: 'single',
      ownHousehold: false,
      church: { p1: 'reformed' },
      people: [
        {
          id: 'p1',
          employments: [{ gross: amt(50_000) }, { gross: amt(2_700), side: true }],
          hasPensionFund: true,
          commuteCost: amt(2_140),
          mealDays: 220,
          trainingCosts: amt(800),
        },
      ],
      household: {
        healthPremiums: amt(2_640),
        savingsInterest: amt(44),
        donations: amt(100),
        medicalCosts: amt(2_400),
        bankFees: amt(10),
        cash: amt(2_000),
        vehicles: amt(600),
      },
      movable: [
        { owner: 'p1', value: amt(7_753), income: amt(20) },
        { owner: 'p1', value: amt(2_400), income: amt(24) },
      ],
    };
    const r = computeReturn(input);
    const codes = r.icc?.items.map((i) => [i.code, i.amount / 100]);
    expect(codes).toEqual([
      ['2.21-haupt', 50_000],
      ['2.21-neben', 2_700],
      ['3.0-ertrag', 44],
      ['3.0-kosten', -10],
      ['6.1', -2_140],
      ['6.2', -3_200],
      ['6.4', -2_000],
      ['6.5', -800],
      ['6.6', -800],
      ['4.2', -2_450],
      ['5.3', -100],
      ['5.4', -333],
      ['allgemein', -5_300],
    ]);
    expect(r.icc?.netIncome.amount).toBe(chf(41_344));
    expect(r.icc?.taxableIncome.amount).toBe(chf(35_611));
    expect(r.icc?.wealth.taxableWealth.amount).toBe(chf(12_753));
    expect(r.icc?.taxes.total.amount).toBe(chf(6_346.25));
    // A side job: no 2025 document gives the federal flat's rate, so the federal tax fails closed.
    expect(r.ifd).toBeNull();
    expect(r.total).toBeNull();
    expect(r.unsupported.map((n) => n.en)).toEqual([
      expect.stringMatching(/^Federal tax not computed: .*side job \(Nebenerwerb, form 6\.5\)/),
    ]);
    expect(r.unverifiedRules).toEqual([NOTE.rounding]);
  });
});

describe('Zweiverdienerabzug, the canton’s examples (be-na-deductions-taxinfo-zweiverdienerabzug)', () => {
  const p = beParamsFor(2025).amounts.twoEarner.value;
  // [both net incomes, the lower one less its professional costs and 3a, cantonal deduction]
  const examples: [number, number, number][] = [
    [230_000, 30_000 - 2_000 - 7_000, 4_600],
    [162_000, 12_000 - 2_000, 3_240],
    [213_000, 13_000 - 2_000 - 7_000, 4_000],
    [150_000, 50_000 - 5_000 - 7_000, 3_000],
  ];
  examples.forEach(([both, lower, deduction], i) => {
    it(`Beispiel ${i + 1}: ${deduction}`, () => {
      expect(twoEarnerDeduction(chf(both), chf(lower), p)).toBe(chf(deduction));
    });
  });
});
