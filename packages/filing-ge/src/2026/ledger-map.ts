// Until the tax engine lands, the copy panel is fed from the ledger: values read from documents and
// answers, each routed to the rubric of the declaration where the official form asks for it. Only
// values the user typed in a document box or answered go through here, as they are: no limit, no
// flat deduction, no total is computed (those are the engine's, SPEC.md section 7). When the engine
// returns items for a rubric, they take its place (mergeItems).
//
// Where each value goes comes from the form itself (ge-2025-declaration-specimen, which names the
// salary certificate box of each rubric: "Revenu code 1 du CS", "code 9 du CS"...) and the guide
// (ge-2025-guide-declaration-pp). Note: rubric 11.10 takes box 1 (salary), not box 8 (total gross
// salary): boxes 2 to 7 have rubrics of their own, and box 8 is their sum (A1, p. 5).
import type { Fact, FactStatus, Owner, VaultDocument } from '@taxpresso/ledger';
import type { CommuneSlug, Key2026 } from '@taxpresso/rules-ge';
import { COMMUNE_CODES_2025 } from '../2025/commune-codes.js';
import { weakestStatus, type FormColumn, type FormItem } from '../form.js';

const SPEC = 'ge-2025-declaration-specimen';
const GUIDE = 'ge-2025-guide-declaration-pp';
const INDEP = 'ge-2025-guide-independants';

export interface LedgerRoute {
  /** The ledger key (packages/rules-ge/src/2026/keys.ts). */
  key: Key2026;
  /** The rubric: one for each taxpayer (values that are per person), or one for the household. */
  to: string | { A: string; B: string };
  /** The column, when the rubric has several and the value fills one of them. */
  column?: FormColumn;
  /** One line per document on a repeating rubric (11.10-1, 11.10-2), with the issuer in this field. */
  line?: { issuerField?: string };
  /** Only when another value read from the same document says so. */
  when?: { key: Key2026; is: string | boolean; not?: boolean };
  /** The value is the commune's code (Code lieu), not the answer itself. */
  communeCode?: boolean;
  /**
   * The household's day of arrival from abroad (the same for a couple, or not supported): taken
   * from taxpayer A's answer, only while the answers say the household arrived from abroad.
   */
  arrivalDay?: boolean;
  /**
   * A per-person value the form asks as one amount for the household, the spouses' added up (98.12
   * has a single "Montant" box): no part per taxpayer.
   */
  together?: boolean;
  /** Where the form asks for it: manifest id and page. */
  source: string;
}

const perPerson = (a: string, b: string) => ({ A: a, B: b });
const cs = (box: string) => `${SPEC} p. 5 and 6 ("code ${box} du CS")`;

