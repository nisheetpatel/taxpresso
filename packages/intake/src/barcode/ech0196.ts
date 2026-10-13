// Bank e-tax statements (eCH-0196 relevé fiscal électronique) from their barcode sheets.
// Sources: std-eCH-0270-codes-barres-generation (p. 9: PDF417 Structured Append, the XML
// compressed with a "ZIP file algorithm"), std-eCH-0196-barcode-annex-v2-2-0 (p. 6: ZLIB,
// java.util.zip.Deflater BEST_COMPRESSION; the document ID in PDFMacroFileName, a random
// PDFMacroFileId), std-eCH-0196-v2-2-0-xsd (the schema, namespace http://www.ech.ch/xmlns/eCH-0196/2).
// The two documents disagree on the compression (docs/sources/README.md): ZLIB, ZIP, GZIP and raw
// deflate are all accepted, and which one a statement used is reported.
//
// Segments: Macro PDF417 symbols carry a segment index, an optional segment count and a file id
// (ISO/IEC 15438 annex H, as read by ZXing). They are grouped by file id, ordered by index,
// checked complete and joined. Amounts become integer centimes with one rounding, half away from
// zero (broker/decimal.ts). Client names, numbers and the statement id are never returned.
import { gunzipSync, inflateRawSync, inflateSync } from 'node:zlib';
import { parseDecimal, ratio, toCentimes } from '../broker/decimal.js';
import { isValidIsin } from '../broker/isin.js';
import { parseXml, XmlError } from '../broker/xml.js';
import {
  decodeXmlText,
  isXsBoolean,
  isXsDateTime,
  isXsDecimal,
  problems,
  resolveNamespaces,
  sequence,
  xsDate,
  type NsElement,
  type Problems,
} from './xmlns.js';
import { isZip, readZip, ZipError } from './zip.js';
import type { FoundSymbol } from './zxing.js';

export const ECH0196_NAMESPACE = 'http://www.ech.ch/xmlns/eCH-0196/2';
/** Largest XML accepted after decompression. */
const MAX_XML_BYTES = 32 * 1024 * 1024;

export type Compression = 'zlib' | 'zip' | 'gzip' | 'deflate' | 'none';

export interface SegmentAssembly {
  data: Uint8Array;
  segments: number;
  /** ZXing's file id of the sequence (random per statement). */
  fileId: string;
}

export type SegmentProblem =
  | { problem: 'incomplete'; have: number[]; of: number | undefined }
  | { problem: 'conflict'; index: number };

/**
 * Joins Macro PDF417 segments into the payload: grouped by file id (the largest group wins),
 * ordered by segment index, every index from 0 to count - 1 present, duplicates identical. The
 * count comes from the segments' optional count field, or from the last segment (ZXing reports
 * index + 1 for the one carrying the terminator). A symbol without Structured Append is a
 * one-segment payload.
 */
export function assembleSegments(
  symbols: readonly FoundSymbol[],
): SegmentAssembly | SegmentProblem | undefined {
  const pdf417 = symbols.filter((s) => s.format === 'PDF417');
  const groups = new Map<string, FoundSymbol[]>();
  for (const s of pdf417) {
    if (!s.sequence) continue;
    const list = groups.get(s.sequence.id) ?? [];
    list.push(s);
    groups.set(s.sequence.id, list);
  }
  if (groups.size === 0) {
    const single = pdf417[0];
    return single ? { data: single.bytes, segments: 1, fileId: '' } : undefined;
  }
  const [fileId, group] = [...groups.entries()].sort((a, b) => b[1].length - a[1].length)[0]!;
  const sizes = group.map((s) => s.sequence!.size).filter((n) => n > 0);
  const count = sizes.length ? Math.max(...sizes) : undefined;
  const byIndex = new Map<number, Uint8Array>();
  for (const s of group) {
    const { index } = s.sequence!;
    const seen = byIndex.get(index);
    if (seen && !Buffer.from(seen).equals(Buffer.from(s.bytes)))
      return { problem: 'conflict', index };
    byIndex.set(index, s.bytes);
  }
  const have = [...byIndex.keys()].sort((a, b) => a - b);
  if (count === undefined || have.length < count || have.some((i) => i >= count)) {
    return { problem: 'incomplete', have, of: count };
  }
  const data = Buffer.concat(Array.from({ length: count }, (_, i) => byIndex.get(i)!));
  return { data, segments: count, fileId };
}

