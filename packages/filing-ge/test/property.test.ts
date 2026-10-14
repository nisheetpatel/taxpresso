// A property in Geneva on the copy panel and in the PDF check: annexe D's lines as the engine makes
// them (D1 15.10 for one's own home, D2 15.20 for one let), their totals on PG2, PG3 and PG4 with a
// property abroad's, the mortgage on E1 55.20, and the PDF check reading them without false
// differences (ge-2025-declaration-specimen p. 2 to 4, 15, 16 and 19).
import { Ledger, type VaultDocument } from '@taxpresso/ledger';
import {
  computeReturn,
  KEYS_2026,
  type EngineInput,
  type Line,
  type WealthItemInput,
} from '@taxpresso/rules-ge';
import { describe, expect, it } from 'vitest';
import {
  annexDItems,
  buildCopyPanel,
  FORM_2026,
  itemsFromLedger,
  reconcileDeclaration,
  type FormItem,
  type PrintedLine,
} from '../src/index.js';

const chf = (francs: number) => Math.round(francs * 100);
const v = (francs: number) => ({ value: chf(francs) });
const status = (l: Line) => (l.estimates?.length ? ('estimate' as const) : ('computed' as const));
const w = (code: string, part: WealthItemInput['part'], francs: number): WealthItemInput => ({
  code,
  part,
  person: 'household',
  centimes: chf(francs),
  taxes: part === 'wealth' || part === 'wealth_deduction' ? ['icc'] : ['icc', 'ifd'],
  estimate: false,
  complete: true,
  label: { en: code, fr: code },
  source: 'ge-2025-declaration-specimen p. 19',
});

/** Julien and Anaïs Chevalley's flat in Lancy (packages/rules-ge/test/property.test.ts, P1). */
const chevalley: EngineInput = {
  taxYear: 2025,
  commune: 'lancy',
  civilStatus: 'married',
  people: [
    {
      id: 'p1',
      employments: [{ gross: v(118_000), socialContributions: v(7_434), pensionFund: v(8_260) }],
    },
    {
      id: 'p2',
      employments: [{ gross: v(82_000), socialContributions: v(5_166), pensionFund: v(4_920) }],
    },
  ],
  household: { healthPremiums: v(11_600) },
  wealthItems: [w('14.00', 'wealth', 35_000), w('55.20', 'wealth_deduction', 450_000)],
  property: {
    owner: 'household',
    use: 'own_home',
    kind: 'flat',
    since: 2019,
    old: true,
    value: v(930_000),
    rentalValue: v(27_600),
  },
};

const row = (items: FormItem[], code: string, column?: string) =>
  items.filter((i) => i.code === code && (column === undefined || i.column === column));

describe('annexe D for a property in Geneva', () => {
  it('puts the home on D1 15.10, its three columns and what the line asks, with the totals', () => {
    const r = computeReturn(chevalley);
    const items = annexDItems({
      property: r.property!,
      communeCode: '6628',
      parcel: 'Lancy 4521',
      status,
    });
    expect(row(items, '15.10', 'wealth')).toEqual([
      expect.objectContaining({
        instance: 'geneva',
        amount: chf(669_600),
        fields: {
          lieu: '6628',
          parcel: 'Lancy 4521',
          since: '2019',
          capital: '930000',
          abattement: '28',
          vlBrute: '27600',
          vlApres: '19872',
          chargesIfd: '5520',
          chargesIcc: '4968',
        },
      }),
    ]);
    expect(row(items, '15.10', 'ifd')[0]!.amount).toBe(chf(27_600));
    expect(row(items, '15.10', 'icc')[0]!.amount).toBe(chf(19_872));
    // The totals carried to PG2 15.00, PG4 15.00 and PG3 58.00.
    expect(row(items, '15.00').map((i) => [i.column, i.amount])).toEqual([
      ['icc', chf(19_872)],
      ['ifd', chf(27_600)],
      ['wealth', chf(669_600)],
    ]);
    expect(row(items, '58.00').map((i) => [i.column, i.amount])).toEqual([
      ['icc', chf(4_968)],
      ['ifd', chf(5_520)],
    ]);
  });

  it('adds a home in Geneva and a home abroad on D1, two lines, one total', () => {
    const r = computeReturn({
      ...chevalley,
      abroad: {
        owner: 'household',
        use: 'own_use',
        country: { en: 'France', fr: 'France' },
        france: true,
        value: v(297_760),
        valueBasis: 'purchase_price',
        rentalValue: v(5_809.62),
        rentalBasis: 'france_habitation',
        old: true,
      },
    });
    expect(r.unsupported).toEqual([]);
    const items = annexDItems({ property: r.property!, abroad: r.abroad!, status });
    expect(row(items, '15.10', 'wealth').map((i) => [i.instance, i.amount])).toEqual([
      ['geneva', chf(669_600)],
      ['abroad', chf(297_760)],
    ]);
    expect(row(items, '15.00', 'icc')[0]!.amount).toBe(chf(19_872 + 5_809.62));
    expect(row(items, '15.00', 'wealth')[0]!.amount).toBe(chf(669_600 + 297_760));
    expect(row(items, '58.00', 'ifd')[0]!.amount).toBe(chf(5_520 + 1_162));
    // A property abroad alone gives what it gave before: its line, no Geneva fields.
    const alone = annexDItems({ abroad: r.abroad!, status });
    expect(row(alone, '15.10', 'wealth')[0]!.fields).toEqual({
      situation: 'France',
      capital: '297760',
      vlBrute: '5810',
      vlApres: '5810',
      chargesIfd: '1162',
      chargesIcc: '1452',
    });
  });

  it('puts a property let on D2 15.20: its value and rents, no abattement', () => {
    const r = computeReturn({
      ...chevalley,
      civilStatus: 'single',
      people: [chevalley.people[0]!],
      property: {
        owner: 'p1',
        use: 'let',
        old: false,
        value: v(640_000),
        rents: v(26_400),
        upkeep: v(2_150),
      },
    });
    const items = annexDItems({ property: r.property!, status });
    expect(row(items, '15.20', 'wealth')[0]).toMatchObject({
      amount: chf(640_000),
      fields: { partA: '100', capital: '640000', chargesIfd: '2640', chargesIcc: '2150' },
    });
    expect(row(items, '15.20', 'icc')[0]!.amount).toBe(chf(26_400));
  });
});