/** Every ledger value that has a place on the declaration, in the form's order. */
export const LEDGER_ROUTES_2026: readonly LedgerRoute[] = [
  {
    key: 'profile.commune',
    to: 'PG1-COMMUNE',
    communeCode: true,
    source: `${SPEC} p. 1; ${GUIDE} p. 12 and 59`,
  },
  {
    key: 'profile.arrival_date',
    to: 'PG1-ARRIVEE',
    arrivalDay: true,
    together: true,
    source: `${SPEC} p. 1; ${GUIDE} p. 53`,
  },
  // Annexe A: salary certificate boxes, as the form names them.
  {
    key: 'salary.base',
    to: perPerson('11.10', '21.10'),
    line: { issuerField: 'employer' },
    source: `${cs('1')}; ${GUIDE} p. 17`,
  },
  { key: 'salary.board_lodging', to: perPerson('11.12', '21.12'), source: cs('2') },
  { key: 'salary.company_car', to: perPerson('11.12', '21.12'), source: cs('2') },
  { key: 'salary.other_fringe', to: perPerson('11.12', '21.12'), source: cs('2') },
  { key: 'salary.non_periodic', to: perPerson('11.15', '21.15'), source: cs('3') },
  { key: 'salary.board_fees', to: perPerson('11.30', '21.30'), source: cs('6') },
  { key: 'salary.participations', to: perPerson('11.40', '21.40'), source: cs('5') },
  {
    // Benefits paid to you directly. Paid through your employer, they are already in box 7.
    key: 'replacement.amount',
    to: perPerson('11.50', '21.50'),
    when: { key: 'replacement.paid_to_employer', is: true, not: true },
    source: `${SPEC} p. 5 and 6; ${GUIDE} p. 17; std-lohnausweis-wegleitung-2026-fr p. 13 (Cm 34, 35)`,
  },
  { key: 'salary.other_benefits', to: perPerson('11.60', '21.60'), source: cs('7') },
  { key: 'salary.capital', to: perPerson('11.70', '21.70'), source: cs('4') },
  { key: 'salary.allowance_representation', to: perPerson('11.90', '21.90'), source: cs('13.2.1') },
  { key: 'salary.allowance_car', to: perPerson('11.91', '21.91'), source: cs('13.2.2') },
  { key: 'salary.allowance_other', to: perPerson('11.92', '21.92'), source: cs('13.2.3') },
  { key: 'salary.canteen', to: perPerson('CS-G', 'CS-G'), source: `${cs('G')}; ${GUIDE} p. 18` },
  {
    key: 'salary.free_transport',
    to: perPerson('CS-F', 'CS-F'),
    source: `${cs('F')}; ${GUIDE} p. 18`,
  },
  { key: 'salary.social_contributions', to: perPerson('31.10', '41.10'), source: cs('9') },
  { key: 'salary.lpp_ordinary', to: perPerson('31.12', '41.12'), source: cs('10.1') },
  { key: 'salary.lpp_buyin', to: perPerson('31.30', '41.30'), source: cs('10.2') },
  {
    key: 'lpp.buyin',
    to: perPerson('31.30', '41.30'),
    source: `${SPEC} p. 5 and 6; ${GUIDE} p. 18`,
  },
  {
    key: 'pillar3a.paid',
    to: perPerson('31.40', '41.40'),
    source: `${SPEC} p. 5 and 6; ${GUIDE} p. 18`,
  },
  // Annexe B: the lines of the business's accounts and the owner's AVS contributions, as the form
  // names them; the same codes for taxpayers A and B, one sheet each (B2 p. 8, B4 p. 10).
  ...(
    [
      ['business.turnover', '12.08', 12],
      ['business.benefits', '12.09', 12],
      ['business.financial_income', '12.15', 12],
      ['business.other_income', '12.16', 13],
      ['business.costs_goods', '12.21', 13],
      ['business.costs_staff', '12.22', 13],
      ['business.depreciation', '12.23', 14],
      ['business.provisions', '12.24', 14],
      ['business.interest', '12.41', 14],
      ['business.costs_other', '12.42', 15],
      ['business.current_assets', '12.48', 17],
      ['business.fixed_assets', '12.49', 17],
      ['business.liabilities', '57.50', 17],
      ['avs.contributions_year', '32.10', 22],
      ['avs.contributions_earlier', '32.11', 22],
    ] as const
  ).map(([key, code, page]): LedgerRoute => ({
    key,
    to: perPerson(code, code),
    source: `${SPEC} p. ${code.startsWith('32') ? 10 : 8}; ${INDEP} p. ${page}`,
  })),
  // Annexe C1: pensions, by their kind.
  {
    key: 'pension.amount',
    to: '17.10',
    when: { key: 'pension.type', is: 'avs_ai' },
    source: `${SPEC} p. 11; ${GUIDE} p. 25`,
  },
  {
    key: 'pension.amount',
    to: '13.20',
    when: { key: 'pension.type', is: 'occupational' },
    source: `${SPEC} p. 11; ${GUIDE} p. 26`,
  },
  {
    key: 'pension.amount',
    to: '13.40',
    when: { key: 'pension.type', is: 'other' },
    source: `${SPEC} p. 11; ${GUIDE} p. 26`,
  },
  // PG2, information the form asks for (renseignements): the lump sums from the 2nd pillar and
  // pillar 3a, both spouses' in one amount, taxed apart (the engine's items take over when it
  // computes them: ENGINE_RUBRICS_2026.info).
  {
    key: 'capital.amount',
    to: '98.12',
    together: true,
    source: `${SPEC} p. 2; ${GUIDE} p. 13`,
  },
  // Annexes C2, C3, C4 and the summary page PG3.
  { key: 'health.subsidy', to: '16.30', source: `${SPEC} p. 12; ${GUIDE} p. 27` },
  { key: 'health.premiums', to: '52.21', source: `${SPEC} p. 13; ${GUIDE} p. 27 and 29` },
  { key: 'childcare.costs', to: '59.10', source: `${SPEC} p. 14; ${GUIDE} p. 30` },
  { key: 'childcare.costs', to: '59.12', source: `${SPEC} p. 14; ${GUIDE} p. 30` },
  { key: 'medical.costs', to: '71.00', source: `${SPEC} p. 3; ${GUIDE} p. 14` },
  { key: 'donation.amount', to: '73.00', source: `${SPEC} p. 3; ${GUIDE} p. 15` },
  // Annexe E1: a private loan is a debt "chirographaire", one line per creditor.
  {
    key: 'debt.interest',
    to: '55.10',
    column: 'icc_ifd',
    line: { issuerField: 'creditor' },
    source: `${SPEC} p. 19; ${GUIDE} p. 37`,
  },
  {
    key: 'debt.balance',
    to: '55.10',
    column: 'wealth',
    line: { issuerField: 'creditor' },
    source: `${SPEC} p. 19; ${GUIDE} p. 37`,
  },
];

