// "Your securities and accounts": the securities list (état des titres) and the other movable
// wealth, as the rules compute them (@taxpresso/rules-ge, etat-des-titres.ts), for the dashboard,
// for Claude, and for the tax engine. Also what the user says about them: the official value of a
// security, whose a line is, and accounts or assets without a document. Nothing here computes a
// tax amount; nothing here fetches anything (the official price list is looked up by the user).
import {
  formatMoneyPlain,
  invalidValue,
  parseMoney,
  type FactValue,
  type Owner,
} from '@taxpresso/ledger';
import type { Lang } from '@taxpresso/questionnaire';
import {
  CIVILITE,
  etatDesTitres,
  KEYS_WEALTH_2026,
  OFFICIAL_VALUE_HELP,
  OWNERS,
  RUBRICS_2026,
  SECTIONS_2026,
  WEALTH_KINDS,
  type EtatDesTitres,
  type LineOwner,
  type Section,
  type WealthItem,
  type WealthKind,
} from '@taxpresso/rules-ge';
import { WorkspaceError, type Via, type Workspace } from './workspace.js';

/** The état des titres for the workspace's tax year, from the values that count. */
export function holdings(ws: Workspace): EtatDesTitres {
  return etatDesTitres({
    taxYear: ws.engine.taxYear,
    people: ws.snapshot().people,
    facts: ws.countedFacts(),
    documents: ws.activeDocuments(),
  });
}

/** The amounts the tax engine takes, by official rubric code and person. */
export function wealthItems(ws: Workspace): WealthItem[] {
  return holdings(ws).items;
}

const OWNER_TEXT = {
  joint: { en: 'Both of you', fr: 'Vous deux' },
  children: { en: 'Your children', fr: 'Vos enfants' },
} as const;

const KIND_TEXT: Record<WealthKind, { en: string; fr: string }> = {
  bank_account: { en: 'Bank or postal account', fr: 'Compte bancaire ou postal' },
  crypto: { en: 'Crypto', fr: 'Crypto-monnaies' },
  loan_given: { en: 'Loan you gave', fr: 'Prêt accordé (créance)' },
  life_insurance: { en: 'Life insurance (pillar 3b)', fr: 'Assurance-vie (3e pilier B)' },
  valuables: {
    en: 'Cash, precious metals, vehicles, boats',
    fr: 'Numéraires, métaux précieux, autos, bateaux',
  },
  debt: { en: 'Private debt', fr: 'Dette chirographaire' },
};

function ownerLabel(ws: Workspace, owner: LineOwner | undefined, lang: Lang): string | undefined {
  if (!owner) return undefined;
  if (owner === 'p1' || owner === 'p2') return ws.engine.file.people[owner][lang];
  return OWNER_TEXT[owner][lang];
}

