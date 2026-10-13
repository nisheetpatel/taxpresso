// The securities list (état des titres) for a synthetic household, the Duponts of Vernier: a
// broker export, two bank accounts, a bank tax statement, crypto, life insurance, a loan, cash and
// a debt. Every amount is invented. Tax year 2025 exercises the official 2025 lists (exchange
// rates, foreign tax); 2026 shows that a year without them fails closed.
import { Ledger, type AppendInput, type VaultDocument } from '@taxpresso/ledger';
import { describe, expect, it } from 'vitest';
import { etatDesTitres, KEYS_2026, type EtatDesTitres } from '../src/index.js';

const doc = (
  id: string,
  kind: VaultDocument['kind'],
  person?: VaultDocument['person'],
  issuer?: string,
): VaultDocument => ({
  id,
  sha256: id.padEnd(64, '0'),
  filename: `${id}.pdf`,
  path: `documents/${id}.pdf`,
  bytes: 1000,
  addedAt: '2026-01-20T10:00:00.000Z',
  kind,
  ...(person ? { person } : {}),
  ...(issuer ? { issuer } : {}),
  parse: { method: 'claude', ok: true, warnings: [] },
});

type Value = AppendInput['value'];
interface Opts {
  year?: number;
  people?: string[];
  /** Extra or replacing facts: [key, instance, value, status?]. */
  facts?: [string, string, Value, AppendInput['status']?][];
  documents?: VaultDocument[];
}

const BASE: [string, string, Value, AppendInput['status']?][] = [
  // Broker export (Interactive Brokers), Jean's: a Swiss and a US share.
  ['securities.name', 'CHTXPRS00026', 'Taxpresso Swiss AG'],
  ['securities.isin', 'CHTXPRS00026', 'CHTXPRS00026'],
  ['securities.country', 'CHTXPRS00026', 'CH'],
  ['securities.quantity', 'CHTXPRS00026', '20'],
  ['securities.value_chf', 'CHTXPRS00026', 905_00, 'estimate'],
  ['securities.value_official_chf', 'CHTXPRS00026', 910_00, 'stated'],
  ['securities.income_gross_chf', 'CHTXPRS00026', 300_00],
  ['securities.withholding_swiss_chf', 'CHTXPRS00026', 105_00],
  ['securities.income_kind', 'CHTXPRS00026', 'dividend'],
  ['securities.name', 'USTXPRS00017', 'Espresso Corp'],
  ['securities.isin', 'USTXPRS00017', 'USTXPRS00017'],
  ['securities.country', 'USTXPRS00017', 'US'],
  ['securities.quantity', 'USTXPRS00017', '10'],
  ['securities.value_chf', 'USTXPRS00017', 1004_00, 'estimate'],
  ['securities.income_gross_chf', 'USTXPRS00017', 88_10],
  ['securities.withholding_swiss_chf', 'USTXPRS00017', 0],
  ['securities.withholding_foreign_chf', 'USTXPRS00017', 13_22],
  ['securities.income_kind', 'USTXPRS00017', 'dividend'],
  // A Swiss account held jointly.
  ['bank.account_number', 'd_bank', 'CH00 0000 1234 5678 9012 3'],
  ['bank.balance', 'd_bank', 25_000_00],
  ['bank.interest_gross', 'd_bank', 250_00],
  ['bank.withholding_swiss', 'd_bank', 87_50],
  ['bank.fees', 'd_bank', 60_00],
  // Marie's euro account abroad.
  ['bank.currency', 'd_eur', 'EUR'],
  ['bank.balance_in_currency', 'd_eur', "10'000.00"],
  ['bank.abroad', 'd_eur', true],
  // A bank's tax statement for Jean's deposit.
  ['tax_statement.deposit_number', 'd_stmt', '00-123.456.789'],
  ['tax_statement.income_subject_ia', 'd_stmt', 1000_00],
  ['tax_statement.income_not_subject_ia', 'd_stmt', 400_00],
  ['tax_statement.taxable_value', 'd_stmt', 50_000_00],
  ['tax_statement.withholding_swiss', 'd_stmt', 350_00],
  ['tax_statement.foreign_tax_credit', 'd_stmt', 60_00],
  ['tax_statement.fees', 'd_stmt', 120_00],
  ['crypto.value_chf', 'd_crypto', 3_210_55],
  ['life_insurance.surrender_value', 'd_life', 12_000_00],
  ['life_insurance.premiums', 'd_life', 2_400_00],
  ['debt.balance', 'd_debt', 15_000_00],
  ['debt.interest', 'd_debt', 450_00],
  // What Jean told Claude: cash at home and a loan to his brother.
  ['wealth.kind', 'cash', 'valuables'],
  ['wealth.name', 'cash', 'Cash at home'],
  ['wealth.owner', 'cash', 'p1'],
  ['wealth.value_chf', 'cash', 2_500_00],
  ['wealth.kind', 'loan-marc', 'loan_given'],
  ['wealth.name', 'loan-marc', 'Loan to Marc Dupont'],
  ['wealth.owner', 'loan-marc', 'p1'],
  ['wealth.value_chf', 'loan-marc', 5_000_00],
  ['wealth.income_chf', 'loan-marc', 100_00],
];