/**
 * Rubrics the tax engine works out (SPEC.md section 7), by the column of the form they fill: the
 * copy panel takes the engine's value for them. Travel and meals come from the answers about the
 * way to work (31.60 meals, ICC and IFD columns; 31.70 travel ICC; 31.71 travel IFD; B's 41.xx),
 * as the specimen prints them (A1 p. 5, A2 p. 6) and the guide explains them (p. 19 to 21). The
 * cantonal 31.60 and 31.70 are there only when the actual costs beat the flat deduction (p. 22).
 */
export const ENGINE_RUBRICS_2026 = {
  icc: [
    '31.50',
    '41.50',
    '31.60',
    '41.60',
    '31.70',
    '41.70',
    '31.95',
    '41.95',
    '32.95',
    '61.25',
    '61.30',
  ],
  ifd: [
    '31.20',
    '41.20',
    '31.60',
    '41.60',
    '31.71',
    '41.71',
    '31.90',
    '41.90',
    '32.90',
    '59.20',
    '61.20',
  ],
  /**
   * The lump sums from the 2nd pillar and pillar 3a the engine counts for the year (98.12, PG2 p. 2;
   * guide p. 13): one paid another year belongs to that year's tax (ch-na-law-lifd art. 38 al. 1bis).
   */
  info: ['98.12'],
  source: `${SPEC} p. 2, 3, 5, 6 and 10; ${GUIDE} p. 13, 15, 16, 19 to 22 and 31; ${INDEP} p. 23 and 24`,
} as const;

const FROM_ENGINE = (rubrics: string) =>
  `An answer, not a value to type: the tax engine turns it into ${rubrics} (${SPEC} p. 5 and 6; ${GUIDE} p. 19 to 22).`;

const ABROAD = (what: string) =>
  `${what} (${SPEC} p. 2 to 4, 15 and 16; ${GUIDE} p. 32 to 35): the engine places the converted francs (annexe D).`;

const ETAT = (page: string, pdfPage: number) =>
  `A line of the securities list (état des titres, ${page}, ${SPEC} p. ${pdfPage}): the dashboard's securities card lists it, and its totals go to F1 and 14.00.`;

/**
 * Values read from documents that are not typed into the declaration, and why. Every other value a
 * document gives has a route above (a test keeps the two lists complete).
 */
