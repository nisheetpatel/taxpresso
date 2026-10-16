// A salary earned in another Geneva commune, worked out by hand for tax years 2025 and 2026 from the
// answers (profile.work_commune) to the tax. Fake people, fake figures.
//
// The rule, from the documents: the commune of residence taxes all income except a salary earned
// exclusively in another commune, which that commune taxes (ge-na-law-lcp art. 293 let. A ch. 1
// let. c and ch. 2 let. c). Each base tax is split: the privileged share goes to the commune of
// residence, at its centimes; the rest goes to the communes concerned, the commune of residence
// included, "proportionnellement au revenu ... afférents à chaque commune par rapport au revenu
// total" (art. 295A al. 1 and 2), each at its own centimes; "le solde étant attribué à la commune
// d'activité" (ge-2025-part-privilegiee-communique p. 8; ge-2026-part-privilegiee-communique
// p. 12). Which income measures the shares is not spelled out: Taxpresso takes the gross income
// (91.00), each salary in its commune of work and the rest in the commune of residence, and says
// so (NOTE.communalSplit). Each share and its tax to the nearest 5 centimes (NOTE.lineRounding).
// Wealth stays with the commune of residence (no wealth elsewhere). Centimes additionnels: Genève
// 45.49, Lancy 47, Onex 50.5, Carouge 40 in both years; privileged shares 2025 (AFC table): Lancy
// 49 %, Onex 80 %; 2026 (communiqué p. 12, RDLCP art. 11C): Lancy 51 %, Onex 80 %.
//
// W1. Lives in Lancy, works in the City of Geneva (Genève), single; a bank account with CHF 150 of
// interest (no withholding tax: at most 200).
// ICC: 11.10 100'000; 31.10 -6'900; 31.12 -7'100; 31.40 -7'000; 31.50 3 % x 86'000 = 2'580, at most
// 1'812; 14.00 150; 52.15 -150; 52.21 -6'000. Taxable 71'188: 3'140.40 + 22'879 x 13.20 % =
// 3'020.028 -> 3'020.05: base 6'160.45. Centimes 47.5 % 2'926.21375 -> 2'926.20; reduction 12 % x
// 9'086.65 = 1'090.398 -> 1'090.40; home care 61.6045 -> 61.60; cantonal 8'057.85.
// Gross income 91.00: 100'150, of which the salary 100'000 in Genève and the interest 150 in Lancy.
// 2025, Lancy PP 49 %: privileged 3'018.6205 -> 3'018.60 x 47 % = 1'418.742 -> 1'418.75; the rest
// 3'141.85: Genève 3'141.85 x 100'000 / 100'150 = 3'137.144 -> 3'137.15 x 45.49 % = 1'427.089 ->
// 1'427.10; Lancy keeps 4.70 x 47 % = 2.209 -> 2.20. Communal 2'848.05 (2'895.40 if the salary
// were earned in Lancy). ICC 8'057.85 + 2'848.05 + 25 = 10'930.90.
// 2026, Lancy PP 51 %: privileged 3'141.8295 -> 3'141.85 x 47 % = 1'476.6695 -> 1'476.65; the rest
// 3'018.60: Genève 3'014.0789 -> 3'014.10 x 45.49 % = 1'371.114 -> 1'371.10; Lancy keeps 4.50 x
// 47 % = 2.115 -> 2.10. Communal 2'849.85. ICC 10'932.70.
// IFD: 31.20 2'580; 52.00 6'000 + 150, at most 1'800. Taxable 74'770, at 74'700: 612.00 + 167 x
// 2.97 = 1'107.99 -> 1'107.95 (both years: under the 2026 step at 76'200).
//
// W2. A married couple in Onex: A works in Genève (90'000), B in Carouge (60'000); a joint account
// with CHF 200 of interest.
// ICC: A 11.10 90'000, 31.10 -6'210, 31.12 -6'290, 31.40 -7'000, 31.50 3 % x 77'500 = 2'325 -> 1'812;
// B 21.10 60'000, 41.10 -4'140, 41.12 -3'860, 41.50 3 % x 52'000 = 1'560, 41.95 -1'051 (the lower
// earned income); 14.00 200; 52.15 -200; 52.21 -11'999. Taxable 106'078, full splitting at 53'039:
// 3'140.40 + 4'730 x 13.20 % = 624.36 -> 624.35: 3'764.75 x 2 = base 7'529.50. Centimes 3'576.5125 ->
// 3'576.50; reduction 12 % x 11'106 = 1'332.72 -> 1'332.70; home care 75.295 -> 75.30; cantonal
// 9'848.60. Communal, Onex PP 80 % both years: privileged 6'023.60 x 50.5 % = 3'041.918 -> 3'041.90;
// the rest 1'505.90 by the gross income 150'200: Genève 1'505.90 x 90'000 / 150'200 = 902.337 ->
// 902.35 x 45.49 % = 410.479 -> 410.50; Carouge 1'505.90 x 60'000 / 150'200 = 601.558 -> 601.55 x
// 40 % = 240.62 -> 240.60; Onex keeps 2.00 x 50.5 % = 1.01 -> 1.00. Communal 3'694.00 (3'802.40 if
// both worked in Onex). ICC 9'848.60 + 3'694.00 + 25 = 13'567.60, both years.
// IFD: A 31.20 2'325; B 41.20 2'000 (3 % of 52'000 is under 2'000); 41.90 50 % of B's 50'000, at
// most 14'100; 52.00 11'999 + 200, at most 3'700; 59.20 2'800. Taxable 97'775, at 97'700 (married
// scale): 1'561.00 + 28 x 5.00 = 1'701.00, both years.
import { Ledger, type VaultDocument } from '@taxpresso/ledger';
import { describe, expect, it } from 'vitest';
import { computeReturn, engineInputFromFacts, KEYS_2026 } from '../src/index.js';

