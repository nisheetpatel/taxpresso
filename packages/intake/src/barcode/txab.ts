// The salary certificate's 2D barcode (federal form 11, certificat de salaire / attestation de
// rentes): Swissdec "TaxAccounting barcode" (TxAB). Sources, in std-swissdec-elm5-lohnausweis-
// richtlinien-fr (ELM 5.0, édition 30.06.2020) and std-swissdec-elm6-barcode-annexe5 (ELM 6.0,
// édition 06.03.2026, Richtlinien_Barcode_fr.pdf):
//  - TaxAccountingOverview_f.pdf p. 35 / Richtlinien_Barcode_fr.pdf p. 10 (§2.1): the XML is put in
//    an Info-ZIP archive (java.util.zip) whose one entry is named "txab";
//  - TaxAccountingOverview_f.pdf p. 36-37 / Richtlinien_Barcode_fr.pdf p. 10-11 (§2.2): each
//    symbol starts with 14 control bytes: 1-4 an identification shared by all symbols of one file,
//    5 the compression ("z" = Info-ZIP), 6-8 the size of this symbol's data including the 14
//    bytes (big-endian), 9 page control (1 first, 2 following), 10 control version (3), 11-12 this
//    symbol's number and 13-14 the number of symbols, one decimal digit per byte. The ZIP may be
//    split over several symbols, cut anywhere: the data parts are joined in order;
//  - SalaryDeclarationTxAB.xsd (namespace .../sd/20200220/SalaryDeclarationTxAB, ELM 5.0, and
//    urn:ch:swissdec:elm:v6:20260306:SalaryDeclarationTxAB, ELM 6.0), with the TaxSalaryType and
//    TaxAnnuityType it includes: each element names its box on the form (c1 to c15, E, F, G).
// The header is read when it follows that layout; otherwise the ZIP signature is looked for and the
// bytes before it are only kept for diagnostics.
//
// The employee's AHV number, name and address are checked for their format and never returned:
// only the first and last name are given back, for the caller to suggest whose certificate it is
// in memory. Nothing personal is stored by this module.
import { parseXml, XmlError } from '../broker/xml.js';
import {
  child,
  decodeXmlText,
  isXsDateTime,
  problems,
  resolveNamespaces,
  sequence,
  textOf,
  xsDate,
  type NsElement,
  type Problems,
  type Step,
} from './xmlns.js';
import { isZip, readZip, ZipError } from './zip.js';

export const TXAB_NAMESPACES = {
  'http://www.swissdec.ch/schema/sd/20200220/SalaryDeclarationTxAB': 'elm5',
  'urn:ch:swissdec:elm:v6:20260306:SalaryDeclarationTxAB': 'elm6',
} as const;
type Version = (typeof TXAB_NAMESPACES)[keyof typeof TXAB_NAMESPACES];

/** The 14 control bytes at the start of each salary certificate symbol. */
export interface TxabHeader {
  /** Bytes 1-4, hex: the same for every symbol of one certificate. */
  id: string;
  /** Byte 5: "z" (Info-ZIP). */
  compression: string;
  /** Bytes 6-8: this symbol's data size, the 14 bytes included. */
  size: number;
  /** Byte 9: 1 first page, 2 the following ones. */
  page: number;
  /** Byte 10: version of the control bytes (3). */
  version: number;
  /** Bytes 11-12: this symbol's number, from 1. */
  counter: number;
  /** Bytes 13-14: how many symbols. */
  count: number;
}

export const TXAB_HEADER_LENGTH = 14;

const digit = (b: number | undefined) => (b !== undefined && b <= 9 ? b : undefined);