const DOCS = [
  doc('d_ibkr', 'broker_export', 'p1', 'Interactive Brokers'),
  doc('d_bank', 'bank_attestation', 'household', 'Banque Cantonale Synthétique'),
  doc('d_eur', 'bank_attestation', 'p2', 'Banca Esempio'),
  doc('d_stmt', 'ech0196_statement', 'p1', 'Banque Privée Exemple'),
  doc('d_crypto', 'crypto_statement', 'p1', 'Exchange Exemple'),
  doc('d_life', 'life_insurance_attestation', 'p2', 'Assurance Exemple'),
  doc('d_debt', 'debt_interest', 'household', 'Crédit Exemple'),
];

function build(opts: Opts = {}): EtatDesTitres {
  const year = opts.year ?? 2025;
  const ledger = new Ledger(year, KEYS_2026);
  const all = [...BASE, ...(opts.facts ?? [])];
  for (const [key, instance, value, status] of all) {
    const isSecurity = key.startsWith('securities.');
    ledger.append({
      key,
      person: 'household',
      instance,
      value,
      status: status ?? (key.startsWith('wealth.') ? 'stated' : 'extracted'),
      source: isSecurity
        ? { method: 'export', docId: 'd_ibkr' }
        : key.startsWith('wealth.')
          ? { method: 'user', via: 'chat' }
          : { method: 'claude', docId: instance, page: 1 },
    });
  }
  return etatDesTitres({
    taxYear: year,
    people: opts.people ?? ['p1', 'p2'],
    facts: ledger.view(),
    documents: opts.documents ?? DOCS,
  });
}

const line = (e: EtatDesTitres, id: string) => e.lines.find((l) => l.id === id)!;
const item = (e: EtatDesTitres, code: string, part: string, person: string) =>
  e.items.find((i) => i.code === code && i.part === part && i.person === person);

