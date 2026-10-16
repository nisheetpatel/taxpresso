#!/usr/bin/env node
// The hand calculation of the filing kits: each household's Geneva cantonal and communal tax (ICC)
// and federal tax (IFD), worked out from the official documents in docs/sources/ge/files and
// docs/sources/ch/files, line by line, each line with its citation (manifest id and page or
// article). It imports nothing from Taxpresso: the constants below were read in the documents, and
// the arithmetic is the documents' own (the guide's worked examples, the federal tariff's notes).
//
//   node test/fixtures/households/ground-truth.mjs     writes <kit>/expected.json
//
// Where the documents leave a rounding open, the households avoid it, and this file checks that
// they do (it throws otherwise): whole francs on every document, even taxable incomes for the
// couples (so the rate income, half the income, is a whole franc), cantonal base taxes that are
// multiples of CHF 50 (so 47.5 %, the 12 % reduction, the 1 % for home care and the communal
// centimes are exact to the centime), and no amount at an exact half of 5 centimes.
//
// Tax year 2026: the federal values are published (ch-2026-ifd-progression-deductions), and so are
// the communal centimes (ge-2026-communal-centimes-arca); Geneva's own 2026 scales and amounts are
// published with the 2026 guide in January 2027. Until then the 2026 cantonal figures here use the
// 2025 ones, as SPEC.md section 7 says the app must, and are marked provisional.
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as prettier from 'prettier';
import { KITS } from './kits.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));

const GUIDE = 'ge-2025-guide-declaration-pp';
const TARIFF = 'ge-2025-icc-tariff-pdf';
const INDEP = 'ge-2025-guide-independants';

// ---- Geneva, 2025 (also used for 2026 until the 2026 guide is published) ----------------------

/**
 * Income tax scale 2025 as printed: [from, to, rate in hundredths of a percent, total tax at "to"
 * in centimes]. ge-2025-guide-declaration-pp p. 47; ge-2025-icc-tariff-pdf p. 2.
 */
const ICC_INCOME_SCALE = [
  [0, 18_649, 0, 0],
  [18_650, 22_469, 730, 27_885],
  [22_470, 24_716, 820, 46_310],
  [24_717, 26_962, 910, 66_750],
  [26_963, 29_210, 1000, 89_230],
  [29_211, 34_827, 1090, 150_455],
  [34_828, 39_320, 1130, 201_225],
  [39_321, 43_815, 1230, 256_515],
  [43_816, 48_309, 1280, 314_040],
  [48_310, 77_518, 1320, 699_600],
  [77_519, 126_950, 1420, 1_401_535],
  [126_951, 170_764, 1500, 2_058_745],
  [170_765, 193_234, 1560, 2_409_275],
  [193_235, 276_369, 1580, 3_722_810],
  [276_370, 294_345, 1600, 4_010_425],
  [294_346, 414_554, 1680, 6_029_935],
  [414_555, 649_355, 1760, 10_162_435],
  [649_356, Infinity, 1800, null],
];
/** Base wealth tax 2025: rate in ten-thousandths of a per mille. guide p. 49; tariff p. 5. */
const ICC_WEALTH_SCALE = [
  [1, 118_398, 14_900, 17_640],
  [118_399, 236_795, 19_100, 40_255],
  [236_796, 355_193, 23_400, 67_960],
  [355_194, 473_591, 25_500, 98_150],
  [473_592, 710_387, 27_600, 163_505],
  [710_388, 947_182, 29_800, 234_070],
  [947_183, 1_183_977, 31_900, 309_610],
  [1_183_978, 1_420_773, 34_000, 390_120],
  [1_420_774, 1_775_966, 36_100, 518_345],
  [1_775_967, Infinity, 38_300, null],
];
/** Supplementary wealth tax 2025 (no centimes additionnels on it). guide p. 50; tariff p. 5. */
const ICC_WEALTH_SUPPLEMENTARY = [
  [1, 118_398, 0, 0],
  [118_399, 236_795, 956, 1_130],
  [236_796, 355_193, 1169, 2_515],
  [355_194, 473_591, 2550, 5_535],
  [473_592, 710_387, 2763, 12_080],
  [710_388, 947_182, 4463, 22_650],
  [947_183, 1_183_977, 4781, 33_970],
  [1_183_978, 1_420_773, 6800, 50_070],
  [1_420_774, 1_775_966, 7225, 75_735],
  [1_775_967, 3_551_932, 9563, 245_570],
  [3_551_933, Infinity, 11_475, null],
];

const GE = {
  incomeScale: { value: ICC_INCOME_SCALE, source: `${GUIDE} p. 47; ${TARIFF} p. 2` },
  wealthScale: { value: ICC_WEALTH_SCALE, source: `${GUIDE} p. 49; ${TARIFF} p. 5` },
  wealthSupplementary: {
    value: ICC_WEALTH_SUPPLEMENTARY,
    source: `${GUIDE} p. 50; ${TARIFF} p. 5; ge-na-law-lipp art. 59 al. 2 (no centimes on it)`,
  },
  splitting: { value: 50, source: `${GUIDE} p. 47; ge-na-law-lipp art. 41 al. 2` },
  cantonalCentimes: { value: 475, source: `${GUIDE} p. 48 and 49; ${TARIFF} p. 4 and 6` },
  reduction: { value: 120, source: `${GUIDE} p. 48; ${TARIFF} p. 4` },
  homeCare: { value: 10, source: `${GUIDE} p. 48 and 49; ${TARIFF} p. 4 and 6` },
  flatCosts: {
    value: { rate: 3, min: 640_00, max: 1_812_00 },
    source: `${GUIDE} p. 11 and 19 (31.50)`,
  },
  travel: { value: 534_00, source: `${GUIDE} p. 11, 19 and 21 (31.70)` },
  twoEarner: { value: 1_051_00, source: `${GUIDE} p. 11 and 21 (31.95 / 41.95)` },
  pillar3a: {
    value: { withFund: 7_258_00, without: 36_288_00, share: 20 },
    source: `${GUIDE} p. 11 and 18 (31.40)`,
  },
  healthCap: {
    value: { child: 3_965_00, young: 12_842_00, adult: 17_122_00 },
    source: `${GUIDE} p. 11 and 29 (52.21)`,
  },
  lifeAndSavings: {
    value: { single: 2_345_00, couple: 3_518_00, perCharge: 959_00 },
    source: `${GUIDE} p. 28 (52.15); ge-na-law-lipp art. 31 let. d`,
  },
  childcare: { value: 26_320_00, source: `${GUIDE} p. 11 and 30 (59.10)` },
  donations: { value: 20, source: `${GUIDE} p. 15 (73.10); ge-na-law-lipp art. 37 al. 1` },
  medical: { value: 0.5, source: `${GUIDE} p. 14 (71.00)` },
  familyCharge: {
    value: { full: 13_660_00, withChildcare: 10_508_00 },
    source: `${GUIDE} p. 11 and 15 (61.25); ge-na-law-lipp art. 39 al. 1`,
  },
  pensionerDeduction: {
    value: { coupleLimit: 98_080_00, singleLimit: 85_287_00 },
    source: `${GUIDE} p. 16 (61.30, tableaux 1 et 2); ge-na-law-lipp art. 40`,
  },
  wealthSocial: {
    value: { single: 87_632_00, couple: 175_264_00, perCharge: 43_816_00 },
    source: `${GUIDE} p. 16 (51.50); ge-na-law-lipp art. 58 al. 1`,
  },
  debtInterest: { value: 50_000_00, source: `${GUIDE} p. 37; ge-na-law-lipp art. 34 let. a` },
  abattement: {
    value: { perYear: 4, max: 40 },
    source: `${GUIDE} p. 33 (abattement; "Villa occupée de 2010 à 2025, soit 16 ans"); ge-na-law-lipp art. 50 let. e`,
  },
  upkeepFlat: {
    value: { icc: { young: 15, old: 25 }, ifd: { young: 10, old: 20 } },
    source: `${GUIDE} p. 33 and 34 (frais d'entretien); ge-na-law-lipp art. 34 let. d`,
  },
  effort: { value: { share: 20 }, source: `${GUIDE} p. 51 (taux d'effort)` },
  iic: { value: { mainHome: 2 }, source: `${GUIDE} p. 36 (0.2 per mille for the main residence)` },
  personalTax: {
    value: 25_00,
    source: 'ge-na-law-lcp art. 374 al. 2, art. 375 and art. 377 let. c',
  },
};

