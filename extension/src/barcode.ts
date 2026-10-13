// Barcodes first (SPEC.md section 5): when a document is added, its barcodes are read on this
// computer. A salary or pension certificate (federal form 11, Swissdec TxAB barcode) or a bank's
// e-tax statement (eCH-0196) whose barcode is complete and schema-valid gives "verified" values,
// each with the box it comes from, and Claude never needs to read the document. Anything else is
// left to the text layer and to Claude.
//
// Privacy: the employee's AHV number, name and address are never stored; the statement's client
// names and numbers neither. Only what the form needs is kept.
import {
  readBarcodes,
  type BarcodeResult,
  type Ech0196Statement,
  type TxabCertificate,
} from '@taxpresso/intake';
import {
  INSTANCE_PATTERN,
  type Fact,
  type FactValue,
  type KeyRegistry,
  type Ledger,
  type Owner,
  type Vault,
  type VaultDocument,
} from '@taxpresso/ledger';

/**
 * Each TxAB element and the key it fills. The box of every key (KeyDef.box, cited to
 * std-lohnausweis-wegleitung-2026-fr) is the box SalaryDeclarationTxAB.xsd documents for the element
 * (std-swissdec-elm5-lohnausweis-richtlinien-fr, std-swissdec-elm6-barcode-annexe5); a test checks
 * they agree.
 */
export const TXAB_KEYS: Readonly<Record<string, string>> = {
  'S/Income': 'salary.base',
  'S/FringeBenefits/FoodLodging': 'salary.board_lodging',
  'S/FringeBenefits/CompanyCar': 'salary.company_car',
  'S/FringeBenefits/Other': 'salary.other_fringe',
  'S/SporadicBenefits': 'salary.non_periodic',
  'S/CapitalPayment': 'salary.capital',
  'S/OwnershipRight': 'salary.participations',
  'S/BoardOfDirectorsRemuneration': 'salary.board_fees',
  'S/OtherBenefits': 'salary.other_benefits',
  'S/GrossIncome': 'salary.gross',
  'S/AHV-ALV-NBUV-AVS-AC-AANP-Contribution': 'salary.social_contributions',
  'S/BVG-LPP-Contribution/Regular': 'salary.lpp_ordinary',
  'S/BVG-LPP-Contribution/Purchase': 'salary.lpp_buyin',
  'S/NetIncome': 'salary.net',
  'S/DeductionAtSource': 'salary.source_tax',
  'S/Charges/Effective/TravelFoodAccommodation': 'salary.expenses_travel',
  'S/Charges/Effective/Other': 'salary.expenses_other',
  'S/Charges/LumpSum/Representation': 'salary.allowance_representation',
  'S/Charges/LumpSum/Car': 'salary.allowance_car',
  'S/Charges/LumpSum/Other': 'salary.allowance_other',
  'S/Charges/Education': 'salary.education',
  'S/OtherFringeBenefits': 'salary.other_fringe_note',
  'S/FreeTransport': 'salary.free_transport',
  'S/CanteenLunchCheck': 'salary.canteen',
  'S/StandardRemark/RelocationCosts': 'salary.relocation_costs',
  'S/Remark': 'salary.remarks',
  // Pension certificate (attestation de rentes): the gross pension, box 8.
  'A/GrossIncome': 'pension.amount',
};

/** Parse methods of a document read from its barcode. */
export const BARCODE_READ = 'barcode';
/** Read from its barcode, but whose it is isn't known yet (a couple): values wait for that. */
export const BARCODE_PENDING = 'barcode_pending';

export const isBarcodeDocument = (doc: VaultDocument): boolean =>
  doc.parse.method === BARCODE_READ || doc.parse.method === BARCODE_PENDING;

/** Reads a document's barcodes, PDFs and photos only. Undefined when there is nothing to read. */
export async function readDocumentBarcodes(
  vault: Vault,
  doc: VaultDocument,
): Promise<BarcodeResult | undefined> {
  if (!/\.(pdf|jpe?g|png)$/i.test(doc.filename)) return undefined;
  let bytes: Buffer;
  try {
    bytes = await vault.readDocument(doc);
  } catch {
    return undefined;
  }
  const result = await readBarcodes(new Uint8Array(bytes), doc.filename);
  if (process.env.TAXPRESSO_BARCODE_DEBUG === '1') {
    // Diagnostics only (no values): which symbols were found and how the payload was read.
    console.error('[taxpresso barcode]', doc.id, result.found, JSON.stringify(result.diagnostics));
  }
  return result;
}