/** The rule the documents leave open, as compute_tax lists it (NOTE.communalSplit). */
const SPLIT = /^Salary earned in another commune: your home commune taxes its privileged share/;

type Who = 'p1' | 'p2' | 'household';

const doc = (id: string, kind: VaultDocument['kind'], person: Who, taxYear: number) =>
  ({
    id,
    sha256: id,
    filename: `${id}.pdf`,
    path: `documents/${id}.pdf`,
    bytes: 1,
    addedAt: `${taxYear + 1}-01-10T00:00:00.000Z`,
    kind,
    person,
    taxYear,
    parse: { method: 'claude', ok: true, warnings: [] },
  }) satisfies VaultDocument;

/** A ledger from answers and the values read in each document. */
function household(
  taxYear: number,
  answers: [string, Who, string | number | string[]][],
  documents: [string, VaultDocument['kind'], Who, [string, number][]][],
) {
  const l = new Ledger(taxYear, KEYS_2026);
  for (const [key, person, value] of answers) {
    l.append({ key, person, value, status: 'stated', source: { method: 'user', via: 'chat' } });
  }
  for (const [id, , person, values] of documents) {
    for (const [key, value] of values) {
      l.append({
        key,
        person: key.startsWith('bank.') || key.startsWith('health.') ? 'household' : person,
        instance: id,
        value,
        status: 'stated',
        source: { method: 'claude', docId: id, page: 1 },
      });
    }
  }
  const docs = documents.map(([id, kind, person]) => doc(id, kind, person, taxYear));
  return engineInputFromFacts(taxYear, l.view(), docs);
}