/** Communal centimes, in hundredths (45.49 -> 4549). */
const COMMUNES = {
  2025: {
    source: 'ge-2025-communal-centimes-pdf (colonne 2025, CA)',
    value: { Carouge: 4000, Lancy: 4700, Meyrin: 4200, Onex: 5050, Thônex: 4400 },
  },
  2026: {
    source: 'ge-2026-communal-centimes-arca',
    value: { Carouge: 4000, Lancy: 4700, Meyrin: 4200, Onex: 5050, Thônex: 4400 },
  },
};

// ---- Federal tax (IFD) ---------------------------------------------------------------------------

/** Steps [from CHF, tax at from in centimes, centimes per further CHF 100]. */
const IFD = {
  2025: {
    source: 'ch-2025-ifd-frais-professionnels-progression p. 3 (Barèmes 2025, art. 36 LIFD)',
    deductions: 'ch-2025-ifd-frais-professionnels-progression p. 2',
    instructions: 'ch-2025-ifd-instructions-personnes-physiques',
    single: [
      [15_200, 0, 77],
      [33_200, 138_60, 88],
      [43_500, 229_20, 264],
      [58_000, 612_00, 297],
      [76_100, 1_149_55, 594],
      [82_000, 1_500_00, 660],
      [108_800, 3_268_80, 880],
      [141_500, 6_146_40, 1100],
      [184_900, 10_920_40, 1320],
      [793_300, 91_229_20, 0],
      [793_400, 91_241_00, 1150],
    ],
    married: [
      [29_700, 0, 100],
      [53_400, 237_00, 200],
      [61_300, 395_00, 300],
      [79_100, 929_00, 400],
      [94_900, 1_561_00, 500],
      [108_600, 2_246_00, 600],
      [120_500, 2_960_00, 700],
      [130_500, 3_660_00, 800],
      [138_300, 4_284_00, 900],
      [144_200, 4_815_00, 1000],
      [148_200, 5_215_00, 1100],
      [150_300, 5_446_00, 1200],
      [152_300, 5_686_00, 1300],
      [940_800, 108_191_00, 0],
      [940_900, 108_203_50, 1150],
    ],
    perChildReduction: 263_00,
    child: 6_800_00,
    married2800: 2_800_00,
    insurance: {
      single: 1_800_00,
      couple: 3_700_00,
      singleNone: 2_700_00,
      coupleNone: 5_550_00,
      perChild: 700_00,
    },
    twoEarner: { min: 8_600_00, max: 14_100_00 },
    childcare: 25_800_00,
    otherCosts: { rate: 3, min: 2_000_00, max: 4_000_00 },
    meals: { perDay: 15_00, max: 3_200_00 },
    travelMax: 3_300_00,
    pillar3a: { withFund: 7_258_00, without: 36_288_00 },
  },
  2026: {
    source: 'ch-2026-ifd-progression-deductions p. 3 and 4 (Barèmes 2026, art. 36 LIFD)',
    deductions: 'ch-2026-ifd-progression-deductions p. 1 and 2',
    instructions: 'ch-2026-ifd-instructions-personnes-physiques',
    single: [
      [15_200, 0, 77],
      [33_200, 138_60, 88],
      [43_500, 229_20, 264],
      [58_000, 612_00, 297],
      [76_200, 1_152_50, 594],
      [82_100, 1_502_95, 660],
      [108_900, 3_271_75, 880],
      [141_500, 6_140_55, 1100],
      [185_100, 10_936_55, 1320],
      [793_900, 91_298_15, 0],
      [794_000, 91_310_00, 1150],
    ],
    married: [
      [29_700, 0, 100],
      [53_400, 237_00, 200],
      [61_300, 395_00, 300],
      [79_100, 929_00, 400],
      [94_900, 1_561_00, 500],
      [108_700, 2_251_00, 600],
      [120_600, 2_965_00, 700],
      [130_500, 3_658_00, 800],
      [138_400, 4_290_00, 900],
      [144_300, 4_821_00, 1000],
      [148_300, 5_221_00, 1100],
      [150_400, 5_452_00, 1200],
      [152_400, 5_692_00, 1300],
    ],
    perChildReduction: 263_00,
    child: 6_800_00,
    married2800: 2_800_00,
    insurance: {
      single: 1_800_00,
      couple: 3_700_00,
      singleNone: 2_700_00,
      coupleNone: 5_550_00,
      perChild: 700_00,
    },
    twoEarner: { min: 8_600_00, max: 14_100_00 },
    childcare: 25_800_00,
    otherCosts: { rate: 3, min: 2_000_00, max: 4_000_00 },
    meals: { perDay: 15_00, max: 3_200_00 },
    travelMax: 3_300_00,
    pillar3a: { withFund: 7_258_00, without: 36_288_00 },
  },
};

// ---- Arithmetic ----------------------------------------------------------------------------------

const fr = (c) => {
  const s = (Math.abs(c) / 100).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, "'");
  return `${c < 0 ? '-' : ''}${s}`;
};

/** num / den to the nearest 5 centimes, as the guide's examples round; an exact half throws. */
function round5(num, den = 1) {
  const twice = (2 * num) % (10 * den);
  if (twice === 5 * den)
    throw new Error(`exact half of 5 centimes: ${num}/${den}, choose other amounts`);
  return Math.round(num / den / 5) * 5;
}