export const NOT_ON_THE_FORM_2026: Partial<Record<Key2026, string>> = {
  'salary.gross': `Box 8 is the sum of boxes 1 to 7, which the form asks for one by one (${SPEC} p. 5); the form adds them up in 11.00.`,
  'salary.net': `Box 11 (net salary) has no rubric on the form (${SPEC} p. 5).`,
  'salary.source_tax': `Tax withheld at source is not declared on the form (${SPEC} p. 5); the tax office deducts it (${GUIDE} p. 52).`,
  'salary.expenses_travel': `Refunded actual expenses (box 13.1.1) have no rubric on the form (${SPEC} p. 5).`,
  'salary.expenses_other': `Refunded actual expenses (box 13.1.2) have no rubric on the form (${SPEC} p. 5).`,
  'salary.indemnities_included':
    'A remark used by the checks across documents, not a value to type.',
  'salary.education': `Box 13.3 (further training paid by your employer) has no rubric on the form (${SPEC} p. 5).`,
  'salary.relocation_costs': `Moving costs noted in box 15 have no rubric on the form (${SPEC} p. 5).`,
  'salary.other_fringe_note': `Box 14 describes benefits without an amount; it has no rubric on the form (${SPEC} p. 5).`,
  'salary.remarks': `Box 15 holds remarks, not an amount for the form (${SPEC} p. 5).`,
  'replacement.type': 'Says what kind of benefit it is; the amount is what goes on the form.',
  'replacement.paid_to_employer': 'Says whether the benefit is already in the salary (box 7).',
  'replacement.source_tax': `Tax withheld at source is not declared on the form (${SPEC} p. 5); the tax office deducts it (${GUIDE} p. 52).`,
  'pension.type': 'Says which rubric the pension goes to (17.10, 13.20 or 13.40).',
  'capital.date': `Decides the year the lump sum is taxed (ch-na-law-lifd art. 38 al. 1bis); the form asks for the amount only (98.12, ${SPEC} p. 2).`,
  'capital.reason': `Decides whether Taxpresso can tax the lump sum (leaving Switzerland is taxed at source); the form asks for the amount only (98.12, ${SPEC} p. 2).`,
  'assessment.tax': 'The tax office’s assessment is checked, never typed into the declaration.',
  'assessment.notification_date': 'The tax office’s assessment is checked, never typed.',
  'assessment.taxable_income': 'The tax office’s assessment is checked, never typed.',
  'assessment.taxable_wealth': 'The tax office’s assessment is checked, never typed.',
  'assessment.tax_amount': 'The tax office’s assessment is checked, never typed.',
  'assessment.salary_gross': 'The tax office’s assessment is checked, never typed.',
  'assessment.social_contributions': 'The tax office’s assessment is checked, never typed.',
  'assessment.lpp_contributions': 'The tax office’s assessment is checked, never typed.',
  'assessment.lpp_buyin': 'The tax office’s assessment is checked, never typed.',
  'assessment.pillar3a': 'The tax office’s assessment is checked, never typed.',
  'assessment.replacement_income': 'The tax office’s assessment is checked, never typed.',
  'assessment.pension': 'The tax office’s assessment is checked, never typed.',
  'assessment.health_premiums': 'The tax office’s assessment is checked, never typed.',
  'assessment.medical_costs': 'The tax office’s assessment is checked, never typed.',
  'assessment.childcare': 'The tax office’s assessment is checked, never typed.',
  'assessment.donations': 'The tax office’s assessment is checked, never typed.',
  'assessment.debt_interest': 'The tax office’s assessment is checked, never typed.',
  'check.note': 'A note settling a check, not a value of the declaration.',
  // The way to work and lunches away from home: answers the engine prices (ENGINE_RUBRICS_2026).
  'profile.commute': FROM_ENGINE('travel costs, 31.70 and 31.71 (B: 41.70, 41.71)'),
  'commute.transit_cost': FROM_ENGINE('travel costs, 31.70 and 31.71 (B: 41.70, 41.71)'),
  'commute.transit_usable': FROM_ENGINE('travel costs and meals, 31.60, 31.70 and 31.71'),
  'commute.transit_equivalent': FROM_ENGINE('travel costs, 31.70 and 31.71 (B: 41.70, 41.71)'),
  'commute.distance_km': FROM_ENGINE('travel costs, 31.70 and 31.71 (B: 41.70, 41.71)'),
  'commute.drive_days': FROM_ENGINE('travel costs, 31.70 and 31.71 (B: 41.70, 41.71)'),
  'meals.days': FROM_ENGINE('meals, 31.60 (B: 41.60)'),
  'profile.child_support': `An answer, not a value to type: it decides the family charges 61.25 and 61.20 and the scales (${SPEC} p. 3 and 25; ${GUIDE} p. 15, 45 and 46; ch-na-circulaire-30-epoux-famille p. 24, 32 and 33).`,
  // Accounts, crypto and bank tax statements are lines of the securities list (état des titres),
  // summed by packages/rules-ge (etatDesTitres) into F1 and 14.00, not routed one value at a time.
  'bank.account_number': ETAT('F2', 22),
  'bank.currency': ETAT('F2', 22),
  'bank.balance': ETAT('F2', 22),
  'bank.interest_gross': ETAT('F2', 22),
  'bank.balance_in_currency': ETAT('F2', 22),
  'bank.interest_in_currency': ETAT('F2', 22),
  'bank.withholding_swiss': ETAT('F2', 22),
  'bank.fees': ETAT('F2', 22),
  'bank.abroad': ETAT('F2', 22),
  'crypto.value_chf': ETAT('F2', 22),
  'crypto.income_chf': ETAT('F2', 22),
  'tax_statement.deposit_number': ETAT('F4', 24),
  'tax_statement.income_subject_ia': ETAT('F4', 24),
  'tax_statement.income_not_subject_ia': ETAT('F4', 24),
  'tax_statement.taxable_value': ETAT('F4', 24),
  'tax_statement.withholding_swiss': ETAT('F4', 24),
  'tax_statement.foreign_tax_credit': ETAT('F4', 24),
  'tax_statement.fees': ETAT('F4', 24),
  // Annexe B1: the business's name and year come with the sheet the engine makes for a business
  // (the extension places them on B1, ${SPEC} p. 7), never on their own.
  'business.name': `Goes to B1 with the business's sheet (${SPEC} p. 7): the name of the business.`,
  'business.period_from': `Goes to B1 with the business's sheet (${SPEC} p. 7): the business year.`,
  'business.period_to': `Goes to B1 with the business's sheet (${SPEC} p. 7): the business year.`,
  // A property abroad: its amounts are printed in its currency; Taxpresso converts them and the
  // engine places the francs on annexe D (./annex-d.ts), never one value at a time.
  'abroad.currency': ABROAD(
    'The currency of the amounts: Taxpresso converts them into francs at the official rate',
  ),
  'abroad.tax_value': ABROAD('The value of the property abroad, on D1 or D2 and PG4 15.00'),
  'abroad.purchase_price': ABROAD(
    'The value of the property abroad when the country sets none, on D1 or D2 and PG4 15.00',
  ),
  'abroad.rental_value': ABROAD('The rental value of a home abroad, on D1 15.10 and PG2 15.00'),
  'abroad.land_tax_base': ABROAD(
    'Twice it is the rental value of a home in France, on D1 15.10 and PG2 15.00',
  ),
  'abroad.rents': ABROAD('The rents of a property let abroad, on D2 15.20 and PG2 15.00'),
  'abroad.costs': ABROAD('The upkeep costs of a property let abroad, on D2 and PG3 58.00'),
  // A loan statement in another currency: converted by the securities list's other wealth, then on
  // E1 55.20 (./annex-d.ts).
  'debt.currency': `The currency of a loan abroad: Taxpresso converts its amounts and places them on E1 55.20 (${SPEC} p. 19; ${GUIDE} p. 37).`,
  'debt.balance_in_currency': `A loan abroad, converted at the official rate of 31 December and placed on E1 55.20 (${SPEC} p. 19; ${GUIDE} p. 37).`,
  'debt.interest_in_currency': `A loan abroad's interest, converted at the year's average rate and placed on E1 55.20 (${SPEC} p. 19; ${GUIDE} p. 37).`,
  'life_insurance.surrender_value': `Goes to 16.70 (C3) through the securities list's other wealth (${SPEC} p. 13); the dashboard's securities card shows it until the engine places it.`,
  'life_insurance.premiums': `Goes to 52.11 (C3) through the securities list's other wealth (${SPEC} p. 13); the dashboard's securities card shows it until the engine places it.`,
};