/** The dashboard's card, in the page's language. Undefined when there is nothing to show. */
export function holdingsView(ws: Workspace, lang: Lang) {
  const etat = holdings(ws);
  const couple = ws.snapshot().people.length > 1;
  const facts = ws.countedFacts();
  const fact = (key: string, instance: string) =>
    facts.find((f) => f.key === key && f.instance === instance && f.person === 'household');
  const issuesFor = (id: string) =>
    etat.issues
      .filter((i) => i.lineId === id)
      .map((i) => ({ severity: i.severity, text: i.text[lang] }));

  const lines = etat.lines.map((l) => {
    const official =
      l.section === 'securities' ? fact('securities.value_official_chf', l.id) : undefined;
    const broker = l.section === 'securities' ? fact('securities.value_chf', l.id) : undefined;
    const kind = l.origin === 'you' ? (fact('wealth.kind', l.id)?.value as WealthKind) : undefined;
    return {
      ...l,
      ...(l.owner
        ? { ownerLabel: ownerLabel(ws, l.owner, lang), civilite: CIVILITE[l.owner] }
        : {}),
      ...(kind ? { kindLabel: KIND_TEXT[kind][lang] } : {}),
      // A security held at the year end, read from a broker export: its official value can be entered.
      canEnterOfficial:
        l.origin === 'broker_export' && l.quantity !== undefined && !/^0+(\.0+)?$/.test(l.quantity),
      ...(typeof broker?.value === 'number' ? { brokerChf: broker.value } : {}),
      ...(official && typeof official.value === 'number'
        ? {
            official: {
              centimes: official.value,
              ...(official.note ? { from: official.note } : {}),
              status: official.status,
              ...(official.source.via ? { via: official.source.via } : {}),
            },
          }
        : {}),
      ...(l.foreign?.caveat ? { foreignCaveat: l.foreign.caveat[lang] } : {}),
      issues: issuesFor(l.id),
    };
  });
  const other = etat.other.map((o) => ({
    ...o,
    label: (o.rubric === 'valuables'
      ? RUBRICS_2026.valuables
      : o.rubric === 'lifeInsurance'
        ? RUBRICS_2026.lifeInsuranceValue
        : RUBRICS_2026.debts)[lang],
    code: RUBRICS_2026[o.rubric === 'lifeInsurance' ? 'lifeInsuranceValue' : o.rubric].code,
    ...(o.rubric !== 'valuables'
      ? {
          flowLabel: (o.rubric === 'lifeInsurance'
            ? RUBRICS_2026.lifeInsurancePremiums
            : RUBRICS_2026.debtInterest)[lang],
          flowCode: (o.rubric === 'lifeInsurance'
            ? RUBRICS_2026.lifeInsurancePremiums
            : RUBRICS_2026.debtInterest
          ).code,
        }
      : {}),
    ...(o.owner ? { ownerLabel: ownerLabel(ws, o.owner, lang) } : {}),
    issues: issuesFor(o.id),
  }));
  // Broker exports whose values still wait for the user's OK: one tap confirms each.
  const exports = ws
    .activeDocuments()
    .filter((d) => d.kind === 'broker_export')
    .map((d) => ({
      docId: d.id,
      filename: d.filename,
      ...(d.issuer ? { issuer: d.issuer } : {}),
      toConfirm: facts.filter(
        (f) =>
          f.source.docId === d.id && f.status === 'extracted' && f.key.startsWith('securities.'),
      ).length,
    }));
  if (!lines.length && !other.length && !exports.length) return undefined;
  const sections = (Object.keys(SECTIONS_2026) as Section[]).map((id) => ({
    id,
    form: SECTIONS_2026[id].form,
    official: SECTIONS_2026[id].fr,
    label: SECTIONS_2026[id][lang],
    subtotal: etat.subtotals[id],
    lines: lines.filter((l) => l.section === id),
  }));
  return {
    taxYear: etat.taxYear,
    couple,
    sections,
    totals: etat.totals,
    income: etat.totals.subjectIa + etat.totals.notSubjectIa,
    ia: etat.ia,
    ies: etat.ies,
    other,
    exports,
    general: etat.issues
      .filter((i) => !i.lineId)
      .map((i) => ({ severity: i.severity, text: i.text[lang] })),
    missing: etat.issues.filter((i) => i.severity === 'missing').length,
    complete: etat.complete,
    estimate: etat.estimate,
    officialHelp: OFFICIAL_VALUE_HELP.text[lang],
    owners: (couple ? OWNERS : (['p1'] as const)).map((o) => ({
      value: o,
      label: ownerLabel(ws, o, lang)!,
    })),
    rubrics: {
      income: RUBRICS_2026.income.code,
      wealth: RUBRICS_2026.wealth.code,
      fees: RUBRICS_2026.fees.code,
      savings: RUBRICS_2026.savings.code,
    },
  };
}

export type HoldingsView = NonNullable<ReturnType<typeof holdingsView>>;

/** CHF 1’234.50, from centimes, without floating point. */
export const chf = (centimes: number) => {
  const plain = formatMoneyPlain(centimes);
  const [whole = '0', cents = '00'] = plain.replace('-', '').split('.');
  return `${centimes < 0 ? '-' : ''}CHF ${whole.replace(/\B(?=(\d{3})+(?!\d))/g, '’')}.${cents}`;
};