/** An amount that must come out exact (to the centime and to 5 centimes), else this kit is open. */
function exact5(num, den, what) {
  if (num % den !== 0 || (num / den) % 5 !== 0) {
    throw new Error(`${what}: ${num}/${den} is not exact to 5 centimes; choose other amounts`);
  }
  return num / den;
}

/** The Geneva scale at an amount in centimes: the total at the previous step plus the rest. */
function genevaScale(rows, centimes, denominator) {
  if (centimes <= 0) return 0;
  if (centimes % 100 !== 0) throw new Error(`not whole francs: ${centimes}`);
  const francs = centimes / 100;
  let prevTo = 0;
  let prevTotal = 0;
  for (const [from, to, rate, total] of rows) {
    if (francs <= to) {
      const base = from <= 1 ? 0 : prevTo;
      // (francs - base) x rate, rate in 1 / denominator.
      return prevTotal + round5((francs - base) * 100 * rate, denominator);
    }
    prevTo = to;
    prevTotal = total;
  }
  throw new Error('scale');
}

/** The federal scale at a taxable income already rounded down to CHF 100. */
function federalScale(steps, centimes) {
  const francs = centimes / 100;
  let tax = 0;
  for (const [start, base, per100] of steps) {
    if (francs >= start) tax = base + Math.floor((francs - start) / 100) * per100;
  }
  return tax;
}

const floor100 = (c) => Math.floor(c / 10_000) * 10_000;
const floor5 = (c) => Math.floor(c / 5) * 5;
const pct = (amount, p) => (amount * p) / 100;

/** 3 % of an amount, which the kits keep a whole franc (the guide's example rounds it, p. 19). */
function threePercent(amount, what) {
  const v = amount * 3;
  if (v % 100 !== 0 || (v / 100) % 100 !== 0) {
    throw new Error(`${what}: 3 % of ${fr(amount)} is not a whole franc; choose other amounts`);
  }
  return v / 100;
}

// ---- One household, one year -------------------------------------------------------------------