describe('état des titres, tax year 2025', () => {
  const e = build();

  it('lists accounts, securities and tax statements in the form’s order (F2, F3, F4)', () => {
    expect(e.lines.map((l) => [l.section, l.id])).toEqual([
      ['accounts', 'd_eur'],
      ['accounts', 'd_bank'],
      ['accounts', 'd_crypto'],
      ['securities', 'USTXPRS00017'],
      ['securities', 'loan-marc'],
      ['securities', 'CHTXPRS00026'],
      ['statements', 'd_stmt'],
    ]);
  });

  it('writes each line in whole francs, with the owner the form asks for', () => {
    expect(line(e, 'd_bank')).toMatchObject({
      owner: 'joint',
      reference: '67890123',
      columns: {
        subjectIa: 250_00,
        notSubjectIa: 0,
        taxableValue: 25_000_00,
        fees: 60_00,
        savingsInterest: 250_00,
      },
      withholdingSwiss: 87_50,
      state: 'needs_ok',
      complete: true,
    });
    // EUR 10'000 on 31 December 2025 at 0.930500.
    expect(line(e, 'd_eur')).toMatchObject({
      owner: 'p2',
      currency: 'EUR',
      columns: { taxableValue: 9_305_00, notSubjectIa: 0 },
    });
    expect(line(e, 'd_crypto').columns.taxableValue).toBe(3_211_00);
    expect(line(e, 'd_stmt')).toMatchObject({ reference: '3456789', owner: 'p1' });
  });

  it('takes the official value over the broker’s estimate', () => {
    expect(line(e, 'CHTXPRS00026')).toMatchObject({
      valueBasis: 'official',
      columns: { subjectIa: 300_00, taxableValue: 910_00 },
      owner: 'p1',
    });
    expect(line(e, 'USTXPRS00017')).toMatchObject({ valueBasis: 'broker', state: 'needs_ok' });
  });

  it('claims 35 % of the income subject to IA', () => {
    // 250 + 300 + 1'000 = 1'550; 35 % = 542.50.
    expect(e.totals.subjectIa).toBe(1_550_00);
    expect(e.ia).toMatchObject({ subject: 1_550_00, claim: 542_50, complete: true });
  });

  it('deducts the foreign tax from the income when it totals CHF 100 or less', () => {
    // US: 15 % of 88.10 = 13.22, plus 60.00 from the statement: 73.22, not over 100.
    expect(e.ies).toMatchObject({
      nonRecoverable: 73_22,
      claimable: false,
      requested: 0,
      incomeReduction: 73_22,
      complete: true,
    });
    expect(line(e, 'USTXPRS00017').columns.notSubjectIa).toBe(75_00); // 88.10 - 13.22
    expect(line(e, 'd_stmt').columns.notSubjectIa).toBe(340_00);
    expect(e.items.some((i) => i.rubric === 'ies')).toBe(false);
  });

  it('adds up the totals of F1', () => {
    expect(e.totals).toEqual({
      subjectIa: 1_550_00,
      notSubjectIa: 75_00 + 100_00 + 340_00,
      taxableValue: 9_305_00 + 25_000_00 + 3_211_00 + 1_004_00 + 5_000_00 + 910_00 + 50_000_00,
      fees: 180_00,
      savingsInterest: 250_00,
    });
    expect(e.subtotals.accounts.taxableValue).toBe(37_516_00);
  });

  it('gives the engine its items by rubric code and person', () => {
    expect(item(e, '14.00', 'income', 'p1')?.centimes).toBe(
      100_00 + 75_00 + 300_00 + 1_000_00 + 340_00,
    );
    expect(item(e, '14.00', 'income', 'household')?.centimes).toBe(250_00);
    expect(item(e, '14.00', 'wealth', 'p2')?.centimes).toBe(9_305_00);
    expect(item(e, '56.20', 'deduction', 'household')?.centimes).toBe(60_00);
    expect(item(e, '56.30', 'deduction', 'household')?.centimes).toBe(250_00);
    expect(item(e, 'F1.IA', 'credit', 'household')).toMatchObject({
      centimes: 542_50,
      taxes: ['icc'],
      estimate: true,
    });
    expect(item(e, '16.40', 'wealth', 'p1')?.centimes).toBe(2_500_00);
    expect(item(e, '16.70', 'wealth', 'p2')?.centimes).toBe(12_000_00);
    expect(item(e, '52.11', 'deduction', 'p2')?.centimes).toBe(2_400_00);
    expect(item(e, '55.10', 'wealth_deduction', 'household')?.centimes).toBe(15_000_00);
    expect(item(e, '55.10', 'deduction', 'household')?.centimes).toBe(450_00);
    for (const i of e.items) {
      expect(Number.isSafeInteger(i.centimes), i.code).toBe(true);
      expect(i.source).toMatch(/ge-2025-declaration-specimen p\. \d+/);
    }
    // The sum over people is the form's total.
    const income = e.items.filter((i) => i.rubric === 'income').reduce((s, i) => s + i.centimes, 0);
    expect(income).toBe(e.totals.subjectIa + e.totals.notSubjectIa);
  });

  it('is complete, with values still waiting for the user’s OK', () => {
    expect(e.issues.filter((i) => i.severity === 'missing')).toEqual([]);
    expect(e.complete).toBe(true);
    expect(e.estimate).toBe(true);
  });
});

