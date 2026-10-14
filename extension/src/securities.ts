// Broker exports in the vault (SPEC.md section 5.7): recognised from their content when they are
// uploaded or found by ingest_vault, read into the securities list (état des titres) and recorded
// as facts, one instance per security (its ISIN). Values in CHF use the broker's prices and rates,
// so they are estimates until the official ESTV price list (Kursliste) for the year is bundled;
// quantities and income read from an export are "extracted" until the user confirms them.
import {
  BROKER_NAMES,
  detectBrokerExport,
  type ExportInput,
  parseBrokerExport,
  type SecuritiesSummary,
  type SecurityLine,
  summarizeSecurities,
} from '@taxpresso/intake';
import type { Fact, FactStatus, Ledger, Vault, VaultDocument } from '@taxpresso/ledger';
import type { ContentLang as Lang } from './lang.js';
import type { SecurityKey } from '@taxpresso/rules-ch';

const NAME_MAX = 200;
const NOT_READ = {
  en: 'Taxpresso can’t read this file as a broker export (Interactive Brokers Flex Query XML, DEGIRO portfolio or account statement CSV).',
  fr: 'Taxpresso ne peut pas lire ce fichier comme un export de courtier (Flex Query XML d’Interactive Brokers, CSV du portefeuille ou du relevé de compte DEGIRO).',
};

export const emptySummary = (taxYear: number): SecuritiesSummary => ({
  taxYear,
  lines: [],
  exports: [],
});

/** Marks the documents that are broker exports, from their content. Returns the ones it marked. */
export async function recogniseExports(
  vault: Vault,
  documents: readonly VaultDocument[],
): Promise<VaultDocument[]> {
  const found: VaultDocument[] = [];
  for (const doc of documents) {
    if (doc.kind !== undefined) continue;
    let format;
    try {
      format = detectBrokerExport(await vault.readDocument(doc));
    } catch {
      continue; // Gone or unreadable: it stays a document to identify.
    }
    if (!format) continue;
    doc.kind = 'broker_export';
    doc.kindSource = 'export';
    doc.issuer = BROKER_NAMES[format];
    doc.parse = { method: format, ok: true, warnings: [] };
    found.push(doc);
  }
  return found;
}

/** Reads every broker export in the vault into the securities list. Never writes anything. */
export async function readSecurities(
  vault: Vault,
  documents: readonly VaultDocument[],
  taxYear: number,
): Promise<{ summary: SecuritiesSummary; unreadable: VaultDocument[] }> {
  const inputs: ExportInput[] = [];
  const unreadable: VaultDocument[] = [];
  for (const doc of documents) {
    if (doc.kind !== 'broker_export') continue;
    let statement;
    try {
      statement = parseBrokerExport(await vault.readDocument(doc));
    } catch {
      statement = undefined;
    }
    if (!statement) {
      unreadable.push(doc);
      continue;
    }
    inputs.push({
      docId: doc.id,
      filename: doc.filename,
      addedAt: doc.addedAt,
      ...(doc.person ? { person: doc.person } : {}),
      statement,
    });
  }
  return { summary: summarizeSecurities(inputs, taxYear), unreadable };
}

/** Puts each export's warnings on its document, so list_documents and the dashboard show them. */
export function applyReports(
  documents: readonly VaultDocument[],
  summary: SecuritiesSummary,
  unreadable: readonly VaultDocument[],
): void {
  for (const report of summary.exports) {
    const doc = documents.find((d) => d.id === report.docId);
    if (doc) {
      doc.parse = {
        method: report.format,
        ok: report.ok,
        warnings: report.warnings.map((w) => w.en),
      };
    }
  }
  for (const doc of unreadable) {
    doc.parse = { method: 'broker_export', ok: false, warnings: [NOT_READ.en] };
  }
}

interface Wanted {
  key: SecurityKey;
  value: string | number;
  status: FactStatus;
  note?: string;
}