export function computeKit(kit, year) {
  const Y = kit.years[year];
  const F = IFD[year];
  const couple = kit.civil === 'married';
  const people = kit.people.map((p) => p.id);
  const children = kit.children ?? [];
  const provisional = year !== 2025;
  const estimateNote = provisional
    ? ' (Geneva 2026 amount not published yet: the 2025 one, as SPEC.md section 7 prescribes)'
    : '';
  const icc = [];
  const ifd = [];
  const wealth = [];
  const add = (list, code, person, amount, how, source) =>
    list.push({ code, person, amount, how, source });
  const both = (code, person, amount, how, source) => {
    add(icc, code, person, amount, how, source);
    add(ifd, code, person, amount, how, source);
  };
  const sum = (list) => list.reduce((s, l) => s + l.amount, 0);
  const who = (p) => (p === 'p1' ? 'A' : p === 'p2' ? 'B' : 'household');
  const code = (p, a, b) => (p === 'p2' ? b : a);

  // Salaries, per person (annexe A).
  const salaryOf = {};
  for (const s of Y.salaries ?? []) {
    const net = s.gross - s.social - s.lppOrdinary;
    salaryOf[s.person] = { ...s, net };
    both(
      code(s.person, '11.10', '21.10'),
      s.person,
      s.gross,
      `Gross salary, box 8 of the salary certificate: ${fr(s.gross)}.`,
      `${GUIDE} p. 17`,
    );
    both(
      code(s.person, '31.10', '41.10'),
      s.person,
      -s.social,
      `AVS/AI/APG/AC/AANP contributions, box 9: ${fr(s.social)}.`,
      `${GUIDE} p. 18`,
    );
    both(
      code(s.person, '31.12', '41.12'),
      s.person,
      -s.lppOrdinary,
      `Pension fund contributions, box 10.1: ${fr(s.lppOrdinary)}.`,
      `${GUIDE} p. 18`,
    );
  }

  // Pensions (annexe C1): AVS 17.10, pension fund 13.20, both in full.
  for (const p of Y.pensions ?? []) {
    const c = p.type === 'avs_ai' ? '17.10' : '13.20';
    both(
      c,
      p.person,
      p.amount,
      p.type === 'avs_ai'
        ? `AVS pension of the year, taxable in full: ${fr(p.amount)}.`
        : `Pension fund pension (started after 2002), taxable in full: ${fr(p.amount)}.`,
      p.type === 'avs_ai'
        ? `${GUIDE} p. 25 (17.10)`
        : `${GUIDE} p. 26 (13.20) and p. 29 (33.20, pensions started before 2002 only)`,
    );
  }

  // Self-employment (annexe B): profit 12.01, the owner's AVS contributions 32.10.
  const businessOf = {};
  for (const b of Y.businesses ?? []) {
    const revenue = b.turnover + (b.otherIncome ?? 0);
    const costs = (b.costsGoods ?? 0) + (b.depreciation ?? 0) + (b.costsOther ?? 0);
    const profit = revenue - costs;
    businessOf[b.person] = { ...b, profit };
    both(
      '12.01',
      b.person,
      profit,
      `Business result: revenue ${fr(revenue)} less charges ${fr(costs)} (12.17 - 12.45 = 12.46): ${fr(profit)}.`,
      `${INDEP} p. 13 to 15; ${GUIDE} p. 23 and 24`,
    );
    both(
      '32.10',
      b.person,
      -b.avs,
      `The owner's own AVS/AI/APG instalments paid for the year (32.10), in full: ${fr(b.avs)}.`,
      `${INDEP} p. 22; ge-na-law-lipp art. 31 let. a`,
    );
    add(
      wealth,
      '12.50',
      b.person,
      b.currentAssets + b.fixedAssets,
      `Business assets on 31 December (12.48 + 12.49): ${fr(b.currentAssets)} + ${fr(b.fixedAssets)}.`,
      `${INDEP} p. 16 and 17`,
    );
    add(
      wealth,
      '57.50',
      b.person,
      -b.liabilities,
      `Business debts on 31 December: ${fr(b.liabilities)}.`,
      `${INDEP} p. 17`,
    );
  }

  // Movable wealth and its income (état des titres).
  let wealthIncome = 0;
  let savingsInterest = 0;
  let withholding = 0;
  for (const st of Y.statements ?? []) {
    const value =
      st.accounts.reduce((s, a) => s + a.balance, 0) +
      st.securities.reduce((s, x) => s + secValue(x), 0);
    const income =
      st.securities.reduce((s, x) => s + x.dividend, 0) +
      st.accounts.reduce((s, a) => s + (a.interest ?? 0), 0);
    const ia = st.securities.reduce((s, x) => s + x.dividend, 0);
    if (st.accounts.some((a) => a.interest))
      throw new Error('kits keep e-tax statement accounts without interest');
    wealthIncome += income;
    withholding += iaOf(ia);
    add(
      wealth,
      '14.00',
      st.person,
      value,
      `${st.bank.name}, e-tax statement (relevé fiscal, F4): taxable value on 31 December ${fr(value)}.`,
      `${GUIDE} p. 43`,
    );
    both(
      '14.00',
      st.person,
      income,
      `${st.bank.name}, e-tax statement: gross income subject to the withholding tax ${fr(ia)} (dividends of Swiss securities; not savings interest).`,
      `${GUIDE} p. 41 and 43`,
    );
  }
  for (const a of Y.bankAccounts ?? []) {
    wealthIncome += a.interest;
    savingsInterest += a.interest;
    add(
      wealth,
      '14.00',
      a.person,
      a.balance,
      `${a.bank.name}, ${a.name}: balance on 31 December ${fr(a.balance)}.`,
      `${GUIDE} p. 40`,
    );
    if (a.interest)
      both(
        '14.00',
        a.person,
        a.interest,
        `${a.bank.name}, ${a.name}: gross interest ${fr(a.interest)}, under CHF 200 so without withholding tax; every bank interest is interest on savings capital (56.30).`,
        `${GUIDE} p. 40 and 41`,
      );
  }
  for (const br of Y.brokers ?? []) {
    const value = br.positions.reduce((s, x) => s + secValue(x), 0);
    const income = br.positions.reduce((s, x) => s + x.dividend, 0);
    wealthIncome += income;
    withholding += iaOf(income);
    add(
      wealth,
      '14.00',
      br.person,
      value,
      `${br.name}, securities at the official value on 31 December (ESTV price list, as the user gives it): ${br.positions.map((x) => `${x.quantity} x ${x.unitPrice.toFixed(2)}`).join(' + ')} = ${fr(value)}.`,
      `${GUIDE} p. 41`,
    );
    both(
      '14.00',
      br.person,
      income,
      `${br.name}: gross dividends of Swiss shares, subject to the withholding tax, ${fr(income)}.`,
      `${GUIDE} p. 41`,
    );
  }

  // A home in Geneva (annexe D, 15.10).
  let property;
  if (Y.property) {
    const pr = Y.property;
    const years = year - pr.since + 1;
    const abat = Math.min(years * GE.abattement.value.perYear, GE.abattement.value.max);
    const valueAfter = pr.taxValue - pct(pr.taxValue, abat);
    const rentalIcc = pr.rentalValue - pct(pr.rentalValue, abat);
    const flatIcc = pct(
      rentalIcc,
      pr.old ? GE.upkeepFlat.value.icc.old : GE.upkeepFlat.value.icc.young,
    );
    const flatIfd = pct(
      pr.rentalValue,
      pr.old ? GE.upkeepFlat.value.ifd.old : GE.upkeepFlat.value.ifd.young,
    );
    for (const v of [valueAfter, rentalIcc, flatIcc, flatIfd])
      if (v % 100 !== 0) throw new Error(`property amount not whole francs: ${v}`);
    property = { ...pr, abat, years, valueAfter, rentalIcc, flatIcc, flatIfd };
    add(
      wealth,
      '15.10',
      'household',
      valueAfter,
      `Tax value from the AFC's letter ${fr(pr.taxValue)} less the abattement of ${abat} % (${years} years of continuous use from ${pr.since} to ${year}, 4 % a year, at most 40 %): ${fr(valueAfter)}.`,
      `${GE.abattement.source}`,
    );
    add(
      icc,
      '15.10',
      'household',
      rentalIcc,
      `Rental value from the AFC's letter ${fr(pr.rentalValue)} less the same abattement of ${abat} %: ${fr(rentalIcc)} (valeur locative après abattement).`,
      `${GUIDE} p. 33 and 34`,
    );
    add(
      ifd,
      '15.10',
      'household',
      pr.rentalValue,
      `Gross rental value from the AFC's letter (valeur locative brute): ${fr(pr.rentalValue)}.`,
      `${GUIDE} p. 33`,
    );
    add(
      icc,
      '58.00',
      'household',
      -flatIcc,
      `Flat upkeep, building over 10 years old: ${pr.old ? 25 : 15} % of ${fr(rentalIcc)} = ${fr(flatIcc)} (no actual costs claimed).`,
      `${GE.upkeepFlat.source}`,
    );
    add(
      ifd,
      '58.00',
      'household',
      -flatIfd,
      `Flat upkeep, building over 10 years old: ${pr.old ? 20 : 10} % of ${fr(pr.rentalValue)} = ${fr(flatIfd)}.`,
      `${GUIDE} p. 33; ${F.instructions} p. 6 (b, déduction à forfait)`,
    );
  }

  // Debts and their interest (annexe E).
  let interestPaid = 0;
  for (const d of Y.mortgages ?? []) {
    interestPaid += d.interest;
    add(
      wealth,
      '55.00',
      'household',
      -d.balance,
      `${d.lender.name}: mortgage on 31 December ${fr(d.balance)}.`,
      `${GUIDE} p. 37`,
    );
  }
  if (interestPaid) {
    const grossYield = wealthIncome + (property ? property.rentalIcc : 0);
    const limitIcc = grossYield + GE.debtInterest.value;
    const grossYieldIfd = wealthIncome + (property ? property.rentalValue : 0);
    if (interestPaid > Math.min(limitIcc, grossYieldIfd + GE.debtInterest.value))
      throw new Error('interest over its limit');
    add(
      icc,
      '55.00',
      'household',
      -interestPaid,
      `Mortgage interest paid in the year ${fr(interestPaid)}, under its limit (gross income from wealth ${fr(grossYield)} + 50'000).`,
      `${GE.debtInterest.source}`,
    );
    add(
      ifd,
      '55.00',
      'household',
      -interestPaid,
      `Mortgage interest ${fr(interestPaid)}, under the limit (income from wealth ${fr(grossYieldIfd)} + 50'000).`,
      `${F.instructions} p. 7 (chiffre 11)`,
    );
  }

  // Professional costs of employees.
  const commute = Y.commute ?? {};
  for (const p of people) {
    const s = salaryOf[p];
    if (!s) continue;
    const c = commute[p] ?? {};
    const travel = c.transit ?? 0;
    const meals = c.mealDays ? Math.min(c.mealDays * F.meals.perDay, F.meals.max) : 0;
    // ICC: the flat 3 % (640 to 1'812) or the actual costs (travel at most 534, meals only over 2 h
    // a day by public transport), whichever is higher.
    const base = s.gross - s.social - s.lppOrdinary;
    const flatRaw = threePercentOrClamp(
      base,
      GE.flatCosts.value.min,
      GE.flatCosts.value.max,
      `${kit.slug} ${year} ICC flat ${p}`,
    );
    const actualIcc = Math.min(travel, GE.travel.value);
    if (actualIcc >= flatRaw) throw new Error('kits keep the flat costs above the actual ones');
    add(
      icc,
      code(p, '31.50', '41.50'),
      p,
      -flatRaw,
      `Flat professional costs: 3 % of ${fr(base)} (11.00 - 31.10 - 31.12), between 640 and 1'812: ${fr(flatRaw)}; higher than the actual costs (travel ${fr(actualIcc)}, no meals: the trip is under 2 hours a day).`,
      `${GE.flatCosts.source}; ${GUIDE} p. 22 (example 1)`,
    );
    // IFD: travel (actual, at most 3'300), meals (15 a day, at most 3'200) and the flat 3 % of the
    // net salary for the other costs (2'000 to 4'000).
    if (travel) {
      if (travel > 3_200_00)
        throw new Error(
          'kits keep travel under 3200 (the 2025 instructions say 3200, the circular 3300)',
        );
      add(
        ifd,
        code(p, '31.71', '41.71'),
        p,
        -travel,
        `Travel by public transport, the yearly pass: ${fr(travel)} (under the maximum).`,
        `${F.instructions} p. 6 (frais de déplacement); ${GUIDE} p. 20 and 21 (31.71)`,
      );
    }
    if (meals)
      add(
        ifd,
        code(p, '31.60', '41.60'),
        p,
        -meals,
        `Meals away from home: ${c.mealDays} days x 15 = ${fr(c.mealDays * F.meals.perDay)}, at most ${fr(F.meals.max)}, employer not paying (box G empty): ${fr(meals)}.`,
        `${F.instructions} p. 6 (repas); ${F.deductions}`,
      );
    const other = threePercentOrClamp(
      s.net,
      F.otherCosts.min,
      F.otherCosts.max,
      `${kit.slug} ${year} IFD flat ${p}`,
    );
    add(
      ifd,
      code(p, '31.20', '41.20'),
      p,
      -other,
      `Other professional costs, flat: 3 % of the net salary ${fr(s.net)}, between 2'000 and 4'000: ${fr(other)}.`,
      `${F.instructions} p. 6 (autres frais professionnels); ${GUIDE} p. 19 (31.20)`,
    );
  }

  // Pillar 3a.
  for (const a of Y.pillar3a ?? []) {
    const withFund = !!salaryOf[a.person] && salaryOf[a.person].lppOrdinary > 0;
    let cap;
    let capHow;
    if (withFund) {
      cap = GE.pillar3a.value.withFund;
      capHow = `affiliated to a pension fund: at most ${fr(cap)}`;
    } else {
      const b = businessOf[a.person];
      const earned = b.profit - b.avs;
      cap = Math.min(pct(earned, 20), GE.pillar3a.value.without);
      capHow = `no pension fund: at most 20 % of the earned income (${fr(b.profit)} less the AVS contributions ${fr(b.avs)}), ${fr(cap)}`;
    }
    if (a.paid > cap) throw new Error('kits keep 3a within its limit');
    if (!withFund && a.paid > pct(businessOf[a.person].profit, 20) * 0.9)
      throw new Error('3a too close to the limit');
    const c =
      businessOf[a.person] && !salaryOf[a.person] ? '32.40' : code(a.person, '31.40', '41.40');
    both(
      c,
      a.person,
      -a.paid,
      `Pillar 3a paid in the year ${fr(a.paid)}; ${capHow}.`,
      `${GE.pillar3a.source}; ${F.instructions} p. 7 (chiffre 13)`,
    );
  }

  // Two earners.
  if (couple) {
    const earned = (p) => {
      const s = salaryOf[p];
      if (!s) return 0;
      const mine = ifd.filter((l) => l.person === p && /^[34]1\.|^[12]1\./.test(l.code));
      return sum(mine);
    };
    const earners = people.filter((p) => salaryOf[p] || businessOf[p]);
    if (earners.length === 2) {
      const iccEarned = (p) =>
        sum(icc.filter((l) => l.person === p && /^[34]1\.|^[12]1\./.test(l.code)));
      const lowIcc = iccEarned('p1') <= iccEarned('p2') ? 'p1' : 'p2';
      add(
        icc,
        code(lowIcc, '31.95', '41.95'),
        lowIcc,
        -GE.twoEarner.value,
        `Both spouses work: ${fr(GE.twoEarner.value)} off the lower earned income (${fr(iccEarned(lowIcc))}).`,
        GE.twoEarner.source,
      );
      const low = earned('p1') <= earned('p2') ? 'p1' : 'p2';
      const half = earned(low) / 2;
      const v = Math.min(Math.max(half, F.twoEarner.min), F.twoEarner.max, earned(low));
      if (v % 100 !== 0) throw new Error('two-earner not whole francs');
      add(
        ifd,
        code(low, '31.90', '41.90'),
        low,
        -v,
        `Both spouses work: 50 % of the lower earned income (${fr(earned(low))}, gross less social and pension contributions, professional costs and pillar 3a), at least ${fr(F.twoEarner.min)}, at most ${fr(F.twoEarner.max)}: ${fr(v)}.`,
        `${F.instructions} p. 8 (chiffre 16); ${GUIDE} p. 21 (31.90)`,
      );
    }
  }

  // Insurance premiums and savings interest.
  const premiums = (Y.health?.members ?? []).reduce((s, m) => s + m.basic + m.supplementary, 0);
  if (premiums) {
    for (const m of Y.health.members) {
      const age = ageClass(kit, m.person, year);
      const cap = GE.healthCap.value[age];
      if (m.basic + m.supplementary > cap) throw new Error('premium over its cap');
    }
    add(
      icc,
      '52.21',
      'household',
      -premiums,
      `Health insurance premiums paid (basic and supplementary) ${fr(premiums)}; each person's under twice the cantonal average premium for their age (adult ${fr(GE.healthCap.value.adult)}, child ${fr(GE.healthCap.value.child)}).`,
      GE.healthCap.source,
    );
  }
  const contributing = people.some(
    (p) =>
      (salaryOf[p] && salaryOf[p].lppOrdinary > 0) ||
      (Y.pillar3a ?? []).some((a) => a.person === p),
  );
  const charges = children.length;
  if (savingsInterest) {
    const L = GE.lifeAndSavings.value;
    const limit =
      (couple ? L.couple : L.single) * (contributing ? 1 : 2) +
      charges * L.perCharge * (contributing ? 1 : 2);
    if (savingsInterest > limit) throw new Error('savings over limit');
    add(
      icc,
      '52.15',
      'household',
      -savingsInterest,
      `Interest on savings capital (56.30) ${fr(savingsInterest)}, under the limit ${fr(limit)}.`,
      GE.lifeAndSavings.source,
    );
  }
  {
    const I = F.insurance;
    const base = couple
      ? contributing
        ? I.couple
        : I.coupleNone
      : contributing
        ? I.single
        : I.singleNone;
    const cap = base + charges * I.perChild;
    const given = premiums + savingsInterest;
    const v = Math.min(given, cap);
    if (v)
      add(
        ifd,
        '52.00',
        'household',
        -v,
        `Insurance premiums and savings interest ${fr(given)}, at most ${fr(cap)} (${couple ? 'married couple' : 'single'}, ${contributing ? 'paying into a pension fund or pillar 3a' : 'without pension fund or pillar 3a contributions'}${charges ? `, + 700 x ${charges} children` : ''}): ${fr(v)}.`,
        `${F.instructions} p. 8 (chiffre 14); ${F.deductions}; ${GUIDE} p. 28 (52.00)`,
      );
  }

  // Childcare, per child.
  for (const c of Y.childcare ?? []) {
    if (c.amount > GE.childcare.value || c.amount > F.childcare)
      throw new Error('childcare over cap');
    add(
      icc,
      '59.10',
      'household',
      -c.amount,
      `Crèche for ${c.child} (under 14), both parents working: ${fr(c.amount)}, under ${fr(GE.childcare.value)} per child.`,
      GE.childcare.source,
    );
    add(
      ifd,
      '59.12',
      'household',
      -c.amount,
      `Crèche for ${c.child}: ${fr(c.amount)}, under ${fr(F.childcare)} per child.`,
      `${F.instructions} p. 8; ${GUIDE} p. 30 (59.12)`,
    );
  }

  // Subtotals.
  const gross = (list) => sum(list.filter((l) => l.amount > 0));
  const s9220Icc = sum(icc);
  const s9220Ifd = sum(ifd);

  // Medical costs: none in the kits. Donations.
  for (const d of Y.donations ?? []) {
    if (
      d.amount > pct(s9220Icc, GE.donations.value) ||
      d.amount > pct(s9220Ifd, 20) ||
      d.amount < 100_00
    )
      throw new Error('donation limits');
    add(
      icc,
      '73.10',
      'household',
      -d.amount,
      `Donation to ${d.to} ${fr(d.amount)}, under 20 % of 92.40 (${fr(s9220Icc)}).`,
      GE.donations.source,
    );
    add(
      ifd,
      '73.20',
      'household',
      -d.amount,
      `Donation to ${d.to} ${fr(d.amount)}: at least 100, under 20 % of the net income (${fr(s9220Ifd)}).`,
      `${F.instructions} p. 8 (chiffre 21.2); ${GUIDE} p. 15 (73.20)`,
    );
  }
  const netIcc = sum(icc);
  const netIfd = sum(ifd);

  // AVS/AI pensioners (61.30): only when 92.40 is under the limit.
  if ((Y.pensions ?? []).some((p) => p.type === 'avs_ai')) {
    const limit = couple
      ? GE.pensionerDeduction.value.coupleLimit
      : GE.pensionerDeduction.value.singleLimit;
    if (s9220Icc <= limit + 5_000_00)
      throw new Error('kits keep 92.40 clearly over the pensioner deduction limit');
  }

  // Social deductions.
  const social = [];
  for (const c of children) {
    const withCare = (Y.childcare ?? []).some((x) => x.child === c.first);
    const v = withCare ? GE.familyCharge.value.withChildcare : GE.familyCharge.value.full;
    social.push({
      code: '61.25',
      person: 'household',
      amount: -v,
      how: `Family charge for ${c.first}${withCare ? ', whose childcare is deducted: the reduced amount' : ''}: ${fr(v)}.`,
      source: GE.familyCharge.source,
    });
  }
  const taxableIcc = netIcc + sum(social);
  if (taxableIcc % 100 !== 0) throw new Error('ICC taxable income not whole francs');
  const ifdSocial = [];
  for (const c of children)
    ifdSocial.push({
      code: '61.20',
      person: 'household',
      amount: -F.child,
      how: `Deduction for ${c.first}, a minor child: ${fr(F.child)}.`,
      source: `${F.deductions}; ${F.instructions} p. 9 (chiffre 23)`,
    });
  if (couple)
    ifdSocial.push({
      code: '59.20',
      person: 'household',
      amount: -F.married2800,
      how: `Married couple: ${fr(F.married2800)}.`,
      source: `${F.deductions}; ${F.instructions} p. 9; ${GUIDE} p. 31 (59.20)`,
    });
  const ifdNet = netIfd + sum(ifdSocial);
  const taxableIfd = floor100(ifdNet);

  // ICC income tax.
  const splitting = couple || children.length > 0 ? 'full' : 'none';
  if (splitting === 'full' && (taxableIcc / 100) % 2 !== 0)
    throw new Error(
      `${kit.slug} ${year}: odd taxable income ${fr(taxableIcc)} with splitting; choose other amounts`,
    );
  const rateIncome = splitting === 'full' ? taxableIcc / 2 : taxableIcc;
  const rateTax = genevaScale(GE.incomeScale.value, rateIncome, 10_000);
  const incomeBase = splitting === 'full' ? rateTax * 2 : rateTax;
  const communeRate = COMMUNES[year].value[kit.commune];
  const cantonal = (base, what, withReduction) => {
    if (base % 5000 !== 0)
      throw new Error(
        `${kit.slug} ${year}: ${what} base tax ${fr(base)} is not a multiple of CHF 50; choose other amounts`,
      );
    const cc = exact5(base * GE.cantonalCentimes.value, 1000, `${what} cantonal centimes`);
    const red = withReduction
      ? exact5((base + cc) * GE.reduction.value, 1000, `${what} reduction`)
      : 0;
    const hc = exact5(base * GE.homeCare.value, 1000, `${what} home care`);
    const comm = exact5(base * communeRate, 10_000, `${what} communal`);
    return { cc, red, hc, comm };
  };
  const inc = cantonal(incomeBase, 'income', true);
  const cantonalIncome = incomeBase + inc.cc - inc.red + inc.hc;

  // ICC wealth tax.
  const grossWealth = sum(wealth.filter((l) => l.amount > 0));
  const netWealth = sum(wealth);
  const wsV = GE.wealthSocial.value;
  const socialW = Math.min(
    (couple || children.length ? wsV.couple : wsV.single) + charges * wsV.perCharge,
    Math.max(0, netWealth),
  );
  const taxableWealth = Math.max(0, netWealth - socialW);
  // The deduction on business wealth (51.60, half the business assets invested, LIPP art. 58
  // al. 2): which figure it halves is not spelled out, so the kits keep it from mattering.
  if ((Y.businesses ?? []).length && taxableWealth !== 0) {
    throw new Error('kits keep a business household under the wealth social deduction');
  }
  if (taxableWealth % 100 !== 0) throw new Error('wealth not whole francs');
  const wealthBase = genevaScale(GE.wealthScale.value, taxableWealth, 10_000_000);
  const supplementary = genevaScale(GE.wealthSupplementary.value, taxableWealth, 10_000_000);
  const wl = cantonal(wealthBase, 'wealth', false);
  const cantonalWealth = wealthBase + wl.cc + wl.hc + supplementary;

  const personalTax =
    taxableWealth === 0 && taxableIcc <= (splitting === 'full' ? 5_000_00 : 3_400_00)
      ? 0
      : GE.personalTax.value;
  const iccTotal = cantonalIncome + cantonalWealth + inc.comm + wl.comm + personalTax;

  // IFD tax.
  const scale = couple ? 'married' : children.length ? 'parental' : 'single';
  const scaleTax = federalScale(scale === 'single' ? F.single : F.married, taxableIfd);
  const childReduction = scale === 'single' ? 0 : children.length * F.perChildReduction;
  let ifdTax = floor5(Math.max(0, scaleTax - childReduction));
  if (ifdTax < 25_00) ifdTax = 0;

  const iic = property ? (property.taxValue * GE.iic.value.mainHome) / 10_000 : undefined;

  const r = (amount, how, source) => ({ amount, how, source });
  return {
    taxYear: year,
    provisional,
    commune: kit.commune,
    icc: {
      lines: icc.map((l) => ({ ...l, person: who(l.person) })),
      grossIncome: r(gross(icc), 'Total of the gross income lines (91.00).', `${GUIDE} p. 13`),
      netIncome: r(
        netIcc,
        'Gross income less every deduction before the social deductions (92.40 after donations).',
        `${GUIDE} p. 13 to 15`,
      ),
      socialDeductions: social.map((l) => ({ ...l, person: who(l.person) })),
      taxableIncome: r(
        taxableIcc,
        `Net income ${fr(netIcc)} less the family charges ${fr(-sum(social))}: ${fr(taxableIcc)} (99.00).${estimateNote}`,
        `${GUIDE} p. 15`,
      ),
      splitting,
      rateIncome: r(
        rateIncome,
        splitting === 'full'
          ? `Full splitting: half of ${fr(taxableIcc)} = ${fr(rateIncome)}.`
          : `No splitting: the taxable income itself.`,
        GE.splitting.source,
      ),
      incomeBase: r(
        incomeBase,
        splitting === 'full'
          ? `The scale at ${fr(rateIncome)} gives ${fr(rateTax)}; x ${fr(taxableIcc)} / ${fr(rateIncome)} = ${fr(incomeBase)} (example 3).${estimateNote}`
          : `The scale at ${fr(taxableIcc)}: the total of the step below plus the rest at the step's rate, to 5 centimes (example 2): ${fr(incomeBase)}.${estimateNote}`,
        `${GE.incomeScale.source}; ${TARIFF} p. 3`,
      ),
      cantonalIncome: r(
        cantonalIncome,
        `Base ${fr(incomeBase)} + 47.5 % ${fr(inc.cc)} - 12 % of ${fr(incomeBase + inc.cc)} ${fr(inc.red)} + 1 % home care ${fr(inc.hc)} = ${fr(cantonalIncome)} (each exact).`,
        GE.cantonalCentimes.source,
      ),
      communalIncome: r(
        inc.comm,
        `${communeRate / 100} centimes of ${kit.commune} on the base ${fr(incomeBase)}: ${fr(inc.comm)} (all income earned in ${kit.commune}, so no share for another commune).`,
        `${COMMUNES[year].source}; ${GUIDE} p. 48; ge-na-law-lcp art. 293 let. A and 295A`,
      ),
      wealthLines: wealth.map((l) => ({ ...l, person: who(l.person) })),
      grossWealth: r(grossWealth, 'Total gross wealth.', `${GUIDE} p. 16`),
      netWealth: r(netWealth, 'Gross wealth less debts.', `${GUIDE} p. 37`),
      wealthSocialDeduction: r(
        -socialW,
        `${couple || children.length ? 'Married couple' : 'Single person'}${charges ? ` + ${fr(wsV.perCharge)} x ${charges} charges` : ''}, at most the net wealth: ${fr(socialW)}.`,
        GE.wealthSocial.source,
      ),
      taxableWealth: r(
        taxableWealth,
        `Net wealth ${fr(netWealth)} less ${fr(socialW)}: ${fr(taxableWealth)}.${estimateNote}`,
        GE.wealthSocial.source,
      ),
      wealthBase: r(
        wealthBase,
        `The base wealth scale at ${fr(taxableWealth)}: ${fr(wealthBase)}.`,
        GE.wealthScale.source,
      ),
      wealthSupplementary: r(
        supplementary,
        `The supplementary scale at ${fr(taxableWealth)}: ${fr(supplementary)}, no centimes on it.`,
        GE.wealthSupplementary.source,
      ),
      cantonalWealth: r(
        cantonalWealth,
        `Base ${fr(wealthBase)} + 47.5 % ${fr(wl.cc)} + 1 % ${fr(wl.hc)} + supplementary ${fr(supplementary)} = ${fr(cantonalWealth)}.`,
        GE.cantonalCentimes.source,
      ),
      communalWealth: r(
        wl.comm,
        `${communeRate / 100} centimes on ${fr(wealthBase)}: ${fr(wl.comm)}.`,
        COMMUNES[year].source,
      ),
      communal: r(inc.comm + wl.comm, 'Communal income and wealth tax.', COMMUNES[year].source),
      personalTax: r(
        personalTax,
        personalTax ? 'Taxe personnelle, one per household.' : 'Exempt.',
        GE.personalTax.source,
      ),
      total: r(
        iccTotal,
        `Cantonal income ${fr(cantonalIncome)} + cantonal wealth ${fr(cantonalWealth)} + communal ${fr(inc.comm + wl.comm)} + taxe personnelle ${fr(personalTax)} = ${fr(iccTotal)}.${provisional ? ' Provisional: Geneva 2026 scales and amounts not published yet.' : ''}`,
        `${GUIDE} p. 48 and 49`,
      ),
      ...((Y.salaries ?? []).some((x) => x.sourceTax)
        ? {
            sourceTaxWithheld: r(
              (Y.salaries ?? []).reduce((t, x) => t + (x.sourceTax ?? 0), 0),
              `Tax taken at source by the employers (box 12): ${(Y.salaries ?? [])
                .filter((x) => x.sourceTax)
                .map((x) => fr(x.sourceTax))
                .join(
                  ' + ',
                )}. In TOU it counts towards the tax (taken off the bordereaux); it is not part of it.`,
              `${GUIDE} p. 52 and 53 (TOU)`,
            ),
          }
        : {}),
      ...(withholding
        ? {
            withholdingTaxCredit: r(
              withholding,
              `35 % of the income subject to the withholding tax, to 5 centimes: ${fr(withholding)} (an imputation on the bordereau, not part of the tax).`,
              `${GUIDE} p. 39`,
            ),
          }
        : {}),
      ...(iic !== undefined
        ? {
            iic: {
              amount: iic,
              how: `Impôt immobilier complémentaire, 0.2 per mille of the tax value ${fr(property.taxValue)} (main residence, no abattement, no debts): ${(iic / 100).toFixed(4)}. A tax of its own, not in the total.`,
              source: GE.iic.source,
            },
          }
        : {}),
    },
    ifd: {
      lines: ifd.map((l) => ({ ...l, person: who(l.person) })),
      netIncome: r(
        netIfd,
        'Net income (before the social deductions).',
        `${F.instructions} p. 8 and 9`,
      ),
      socialDeductions: ifdSocial.map((l) => ({ ...l, person: who(l.person) })),
      taxableIncome: r(
        ifdNet,
        `Net income ${fr(netIfd)} less the social deductions ${fr(-sum(ifdSocial))}: ${fr(ifdNet)} (chiffre 24, revenu imposable).`,
        `${F.instructions} p. 9 (chiffre 24)`,
      ),
      scaleIncome: r(
        taxableIfd,
        `The scale is read at the taxable income without its fraction under CHF 100: ${fr(taxableIfd)}.`,
        `${F.source}; ${F.instructions} p. 10 (barème, note 1: "Les fractions inférieures à CHF 100 sont abandonnées")`,
      ),
      scale,
      scaleTax: r(
        scaleTax,
        `The ${scale === 'single' ? 'single' : 'married'} scale at ${fr(taxableIfd)}: ${fr(scaleTax)}.`,
        F.source,
      ),
      childReduction: r(
        childReduction,
        childReduction ? `263 x ${children.length} children.` : 'No child.',
        `${F.source} (al. 2bis)`,
      ),
      tax: r(
        ifdTax,
        `${fr(scaleTax)} less ${fr(childReduction)}, rounded down to 5 centimes${ifdTax === 0 ? ', and under 25 not levied' : ''}: ${fr(ifdTax)}.`,
        `${F.source} (al. 2bis and 3)`,
      ),
    },
    total: r(iccTotal + ifdTax, `ICC ${fr(iccTotal)} + IFD ${fr(ifdTax)}.`, ''),
  };
}