/** Decompresses a statement payload, whichever of the formats the standards name it uses. */
export function decompress(data: Uint8Array): { xml: Uint8Array; compression: Compression } {
  const opts = { maxOutputLength: MAX_XML_BYTES };
  if (data.length >= 2 && (data[0]! & 0x0f) === 8 && ((data[0]! << 8) | data[1]!) % 31 === 0) {
    return { xml: inflateSync(data, opts), compression: 'zlib' };
  }
  if (isZip(data)) {
    const entries = readZip(data, MAX_XML_BYTES);
    const xml = entries.find((e) => /\.xml$/i.test(e.name)) ?? entries[0];
    if (!xml) throw new ZipError('Empty archive');
    return { xml: xml.data, compression: 'zip' };
  }
  if (data[0] === 0x1f && data[1] === 0x8b)
    return { xml: gunzipSync(data, opts), compression: 'gzip' };
  const bom = data[0] === 0xef && data[1] === 0xbb && data[2] === 0xbf ? 3 : 0;
  const start = new TextDecoder('latin1').decode(data.subarray(bom, bom + 64));
  if (/^\s*</.test(start)) return { xml: data, compression: 'none' };
  return { xml: inflateRawSync(data, opts), compression: 'deflate' };
}

export interface Ech0196Amounts {
  /** Rubrique A: gross income with Swiss withholding tax (centimes, CHF). */
  incomeA: number;
  /** Rubrique B: gross income without it. */
  incomeB: number;
  /** Withholding tax that can be reclaimed (impôt anticipé). */
  withholding: number;
}

export interface Ech0196Account extends Ech0196Amounts {
  /** IBAN, else the account number, made safe as an instance id. */
  id: string;
  name: string;
  iban?: string;
  number?: string;
  country: string;
  currency: string;
  /** Balance on the reference date in the account's currency, as a decimal string. */
  balance?: string;
  /** Tax value on the reference date, CHF centimes. */
  valueChf?: number;
  referenceDate?: string;
  openingDate?: string;
  closingDate?: string;
}

export interface Ech0196Security extends Ech0196Amounts {
  positionId: string;
  depot: string;
  isin?: string;
  valor?: string;
  name: string;
  country: string;
  currency: string;
  category: string;
  /** Quantity (pieces or nominal) on the reference date, decimal string. */
  quantity?: string;
  quotation?: 'PIECE' | 'PERCENT';
  valueChf?: number;
  /** The tax value comes from the ESTV price list (Kursliste flag). */
  kursliste?: boolean;
  /** The bank says no tax value is available ("undefined" flag). */
  valueUndefined?: boolean;
  /** Foreign tax: the lump-sum tax credit (imputation forfaitaire), CHF centimes. */
  lumpSumTaxCredit: number;
  /** Additional withholding tax USA, CHF centimes. */
  additionalUsa: number;
}

export interface Ech0196Liability {
  id: string;
  name: string;
  currency: string;
  valueChf?: number;
  /** Interest paid (gross revenue B of the liability), CHF centimes. */
  interest: number;
}

export interface Ech0196Statement {
  minorVersion: string;
  taxPeriod: number;
  periodFrom: string;
  periodTo: string;
  canton: string;
  institution: string;
  totals: Ech0196Amounts & { valueChf: number };
  accounts: Ech0196Account[];
  securities: Ech0196Security[];
  liabilities: Ech0196Liability[];
}

export type Ech0196Reading =
  | { ok: true; statement: Ech0196Statement }
  | { ok: false; reason: 'xml' | 'not_ech0196' | 'invalid'; problems: string[] };

/** CHF centimes from an xs:decimal, rounded once (halves away from zero). */
function chf(value: string | undefined): number | undefined {
  if (!isXsDecimal(value)) return undefined;
  const d = parseDecimal(value!.trim().replace(/^\+/, ''));
  if (!d) return undefined;
  try {
    return toCentimes(ratio.of(d));
  } catch {
    return undefined;
  }
}

