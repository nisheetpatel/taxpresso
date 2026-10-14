// Annexe B (self-employment) on the copy panel: the sheets the tax engine makes for each business
// (packages/rules-ge, engine/business.ts) as form items, with the general information of B1 from the
// answers and the business's accounts. Pure. The lines the accounts give one by one (12.08 to 12.42,
// 12.48, 12.49, 57.50) and the AVS contributions (32.10, 32.11) come from the ledger (./ledger-map.ts);
// what the form adds up itself (12.17, 12.45, 12.46, 12.01 or 57.10, 57.20, 57.00, 12.50, 12.52,
// 32.00, PG4 51.60) comes from here, the engine's figures. ge-2025-declaration-specimen p. 7 to 10;
// ge-2025-guide-independants p. 10 to 24.
import type { Fact, FactStatus } from '@taxpresso/ledger';
import type { BusinessSheet, CommuneSlug, Item, Line } from '@taxpresso/rules-ge';
import { COMMUNE_CODES_2025 } from '../2025/commune-codes.js';
import { weakestStatus, type FormItem } from '../form.js';

export interface AnnexBInput {
  /** The engine's sheets, one per self-employed person. */
  sheets: readonly BusinessSheet[];
  /** The values that count now (answers, and the values of this year's documents). */
  facts: readonly Fact[];
  /** The commune of residence, where the business is (the only case Taxpresso prepares). */
  commune?: CommuneSlug;
  /** The status a computed line shows: computed, an estimate, or still needing the user's OK. */
  status: (line: Line) => FactStatus;
}

/** The lines of a sheet the engine works out, by column of the form. */
const COMPUTED = new Set(['12.17', '12.45', '12.46', '12.01', '57.10', '57.20', '57.00', '32.00']);
const COMPUTED_WEALTH = new Set(['12.50', '12.52', '51.60']);

/** The sheets of annexe B as form items, and the totals they carry to PG2, PG3 and PG4. */
export function annexBItems(input: AnnexBInput): FormItem[] {
  const out: FormItem[] = [];
  const answer = (key: string, person: string) =>
    input.facts.find((f) => f.key === key && f.person === person && f.status !== 'extracted');
  const value = (key: string, person: string) =>
    input.facts.filter((f) => f.key === key && f.person === person);
  const totals = { income: [] as Item[], wealthAssets: [] as Item[], wealthDebts: [] as Item[] };

  for (const s of input.sheets) {
    const person = s.person;
    const P = person === 'p1' ? 'A' : 'B';
    // B1: whose sheet, the business, its commune, its form, its year and method.
    out.push({ code: `B1-${P}`, person, tick: true, status: 'computed' });
    const name = value('business.name', person)[0];
    if (name && typeof name.value === 'string') {
      out.push({
        code: 'B1-NOM',
        person,
        text: name.value,
        status: name.status,
        source: { facts: [name.id] },
      });
    }
    const code = input.commune ? COMMUNE_CODES_2025[input.commune] : undefined;
    const place = answer('profile.business_place', person);
    if (code && place?.value === 'home_commune') {
      out.push({
        code: 'B1-COMMUNE',
        person,
        text: code,
        status: place.status,
        source: { facts: [place.id] },
      });
    }
    const form = answer('profile.business_form', person);
    if (form?.value === 'sole_proprietor') {
      out.push({
        code: 'B1-RI',
        person,
        tick: true,
        status: form.status,
        source: { facts: [form.id] },
      });
    }
    for (const [key, rubric] of [
      ['business.period_from', 'B1-DU'],
      ['business.period_to', 'B1-AU'],
    ] as const) {
      const f = value(key, person)[0];
      if (f && typeof f.value === 'string') {
        out.push({
          code: rubric,
          person,
          text: f.value,
          status: f.status,
          source: { facts: [f.id] },
        });
      }
    }
    const method = answer('profile.business_method', person);
    if (method?.value === 'invoice' || method?.value === 'cash') {
      out.push({
        code: method.value === 'invoice' ? 'B1-FACT' : 'B1-ENC',
        person,
        tick: true,
        status: method.status,
        source: { facts: [method.id] },
      });
    }
    const year = answer('profile.business_year', person);
    if (year) {
      const started = year.value === 'started';
      out.push({
        code: 'B1-DEBUT',
        person,
        text: started ? 'Oui' : 'Non',
        status: year.status,
        source: { facts: [year.id] },
      });
      out.push({
        code: 'B1-FIN',
        person,
        text: 'Non',
        status: year.status,
        source: { facts: [year.id] },
      });
    }

    // B2 and B4: one value for both columns when the two taxes agree, else one per column.
    const byCode = (list: readonly Item[]) =>
      new Map(list.filter((i) => COMPUTED.has(i.code)).map((i) => [i.code, i]));
    const icc = byCode(s.icc);
    const ifd = byCode(s.ifd);
    for (const c of new Set([...icc.keys(), ...ifd.keys()])) {
      const a = icc.get(c);
      const b = ifd.get(c);
      if (a && b && a.amount === b.amount) {
        out.push(item(c, person, a, input.status));
      } else {
        if (a) out.push(item(c, person, a, input.status, 'icc'));
        if (b) out.push(item(c, person, b, input.status, 'ifd'));
      }
    }
    for (const i of s.wealth) {
      if (COMPUTED_WEALTH.has(i.code)) out.push(item(i.code, person, i, input.status, 'wealth'));
    }
    const result = icc.get('12.01');
    if (result) totals.income.push(result);
    totals.wealthAssets.push(...s.wealth.filter((i) => i.code === '12.50'));
    totals.wealthDebts.push(...s.wealth.filter((i) => i.code === '57.50'));
  }

  // The totals carried to the summary pages: PG2 12.00 and PG4 12.00 and 57.00 (PG3 32.00 and
  // 57.00 take the sheets' own 32.00 and 57.00, the household's rubric adding them up).
  const carried = (code: string, list: Item[], column?: 'wealth') => {
    if (!list.length) return;
    out.push({
      code,
      person: 'household',
      ...(column ? { column } : {}),
      amount: Math.abs(list.reduce((sum, i) => sum + i.amount, 0)),
      status: weakestStatus(list.map((i) => input.status(i))),
      source: { facts: list.flatMap((i) => i.facts ?? []) },
    });
  };
  carried('12.00', totals.income);
  carried('12.00', totals.wealthAssets, 'wealth');
  carried('57.00', totals.wealthDebts, 'wealth');
  return out;
}

function item(
  code: string,
  person: 'p1' | 'p2',
  l: Item,
  status: (line: Line) => FactStatus,
  column?: 'icc' | 'ifd' | 'wealth',
): FormItem {
  return {
    code,
    person,
    ...(column ? { column } : {}),
    amount: Math.abs(l.amount),
    status: status(l),
    source: { ...(l.facts ? { facts: l.facts } : {}), rule: l.sources.join('; ') },
  };
}

/**
 * Pillar 3a of a self-employed person without a salary goes on annexe B (32.40) instead of A1 or
 * A2 (31.40, 41.40): the ledger's 3a values follow the engine there (ge-2025-guide-independants
 * p. 23).
 */
export function selfEmployed3a(
  ledger: readonly FormItem[],
  onAnnexB: ReadonlySet<'p1' | 'p2'>,
): FormItem[] {
  return ledger.map((i) =>
    (i.code === '31.40' || i.code === '41.40') &&
    (i.person === 'p1' || i.person === 'p2') &&
    onAnnexB.has(i.person)
      ? { ...i, code: '32.40' }
      : i,
  );
}