function wanted(line: SecurityLine): Wanted[] {
  const out: Wanted[] = [
    { key: 'securities.name', value: line.name.slice(0, NAME_MAX), status: 'extracted' },
  ];
  const add = (
    key: SecurityKey,
    value: string | number | undefined,
    status: FactStatus,
    note?: string,
  ) => {
    if (value !== undefined) out.push({ key, value, status, ...(note ? { note } : {}) });
  };
  add('securities.isin', line.isin, 'extracted');
  add('securities.valor', line.valor, 'extracted');
  add('securities.currency', line.currency, 'extracted');
  add('securities.country', line.country, 'extracted');
  add('securities.quantity', line.quantity, 'extracted');
  // The broker's valuation: an estimate until the official price list is bundled.
  add('securities.value_original', line.value?.amount, 'estimate');
  add('securities.value_chf', line.valueChf, 'estimate', line.valueNote);
  add('securities.income_gross_chf', line.incomeChf, 'extracted', line.incomeNote);
  add('securities.income_kind', line.incomeKind, 'extracted');
  add(
    'securities.withholding_swiss_chf',
    line.withholdingSwissChf,
    'extracted',
    line.withholdingNote,
  );
  add(
    'securities.withholding_foreign_chf',
    line.withholdingForeignChf,
    'extracted',
    line.withholdingNote,
  );
  return out;
}

/** What a key reads when an export no longer shows the security (or no longer gives the value). */
const GONE: Partial<Record<SecurityKey, string | number>> = {
  'securities.quantity': '0',
  'securities.value_original': '0',
  'securities.value_chf': 0,
  'securities.income_gross_chf': 0,
  'securities.withholding_swiss_chf': 0,
  'securities.withholding_foreign_chf': 0,
};
const GONE_NOTE = 'Not given by your broker exports any more';

/**
 * Appends the facts that make the ledger match the securities list. Unchanged values are left
 * alone, so a value the user confirmed stays confirmed. A value an export used to give and no
 * longer does is set to zero with a note: the ledger is append-only. Returns what it appended
 * and anything it could not record.
 */
export function recordSecurities(
  ledger: Ledger,
  summary: SecuritiesSummary,
): { appended: Fact[]; problems: { docId?: string; text: string }[] } {
  const appended: Fact[] = [];
  const problems: { docId?: string; text: string }[] = [];
  const seen = new Set<string>();
  for (const line of summary.lines) {
    const docId = line.docIds[0];
    const want = wanted(line);
    for (const w of want) seen.add(`${w.key}|${line.id}`);
    for (const w of want) {
      const current = ledger.get(w.key, 'household', line.id);
      if (current && current.value === w.value) {
        const fromExport = current.source.method === 'export';
        if (!fromExport || current.status === 'stated') continue;
        if (current.status === w.status && (current.note ?? '') === (w.note ?? '')) continue;
      }
      try {
        appended.push(
          ledger.append({
            key: w.key,
            person: 'household',
            instance: line.id,
            value: w.value,
            status: w.status,
            source: { method: 'export', ...(docId ? { docId } : {}) },
            ...(w.note ? { note: w.note } : {}),
          }),
        );
      } catch (err) {
        problems.push({
          ...(docId ? { docId } : {}),
          text: `${line.name}: ${(err as Error).message}`,
        });
      }
    }
  }
  // Values an export gave before and gives no more.
  for (const fact of ledger.view()) {
    if (!fact.instance || !fact.key.startsWith('securities.') || fact.source.method !== 'export') {
      continue;
    }
    if (seen.has(`${fact.key}|${fact.instance}`)) continue;
    const zero = GONE[fact.key as SecurityKey];
    if (zero === undefined || fact.value === zero) continue;
    appended.push(
      ledger.append({
        key: fact.key,
        person: 'household',
        instance: fact.instance,
        value: zero,
        status: 'extracted',
        source: { method: 'export', ...(fact.source.docId ? { docId: fact.source.docId } : {}) },
        note: GONE_NOTE,
      }),
    );
  }
  return { appended, problems };
}

export interface SecurityRow {
  id: string;
  name: string;
  isin?: string;
  currency?: string;
  quantity?: string;
  valueOriginal?: string;
  valueChf?: number;
  incomeChf?: number;
  swissChf?: number;
  foreignChf?: number;
  /** Something on the row was read from a document and waits for the user's OK. */
  needsOk: boolean;
  /** The CHF value is the broker's, not the official price yet. */
  estimate: boolean;
}

export interface SecuritiesView {
  rows: SecurityRow[];
  totals: {
    valueChf: number;
    incomeChf: number;
    swissChf: number;
    foreignChf: number;
    /** Some row has a quantity or income without its CHF amount. */
    incomplete: boolean;
  };
  warnings: string[];
  exports: number;
}

const num = (f: Fact | undefined) => (typeof f?.value === 'number' ? f.value : undefined);
const str = (f: Fact | undefined) => (typeof f?.value === 'string' ? f.value : undefined);

