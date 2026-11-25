#!/usr/bin/env node
// Dev tool, needs network: for the cantons other than Geneva, records what the Federal Tax
// Administration's own calculator (swisstaxcalculator.estv.admin.ch) holds and computes, into
// test/golden/estv/<canton>-<year>.json:
//
// - `rates`: the multipliers of every commune of the canton (canton, commune, the three churches),
//   on income and on wealth, by BFS number;
// - `cases`: the taxes of made-up cases in the canton's capital, from the taxable income of each
//   tax and the taxable wealth: four households, a range of incomes and of wealth, and the three
//   churches.
//
// Each canton's engine is then compared with its file offline (packages/rules-<canton>/test).
// SPEC.md section 13, item 2: a dev-time cross-check, never called at runtime; the extension itself
// makes no network call. Geneva has its own, finer recorder: scripts/estv-golden.mjs.
//
//   node scripts/estv-cantons-golden.mjs                    every canton, 2025 and 2026
//   node scripts/estv-cantons-golden.mjs --canton zh,be     only these
//   node scripts/estv-cantons-golden.mjs --year 2026        one year
//
// Only made-up round figures are sent: no person, no document. One request at a time, with a pause.
//
// Node 22+, no dependencies.

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const opt = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const years = opt('--year') ? [Number(opt('--year'))] : [2025, 2026];

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(repoRoot, 'test', 'golden', 'estv');
const BASE =
  'https://swisstaxcalculator.estv.admin.ch/delegate/ost-integration/v1/lg-proxy/operation/c3b67379_ESTV';
const PAUSE_MS = 120;