/** The control bytes, when the symbol follows the Swissdec layout. */
export function parseTxabHeader(symbol: Uint8Array): TxabHeader | undefined {
  if (symbol.length < TXAB_HEADER_LENGTH || symbol[4] !== 0x7a) return undefined;
  const size = (symbol[5]! << 16) | (symbol[6]! << 8) | symbol[7]!;
  const [c1, c2, n1, n2] = [9, 10, 11, 12].map((i) => digit(symbol[i + 1]));
  if (c1 === undefined || c2 === undefined || n1 === undefined || n2 === undefined) {
    return undefined;
  }
  const counter = c1 * 10 + c2;
  const count = n1 * 10 + n2;
  if (size < TXAB_HEADER_LENGTH || size > symbol.length || counter > count) return undefined;
  return {
    id: Buffer.from(symbol.subarray(0, 4)).toString('hex'),
    compression: 'z',
    size,
    page: symbol[8]!,
    version: symbol[9]!,
    counter,
    count,
  };
}

const hex = (b: Uint8Array) => Buffer.from(b).toString('hex');

export interface TxabAssembly {
  zip: Uint8Array;
  /** Diagnostics only: the control bytes of each symbol, in hex, and how they were read. */
  headers: string[];
  layout: 'swissdec' | 'zip-signature';
  symbols: number;
}

export type TxabAssemblyProblem = { problem: 'incomplete'; have: number; of: number };

/**
 * Joins the salary certificate symbols found in a document into the ZIP they carry. Symbols that
 * are not TxAB are ignored. Undefined when none is; a problem when some symbols are missing.
 */
export function assembleTxab(
  symbols: readonly Uint8Array[],
): TxabAssembly | TxabAssemblyProblem | undefined {
  const groups = new Map<string, { header: TxabHeader; data: Uint8Array; raw: Uint8Array }[]>();
  let loose: TxabAssembly | undefined;
  for (const s of symbols) {
    const header = parseTxabHeader(s);
    if (header) {
      // A symbol with only the control bytes (printed on extra pages) carries nothing.
      if (header.size === TXAB_HEADER_LENGTH) continue;
      const list = groups.get(header.id) ?? [];
      list.push({ header, data: s.subarray(TXAB_HEADER_LENGTH, header.size), raw: s });
      groups.set(header.id, list);
      continue;
    }
    // Not the documented layout: a ZIP right after a few unknown bytes.
    const at = indexOfZip(s);
    if (at >= 0 && at <= 64 && !loose) {
      loose = {
        zip: s.subarray(at),
        headers: [hex(s.subarray(0, at))],
        layout: 'zip-signature',
        symbols: 1,
      };
    }
  }
  let best: TxabAssembly | TxabAssemblyProblem | undefined;
  for (const parts of groups.values()) {
    const count = Math.max(...parts.map((p) => p.header.count));
    const byCounter = new Map<number, (typeof parts)[number]>();
    for (const p of parts) byCounter.set(p.header.counter, p);
    const have = [...byCounter.keys()].filter((c) => c >= 1 && c <= count).length;
    if (count < 1 || have < count) {
      if (!best) best = { problem: 'incomplete', have, of: count };
      continue;
    }
    const ordered = Array.from({ length: count }, (_, i) => byCounter.get(i + 1)!);
    const zip = Buffer.concat(ordered.map((p) => p.data));
    if (!isZip(zip)) continue;
    return {
      zip,
      headers: ordered.map((p) => hex(p.raw.subarray(0, TXAB_HEADER_LENGTH))),
      layout: 'swissdec',
      symbols: count,
    };
  }
  return loose ?? best;
}

function indexOfZip(b: Uint8Array): number {
  for (let i = 0; i + 4 <= b.length && i <= 64; i++) {
    if (b[i] === 0x50 && b[i + 1] === 0x4b && b[i + 2] === 0x03 && b[i + 3] === 0x04) return i;
  }
  return -1;
}

/** One value read from the barcode: the XML element it came from and the box on form 11. */
export interface TxabValue {
  /** Element path from the root's child, e.g. "S/GrossIncome" or "S/Charges/LumpSum/Car". */
  path: string;
  /** The box (chiffre) or letter on the form, from the schema's documentation. */
  box: string;
  /** Money in centimes (SalaryAmountType: two decimals, exactly). */
  centimes?: number;
  /** A ticked box (F, G). */
  flag?: true;
  /** Text (boxes 14 and 15), as written. */
  text?: string;
}

