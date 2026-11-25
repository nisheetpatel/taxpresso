#!/usr/bin/env node
// Dev tool, needs network: records what the Geneva tax administration's own estimator computes
// ("Simulation fiscale", ge.ch/afcaelp1dmapublic/<year>, linked from the AFC page "Estimer mon
// impôt, modifier mes acomptes") for a fixed grid of made-up cases, into
// test/golden/afc/ge-<year>.json. The engine is then compared with the recorded figures offline
// (packages/rules-ge/test/afc-golden.test.ts). SPEC.md section 13, item 2: a dev-time cross-check,
// never called at runtime; the extension itself makes no network call.
//
//   node scripts/ge-afc-golden.mjs                 record 2025 and 2026
//   node scripts/ge-afc-golden.mjs --year 2026     one year
//   node scripts/ge-afc-golden.mjs --probe single:6621:100000:200000 --year 2026
//                                                  one case (household:BFS:income:wealth), printed
//
// The estimator is a form in four steps. This script fills steps 1 and 2 with made-up round
// figures (no person, no document), reads the result of step 3, and stops there: step 4 would ask
// for new instalments (acomptes), and is never opened. One case at a time, with a pause.
//
// The estimator answers to 5 centimes with every line of the bill: the taxable income and wealth
// it arrives at (so its family charges and its deductions on wealth), the base taxes, the 12 %
// reduction, the cantonal centimes, the home care centime, the privileged share and the communal
// centimes of each commune, the taxe personnelle and the federal tax.
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
const years = opt('--year') ? [Number(opt('--year'))] : [2025, 2026];
const probe = opt('--probe');

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(repoRoot, 'test', 'golden', 'afc');
const PAUSE_MS = 250;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const latin1 = new TextDecoder('iso-8859-1');

// ---- The form -----------------------------------------------------------------------------------