/** Reads and checks a statement's XML. */
export function readEch0196(xmlBytes: Uint8Array): Ech0196Reading {
  let root: NsElement;
  try {
    root = resolveNamespaces(
      parseXml(decodeXmlText(xmlBytes), { maxElements: 500_000, maxDepth: 32 }),
    );
  } catch (err) {
    if (err instanceof XmlError || err instanceof TypeError) {
      return { ok: false, reason: 'xml', problems: [err.message] };
    }
    throw err;
  }
  return validateEch0196(root);
}

const ISO2 = /^[A-Z]{2}$/;
const ISO3 = /^[A-Z]{3}$/;
const QUOTATION = new Set(['PIECE', 'PERCENT']);
const CATEGORY = new Set([
  'BOND',
  'COINBULL',
  'CURRNOTE',
  'DEVT',
  'FUND',
  'LIBOSWAP',
  'OPTION',
  'OTHER',
  'SHARE',
]);

/** Checks the attributes of one element: required ones present, each of the right type. */
function attrs(
  el: NsElement,
  spec: Record<string, { type: AttrType; required?: boolean }>,
  p: Problems,
): void {
  for (const [name, value] of Object.entries(el.attrs)) {
    const s = spec[name];
    if (!s) {
      p.add(el, `${el.local}: unexpected attribute ${name}`);
      continue;
    }
    if (!attrOk(s.type, value)) p.add(el, `${el.local}/@${name}: not a valid ${s.type}`);
  }
  for (const [name, s] of Object.entries(spec)) {
    if (s.required && el.attrs[name] === undefined) p.add(el, `${el.local}: missing @${name}`);
  }
}

type AttrType =
  | 'string'
  | 'decimal'
  | 'positive'
  | 'date'
  | 'dateTime'
  | 'boolean'
  | 'year'
  | 'integer'
  | 'iso2'
  | 'iso3'
  | 'quotation'
  | 'category'
  | 'isin';

function attrOk(type: AttrType, v: string): boolean {
  switch (type) {
    case 'string':
      return true;
    case 'decimal':
      return isXsDecimal(v);
    case 'positive':
      return isXsDecimal(v) && !v.trim().startsWith('-');
    case 'date':
      return xsDate(v) !== undefined;
    case 'dateTime':
      return isXsDateTime(v);
    case 'boolean':
      return isXsBoolean(v);
    case 'year':
      return /^\d{4}$/.test(v.trim());
    case 'integer':
      return /^[+-]?\d+$/.test(v.trim());
    case 'iso2':
      return ISO2.test(v);
    case 'iso3':
      return ISO3.test(v);
    case 'quotation':
      return QUOTATION.has(v);
    case 'category':
      return CATEGORY.has(v);
    case 'isin':
      return v.length === 12;
  }
}

const TOTALS = {
  totalTaxValue: { type: 'decimal', required: true },
  totalGrossRevenueA: { type: 'decimal', required: true },
  totalGrossRevenueB: { type: 'decimal', required: true },
  totalWithHoldingTaxClaim: { type: 'decimal', required: true },
} as const;

const truthy = (v: string | undefined) => v === 'true' || v === '1';
const safeId = (s: string) =>
  s
    .replace(/\s+/g, '')
    .replace(/[^A-Za-z0-9_.:-]/g, '-')
    .replace(/^[^A-Za-z0-9]+/, '')
    .slice(0, 64);

