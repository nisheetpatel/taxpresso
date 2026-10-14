// The worked examples of the official documents, and the amounts the guide's summary prints.
//
// - sg-2026-guide-merkblatt-unterjaehrig p. 3 (8. Berechnung der Einkommenssteuer): a couple
//   (Splittingtarif) taxable from 1 January to 30 June 2026, effective income CHF 36,000, the income
//   that sets the rate CHF 72,000: einfache Steuer 3.9556 %, on CHF 36,000 CHF 1,424.00; at a
//   Steuerfuss of 270 % (an assumption of the example) CHF 3,844.80. Its child deduction for the
//   whole year: CHF 10,800.
// - the same p. 4 (10. Berechnung der Vermögenssteuer): taxable wealth CHF 200,000, einfache Steuer
//   1.7 per mille CHF 340; for 180 days CHF 170; at 270 % CHF 459.
// - sg-2025-guide-wegleitung p. 50 (Beispiel für Ehepaar X): taxable wealth CHF 400,000, einfache
//   Steuer CHF 680, at a Gesamtsteuerfuss of 270 % CHF 1,836. Its income line does not match the
//   2025 tariff: see the last test and docs/sources/sg/NOTES.md, "Open points for the rules".
import { describe, expect, it } from 'vitest';
import {
  incomeTariffTax,
  percentOf,
  ratePercent,
  sgParamsFor,
  wealthTariffTax,
} from '../src/index.js';

const chf = (francs: number) => Math.round(francs * 100);

describe('Merkblatt 8 (2026), partial-year examples', () => {
  const P = sgParamsFor(2026);

  it('income: the rate of CHF 72,000 with Vollsplitting on CHF 36,000, at 270 %', () => {
    const r = incomeTariffTax(P.income.value, chf(72_000), true);
    expect(ratePercent(r.rate, 'en')).toBe('3.9556 %');
    // The effective income at the rate of the whole year's income: 36,000 x 1,424 / 36,000.
    const simple = (36_000 * r.rate.num * 100) / r.rate.den;
    expect(simple).toBe(chf(1_424));
    expect(percentOf(simple, 27_000)).toBe(chf(3_844.8));
  });

  it('wealth: CHF 200,000 at 1.7 per mille, for 180 days of 360, at 270 %', () => {
    const w = wealthTariffTax(P.wealth.value, chf(200_000));
    expect(w.tax).toBe(chf(340));
    const part = (w.tax * 180) / 360;
    expect(part).toBe(chf(170));
    expect(percentOf(part, 27_000)).toBe(chf(459));
  });

  it('the child deduction for a child in school or training: CHF 10,800', () => {
    expect(P.amounts.child.value.school).toBe(chf(10_800));
  });
});

describe('the 2025 guide, Ehepaar X (p. 50)', () => {
  const P = sgParamsFor(2025);

  it('wealth: CHF 400,000 gives an einfache Steuer of CHF 680, at 270 % CHF 1,836', () => {
    const w = wealthTariffTax(P.wealth.value, chf(400_000));
    expect(w.tax).toBe(chf(680));
    expect(percentOf(w.tax, 27_000)).toBe(chf(1_836));
  });

  it('income: the guide prints CHF 3,516 for CHF 80,000; the 2025 tariff prints CHF 3,488.00', () => {
    // The tariff (sg-2025-tariff-einkommen-vermoegen p. 16, row 80’000, gemeinsam Steuerpflichtige)
    // and the law (StG Art. 50: the rate of 40,000 is 1,744 / 40,000 = 4.36 %) give 3,488.00; the
    // guide's example prints 3,516 and 9,493 at 270 %. Taxpresso follows the tariff and the law;
    // the conflict is recorded in docs/sources/sg/NOTES.md.
    expect(incomeTariffTax(P.income.value, chf(80_000), true).tax).toBe(chf(3_488));
    // The guide's own multiplication is the rule the engine applies: 3,516 x 270 % = 9,493.20.
    expect(percentOf(chf(3_516), 27_000)).toBe(chf(9_493.2));
  });
});

describe('the 2025 amounts as the guide’s summary prints them (sg-2025-guide-wegleitung p. 4)', () => {
  it('Kurzübersicht Wegleitung 2025', () => {
    const A = sgParamsFor(2025).amounts;
    expect(A.travel.value).toEqual({ max: chf(8_000), bikePerYear: chf(700), carPerKm: 70 });
    expect(A.meals.value).toEqual({
      perDay: chf(15),
      perYear: chf(3_200),
      halfPerDay: chf(7.5),
      halfPerYear: chf(1_600),
    });
    expect(A.otherFlat.value).toEqual({ base: chf(700), rateBp: 1_000, max: chf(2_400) });
    expect(A.sideJob.value).toEqual({ rateBp: 2_000, min: chf(800), max: chf(2_400) });
    expect(A.pillar3a.value).toEqual({
      withFund: chf(7_258),
      withoutFundMax: chf(36_288),
      withoutFundShareBp: 2_000,
    });
    expect(A.insurance.value).toEqual({
      married: chf(6_800),
      other: chf(3_400),
      marriedExtra: chf(1_100),
      otherExtra: chf(500),
      perChild: chf(1_100),
    });
    expect(A.childcare.value).toBe(chf(26_700));
    expect(A.party.value).toEqual({ married: chf(21_400), other: chf(10_700) });
    expect(A.training.value).toEqual({ max: chf(13_000), flat: chf(400) });
    expect(A.twoEarner.value).toBe(chf(500));
    expect(A.medicalThresholdBp.value).toBe(200);
    expect(A.donations.value).toEqual({ min: chf(100), shareBp: 2_000 });
    expect(A.child.value).toEqual({
      preschool: chf(7_600),
      school: chf(10_800),
      educationMax: chf(13_700),
      educationExcess: chf(3_200),
    });
    expect(A.wealthFree.value).toEqual({ perTaxpayer: chf(75_000), perChild: chf(20_000) });
  });

  it('2026: what Merkblatt 8 and the 2026 law change', () => {
    const [a, b] = [sgParamsFor(2025).amounts, sgParamsFor(2026).amounts];
    expect(b.travel.value.carPerKm).toBe(75);
    expect(b.childcare.value).toBe(chf(26_800));
    expect(b.child.value.educationMax).toBe(chf(13_800));
    expect(b.training.value.flat).toBeNull();
    // Unchanged: the law of 2026 prints the same amounts.
    expect(b.party.value).toEqual(a.party.value);
    expect(b.insurance.value).toEqual(a.insurance.value);
    expect(b.wealthFree.value).toEqual(a.wealthFree.value);
  });
});