export interface TxabCertificate {
  version: Version;
  /** S: salary certificate; A: pension certificate (attestation de rentes). */
  form: 'S' | 'A';
  /** The certificate's own DocID (an identifier, not personal data). */
  docId: string;
  periodFrom: string;
  periodTo: string;
  /** The employer (Company/@HR-RC-Name, else Contact/HR-RC-Name). */
  employer?: string;
  /** In memory only, to suggest whose certificate it is. Never store. */
  employee: { firstName: string; lastName: string };
  values: TxabValue[];
  /** Schema checks that were relaxed, for diagnostics (e.g. no Company element). */
  notes: string[];
}

export type TxabReading =
  | { ok: true; certificate: TxabCertificate }
  | {
      ok: false;
      /** not_txab: valid XML of another kind (e.g. an employee participation form). */
      reason: 'zip' | 'xml' | 'not_txab' | 'invalid';
      problems: string[];
    };

const AMOUNT = /^-?\d+\.\d{2}$/;
/** Whole francs, as the schema's own reduced amounts are written (ReducedSalaryAmountType). */
const WHOLE_FRANCS = /^-?\d{1,9}$/;
const FRANCS = 'Amounts in whole francs';
const NO_CONTACT_NAME = 'Contact without HR-RC-Name';

/**
 * "12345.60" -> 1234560 centimes (SalaryAmountType: two decimals). Some payroll software writes
 * the box amounts in whole francs, like the schema's reduced amounts ("12345" -> 1234500); that is
 * accepted too, and the reader notes it. Anything else (one decimal, separators) is undefined.
 */
export function salaryAmount(value: string | undefined): number | undefined {
  const v = value?.trim();
  if (!v) return undefined;
  const whole = WHOLE_FRANCS.test(v);
  if (!whole && !AMOUNT.test(v)) return undefined;
  const negative = v.startsWith('-');
  const n = Number(v.replace(/[-.]/g, '')) * (whole ? 100 : 1);
  if (!Number.isSafeInteger(n)) return undefined;
  return negative ? -n : n;
}

/** Reads the ZIP of a salary certificate barcode, checks the XML against the schema, maps it. */
export function readTxab(zip: Uint8Array): TxabReading {
  let xmlBytes: Uint8Array;
  try {
    const entry = readZip(zip, 2 * 1024 * 1024).find((e) => e.name === 'txab');
    if (!entry) return { ok: false, reason: 'zip', problems: ['No "txab" entry in the archive'] };
    xmlBytes = entry.data;
  } catch (err) {
    if (err instanceof ZipError) return { ok: false, reason: 'zip', problems: [err.message] };
    throw err;
  }
  let root: NsElement;
  try {
    root = resolveNamespaces(
      parseXml(decodeXmlText(xmlBytes), { maxElements: 5000, maxDepth: 20 }),
    );
  } catch (err) {
    if (err instanceof XmlError || err instanceof TypeError) {
      return { ok: false, reason: 'xml', problems: [err.message] };
    }
    throw err;
  }
  return validateTxab(root);
}

