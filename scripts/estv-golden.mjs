#!/usr/bin/env node
// Dev tool, needs network: records what the Federal Tax Administration's own calculator
// (swisstaxcalculator.estv.admin.ch, "Calculateur d'impôts" of the AFC/ESTV) computes for a fixed
// grid of Geneva cases, into test/golden/estv/ge-<year>.json. The engine is then compared with the
// recorded figures offline (packages/rules-ge/test/estv-golden.test.ts). SPEC.md section 13, item
// 2: a dev-time cross-check, never called at runtime; the extension itself makes no network call.
//
//   node scripts/estv-golden.mjs                 record 2025 and 2026
//   node scripts/estv-golden.mjs --year 2026     one year
//   node scripts/estv-golden.mjs --check         record in memory and report what changed since
//                                                the files were written (exit 1 if anything did)
//
// The calculator's "simple" computation takes the taxable income of each tax and the taxable
// wealth as given, so it checks the scales, the splitting, the centimes, the communal tax and the
// federal tax, and nothing about the deductions. Only made-up round figures are sent: no person,
// no document. One request at a time, with a pause.
//
// Node 22+, no dependencies.

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const opt = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const checkOnly = args.includes('--check');
const years = opt('--year') ? [Number(opt('--year'))] : [2025, 2026];

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(repoRoot, 'test', 'golden', 'estv');
const BASE =
  'https://swisstaxcalculator.estv.admin.ch/delegate/ost-integration/v1/lg-proxy/operation/c3b67379_ESTV';
