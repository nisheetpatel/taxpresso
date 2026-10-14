// Suggested answers from last year's declaration (SPEC.md section 5.4): the questionnaire's
// answers that the declaration shows for sure. Each becomes a fact "extracted" (Needs your OK)
// that the questionnaire shows as a suggestion; it counts only once the user answers (C7).
// When the declaration can't say for sure (whose a pension is, crèche or nanny, how many banks),
// nothing is suggested and the question is asked as usual.
//
// Taxpayer A (contribuable A) is "you" (p1) and B "your spouse or partner" (p2).
import type { FactValue } from '@taxpresso/ledger';
import type { PriorDeclaration, PriorItem } from '@taxpresso/intake';

export interface ProfileSuggestion {
  key: string;
  person: 'p1' | 'p2' | 'household';
  value: FactValue;
  /** The page of the declaration it comes from. */
  page: number;
}

/** The largest amount on a line, any column or table row: whether the line says something. */
const size = (i: PriorItem) =>
  Math.max(
    Math.abs(i.icc ?? 0),
    Math.abs(i.ifd ?? 0),
    ...(i.amounts ?? []).map(Math.abs),
    ...(i.table ?? []).map(Math.abs),
  );

export function profileSuggestions(d: PriorDeclaration): ProfileSuggestion[] {
  const out: ProfileSuggestion[] = [];
  const pageOf = (form: string) => d.forms.find((f) => f.form === form)?.page;
  const lines = (codes: string[], filter: (i: PriorItem) => boolean = () => true) =>
    d.items.filter((i) => codes.includes(i.code) && !i.suffix && filter(i) && size(i) > 0);
  const has = (codes: string[], filter?: (i: PriorItem) => boolean) =>
    lines(codes, filter).length > 0;
  const firstPage = (codes: string[], fallback: number) => lines(codes)[0]?.page ?? fallback;
  const couple = d.taxpayers.b !== undefined;
  const identity = pageOf('PG1') ?? 1;

  // The canton: Taxpresso reads Geneva's declaration (GeTax, the online declaration), so last
  // year's return was a Geneva one (docs/design/cantons.md, section 3: the canton is prefilled from
  // last year's return, never guessed from an address in a document).
  out.push({ key: 'profile.canton', person: 'household', value: 'GE', page: identity });

  // Civil status on 31 December last year.
  if (d.taxpayers.a.civilStatus) {
    out.push({
      key: 'profile.civil_status',
      person: 'household',
      value: d.taxpayers.a.civilStatus,
      page: identity,
    });
  }

  // Commune of residence, only from the official list of commune codes or names.
  if (d.residence) {
    out.push({
      key: 'profile.commune',
      person: 'household',
      value: d.residence.commune,
      page: d.residence.page,
    });
  }

  // Kinds of income, per taxpayer, when every kind on the income page can be put on someone.
  const incomePage = pageOf('PG2');
  if (incomePage) {
    const pension = has(['17.00', '13.20', '13.30', '13.40', '13.50']);
    const alimony = has(['13.10', '13.15']);
    const otherC1 = has(['13.00']) && !pension && !alimony;
    const selfEmployed = has(['12.00']) || d.forms.some((f) => /^B/.test(f.form));
    const sure = !otherC1 && (!couple || (!pension && !alimony && !selfEmployed));
    if (sure) {
      const sources = (who: 'A' | 'B') => {
        const [salary, wages, benefits] =
          who === 'A' ? ['11.00', '11.10', '11.50'] : ['21.00', '21.10', '21.50'];
        const list: string[] = [];
        if (has([salary, wages])) list.push('salary');
        if (has([benefits])) list.push('replacement_income');
        if (who === 'A' && !couple) {
          if (pension) list.push('pension');
          if (alimony) list.push('alimony');
          if (selfEmployed) list.push('self_employment');
        }
        return list;
      };
      out.push({
        key: 'profile.income_sources',
        person: 'p1',
        value: sources('A'),
        page: incomePage,
      });
      if (couple) {
        out.push({
          key: 'profile.income_sources',
          person: 'p2',
          value: sources('B'),
          page: incomePage,
        });
      }
    }
  }

  // Employers (one salary line each in annex A), 3a and pension fund buy-ins, per taxpayer.
  for (const [who, person, form, wages, pillar3a, buyin] of [
    ['A', 'p1', 'A1', '11.10', '31.40', '31.30'],
    ['B', 'p2', 'A2', '21.10', '41.40', '41.30'],
  ] as const) {
    if (who === 'B' && !couple) continue;
    const annex = d.items.filter((i) => i.form === form);
    if (!annex.length) continue;
    const employers = lines([wages], (i) => i.form === form).length;
    if (employers > 0) {
      out.push({
        key: 'profile.employers',
        person,
        value: Math.min(employers, 9),
        page: firstPage([wages], annex[0]!.page),
      });
    }
    out.push({
      key: 'profile.pillar3a',
      person,
      value: has([pillar3a], (i) => i.form === form),
      page: firstPage([pillar3a], annex[0]!.page),
    });
    out.push({
      key: 'profile.lpp_buyin',
      person,
      value: has([buyin], (i) => i.form === form),
      page: firstPage([buyin], annex[0]!.page),
    });
  }

  // Costs paid, from the deductions page.
  const deductionsPage = pageOf('PG3');
  if (deductionsPage) {
    const paid: string[] = [];
    if (has(['71.00'])) paid.push('medical_costs');
    if (has(['73.00', '73.10', '73.20', '74.00'])) paid.push('donations');
    if (has(['55.00'], (i) => i.form === 'PG3')) paid.push('loan_interest');
    if (has(['53.00', '53.10'])) paid.push('alimony_paid');
    out.push({ key: 'profile.payments', person: 'household', value: paid, page: deductionsPage });
  }

  // Real estate is not supported yet: better to know now.
  const realEstate = lines(['15.00']);
  if (realEstate.length || d.forms.some((f) => /^D/.test(f.form))) {
    out.push({
      key: 'profile.special',
      person: 'household',
      value: ['real_estate'],
      page: realEstate[0]?.page ?? pageOf('PG2') ?? identity,
    });
  }
  return out;
}
