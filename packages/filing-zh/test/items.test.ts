// The values to type on the Zurich return, from Zurich's engine, laid out by the shared copy panel:
// every value finds its line, a value both taxes share is typed once into each column, and the
// annexes add up to the lines they carry to. Synthetic households only.
import { buildCopyPanel, type CopyRow } from '@taxpresso/filing-ge';
import type { HouseholdInput } from '@taxpresso/rules-ch';
import { rules, type ZurichCantonal } from '@taxpresso/rules-zh';
import { describe, expect, it } from 'vitest';
import { FORM_ZH_2026, ZH_COPY_LABELS, zurichFormItems, zurichLineOf } from '../src/index.js';

const chf = (francs: number) => ({ value: francs * 100 });

/** The Muster family of Winterthur: two salaries, two children, a crèche, one church member. */
const MUSTER: HouseholdInput<ZurichCantonal> = {
  taxYear: 2026,
  commune: 230,
  civilStatus: 'married',
  people: [
    {
      id: 'p1',
      employments: [
        { gross: chf(95_000), socialContributions: chf(6_080), pensionFund: chf(5_200) },
      ],
      pillar3a: chf(7_258),
      commuteCost: chf(2_200),
      commuteMode: { by: 'public_transport' },
      mealDays: 200,
    },
    {
      id: 'p2',
      employments: [
        { gross: chf(42_000), socialContributions: chf(2_690), pensionFund: chf(1_500) },
      ],
      commuteMode: { by: 'bike' },
    },
  ],
  children: [
    { custody: 'full', childcare: chf(7_000) },
    { custody: 'full', childcare: chf(7_000) },
  ],
  household: { healthPremiums: chf(11_400), accidentPremiums: chf(300) },
  movable: [{ owner: 'p1', value: chf(40_000), income: chf(120) }],
  cantonal: { church: { p1: 'reformed', p2: 'none' } },
};

function panel(input: HouseholdInput<ZurichCantonal>) {
  const result = rules.computeReturn(input);
  const items = zurichFormItems(result);
  const built = buildCopyPanel({ form: FORM_ZH_2026, items, lang: 'en', labels: ZH_COPY_LABELS });
  const rows = built.sections.flatMap((s) => s.groups.flatMap((g) => g.rows));
  const row = (page: string, code: string, column?: string) =>
    rows.filter(
      (r) =>
        r.id.startsWith(`${page}|${code}|`) &&
        (column === undefined || r.columns.some((c) => c.id === column)),
    );
  return { result, items, built, rows, row };
}

const value = (rs: readonly CopyRow[]) => rs.map((r) => r.copy);

describe('the values to type on the Zurich return', () => {
  it('places every value, in the order you fill the form in', () => {
    const { built } = panel(MUSTER);
    expect(built.unplaced).toEqual([]);
    expect(built.sections.map((s) => s.page)).toEqual(['S2', 'BA1', 'BA2', 'VP', 'S3', 'S4']);
    expect(built.provisional).toBe(true);
  });

  it('types a value the two taxes share once into each column, else one per column', () => {
    const { row, result } = panel(MUSTER);
    // Pillar 3a: the same in both taxes.
    const pillar = row('S3', '260');
    expect(pillar).toHaveLength(1);
    expect(pillar[0]!.columns.map((c) => c.label)).toEqual(['Staatssteuer', 'Bundessteuer']);
    expect(value(pillar)).toEqual(['7258']);
    // Insurance premiums: each tax has its own limit.
    const icc = result.icc!.items.find((i) => i.code === '270')!;
    const ifd = result.ifd!.items.find((i) => i.code === '270')!;
    expect(value(row('S3', '270', 'icc'))).toEqual([String(-icc.amount / 100)]);
    expect(value(row('S3', '270', 'ifd'))).toEqual([String(-ifd.amount / 100)]);
    // The married couple deduction is federal only.
    expect(row('S3', '365').map((r) => r.columns.map((c) => c.id))).toEqual([['ifd']]);
    // Income is one column, for both taxes.
    expect(row('S2', '100')[0]!.columns.map((c) => c.label)).toEqual(['CHF ohne Rappen']);
    expect(value(row('S2', '199'))).toEqual([String(result.icc!.grossIncome.amount / 100)]);
  });

  it('fills the Berufsauslagen form so its lines add up to 220 and 240', () => {
    const { row, result } = panel(MUSTER);
    const total = (code: string, column: 'icc' | 'ifd') => {
      const items = column === 'icc' ? result.icc!.items : result.ifd!.items;
      return -items.find((i) => i.code === code)!.amount / 100;
    };
    for (const column of ['icc', 'ifd'] as const) {
      const n = (page: string, code: string) => Number(row(page, code, column)[0]?.copy ?? 0);
      expect(n('BA1', '205') + n('BA1', '208') + n('BA1', '212')).toBe(total('220', column));
      expect(n('BA1', '220')).toBe(total('220', column));
      expect(n('BA2', '225') + n('BA2', '232')).toBe(total('240', column));
    }
    // The pass, uncapped, and the travel subtotal at most the cap of each tax.
    expect(value(row('BA1', '201'))).toEqual(['2200']);
    expect(value(row('BA2', '222'))).toEqual(['700']);
    expect(row('BA1', '205')[0]!.role).toBe('total');
  });

  it('fills part A of the Versicherungsprämien form once, and part B per tax', () => {
    const { row } = panel(MUSTER);
    expect(value(row('VP', '601'))).toEqual(['11400']);
    expect(value(row('VP', '602'))).toEqual(['300']);
    expect(value(row('VP', '606'))).toEqual(['11700']);
    expect(row('VP', '616')).toHaveLength(2);
    expect(row('VP', '270').map((r) => r.role)).toEqual(['total', 'total']);
  });

  it('declares the wealth page only with wealth, and 398 and 498 as 390 and 490', () => {
    const { row, result } = panel(MUSTER);
    expect(value(row('S4', '400'))).toEqual(['40000']);
    expect(value(row('S4', '498'))).toEqual(value(row('S4', '490')));
    expect(value(row('S3', '398', 'icc'))).toEqual([
      String(result.icc!.taxableIncome.amount / 100),
    ]);
    const poor = panel({ ...MUSTER, movable: [] });
    expect(poor.built.sections.map((s) => s.page)).not.toContain('S4');
  });

  it('gives nothing to type before the tax can be computed', () => {
    expect(zurichFormItems({ ...rules.computeReturn(MUSTER), icc: null })).toEqual([]);
  });

  it('knows the line of each ledger value, per person', () => {
    expect(zurichLineOf('salary.gross', 'p2')).toBe('101');
    expect(zurichLineOf('pillar3a.paid', 'p1')).toBe('260');
    expect(zurichLineOf('health.premiums', 'household')).toBe('601');
    expect(zurichLineOf('profile.commune', 'household')).toBeUndefined();
  });
});