/** The securities list as the ledger has it, with the export warnings in the UI language. */
export function securitiesView(
  ledger: Ledger,
  summary: SecuritiesSummary,
  lang: Lang,
  unreadable: readonly string[] = [],
): SecuritiesView | undefined {
  const ids = [...new Set(ledger.instances('securities.name').map((f) => f.instance!))];
  const rows: SecurityRow[] = [];
  const totals = { valueChf: 0, incomeChf: 0, swissChf: 0, foreignChf: 0, incomplete: false };
  for (const id of ids) {
    const get = (key: SecurityKey) => ledger.get(key, 'household', id);
    const facts = {
      name: get('securities.name'),
      isin: get('securities.isin'),
      currency: get('securities.currency'),
      quantity: get('securities.quantity'),
      valueOriginal: get('securities.value_original'),
      valueChf: get('securities.value_chf'),
      income: get('securities.income_gross_chf'),
      swiss: get('securities.withholding_swiss_chf'),
      foreign: get('securities.withholding_foreign_chf'),
    };
    const quantity = str(facts.quantity);
    const held = quantity !== undefined && quantity !== '0';
    const cash = [facts.income, facts.swiss, facts.foreign].some((f) => (num(f) ?? 0) !== 0);
    // Gone from every export (all zero): not a line of the list any more.
    if (!held && !cash) continue;
    const row: SecurityRow = {
      id,
      name: str(facts.name) ?? id,
      needsOk: Object.values(facts).some((f) => f?.status === 'extracted'),
      estimate: facts.valueChf?.status === 'estimate',
    };
    const set = <K extends keyof SecurityRow>(k: K, v: SecurityRow[K] | undefined) => {
      if (v !== undefined) row[k] = v;
    };
    set('isin', str(facts.isin));
    set('currency', str(facts.currency));
    set('quantity', quantity);
    set('valueOriginal', str(facts.valueOriginal));
    set('valueChf', num(facts.valueChf));
    set('incomeChf', num(facts.income));
    set('swissChf', num(facts.swiss));
    set('foreignChf', num(facts.foreign));
    totals.valueChf += row.valueChf ?? 0;
    totals.incomeChf += row.incomeChf ?? 0;
    totals.swissChf += row.swissChf ?? 0;
    totals.foreignChf += row.foreignChf ?? 0;
    if ((held && row.valueChf === undefined) || row.incomeChf === undefined) {
      totals.incomplete = true;
    }
    rows.push(row);
  }
  const colon = lang === 'fr' ? '\u00a0: ' : ': ';
  const warnings = [
    ...summary.exports.flatMap((e) => e.warnings.map((w) => `${e.filename}${colon}${w[lang]}`)),
    ...unreadable.map((file) => `${file}${colon}${NOT_READ[lang]}`),
  ];
  if (!rows.length && !warnings.length && !summary.exports.length) return undefined;
  return { rows, totals, warnings, exports: summary.exports.length };
}

/** One line for get_status and list_documents, in English for Claude. */
export function securitiesStatusText(view: SecuritiesView | undefined): string | undefined {
  if (!view) return undefined;
  const held = view.rows.filter((r) => r.quantity && r.quantity !== '0').length;
  const chf = (c: number) => `CHF ${francs(c).toLocaleString('en-US')}`;
  // Positions can also come from bank e-tax statements read from their barcode (verified values).
  const broker = view.rows.some((r) => r.estimate);
  const parts = [
    `${held} position${held === 1 ? '' : 's'} from ${view.exports ? `${view.exports} broker export${view.exports === 1 ? '' : 's'}` : 'bank e-tax statements'}`,
    broker
      ? `value about ${chf(view.totals.valueChf)} at the broker's prices (estimate until the official price list)`
      : `value ${chf(view.totals.valueChf)}`,
    `gross income ${chf(view.totals.incomeChf)}`,
  ];
  if (view.totals.incomplete) parts.push('some CHF amounts missing (no rate in the export)');
  if (view.warnings.length) {
    parts.push(`${view.warnings.length} warning${view.warnings.length === 1 ? '' : 's'} to check`);
  }
  if (view.rows.some((r) => r.needsOk)) parts.push('the user confirms the values in the dashboard');
  return `Securities (état des titres): ${parts.join('; ')}.`;
}

/** Whole francs from centimes, halves away from zero, in integer arithmetic. */
export function francs(centimes: number): number {
  const rest = centimes % 100;
  const whole = (centimes - rest) / 100;
  return Math.abs(rest) >= 50 ? whole + Math.sign(centimes) : whole;
}