/** One short paragraph for get_status and list_documents, in English for Claude (C6). */
export function holdingsStatusText(etat: EtatDesTitres): string | undefined {
  if (!etat.lines.length && !etat.other.length) return undefined;
  const count = (s: Section) => etat.lines.filter((l) => l.section === s).length;
  const parts = [
    `${count('accounts')} account line(s), ${count('securities')} securities, ${count('statements')} tax statement(s)`,
    `taxable value ${chf(etat.totals.taxableValue)} (rubric ${RUBRICS_2026.wealth.code} fortune)`,
    `gross income ${chf(etat.totals.subjectIa + etat.totals.notSubjectIa)} (rubric ${RUBRICS_2026.income.code} revenu)`,
    `Swiss withholding tax claimed back ${chf(etat.ia.claim)}${etat.ia.complete ? '' : ' so far'}`,
  ];
  if (etat.ies.claimable)
    parts.push(`foreign tax credit requested ${chf(etat.ies.requested)} (form DA-1)`);
  else if (etat.ies.claimable === undefined) parts.push('foreign tax credit not computed yet');
  if (etat.ies.recoverableAbroad) {
    parts.push(`${chf(etat.ies.recoverableAbroad)} of foreign tax can only be reclaimed abroad`);
  }
  const missing = etat.issues.filter((i) => i.severity === 'missing').length;
  if (missing) parts.push(`${missing} amount(s) missing: the totals are a floor`);
  if (etat.lines.some((l) => l.valueBasis === 'broker')) {
    parts.push(
      "some values are the broker's estimates until the user enters the official ESTV value",
    );
  }
  return `État des titres: ${parts.join('; ')}. Details and what to complete: the dashboard ("Your securities and accounts").`;
}

/** What the user can set for a line through set_holding or the dashboard. */
export interface HoldingInput {
  /** A security from a broker export (its ISIN, the ledger instance). */
  security?: string;
  /** The official taxable value for the whole holding, as text ("1'234.50"). */
  officialValue?: string;
  /** Where the official value comes from, e.g. "ESTV price list 2026, CHF 61.70 x 20". */
  from?: string;
  /** Gross income of the year in CHF, as text, when the broker export doesn't give it. */
  income?: string;
  owner?: LineOwner;
  /** Something without a document: its id (letters, digits, dashes) and what it is. */
  item?: string;
  kind?: WealthKind;
  name?: string;
  value?: string;
  withholdingSwiss?: string;
  fees?: string;
  premiums?: string;
  interestPaid?: string;
  abroad?: boolean;
  /** The user gave a rough figure: saved as an estimate, to be settled before filing. */
  estimate?: boolean;
}

const money = (field: string, raw: string): number => {
  const parsed = parseMoney(raw);
  if (!parsed.ok) throw new WorkspaceError(`${field}: ${parsed.reason}.`);
  if (parsed.value < 0) throw new WorkspaceError(`${field}: give an amount of zero or more.`);
  return parsed.value;
};

const ITEM_ID = /^[a-z0-9][a-z0-9-]{0,47}$/;

/**
 * Saves what the user said about a line: checks everything first, then appends only what changed
 * (append-only ledger). Values are "Confirmed by you", or "Estimate" when the user says so.
 */
