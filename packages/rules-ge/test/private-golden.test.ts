// Golden cases kept outside the repository (SPEC.md section 13), run on a developer's computer
// only. No case is ever in the repository; CI never has the folder, so this file is skipped there.
//
//   TAXPRESSO_PRIVATE_GOLDEN=/path/to/folder pnpm vitest run packages/rules-ge/test/private-golden.test.ts
//
// Every *.json in the folder is one case. Amounts in centimes. Fields (all optional except the
// first four; a field left out is not checked):
//   id, taxYear (2025 or 2026), commune (slug, e.g. "geneve"),
//   household: { civilStatus, children, splitting ("none" | "full" | "partial"),
//                childrenShared?, ifdScale? ("single" | "married" | "parental") },
//   icc: { items: [{ code, person, amount }],   amounts as admitted, deductions negative
//          grossIncome (91.00), netIncome (before the social deductions 61.xx), totalIncome
//          (95.00 revenu net total, after them), taxableIncome (99.00), rateIncome,
//          wealth: { items, grossWealth, socialDeduction, taxableWealth },
//          taxes: { incomeBase, incomeCantonalCentimes, incomeReduction12 (sign ignored),
//                   incomeHomeCare, wealthBase, wealthCantonalCentimes, wealthHomeCare,
//                   wealthSupplementary, communalCentimesRate (45.49 -> 4549),
//                   communalIncome: { privileged: { base, tax }, domicile: { base, tax } },
//                   communalWealth: { privileged: { base, tax }, domicile: { base, tax } },
//                   personalTax, total } },
//   ifd: { items, grossIncome, netIncome, totalIncome (95.00), taxableIncome (99.00), tax },
//   input?: the engine input (EngineInput) from the raw figures: then the items the engine derives
//           are checked against icc.items and ifd.items too (stage 2).
//
// Stage 1 recomputes everything from the given items. A failure prints one line per figure that
// differs (expected, got, difference); it never prints the file.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  assess,
  computeReturn,
  type EngineInput,
  type IccSplitting,
  type ItemAmount,
  type ItemPerson,
  type Line,
} from '../src/index.js';
import { chf } from '../src/engine/calc.js';

const dir = process.env.TAXPRESSO_PRIVATE_GOLDEN;
const usable = (() => {
  try {
    return Boolean(dir) && statSync(dir!).isDirectory();
  } catch {
    return false;
  }
})();

interface Split {
  privileged?: { base?: number; tax?: number };
  domicile?: { base?: number; tax?: number };
}

interface GoldenCase {
  id?: string;
  taxYear: 2025 | 2026;
  commune: EngineInput['commune'];
  household: {
    civilStatus: string;
    children?: number;
    childrenShared?: number;
    splitting?: IccSplitting;
    ifdScale?: 'single' | 'married' | 'parental';
  };
  icc?: {
    items?: ItemAmount[];
    grossIncome?: number;
    totalIncome?: number;
    netIncome?: number;
    taxableIncome?: number;
    rateIncome?: number;
    wealth?: {
      items?: ItemAmount[];
      grossWealth?: number;
      socialDeduction?: number;
      taxableWealth?: number;
    };
    taxes?: Record<string, number | Split | undefined> & {
      communalIncome?: Split;
      communalWealth?: Split;
    };
  };
  ifd?: {
    items?: ItemAmount[];
    grossIncome?: number;
    totalIncome?: number;
    netIncome?: number;
    taxableIncome?: number;
    tax?: number;
  };
  input?: EngineInput;
}

