// Every constant of rules-ch cites a document of the sources library that was downloaded and
// checked (SPEC.md section 13, item 8b): each manifest id in a citation has status "ok" in
// docs/sources/lock.json, and a tax constant says where in the document (page, article, note or
// the part of a page). The citations written into the federal rules themselves are checked on
// the lines those rules give.
import { readFileSync } from 'node:fs';
import type { KeyRegistry } from '@taxpresso/ledger';
import { describe, expect, it } from 'vitest';
import {
  childDeduction,
  commuteBase,
  commuteCosts,
  FOREIGN_RESIDUAL_RATES,
  IA_DEPOSIT_INTEREST_EXEMPT,
  IA_RATE,
  IA_ROUNDING,
  IES_MINIMUM,
  IFD_2026_CHILD_TAX_REDUCTION,
  IFD_2026_DEDUCTIONS,
  IFD_2026_MINIMUM_COLLECTED,
  IFD_2026_SIDE_JOB,
  IFD_CAPITAL_FIFTH,
  IFD_OBJECTION,
  IFD_PROFESSIONAL_FLAT_RATE_BP,
  IFD_TAX_YEARS,
  ifdCapitalTax,
  ifdParamsFor,
  ifdTax,
  insurancePremiums,
  DOCUMENT_KEYS_WEALTH_2026,
  KEYS_ATTESTATIONS_2026,
  KEYS_CANTON_2026,
  KEYS_HOUSEHOLD_2026,
  KEYS_WEALTH_2026,
  KEYS_ECH0196_2026,
  KEYS_SALARY_CERTIFICATE_2026,
  KEYS_SECURITIES_2026,
  LPP_BUYIN_FACTS,
  OFFICIAL_RATES,
  PILLAR3A_2025,
  PILLAR3A_2026,
  PILLAR3A_2026_FACTS,
  PILLAR3A_CATCHUP_2026,
  PILLAR3A_CATCHUP_FACTS,
  pillar3a,
  Trace,
  type Cited,
  type RuleResult,
} from '../src/index.js';

const lock = JSON.parse(
  readFileSync(new URL('../../../docs/sources/lock.json', import.meta.url), 'utf8'),
) as Record<string, { status: string }>;

