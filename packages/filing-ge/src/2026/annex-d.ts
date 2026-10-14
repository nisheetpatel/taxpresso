// Annexe D (property) on the copy panel, for a home or land abroad: the lines the tax engine makes
// for it (packages/rules-ge, engine/abroad.ts) as form items, on D1 (15.10, a home the household
// uses) or D2 (15.20, let, or land), with the totals they carry to PG2 15.00, PG3 58.00 and PG4
// 15.00; and the loan on it in another currency on E1 (55.20, intérêts et dettes hypothécaires),
// converted by the securities list's other wealth (rules-ge, etat-des-titres.ts). Pure.
// ge-2025-declaration-specimen p. 2 to 4, 15, 16 and 19; ge-2025-guide-declaration-pp p. 32 to 35
// and 37. The share of the income and wealth not taxed in Geneva (97.00) is the extension's, with
// the other totals the engine works out.
import type { FactStatus } from '@taxpresso/ledger';
import type { AbroadResult, Item, Line, OtherLine } from '@taxpresso/rules-ge';
import { roundToFranc, weakestStatus, type FormItem } from '../form.js';

export interface AnnexDInput {
  /** The engine's property abroad. */
  abroad: AbroadResult;
  /** The securities list's other wealth: its debts read in another currency go on 55.20. */
  debts?: readonly OtherLine[];
  /** The status a computed line shows: computed, an estimate, or still needing the user's OK. */
  status: (line: Line) => FactStatus;
}

const francs = (centimes: number) => String(roundToFranc(Math.abs(centimes)));

/** The lines of annexe D for the property abroad, its totals, and its loan's lines on E1. */
export function annexDItems(input: AnnexDInput): FormItem[] {
  const { abroad, status } = input;
  const out: FormItem[] = [];
  const code = abroad.use === 'own_use' ? '15.10' : '15.20';
  const incomeIcc = abroad.icc.find((i) => i.code === code);
  const incomeIfd = abroad.ifd.find((i) => i.code === code);
  const costsIcc = abroad.icc.find((i) => i.code === '58.00');
  const costsIfd = abroad.ifd.find((i) => i.code === '58.00');
  const value = abroad.wealth.find((i) => i.code === code);
  const facts = (...lines: (Item | undefined)[]) => [
    ...new Set(lines.flatMap((l) => l?.facts ?? [])),
  ];
  const statusOf = (...lines: (Item | undefined)[]) =>
    weakestStatus(lines.filter((l): l is Item => !!l).map(status));

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

  const line = (column: 'wealth' | 'ifd' | 'icc', l: Item | undefined, withFields: boolean) => {
    if (!l && !withFields) return;
    out.push({
      code,
      person: 'household',
      column,
      instance: 'abroad',
      amount: Math.abs(l?.amount ?? 0),
      ...(withFields && Object.keys(fields).length ? { fields } : {}),
      status: statusOf(l ?? value ?? incomeIcc),
      source: {
        facts: facts(l),
        rule: (l?.sources ?? []).join('; '),
      },
    });
  };
  line('wealth', value, true);
  line('ifd', incomeIfd, false);
  line('icc', incomeIcc, false);

  // The totals the form carries to the summary pages.
  const carried = (c: string, column: 'icc' | 'ifd' | 'wealth', l: Item | undefined) => {
    if (!l) return;
    out.push({
      code: c,
      person: 'household',
      column,
      amount: Math.abs(l.amount),
      status: status(l),
      source: { facts: facts(l), rule: l.sources.join('; ') },
    });
  };
  carried('15.00', 'icc', incomeIcc);
  carried('15.00', 'ifd', incomeIfd);
  carried('15.00', 'wealth', value);
  carried('58.00', 'icc', costsIcc);
  carried('58.00', 'ifd', costsIfd);

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
