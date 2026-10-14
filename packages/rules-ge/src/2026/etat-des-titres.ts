// The securities list (état des titres) and the other movable wealth, as the Geneva form lays them
// out: a pure function from the ledger's current view (and the documents behind it) to the lines
// of the form, their totals, the withholding tax claimed back, and the items the tax engine takes,
// each under its official rubric code. Integer centimes; the form's amounts are whole francs.
//
// The form (ge-2025-declaration-specimen, the 2025 form, the latest published):
//   F2 comptes bancaires et postaux (p. 22), F3 titres suisses et étrangers (p. 23), F4 relevés
//   fiscaux (p. 24); each line: civilité A, B or E (A and B for joint), gross income subject or
//   not subject to IA, taxable value on 31 December, bank fees, interest on savings capital.
//   F1 (p. 21): the subtotals, their totals, and the imputations: IA (35 %), RSI, IES (DA-1).
//   Every amount rounded to the franc, except the imputations (p. 21).
//   Totals go to the récapitulation: 14.00 revenu brut mobilier (PG2, p. 2), 14.00 fortune brute
//   mobilière (PG4, p. 4), 56.20 frais bancaires (PG3, p. 3), 56.30 intérêts échus de capitaux
//   d'épargne (C3, p. 13).
//   Outside the état des titres: 16.40 numéraires, métaux précieux, autos, bateaux (C2, p. 12),
//   16.70 valeur de rachat des assurances-vie and 52.11 primes (C3, p. 13), 55.10 intérêts et
//   dettes chirographaires (E1, p. 19).
// The rules (ge-2025-guide-declaration-pp): what belongs in it, wherever it is held (p. 38); IA
// (p. 39, 40); accounts (p. 40, 41); securities and their taxable value from the ESTV price list
// (p. 41); tax statements (p. 43); crypto with the accounts (p. 40); other wealth (p. 27); life
// insurance (p. 26, 28); debts (p. 37). Withholding rules and exchange rates: packages/rules-ch
// (withholding/).
//
// Not covered, so never guessed: qualified participations (F5, F6, p. 44), business assets (FC),
// the US additional withholding (RSI, form R-US 164, p. 39), lottery winnings (p. 42), bonds and
// bond funds as savings interest (p. 43: they count, but a broker export doesn't say which they
// are), the dates of opening, closing, purchase and sale (p. 40, 41).
import {
  parseMoney,
  type Fact,
  type FactStatus,
  type Owner,
  type VaultDocument,
} from '@taxpresso/ledger';
import {
  IA_DEPOSIT_INTEREST_EXEMPT,
  IES_MINIMUM,
  iaClaim,
  iaOn,
  officialChf,
  residualRate,
  roundFrancExact as roundFranc,
  splitForeignTax,
  type Text,
} from '@taxpresso/rules-ch';
import { OWNERS, type LineOwner, type WealthKind } from '@taxpresso/rules-ch';

const SPECIMEN = 'ge-2025-declaration-specimen';
const GUIDE = 'ge-2025-guide-declaration-pp';

/** Where each amount goes on the official form, with its rubric code. */
export const RUBRICS_2026 = {
  income: {
    code: '14.00',
    fr: 'Revenu brut mobilier',
    en: 'Gross income from movable assets',
    source: `${SPECIMEN} p. 2 (PG2) and p. 21 (F1)`,
  },
  wealth: {
    code: '14.00',
    fr: 'Fortune brute mobilière',
    en: 'Gross movable wealth',
    source: `${SPECIMEN} p. 4 (PG4) and p. 21 (F1)`,
  },
  fees: {
    code: '56.20',
    fr: 'Déductions liées aux revenus mobiliers (frais bancaires)',
    en: 'Bank and custody fees',
    source: `${SPECIMEN} p. 3 (PG3) and p. 21 (F1); ${GUIDE} p. 40, 43`,
  },
  savings: {
    code: '56.30',
    fr: 'Intérêts échus de capitaux d’épargne',
    en: 'Interest on savings capital',
    source: `${SPECIMEN} p. 13 (C3) and p. 21 (F1); ${GUIDE} p. 28, 41`,
  },
  ia: {
    code: 'F1.IA',
    fr: 'Imputations: impôt anticipé',
    en: 'Swiss withholding tax claimed back',
    source: `${SPECIMEN} p. 21 (F1); ${GUIDE} p. 39; ch-na-law-lia art. 13 al. 1 let. a (p. 10)`,
  },
  ies: {
    code: 'F1.IES',
    fr: 'Imputation d’impôts étrangers (IES), formule DA-1',
    en: 'Foreign tax credit (form DA-1)',
    source: `${SPECIMEN} p. 21 (F1); ${GUIDE} p. 39; ch-na-oiis art. 7 (p. 4), art. 8 (p. 5)`,
  },
  valuables: {
    code: '16.40',
    fr: 'Numéraires, métaux précieux, autos, bateaux, etc.',
    en: 'Cash, precious metals, vehicles, boats and other valuables',
    source: `${SPECIMEN} p. 12 (C2); ${GUIDE} p. 27`,
  },
  lifeInsuranceValue: {
    code: '16.70',
    fr: 'Valeur de rachat des assurances-vie',
    en: 'Surrender value of life insurance',
    source: `${SPECIMEN} p. 4 (PG4) and p. 13 (C3); ${GUIDE} p. 26`,
  },
  lifeInsurancePremiums: {
    code: '52.11',
    fr: 'Assurance-vie (primes)',
    en: 'Life insurance premiums',
    source: `${SPECIMEN} p. 13 (C3); ${GUIDE} p. 28`,
  },
  debts: {
    code: '55.10',
    fr: 'Dettes chirographaires',
    en: 'Private debts',
    source: `${SPECIMEN} p. 4 (PG4, 55.00) and p. 19 (E1); ${GUIDE} p. 37`,
  },
  debtInterest: {
    code: '55.10',
    fr: 'Intérêts chirographaires',
    en: 'Interest on private debts',
    source: `${SPECIMEN} p. 3 (PG3, 55.00) and p. 19 (E1); ${GUIDE} p. 37`,
  },
} as const;
export type Rubric = keyof typeof RUBRICS_2026;

export type Section = 'accounts' | 'securities' | 'statements';