describe('the mortgage on E1', () => {
  it('goes on 55.20 from the lender’s statement, other loans stay on 55.10', () => {
    const ledger = new Ledger(2026, KEYS_2026);
    const add = (key: string, instance: string, value: number) =>
      ledger.append({
        key,
        person: 'household',
        instance,
        value,
        status: 'stated',
        source: { method: 'claude', docId: instance, page: 1 },
      });
    add('debt.interest', 'mortgage', chf(6_750));
    add('debt.balance', 'mortgage', chf(450_000));
    add('debt.interest', 'car', chf(320));
    add('debt.balance', 'car', chf(8_000));
    const doc = (id: string, kind: VaultDocument['kind'], issuer: string): VaultDocument => ({
      id,
      sha256: id.padEnd(64, '0'),
      filename: `${id}.pdf`,
      path: `documents/${id}.pdf`,
      bytes: 1,
      addedAt: '2027-01-10T10:00:00.000Z',
      parse: { method: 'claude', ok: true, warnings: [] },
      taxYear: 2026,
      issuer,
      ...(kind ? { kind } : {}),
    });
    const { items, unplaced } = itemsFromLedger({
      facts: ledger.view(),
      documents: [
        doc('mortgage', 'mortgage_statement', 'Banque Exemple SA'),
        doc('car', 'debt_interest', 'Crédit Exemple SA'),
      ],
      people: ['p1', 'p2'],
      taxYear: 2026,
    });
    expect(unplaced).toEqual([]);
    expect(items.map((i) => [i.code, i.column, i.instance, i.amount, i.fields])).toEqual([
      ['55.20', 'icc_ifd', 'mortgage', chf(6_750), { creditor: 'Banque Exemple SA' }],
      ['55.20', 'wealth', 'mortgage', chf(450_000), { creditor: 'Banque Exemple SA' }],
      ['55.10', 'icc_ifd', 'car', chf(320), { creditor: 'Crédit Exemple SA' }],
      ['55.10', 'wealth', 'car', chf(8_000), { creditor: 'Crédit Exemple SA' }],
    ]);
  });
});

describe('the PDF check with a property in Geneva', () => {
  const at = (
    form: string,
    code: string,
    values: Partial<PrintedLine>,
    page: number,
  ): PrintedLine => ({ form, code, person: 'household', page, occurrence: 1, ...values });

  it('matches the home’s line column by column (whole francs), and the mortgage on E1', () => {
    const r = computeReturn(chevalley);
    const items: FormItem[] = [
      ...annexDItems({ property: r.property!, status }),
      {
        code: '55.20',
        person: 'household',
        column: 'icc_ifd',
        instance: 'mortgage',
        amount: chf(6_750),
        status: 'stated',
      },
      {
        code: '55.20',
        person: 'household',
        column: 'wealth',
        instance: 'mortgage',
        amount: chf(450_000),
        status: 'stated',
      },
    ];
    const panel = buildCopyPanel({ form: FORM_2026, items, lang: 'en' });
    const c = reconcileDeclaration({
      form: FORM_2026,
      panel,
      printed: [
        at('D1', '15.10', { amounts: [chf(669_600), chf(27_600), chf(19_872)] }, 15),
        at('E1', '55.20', { amounts: [chf(6_750), chf(450_000)] }, 19),
      ],
      lang: 'en',
    });
    const line = (page: string, ref: string) =>
      c.sections.find((s) => s.page === page)?.lines.find((l) => l.ref === ref);
    expect(line('D1', '15.10-1')).toMatchObject({
      outcome: 'match',
      cells: [
        { column: 'icc', taxpresso: 19_872, pdf: 19_872 },
        { column: 'ifd', taxpresso: 27_600, pdf: 27_600 },
        { column: 'wealth', taxpresso: 669_600, pdf: 669_600 },
      ],
    });
    expect(line('E1', '55.20-1')).toMatchObject({ outcome: 'match' });
    expect(c.counts).toMatchObject({ toFix: 0, differs: 0 });
  });
});