interface Wanted {
  key: string;
  person: Owner;
  instance: string;
  value: FactValue;
  field?: string;
}

/** The values of a certificate for `person`, instance = the vault document. */
function certificateFacts(
  c: TxabCertificate,
  doc: VaultDocument,
  person: 'p1' | 'p2',
  keys: KeyRegistry,
): Wanted[] {
  const out: Wanted[] = [];
  for (const v of c.values) {
    const key = TXAB_KEYS[v.path];
    const def = key ? keys[key] : undefined;
    if (!key || !def) continue;
    const value =
      def.type === 'money'
        ? v.centimes
        : def.type === 'boolean'
          ? v.flag === true
          : def.type === 'string' && v.text
            ? v.text.slice(0, 500)
            : undefined;
    if (value === undefined) continue;
    out.push({ key, person, instance: doc.id, value, field: v.box });
  }
  if (c.form === 'S') {
    // Boxes F and G: not ticked is as certain as ticked on a barcode.
    for (const [path, key, box] of [
      ['S/FreeTransport', 'salary.free_transport', 'F'],
      ['S/CanteenLunchCheck', 'salary.canteen', 'G'],
    ] as const) {
      if (!c.values.some((v) => v.path === path)) {
        out.push({ key, person, instance: doc.id, value: false, field: box });
      }
    }
  } else {
    // Form 11 as an attestation de rentes: a pension of the 2nd pillar
    // (std-lohnausweis-wegleitung-2026-fr p. 6, Cm 1).
    out.push({ key: 'pension.type', person, instance: doc.id, value: 'occupational' });
  }
  return out;
}

/** A safe instance id from an account number or a position. */
function instanceId(raw: string, fallback: string): string {
  const id = raw
    .replace(/[^A-Za-z0-9_.:-]/g, '-')
    .replace(/^[^A-Za-z0-9]+/, '')
    .slice(0, 64);
  return INSTANCE_PATTERN.test(id) ? id : fallback;
}

/** The household values of an e-tax statement. */
function statementFacts(s: Ech0196Statement, doc: VaultDocument): Wanted[] {
  const out: Wanted[] = [];
  const add = (key: string, instance: string, value: FactValue | undefined) => {
    if (value !== undefined && value !== '')
      out.push({ key, person: 'household', instance, value });
  };
  add('statement.value_chf', doc.id, s.totals.valueChf);
  add('statement.income_a_chf', doc.id, s.totals.incomeA);
  add('statement.income_b_chf', doc.id, s.totals.incomeB);
  add('statement.withholding_swiss_chf', doc.id, s.totals.withholding);
  s.accounts.forEach((a, i) => {
    const id = instanceId(a.id, `${doc.id}.a${i + 1}`);
    // The form asks for the last 8 positions of the IBAN (ge-2025-guide-declaration-pp p. 40).
    add('accounts.number', id, (a.iban ?? a.number ?? '').slice(-8));
    add('accounts.bank', id, s.institution);
    add('accounts.name', id, a.name.slice(0, 200));
    add('accounts.currency', id, a.currency);
    add('accounts.balance_original', id, a.balance);
    add('accounts.value_chf', id, a.valueChf);
    add('accounts.income_a_chf', id, a.incomeA);
    add('accounts.income_b_chf', id, a.incomeB);
    add('accounts.withholding_swiss_chf', id, a.withholding);
    add('accounts.opened', id, a.openingDate);
    add('accounts.closed', id, a.closingDate);
  });
  s.liabilities.forEach((l, i) => {
    const id = instanceId(l.id, `${doc.id}.l${i + 1}`);
    add('liabilities.creditor', id, s.institution);
    add('liabilities.name', id, l.name.slice(0, 200));
    add('liabilities.balance_chf', id, l.valueChf);
    add('liabilities.interest_chf', id, l.interest);
  });
  s.securities.forEach((sec) => {
    const id = sec.isin ?? instanceId(`${doc.id}.p${sec.positionId}`, `${doc.id}.p`);
    add('securities.name', id, sec.name.slice(0, 200));
    add('securities.isin', id, sec.isin);
    add('securities.valor', id, sec.valor);
    add('securities.currency', id, sec.currency);
    add('securities.country', id, sec.country);
    add('securities.quantity', id, sec.quantity);
    if (!sec.valueUndefined) add('securities.value_chf', id, sec.valueChf);
    add('securities.value_kursliste', id, sec.kursliste === true);
    add('securities.income_gross_chf', id, sec.incomeA + sec.incomeB);
    add('securities.withholding_swiss_chf', id, sec.withholding);
    add('securities.withholding_foreign_chf', id, sec.lumpSumTaxCredit);
  });
  return out;
}