/** The calculator's number of each canton, and the BFS number of its capital. */
const CANTONS = {
  zh: { id: 26, capital: 261, name: 'Zürich' },
  be: { id: 4, capital: 351, name: 'Bern' },
  vd: { id: 23, capital: 5586, name: 'Lausanne' },
  bs: { id: 6, capital: 2701, name: 'Basel' },
  bl: { id: 5, capital: 2829, name: 'Liestal' },
  fr: { id: 7, capital: 2196, name: 'Fribourg' },
  ti: { id: 21, capital: 5002, name: 'Bellinzona' },
  lu: { id: 12, capital: 1061, name: 'Luzern' },
  ag: { id: 1, capital: 4001, name: 'Aarau' },
  sg: { id: 16, capital: 3203, name: 'St. Gallen' },
  zg: { id: 25, capital: 1711, name: 'Zug' },
};
const cantons = (opt('--canton')?.split(',') ?? Object.keys(CANTONS)).map((c) =>
  c.trim().toLowerCase(),
);
for (const c of cantons) if (!CANTONS[c]) throw new Error(`Unknown canton: ${c}`);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function post(operation, body) {
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(`${BASE}/${operation}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(40_000),
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

/**
 * Households as the calculator takes them. Relationship 1 is a person alone, 2 a married couple.
 * Confession: 1 reformed, 2 Roman Catholic, 3 Christian Catholic, 5 other or none (no church tax).
 */
const household = (relationship, children, confession = 5) => ({
  Relationship: relationship,
  Confession1: confession,
  Confession2: relationship === 2 ? confession : 0,
  Children: children.map((Age) => ({ Age })),
});
const HOUSEHOLDS = {
  single: household(1, []),
  married: household(2, []),
  married2: household(2, [5, 9]),
  single1: household(1, [5]),
  singleReformed: household(1, [], 1),
  singleCatholic: household(1, [], 2),
  singleChristCatholic: household(1, [], 3),
  marriedReformed: household(2, [], 1),
};

const INCOMES = [
  0, 5_000, 7_300, 10_000, 13_333, 15_000, 20_000, 25_000, 30_000, 33_333, 35_000, 40_000, 45_000,
  50_000, 55_000, 60_000, 61_700, 70_000, 80_000, 90_000, 99_999, 100_000, 110_000, 123_456,
  150_000, 175_000, 200_000, 250_000, 300_000, 400_000, 500_000, 750_000, 1_000_000, 2_000_000,
  5_000_000,
];
const WEALTH = [
  50_000, 100_000, 150_000, 200_000, 300_000, 500_000, 800_000, 1_000_000, 1_500_000, 2_000_000,
  3_000_000, 5_000_000, 10_000_000,
];

function grid() {
  const cases = [];
  for (const h of ['single', 'married', 'married2', 'single1'])
    for (const income of INCOMES) cases.push({ household: h, income, wealth: 0 });
  for (const h of ['single', 'married'])
    for (const wealth of WEALTH) cases.push({ household: h, income: 60_000, wealth });
  for (const h of ['singleReformed', 'singleCatholic', 'singleChristCatholic', 'marriedReformed'])
    for (const [income, wealth] of [
      [60_000, 0],
      [150_000, 500_000],
    ])
      cases.push({ household: h, income, wealth });
  return cases;
}

/** The calculator's own total is left out: it is the sum of these. */
const KEEP = [
  'IncomeSimpleTaxCanton',
  'IncomeSimpleTaxCity',
  'IncomeTaxCanton',
  'IncomeTaxCity',
  'IncomeTaxChurch',
  'FortuneSimpleTaxCanton',
  'FortuneSimpleTaxCity',
  'FortuneTaxCanton',
  'FortuneTaxCity',
  'FortuneTaxChurch',
  'PersonalTax',
  'IncomeTaxFed',
];

await mkdir(outDir, { recursive: true });
for (const code of cantons) {
  const canton = CANTONS[code];
  for (const taxYear of years) {
    const rows = await post('API_exportManySimpleRates', {
      SimKey: null,
      TaxYear: taxYear,
      TaxGroupID: canton.id,
    });
    const rates = rows
      .map((r) => ({
        bfs: r.Location.BfsID,
        name: r.Location.BfsName,
        income: {
          canton: r.IncomeRateCanton,
          commune: r.IncomeRateCity,
          reformed: r.IncomeRateProtestant,
          catholic: r.IncomeRateRoman,
          christCatholic: r.IncomeRateChrist,
        },
        wealth: {
          canton: r.FortuneRateCanton,
          commune: r.FortuneRateCity,
          reformed: r.FortuneRateProtestant,
          catholic: r.FortuneRateRoman,
          christCatholic: r.FortuneRateChrist,
        },
      }))
      .sort((a, b) => a.bfs - b.bfs);
    const capital = rows.find((r) => r.Location.BfsID === canton.capital);
    if (!capital) throw new Error(`${code} ${taxYear}: no ${canton.name} (BFS ${canton.capital}).`);

    const cases = [];
    const todo = grid();
    for (const [n, c] of todo.entries()) {
      const response = await post('API_calculateSimpleTaxes', {
        SimKey: null,
        TaxYear: taxYear,
        TaxLocationID: capital.Location.TaxLocationID,
        ...HOUSEHOLDS[c.household],
        TaxableIncomeCanton: c.income,
        TaxableIncomeFed: c.income,
        TaxableFortune: c.wealth,
      });
      const estv = {};
      for (const k of KEEP) {
        if (typeof response[k] !== 'number')
          throw new Error(`${code} ${taxYear} case ${n}: no ${k}.`);
        estv[k] = response[k];
      }
      if (response.Location?.BfsID !== canton.capital)
        throw new Error(`${code} ${taxYear} case ${n}: answered for another commune.`);
      cases.push({ ...c, estv });
    }

    const head = JSON.stringify(
      {
        what: 'What the Federal Tax Administration’s calculator holds and computes: the multipliers of every commune of the canton, in percent, and the taxes of made-up cases in its capital, from the taxable income of each tax and the taxable wealth, in whole francs.',
        calculator: 'https://swisstaxcalculator.estv.admin.ch/',
        operations: ['API_exportManySimpleRates', 'API_calculateSimpleTaxes'],
        writtenBy: 'node scripts/estv-cantons-golden.mjs',
        canton: code.toUpperCase(),
        capital: { bfs: canton.capital, name: canton.name },
        households: HOUSEHOLDS,
        taxYear,
        retrievedOn: new Date().toISOString().slice(0, 10),
      },
      null,
      2,
    ).replace(/\n\}$/, '');
    const list = (items) => items.map((x) => `    ${JSON.stringify(x)}`).join(',\n');
    const file = path.join(outDir, `${code}-${taxYear}.json`);
    await writeFile(
      file,
      `${head},\n  "rates": [\n${list(rates)}\n  ],\n  "cases": [\n${list(cases)}\n  ]\n}\n`,
    );
    console.error(
      `${code} ${taxYear}: ${rates.length} communes, ${cases.length} cases written to ${path.relative(repoRoot, file)}`,
    );
  }
}