/** The three parts of the état des titres, in the form's order. */
export const SECTIONS_2026: Record<
  Section,
  { form: string; fr: string; en: string; source: string }
> = {
  accounts: {
    form: 'F2',
    fr: 'Comptes bancaires et postaux',
    en: 'Bank and postal accounts',
    source: `${SPECIMEN} p. 22; ${GUIDE} p. 40`,
  },
  securities: {
    form: 'F3',
    fr: 'Titres suisses et étrangers',
    en: 'Swiss and foreign securities',
    source: `${SPECIMEN} p. 23; ${GUIDE} p. 41`,
  },
  statements: {
    form: 'F4',
    fr: 'Relevés fiscaux',
    en: 'Bank tax statements',
    source: `${SPECIMEN} p. 24; ${GUIDE} p. 43`,
  },
};

/** Civilité on the form: A (p1), B (p2), A and B (joint), E (children). */
export const CIVILITE: Record<LineOwner, string> = {
  p1: 'A',
  p2: 'B',
  joint: 'A B',
  children: 'E',
};

/** Confirmed (verified, or confirmed by the user), waiting for the user's OK, or an estimate. */
export type ValueState = 'confirmed' | 'needs_ok' | 'estimate';

export interface Columns {
  /** Rendements bruts soumis à l'impôt anticipé. */
  subjectIa: number;
  /** Rendements bruts non soumis à l'impôt anticipé. */
  notSubjectIa: number;
  /** Valeur imposable (solde) au 31 décembre. */
  taxableValue: number;
  /** Frais bancaires. */
  fees: number;
  /** Intérêts échus de capitaux d'épargne. */
  savingsInterest: number;
}

export interface ForeignTax {
  withheld: number;
  country?: string;
  kind?: string;
  rateBp?: number;
  /** Credited through DA-1 when the total is over CHF 100; else deducted from the income. */
  nonRecoverable?: number;
  /** Only the foreign state can give this back. */
  recoverableAbroad?: number;
  source?: string;
  caveat?: Text;
  /** Why it could not be split: the credit is then not computed (fail closed). */
  problem?: 'no_list' | 'no_country' | 'no_kind' | 'kind_unknown' | 'no_income';
}

export interface EtatLine {
  section: Section;
  /** The ledger instance: an ISIN, a document id or the id of an item the user described. */
  id: string;
  origin: 'broker_export' | 'document' | 'you';
  /** The document it comes from, if any. */
  docId?: string;
  name: string;
  /** ISIN, the account number's last 8 positions or the deposit number's last 7. */
  reference?: string;
  owner?: LineOwner;
  quantity?: string;
  currency?: string;
  /** As written on the form: whole francs, in centimes. */
  columns: Columns;
  /** Where the taxable value comes from: the ESTV list, the broker, a document or the user. */
  valueBasis?: 'official' | 'broker' | 'document' | 'you';
  /** The Swiss withholding tax as given (centimes), when known. */
  withholdingSwiss?: number;
  foreign?: ForeignTax;
  /** The least settled of its values. */
  state: ValueState;
  /** False when an amount the form needs is unknown: the totals are then a floor. */
  complete: boolean;
}

export interface OtherLine {
  rubric: 'valuables' | 'lifeInsurance' | 'debts';
  id: string;
  origin: 'document' | 'you';
  docId?: string;
  name: string;
  owner?: LineOwner;
  /** Wealth (16.40, 16.70) or debt (55.10) on 31 December, whole francs in centimes. */
  value?: number;
  /** Premiums paid (52.11) or interest paid (55.10) in the year, whole francs in centimes. */
  flow?: number;
  state: ValueState;
  complete: boolean;
}

export interface EtatIssue {
  code:
    | 'not_read'
    | 'value_missing'
    | 'income_missing'
    | 'ia_missing'
    | 'rate_missing'
    | 'owner_missing'
    | 'swiss_income_without_ia'
    | 'ia_not_35'
    | 'ia_expected'
    | 'foreign_rate_missing'
    | 'foreign_kind_unknown'
    | 'foreign_list_missing';
  /** 'missing': an amount is unknown (fail closed); 'check': something to look at. */
  severity: 'missing' | 'check';
  lineId?: string;
  text: Text;
  source?: string;
}

/** One amount for the tax engine, under the rubric where it goes on the form. */
export interface WealthItem {
  code: string;
  rubric: Rubric;
  part: 'income' | 'deduction' | 'wealth' | 'wealth_deduction' | 'credit';
  /** Joint lines and children's lines are the household's. */
  person: 'p1' | 'p2' | 'household';
  centimes: number;
  taxes: ('icc' | 'ifd')[];
  /** Includes estimates or values waiting for the user's OK. */
  estimate: boolean;
  /** False when some contributing amount is unknown: the amount is then a floor. */
  complete: boolean;
  label: Text;
  source: string;
}

export interface EtatDesTitres {
  taxYear: number;
  /** In the form's order: F2, F3, F4; by name within each. */
  lines: EtatLine[];
  subtotals: Record<Section, Columns>;
  totals: Columns;
  /** Swiss withholding tax claimed back (F1): 35 % of the income subject to it. */
  ia: { subject: number; claim: number; complete: boolean; source: string };
  /** Foreign tax credit (F1, DA-1). */
  ies: {
    /** Non-recoverable foreign tax known so far. */
    nonRecoverable: number;
    recoverableAbroad: number;
    /** Over CHF 100: credited; at most CHF 100: deducted from the income; undefined: not known yet. */
    claimable: boolean | undefined;
    /** What F1 claims (0 unless claimable). */
    requested: number;
    /** Income reduced by the non-recoverable tax because the total was too small. */
    incomeReduction: number;
    complete: boolean;
    source: string;
  };
  other: OtherLine[];
  items: WealthItem[];
  issues: EtatIssue[];
  complete: boolean;
  /** Some value is an estimate or waits for the user's OK. */
  estimate: boolean;
}

export interface EtatInput {
  taxYear: number;
  /** The people of the household: ['p1'] or ['p1', 'p2']. */
  people: readonly string[];
  /** The ledger's current view, without values from documents that no longer count. */
  facts: readonly Fact[];
  /** The documents that count. */
  documents: readonly VaultDocument[];
}

