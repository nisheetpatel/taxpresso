// Annexe D (property) on the copy panel: the lines the tax engine makes for a home or land abroad
// (packages/rules-ge, engine/abroad.ts) and for a property in Geneva (engine/property.ts) as form
// items, on D1 (15.10, a home the owner uses) or D2 (15.20, let, or land), with the totals they
// carry to PG2 15.00, PG3 58.00 and PG4 15.00; and a loan abroad in another currency on E1 (55.20,
// intérêts et dettes hypothécaires), converted by the securities list's other wealth (rules-ge,
// etat-des-titres.ts). A mortgage on a property in Geneva comes from the ledger (./ledger-map.ts).
// Pure.
// ge-2025-declaration-specimen p. 2 to 4, 15, 16 and 19; ge-2025-guide-declaration-pp p. 32 to 35
// and 37. The share of the income and wealth not taxed in Geneva (97.00) is the extension's, with
// the other totals the engine works out.
import type { FactStatus } from '@taxpresso/ledger';
import type { AbroadResult, Item, Line, OtherLine, PropertyResult } from '@taxpresso/rules-ge';
import { roundToFranc, weakestStatus, type FormItem } from '../form.js';

export interface AnnexDInput {
  /** The engine's property abroad. */
  abroad?: AbroadResult;
  /** The engine's property in Geneva. */
  property?: PropertyResult;
  /** The property in Geneva's commune code (Code lieu): the commune where the household lives. */
  communeCode?: string;
  /** The property in Geneva's cadastral commune and parcel, as read on the avis de taxation immobilier. */
  parcel?: string;
  /** The securities list's other wealth: its debts read in another currency go on 55.20. */
  debts?: readonly OtherLine[];
  /** The status a computed line shows: computed, an estimate, or still needing the user's OK. */
  status: (line: Line) => FactStatus;
}

const francs = (centimes: number) => String(roundToFranc(Math.abs(centimes)));

/** One property's lines on annexe D, and what it carries to the summary pages. */
interface PropertyLines {
  code: '15.10' | '15.20';
  instance: string;
  fields: Record<string, string>;
  value?: Item;
  incomeIcc?: Item;
  incomeIfd?: Item;
  costsIcc?: Item;
  costsIfd?: Item;
}