describe('foreign tax over CHF 100: credited through DA-1', () => {
  it('requests the non-recoverable part and shows the rest as reclaimable abroad', () => {
    const e = build({
      facts: [
        ['securities.income_gross_chf', 'USTXPRS00017', 1000_00],
        ['securities.withholding_foreign_chf', 'USTXPRS00017', 300_00],
      ],
    });
    expect(line(e, 'USTXPRS00017').foreign).toMatchObject({
      withheld: 300_00,
      rateBp: 1500,
      nonRecoverable: 150_00,
      recoverableAbroad: 150_00,
      source: 'ch-2025-oiis-dff-annexe p. 5 and note B29 (p. 12)',
    });
    expect(e.ies).toMatchObject({
      nonRecoverable: 210_00,
      recoverableAbroad: 150_00,
      claimable: true,
      requested: 210_00,
      incomeReduction: 0,
    });
    // Declared gross (OIIS art. 3 al. 2).
    expect(line(e, 'USTXPRS00017').columns.notSubjectIa).toBe(1000_00);
    expect(item(e, 'F1.IES', 'credit', 'household')?.centimes).toBe(210_00);
  });

  it('fails closed for a country or kind of income the list doesn’t give', () => {
    const e = build({
      facts: [
        ['securities.country', 'USTXPRS00017', 'XX'],
        ['securities.withholding_foreign_chf', 'USTXPRS00017', 13_22],
      ],
    });
    expect(line(e, 'USTXPRS00017').foreign?.problem).toBe('no_country');
    expect(e.ies.complete).toBe(false);
    // 60.00 known so far: not yet over 100, so not decided either way.
    expect(e.ies.claimable).toBeUndefined();
    expect(e.ies.incomeReduction).toBe(0);
    expect(e.issues.map((i) => i.code)).toContain('foreign_rate_missing');
    const mixed = build({ facts: [['securities.income_kind', 'USTXPRS00017', 'mixed']] });
    expect(line(mixed, 'USTXPRS00017').foreign?.problem).toBe('kind_unknown');
    expect(mixed.complete).toBe(false);
  });
});

describe('état des titres, tax year 2026', () => {
  const e = build({ year: 2026 });

  it('fails closed without the official 2026 rates and foreign tax list', () => {
    expect(line(e, 'd_eur')).toMatchObject({ complete: false, columns: { taxableValue: 0 } });
    expect(line(e, 'USTXPRS00017').foreign?.problem).toBe('no_list');
    expect(e.issues.map((i) => i.code)).toEqual(
      expect.arrayContaining(['rate_missing', 'foreign_list_missing']),
    );
    expect(e.complete).toBe(false);
    expect(item(e, '14.00', 'wealth', 'p2')).toMatchObject({ complete: false });
    // The IA doesn't depend on them.
    expect(e.ia).toMatchObject({ claim: 542_50, complete: true });
  });
});

describe('what is missing or needs a look', () => {
  it('asks for the official value or the income when a broker export lacks them', () => {
    const e = build({
      facts: [
        ['securities.name', 'NLTXPRS00066', 'Ristretto NV'],
        ['securities.quantity', 'NLTXPRS00066', '12'],
      ],
    });
    expect(line(e, 'NLTXPRS00066')).toMatchObject({
      complete: false,
      columns: { taxableValue: 0 },
    });
    expect(e.issues.filter((i) => i.lineId === 'NLTXPRS00066').map((i) => i.code)).toEqual([
      'value_missing',
      'income_missing',
    ]);
  });

  it('asks whose a line is in a couple, never in a single household', () => {
    const docs = DOCS.map((d) => (d.id === 'd_ibkr' ? { ...d, person: undefined } : d));
    const couple = build({ documents: docs });
    expect(couple.issues.filter((i) => i.code === 'owner_missing').map((i) => i.lineId)).toEqual([
      'CHTXPRS00026',
      'USTXPRS00017',
    ]);
    expect(item(couple, '14.00', 'income', 'household')?.centimes).toBeGreaterThan(250_00);
    const single = build({ documents: docs, people: ['p1'] });
    expect(single.issues.some((i) => i.code === 'owner_missing')).toBe(false);
    expect(line(single, 'd_bank').owner).toBe('p1');
    // What the user said wins over the document.
    const said = build({ facts: [['securities.owner', 'USTXPRS00017', 'joint', 'stated']] });
    expect(line(said, 'USTXPRS00017').owner).toBe('joint');
  });

  it('holds the IA back when a Swiss account’s withholding tax is not given', () => {
    const e = build({
      documents: [...DOCS, doc('d_post', 'bank_attestation', 'p1', 'Poste Exemple')],
      facts: [
        ['bank.balance', 'd_post', 4_000_00],
        ['bank.interest_gross', 'd_post', 20_00],
      ],
    });
    expect(e.issues.find((i) => i.lineId === 'd_post')?.code).toBe('ia_missing');
    expect(e.ia.complete).toBe(false);
    expect(item(e, 'F1.IA', 'credit', 'household')?.complete).toBe(false);
  });

  it('shows a document not read yet as a line to complete', () => {
    const e = build({ documents: [...DOCS, doc('d_new', 'ech0196_statement', 'p2')] });
    expect(line(e, 'd_new')).toMatchObject({
      section: 'statements',
      complete: false,
      name: 'd_new.pdf',
    });
    expect(e.issues.find((i) => i.lineId === 'd_new')?.code).toBe('not_read');
  });

  it('flags withholding tax that is not 35 % and Swiss income without it', () => {
    const e = build({
      facts: [
        ['securities.withholding_swiss_chf', 'CHTXPRS00026', 50_00],
        ['securities.withholding_swiss_chf', 'USTXPRS00017', 0],
      ],
    });
    expect(e.issues.find((i) => i.lineId === 'CHTXPRS00026')?.code).toBe('ia_not_35');
    const none = build({ facts: [['securities.withholding_swiss_chf', 'CHTXPRS00026', 0]] });
    expect(none.issues.find((i) => i.lineId === 'CHTXPRS00026')?.code).toBe(
      'swiss_income_without_ia',
    );
    expect(line(none, 'CHTXPRS00026').columns).toMatchObject({
      subjectIa: 0,
      notSubjectIa: 300_00,
    });
  });

  it('holds the IA back when nothing says what tax was withheld on Swiss income', () => {
    const e = build({
      facts: [
        ['securities.name', 'CHTXPRS00099', 'Lungo Holding SA'],
        ['securities.country', 'CHTXPRS00099', 'CH'],
        ['securities.quantity', 'CHTXPRS00099', '5'],
        ['securities.value_chf', 'CHTXPRS00099', 500_00, 'estimate'],
        ['securities.income_gross_chf', 'CHTXPRS00099', 40_00],
      ],
    });
    expect(e.issues.find((i) => i.lineId === 'CHTXPRS00099')?.code).toBe('ia_missing');
    expect(line(e, 'CHTXPRS00099').complete).toBe(false);
    expect(e.ia.complete).toBe(false);
  });

  it('drops a security sold before the year end with no income, and items set back to zero', () => {
    const e = build({
      facts: [
        ['securities.quantity', 'USTXPRS00017', '0'],
        ['securities.income_gross_chf', 'USTXPRS00017', 0],
        ['securities.withholding_foreign_chf', 'USTXPRS00017', 0],
        ['wealth.value_chf', 'cash', 0],
      ],
    });
    expect(e.lines.some((l) => l.id === 'USTXPRS00017')).toBe(false);
    expect(e.other.some((o) => o.id === 'cash')).toBe(false);
  });
});