/** A value from the ledger that has no place on the form yet, and why. */
export interface UnplacedValue {
  key: string;
  person: Owner;
  docId?: string;
  reason: 'needs_kind';
}

export interface LedgerInput {
  /** The ledger's current view, only values that count (no replaced documents). */
  facts: readonly Fact[];
  documents: readonly VaultDocument[];
  /** The household's taxpayers: one person files as contribuable A alone. */
  people: readonly ('p1' | 'p2')[];
  taxYear: number;
}

/**
 * The ledger's values as form items. Values of one rubric from several documents add up (two 3a
 * attestations make one 31.40), except on repeating rubrics, one line per document. Each item
 * keeps its weakest status: one value that still needs the user's OK makes the sum need it too.
 */
export function itemsFromLedger(input: LedgerInput): {
  items: FormItem[];
  unplaced: UnplacedValue[];
} {
  const docs = new Map(input.documents.map((d) => [d.id, d]));
  // What was declared for this year: values from a document of another year stay out.
  const facts = input.facts.filter((f) => {
    const year = f.source.docId ? docs.get(f.source.docId)?.taxYear : undefined;
    return year === undefined || year === input.taxYear;
  });
  const single = input.people.length < 2;
  const cells = new Map<
    string,
    FormItem & { statuses: FactStatus[]; factIds: string[]; docIds: Set<string> }
  >();
  const unplaced: UnplacedValue[] = [];

  const arrived = facts.some(
    (f) => f.key === 'profile.moved' && f.person === 'household' && f.value === 'from_abroad',
  );
  for (const fact of facts) {
    const routes = LEDGER_ROUTES_2026.filter((r) => r.key === fact.key);
    if (routes.length === 0) continue;
    if (routes.some((r) => r.arrivalDay) && (!arrived || fact.person === 'p2')) continue;
    const doc = fact.source.docId ? docs.get(fact.source.docId) : undefined;
    let placed = false;
    for (const route of routes) {
      if (route.when) {
        const sibling = facts.find(
          (f) =>
            f.key === route.when!.key && f.instance === fact.instance && f.person === fact.person,
        )?.value;
        const holds = sibling === route.when.is;
        if (route.when.not ? holds : !holds) continue;
      }
      // Whose: the fact's person, or for household values the document's.
      let person: Owner = fact.person;
      if (person === 'household' && doc?.person) person = doc.person;
      if (person === 'household' && single) person = 'p1';
      if (route.arrivalDay) person = 'household';
      let code: string;
      if (typeof route.to === 'string') code = route.to;
      else if (person === 'p1' || person === 'p2') code = person === 'p1' ? route.to.A : route.to.B;
      else continue;

      let value: Pick<FormItem, 'amount' | 'text' | 'tick'>;
      if (route.communeCode) {
        const commune = COMMUNE_CODES_2025[fact.value as CommuneSlug];
        if (!commune) continue;
        value = { text: commune };
      } else if (route.arrivalDay) {
        if (typeof fact.value !== 'string') continue;
        value = { text: fact.value };
      } else if (typeof fact.value === 'number') value = { amount: fact.value };
      else if (fact.value === true) value = { tick: true };
      else continue; // an unticked box: nothing to enter

      const instance = route.line ? fact.instance : undefined;
      const cell = [code, person, route.column ?? '', instance ?? ''].join('|');
      let item = cells.get(cell);
      if (!item) {
        item = {
          code,
          person,
          ...(route.column ? { column: route.column } : {}),
          ...(instance ? { instance } : {}),
          status: fact.status,
          statuses: [],
          factIds: [],
          docIds: new Set(),
        };
        cells.set(cell, item);
      }
      if (value.amount !== undefined) item.amount = (item.amount ?? 0) + value.amount;
      if (value.tick) item.tick = true;
      if (value.text !== undefined) item.text = value.text;
      if (route.line?.issuerField && doc?.issuer) {
        item.fields = { ...item.fields, [route.line.issuerField]: doc.issuer };
      }
      item.statuses.push(fact.status);
      item.factIds.push(fact.id);
      if (doc) item.docIds.add(doc.id);
      placed = true;
    }
    if (!placed && routes.every((r) => r.when && !r.when.not)) {
      unplaced.push({
        key: fact.key,
        person: fact.person,
        ...(fact.source.docId ? { docId: fact.source.docId } : {}),
        reason: 'needs_kind',
      });
    }
  }

  const items = [...cells.values()].map(({ statuses, factIds, docIds, ...item }) => ({
    ...item,
    status: weakestStatus(statuses),
    source: { facts: factIds, ...(docIds.size ? { documents: [...docIds] } : {}) },
  }));
  return { items, unplaced };
}

/**
 * The engine's items, plus the ledger's for rubrics the engine doesn't give (yet). For one rubric
 * and person, the engine's items replace the ledger's entirely.
 */
export function mergeItems(engine: readonly FormItem[], ledger: readonly FormItem[]): FormItem[] {
  const covered = new Set(engine.map((i) => `${i.code}|${i.person}`));
  return [...engine, ...ledger.filter((i) => !covered.has(`${i.code}|${i.person}`))];
}