function threePercentOrClamp(base, min, max, what) {
  const raw = (base * 3) / 100;
  if (raw <= min) return min;
  if (raw >= max) return max;
  return threePercent(base, what);
}

/** The value of a position: quantity x unit price, whole francs. */
export function secValue(x) {
  const v = Math.round(x.quantity * x.unitPrice * 100);
  if (v % 100 !== 0) throw new Error(`security value not whole francs: ${x.name}`);
  return v;
}

/** 35 % of the income subject to the withholding tax (guide p. 39: to 5 centimes). */
function iaOf(income) {
  return round5(income * 35, 100);
}

function ageClass(kit, person, year) {
  const p = kit.people.find((x) => x.id === person);
  if (p) {
    const age = year - Number(p.born.slice(0, 4));
    return age >= 26 ? 'adult' : age >= 19 ? 'young' : 'child';
  }
  return 'child';
}

// ---- Output ---------------------------------------------------------------------------------------

export function expectedFor(kit) {
  return {
    kit: kit.slug,
    household: kit.title,
    note: 'Worked out by hand from the official documents (test/fixtures/households/ground-truth.mjs, which imports nothing from Taxpresso). Money in centimes. Each figure gives how it was obtained and its source: the manifest id of the document in docs/sources and the page or article.',
    years: Object.fromEntries(Object.keys(kit.years).map((y) => [y, computeKit(kit, Number(y))])),
  };
}