/** How to find a security's official value, without Taxpresso fetching anything. */
export const OFFICIAL_VALUE_HELP = {
  text: {
    en: 'Look it up in the ESTV price list (liste des cours) on ictax.admin.ch: choose the tax year, search by ISIN or Swiss security number, and take the tax value on 31 December for one unit, in CHF. Multiply it by the number you held and enter the result. A security that is not in the list is taxed at its market value: ask your bank or the tax office.',
    fr: 'Cherchez-la dans la liste des cours de l’AFC sur ictax.admin.ch : choisissez l’année fiscale, cherchez par ISIN ou numéro de valeur, et prenez la valeur fiscale au 31 décembre pour une unité, en CHF. Multipliez-la par le nombre que vous déteniez et saisissez le résultat. Un titre absent de la liste est imposé à sa valeur vénale : demandez à votre banque ou à l’administration fiscale.',
  },
  source: `${GUIDE} p. 41; ch-na-listes-des-cours-ictax`,
} as const;

const stateOf = (status: FactStatus | undefined): ValueState =>
  status === 'extracted' ? 'needs_ok' : status === 'estimate' ? 'estimate' : 'confirmed';
const worst = (states: ValueState[]): ValueState =>
  states.includes('needs_ok') ? 'needs_ok' : states.includes('estimate') ? 'estimate' : 'confirmed';
const num = (f: Fact | undefined) => (typeof f?.value === 'number' ? f.value : undefined);
const str = (f: Fact | undefined) =>
  typeof f?.value === 'string' && f.value.trim() ? f.value.trim() : undefined;