/** One anonymous visit: its cookies, kept by hand (fetch keeps none). */
class Visit {
  constructor(year) {
    this.base = `https://ge.ch/afcaelp1dmapublic/${year}/`;
    this.cookies = new Map();
  }
  async request(url, form) {
    let target = url;
    let body = form ? new URLSearchParams(form).toString() : undefined;
    for (let hop = 0; hop < 6; hop++) {
      const res = await fetch(target, {
        method: body ? 'POST' : 'GET',
        redirect: 'manual',
        headers: {
          ...(body ? { 'content-type': 'application/x-www-form-urlencoded' } : {}),
          ...(this.cookies.size
            ? { cookie: [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; ') }
            : {}),
        },
        body,
        signal: AbortSignal.timeout(40_000),
      });
      for (const c of res.headers.getSetCookie()) {
        const [pair] = c.split(';');
        const eq = pair.indexOf('=');
        this.cookies.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
      }
      if (res.status >= 300 && res.status < 400) {
        target = new URL(res.headers.get('location'), target).href;
        body = undefined;
        continue;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status} at ${target}`);
      return latin1.decode(await res.arrayBuffer());
    }
    throw new Error('too many redirects');
  }
}

const decode = (s) =>
  s
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&([a-z]+);/gi, (m, name) => ENTITIES[name] ?? m)
    .replace(/\s+/g, ' ')
    .trim();
const ENTITIES = {
  amp: '&',
  quot: '"',
  apos: "'",
  lt: '<',
  gt: '>',
  eacute: 'é',
  egrave: 'è',
  ecirc: 'ê',
  agrave: 'à',
  acirc: 'â',
  ocirc: 'ô',
  ccedil: 'ç',
  icirc: 'î',
  ucirc: 'û',
};

/** Every field of the page's form with its default: 0 for amounts, N for the yes/no radio. */
function fields(html) {
  const form = {};
  for (const m of html.matchAll(/<(input|select)\b[^>]*>/g)) {
    const tag = m[0];
    const name = /\bname="([^"]+)"/.exec(tag)?.[1];
    if (!name) continue;
    const type = /\btype="([^"]+)"/.exec(tag)?.[1] ?? (m[1] === 'select' ? 'select' : 'text');
    if (type === 'hidden') form[name] = decodeAttr(/\bvalue="([^"]*)"/.exec(tag)?.[1] ?? '');
    else if (type === 'checkbox') continue;
    else if (type === 'radio') form[name] = 'N';
    else if (type === 'text' || type === 'select') form[name] = '0';
  }
  return form;
}
const decodeAttr = (s) => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"');

/** The result page's tables, row by row: [label, cell, cell, cell]. */
function rows(html) {
  const out = [];
  for (const tr of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/g)) {
    const cells = [...tr[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/g)].map((c) =>
      decode(c[1].replace(/<[^>]+>/g, ' ')),
    );
    if (cells.length) out.push(cells);
  }
  return out;
}

/** "14'107.90" as centimes. */
function centimes(text) {
  const clean = text.replace(/['’\s]/g, '');
  if (!/^-?\d+\.\d{2}$/.test(clean)) throw new Error(`not an amount: "${text}"`);
  const negative = clean.startsWith('-');
  const [francs, cents] = clean.replace('-', '').split('.');
  return (negative ? -1 : 1) * (Number(francs) * 100 + Number(cents));
}

/**
 * The lines of the result (step 3), named. The page lists, in this order: the totals; the ICC
 * bases; the income tax lines; the wealth tax lines; the other lines; the IFD base.
 */
function parseResult(html) {
  if (!/Etape 3 sur 4/.test(html)) {
    const said = [...html.matchAll(/class="[^"]*erreur[^"]*"[^>]*>([\s\S]*?)</g)].map((m) =>
      decode(m[1]),
    );
    throw new Error(`no result page${said.length ? `: ${said.join(' | ')}` : ''}`);
  }
  const all = rows(html);
  const sectionOf = (title) => {
    const start = all.findIndex((r) => r[0] === title);
    if (start < 0) throw new Error(`no section "${title}"`);
    let end = all.findIndex((r, i) => i > start && HEADS.includes(r[0]));
    if (end < 0) end = all.length;
    return all.slice(start + 1, end);
  };
  const HEADS = [
    'Total',
    'Assiettes fiscales ICC',
    'Impôts sur le revenu',
    'Impôt sur la fortune',
    'Autres',
    'Assiettes fiscales IFD',
  ];
  const find = (section, label, nth = 0) => {
    const hits = section.filter((r) => r[0].startsWith(label));
    if (!hits[nth]) throw new Error(`no line "${label}"${nth ? ` (${nth + 1})` : ''}`);
    return hits[nth];
  };
  const last = (r) => centimes(r[r.length - 1]);
  const base = (r) => centimes(r[1]);

  const top = all.slice(
    0,
    all.findIndex((r) => r[0] === 'Assiettes fiscales ICC'),
  );
  const iccBases = sectionOf('Assiettes fiscales ICC');
  const income = sectionOf('Impôts sur le revenu');
  const wealth = sectionOf('Impôt sur la fortune');
  const other = sectionOf('Autres');
  const ifdBases = sectionOf('Assiettes fiscales IFD');
  const communal = (section) => {
    const privileged = find(section, 'Part privilégiée');
    const rest = find(section, 'Centimes additionnels communaux');
    return {
      privilegedBase: base(privileged),
      ratePercent: privileged[2],
      privileged: last(privileged),
      restBase: base(rest),
      rest: last(rest),
      total: last(find(section, 'Total impôts communaux')),
    };
  };
  return {
    iccTotal: last(find(top, 'Total impôts cantonaux et communaux')),
    ifdTotal: last(find(top, 'Total impôt fédéral direct')),
    iccIncome: last(find(iccBases, 'Revenu')),
    iccWealth: last(find(iccBases, 'Fortune')),
    ifdIncome: last(find(ifdBases, 'Revenu')),
    income: {
      base: last(find(income, 'Impôt cantonal de base')),
      rateIncomePercent: find(income, 'Impôt cantonal de base')[2],
      reductionOnBase: last(find(income, 'Réduction 12% sur impôts de base')),
      cantonalCentimes: last(find(income, 'Centimes additionnels cantonaux')),
      homeCare: last(find(income, 'Centime additionnel aide')),
      reductionOnCentimes: last(find(income, 'Réduction 12% sur centimes')),
      cantonal: last(find(income, 'Total impôts cantonaux')),
      communal: communal(income),
    },
    wealth: {
      base: last(find(wealth, 'Impôt cantonal de base')),
      cantonalCentimes: last(find(wealth, 'Centimes additionnels cantonaux')),
      homeCare: last(find(wealth, 'Centime additionnel aide')),
      supplementary: last(find(wealth, 'Impôt supplémentaire')),
      cantonal: last(find(wealth, 'Total impôts cantonaux')),
      communal: communal(wealth),
    },
    personalTax: last(find(other, 'Taxe personnelle')),
  };
}

// ---- The grid -----------------------------------------------------------------------------------

/**
 * Households as the form's first step takes them. etatCivil: 0 célibataire, 2 divorcé-e, 4 marié-e.
 * "preponderance": living with a child one mainly supports; "alternee": shared custody half and
 * half without child support, the child counted as a half charge.
 */
const HOUSEHOLDS = {
  single: { etatCivil: 0 },
  married: { etatCivil: 4 },
  married2: { etatCivil: 4, nbEnfantsJeunes: 2 },
  married1older: { etatCivil: 4, nbEnfantsPasJeunes: 1 },
  single1: { etatCivil: 0, nbEnfantsJeunes: 1, preponderance: true },
  shared1: { etatCivil: 2, nbEnfantsJeunes: 1, nbDemiCharges: 1, alternee: true },
};

async function simulate(year, c) {
  const h = HOUSEHOLDS[c.household];
  const visit = new Visit(year);
  const page1 = await visit.request(visit.base);
  const form1 = {
    ...fields(page1),
    'page1Form.resident': '0',
    'page1Form.etatCivil': String(h.etatCivil),
    'page1Form.nbEnfantsJeunes': String(h.nbEnfantsJeunes ?? 0),
    'page1Form.nbEnfantsPasJeunes': String(h.nbEnfantsPasJeunes ?? 0),
    'page1Form.nbDemiCharges': String(h.nbDemiCharges ?? 0),
    'page1Form.nbAutresCharges': '0',
    ...(h.preponderance ? { 'page1Form.preponderanceEntretienEnfant': 'true' } : {}),
    ...(h.alternee ? { 'page1Form.gardeAlternee5050': 'true' } : {}),
    next: '',
  };
  const page2 = await visit.request(new URL('controlerPage1.do', visit.base).href, form1);
  if (!/page2Form\.communeTaxation/.test(page2)) throw new Error('step 2 did not open');
  const form2 = {
    ...fields(page2),
    'page2Form.communeTaxation': String(c.bfs),
    'page2Form.revenuTravailContribuable': String(c.income),
    'page2Form.fortuneTotale': String(c.wealth),
    next: '',
  };
  const page3 = await visit.request(new URL('controlerPage2.do', visit.base).href, form2);
  await sleep(PAUSE_MS);
  return parseResult(page3);
}

if (probe) {
  const [household, bfs, income, wealth] = probe.split(':');
  for (const year of years)
    console.log(
      year,
      JSON.stringify(
        await simulate(year, {
          household,
          bfs: Number(bfs),
          income: Number(income),
          wealth: Number(wealth),
        }),
        null,
        1,
      ),
    );
  process.exit(0);
}

const communesSource = await readFile(
  path.join(repoRoot, 'packages', 'rules-ge', 'src', '2026', 'communes.ts'),
  'utf8',
);
const COMMUNES = [
  ...communesSource.matchAll(/\{ no: (\d+), slug: '([^']+)', name: '([^']+)' \}/g),
].map((m) => ({ slug: m[2], bfs: 6600 + Number(m[1]) }));
if (COMMUNES.length !== 45) throw new Error(`Expected 45 communes, read ${COMMUNES.length}.`);
const GENEVE = COMMUNES.find((c) => c.slug === 'geneve');

/** The last franc of each bracket of the income scales: ge-2025-icc-tariff-pdf p. 2, ge-2026-rcepf art. 17. */
const INCOME_STEPS = {
  2025: [
    18_649, 22_469, 24_716, 26_962, 29_210, 34_827, 39_320, 43_815, 48_309, 77_518, 126_950,
    170_764, 193_234, 276_369, 294_345, 414_554, 649_355,
  ],
  2026: [
    18_700, 22_530, 24_784, 27_036, 29_290, 34_922, 39_428, 43_935, 48_441, 77_730, 127_297,
    171_231, 193_762, 277_125, 295_150, 415_688, 651_131,
  ],
};
/** The same for the two wealth scales: ge-2025-icc-tariff-pdf p. 5, ge-2026-rcepf art. 18. */
const WEALTH_STEPS = {
  2025: [
    118_398, 236_795, 355_193, 473_591, 710_387, 947_182, 1_183_977, 1_420_773, 1_775_966,
    3_551_932,
  ],
  2026: [
    118_722, 237_443, 356_165, 474_886, 712_330, 949_772, 1_187_215, 1_424_658, 1_780_823,
    3_561_646,
  ],
};
const INCOMES = [
  0, 12_000, 30_000, 45_000, 61_700, 80_000, 99_999, 123_456, 150_000, 200_000, 300_000, 500_000,
  1_000_000,
];
const sorted = (values) => [...new Set(values)].sort((x, y) => x - y);

function grid(year) {
  const cases = [];
  const add = (household, commune, income, wealth) =>
    cases.push({ household, commune: commune.slug, bfs: commune.bfs, income, wealth });
  // 1. A person alone in the City of Geneva: every step of the year's income scale, both sides.
  for (const income of sorted([...INCOMES, ...INCOME_STEPS[year].flatMap((s) => [s, s + 1])]))
    add('single', GENEVE, income, 0);
  // 2. The other households, on the round and odd incomes.
  for (const household of Object.keys(HOUSEHOLDS))
    if (household !== 'single') for (const income of INCOMES) add(household, GENEVE, income, 0);
  // 3. Wealth: every step of the year's wealth scales, for a person alone; some for a couple with
  //    two children (its deductions on wealth).
  for (const wealth of sorted([
    50_000,
    500_000,
    2_000_000,
    5_000_000,
    ...WEALTH_STEPS[year].flatMap((s) => [s + 87_000, s + 100_000, s + 200_000]),
  ]))
    add('single', GENEVE, 60_000, wealth);
  for (const wealth of [100_000, 300_000, 800_000, 2_500_000])
    for (const household of ['married', 'married2', 'single1', 'shared1'])
      add(household, GENEVE, 90_000, wealth);
  // 4. Every commune: its privileged share and its centimes, on income and on wealth.
  for (const commune of COMMUNES) if (commune !== GENEVE) add('single', commune, 150_000, 900_000);
  return cases;
}

await mkdir(outDir, { recursive: true });
for (const year of years) {
  const todo = grid(year);
  const cases = [];
  for (const [n, c] of todo.entries()) {
    let afc;
    for (let attempt = 1; ; attempt++) {
      try {
        afc = await simulate(year, c);
        break;
      } catch (err) {
        if (attempt >= 3)
          throw new Error(`${year} case ${n} ${JSON.stringify(c)}: ${err.message}`, {
            cause: err,
          });
        await sleep(2000 * attempt);
      }
    }
    cases.push({
      household: c.household,
      commune: c.commune,
      income: c.income,
      wealth: c.wealth,
      afc,
    });
    if ((n + 1) % 25 === 0) console.error(`${year}: ${n + 1} of ${todo.length}`);
  }
  const head = JSON.stringify(
    {
      what: 'What the Geneva tax administration’s estimator computes for made-up cases: a salary as the only income, no deduction entered, a wealth without property. Amounts in centimes.',
      estimator: `https://ge.ch/afcaelp1dmapublic/${year}/`,
      page: 'https://www.ge.ch/paiement-impots/estimer-mon-impot-modifier-mes-acomptes',
      writtenBy: 'node scripts/ge-afc-golden.mjs',
      households: HOUSEHOLDS,
      taxYear: year,
      retrievedOn: new Date().toISOString().slice(0, 10),
    },
    null,
    2,
  ).replace(/\n\}$/, '');
  const file = path.join(outDir, `ge-${year}.json`);
  const lines = cases.map((c) => `    ${JSON.stringify(c)}`).join(',\n');
  await writeFile(file, `${head},\n  "cases": [\n${lines}\n  ]\n}\n`);
  console.error(`${year}: ${cases.length} cases written to ${path.relative(repoRoot, file)}`);
}