/**
 * The transcription checked against the documents themselves: each printed step total is the one
 * below plus the step at its rate, and the worked examples come out as printed.
 */
export function selfCheck() {
  const fail = (what) => {
    throw new Error(`self-check: ${what}`);
  };
  for (const [name, rows, den] of [
    ['income', ICC_INCOME_SCALE, 10_000],
    ['wealth', ICC_WEALTH_SCALE, 10_000_000],
    ['supplementary', ICC_WEALTH_SUPPLEMENTARY, 10_000_000],
  ]) {
    let prevTo = 0;
    let prevTotal = 0;
    for (const [from, to, rate, total] of rows) {
      if (total === null) break;
      const width = to - (from <= 1 ? 0 : prevTo);
      const step = Math.round((width * 100 * rate) / den / 5) * 5;
      if (Math.abs(prevTotal + step - total) > 5) fail(`${name} step ${from}-${to}`);
      prevTo = to;
      prevTotal = total;
    }
  }
  const checks = [
    // ge-2025-icc-tariff-pdf p. 3, examples 1 and 2; guide p. 48, example 1.
    [genevaScale(ICC_INCOME_SCALE, 77_518_00, 10_000), 6_996_00],
    [genevaScale(ICC_INCOME_SCALE, 50_000_00, 10_000), 3_363_60],
    [genevaScale(ICC_INCOME_SCALE, 39_320_00, 10_000), 2_012_25],
    // Example 3: married, 96'618, half 48'309: 3'140.40 x 2.
    [2 * genevaScale(ICC_INCOME_SCALE, 48_309_00, 10_000), 6_280_80],
    // ge-2025-icc-tariff-pdf p. 6 (356'000) and guide p. 49 and 50 (360'000).
    [genevaScale(ICC_WEALTH_SCALE, 356_000_00, 10_000_000), 681_65],
    [genevaScale(ICC_WEALTH_SUPPLEMENTARY, 356_000_00, 10_000_000), 25_35],
    [genevaScale(ICC_WEALTH_SCALE, 360_000_00, 10_000_000), 691_85],
    [genevaScale(ICC_WEALTH_SUPPLEMENTARY, 360_000_00, 10_000_000), 26_40],
    // The federal scales at a step's start give the printed tax.
    [federalScale(IFD[2025].single, 76_100_00), 1_149_55],
    [federalScale(IFD[2025].married, 108_600_00), 2_246_00],
    [federalScale(IFD[2026].single, 82_100_00), 1_502_95],
    [federalScale(IFD[2026].married, 130_500_00), 3_658_00],
  ];
  checks.forEach(([got, want], i) => {
    if (got !== want) fail(`example ${i + 1}: ${got} instead of ${want}`);
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  selfCheck();
  for (const kit of KITS) {
    const out = expectedFor(kit);
    mkdirSync(path.join(here, kit.slug), { recursive: true });
    const file = path.join(here, kit.slug, 'expected.json');
    const options = (await prettier.resolveConfig(file)) ?? {};
    writeFileSync(file, await prettier.format(JSON.stringify(out), { ...options, parser: 'json' }));
    for (const [y, v] of Object.entries(out.years)) {
      console.log(
        `${kit.slug} ${y}: ICC ${fr(v.icc.total.amount)} (taxable ${fr(v.icc.taxableIncome.amount)}, wealth ${fr(v.icc.taxableWealth.amount)}), IFD ${fr(v.ifd.tax.amount)} (taxable ${fr(v.ifd.taxableIncome.amount)}, scale at ${fr(v.ifd.scaleIncome.amount)}), total ${fr(v.total.amount)}`,
      );
    }
  }
}