export async function saveHolding(ws: Workspace, input: HoldingInput, via: Via): Promise<number> {
  await ws.ready();
  const people = ws.snapshot().people;
  const status = input.estimate ? 'estimate' : 'stated';
  const out: { key: string; instance: string; value: FactValue; note?: string }[] = [];
  const checkOwner = (owner: LineOwner) => {
    if (!(OWNERS as readonly string[]).includes(owner)) throw new WorkspaceError('Unknown owner.');
    if (people.length < 2 && owner !== 'p1' && owner !== 'children') {
      throw new WorkspaceError('This household has one person: the owner is p1 (or children).');
    }
  };

  if (input.security !== undefined) {
    if (input.item !== undefined || input.kind !== undefined) {
      throw new WorkspaceError('Give either a security or an item, not both.');
    }
    const id = input.security.trim();
    if (!ws.ledger.get('securities.name', 'household', id)) {
      throw new WorkspaceError(
        `No security ${id} in the list. Use the ISIN shown in the dashboard or by get_status.`,
      );
    }
    if (input.officialValue !== undefined) {
      const from = input.from?.trim();
      if (!from) {
        throw new WorkspaceError(
          'Say where the official value comes from (from), e.g. "ESTV price list 2026, CHF 61.70 x 20".',
        );
      }
      out.push({
        key: 'securities.value_official_chf',
        instance: id,
        value: money('officialValue', input.officialValue),
        note: from.slice(0, 200),
      });
    }
    if (input.income !== undefined) {
      out.push({
        key: 'securities.income_gross_chf',
        instance: id,
        value: money('income', input.income),
      });
    }
    if (input.owner !== undefined) {
      checkOwner(input.owner);
      out.push({ key: 'securities.owner', instance: id, value: input.owner });
    }
  } else if (input.item !== undefined) {
    const id = input.item.trim();
    if (!ITEM_ID.test(id)) {
      throw new WorkspaceError(
        'item: a short id in lower case, letters, digits and dashes (e.g. "ubs-savings").',
      );
    }
    const existing = ws.ledger.get('wealth.kind', 'household', id)?.value as WealthKind | undefined;
    const kind = input.kind ?? existing;
    if (!kind || !(WEALTH_KINDS as readonly string[]).includes(kind)) {
      throw new WorkspaceError(`kind: one of ${WEALTH_KINDS.join(', ')}.`);
    }
    if (existing && input.kind && input.kind !== existing) {
      throw new WorkspaceError(`${id} is a ${existing}. Use another id for a ${input.kind}.`);
    }
    const add = (key: keyof typeof KEYS_WEALTH_2026, value: FactValue | undefined) => {
      if (value !== undefined) out.push({ key, instance: id, value });
    };
    if (!existing) {
      if (!input.name?.trim())
        throw new WorkspaceError('name: say what it is (bank, insurer, creditor, nature).');
      if (input.value === undefined)
        throw new WorkspaceError('value: the value on 31 December, in CHF.');
    }
    add('wealth.kind', kind);
    add('wealth.name', input.name?.trim().slice(0, 120));
    if (input.owner !== undefined) checkOwner(input.owner);
    add(
      'wealth.owner',
      input.owner ?? (existing ? undefined : people.length < 2 ? 'p1' : undefined),
    );
    add('wealth.value_chf', input.value !== undefined ? money('value', input.value) : undefined);
    add(
      'wealth.income_chf',
      input.income !== undefined ? money('income', input.income) : undefined,
    );
    add(
      'wealth.withholding_swiss_chf',
      input.withholdingSwiss !== undefined
        ? money('withholdingSwiss', input.withholdingSwiss)
        : undefined,
    );
    add('wealth.fees_chf', input.fees !== undefined ? money('fees', input.fees) : undefined);
    add(
      'wealth.premiums_chf',
      input.premiums !== undefined ? money('premiums', input.premiums) : undefined,
    );
    add(
      'wealth.interest_paid_chf',
      input.interestPaid !== undefined ? money('interestPaid', input.interestPaid) : undefined,
    );
    add('wealth.abroad', input.abroad);
  } else {
    throw new WorkspaceError('Give a security (its ISIN) or an item id.');
  }
  if (!out.length) throw new WorkspaceError('Nothing to save: give at least one value.');
  for (const f of out) {
    const def = ws.keys[f.key];
    const problem = def ? invalidValue(def, f.value) : `unknown key ${f.key}`;
    if (problem) throw new WorkspaceError(`${f.key}: ${problem}.`);
  }
  const changed = out.filter((f) => {
    const current = ws.ledger.get(f.key, 'household', f.instance);
    // Names, kinds and owners are facts the user states; only money can be an estimate.
    const wanted = typeof f.value === 'number' ? status : 'stated';
    return !(
      current &&
      current.value === f.value &&
      current.status === wanted &&
      (current.note ?? '') === (f.note ?? '')
    );
  });
  await ws.saveHolding(
    changed.map((f) => ({ ...f, status: typeof f.value === 'number' ? status : 'stated' })),
    via,
  );
  return changed.length;
}

/** The owner as a document's person, for lines read from documents (bank, statement, crypto). */
export function documentPerson(owner: LineOwner): Owner | undefined {
  return owner === 'p1' || owner === 'p2' ? owner : owner === 'joint' ? 'household' : undefined;
}