/** The schema checks, then the values (TxAB XSD and the TaxSalaryType / TaxAnnuityType it includes). */
export function validateTxab(root: NsElement): TxabReading {
  const version = TXAB_NAMESPACES[root.ns as keyof typeof TXAB_NAMESPACES];
  if (!version || root.local !== 'T') {
    return { ok: false, reason: 'not_txab', problems: [`Root ${root.local} in ${root.ns}`] };
  }
  const p = problems();
  const notes: string[] = [];
  const ns = root.ns;
  for (const a of ['SID', 'SysV']) {
    const v = root.attrs[a]?.trim();
    if (!v) p.add(root, `Missing attribute ${a}`);
    else if (v.length > 3) p.add(root, `${a} longer than 3 characters`);
  }

  // Company (required by the schema) and PersonID, then exactly one of A, S, OA, OB, OC.
  const company = child(root, 'Company');
  const person = child(root, 'PersonID');
  const forms = root.children.filter(
    (c) => c.ns === ns && ['A', 'S', 'OA', 'OB', 'OC'].includes(c.local),
  );
  const steps: Step[] = [
    { name: 'Company', min: 0, check: (el) => checkCompany(el, p) },
    { name: 'PersonID', check: (el) => checkPerson(el, p) },
  ];
  const form = forms[0];
  if (form) steps.push({ name: form.local });
  else p.add(root, 'Missing the certificate (S, A, OA, OB or OC)');
  sequence(root, ns, steps, p);
  if (!company) {
    // The schema requires it; it carries no box. Accepted, and noted for diagnostics.
    notes.push('No Company element');
  }
  if (form && (form.local === 'OA' || form.local === 'OB' || form.local === 'OC')) {
    return {
      ok: false,
      reason: 'not_txab',
      problems: [`Employee participation form ${form.local}: not read from the barcode yet`],
    };
  }
  if (!form || !person || p.list.length) return { ok: false, reason: 'invalid', problems: p.list };

  const values: TxabValue[] = [];
  const amount = (el: NsElement, path: string, box: string) => {
    const centimes = salaryAmount(el.text);
    if (centimes !== undefined && WHOLE_FRANCS.test(el.text.trim()) && !notes.includes(FRANCS)) {
      notes.push(FRANCS);
    }
    if (centimes === undefined) p.add(el, `${path}: not an amount (two decimals or whole francs)`);
    else if (centimes < 0) p.add(el, `${path}: negative amount`);
    else values.push({ path, box, centimes });
  };
  const sortSum = (optionalSum: boolean) => (path: string, box: string) => (el: NsElement) =>
    sequence(
      el,
      ns,
      [
        { name: 'Text' },
        { name: 'Sum', min: optionalSum ? 0 : 1, check: (s) => amount(s, path, box) },
      ],
      p,
    );
  const money = (path: string, box: string) => (el: NsElement) => amount(el, path, box);
  const text = (path: string, box: string) => (el: NsElement) => {
    if (el.children.length) p.add(el, `${path}: text expected`);
    const t = el.text.replace(/\s+/g, ' ').trim();
    if (t) values.push({ path, box, text: t });
  };
  const flag = (path: string, box: string) => (el: NsElement) => {
    if (el.children.length || el.text.trim()) p.add(el, `${path}: must be empty`);
    values.push({ path, box, flag: true });
  };
  const any = () => undefined;

  let docId = '';
  let periodFrom = '';
  let periodTo = '';
  const docIdStep: Step = {
    name: 'DocID',
    check: (el) => {
      docId = el.text.trim();
      if (!docId || docId.length > 255) p.add(el, 'DocID: 1 to 255 characters');
    },
  };
  const creation: Step[] =
    version === 'elm6'
      ? [
          {
            name: 'CreationDate',
            check: (el) => {
              if (!isXsDateTime(el.text)) p.add(el, 'CreationDate: not a date and time');
            },
          },
        ]
      : [];
  const periodStep: Step = {
    name: 'Period',
    check: (el) =>
      sequence(
        el,
        ns,
        [
          {
            name: 'from',
            check: (d) => {
              periodFrom = xsDate(d.text) ?? '';
              if (!periodFrom) p.add(d, 'Period/from: not a date');
            },
          },
          {
            name: 'until',
            check: (d) => {
              periodTo = xsDate(d.text) ?? '';
              if (!periodTo) p.add(d, 'Period/until: not a date');
            },
          },
        ],
        p,
      ),
  };
  const P = form.local;
  if (version === 'elm6' && !/^#/.test(form.attrs.addresseeIDRef ?? '')) {
    p.add(form, `${P}: missing addresseeIDRef`);
  }

  if (P === 'S') {
    sequence(
      form,
      ns,
      [
        docIdStep,
        ...creation,
        periodStep,
        { name: 'FreeTransport', min: 0, check: flag('S/FreeTransport', 'F') },
        { name: 'CanteenLunchCheck', min: 0, check: flag('S/CanteenLunchCheck', 'G') },
        { name: 'Income', min: 0, check: money('S/Income', '1') },
        {
          name: 'FringeBenefits',
          min: 0,
          check: (el) =>
            sequence(
              el,
              ns,
              [
                {
                  name: 'FoodLodging',
                  min: 0,
                  check: money('S/FringeBenefits/FoodLodging', '2.1'),
                },
                { name: 'CompanyCar', min: 0, check: money('S/FringeBenefits/CompanyCar', '2.2') },
                { name: 'Other', min: 0, check: sortSum(false)('S/FringeBenefits/Other', '2.3') },
              ],
              p,
            ),
        },
        { name: 'SporadicBenefits', min: 0, check: sortSum(false)('S/SporadicBenefits', '3') },
        { name: 'CapitalPayment', min: 0, check: sortSum(false)('S/CapitalPayment', '4') },
        { name: 'OwnershipRight', min: 0, check: money('S/OwnershipRight', '5') },
        {
          name: 'BoardOfDirectorsRemuneration',
          min: 0,
          check: money('S/BoardOfDirectorsRemuneration', '6'),
        },
        { name: 'OtherBenefits', min: 0, check: sortSum(false)('S/OtherBenefits', '7') },
        { name: 'GrossIncome', check: money('S/GrossIncome', '8') },
        {
          name: 'AHV-ALV-NBUV-AVS-AC-AANP-Contribution',
          min: 0,
          check: money('S/AHV-ALV-NBUV-AVS-AC-AANP-Contribution', '9'),
        },
        {
          name: 'BVG-LPP-Contribution',
          min: 0,
          check: (el) =>
            sequence(
              el,
              ns,
              [
                { name: 'Regular', min: 0, check: money('S/BVG-LPP-Contribution/Regular', '10.1') },
                {
                  name: 'Purchase',
                  min: 0,
                  check: money('S/BVG-LPP-Contribution/Purchase', '10.2'),
                },
              ],
              p,
            ),
        },
        { name: 'NetIncome', check: money('S/NetIncome', '11') },
        { name: 'DeductionAtSource', min: 0, check: money('S/DeductionAtSource', '12') },
        { name: 'ChargesRule', min: 0, check: (el) => checkChargesRule(el, ns, p) },
        {
          name: 'Charges',
          min: 0,
          check: (el) =>
            sequence(
              el,
              ns,
              [
                {
                  name: 'Effective',
                  min: 0,
                  check: (e) =>
                    sequence(
                      e,
                      ns,
                      [
                        {
                          name: 'TravelFoodAccommodation',
                          min: 0,
                          check: money('S/Charges/Effective/TravelFoodAccommodation', '13.1.1'),
                        },
                        {
                          name: 'Other',
                          min: 0,
                          check: sortSum(true)('S/Charges/Effective/Other', '13.1.2'),
                        },
                      ],
                      p,
                    ),
                },
                {
                  name: 'LumpSum',
                  min: 0,
                  check: (e) =>
                    sequence(
                      e,
                      ns,
                      [
                        {
                          name: 'Representation',
                          min: 0,
                          check: money('S/Charges/LumpSum/Representation', '13.2.1'),
                        },
                        { name: 'Car', min: 0, check: money('S/Charges/LumpSum/Car', '13.2.2') },
                        {
                          name: 'Other',
                          min: 0,
                          check: sortSum(false)('S/Charges/LumpSum/Other', '13.2.3'),
                        },
                      ],
                      p,
                    ),
                },
                { name: 'Education', min: 0, check: money('S/Charges/Education', '13.3') },
              ],
              p,
            ),
        },
        { name: 'OtherFringeBenefits', min: 0, check: text('S/OtherFringeBenefits', '14') },
        {
          name: 'StandardRemark',
          min: 0,
          check: (el) =>
            sequence(
              el,
              ns,
              (version === 'elm6' ? STANDARD_REMARKS_ELM6 : STANDARD_REMARKS_ELM5).map((name) => ({
                name,
                min: 0 as const,
                check:
                  name === 'RelocationCosts'
                    ? money('S/StandardRemark/RelocationCosts', '15')
                    : any,
              })),
              p,
            ),
        },
        { name: 'Remark', min: 0, check: text('S/Remark', '15') },
        { name: 'Contact', min: 0, check: (el) => checkContact(el, ns, p, notes) },
      ],
      p,
    );
  } else {
    sequence(
      form,
      ns,
      [
        docIdStep,
        ...creation,
        periodStep,
        { name: 'Income', min: 0, check: money('A/Income', '1') },
        { name: 'FringeBenefits', min: 0, check: sortSum(false)('A/FringeBenefits', '2') },
        { name: 'SporadicBenefits', min: 0, check: sortSum(false)('A/SporadicBenefits', '3') },
        { name: 'OwnershipRight', min: 0, check: money('A/OwnershipRight', '5') },
        { name: 'OtherBenefits', min: 0, check: sortSum(false)('A/OtherBenefits', '7') },
        { name: 'GrossIncome', check: money('A/GrossIncome', '8') },
        { name: 'NetIncome', check: money('A/NetIncome', '11') },
        { name: 'DeductionAtSource', min: 0, check: money('A/DeductionAtSource', '12') },
        { name: 'Remark', min: 0, check: text('A/Remark', '15') },
        { name: 'StandardRemark', min: 0, check: any },
      ],
      p,
    );
  }
  if (periodFrom && periodTo && periodFrom > periodTo) p.add(form, 'Period: from is after until');
  if (p.list.length) return { ok: false, reason: 'invalid', problems: p.list };

  const employer =
    company?.attrs['HR-RC-Name']?.trim() ||
    textOf(child(child(form, 'Contact') ?? form, 'HR-RC-Name')) ||
    undefined;
  return {
    ok: true,
    certificate: {
      version,
      form: P as 'S' | 'A',
      docId,
      periodFrom,
      periodTo,
      ...(employer ? { employer: employer.slice(0, 120) } : {}),
      employee: {
        firstName: person.attrs.Firstname?.trim() ?? '',
        lastName: person.attrs.Lastname?.trim() ?? '',
      },
      values,
      notes,
    },
  };
}