const PAUSE_MS = 120;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function post(operation, body) {
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(`${BASE}/${operation}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(30_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (!json || json.response === undefined) throw new Error('no response field');
      await sleep(PAUSE_MS);
      return json.response;
    } catch (err) {
      if (attempt >= 4) throw new Error(`${operation}: ${err.message ?? err}`, { cause: err });
      await sleep(1000 * attempt);
    }
  }
}

// ---- Geneva's communes: the calculator's location of each (its BFS number is 6600 + the
// commune's official number, packages/rules-ge/src/2026/communes.ts) -----------------------------

const communesSource = await readFile(
  path.join(repoRoot, 'packages', 'rules-ge', 'src', '2026', 'communes.ts'),
  'utf8',
);
const COMMUNES = [
  ...communesSource.matchAll(/\{ no: (\d+), slug: '([^']+)', name: '([^']+)' \}/g),
].map((m) => ({ no: Number(m[1]), slug: m[2], name: m[3] }));
if (COMMUNES.length !== 45) throw new Error(`Expected 45 communes, read ${COMMUNES.length}.`);

/** The calculator searches localities, not communes: the locality to search for these four. */
const SEARCH = {
  'collex-bossy': 'Collex',
  'perly-certoux': 'Perly',
  'pregny-chambesy': 'Chambésy',
  vandoeuvres: 'Vandoeuvres',
};

async function locations(taxYear) {
  const found = {};
  for (const c of COMMUNES) {
    const list = await post('API_searchLocation', {
      Search: SEARCH[c.slug] ?? c.name,
      Language: 2,
      TaxYear: taxYear,
    });
    const match = list.find((l) => l.Canton === 'GE' && l.BfsID === 6600 + c.no);
    if (!match) throw new Error(`${taxYear}: no location for ${c.name} (BFS ${6600 + c.no}).`);
    found[c.slug] = { taxLocationId: match.TaxLocationID, bfs: match.BfsID };
  }
  return found;
}

// ---- The grid -----------------------------------------------------------------------------------

/**
 * Households as the calculator takes them. Relationship 1 is a person alone, 2 a married couple;
 * Confession 5 is "other or none" (Geneva has no church tax in the tax bill).
 */
const HOUSEHOLDS = {
  single: { Relationship: 1, Confession1: 5, Confession2: 0, Children: [] },
  married: { Relationship: 2, Confession1: 5, Confession2: 5, Children: [] },
  married2: { Relationship: 2, Confession1: 5, Confession2: 5, Children: [{ Age: 5 }, { Age: 9 }] },
  single1: { Relationship: 1, Confession1: 5, Confession2: 0, Children: [{ Age: 5 }] },
};

/** The last franc of each bracket of the income scales: ge-2025-icc-tariff-pdf p. 2, ge-2026-rcepf art. 17. */
const INCOME_STEPS = [
  18_649, 22_469, 24_716, 26_962, 29_210, 34_827, 39_320, 43_815, 48_309, 77_518, 126_950, 170_764,
  193_234, 276_369, 294_345, 414_554, 649_355, 18_700, 22_530, 24_784, 27_036, 29_290, 34_922,
  39_428, 43_935, 48_441, 77_730, 127_297, 171_231, 193_762, 277_125, 295_150, 415_688, 651_131,
];
/** The same for the two wealth scales: ge-2025-icc-tariff-pdf p. 5, ge-2026-rcepf art. 18. */
const WEALTH_STEPS = [
  118_398, 236_795, 355_193, 473_591, 710_387, 947_182, 1_183_977, 1_420_773, 1_775_966, 3_551_932,
  118_722, 237_443, 356_165, 474_886, 712_330, 949_772, 1_187_215, 1_424_658, 1_780_823, 3_561_646,
];
const withSteps = (values, steps) =>
  [...new Set([...values, ...steps.flatMap((s) => [s, s + 1])])].sort((x, y) => x - y);

/** Taxable incomes in francs: round ones, odd ones, and both sides of every step of both years. */
const INCOMES = withSteps(
  [
    0, 5_000, 10_000, 15_000, 17_000, 20_000, 25_000, 30_000, 33_333, 37_300, 40_000, 45_000,
    50_000, 55_000, 61_700, 70_000, 80_000, 86_949, 90_000, 99_999, 100_000, 110_000, 123_456,
    150_000, 200_000, 250_000, 300_000, 350_000, 500_000, 700_000, 800_000, 1_000_000, 1_500_000,
    2_000_000, 5_000_000,
  ],
  INCOME_STEPS,
);

/** Taxable wealth in francs, with both sides of every step of both years. */
const WEALTH = withSteps(
  [
    0, 50_000, 150_000, 300_000, 500_000, 800_000, 1_000_000, 1_500_000, 2_000_000, 3_000_000,
    4_000_000, 5_000_000, 10_000_000,
  ],
  WEALTH_STEPS,
);

function grid() {
  const cases = [];
  // 1. Every income for every household, in the City of Geneva, without wealth.
  for (const household of Object.keys(HOUSEHOLDS))
    for (const income of INCOMES) cases.push({ commune: 'geneve', household, income, wealth: 0 });
  // 2. Every wealth for a person alone and for a couple, in the City of Geneva.
  for (const household of ['single', 'married'])
    for (const wealth of WEALTH)
      if (wealth > 0) cases.push({ commune: 'geneve', household, income: 60_000, wealth });
  // 3. Every commune, two incomes with wealth, for a person alone.
  for (const c of COMMUNES)
    for (const [income, wealth] of [
      [60_000, 0],
      [150_000, 800_000],
    ])
      if (!(c.slug === 'geneve' && wealth === 0))
        cases.push({ commune: c.slug, household: 'single', income, wealth });
  return cases;
}

const KEEP = [
  'IncomeSimpleTaxCanton',
  'IncomeTaxCanton',
  'IncomeTaxCity',
  'FortuneSimpleTaxCanton',
  'FortuneTaxCanton',
  'FortuneTaxCity',
  'PersonalTax',
  'IncomeTaxFed',
  'TotalTax',
];

async function record(taxYear) {
  const where = await locations(taxYear);
  const cases = [];
  const todo = grid();
  for (const [n, c] of todo.entries()) {
    const response = await post('API_calculateSimpleTaxes', {
      SimKey: null,
      TaxYear: taxYear,
      TaxLocationID: where[c.commune].taxLocationId,
      ...HOUSEHOLDS[c.household],
      TaxableIncomeCanton: c.income,
      TaxableIncomeFed: c.income,
      TaxableFortune: c.wealth,
    });
    const estv = {};
    for (const k of KEEP) {
      if (typeof response[k] !== 'number') throw new Error(`${taxYear} case ${n}: no ${k}.`);
      estv[k] = response[k];
    }
    if (response.Location?.BfsID !== where[c.commune].bfs)
      throw new Error(`${taxYear} case ${n}: answered for another commune.`);
    cases.push({ ...c, estv });
    if ((n + 1) % 50 === 0) console.error(`${taxYear}: ${n + 1} of ${todo.length}`);
  }
  return { taxYear, cases };
}

const HEADER = {
  what: 'What the Federal Tax Administration’s calculator computes for made-up Geneva cases, from the taxable income of each tax and the taxable wealth. Amounts in whole francs, as it gives them.',
  calculator: 'https://swisstaxcalculator.estv.admin.ch/',
  operation: 'API_calculateSimpleTaxes',
  writtenBy: 'node scripts/estv-golden.mjs',
  households: HOUSEHOLDS,
};

await mkdir(outDir, { recursive: true });
let changed = 0;
for (const taxYear of years) {
  const { cases } = await record(taxYear);
  const file = path.join(outDir, `ge-${taxYear}.json`);
  if (checkOnly) {
    let before;
    try {
      before = JSON.parse(await readFile(file, 'utf8')).cases;
    } catch {
      before = [];
    }
    const key = (c) => `${c.commune} ${c.household} ${c.income} ${c.wealth}`;
    const old = new Map(before.map((c) => [key(c), JSON.stringify(c.estv)]));
    for (const c of cases) {
      if (old.get(key(c)) !== JSON.stringify(c.estv)) {
        changed++;
        console.log(
          `${taxYear} changed: ${key(c)}: ${old.get(key(c)) ?? 'new'} -> ${JSON.stringify(c.estv)}`,
        );
      }
    }
    console.error(`${taxYear}: ${cases.length} cases compared.`);
    continue;
  }
  const lines = cases.map((c) => `    ${JSON.stringify(c)}`).join(',\n');
  const head = JSON.stringify(
    { ...HEADER, taxYear, retrievedOn: new Date().toISOString().slice(0, 10) },
    null,
    2,
  ).replace(/\n\}$/, '');
  await writeFile(file, `${head},\n  "cases": [\n${lines}\n  ]\n}\n`);
  console.error(`${taxYear}: ${cases.length} cases written to ${path.relative(repoRoot, file)}`);
}
if (checkOnly && changed) process.exit(1);