/** One line per figure that differs; nothing else from the case. */
function differences(c: GoldenCase): string[] {
  const out: string[] = [];
  const cmp = (
    what: string,
    expected: number | undefined,
    got: number | undefined,
    absolute = false,
  ) => {
    if (expected === undefined) return;
    const e = absolute ? Math.abs(expected) : expected;
    const g = got === undefined ? undefined : absolute ? Math.abs(got) : got;
    if (g !== e) {
      out.push(
        `${what}: expected ${chf(e)}, got ${g === undefined ? 'nothing' : `${chf(g)} (${chf(g - e)})`}`,
      );
    }
  };

  const couple = ['married', 'registered_partnership'].includes(c.household.civilStatus);
  const children = c.household.children ?? 0;
  const shared = c.household.childrenShared ?? 0;
  const splitting =
    c.household.splitting ??
    (couple || children - shared > 0 ? 'full' : shared > 0 ? 'partial' : 'none');
  const ifdScale =
    c.household.ifdScale ?? (couple ? 'married' : children > 0 ? 'parental' : 'single');
  const r = assess({
    taxYear: c.taxYear,
    commune: c.commune,
    couple,
    splitting,
    ifdScale,
    ifdChildReductions: ifdScale === 'single' ? 0 : children,
    wealthCharges: children - shared / 2,
    singleWithChildren: !couple && children > 0,
    iccItems: c.icc?.items ?? [],
    wealthItems: c.icc?.wealth?.items ?? [],
    ifdItems: c.ifd?.items ?? [],
  });

  const icc = r.icc;
  cmp('icc.grossIncome', c.icc?.grossIncome, icc.grossIncome.amount);
  cmp('icc.netIncome', c.icc?.netIncome, icc.netIncome.amount);
  cmp('icc.totalIncome', c.icc?.totalIncome, icc.totalIncome.amount);
  cmp('icc.taxableIncome', c.icc?.taxableIncome, icc.taxableIncome.amount);
  cmp('icc.rateIncome', c.icc?.rateIncome, icc.rateIncome.amount);
  cmp('icc.wealth.grossWealth', c.icc?.wealth?.grossWealth, icc.wealth.grossWealth.amount);
  cmp(
    'icc.wealth.socialDeduction',
    c.icc?.wealth?.socialDeduction,
    icc.wealth.socialDeduction.amount,
  );
  cmp('icc.wealth.taxableWealth', c.icc?.wealth?.taxableWealth, icc.wealth.taxableWealth.amount);
  const t = c.icc?.taxes ?? {};
  const x = icc.taxes;
  const lines: Record<string, Line> = {
    incomeBase: x.incomeBase,
    incomeCantonalCentimes: x.incomeCantonalCentimes,
    incomeHomeCare: x.incomeHomeCare,
    wealthBase: x.wealthBase,
    wealthCantonalCentimes: x.wealthCantonalCentimes,
    wealthHomeCare: x.wealthHomeCare,
    wealthSupplementary: x.wealthSupplementary,
    personalTax: x.personalTax,
    total: x.total,
  };
  for (const [k, line] of Object.entries(lines))
    cmp(`icc.taxes.${k}`, t[k] as number | undefined, line.amount);
  cmp(
    'icc.taxes.incomeReduction12',
    t.incomeReduction12 as number | undefined,
    x.incomeReduction12.amount,
    true,
  );
  const rate = t.communalCentimesRate;
  if (typeof rate === 'number' && rate !== x.communalIncome.privileged.rate) {
    out.push(
      `icc.taxes.communalCentimesRate: expected ${rate}, got ${x.communalIncome.privileged.rate}`,
    );
  }
  for (const [name, split] of [
    ['communalIncome', x.communalIncome],
    ['communalWealth', x.communalWealth],
  ] as const) {
    const g = t[name];
    const home = split.rest.find((s) => s.commune === c.commune);
    cmp(`icc.taxes.${name}.privileged.base`, g?.privileged?.base, split.privileged.base.amount);
    cmp(`icc.taxes.${name}.privileged.tax`, g?.privileged?.tax, split.privileged.tax.amount);
    cmp(`icc.taxes.${name}.domicile.base`, g?.domicile?.base, home?.base.amount);
    cmp(`icc.taxes.${name}.domicile.tax`, g?.domicile?.tax, home?.tax.amount);
  }

  const ifd = r.ifd;
  cmp('ifd.grossIncome', c.ifd?.grossIncome, ifd.grossIncome.amount);
  cmp('ifd.netIncome', c.ifd?.netIncome, ifd.netIncome.amount);
  cmp('ifd.totalIncome', c.ifd?.totalIncome, ifd.totalIncome.amount);
  cmp('ifd.taxableIncome', c.ifd?.taxableIncome, ifd.taxableIncome.amount);
  cmp('ifd.tax', c.ifd?.tax, ifd.tax.amount);
  if (r.shieldMayApply)
    out.push('icc: the tax shield may apply (LIPP art. 60); the engine does not compute it');

  // Stage 2: the items the engine derives from the raw figures.
  if (c.input) {
    const derived = computeReturn(c.input);
    const key = (i: { code: string; person: ItemPerson }) => `${i.code} ${i.person}`;
    const compareItems = (
      tax: string,
      expected: ItemAmount[] | undefined,
      got: ItemAmount[] | undefined,
    ) => {
      if (!expected) return;
      const g = new Map((got ?? []).map((i) => [key(i), i.amount]));
      const e = new Map(expected.map((i) => [key(i), i.amount]));
      for (const [k, v] of e) cmp(`stage 2 ${tax} item ${k}`, v, g.get(k));
      for (const [k, v] of g)
        if (!e.has(k)) out.push(`stage 2 ${tax} item ${k}: not expected, got ${chf(v)}`);
    };
    compareItems('icc', c.icc?.items, derived.icc?.items);
    compareItems('ifd', c.ifd?.items, derived.ifd?.items);
    compareItems('icc wealth', c.icc?.wealth?.items, derived.icc?.wealth.items);
  }
  return out;
}

const files = usable
  ? readdirSync(dir!)
      .filter((f) => f.endsWith('.json'))
      .sort()
  : [];

describe.skipIf(!usable)('private golden cases (TAXPRESSO_PRIVATE_GOLDEN)', () => {
  it('finds at least one case in the folder', () => {
    expect(files.length).toBeGreaterThan(0);
  });
  for (const file of files) {
    it(`matches ${file}`, () => {
      let c: GoldenCase;
      try {
        c = JSON.parse(readFileSync(path.join(dir!, file), 'utf8')) as GoldenCase;
      } catch {
        throw new Error(`${file}: not valid JSON`);
      }
      expect(differences(c)).toEqual([]);
    });
  }
});
