// The table from ledger values to rubrics, and the items it makes until the engine lands.
import { Ledger, type FactStatus, type KeyDef, type VaultDocument } from '@taxpresso/ledger';
import { DOCUMENT_KEYS_2026, KEYS_2026 } from '@taxpresso/rules-ge';
import { describe, expect, it } from 'vitest';
import {
  ENGINE_RUBRICS_2026,
  FORM_2026,
  itemsFromLedger,
  LEDGER_ROUTES_2026,
  mergeItems,
  NOT_ON_THE_FORM_2026,
  type FormItem,
} from '../src/index.js';
import { expectCited } from './cite.js';

const doc = (id: string, extra: Partial<VaultDocument> = {}): VaultDocument => ({
  id,
  sha256: id.padEnd(64, '0'),
  filename: `${id}.pdf`,
  path: `documents/${id}.pdf`,
  bytes: 1000,
  addedAt: '2027-01-10T10:00:00.000Z',
  parse: { method: 'claude', ok: true, warnings: [] },
  taxYear: 2026,
  ...extra,
});

describe('the routes from ledger values to rubrics', () => {
  it('go from keys that exist to input rubrics of the right person, each cited', () => {
    for (const route of LEDGER_ROUTES_2026) {
      const def: KeyDef = KEYS_2026[route.key];
      expect(def, route.key).toBeDefined();
      expectCited(route.source, route.key);
      const targets =
        typeof route.to === 'string'
          ? [{ key: route.to, person: 'household' }]
          : [
              { key: route.to.A, person: 'A' },
              { key: route.to.B, person: 'B' },
            ];
      if (typeof route.to !== 'string') expect(def.perPerson, route.key).toBe(true);
      for (const t of targets) {
        const rubric = FORM_2026.rubrics.find((r) => r.key === t.key && r.person === t.person);
        expect(rubric, `${route.key} -> ${t.key} (${t.person})`).toBeDefined();
        expect(rubric!.role, t.key).toBe('input');
        expect(rubric!.supported, t.key).toBe(true);
        if (route.column) expect(rubric!.columns, t.key).toContain(route.column);
        if (route.line) expect(rubric!.repeats, t.key).toBeGreaterThan(0);
        if (rubric!.format === 'tick') expect(def.type, route.key).toBe('boolean');
        if (rubric!.format === 'money') expect(def.type, route.key).toBe('money');
        // A per-person value on a household rubric goes under that person ("Contr. A"), unless the
        // form asks one amount for the household (98.12).
        if (def.perPerson && typeof route.to === 'string' && !route.together) {
          expect(rubric!.parts, t.key).toEqual(expect.arrayContaining(['A', 'B']));
        }
      }
      // A salary certificate box goes where the form names that box ("code 2 du CS" takes 2.1 to 2.3).
      if (def.box && typeof route.to !== 'string') {
        const target = route.to.A;
        const csBox = FORM_2026.rubrics.find((r) => r.key === target)!.csBox;
        expect(csBox, route.key).toBeDefined();
        expect(def.box === csBox || def.box.startsWith(`${csBox}.`), route.key).toBe(true);
      }
    }
  });

  it('follow the boxes the form names: box 1 to 11.10, box 9 to 31.10, box 10.2 to 31.30', () => {
    const to = (key: string) => LEDGER_ROUTES_2026.filter((r) => r.key === key).map((r) => r.to);
    expect(to('salary.base')).toEqual([{ A: '11.10', B: '21.10' }]);
    expect(to('salary.gross')).toEqual([]);
    expect(to('salary.social_contributions')).toEqual([{ A: '31.10', B: '41.10' }]);
    expect(to('salary.lpp_buyin')).toEqual([{ A: '31.30', B: '41.30' }]);
    expect(to('pillar3a.paid')).toEqual([{ A: '31.40', B: '41.40' }]);
    expect(to('health.premiums')).toEqual(['52.21']);
    expect(to('childcare.costs')).toEqual(['59.10', '59.12']);
  });

  it('send the engine’s travel and meal lines to the columns the form prints for them', () => {
    expectCited(ENGINE_RUBRICS_2026.source, 'engine rubrics');
    for (const column of ['icc', 'ifd'] as const) {
      for (const code of ENGINE_RUBRICS_2026[column]) {
        const person =
          code[0] === '2' || code[0] === '4' ? 'B' : code.startsWith('3') ? 'A' : 'household';
        const rubric = FORM_2026.rubrics.find((r) => r.key === code && r.person === person);
        expect(rubric, `${code} (${person})`).toBeDefined();
        expect(rubric!.columns, code).toContain(column);
      }
    }
    // The lump sums from the 2nd pillar and pillar 3a: one "Montant" box of the household (PG2).
    for (const code of ENGINE_RUBRICS_2026.info) {
      const rubric = FORM_2026.rubrics.find((r) => r.key === code);
      expect(rubric, code).toMatchObject({ page: 'PG2', person: 'household', columns: ['amount'] });
    }
    expect(LEDGER_ROUTES_2026.filter((r) => r.key === 'capital.amount')).toMatchObject([
      { to: '98.12', together: true },
    ]);
    // Meals in both columns; Geneva travel in the ICC column, federal travel in the IFD column.
    expect(ENGINE_RUBRICS_2026.icc).toEqual(expect.arrayContaining(['31.60', '31.70', '41.70']));
    expect(ENGINE_RUBRICS_2026.ifd).toEqual(expect.arrayContaining(['31.60', '31.71', '41.71']));
    // The answers behind them are accounted for, as keys that exist.
    for (const key of [
      'profile.commute',
      'commute.transit_cost',
      'meals.days',
      'profile.child_support',
    ]) {
      expect(NOT_ON_THE_FORM_2026[key as keyof typeof NOT_ON_THE_FORM_2026], key).toMatch(
        /engine|decides/,
      );
      expect((KEYS_2026 as Record<string, KeyDef>)[key], key).toBeDefined();
    }
  });

  it('account for every value a document gives: routed, or not on the form for a reason', () => {
    for (const key of Object.keys(DOCUMENT_KEYS_2026)) {
      const routed = LEDGER_ROUTES_2026.some((r) => r.key === key);
      const why = NOT_ON_THE_FORM_2026[key as keyof typeof NOT_ON_THE_FORM_2026];
      expect(routed !== (why !== undefined), key).toBe(true);
    }
  });
});

