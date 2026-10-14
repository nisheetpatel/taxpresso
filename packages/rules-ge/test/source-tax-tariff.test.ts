// The barème a Geneva employer takes source tax at, worked out from the household (never asked):
// ge-na-law-risp art. 1 al. 1 and the directives of each year, ch. 5 (ge-2025-source-directives
// p. 24 to 30, ge-2026-source-directives p. 25 to 31). Synthetic households only.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  deriveTariffs,
  normalizeTariff,
  SOURCE_TAX_FACTS,
  SOURCE_TAX_SUBJECT,
  tariffSources,
  TariffYearError,
  type TariffHousehold,
  TOU_2025_GROSS_THRESHOLD,
  TOU_2025_OTHER_INCOME_THRESHOLD,
  TOU_2025_WEALTH_FREE,
  touThresholds,
} from '../src/index.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const lock = JSON.parse(readFileSync(path.join(root, 'docs/sources/lock.json'), 'utf8')) as Record<
  string,
  { status: string }
>;

const SALARY = ['salary'];
const household = (over: Partial<TariffHousehold>): TariffHousehold => ({
  taxYear: 2026,
  couple: false,
  children: 0,
  people: [{ person: 'p1', atSource: true, incomeSources: SALARY }],
  ...over,
});
const code = (h: TariffHousehold, person: 'p1' | 'p2' = 'p1') =>
  deriveTariffs(h).find((t) => t.person === person);

describe('the barème of a single person', () => {
  it('A0 alone without a child in the household (ch. 5.2.1.1)', () => {
    const t = code(household({}))!;
    expect(t).toMatchObject({ code: 'A0N', why: 'single', assumptions: [] });
    expect(t.sources.join(' ')).toMatch(/ge-2026-source-directives p\. 25 \(ch\. 5\.2\.1\.1\)/);
    // Geneva levies no church tax at source: N (ch. 6.10).
    expect(t.sources.join(' ')).toMatch(/ge-2026-source-directives p\. 42 \(ch\. 6\.10\)/);
    expect(code(household({ children: 2, custody: 'elsewhere' }))?.code).toBe('A0N');
  });

  it('H with the children in main custody, A0 in alternating custody (ch. 5.2.1.4, 5.5.2)', () => {
    const parent = household({
      children: 2,
      custody: 'with_household',
      livesWithOtherParent: false,
    });
    expect(code(parent)).toMatchObject({
      code: 'H2N',
      why: 'single_parent',
      assumptions: ['children_under_25'],
    });
    expect(code(household({ children: 2, custody: 'shared' }))).toMatchObject({
      code: 'A0N',
      why: 'shared_custody',
    });
  });

  it('A0 when the parents live together unmarried, and asks it first (ch. 5.5.1)', () => {
    expect(
      code(household({ children: 1, custody: 'with_household', livesWithOtherParent: true })),
    ).toMatchObject({ code: 'A0N', why: 'cohabiting_parents' });
    const unknown = code(household({ children: 1, custody: 'with_household' }))!;
    expect(unknown.code).toBeUndefined();
    expect(unknown.open).toBe('answers_missing');
  });

  it('counts 5 children at most (ch. 5.5.5)', () => {
    const t = code(
      household({ children: 7, custody: 'with_household', livesWithOtherParent: false }),
    )!;
    expect(t.code).toBe('H5N');
    expect(t.assumptions).toEqual(['children_under_25', 'five_children_most']);
    expect(t.sources.join(' ')).toMatch(/p\. 31 \(ch\. 5\.5\.5\)/);
  });
});