const STANDARD_REMARKS_ELM5 = [
  'ChildAllowancePerAHV-AVS',
  'RelocationCosts',
  'StaffShareMarketValue',
  'StaffShareWithoutTaxableIncome',
  'CompanyCarClarify',
  'MinimalEmployeeCarPartPercentage',
  'PercentageExternalWork',
  'TaxAtSourcePeriodForObjection',
  'ContinuedProvisionOfSalary',
  'ExpatriateRuling',
  'ActivityRate',
  'NumberOfSalaryCertificate',
  'Rectificate',
];
const STANDARD_REMARKS_ELM6 = [
  'ChildAllowancePerAHV-AVS',
  'RelocationCosts',
  'StaffShareMarketValue',
  'StaffShareWithoutTaxableIncome',
  'CompanyCarClarify',
  'MinimalEmployeeCarPartPercentage',
  'TaxAtSourcePeriodForObjection',
  'ContinuedProvisionOfSalary',
  'ShortTimeWorkCompensation',
  'ExpatriateRuling',
  'PartTimeEmployment',
  'NumberOfSalaryCertificate',
  'Rectificate',
];

function checkCompany(el: NsElement, p: Problems): void {
  const name = el.attrs['HR-RC-Name'];
  if (!name?.trim()) p.add(el, 'Company: missing HR-RC-Name');
  else if (name.replace(/\s+/g, ' ').trim().length > 30) p.add(el, 'Company: name too long');
  const zip = el.attrs.ZIP;
  if (!zip || zip.length > 6) p.add(el, 'Company: ZIP missing or too long');
}