const w1 = (taxYear: number, work: string) =>
  household(
    taxYear,
    [
      ['profile.civil_status', 'household', 'single'],
      ['profile.commune', 'household', 'lancy'],
      ['profile.children_count', 'household', 0],
      ['profile.income_sources', 'p1', ['salary']],
      ['profile.work_commune', 'p1', work],
    ],
    [
      [
        'd_cert',
        'salary_certificate',
        'p1',
        [
          ['salary.gross', 100_000_00],
          ['salary.social_contributions', 6_900_00],
          ['salary.lpp_ordinary', 7_100_00],
        ],
      ],
      ['d_3a', 'pillar3a_attestation', 'p1', [['pillar3a.paid', 7_000_00]]],
      ['d_health', 'health_premiums', 'household', [['health.premiums', 6_000_00]]],
      [
        'd_bank',
        'bank_attestation',
        'p1',
        [
          ['bank.balance', 30_000_00],
          ['bank.interest_gross', 150_00],
          ['bank.withholding_swiss', 0],
        ],
      ],
    ],
  );

const w2 = (taxYear: number, workA: string, workB: string) =>
  household(
    taxYear,
    [
      ['profile.civil_status', 'household', 'married'],
      ['profile.commune', 'household', 'onex'],
      ['profile.children_count', 'household', 0],
      ['profile.income_sources', 'p1', ['salary']],
      ['profile.income_sources', 'p2', ['salary']],
      ['profile.work_commune', 'p1', workA],
      ['profile.work_commune', 'p2', workB],
    ],
    [
      [
        'd_cert_a',
        'salary_certificate',
        'p1',
        [
          ['salary.gross', 90_000_00],
          ['salary.social_contributions', 6_210_00],
          ['salary.lpp_ordinary', 6_290_00],
        ],
      ],
      [
        'd_cert_b',
        'salary_certificate',
        'p2',
        [
          ['salary.gross', 60_000_00],
          ['salary.social_contributions', 4_140_00],
          ['salary.lpp_ordinary', 3_860_00],
        ],
      ],
      ['d_3a_a', 'pillar3a_attestation', 'p1', [['pillar3a.paid', 7_000_00]]],
      ['d_health', 'health_premiums', 'household', [['health.premiums', 11_999_00]]],
      [
        'd_bank',
        'bank_attestation',
        'household',
        [
          ['bank.balance', 40_000_00],
          ['bank.interest_gross', 200_00],
          ['bank.withholding_swiss', 0],
        ],
      ],
    ],
  );

const shares = (r: ReturnType<typeof computeReturn>) =>
  r.icc!.taxes.communalIncome.rest.map((s) => [s.commune, s.base.amount, s.tax.amount]);