export function validateEch0196(root: NsElement): Ech0196Reading {
  if (root.ns !== ECH0196_NAMESPACE || root.local !== 'taxStatement') {
    return { ok: false, reason: 'not_ech0196', problems: [`Root ${root.local} in ${root.ns}`] };
  }
  const ns = ECH0196_NAMESPACE;
  const p = problems();
  attrs(
    root,
    {
      minorVersion: { type: 'integer', required: true },
      id: { type: 'string', required: true },
      creationDate: { type: 'dateTime', required: true },
      taxPeriod: { type: 'year', required: true },
      periodFrom: { type: 'date', required: true },
      periodTo: { type: 'date', required: true },
      country: { type: 'iso2' },
      canton: { type: 'string', required: true },
      ...TOTALS,
      totalGrossRevenueACanton: { type: 'decimal' },
      totalGrossRevenueBCanton: { type: 'decimal' },
    },
    p,
  );
  if (!/^[A-Za-z_][\w.-]*$/.test(root.attrs.id ?? ''))
    p.add(root, 'taxStatement/@id: not an xs:ID');

  let institution = '';
  const accounts: Ech0196Account[] = [];
  const securities: Ech0196Security[] = [];
  const liabilities: Ech0196Liability[] = [];

  // Federal figures (grossRevenueA/B); the cantonal variants of securities income are not used yet.
  const sumPayments = (el: NsElement): Ech0196Amounts => {
    const out = { incomeA: 0, incomeB: 0, withholding: 0 };
    for (const pay of el.children.filter((c) => c.ns === ns && c.local === 'payment')) {
      out.incomeA += chf(pay.attrs.grossRevenueA) ?? 0;
      out.incomeB += chf(pay.attrs.grossRevenueB) ?? 0;
      out.withholding += chf(pay.attrs.withHoldingTaxClaim) ?? 0;
    }
    return out;
  };

  sequence(
    root,
    ns,
    [
      {
        name: 'institution',
        check: (el) => {
          attrs(el, { lei: { type: 'string' }, name: { type: 'string', required: true } }, p);
          institution = (el.attrs.name ?? '').replace(/\s+/g, ' ').trim().slice(0, 120);
          sequence(el, ns, [{ name: 'uid', min: 0 }], p, true);
        },
      },
      {
        name: 'client',
        max: 1000,
        check: (el) => {
          if (!el.attrs.clientNumber) p.add(el, 'client: missing @clientNumber');
        },
      },
      { name: 'accompanyingLetter', min: 0, max: 1000 },
      {
        name: 'listOfBankAccounts',
        min: 0,
        check: (list) => {
          attrs(list, TOTALS, p);
          sequence(
            list,
            ns,
            [
              {
                name: 'bankAccount',
                min: 0,
                max: 100_000,
                check: (acc) => {
                  attrs(acc, ACCOUNT_ATTRS, p);
                  let tax: NsElement | undefined;
                  sequence(
                    acc,
                    ns,
                    [
                      {
                        name: 'taxValue',
                        min: 0,
                        check: (t) => {
                          tax = t;
                          attrs(t, ACCOUNT_TAX_ATTRS, p);
                        },
                      },
                      {
                        name: 'payment',
                        min: 0,
                        max: 100_000,
                        check: (pay) => attrs(pay, ACCOUNT_PAYMENT_ATTRS, p),
                      },
                    ],
                    p,
                    true,
                  );
                  const iban = acc.attrs.iban?.replace(/\s+/g, '');
                  const number = acc.attrs.bankAccountNumber?.trim();
                  const id = safeId(iban || number || `account-${accounts.length + 1}`);
                  accounts.push({
                    id,
                    name: (acc.attrs.bankAccountName ?? '').trim(),
                    ...(iban ? { iban } : {}),
                    ...(number ? { number } : {}),
                    country: acc.attrs.bankAccountCountry ?? '',
                    currency: acc.attrs.bankAccountCurrency ?? '',
                    ...(tax?.attrs.balance ? { balance: tax.attrs.balance.trim() } : {}),
                    ...(tax ? { valueChf: chf(tax.attrs.value) ?? 0 } : {}),
                    ...(tax?.attrs.referenceDate
                      ? { referenceDate: xsDate(tax.attrs.referenceDate)! }
                      : {}),
                    ...(acc.attrs.openingDate
                      ? { openingDate: xsDate(acc.attrs.openingDate)! }
                      : {}),
                    ...(acc.attrs.closingDate
                      ? { closingDate: xsDate(acc.attrs.closingDate)! }
                      : {}),
                    ...sumPayments(acc),
                  });
                },
              },
            ],
            p,
          );
        },
      },
      {
        name: 'listOfLiabilities',
        min: 0,
        check: (list) => {
          attrs(
            list,
            {
              totalTaxValue: { type: 'positive', required: true },
              totalGrossRevenueB: { type: 'positive', required: true },
            },
            p,
          );
          sequence(
            list,
            ns,
            [
              {
                name: 'liabilityAccount',
                min: 0,
                max: 100_000,
                check: (acc) => {
                  attrs(acc, LIABILITY_ATTRS, p);
                  let tax: NsElement | undefined;
                  sequence(
                    acc,
                    ns,
                    [
                      {
                        name: 'taxValue',
                        min: 0,
                        check: (t) => {
                          tax = t;
                          attrs(t, LIABILITY_TAX_ATTRS, p);
                        },
                      },
                      {
                        name: 'payment',
                        min: 0,
                        max: 100_000,
                        check: (pay) => attrs(pay, LIABILITY_PAYMENT_ATTRS, p),
                      },
                    ],
                    p,
                    true,
                  );
                  const iban = acc.attrs.iban?.replace(/\s+/g, '');
                  const number = acc.attrs.bankAccountNumber?.trim();
                  let interest = 0;
                  for (const pay of acc.children.filter(
                    (c) => c.ns === ns && c.local === 'payment',
                  )) {
                    interest += chf(pay.attrs.grossRevenueB) ?? 0;
                  }
                  liabilities.push({
                    id: safeId(iban || number || `liability-${liabilities.length + 1}`),
                    name: (acc.attrs.bankAccountName ?? '').trim(),
                    currency: acc.attrs.bankAccountCurrency ?? '',
                    ...(tax ? { valueChf: chf(tax.attrs.value) ?? 0 } : {}),
                    interest,
                  });
                },
              },
            ],
            p,
          );
        },
      },
      { name: 'listOfExpenses', min: 0 },
      {
        name: 'listOfSecurities',
        min: 0,
        check: (list) => {
          attrs(
            list,
            {
              ...TOTALS,
              totalGrossRevenueACanton: { type: 'decimal' },
              totalGrossRevenueBCanton: { type: 'decimal' },
              totalLumpSumTaxCredit: { type: 'decimal', required: true },
              totalNonRecoverableTax: { type: 'decimal', required: true },
              totalAdditionalWithHoldingTaxUSA: { type: 'decimal', required: true },
              totalGrossRevenueIUP: { type: 'decimal', required: true },
              totalGrossRevenueConversion: { type: 'decimal', required: true },
            },
            p,
          );
          sequence(
            list,
            ns,
            [
              {
                name: 'depot',
                min: 0,
                max: 10_000,
                check: (depot) => {
                  if (!depot.attrs.depotNumber) p.add(depot, 'depot: missing @depotNumber');
                  sequence(
                    depot,
                    ns,
                    [
                      {
                        name: 'security',
                        min: 0,
                        max: 100_000,
                        check: (sec) =>
                          readSecurity(sec, depot.attrs.depotNumber ?? '', ns, p, securities),
                      },
                    ],
                    p,
                  );
                },
              },
            ],
            p,
          );
        },
      },
    ],
    p,
    true,
  );

  const periodFrom = xsDate(root.attrs.periodFrom) ?? '';
  const periodTo = xsDate(root.attrs.periodTo) ?? '';
  if (periodFrom && periodTo && periodFrom > periodTo) p.add(root, 'periodFrom is after periodTo');
  if (p.list.length) return { ok: false, reason: 'invalid', problems: p.list };
  return {
    ok: true,
    statement: {
      minorVersion: root.attrs.minorVersion!.trim(),
      taxPeriod: Number(root.attrs.taxPeriod),
      periodFrom,
      periodTo,
      canton: root.attrs.canton!.trim(),
      institution,
      totals: {
        valueChf: chf(root.attrs.totalTaxValue) ?? 0,
        incomeA: chf(root.attrs.totalGrossRevenueA) ?? 0,
        incomeB: chf(root.attrs.totalGrossRevenueB) ?? 0,
        withholding: chf(root.attrs.totalWithHoldingTaxClaim) ?? 0,
      },
      accounts,
      securities,
      liabilities,
    },
  };
}