export interface BarcodeApplied {
  /** Facts appended to the ledger. */
  recorded: number;
  /** The document was recognised from its barcode. */
  read: boolean;
  /** Read, but its values wait until the user says whose it is. */
  pending: boolean;
}

/**
 * Puts what the barcode says on the document (kind, year, period, issuer) and its values in the
 * ledger, as "verified". The user's own choices win: a kind the user gave is never changed, and a
 * value the user stated is never overwritten. `owner` is whose a certificate is, when known.
 */
export function applyBarcode(
  ledger: Ledger,
  keys: KeyRegistry,
  doc: VaultDocument,
  result: BarcodeResult,
  owner: 'p1' | 'p2' | undefined,
): BarcodeApplied {
  const userKind = doc.kindSource === 'user' ? doc.kind : undefined;
  if (result.found === 'none') {
    if (result.classified && !doc.kind) {
      doc.kind = result.classified;
      doc.kindSource = 'barcode';
      doc.parse = {
        method: 'none',
        ok: false,
        warnings: ['The barcode sheets of this e-tax statement can’t be read in full.'],
      };
    }
    return { recorded: 0, read: false, pending: false };
  }
  const kind =
    result.found === 'ech0196'
      ? 'ech0196_statement'
      : result.certificate.form === 'A'
        ? 'pension_certificate'
        : 'salary_certificate';
  if (userKind && userKind !== kind) return { recorded: 0, read: false, pending: false };

  doc.kind = kind;
  if (!userKind) doc.kindSource = 'barcode';
  let wanted: Wanted[];
  if (result.found === 'ech0196') {
    const s = result.statement;
    doc.taxYear = s.taxPeriod;
    doc.periodFrom = s.periodFrom;
    doc.periodTo = s.periodTo;
    if (s.institution) doc.issuer = s.institution;
    if (!doc.person) doc.person = 'household';
    wanted = statementFacts(s, doc);
  } else {
    const c = result.certificate;
    doc.taxYear = Number(c.periodTo.slice(0, 4));
    doc.periodFrom = c.periodFrom;
    doc.periodTo = c.periodTo;
    if (c.employer) doc.issuer = c.employer;
    if (!owner) {
      doc.parse = { method: BARCODE_PENDING, ok: true, warnings: [] };
      return { recorded: 0, read: true, pending: true };
    }
    doc.person = owner;
    wanted = certificateFacts(c, doc, owner, keys);
  }

  let recorded = 0;
  const problems: string[] = [];
  for (const w of wanted) {
    if (!keys[w.key]) continue;
    const current = ledger.get(w.key, w.person, w.instance);
    if (current?.status === 'stated') continue; // the user's word wins
    if (
      current?.status === 'verified' &&
      current.source.docId === doc.id &&
      JSON.stringify(current.value) === JSON.stringify(w.value)
    ) {
      continue;
    }
    try {
      ledger.append({
        key: w.key,
        person: w.person,
        instance: w.instance,
        value: w.value,
        status: 'verified',
        source: { method: 'barcode', docId: doc.id, ...(w.field ? { field: w.field } : {}) },
      });
      recorded++;
    } catch (err) {
      problems.push(`${w.key}: ${(err as Error).message}`);
    }
  }
  doc.parse = { method: BARCODE_READ, ok: problems.length === 0, warnings: problems };
  return { recorded, read: true, pending: false };
}

/** Facts read from a document's barcode, still counted. */
export const fromBarcode = (facts: readonly Fact[], docId: string): Fact[] =>
  facts.filter(
    (f) => f.source.docId === docId && f.source.method === 'barcode' && f.status === 'verified',
  );

/** How a barcode reading is told in tool results (English, for Claude; no personal values). */
export function barcodeNote(doc: VaultDocument, recorded: number): string {
  if (doc.parse.method === BARCODE_PENDING) {
    return 'read from the barcode; the user says whose it is in the dashboard, then its values fill in';
  }
  if (doc.parse.method === BARCODE_READ) {
    return `read from the barcode (verified)${recorded ? `, ${recorded} values` : ''}`;
  }
  return '';
}