const AHV = /^\d{3}\.\d{4}\.\d{4}\.\d{2}$/;

function checkPerson(el: NsElement, p: Problems): void {
  const first = el.attrs.Firstname?.replace(/\s+/g, ' ').trim();
  const last = el.attrs.Lastname?.replace(/\s+/g, ' ').trim();
  if (!first || first.length > 15) p.add(el, 'PersonID: Firstname missing or too long');
  if (!last || last.length > 30) p.add(el, 'PersonID: Lastname missing or too long');
  if (!el.attrs.ZIP || el.attrs.ZIP.length > 6) p.add(el, 'PersonID: ZIP missing or too long');
  if (el.attrs.City === undefined) p.add(el, 'PersonID: City missing');
  const ids = el.children.filter((c) => c.ns === el.ns);
  const id = ids[0];
  if (ids.length !== 1 || !id) {
    p.add(el, 'PersonID: one of SV-AS-Nr, DateOfBirth or unknown expected');
    return;
  }
  // Checked for its format only; the number itself is never returned.
  if (id.local === 'SV-AS-Nr') {
    if (!AHV.test(id.text.trim())) p.add(id, 'SV-AS-Nr: not in the 756.xxxx.xxxx.xx format');
  } else if (id.local === 'DateOfBirth') {
    if (!xsDate(id.text)) p.add(id, 'DateOfBirth: not a date');
  } else if (id.local !== 'unknown') p.add(id, `PersonID: unexpected ${id.local}`);
}