function household(people: ('p1' | 'p2')[]) {
  const ledger = new Ledger(2026, KEYS_2026);
  const add = (
    key: string,
    person: 'p1' | 'p2' | 'household',
    instance: string,
    value: number | boolean | string,
    status: FactStatus = 'stated',
  ) =>
    ledger.append({
      key,
      person,
      instance,
      value,
      status: status === 'computed' ? 'stated' : status,
      source: { method: 'claude', docId: instance, page: 1 },
    });
  return { ledger, add, people };
}

describe('items from the ledger', () => {
  it('put each certificate on its own 11.10 line and add up the rest per rubric', () => {
    const { ledger, add, people } = household(['p1']);
    add('salary.base', 'p1', 'cert1', 80_000_00);
    add('salary.base', 'p1', 'cert2', 12_000_40);
    add('salary.board_lodging', 'p1', 'cert1', 1_000_00);
    add('salary.other_fringe', 'p1', 'cert2', 500_00);
    add('salary.gross', 'p1', 'cert1', 81_000_00);
    add('salary.social_contributions', 'p1', 'cert1', 5_000_00);
    add('salary.social_contributions', 'p1', 'cert2', 800_00, 'extracted');
    add('salary.free_transport', 'p1', 'cert1', false);
    add('salary.canteen', 'p1', 'cert2', true);
    add('pillar3a.paid', 'p1', 'att1', 3_000_00);
    add('pillar3a.paid', 'p1', 'att2', 4_258_00);
    ledger.append({
      key: 'profile.commune',
      person: 'household',
      value: 'meyrin',
      status: 'stated',
      source: { method: 'user', via: 'chat' },
    });
    const { items, unplaced } = itemsFromLedger({
      facts: ledger.view(),
      documents: [
        doc('cert1', { issuer: 'Exemple Horlogerie SA' }),
        doc('cert2', { issuer: 'Café du Coin Sàrl' }),
        doc('att1'),
        doc('att2'),
      ],
      people,
      taxYear: 2026,
    });
    expect(unplaced).toEqual([]);
    const find = (code: string) => items.filter((i) => i.code === code);
    expect(find('11.10')).toEqual([
      expect.objectContaining({
        person: 'p1',
        instance: 'cert1',
        amount: 80_000_00,
        fields: { employer: 'Exemple Horlogerie SA' },
        status: 'stated',
      }),
      expect.objectContaining({ instance: 'cert2', amount: 12_000_40 }),
    ]);
    expect(find('11.12')).toEqual([expect.objectContaining({ amount: 1_500_00 })]);
    expect(find('11.12')[0]!.instance).toBeUndefined();
    // One value still needs the user's OK: so does the sum.
    expect(find('31.10')).toEqual([
      expect.objectContaining({ amount: 5_800_00, status: 'extracted' }),
    ]);
    expect(find('31.40')).toEqual([expect.objectContaining({ amount: 7_258_00 })]);
    expect(find('31.40')[0]!.source?.documents).toEqual(['att1', 'att2']);
    expect(find('CS-G')).toEqual([expect.objectContaining({ tick: true })]);
    expect(find('CS-F')).toEqual([]);
    expect(find('PG1-COMMUNE')).toEqual([expect.objectContaining({ text: '6630' })]);
    // Box 8 is the sum of the boxes above: never typed.
    expect(items.some((i) => i.amount === 81_000_00)).toBe(false);
  });

  it('send taxpayer B to the 21.xx and 41.xx rubrics, and household documents by whose they are', () => {
    const { ledger, add, people } = household(['p1', 'p2']);
    add('salary.base', 'p2', 'certB', 60_000_00);
    add('health.premiums', 'household', 'lamalA', 4_800_00);
    add('health.premiums', 'household', 'lamalFamily', 9_000_00);
    add('health.premiums', 'household', 'lamalB', 4_500_00);
    const { items } = itemsFromLedger({
      facts: ledger.view(),
      documents: [
        doc('certB', { person: 'p2' }),
        doc('lamalA', { person: 'p1' }),
        doc('lamalB', { person: 'p2' }),
        doc('lamalFamily', { person: 'household' }),
      ],
      people,
      taxYear: 2026,
    });
    expect(items.find((i) => i.code === '21.10')).toMatchObject({
      person: 'p2',
      amount: 60_000_00,
    });
    expect(items.filter((i) => i.code === '52.21').map((i) => [i.person, i.amount])).toEqual([
      ['p1', 4_800_00],
      ['household', 9_000_00],
      ['p2', 4_500_00],
    ]);
  });

  it('leave out benefits already in the salary, other years, and pensions of unknown kind', () => {
    const { ledger, add, people } = household(['p1']);
    add('replacement.amount', 'p1', 'apg', 3_000_00);
    add('replacement.paid_to_employer', 'p1', 'apg', true);
    add('replacement.amount', 'p1', 'chomage', 9_000_00);
    add('pension.amount', 'p1', 'avs', 24_000_00);
    add('pension.type', 'p1', 'avs', 'avs_ai');
    add('pension.amount', 'p1', 'mystery', 1_000_00);
    add('pillar3a.paid', 'p1', 'old3a', 7_000_00);
    const { items, unplaced } = itemsFromLedger({
      facts: ledger.view(),
      documents: [
        doc('apg'),
        doc('chomage'),
        doc('avs'),
        doc('mystery'),
        doc('old3a', { taxYear: 2025 }),
      ],
      people,
      taxYear: 2026,
    });
    expect(items.filter((i) => i.code === '11.50')).toEqual([
      expect.objectContaining({ amount: 9_000_00 }),
    ]);
    expect(items.find((i) => i.code === '17.10')).toMatchObject({
      person: 'p1',
      amount: 24_000_00,
    });
    expect(items.some((i) => i.code === '31.40')).toBe(false);
    expect(unplaced).toEqual([
      { key: 'pension.amount', person: 'p1', docId: 'mystery', reason: 'needs_kind' },
    ]);
  });

  it('give a private loan one E1 line, interest and debt in their columns', () => {
    const { ledger, add, people } = household(['p1']);
    add('debt.interest', 'household', 'loan', 450_00);
    add('debt.balance', 'household', 'loan', 15_000_00);
    const { items } = itemsFromLedger({
      facts: ledger.view(),
      documents: [doc('loan', { issuer: 'Banque Exemple SA' })],
      people,
      taxYear: 2026,
    });
    expect(items.filter((i) => i.code === '55.10')).toEqual([
      expect.objectContaining({
        person: 'p1',
        column: 'icc_ifd',
        instance: 'loan',
        amount: 450_00,
      }),
      expect.objectContaining({
        column: 'wealth',
        amount: 15_000_00,
        fields: { creditor: 'Banque Exemple SA' },
      }),
    ]);
  });
});

describe('merging', () => {
  it('lets the engine replace the ledger for a rubric and person', () => {
    const item = (code: string, person: 'p1' | 'p2', amount: number): FormItem => ({
      code,
      person,
      amount,
      status: 'stated',
    });
    const engine = [
      { ...item('31.50', 'p1', 1_812_00), status: 'computed' as const },
      item('31.40', 'p1', 7_258_00),
    ];
    const ledger = [
      item('31.40', 'p1', 7_000_00),
      item('31.40', 'p2', 1_000_00),
      item('31.10', 'p1', 5_000_00),
    ];
    expect(mergeItems(engine, ledger).map((i) => [i.code, i.person, i.amount])).toEqual([
      ['31.50', 'p1', 1_812_00],
      ['31.40', 'p1', 7_258_00],
      ['31.40', 'p2', 1_000_00],
      ['31.10', 'p1', 5_000_00],
    ]);
  });
});