/** The lines of annexe D for the properties, their totals, and a loan abroad's lines on E1. */
export function annexDItems(input: AnnexDInput): FormItem[] {
  const { status } = input;
  const out: FormItem[] = [];
  const facts = (...lines: (Item | undefined)[]) => [
    ...new Set(lines.flatMap((l) => l?.facts ?? [])),
  ];
  const statusOf = (...lines: (Item | undefined)[]) =>
    weakestStatus(lines.filter((l): l is Item => !!l).map(status));

  const properties: PropertyLines[] = [];
  // A property in Geneva first: the household's own home, or one let (specimen p. 15 and 16).
  const p = input.property;
  if (p) {
    const own = p.use === 'own_home';
    const code = own ? '15.10' : '15.20';
    const value = p.wealth.find((i) => i.code === code);
    const incomeIcc = p.icc.find((i) => i.code === code);
    const incomeIfd = p.ifd.find((i) => i.code === code);
    const costsIcc = p.icc.find((i) => i.code === '58.00');
    const costsIfd = p.ifd.find((i) => i.code === '58.00');
    const fields: Record<string, string> = {};
    if (input.communeCode) fields.lieu = input.communeCode;
    if (input.parcel) fields.parcel = input.parcel;
    if (p.owner === 'p1') fields.partA = '100';
    if (p.owner === 'p2') fields.partB = '100';
    if (own && p.since !== undefined) fields.since = String(p.since);
    if (p.value) fields.capital = francs(p.value.amount);
    if (own && p.abattementBp !== undefined) fields.abattement = String(p.abattementBp / 100);
    if (own && incomeIfd) fields.vlBrute = francs(incomeIfd.amount);
    if (own && incomeIcc) fields.vlApres = francs(incomeIcc.amount);
    if (costsIfd) fields.chargesIfd = francs(costsIfd.amount);
    if (costsIcc) fields.chargesIcc = francs(costsIcc.amount);
    properties.push({
      code,
      instance: 'geneva',
      fields,
      ...(value ? { value } : {}),
      ...(incomeIcc ? { incomeIcc } : {}),
      ...(incomeIfd ? { incomeIfd } : {}),
      ...(costsIcc ? { costsIcc } : {}),
      ...(costsIfd ? { costsIfd } : {}),
    });
  }
  // A property abroad.
  const abroad = input.abroad;
  if (abroad) {
    const code = abroad.use === 'own_use' ? '15.10' : '15.20';
    const incomeIcc = abroad.icc.find((i) => i.code === code);
    const incomeIfd = abroad.ifd.find((i) => i.code === code);
    const costsIcc = abroad.icc.find((i) => i.code === '58.00');
    const costsIfd = abroad.ifd.find((i) => i.code === '58.00');
    const value = abroad.wealth.find((i) => i.code === code);
    // What the line says about the property (specimen p. 15 and 16).
    const fields: Record<string, string> = {};
    if (abroad.country) fields.situation = abroad.country.fr;
    if (abroad.owner === 'p1') fields.partA = '100';
    if (abroad.owner === 'p2') fields.partB = '100';
    if (value) fields.capital = francs(value.amount);
    if (abroad.use === 'own_use' && incomeIfd) {
      // No abattement abroad (the 4 % a year is for property in Geneva: LIPP art. 50 let. e).
      fields.vlBrute = francs(incomeIfd.amount);
      fields.vlApres = francs(incomeIfd.amount);
    }
    if (costsIfd) fields.chargesIfd = francs(costsIfd.amount);
    if (costsIcc) fields.chargesIcc = francs(costsIcc.amount);
    properties.push({
      code,
      instance: 'abroad',
      fields,
      ...(value ? { value } : {}),
      ...(incomeIcc ? { incomeIcc } : {}),
      ...(incomeIfd ? { incomeIfd } : {}),
      ...(costsIcc ? { costsIcc } : {}),
      ...(costsIfd ? { costsIfd } : {}),
    });
  }

  for (const pl of properties) {
    const line = (column: 'wealth' | 'ifd' | 'icc', l: Item | undefined, withFields: boolean) => {
      if (!l && !withFields) return;
      out.push({
        code: pl.code,
        person: 'household',
        column,
        instance: pl.instance,
        amount: Math.abs(l?.amount ?? 0),
        ...(withFields && Object.keys(pl.fields).length ? { fields: pl.fields } : {}),
        status: statusOf(l ?? pl.value ?? pl.incomeIcc),
        source: {
          facts: facts(l),
          rule: (l?.sources ?? []).join('; '),
        },
      });
    };
    line('wealth', pl.value, true);
    line('ifd', pl.incomeIfd, false);
    line('icc', pl.incomeIcc, false);
  }

  // The totals the form carries to the summary pages: every property's lines added up.
  const carried = (c: string, column: 'icc' | 'ifd' | 'wealth', ls: (Item | undefined)[]) => {
    const list = ls.filter((l): l is Item => !!l);
    if (!list.length) return;
    out.push({
      code: c,
      person: 'household',
      column,
      amount: Math.abs(list.reduce((s, l) => s + l.amount, 0)),
      status: statusOf(...list),
      source: {
        facts: facts(...list),
        rule: [...new Set(list.flatMap((l) => l.sources))].join('; '),
      },
    });
  };
  carried(
    '15.00',
    'icc',
    properties.map((pl) => pl.incomeIcc),
  );
  carried(
    '15.00',
    'ifd',
    properties.map((pl) => pl.incomeIfd),
  );
  carried(
    '15.00',
    'wealth',
    properties.map((pl) => pl.value),
  );
  carried(
    '58.00',
    'icc',
    properties.map((pl) => pl.costsIcc),
  );
  carried(
    '58.00',
    'ifd',
    properties.map((pl) => pl.costsIfd),
  );

  // A loan read in another currency (a mortgage abroad): E1 55.20, one line per statement.
  for (const d of input.debts ?? []) {
    if (d.rubric !== 'debts' || !d.currency) continue;
    const s: FactStatus =
      d.state === 'needs_ok' ? 'extracted' : d.state === 'estimate' ? 'estimate' : 'stated';
    const base = {
      code: '55.20',
      person: 'household' as const,
      instance: d.id,
      fields: { creditor: d.name },
      status: s,
      source: { ...(d.docId ? { documents: [d.docId] } : {}) },
    };
    if (d.flow !== undefined) out.push({ ...base, column: 'icc_ifd', amount: d.flow });
    if (d.value !== undefined) out.push({ ...base, column: 'wealth', amount: d.value });
  }
  return out;
}