describe('a salary earned in another commune, from the answers, by hand', () => {
  const W1 = {
    2025: {
      privileged: 1_418_75,
      rest: [
        ['lancy', 4_70, 2_20],
        ['geneve', 3_137_15, 1_427_10],
      ],
      communal: 2_848_05,
      icc: 10_930_90,
    },
    2026: {
      privileged: 1_476_65,
      rest: [
        ['lancy', 4_50, 2_10],
        ['geneve', 3_014_10, 1_371_10],
      ],
      communal: 2_849_85,
      icc: 10_932_70,
    },
  } as const;
  for (const taxYear of [2025, 2026] as const) {
    it(`W1 ${taxYear}: lives in Lancy, works in the City of Geneva`, () => {
      const { input, missing, notes } = w1(taxYear, 'geneve');
      expect(missing).toEqual([]);
      expect(input!.people[0]!.employments![0]!.workCommune).toBe('geneve');
      expect(notes.map((n) => n.en).join(' ')).not.toMatch(/not answered yet/);
      const r = computeReturn(input!);
      const x = r.icc!.taxes;
      expect(r.icc!.taxableIncome.amount).toBe(71_188_00);
      expect(x.incomeBase.amount).toBe(6_160_45);
      expect(x.incomeCantonal.amount).toBe(8_057_85);
      const e = W1[taxYear];
      expect(x.communalIncome.privileged.tax.amount).toBe(e.privileged);
      expect(shares(r)).toEqual(e.rest);
      expect(x.communalIncomeTotal.amount).toBe(e.communal);
      expect(x.total.amount).toBe(e.icc);
      expect(r.ifd!.taxableIncome.amount).toBe(74_770_00);
      expect(r.ifd!.tax.amount).toBe(1_107_95);
      // The reading the documents leave open is said; the share cites the year's communiqué.
      expect(r.unverifiedRules.some((u) => SPLIT.test(u.en))).toBe(true);
      const geneva = r.icc!.taxes.communalIncome.rest.find((s) => s.commune === 'geneve')!;
      expect(geneva.base.sources.join('; ')).toMatch(
        taxYear === 2025
          ? /ge-2025-part-privilegiee-communique p\. 8/
          : /ge-2026-part-privilegiee-communique p\. 12/,
      );
    });

    it(`W1 ${taxYear}: at home, or outside the canton, all of it is Lancy's`, () => {
      for (const work of ['lancy', 'outside_geneva']) {
        const { input } = w1(taxYear, work);
        const r = computeReturn(input!);
        expect(shares(r).map(([c]) => c)).toEqual(['lancy']);
        expect(r.icc!.taxes.communalIncomeTotal.amount).toBe(2_895_40);
        expect(r.unverifiedRules.some((u) => SPLIT.test(u.en))).toBe(false);
      }
    });

    it(`W2 ${taxYear}: a couple in Onex, one working in Genève, the other in Carouge`, () => {
      const { input, missing } = w2(taxYear, 'geneve', 'carouge');
      expect(missing).toEqual([]);
      const r = computeReturn(input!);
      const x = r.icc!.taxes;
      expect(r.icc!.taxableIncome.amount).toBe(106_078_00);
      expect(r.icc!.rateIncome.amount).toBe(53_039_00);
      expect(x.incomeBase.amount).toBe(7_529_50);
      expect(x.incomeCantonal.amount).toBe(9_848_60);
      expect(x.communalIncome.privileged.tax.amount).toBe(3_041_90);
      expect(shares(r)).toEqual([
        ['onex', 2_00, 1_00],
        ['geneve', 902_35, 410_50],
        ['carouge', 601_55, 240_60],
      ]);
      expect(x.communalIncomeTotal.amount).toBe(3_694_00);
      expect(x.total.amount).toBe(13_567_60);
      expect(r.ifd!.taxableIncome.amount).toBe(97_775_00);
      expect(r.ifd!.tax.amount).toBe(1_701_00);
      // Both at home: Onex taxes it all, 3'802.40.
      const home = computeReturn(w2(taxYear, 'onex', 'onex').input!);
      expect(home.icc!.taxes.communalIncomeTotal.amount).toBe(3_802_40);
    });
  }

  it('not answered yet: the commune of residence, said; several communes: no tax (fail closed)', () => {
    const open = household(
      2026,
      [
        ['profile.civil_status', 'household', 'single'],
        ['profile.commune', 'household', 'lancy'],
        ['profile.children_count', 'household', 0],
        ['profile.income_sources', 'p1', ['salary']],
      ],
      [['d_cert', 'salary_certificate', 'p1', [['salary.gross', 80_000_00]]]],
    );
    expect(open.input!.people[0]!.employments![0]!.workCommune).toBeUndefined();
    expect(open.notes.map((n) => n.en)).toContain(
      "Where you work is not answered yet: the salary counts for your commune of residence, all its communal tax at that commune's centimes.",
    );
    const several = w1(2026, 'several_communes');
    expect(several.input!.unsupported?.map((u) => u.en)).toEqual([
      "Work in more than one Geneva commune: the communal tax is then shared between those communes by the income earned in each, which one answer can't say, so no tax is computed.",
    ]);
    const r = computeReturn(several.input!);
    expect(r.icc).toBeNull();
    expect(r.total).toBeNull();
  });
});