const ACCOUNT_ATTRS = {
  iban: { type: 'string' },
  bankAccountNumber: { type: 'string' },
  bankAccountName: { type: 'string', required: true },
  bankAccountCountry: { type: 'iso2', required: true },
  bankAccountCurrency: { type: 'iso3', required: true },
  openingDate: { type: 'date' },
  closingDate: { type: 'date' },
  ...TOTALS,
} as const;
const ACCOUNT_TAX_ATTRS = {
  referenceDate: { type: 'date', required: true },
  name: { type: 'string' },
  balanceCurrency: { type: 'iso3', required: true },
  balance: { type: 'decimal' },
  exchangeRate: { type: 'decimal' },
  value: { type: 'decimal', required: true },
} as const;
const ACCOUNT_PAYMENT_ATTRS = {
  paymentDate: { type: 'date', required: true },
  name: { type: 'string' },
  amountCurrency: { type: 'iso3', required: true },
  amount: { type: 'decimal' },
  exchangeRate: { type: 'decimal' },
  grossRevenueA: { type: 'decimal', required: true },
  grossRevenueB: { type: 'decimal', required: true },
  withHoldingTaxClaim: { type: 'decimal', required: true },
} as const;
const LIABILITY_ATTRS = {
  iban: { type: 'string' },
  bankAccountNumber: { type: 'string' },
  bankAccountName: { type: 'string', required: true },
  bankAccountCountry: { type: 'iso2', required: true },
  bankAccountCurrency: { type: 'iso3', required: true },
  openingDate: { type: 'date' },
  closingDate: { type: 'date' },
  totalTaxValue: { type: 'positive', required: true },
  totalGrossRevenueB: { type: 'positive', required: true },
} as const;
const LIABILITY_TAX_ATTRS = {
  referenceDate: { type: 'date', required: true },
  name: { type: 'string' },
  balanceCurrency: { type: 'iso3', required: true },
  balance: { type: 'positive' },
  exchangeRate: { type: 'decimal' },
  value: { type: 'positive', required: true },
} as const;
const LIABILITY_PAYMENT_ATTRS = {
  paymentDate: { type: 'date', required: true },
  name: { type: 'string' },
  amountCurrency: { type: 'iso3', required: true },
  amount: { type: 'positive' },
  exchangeRate: { type: 'decimal' },
  grossRevenueB: { type: 'positive', required: true },
} as const;
const SECURITY_ATTRS = {
  positionId: { type: 'integer', required: true },
  valorNumber: { type: 'integer' },
  isin: { type: 'isin' },
  country: { type: 'iso2', required: true },
  city: { type: 'string' },
  currency: { type: 'iso3', required: true },
  quotationType: { type: 'quotation', required: true },
  nominalValue: { type: 'decimal' },
  securityCategory: { type: 'category', required: true },
  securityType: { type: 'string' },
  securityName: { type: 'string', required: true },
  issueDate: { type: 'date' },
  redemptionDate: { type: 'date' },
  redemptionDateEarly: { type: 'date' },
  issuePrice: { type: 'decimal' },
  redemptionPrice: { type: 'decimal' },
  redemptionPriceEarly: { type: 'decimal' },
  interestRate: { type: 'decimal' },
  variableInterest: { type: 'boolean' },
  iup: { type: 'boolean' },
  bfp: { type: 'boolean' },
} as const;
const SECURITY_TAX_ATTRS = {
  referenceDate: { type: 'date', required: true },
  name: { type: 'string' },
  quotationType: { type: 'quotation', required: true },
  quantity: { type: 'decimal', required: true },
  balanceCurrency: { type: 'iso3', required: true },
  unitPrice: { type: 'decimal' },
  balance: { type: 'decimal' },
  exchangeRate: { type: 'decimal' },
  value: { type: 'decimal' },
  blocked: { type: 'boolean' },
  blockingTo: { type: 'date' },
  undefined: { type: 'boolean' },
  kursliste: { type: 'boolean' },
} as const;
const SECURITY_PAYMENT_ATTRS = {
  paymentDate: { type: 'date', required: true },
  exDate: { type: 'date' },
  name: { type: 'string' },
  quotationType: { type: 'quotation', required: true },
  quantity: { type: 'decimal', required: true },
  amountCurrency: { type: 'iso3', required: true },
  amountPerUnit: { type: 'decimal' },
  amount: { type: 'decimal' },
  exchangeRate: { type: 'decimal' },
  grossRevenueA: { type: 'decimal' },
  grossRevenueACanton: { type: 'decimal' },
  grossRevenueB: { type: 'decimal' },
  grossRevenueBCanton: { type: 'decimal' },
  withHoldingTaxClaim: { type: 'decimal' },
  lumpSumTaxCredit: { type: 'boolean' },
  lumpSumTaxCreditPercent: { type: 'decimal' },
  lumpSumTaxCreditAmount: { type: 'decimal' },
  nonRecoverableTaxPercent: { type: 'decimal' },
  nonRecoverableTaxAmount: { type: 'decimal' },
  additionalWithHoldingTaxUSA: { type: 'decimal' },
  iup: { type: 'boolean' },
  conversion: { type: 'boolean' },
  gratis: { type: 'boolean' },
  securitiesLending: { type: 'boolean' },
  lendingFee: { type: 'boolean' },
  retrocession: { type: 'boolean' },
  undefined: { type: 'boolean' },
  kursliste: { type: 'boolean' },
  sign: { type: 'string' },
} as const;
const STOCK_ATTRS = {
  referenceDate: { type: 'date', required: true },
  mutation: { type: 'boolean', required: true },
  name: { type: 'string' },
  quotationType: { type: 'quotation', required: true },
  quantity: { type: 'decimal', required: true },
  balanceCurrency: { type: 'iso3', required: true },
  unitPrice: { type: 'decimal' },
  balance: { type: 'decimal' },
  reductionCost: { type: 'decimal' },
  exchangeRate: { type: 'decimal' },
  value: { type: 'decimal' },
  blocked: { type: 'boolean' },
  blockingTo: { type: 'date' },
} as const;