const zeroColumns = (): Columns => ({
  subjectIa: 0,
  notSubjectIa: 0,
  taxableValue: 0,
  fees: 0,
  savingsInterest: 0,
});
const addColumns = (a: Columns, b: Columns): Columns => ({
  subjectIa: a.subjectIa + b.subjectIa,
  notSubjectIa: a.notSubjectIa + b.notSubjectIa,
  taxableValue: a.taxableValue + b.taxableValue,
  fees: a.fees + b.fees,
  savingsInterest: a.savingsInterest + b.savingsInterest,
});
/** The last `n` letters and digits, as the form asks for account and deposit numbers. */
const lastPositions = (raw: string | undefined, n: number) => {
  const clean = raw?.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  return clean ? clean.slice(-n) : undefined;
};
const chfText = (centimes: number) => {
  const abs = Math.abs(centimes);
  const francs = String(Math.trunc(abs / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, '’');
  return `CHF ${francs}.${String(abs % 100).padStart(2, '0')}`;
};

/** Whose a line is, from what the user said, else the document's owner. */
export function lineOwner(
  stated: string | undefined,
  docPerson: Owner | undefined,
  people: readonly string[],
): LineOwner | undefined {
  const couple = people.length > 1;
  if (stated && (OWNERS as readonly string[]).includes(stated)) {
    const owner = stated as LineOwner;
    if (!couple && (owner === 'p2' || owner === 'joint')) return 'p1';
    return owner;
  }
  if (docPerson === 'p1') return 'p1';
  if (docPerson === 'p2') return couple ? 'p2' : 'p1';
  if (docPerson === 'household') return couple ? 'joint' : 'p1';
  if (docPerson?.startsWith('child')) return 'children';
  return couple ? undefined : 'p1';
}

/** A line before rounding: amounts in centimes, undefined when unknown. */
interface Raw {
  section: Section;
  id: string;
  origin: EtatLine['origin'];
  docId?: string;
  name: string;
  reference?: string;
  owner?: LineOwner;
  quantity?: string;
  currency?: string;
  subject?: number;
  notSubject?: number;
  value?: number;
  valueBasis?: EtatLine['valueBasis'];
  fees: number;
  savings: number;
  withholdingSwiss?: number;
  foreign?: ForeignTax & { credit?: number; gross?: number };
  states: ValueState[];
  complete: boolean;
  /** Whether income subject to IA may be missing from this line (the IA claimed is then a floor). */
  iaUnknown?: boolean;
}

export function etatDesTitres(input: EtatInput): EtatDesTitres {
  const { taxYear, people, documents } = input;
  const issues: EtatIssue[] = [];
  const issue = (
    code: EtatIssue['code'],
    severity: EtatIssue['severity'],
    text: Text,
    lineId?: string,
    source?: string,
  ) =>
    issues.push({
      code,
      severity,
      text,
      ...(lineId ? { lineId } : {}),
      ...(source ? { source } : {}),
    });

  // Household facts by instance, then key.
  const byInstance = new Map<string, Map<string, Fact>>();
  for (const f of input.facts) {
    if (f.instance === undefined || f.person !== 'household') continue;
    let m = byInstance.get(f.instance);
    if (!m) byInstance.set(f.instance, (m = new Map<string, Fact>()));
    m.set(f.key, f);
  }
  const getter = (instance: string) => (key: string) => byInstance.get(instance)?.get(key);
  const docById = new Map(documents.map((d) => [d.id, d]));
  const raws: Raw[] = [];
  const other: OtherLine[] = [];

  const ownerFor = (lineId: string, name: string, owner: LineOwner | undefined) => {
    if (!owner) {
      issue(
        'owner_missing',
        'check',
        {
          en: `${name}: say whose it is (you, your partner, both, or your children). The form asks for it on every line.`,
          fr: `${name} : dites à qui il appartient (vous, votre conjoint, vous deux ou vos enfants). Le formulaire le demande pour chaque ligne.`,
        },
        lineId,
        `${GUIDE} p. 41`,
      );
    }
    return owner;
  };

  // F3: securities from broker exports, one per ISIN. A bank's e-tax statement lists its
  // securities too, but they are inside its one grouped line (F4, ge-2025-guide-declaration-pp p. 43).
  const fromStatement = (f: Fact) =>
    f.source.docId !== undefined && docById.get(f.source.docId)?.kind === 'ech0196_statement';
  for (const nameFact of input.facts.filter(
    (f) =>
      f.key === 'securities.name' && f.person === 'household' && f.instance && !fromStatement(f),
  )) {
    const id = nameFact.instance!;
    const g = getter(id);
    const quantity = str(g('securities.quantity'));
    const held = quantity !== undefined && !/^0+(\.0+)?$/.test(quantity);
    const income = num(g('securities.income_gross_chf'));
    const swiss = num(g('securities.withholding_swiss_chf'));
    const foreign = num(g('securities.withholding_foreign_chf'));
    if (!held && ![income, swiss, foreign].some((v) => (v ?? 0) !== 0)) continue;
    const name = str(nameFact) ?? id;
    const docId = nameFact.source.docId;
    const official = g('securities.value_official_chf');
    const broker = g('securities.value_chf');
    const valueFact = held ? (official ?? broker) : undefined;
    const states = [
      stateOf(nameFact.status),
      ...[
        'securities.quantity',
        'securities.income_gross_chf',
        'securities.withholding_swiss_chf',
        'securities.withholding_foreign_chf',
      ]
        .map((k) => g(k))
        .filter((f): f is Fact => !!f)
        .map((f) => stateOf(f.status)),
      ...(valueFact ? [official ? stateOf(official.status) : ('estimate' as const)] : []),
    ];
    const raw: Raw = {
      section: 'securities',
      id,
      origin: 'broker_export',
      ...(docId ? { docId } : {}),
      name,
      reference: str(g('securities.isin')) ?? str(g('securities.valor')) ?? id,
      ...(quantity ? { quantity } : {}),
      ...(str(g('securities.currency')) ? { currency: str(g('securities.currency'))! } : {}),
      fees: 0,
      savings: 0,
      states,
      complete: true,
    };
    const owner = ownerFor(
      id,
      name,
      lineOwner(str(g('securities.owner')), docId ? docById.get(docId)?.person : undefined, people),
    );
    if (owner) raw.owner = owner;
    if (held) {
      const value = num(valueFact);
      if (value === undefined) {
        raw.complete = false;
        issue(
          'value_missing',
          'missing',
          {
            en: `${name}: no value in CHF on 31 December. Enter its official value from the ESTV price list.`,
            fr: `${name} : pas de valeur en CHF au 31 décembre. Saisissez sa valeur officielle de la liste des cours de l’AFC.`,
          },
          id,
          OFFICIAL_VALUE_HELP.source,
        );
      } else {
        raw.value = value;
        raw.valueBasis = official ? 'official' : 'broker';
      }
    } else {
      raw.value = 0;
    }
    if (income === undefined) {
      raw.complete = false;
      if ((str(g('securities.country')) ?? 'CH') === 'CH') raw.iaUnknown = true;
      issue(
        'income_missing',
        'missing',
        {
          en: `${name}: no income figures. Add your broker's account statement or activity export (dividends and tax withheld), or confirm there was none.`,
          fr: `${name} : pas de chiffres de rendement. Ajoutez le relevé de compte ou l’export d’activité de votre courtier (dividendes et impôts retenus), ou confirmez qu’il n’y en a pas eu.`,
        },
        id,
        `${GUIDE} p. 41`,
      );
    } else if ((swiss ?? 0) > 0) {
      raw.subject = income;
      if (Math.abs((swiss ?? 0) - iaOn(income)) > 100) {
        issue(
          'ia_not_35',
          'check',
          {
            en: `${name}: the Swiss withholding tax (${chfText(swiss!)}) is not 35 % of the gross income (${chfText(income)}). Check both against your broker's statement.`,
            fr: `${name} : l’impôt anticipé (${chfText(swiss!)}) n’est pas 35 % du rendement brut (${chfText(income)}). Vérifiez les deux sur le relevé de votre courtier.`,
          },
          id,
          'ch-na-law-lia art. 13 al. 1 let. a (p. 10)',
        );
      }
    } else {
      raw.notSubject = income;
      const country = str(g('securities.country'));
      if (swiss === undefined && foreign === undefined && income > 0) {
        // Nothing says what tax was withheld on it (Swiss or foreign): the column is unknown.
        raw.complete = false;
        if ((country ?? 'CH') === 'CH') raw.iaUnknown = true;
        issue(
          'ia_missing',
          'missing',
          {
            en: `${name}: Taxpresso doesn't know what tax was withheld on this income, Swiss (impôt anticipé) or foreign. Check your broker's statement.`,
            fr: `${name} : Taxpresso ne sait pas quel impôt a été retenu sur ce rendement, suisse (impôt anticipé) ou étranger. Vérifiez le relevé de votre courtier.`,
          },
          id,
          `${GUIDE} p. 39, 41`,
        );
      } else if (country === 'CH' && income > 0) {
        issue(
          'swiss_income_without_ia',
          'check',
          {
            en: `${name}: Swiss income without Swiss withholding tax. If it is a repayment of capital (capital contribution reserves), it may not be income at all: check your broker's statement.`,
            fr: `${name} : rendement suisse sans impôt anticipé. S’il s’agit d’un remboursement d’apports de capital, ce n’est peut-être pas un revenu : vérifiez le relevé de votre courtier.`,
          },
          id,
          `${GUIDE} p. 41`,
        );
      }
    }
    if (swiss !== undefined) raw.withholdingSwiss = swiss;
    if ((foreign ?? 0) > 0) {
      const country = str(g('securities.country'));
      const kind = str(g('securities.income_kind'));
      raw.foreign = {
        withheld: foreign!,
        ...(country ? { country } : {}),
        ...(kind ? { kind } : {}),
        ...(income !== undefined ? { gross: income } : {}),
      };
    }
    raws.push(raw);
  }

  // Documents: accounts (F2), tax statements (F4), crypto (F2), life insurance, debts.
  for (const doc of documents) {
    const g = getter(doc.id);
    const name = doc.issuer?.trim() || doc.filename;
    const docOwner = () => lineOwner(undefined, doc.person, people);
    const stateList = (keys: readonly string[]) =>
      keys
        .map((k) => g(k))
        .filter((f): f is Fact => !!f)
        .map((f) => stateOf(f.status));
    const notRead = (section: Section, keys: readonly string[]) => {
      if (stateList(keys).length) return false;
      raws.push({
        section,
        id: doc.id,
        origin: 'document',
        docId: doc.id,
        name,
        ...(docOwner() ? { owner: docOwner()! } : {}),
        fees: 0,
        savings: 0,
        states: ['needs_ok'],
        complete: false,
        iaUnknown: section !== 'securities' && doc.kind !== 'crypto_statement',
      });
      issue(
        'not_read',
        'missing',
        {
          en: `${name}: not read yet. Ask Claude to read it, or enter its figures.`,
          fr: `${name} : pas encore lu. Demandez à Claude de le lire, ou saisissez ses montants.`,
        },
        doc.id,
      );
      return true;
    };

    if (doc.kind === 'bank_attestation') {
      const keys = [
        'bank.account_number',
        'bank.currency',
        'bank.balance',
        'bank.interest_gross',
        'bank.balance_in_currency',
        'bank.interest_in_currency',
        'bank.withholding_swiss',
        'bank.fees',
        'bank.abroad',
      ];
      if (notRead('accounts', keys)) continue;
      const currency = str(g('bank.currency'))?.toUpperCase() ?? 'CHF';
      const raw: Raw = {
        section: 'accounts',
        id: doc.id,
        origin: 'document',
        docId: doc.id,
        name,
        ...(lastPositions(str(g('bank.account_number')), 8)
          ? { reference: lastPositions(str(g('bank.account_number')), 8)! }
          : {}),
        currency,
        fees: 0,
        savings: 0,
        states: stateList(keys),
        complete: true,
      };
      const owner = ownerFor(doc.id, name, docOwner());
      if (owner) raw.owner = owner;
      /** The CHF amount printed, else the amount in the account's currency at the official rate. */
      const convert = (chfKey: string, currencyKey: string, use: 'income' | 'wealth') => {
        const chf = num(g(chfKey));
        if (chf !== undefined) return chf;
        const printed = str(g(currencyKey));
        if (printed === undefined) return undefined;
        const parsed = parseMoney(printed);
        if (!parsed.ok) {
          raw.complete = false;
          issue(
            'value_missing',
            'missing',
            {
              en: `${name}: "${printed}" is not an amount Taxpresso can read. Correct it.`,
              fr: `${name} : « ${printed} » n’est pas un montant lisible. Corrigez-le.`,
            },
            doc.id,
          );
          return undefined;
        }
        const c = officialChf(parsed.value, currency, taxYear, use);
        if (c.ok) return c.centimes;
        raw.complete = false;
        issue(
          'rate_missing',
          'missing',
          {
            en: `${name}: the account is in ${currency}. The official ${use === 'wealth' ? '31 December' : 'average'} rate for ${taxYear} is not in Taxpresso yet (it is published after the year ends), so it is not converted.`,
            fr: `${name} : le compte est en ${currency}. Le taux officiel ${use === 'wealth' ? 'au 31 décembre' : 'moyen'} ${taxYear} n’est pas encore dans Taxpresso (il est publié après la fin de l’année) : pas de conversion.`,
          },
          doc.id,
          `ge-2025-taux-donnees-fiscales; ${GUIDE} p. 40`,
        );
        return undefined;
      };
      const balance = convert('bank.balance', 'bank.balance_in_currency', 'wealth');
      // No interest on the statement: none. Interest in a currency without its rate: unknown.
      const interestGiven =
        num(g('bank.interest_gross')) !== undefined ||
        str(g('bank.interest_in_currency')) !== undefined;
      const interest = interestGiven
        ? convert('bank.interest_gross', 'bank.interest_in_currency', 'income')
        : 0;
      const swiss = num(g('bank.withholding_swiss'));
      const abroad = g('bank.abroad')?.value === true;
      if (balance === undefined) {
        if (raw.complete) {
          raw.complete = false;
          issue(
            'value_missing',
            'missing',
            {
              en: `${name}: no balance on 31 December.`,
              fr: `${name} : pas de solde au 31 décembre.`,
            },
            doc.id,
            `${GUIDE} p. 40`,
          );
        }
      } else raw.value = balance;
      if (interest === undefined) {
        raw.iaUnknown = !abroad;
      } else {
        if ((swiss ?? 0) > 0) raw.subject = interest;
        else raw.notSubject = interest;
        // Every bank interest counts as interest on savings capital (guide p. 41).
        raw.savings = interest;
        if (interest > 0 && !abroad && swiss === undefined) {
          raw.complete = false;
          raw.iaUnknown = true;
          issue(
            'ia_missing',
            'missing',
            {
              en: `${name}: interest without the Swiss withholding tax figure. Give the impôt anticipé from the statement (0 if none was deducted).`,
              fr: `${name} : intérêts sans le montant de l’impôt anticipé. Indiquez l’impôt anticipé du relevé (0 s’il n’y en a pas eu).`,
            },
            doc.id,
            `${GUIDE} p. 40`,
          );
        } else if (!abroad && swiss === 0 && interest > IA_DEPOSIT_INTEREST_EXEMPT.value) {
          issue(
            'ia_expected',
            'check',
            {
              en: `${name}: interest over CHF 200 on a Swiss account normally bears withholding tax. Check the statement.`,
              fr: `${name} : des intérêts de plus de CHF 200 sur un compte suisse supportent en principe l’impôt anticipé. Vérifiez le relevé.`,
            },
            doc.id,
            IA_DEPOSIT_INTEREST_EXEMPT.source,
          );
        }
      }
      if (swiss !== undefined) raw.withholdingSwiss = swiss;
      raw.fees = num(g('bank.fees')) ?? 0;
      raw.valueBasis = 'document';
      raws.push(raw);
    } else if (doc.kind === 'ech0196_statement') {
      const keys = [
        'tax_statement.deposit_number',
        'tax_statement.income_subject_ia',
        'tax_statement.income_not_subject_ia',
        'tax_statement.taxable_value',
        'tax_statement.withholding_swiss',
        'tax_statement.foreign_tax_credit',
        'tax_statement.fees',
      ];
      if (notRead('statements', keys)) continue;
      const subject = num(g('tax_statement.income_subject_ia')) ?? 0;
      const value = num(g('tax_statement.taxable_value'));
      const swiss = num(g('tax_statement.withholding_swiss'));
      const credit = num(g('tax_statement.foreign_tax_credit'));
      const raw: Raw = {
        section: 'statements',
        id: doc.id,
        origin: 'document',
        docId: doc.id,
        name,
        ...(lastPositions(str(g('tax_statement.deposit_number')), 7)
          ? { reference: lastPositions(str(g('tax_statement.deposit_number')), 7)! }
          : {}),
        subject,
        notSubject: num(g('tax_statement.income_not_subject_ia')) ?? 0,
        fees: num(g('tax_statement.fees')) ?? 0,
        savings: 0,
        states: stateList(keys),
        complete: true,
        valueBasis: 'document',
      };
      const owner = ownerFor(doc.id, name, docOwner());
      if (owner) raw.owner = owner;
      if (value === undefined) {
        raw.complete = false;
        issue(
          'value_missing',
          'missing',
          {
            en: `${name}: no taxable value on 31 December.`,
            fr: `${name} : pas de valeur imposable au 31 décembre.`,
          },
          doc.id,
          `${GUIDE} p. 43`,
        );
      } else raw.value = value;
      if (swiss !== undefined) {
        raw.withholdingSwiss = swiss;
        if (Math.abs(swiss - iaOn(subject)) > 100) {
          issue(
            'ia_not_35',
            'check',
            {
              en: `${name}: the Swiss withholding tax (${chfText(swiss)}) is not 35 % of the income subject to it (${chfText(subject)}). Check the statement.`,
              fr: `${name} : l’impôt anticipé (${chfText(swiss)}) n’est pas 35 % des rendements qui y sont soumis (${chfText(subject)}). Vérifiez le relevé.`,
            },
            doc.id,
            'ch-na-law-lia art. 13 al. 1 let. a (p. 10)',
          );
        }
      }
      if ((credit ?? 0) > 0) raw.foreign = { withheld: credit!, credit: credit! };
      raws.push(raw);
      // Loans and mortgages the statement lists are debts (E1, 55.10), one line each.
      for (const loan of input.facts.filter(
        (f) =>
          f.key === 'liabilities.balance_chf' &&
          f.person === 'household' &&
          f.instance &&
          f.source.docId === doc.id,
      )) {
        const l = getter(loan.instance!);
        const balance = num(loan);
        const interest = num(l('liabilities.interest_chf'));
        const states = ['liabilities.balance_chf', 'liabilities.interest_chf']
          .map((k) => l(k))
          .filter((f): f is Fact => !!f)
          .map((f) => stateOf(f.status));
        other.push({
          rubric: 'debts',
          id: loan.instance!,
          origin: 'document',
          docId: doc.id,
          name: str(l('liabilities.name')) ?? name,
          ...(owner ? { owner } : {}),
          ...(balance !== undefined ? { value: roundFranc(balance) } : {}),
          ...(interest !== undefined ? { flow: roundFranc(interest) } : {}),
          state: worst(states),
          complete: balance !== undefined,
        });
      }
    } else if (doc.kind === 'crypto_statement') {
      const keys = ['crypto.value_chf', 'crypto.income_chf'];
      if (notRead('accounts', keys)) continue;
      const value = num(g('crypto.value_chf'));
      const raw: Raw = {
        section: 'accounts',
        id: doc.id,
        origin: 'document',
        docId: doc.id,
        name,
        notSubject: num(g('crypto.income_chf')) ?? 0,
        fees: 0,
        savings: 0,
        states: stateList(keys),
        complete: value !== undefined,
        valueBasis: 'document',
        ...(value !== undefined ? { value } : {}),
      };
      const owner = ownerFor(doc.id, name, docOwner());
      if (owner) raw.owner = owner;
      if (value === undefined) {
        issue(
          'value_missing',
          'missing',
          {
            en: `${name}: no value on 31 December. It is the ESTV tax rate for each crypto times the units you held.`,
            fr: `${name} : pas de valeur au 31 décembre. C’est le cours fiscal de l’AFC de chaque crypto-monnaie multiplié par le nombre d’unités.`,
          },
          doc.id,
          `${GUIDE} p. 40`,
        );
      }
      raws.push(raw);
    } else if (doc.kind === 'life_insurance_attestation' || doc.kind === 'debt_interest') {
      const life = doc.kind === 'life_insurance_attestation';
      const [valueKey, flowKey] = life
        ? ['life_insurance.surrender_value', 'life_insurance.premiums']
        : ['debt.balance', 'debt.interest'];
      const states = stateList([valueKey, flowKey]);
      const value = num(g(valueKey));
      const flow = num(g(flowKey));
      const owner = ownerFor(doc.id, name, docOwner());
      other.push({
        rubric: life ? 'lifeInsurance' : 'debts',
        id: doc.id,
        origin: 'document',
        docId: doc.id,
        name,
        ...(owner ? { owner } : {}),
        ...(value !== undefined ? { value: roundFranc(value) } : {}),
        ...(flow !== undefined ? { flow: roundFranc(flow) } : {}),
        state: states.length ? worst(states) : 'needs_ok',
        complete: states.length > 0,
      });
    }
  }

  // What the user described without a document.
  for (const kindFact of input.facts.filter(
    (f) => f.key === 'wealth.kind' && f.person === 'household' && f.instance,
  )) {
    const id = kindFact.instance!;
    const g = getter(id);
    const kind = kindFact.value as WealthKind;
    const name = str(g('wealth.name')) ?? id;
    const value = num(g('wealth.value_chf'));
    const income = num(g('wealth.income_chf'));
    const keys = [
      'wealth.kind',
      'wealth.name',
      'wealth.owner',
      'wealth.value_chf',
      'wealth.income_chf',
      'wealth.withholding_swiss_chf',
      'wealth.fees_chf',
      'wealth.premiums_chf',
      'wealth.interest_paid_chf',
    ];
    const states = keys
      .map((k) => g(k))
      .filter((f): f is Fact => !!f)
      .map((f) => stateOf(f.status));
    const owner = lineOwner(str(g('wealth.owner')), undefined, people);
    if (kind === 'life_insurance' || kind === 'valuables' || kind === 'debt') {
      const flow = num(
        g(kind === 'life_insurance' ? 'wealth.premiums_chf' : 'wealth.interest_paid_chf'),
      );
      if (!value && !flow) continue;
      other.push({
        rubric:
          kind === 'life_insurance' ? 'lifeInsurance' : kind === 'debt' ? 'debts' : 'valuables',
        id,
        origin: 'you',
        name,
        ...(ownerFor(id, name, owner) ? { owner: owner! } : {}),
        ...(value !== undefined ? { value: roundFranc(value) } : {}),
        ...(flow !== undefined && kind !== 'valuables' ? { flow: roundFranc(flow) } : {}),
        state: worst(states),
        complete: value !== undefined || kind !== 'valuables',
      });
      continue;
    }
    const swiss = num(g('wealth.withholding_swiss_chf'));
    if (!value && !income && !swiss) continue;
    const abroad = g('wealth.abroad')?.value === true;
    const raw: Raw = {
      section: kind === 'loan_given' ? 'securities' : 'accounts',
      id,
      origin: 'you',
      name,
      fees: kind === 'bank_account' ? (num(g('wealth.fees_chf')) ?? 0) : 0,
      savings: kind === 'bank_account' ? (income ?? 0) : 0,
      states,
      complete: true,
      valueBasis: 'you',
      ...(value !== undefined ? { value } : {}),
    };
    if (ownerFor(id, name, owner)) raw.owner = owner!;
    if (value === undefined) {
      raw.complete = false;
      issue(
        'value_missing',
        'missing',
        { en: `${name}: no value on 31 December.`, fr: `${name} : pas de valeur au 31 décembre.` },
        id,
        `${GUIDE} p. 40, 41`,
      );
    }
    if ((swiss ?? 0) > 0) raw.subject = income ?? 0;
    else raw.notSubject = income ?? 0;
    if (swiss !== undefined) raw.withholdingSwiss = swiss;
    if (kind === 'bank_account' && (income ?? 0) > 0 && !abroad && swiss === undefined) {
      raw.complete = false;
      raw.iaUnknown = true;
      issue(
        'ia_missing',
        'missing',
        {
          en: `${name}: interest without the Swiss withholding tax figure. Give the impôt anticipé (0 if none was deducted).`,
          fr: `${name} : intérêts sans le montant de l’impôt anticipé. Indiquez l’impôt anticipé (0 s’il n’y en a pas eu).`,
        },
        id,
        `${GUIDE} p. 40`,
      );
    }
    raws.push(raw);
  }

  // Foreign tax: the non-recoverable part is credited (DA-1) above CHF 100 in total, else it is
  // deducted from the income (withholding.ts).
  let nonRecoverable = 0;
  let recoverableAbroad = 0;
  let iesComplete = true;
  for (const raw of raws) {
    const f = raw.foreign;
    if (!f) continue;
    if (f.credit !== undefined) {
      f.nonRecoverable = f.credit;
      nonRecoverable += f.credit;
      continue;
    }
    const fail = (
      problem: ForeignTax['problem'],
      code: EtatIssue['code'],
      text: Text,
      source?: string,
    ) => {
      f.problem = problem;
      iesComplete = false;
      issue(code, 'missing', text, raw.id, source);
    };
    if (f.gross === undefined) {
      fail('no_income', 'income_missing', {
        en: `${raw.name}: foreign tax withheld without the gross income it was withheld on.`,
        fr: `${raw.name} : impôt étranger retenu sans le rendement brut correspondant.`,
      });
      continue;
    }
    if (f.kind !== 'dividend' && f.kind !== 'interest') {
      fail(
        'kind_unknown',
        'foreign_kind_unknown',
        {
          en: `${raw.name}: Taxpresso can't tell whether the foreign tax was on dividends or interest, so it doesn't compute the credit. Check your broker's statement.`,
          fr: `${raw.name} : Taxpresso ne sait pas si l’impôt étranger porte sur des dividendes ou des intérêts, il ne calcule donc pas l’imputation. Vérifiez le relevé de votre courtier.`,
        },
        'ch-na-oiis art. 8 al. 3 (p. 5)',
      );
      continue;
    }
    const lookup = residualRate(f.country, f.kind, taxYear);
    if (!lookup.ok) {
      if (lookup.reason === 'no_list') {
        fail(
          'no_list',
          'foreign_list_missing',
          {
            en: `${raw.name}: the official list of foreign tax rates for ${taxYear} income is published in early ${taxYear + 1}. Until it is in Taxpresso, the credit (form DA-1) is not computed.`,
            fr: `${raw.name} : la liste officielle des impôts étrangers pour les revenus ${taxYear} est publiée début ${taxYear + 1}. Tant qu’elle n’est pas dans Taxpresso, l’imputation (formule DA-1) n’est pas calculée.`,
          },
          'ch-2025-oiis-dff-annexe p. 2',
        );
      } else {
        fail(
          lookup.reason,
          'foreign_rate_missing',
          {
            en: `${raw.name}: Taxpresso has no official non-recoverable rate for ${f.kind === 'dividend' ? 'dividends' : 'interest'} from ${f.country ?? 'this country'}, so it doesn't compute the credit. Ask your bank or the tax office.`,
            fr: `${raw.name} : Taxpresso n’a pas de taux officiel non récupérable pour les ${f.kind === 'dividend' ? 'dividendes' : 'intérêts'} de ${f.country ?? 'ce pays'} : l’imputation n’est pas calculée. Demandez à votre banque ou à l’administration fiscale.`,
          },
          'ch-2025-oiis-dff-annexe',
        );
      }
      continue;
    }
    const split = splitForeignTax(f.gross, f.withheld, lookup.rate.bp);
    f.rateBp = lookup.rate.bp;
    f.nonRecoverable = split.nonRecoverable;
    f.recoverableAbroad = split.recoverableAbroad;
    f.source = lookup.rate.source;
    if (lookup.rate.caveat) f.caveat = lookup.rate.caveat;
    nonRecoverable += split.nonRecoverable;
    recoverableAbroad += split.recoverableAbroad;
  }
  const anyForeign = raws.some((r) => r.foreign);
  const claimable = !anyForeign
    ? false
    : nonRecoverable > IES_MINIMUM.value
      ? true
      : iesComplete
        ? false
        : undefined;
  // At CHF 100 or less: no credit, the income is reduced by the non-recoverable tax instead.
  let incomeReduction = 0;
  if (claimable === false && anyForeign) {
    for (const raw of raws) {
      const cut = raw.foreign?.nonRecoverable ?? 0;
      if (!cut || raw.notSubject === undefined) continue;
      raw.notSubject = Math.max(0, raw.notSubject - cut);
      incomeReduction += cut;
    }
  }

  // Columns as written on the form: whole francs.
  const lines: EtatLine[] = raws.map((r) => {
    const columns: Columns = {
      subjectIa: roundFranc(r.subject ?? 0),
      notSubjectIa: roundFranc(r.notSubject ?? 0),
      taxableValue: roundFranc(r.value ?? 0),
      fees: roundFranc(r.fees),
      savingsInterest: roundFranc(r.savings),
    };
    const { foreign } = r;
    return {
      section: r.section,
      id: r.id,
      origin: r.origin,
      ...(r.docId ? { docId: r.docId } : {}),
      name: r.name,
      ...(r.reference ? { reference: r.reference } : {}),
      ...(r.owner ? { owner: r.owner } : {}),
      ...(r.quantity ? { quantity: r.quantity } : {}),
      ...(r.currency ? { currency: r.currency } : {}),
      columns,
      ...(r.valueBasis ? { valueBasis: r.valueBasis } : {}),
      ...(r.withholdingSwiss !== undefined ? { withholdingSwiss: r.withholdingSwiss } : {}),
      ...(foreign
        ? {
            foreign: {
              withheld: foreign.withheld,
              ...(foreign.country ? { country: foreign.country } : {}),
              ...(foreign.kind ? { kind: foreign.kind } : {}),
              ...(foreign.rateBp !== undefined ? { rateBp: foreign.rateBp } : {}),
              ...(foreign.nonRecoverable !== undefined
                ? { nonRecoverable: foreign.nonRecoverable }
                : {}),
              ...(foreign.recoverableAbroad !== undefined
                ? { recoverableAbroad: foreign.recoverableAbroad }
                : {}),
              ...(foreign.source ? { source: foreign.source } : {}),
              ...(foreign.caveat ? { caveat: foreign.caveat } : {}),
              ...(foreign.problem ? { problem: foreign.problem } : {}),
            },
          }
        : {}),
      state: worst(r.states),
      complete: r.complete,
    };
  });
  const order: Section[] = ['accounts', 'securities', 'statements'];
  const sortKey = (l: EtatLine) =>
    `${order.indexOf(l.section)}\u0000${l.name.toLowerCase()}\u0000${l.id}`;
  lines.sort((a, b) => (sortKey(a) < sortKey(b) ? -1 : 1));

  const subtotals = {
    accounts: zeroColumns(),
    securities: zeroColumns(),
    statements: zeroColumns(),
  } satisfies Record<Section, Columns>;
  for (const l of lines) subtotals[l.section] = addColumns(subtotals[l.section], l.columns);
  const totals = order.reduce((acc, s) => addColumns(acc, subtotals[s]), zeroColumns());

  // IA: unknown when an income whose column depends on it is unknown.
  const iaComplete = !raws.some((r) => r.iaUnknown);
  const ia = {
    subject: totals.subjectIa,
    claim: iaClaim(totals.subjectIa),
    complete: iaComplete,
    source: RUBRICS_2026.ia.source,
  };
  const ies = {
    nonRecoverable,
    recoverableAbroad,
    claimable,
    requested: claimable ? nonRecoverable : 0,
    incomeReduction,
    complete: iesComplete,
    source: RUBRICS_2026.ies.source,
  };

  // Items for the tax engine, by rubric and person.
  const items: WealthItem[] = [];
  const personOf = (owner: LineOwner | undefined): WealthItem['person'] =>
    owner === 'p1' || owner === 'p2' ? owner : 'household';
  const add = (
    rubric: Rubric,
    part: WealthItem['part'],
    taxes: WealthItem['taxes'],
    person: WealthItem['person'],
    centimes: number,
    estimate: boolean,
    complete: boolean,
  ) => {
    const def = RUBRICS_2026[rubric];
    const found = items.find((i) => i.rubric === rubric && i.part === part && i.person === person);
    if (found) {
      found.centimes += centimes;
      found.estimate ||= estimate;
      found.complete &&= complete;
      return;
    }
    items.push({
      code: def.code,
      rubric,
      part,
      person,
      centimes,
      taxes,
      estimate,
      complete,
      label: { en: def.en, fr: def.fr },
      source: def.source,
    });
  };
  for (const l of lines) {
    const p = personOf(l.owner);
    const est = l.state !== 'confirmed';
    add(
      'income',
      'income',
      ['icc', 'ifd'],
      p,
      l.columns.subjectIa + l.columns.notSubjectIa,
      est,
      l.complete,
    );
    add('wealth', 'wealth', ['icc'], p, l.columns.taxableValue, est, l.complete);
    if (l.columns.fees)
      add('fees', 'deduction', ['icc', 'ifd'], p, l.columns.fees, est, l.complete);
    if (l.columns.savingsInterest) {
      add('savings', 'deduction', ['icc', 'ifd'], p, l.columns.savingsInterest, est, l.complete);
    }
  }
  const linesEstimate = lines.some((l) => l.state !== 'confirmed');
  if (ia.claim || !ia.complete) {
    add('ia', 'credit', ['icc'], 'household', ia.claim, linesEstimate, ia.complete);
  }
  if (ies.requested || ies.claimable === undefined) {
    add('ies', 'credit', ['icc', 'ifd'], 'household', ies.requested, linesEstimate, ies.complete);
  }
  for (const o of other) {
    const p = personOf(o.owner);
    const est = o.state !== 'confirmed';
    if (o.rubric === 'valuables') {
      add('valuables', 'wealth', ['icc'], p, o.value ?? 0, est, o.complete);
    } else if (o.rubric === 'lifeInsurance') {
      if (o.value !== undefined)
        add('lifeInsuranceValue', 'wealth', ['icc'], p, o.value, est, o.complete);
      if (o.flow !== undefined) {
        add('lifeInsurancePremiums', 'deduction', ['icc', 'ifd'], p, o.flow, est, o.complete);
      }
    } else {
      if (o.value !== undefined)
        add('debts', 'wealth_deduction', ['icc'], p, o.value, est, o.complete);
      if (o.flow !== undefined)
        add('debtInterest', 'deduction', ['icc', 'ifd'], p, o.flow, est, o.complete);
    }
  }

  return {
    taxYear,
    lines,
    subtotals,
    totals,
    ia,
    ies,
    other,
    items,
    issues,
    complete:
      lines.every((l) => l.complete) &&
      other.every((o) => o.complete) &&
      ia.complete &&
      ies.complete,
    estimate: linesEstimate || other.some((o) => o.state !== 'confirmed'),
  };
}
