// What wiring Ticino into the app needs from rules-ti: the communes as the questionnaire offers them
// (the official table's names, in ordinary case), Modulo 4 line by line (each person's 9.1 or 9.2
// is their total), 22.1 as the return lays it out, and the limits each rule applied (the final
// check). Synthetic only.
import { describe, expect, it } from 'vitest';
import {
  communeName,
  communeOfAnswer,
  communeOptions,
  computeReturn,
  MODULO4_CODES,
  tiKeys,
  type TiEngineInput,
} from '../src/index.js';

const chf = (francs: number) => Math.round(francs * 100);
const amt = (francs: number) => ({ value: chf(francs) });

describe('the communes the questionnaire offers', () => {
  it('names them as the table does, in ordinary case', () => {
    expect(
      [
        'LUGANO',
        'BRIONE S/MINUSIO',
        "COLLINA D'ORO",
        "SANT'ANTONINO",
        'RONCO SOPRA ASCONA',
        'TERRE DI PEDEMONTE',
        'CAMPO (VALLEMAGGIA)',
        'ARBEDO-CASTIONE',
        'CASTEL SAN PIETRO',
      ].map(communeName),
    ).toEqual([
      'Lugano',
      'Brione s/Minusio',
      'Collina d’Oro',
      'Sant’Antonino',
      'Ronco sopra Ascona',
      'Terre di Pedemonte',
      'Campo (Vallemaggia)',
      'Arbedo-Castione',
      'Castel San Pietro',
    ]);
  });

  it('stores a commune by its slug and gives the engine its name in the table', () => {
    for (const year of [2025, 2026]) {
      const options = communeOptions(year);
      expect(options.length).toBe(year === 2025 ? 99 : 100);
      expect(new Set(options.map((o) => o.slug)).size).toBe(options.length);
      expect(tiKeys(year)['profile.commune']!.values).toEqual(options.map((o) => o.slug));
      for (const o of options) expect(communeOfAnswer(year, o.slug)).toBe(o.official);
    }
    expect(communeOfAnswer(2026, 'collina-d-oro')).toBe("COLLINA D'ORO");
    expect(communeOfAnswer(2025, 'lema')).toBeUndefined();
    expect(communeOfAnswer(2026, 'Lugano')).toBeUndefined();
  });
});

describe('the lines of a Ticino return the app shows', () => {
  const input: TiEngineInput = {
    taxYear: 2025,
    commune: 'LUGANO',
    civilStatus: 'single',
    people: [
      {
        id: 'p1',
        employments: [
          { gross: amt(85_000), socialContributions: amt(5_440), pensionFund: amt(5_100) },
        ],
        commuteMode: { by: 'public_transport' },
        commuteCost: amt(1_000),
        mealDays: 200,
        otherProfessionalCosts: amt(1_000),
        pillar3a: amt(7_258),
        workRate: 100,
        monthsWorked: 12,
      },
    ],
    household: { healthPremiums: amt(4_800), medicalCosts: amt(6_500), donations: amt(400) },
  };
  const r = computeReturn(input);

  it('gives Modulo 4 line by line, adding up to 9.1', () => {
    const parts = r.icc!.professional.map((i) => [i.code, i.person, i.amount]);
    // Public transport 1,000, meals 200 x 15 = 3,000, the flat amount 3,000 (2025): 7,000.
    expect(parts).toEqual([
      [MODULO4_CODES.transit.p1, 'p1', -chf(1_000)],
      [MODULO4_CODES.meals.p1, 'p1', -chf(3_000)],
      [MODULO4_CODES.otherFlat.p1, 'p1', -chf(3_000)],
    ]);
    const total = r.icc!.items.find((i) => i.code === '9.1')!.amount;
    expect(parts.reduce((s, p) => s + (p[2] as number), 0)).toBe(total);
    expect(r.icc!.professional[0]!.label.it).toMatch(/^2\.1 Abbonamento del mezzo pubblico/);
  });

  it('gives 22.1 a and b as the return lays them out, and c among the items', () => {
    const m = r.icc!.medical!;
    expect(m.costs.amount).toBe(chf(6_500));
    expect(m.costs.amount - m.threshold.amount).toBe(
      -r.icc!.items.find((i) => i.code === '22.1')!.amount,
    );
  });

  it('lists the limits each rule applied, in both taxes', () => {
    const rules = r.limits.map((l) => `${l.rule} ${l.code} ${l.tax}`);
    expect(rules).toEqual(
      expect.arrayContaining([
        'meals 408 both',
        'professional.flat 420 icc',
        'pillar3a 11.1 both',
        'insurance 12 icc',
        'insurance 12 ifd',
        'medical 22.1 icc',
        'donations 24 icc',
      ]),
    );
    expect(r.limits.every((l) => l.source)).toBe(true);
  });

  it('labels every line in Italian, the official term', () => {
    for (const i of [...r.icc!.items, ...r.ifd!.items]) expect(i.label.it, i.code).toBeTruthy();
    expect(r.icc!.items.find((i) => i.code === '1.1')!.label.it).toBe(
      'Attività dipendente principale, salario netto',
    );
  });
});