/** A manifest id: canton or ch, year or "na", then its name (std- for the standards). */
const ID = /\b(?:ge|ch|zh|std)-[A-Za-z0-9]+(?:-[A-Za-z0-9]+)+/g;
/** Where to look in the document, right after its id. */
const PLACE = /^ (p\. \d|pp?\. \d|art\. \d|§ \d|note|sheet [A-Z]|\()/;

function expectCited(source: string, what: string, place: boolean) {
  const ids = source.match(ID) ?? [];
  expect(ids.length, `${what}: "${source}"`).toBeGreaterThan(0);
  for (const id of ids) {
    expect(lock[id]?.status, `${what}: ${id} in "${source}"`).toBe('ok');
    if (!place) continue;
    const after = source.slice(source.indexOf(id) + id.length);
    expect(after, `${what}: ${id} without a page, article or note`).toMatch(PLACE);
  }
}

const sources = (r: RuleResult) => (r.deduction ? [...r.deduction.trace.sources] : []);

describe('citations of rules-ch', () => {
  it('every federal constant of each year', () => {
    for (const year of IFD_TAX_YEARS) {
      for (const [name, c] of Object.entries(ifdParamsFor(year)) as [string, Cited<unknown>][]) {
        expectCited(c.source, `IFD ${year} ${name}`, true);
      }
    }
    const more: [string, Cited<unknown>][] = [
      ['IFD_2026_CHILD_TAX_REDUCTION', IFD_2026_CHILD_TAX_REDUCTION],
      ['IFD_2026_MINIMUM_COLLECTED', IFD_2026_MINIMUM_COLLECTED],
      ['IFD_2026_SIDE_JOB', IFD_2026_SIDE_JOB],
      ['IFD_2026_DEDUCTIONS', IFD_2026_DEDUCTIONS],
      ['IFD_PROFESSIONAL_FLAT_RATE_BP', IFD_PROFESSIONAL_FLAT_RATE_BP],
      ['IFD_CAPITAL_FIFTH', IFD_CAPITAL_FIFTH],
    ];
    for (const [name, c] of more) expectCited(c.source, name, true);
  });

  it('pillar 3a and the pension fund', () => {
    for (const [name, c] of [
      ['PILLAR3A_2026', PILLAR3A_2026],
      ['PILLAR3A_2025', PILLAR3A_2025],
      ['PILLAR3A_CATCHUP_2026', PILLAR3A_CATCHUP_2026],
    ] as [string, Cited<unknown>][]) {
      expectCited(c.source, name, true);
    }
    const facts = { ...PILLAR3A_2026_FACTS, ...LPP_BUYIN_FACTS, ...PILLAR3A_CATCHUP_FACTS };
    for (const [name, source] of Object.entries(facts)) expectCited(source, name, true);
  });

  it('the deadline to object to a federal assessment', () => {
    expectCited(IFD_OBJECTION.days.source, 'IFD_OBJECTION.days', true);
    expectCited(IFD_OBJECTION.counting, 'IFD_OBJECTION.counting', true);
    expectCited(IFD_OBJECTION.to, 'IFD_OBJECTION.to', true);
  });

  it('withholding tax, the foreign tax credit and the exchange rates', () => {
    for (const [name, c] of [
      ['IA_RATE', IA_RATE],
      ['IA_ROUNDING', IA_ROUNDING],
      ['IA_DEPOSIT_INTEREST_EXEMPT', IA_DEPOSIT_INTEREST_EXEMPT],
      ['IES_MINIMUM', IES_MINIMUM],
    ] as [string, Cited<unknown>][]) {
      expectCited(c.source, name, true);
    }
    for (const [year, list] of Object.entries(FOREIGN_RESIDUAL_RATES)) {
      expectCited(list.source, `residual rates ${year}`, true);
      for (const [country, kinds] of Object.entries(list.countries)) {
        for (const [kind, rate] of Object.entries(kinds)) {
          expectCited(rate.source, `residual rate ${year} ${country} ${kind}`, true);
        }
      }
    }
    for (const [year, table] of Object.entries(OFFICIAL_RATES)) {
      expectCited(table.source, `exchange rates ${year}`, true);
    }
  });

  it('the shared ledger keys', () => {
    const keys: KeyRegistry = {
      ...KEYS_CANTON_2026,
      ...KEYS_HOUSEHOLD_2026,
      ...KEYS_ATTESTATIONS_2026,
      ...KEYS_WEALTH_2026,
      ...DOCUMENT_KEYS_WEALTH_2026,
      ...KEYS_SALARY_CERTIFICATE_2026,
      ...KEYS_SECURITIES_2026,
      ...KEYS_ECH0196_2026,
    };
    expect(keys['profile.canton']?.source).toMatch(/ch-na-law-lifd art\. 105/);
    for (const [key, def] of Object.entries(keys)) {
      if (def.source) expectCited(def.source, key, false);
    }
    for (const key of Object.keys(KEYS_SALARY_CERTIFICATE_2026)) {
      expect(keys[key]?.source, key).toBeDefined();
    }
  });

  it('the citations written into the federal rules', () => {
    for (const year of IFD_TAX_YEARS) {
      const F = ifdParamsFor(year);
      const lines = [
        ...sources(
          pillar3a(F, {
            paid: { value: 700_000 },
            catchUp: { value: 100_000 },
            hasFund: false,
            gross: 9_000_000,
            social: 500_000,
            self: 0,
            earnedFrom: [],
          }),
        ),
        ...sources(
          insurancePremiums(F, {
            premiums: 600_000,
            subsidy: 0,
            life: 0,
            couple: false,
            contributing: true,
            full: 0,
            shared: 1,
            inputs: [],
          }),
        ),
        ...sources(childDeduction(F, 1, 1, [])),
      ];
      const tr = new Trace();
      const way = commuteBase(F, { commuteMode: { by: 'bike' } }, tr)!;
      lines.push(...sources(commuteCosts(F, { commuteMode: { by: 'bike' } }, way, tr)));
      const taxable = new Trace().line(8_000_000, { en: '', fr: '' }, { en: '', fr: '' });
      const tax = ifdTax(F, taxable, 'parental', 2);
      for (const l of [tax.scaleIncome, tax.scaleTax, tax.childReduction, tax.tax]) {
        lines.push(...l.sources);
      }
      // The federal tax on pension capital (art. 38 LIFD).
      const capital = ifdCapitalTax(F, taxable, 'married', year);
      if ('unsupported' in capital) throw new Error('not computed');
      const c = capital.tax;
      for (const l of [c.scaleIncome, c.scaleTax, c.tax]) lines.push(...l.sources);
      expect(lines).toContain('ch-na-law-lifd art. 38 al. 1 and 2 (p. 32)');
      expect(lines).toContain('ch-2026-ifd-instructions-personnes-physiques p. 8');
      expect(lines).toContain('ch-na-circulaire-30-epoux-famille p. 11 and 32 (ch. 7, 14.4.1)');
      for (const source of lines) expectCited(source, `IFD ${year} rule`, true);
    }
  });
});