function readSecurity(
  sec: NsElement,
  depot: string,
  ns: string,
  p: Problems,
  out: Ech0196Security[],
): void {
  attrs(sec, SECURITY_ATTRS, p);
  const isin = sec.attrs.isin?.trim();
  if (isin && !isValidIsin(isin)) p.add(sec, `security: ISIN ${isin} has a wrong check digit`);
  let tax: NsElement | undefined;
  const payments: NsElement[] = [];
  sequence(
    sec,
    ns,
    [
      {
        name: 'taxValue',
        min: 0,
        check: (t) => {
          tax = t;
          attrs(t, SECURITY_TAX_ATTRS, p);
        },
      },
      {
        name: 'payment',
        min: 0,
        max: 100_000,
        check: (pay) => {
          payments.push(pay);
          attrs(pay, SECURITY_PAYMENT_ATTRS, p);
          sequence(
            pay,
            ns,
            [
              { name: 'purchase', min: 0, max: 100_000 },
              { name: 'disposition', min: 0 },
            ],
            p,
            true,
          );
        },
      },
      { name: 'stock', min: 0, max: 100_000, check: (s) => attrs(s, STOCK_ATTRS, p) },
      { name: 'uid', min: 0 },
    ],
    p,
    true,
  );
  let incomeA = 0;
  let incomeB = 0;
  let withholding = 0;
  let lumpSumTaxCredit = 0;
  let additionalUsa = 0;
  for (const pay of payments) {
    incomeA += chf(pay.attrs.grossRevenueA) ?? 0;
    incomeB += chf(pay.attrs.grossRevenueB) ?? 0;
    withholding += chf(pay.attrs.withHoldingTaxClaim) ?? 0;
    lumpSumTaxCredit += chf(pay.attrs.lumpSumTaxCreditAmount) ?? 0;
    additionalUsa += chf(pay.attrs.additionalWithHoldingTaxUSA) ?? 0;
  }
  const t = tax;
  const quotation = t?.attrs.quotationType;
  out.push({
    positionId: sec.attrs.positionId ?? '',
    depot,
    ...(isin ? { isin } : {}),
    ...(sec.attrs.valorNumber ? { valor: sec.attrs.valorNumber.trim() } : {}),
    name: (sec.attrs.securityName ?? '').replace(/\s+/g, ' ').trim(),
    country: sec.attrs.country ?? '',
    currency: sec.attrs.currency ?? '',
    category: sec.attrs.securityCategory ?? '',
    ...(t ? { quantity: t.attrs.quantity!.trim() } : {}),
    ...(quotation === 'PIECE' || quotation === 'PERCENT' ? { quotation } : {}),
    ...(t?.attrs.value !== undefined ? { valueChf: chf(t.attrs.value) ?? 0 } : {}),
    ...(t && truthy(t.attrs.kursliste) ? { kursliste: true } : {}),
    ...(t && truthy(t.attrs.undefined) ? { valueUndefined: true } : {}),
    incomeA,
    incomeB,
    withholding,
    lumpSumTaxCredit,
    additionalUsa,
  });
}