const CANTONS = new Set(
  'AG AI AR BE BL BS FR GE GL GR JU LU NE NW OW SG SH SO SZ TG TI UR VD VS ZG ZH'.split(' '),
);

function checkChargesRule(el: NsElement, ns: string, p: Problems): void {
  const choice = el.children.filter((c) => c.ns === ns);
  const one = choice[0];
  if (choice.length !== 1 || !one) {
    p.add(el, 'ChargesRule: WithRegulation or Guidance expected');
    return;
  }
  if (one.local === 'WithRegulation') {
    sequence(
      one,
      ns,
      [
        {
          name: 'Allowed',
          check: (d) => {
            if (!xsDate(d.text)) p.add(d, 'Allowed: not a date');
          },
        },
        {
          name: 'Canton',
          check: (c) => {
            if (!CANTONS.has(c.text.trim())) p.add(c, 'Canton: unknown');
          },
        },
      ],
      p,
    );
  } else if (one.local !== 'Guidance') p.add(one, `ChargesRule: unexpected ${one.local}`);
}

function checkContact(el: NsElement, ns: string, p: Problems, notes: string[]): void {
  // The schema requires HR-RC-Name; some payroll software leaves it out. It carries no box:
  // accepted, and noted for diagnostics (like a missing Company).
  if (!child(el, 'HR-RC-Name') && !notes.includes(NO_CONTACT_NAME)) notes.push(NO_CONTACT_NAME);
  sequence(
    el,
    ns,
    [
      { name: 'HR-RC-Name', min: 0 },
      {
        name: 'Address',
        check: (a) =>
          sequence(
            a,
            ns,
            [
              { name: 'ComplementaryLine', min: 0 },
              { name: 'Street', min: 0 },
              { name: 'Postbox', min: 0 },
              { name: 'Locality', min: 0 },
              { name: 'ZIP-Code' },
              { name: 'City' },
              { name: 'Country', min: 0 },
            ],
            p,
          ),
      },
      { name: 'Person' },
      { name: 'PhoneNumber' },
    ],
    p,
  );
}
