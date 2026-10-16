// Interest on savings capital inside a bank's e-tax statement, worked out by hand for tax years 2025
// and 2026 (fake person, fake figures). Claire Relevé, single, lives and works in Carouge; her bank
// sends an e-tax statement (eCH-0196, read from its barcode) listing a savings account that earned
// CHF 300 (subject to the withholding tax) and a Swiss equity fund that paid CHF 400.
//
// The rule, from the documents: every bank account's interest is interest on savings capital
// (ge-2025-guide-declaration-pp p. 41: "Tous les intérêts de comptes bancaires (à l'exception des
// fonds de rénovation) sont déductibles à titre d'intérêts échus de capitaux d'épargne"; p. 28: "les
// rendements de comptes d'épargne ou de dépôt ... (voir Titres suisses et étrangers et Relevés
// fiscaux)"), and the form gives each relevé fiscal a column for it (ge-2025-declaration-specimen
// p. 24, F4), carried to 56.30 (F1 p. 21, C3 p. 13). 56.30 adds to the life insurance premiums
// within 52.15 for the cantonal tax: single 2'345, doubled without pension fund or 3a (guide p. 28;
// ge-na-law-lipp art. 31 let. d). For the federal tax it adds to the insurance premiums within
// 52.00: single 1'800 with a pension fund (ch-2025- and ch-2026-ifd-instructions-personnes-
// physiques p. 8, chiffre 14: "les intérêts de capitaux d'épargne indiqués dans l'état des titres").
//
// By hand, both years (Geneva's 2025 values for 2026 too, until the 2026 guide):
// ICC: 11.10 90'000; 31.10 -6'210; 31.12 -5'390; 31.40 -7'000; 31.50 3 % x 78'400 = 2'352, at most
// 1'812 (guide p. 11, 19); 14.00 700 (400 + 300); 52.15 -300 (under 2'345); 52.21 -5'500 (under
// 17'122). Taxable 64'488 (64'788 before: no 52.15 for a statement). Scale (guide p. 47): 3'140.40
// at 48'309 + 16'179 x 13.20 % = 2'135.628 -> 2'135.65: base 5'276.05. Centimes 47.5 % 2'506.12375
// -> 2'506.10; reduction 12 % x 7'782.15 = 933.858 -> 933.85; home care 52.7605 -> 52.75; cantonal
// 6'901.05. Communal, Carouge (PP 27 %, CA 40 both years: ge-2025-communal-centimes-pdf,
// ge-2026-part-privilegiee-communique p. 12, ge-2026-communal-centimes-arca): privileged
// 1'424.5335 -> 1'424.55 x 40 % = 569.82 -> 569.80; the rest 3'851.50 x 40 % = 1'540.60.
// ICC 6'901.05 + 569.80 + 1'540.60 + 25 = 9'036.45 (9'104.15 before).
// IFD: 31.20 2'352 (3 % of the net salary, 2'000 to 4'000); 52.00: premiums 5'500 + savings 300 =
// 5'800, at most 1'800. Taxable 67'948, at 67'900 (single scale, 2025 and 2026 alike there): 612.00
// + 99 x 2.97 = 906.03 -> 906.00 (rounded down to 5 centimes).
import { Ledger, type VaultDocument } from '@taxpresso/ledger';
import { describe, expect, it } from 'vitest';
import { computeReturn, engineInputFromFacts, KEYS_2026 } from '../src/index.js';

const doc = (id: string, kind: VaultDocument['kind'], taxYear: number): VaultDocument => ({
  id,
  sha256: id,
  filename: `${id}.pdf`,
  path: `documents/${id}.pdf`,
  bytes: 1,
  addedAt: `${taxYear + 1}-01-10T00:00:00.000Z`,
  kind,
  person: kind === 'ech0196_statement' || kind === 'health_premiums' ? 'household' : 'p1',
  taxYear,
  parse: { method: 'claude', ok: true, warnings: [] },
});