describe('a bank e-tax statement read from its barcode', () => {
  // The barcode gives the statement's totals and also its positions: the totals are its one line
  // (F4), so its securities must not come back as F3 lines, and its loans are debts.
  function withStatementDetail(): EtatDesTitres {
    const ledger = new Ledger(2025, KEYS_2026);
    const barcode = { method: 'barcode' as const, docId: 'd_stmt' };
    const put = (key: string, instance: string, value: Value) =>
      ledger.append({
        key,
        person: 'household',
        instance,
        value,
        status: 'verified',
        source: barcode,
      });
    put('tax_statement.taxable_value', 'd_stmt', 50_000_00);
    put('tax_statement.income_subject_ia', 'd_stmt', 1000_00);
    put('tax_statement.income_not_subject_ia', 'd_stmt', 400_00);
    put('tax_statement.withholding_swiss', 'd_stmt', 350_00);
    put('securities.name', 'd_stmt.CHTXPRS00055', 'Ristretto Fonds');
    put('securities.isin', 'd_stmt.CHTXPRS00055', 'CHTXPRS00055');
    put('securities.quantity', 'd_stmt.CHTXPRS00055', '10');
    put('securities.value_chf', 'd_stmt.CHTXPRS00055', 20_000_00);
    put('liabilities.name', 'd_stmt.L1', 'Prêt hypothécaire exemple');
    put('liabilities.balance_chf', 'd_stmt.L1', 300_000_00);
    put('liabilities.interest_chf', 'd_stmt.L1', 4_500_00);
    return etatDesTitres({
      taxYear: 2025,
      people: ['p1', 'p2'],
      facts: ledger.view(),
      documents: [doc('d_stmt', 'ech0196_statement', 'p1', 'Banque Privée Exemple')],
    });
  }

  it('counts the statement once, as its total, and its loans as debts', () => {
    const e = withStatementDetail();
    expect(e.lines.map((l) => [l.section, l.id])).toEqual([['statements', 'd_stmt']]);
    expect(e.totals).toMatchObject({ taxableValue: 50_000_00, subjectIa: 1000_00 });
    expect(e.other).toEqual([
      expect.objectContaining({
        rubric: 'debts',
        id: 'd_stmt.L1',
        docId: 'd_stmt',
        value: 300_000_00,
        flow: 4_500_00,
        owner: 'p1',
        complete: true,
      }),
    ]);
  });
});