describe('the barème of a married person', () => {
  const couple = (spouse: string[] | undefined, over: Partial<TariffHousehold> = {}) =>
    household({
      couple: true,
      people: [
        { person: 'p1', atSource: true, incomeSources: SALARY },
        {
          person: 'p2',
          atSource: spouse?.includes('salary') === true,
          ...(spouse ? { incomeSources: spouse } : {}),
        },
      ],
      ...over,
    });

  it('C when the spouse has a salary or benefits, B without income (ch. 5.2.1.2, 5.2.1.3)', () => {
    expect(code(couple(['salary']))?.code).toBe('C0N');
    // Benefits replacing pay count as income: one salaried, the other on unemployment.
    expect(code(couple(['replacement_income']))).toMatchObject({
      code: 'C0N',
      why: 'spouse_income',
    });
    expect(code(couple([]))).toMatchObject({ code: 'B0N', why: 'spouse_no_income' });
    // Alimony received is neither activity nor benefits.
    expect(code(couple(['alimony']))?.code).toBe('B0N');
    // Both spouses at C, each with the household's children.
    const both = couple(['salary'], { children: 1, custody: 'with_household' });
    expect(code(both, 'p1')?.code).toBe('C1N');
    expect(code(both, 'p2')?.code).toBe('C1N');
  });

  it('fails closed where the directives depend on what Taxpresso does not ask', () => {
    // A pension only: a partial invalidity pension replaces pay (RISP art. 3), an old-age one doesn't.
    expect(code(couple(['pension']))).toMatchObject({ open: 'spouse_pension' });
    expect(code(couple(['pension']))?.code).toBeUndefined();
    expect(code(couple(undefined))).toMatchObject({ open: 'answers_missing' });
    expect(code(couple(['salary'], { children: 1, custody: 'shared' }))).toMatchObject({
      open: 'couple_shared_custody',
    });
    expect(code(household({ children: undefined }))).toMatchObject({ open: 'answers_missing' });
  });

  it('says that benefits an insurance pays itself are at barème G (ch. 5.2.2.5)', () => {
    const onBenefits = household({
      people: [{ person: 'p1', atSource: true, incomeSources: ['replacement_income'] }],
    });
    const t = code(onBenefits)!;
    expect(t.benefitsAtG).toBe(true);
    expect(t.sources.join(' ')).toMatch(/p\. 28 \(ch\. 5\.2\.2\.5\)/);
  });
});

describe('every year its own directives', () => {
  it('2025 cites the 2025 directives, a year without them fails', () => {
    const t = code(household({ taxYear: 2025 }))!;
    expect(t.code).toBe('A0N');
    expect(t.sources.join(' ')).toMatch(/ge-2025-source-directives p\. 24 \(ch\. 5\.2\.1\.1\)/);
    expect(t.sources.join(' ')).not.toMatch(/2026/);
    expect(() => deriveTariffs(household({ taxYear: 2027 }))).toThrow(TariffYearError);
  });

  it('gives only codes of the official tables of the year', () => {
    for (const taxYear of [2025, 2026]) {
      for (const couple of [false, true]) {
        for (const children of [0, 1, 3, 6]) {
          for (const custody of ['with_household', 'shared', 'elsewhere'] as const) {
            for (const spouse of [['salary'], [], ['replacement_income']]) {
              const h = household({
                taxYear,
                couple,
                children,
                custody,
                livesWithOtherParent: false,
                people: [
                  { person: 'p1', atSource: true, incomeSources: SALARY },
                  ...(couple
                    ? [{ person: 'p2' as const, atSource: false, incomeSources: spouse }]
                    : []),
                ],
              });
              for (const t of deriveTariffs(h)) {
                if (t.code) expect(normalizeTariff(taxYear, t.code)).toBe(t.code);
              }
            }
          }
        }
      }
    }
  });

  it('cites documents that are in the library, with a page or an article', () => {
    const ID = /\b(?:ge|ch|std)-[A-Za-z0-9]+(?:-[A-Za-z0-9]+)+/g;
    const pages = (y: number): string[] => Object.values(tariffSources(y));
    const all: string[] = [
      ...pages(2025),
      ...pages(2026),
      ...Object.values(SOURCE_TAX_FACTS),
      ...Object.values(SOURCE_TAX_SUBJECT).flatMap((s) => Object.values(s)),
      TOU_2025_GROSS_THRESHOLD.source,
      TOU_2025_OTHER_INCOME_THRESHOLD.source,
      TOU_2025_WEALTH_FREE.source,
    ];
    for (const source of all) {
      const ids = source.match(ID) ?? [];
      expect(ids.length, source).toBeGreaterThan(0);
      for (const id of ids) {
        expect(lock[id]?.status, `${id} in "${source}"`).toBe('ok');
        const after = source.slice(source.indexOf(id) + id.length);
        if (!id.endsWith('-ascii'))
          expect(after, `${id} in "${source}"`).toMatch(/^ (p\. \d|art\. \d)/);
      }
    }
  });
});

describe('the compulsory-TOU amounts of each year', () => {
  it('2025 and 2026 from their own directives (ch. 8.2.1)', () => {
    expect(touThresholds(2025).wealthFree.value).toEqual({
      single: 8_763_200,
      coupleOrSingleParent: 17_526_400,
      perDependant: 4_381_600,
    });
    expect(touThresholds(2026).wealthFree.value).toEqual({
      single: 8_787_200,
      coupleOrSingleParent: 17_574_300,
      perDependant: 4_393_600,
    });
    expect(touThresholds(2025).gross.value).toBe(12_000_000);
    expect(touThresholds(2025).otherIncome.value).toBe(300_000);
    expect(() => touThresholds(2027)).toThrow(/2027/);
  });
});