/** Claire's ledger: answers, her salary certificate, 3a, premiums and the e-tax statement. */
function claire(taxYear: number, statement: 'barcode' | 'claude') {
  const l = new Ledger(taxYear, KEYS_2026);
  const user = { method: 'user' as const, via: 'chat' as const };
  const answer = (key: string, value: string | number | string[]) =>
    l.append({
      key,
      person: key.includes('income_sources') ? 'p1' : 'household',
      value,
      status: 'stated',
      source: user,
    });
  answer('profile.civil_status', 'single');
  answer('profile.commune', 'carouge');
  answer('profile.children_count', 0);
  answer('profile.income_sources', ['salary']);
  const read = (key: string, value: number, docId: string, person: 'p1' | 'household' = 'p1') =>
    l.append({
      key,
      person,
      instance: docId,
      value,
      status: 'stated',
      source: { method: 'claude', docId, page: 1 },
    });
  read('salary.gross', 90_000_00, 'd_cert');
  read('salary.social_contributions', 6_210_00, 'd_cert');
  read('salary.lpp_ordinary', 5_390_00, 'd_cert');
  read('pillar3a.paid', 7_000_00, 'd_3a');
  read('health.premiums', 5_500_00, 'd_health', 'household');
  const barcode = (key: string, instance: string, value: number) =>
    l.append({
      key,
      person: 'household',
      instance,
      value,
      status: 'verified',
      source: { method: 'barcode', docId: 'd_stmt' },
    });
  if (statement === 'barcode') {
    barcode('tax_statement.taxable_value', 'd_stmt', 60_000_00);
    barcode('tax_statement.income_subject_ia', 'd_stmt', 700_00);
    barcode('tax_statement.income_not_subject_ia', 'd_stmt', 0);
    barcode('tax_statement.withholding_swiss', 'd_stmt', 245_00);
    barcode('accounts.value_chf', 'CH0000000000000000301', 20_000_00);
    barcode('accounts.income_a_chf', 'CH0000000000000000301', 300_00);
    barcode('securities.value_chf', 'd_stmt.CHTXPRS00303', 40_000_00);
    barcode('securities.income_gross_chf', 'd_stmt.CHTXPRS00303', 400_00);
  } else {
    // The same statement read by Claude: its totals and the interest of its accounts.
    read('tax_statement.taxable_value', 60_000_00, 'd_stmt', 'household');
    read('tax_statement.income_subject_ia', 700_00, 'd_stmt', 'household');
    read('tax_statement.withholding_swiss', 245_00, 'd_stmt', 'household');
    read('tax_statement.savings_interest', 300_00, 'd_stmt', 'household');
  }
  return {
    facts: l.view(),
    documents: [
      doc('d_cert', 'salary_certificate', taxYear),
      doc('d_3a', 'pillar3a_attestation', taxYear),
      doc('d_health', 'health_premiums', taxYear),
      doc('d_stmt', 'ech0196_statement', taxYear),
    ],
  };
}

const at = (items: readonly { code: string; amount: number }[], code: string) =>
  items.filter((i) => i.code === code).map((i) => i.amount);

describe('interest on savings capital in an e-tax statement, by hand', () => {
  for (const taxYear of [2025, 2026]) {
    for (const statement of ['barcode', 'claude'] as const) {
      it(`${taxYear}, statement read ${statement === 'barcode' ? 'from its barcode' : 'by Claude'}`, () => {
        const { facts, documents } = claire(taxYear, statement);
        const { input, missing } = engineInputFromFacts(taxYear, facts, documents);
        expect(missing).toEqual([]);
        const r = computeReturn(input!);
        const icc = r.icc!;
        const ifd = r.ifd!;
        expect(at(icc.items, '14.00')).toEqual([700_00]);
        expect(at(icc.items, '52.15')).toEqual([-300_00]);
        expect(at(icc.items, '52.21')).toEqual([-5_500_00]);
        expect(icc.taxableIncome.amount).toBe(64_488_00);
        expect(icc.taxes.incomeBase.amount).toBe(5_276_05);
        expect(icc.taxes.incomeCantonal.amount).toBe(6_901_05);
        expect(icc.taxes.communalIncome.privileged.tax.amount).toBe(569_80);
        expect(icc.taxes.communalIncome.rest.map((s) => [s.commune, s.tax.amount])).toEqual([
          ['carouge', 1_540_60],
        ]);
        expect(icc.taxes.personalTax.amount).toBe(25_00);
        expect(icc.taxes.total.amount).toBe(9_036_45);
        expect(icc.credits.withholdingTax?.amount).toBe(245_00);
        // The federal tax: premiums and savings interest together, at most 1'800.
        expect(at(ifd.items, '52.00')).toEqual([-1_800_00]);
        expect(ifd.taxableIncome.amount).toBe(67_948_00);
        expect(ifd.tax.amount).toBe(906_00);
      });
    }
  }
});
