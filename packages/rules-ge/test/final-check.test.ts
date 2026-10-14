// The final check before filling in the official form (SPEC.md 10.0), on synthetic households:
// the Duponts of Vernier and Ana Ribeiro of Meyrin (fake people, fake figures). Every limit below is
// the engine's own, read in the document it cites; the test checks what the final check keeps and
// how it words it, never a tax rule of its own.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  computeReturn,
  finalCheck,
  limitPosition,
  nearMargin,
  OFFICIAL_DOCUMENTS,
  officialLinks,
  type ConsistencyCheck,
  type EngineInput,
  type FinalCheckInput,
  type LimitApplied,
} from '../src/index.js';

const chf = (francs: number) => Math.round(francs * 100);
const job = (gross: number, social: number, lpp: number) => ({
  gross: { value: chf(gross) },
  socialContributions: { value: chf(social) },
  pensionFund: { value: chf(lpp) },
});

/** H5 of households.test.ts: married, two incomes, two children, Vernier. */
const dupont = (taxYear: 2025 | 2026): EngineInput => ({
  taxYear,
  commune: 'vernier',
  civilStatus: 'married',
  people: [
    {
      id: 'p1',
      employments: [job(110_000, 7_300, 7_700)],
      pillar3a: { value: chf(7_258) },
      commuteCost: { value: chf(900) },
    },
    { id: 'p2', employments: [job(30_000, 1_990, 900)] },
  ],
  children: [
    { custody: 'full', under14: true, age: 'child', childcare: { value: chf(15_000) } },
    { custody: 'full', under14: true, age: 'child' },
  ],
  household: {
    healthPremiums: { value: chf(16_000) },
    medicalCosts: { value: chf(5_005) },
    donations: { value: chf(1_000) },
  },
});

/** H10 of households.test.ts: single, Meyrin, over 2 hours a day by public transport, lunches away. */
const ribeiro = (taxYear: 2025 | 2026): EngineInput => ({
  taxYear,
  commune: 'meyrin',
  civilStatus: 'single',
  people: [
    {
      id: 'p1',
      employments: [job(80_000, 5_200, 4_800)],
      pillar3a: { value: chf(7_258) },
      commuteMode: { by: 'public_transport' },
      commuteCost: { value: chf(1_200) },
      mealDays: 210,
      mealsIccAllowed: true,
    },
  ],
  household: { healthPremiums: { value: chf(5_000) } },
});

/** Nothing else to settle: answered, read, confirmed, no check, the official PDF not added yet. */
const clear = (input: EngineInput, over: Partial<FinalCheckInput> = {}): FinalCheckInput => ({
  taxYear: input.taxYear,
  couple: input.civilStatus === 'married',
  result: computeReturn(input),
  missing: [],
  ledgerNotes: [],
  notSupported: [],
  questionsOpen: 0,
  documents: { toRead: 0, toIdentify: 0, whose: 0 },
  requirements: [],
  checks: [],
  values: [],
  officialPdf: { status: 'none' },
  ...over,
});

const limits = (items: { limit?: LimitApplied & { position: string } }[]) =>
  items
    .filter((i) => i.limit)
    .map((i) => `${i.limit!.code} ${i.limit!.tax} ${i.limit!.kind} ${i.limit!.position}`);

describe('limits the engine applied', () => {
  it('records every cap, threshold, minimum and choice, with the amounts it kept', () => {
    const r = computeReturn(dupont(2025));
    const by = (code: string, tax: string, kind = 'cap') =>
      r.limits.find((l) => l.code === code && l.tax === tax && l.kind === kind);
    expect(by('31.40', 'both')).toMatchObject({
      given: chf(7_258),
      limit: chf(7_258),
      counted: chf(7_258),
      // The 2025 limits as the federal instructions for 2025 give them (Form. 2a, chiffre 13).
      source: 'ch-2025-ifd-instructions-personnes-physiques p. 7 (chiffre 13)',
    });
    // 2 x 17'122 + 2 x 3'965 (guide p. 29); IFD 3'700 + 2 x 700 (federal circular 2025, p. 2).
    expect(by('52.21', 'icc')).toMatchObject({ given: chf(16_000), limit: chf(42_174) });
    expect(by('52.00', 'ifd')).toMatchObject({
      given: chf(16_000),
      limit: chf(5_100),
      counted: chf(5_100),
    });
    // Medical costs above 0.5 % (ICC) and 5 % (IFD) of the subtotal 92.20, as in H5.
    expect(by('71.00', 'icc', 'threshold')).toMatchObject({
      given: chf(5_005),
      limit: chf(401),
      counted: chf(4_604),
    });
    expect(by('71.00', 'ifd', 'threshold')).toMatchObject({
      limit: chf(3_682),
      counted: chf(1_323),
    });
    expect(by('73.00', 'ifd', 'minimum')).toMatchObject({ given: chf(1_000), limit: chf(100) });
    // A's actual costs (the commute, 534 at most) against the flat 1'812: the flat is used.
    expect(by('31.50', 'icc', 'choice')).toMatchObject({
      given: chf(534),
      limit: chf(1_812),
      counted: chf(1_812),
    });
  });

  it('keeps each item equal to what its limit counted', () => {
    for (const input of [dupont(2025), dupont(2026), ribeiro(2025), ribeiro(2026)]) {
      const r = computeReturn(input);
      for (const l of r.limits.filter((x) => x.kind === 'cap' || x.kind === 'threshold')) {
        const lists =
          l.tax === 'ifd'
            ? [r.ifd!.items]
            : l.tax === 'icc'
              ? [r.icc!.items]
              : [r.icc!.items, r.ifd!.items];
        for (const items of lists) {
          const item = items.find((i) => i.code === l.code && i.person === l.person);
          expect(item?.amount ?? 0, `${l.code} ${l.tax}`).toBe(-l.counted);
        }
      }
    }
  });

  it('flags a Geneva limit of 2026 as an estimate, never a federal one', () => {
    const r = computeReturn(dupont(2026));
    expect(r.limits.find((l) => l.code === '52.21')?.estimate).toBe(true);
    expect(r.limits.find((l) => l.code === '52.00')).not.toHaveProperty('estimate');
    expect(r.limits.find((l) => l.code === '31.40')?.source).toBe(
      'ch-2026-ifd-instructions-personnes-physiques p. 7 (chiffre 13)',
    );
  });
});

describe('near a limit', () => {
  it('is within 5 % of the limit, at least CHF 100', () => {
    expect(nearMargin(chf(7_258))).toBe(36_290);
    expect(nearMargin(chf(500))).toBe(chf(100));
    expect(nearMargin(0)).toBe(chf(100));
  });

  it('shows a cap that cut an amount, whatever the distance, and one just under it', () => {
    const cap = { kind: 'cap' as const, limit: chf(1_000) };
    expect(limitPosition({ ...cap, given: chf(9_000) })).toBe('over');
    expect(limitPosition({ ...cap, given: chf(1_000) })).toBe('at');
    expect(limitPosition({ ...cap, given: chf(900) })).toBe('under');
    expect(limitPosition({ ...cap, given: chf(899) })).toBeUndefined();
  });

  it('shows a threshold, a minimum or the flat deduction on either side, only when near', () => {
    const at = { kind: 'threshold' as const, limit: chf(4_000) };
    expect(limitPosition({ ...at, given: chf(3_800) })).toBe('below');
    expect(limitPosition({ ...at, given: chf(4_200) })).toBe('above');
    expect(limitPosition({ ...at, given: chf(4_201) })).toBeUndefined();
    expect(limitPosition({ kind: 'minimum', limit: chf(100), given: chf(95) })).toBe('below');
    expect(limitPosition({ kind: 'choice', limit: chf(1_812), given: chf(1_850) })).toBe('above');
  });
});

describe('final check: Dupont', () => {
  it('is ready to fill in for 2025 when nothing is left to settle', () => {
    const check = finalCheck(clear(dupont(2025)));
    expect(check.verdict).toBe('ready');
    expect(check.fix).toEqual([]);
    // 3a exactly at its limit, the federal insurance limit cut the premiums; nothing else is near.
    expect(limits(check.know)).toEqual(['31.40 both cap at', '52.00 ifd cap over']);
    const insurance = check.know.find((i) => i.limit?.code === '52.00')!;
    expect(insurance.detail.en).toBe(
      'Insurance premiums and savings interest: CHF 16’000.00; the limit is CHF 5’100.00, so CHF 5’100.00 is deducted and CHF 10’900.00 is not.',
    );
    expect(insurance.detail.fr).toBe(
      'Primes d’assurances et intérêts d’épargne\u00a0: CHF 16’000.00\u00a0; la limite est de CHF 5’100.00, donc CHF 5’100.00 est déduit et CHF 10’900.00 ne l’est pas.',
    );
    expect(insurance.sources).toEqual([
      {
        id: 'ch-2025-ifd-frais-professionnels-progression',
        where: 'p. 2 (art. 33 al. 1 let. g, al. 1bis)',
        title: OFFICIAL_DOCUMENTS['ch-2025-ifd-frais-professionnels-progression']!.title,
        url: 'https://www.estv.admin.ch/dam/fr/sd-web/zkUbFt0fCQiy/dbst-rs-2-210-d-2024-fr.pdf#page=2',
      },
    ]);
    const pillar = check.know.find((i) => i.limit?.code === '31.40')!;
    expect(pillar.title.en).toBe(
      '31.40 Pillar 3a (Cotisations au 3ème pilier A), you, ICC and IFD',
    );
    expect(pillar.sources[0]?.url).toBe(
      'https://www.estv.admin.ch/dam/fr/sd-web/5fxi0vnMoACl/dbst-wgl-02a-2025-fr.pdf#page=7',
    );
    // What the engine leaves out, assumes or can't verify, in plain words.
    expect(check.know.map((i) => i.kind)).toEqual(
      expect.arrayContaining(['not_counted', 'assumption', 'unverified_rule', 'official_pdf']),
    );
  });

  it('is not ready for 2026 while Geneva’s amounts are estimates, and says what makes them final', () => {
    const check = finalCheck(clear(dupont(2026)));
    expect(check.verdict).toBe('not_ready');
    expect(check.fix.map((i) => i.kind)).toEqual(['estimate_rule']);
    expect(check.fix[0]!.status).toBe('estimate');
    expect(check.fix[0]!.todo?.en).toMatch(/Geneva publishes its 2026 guide \(January 2027\)/);
    expect(limits(check.know)).toEqual(['31.40 both cap at', '52.00 ifd cap over']);
  });

  it('lists what blocks, by kind and in the form’s order, and what doesn’t', () => {
    const order = ['31.40', '41.10', '52.21', '59.10'];
    const settled: ConsistencyCheck = {
      id: 'duplicate:d_a:d_b',
      rule: 'duplicate',
      documents: ['d_a', 'd_b'],
      title: { en: 'Twice', fr: 'Deux fois' },
      detail: { en: 'd', fr: 'd' },
      todo: { en: 't', fr: 't' },
      resolved: { note: 'Two invoices', at: '2027-01-02T00:00:00.000Z' },
    };
    const open: ConsistencyCheck = {
      id: 'salary_period:d_cert',
      rule: 'salary_period',
      documents: ['d_cert'],
      person: 'p2',
      title: { en: 'A salary certificate for part of the year', fr: 'Un certificat partiel' },
      detail: { en: 'It covers March to December.', fr: 'Il couvre mars à décembre.' },
      todo: { en: 'Say why in a note.', fr: 'Dites pourquoi.' },
      source: 'std-lohnausweis-wegleitung-2026-fr p. 8 (Cm 8)',
    };
    const check = finalCheck(
      clear(dupont(2025), {
        questionsOpen: 2,
        formOrder: (code) => {
          const i = order.indexOf(code);
          return i < 0 ? undefined : i;
        },
        requirements: [
          {
            id: 'health:household',
            label: { en: 'Health insurance attestation', fr: 'Attestation d’assurance-maladie' },
            person: 'household',
            optional: false,
            status: 'missing',
            have: 0,
            need: 1,
            source: 'ge-2025-guide-declaration-pp p. 8',
          },
          {
            id: 'bank:p1',
            label: { en: 'Bank statement', fr: 'Relevé bancaire' },
            person: 'p1',
            optional: true,
            status: 'missing',
            have: 0,
            need: 1,
          },
          {
            id: 'gift:household',
            label: { en: 'Donation receipt', fr: 'Reçu de don' },
            person: 'household',
            optional: true,
            status: 'waived',
            have: 0,
            need: 1,
          },
        ],
        checks: [settled, open],
        values: [
          {
            id: 'f_childcare',
            status: 'estimate',
            label: { en: 'Childcare costs', fr: 'Frais de garde' },
            code: '59.10',
            person: 'household',
            amount: chf(15_000),
            final: { en: 'The crèche’s attestation.', fr: 'L’attestation de la crèche.' },
          },
          {
            id: 'f_social_b',
            status: 'extracted',
            label: { en: 'Social contributions', fr: 'Cotisations sociales' },
            code: '41.10',
            person: 'p2',
            amount: chf(1_990),
            document: 'certificat-marie.pdf',
            page: 1,
            final: { en: 'Your OK.', fr: 'Votre accord.' },
          },
          {
            id: 'f_3a',
            status: 'extracted',
            label: { en: 'Pillar 3a paid', fr: '3e pilier A versé' },
            code: '31.40',
            person: 'p1',
            amount: chf(7_258),
            document: '3a.pdf',
            final: { en: 'Your OK.', fr: 'Votre accord.' },
          },
          {
            id: 'f_premiums',
            status: 'estimate',
            label: { en: 'Health premiums', fr: 'Primes d’assurance-maladie' },
            code: '52.21',
            person: 'household',
            amount: chf(16_000),
            final: { en: 'Your insurer’s attestation.', fr: 'L’attestation de votre assureur.' },
            bestFigure: 'The insurer’s yearly letter is lost; 12 x 1’333.',
          },
        ],
        officialPdf: {
          status: 'checked',
          file: 'declaration.pdf',
          clear: false,
          toFix: 2,
          notFinal: 1,
        },
      }),
    );
    expect(check.verdict).toBe('not_ready');
    expect(check.fix.map((i) => i.id)).toEqual([
      'questions_open',
      'missing_document:health:household',
      'needs_ok:f_3a',
      'needs_ok:f_social_b',
      'estimate:f_childcare',
      'check:salary_period:d_cert',
      'official_pdf',
    ]);
    const [questions, missing, okA, okB, estimate, c, pdf] = check.fix;
    expect(questions!.title.en).toBe('2 questions still to answer');
    expect(missing!.status).toBe('missing');
    expect(missing!.sources[0]?.url).toBe(
      'https://www.ge.ch/document/41995/annexe/file/573038#page=8',
    );
    expect(okA!.title.en).toBe('31.40 Pillar 3a paid, you');
    expect(okB!.detail.en).toBe(
      'CHF 1’990.00, read from “certificat-marie.pdf”, page 1: still Needs your OK.',
    );
    expect(okB!.detail.fr).toBe(
      'CHF 1’990.00, lu dans «\u00a0certificat-marie.pdf\u00a0», page 1\u00a0: encore À confirmer.',
    );
    expect(estimate!).toMatchObject({
      status: 'estimate',
      todo: { en: 'The crèche’s attestation.' },
    });
    expect(c!.sources[0]?.url).toMatch(/lohna-wegleitung-2026-fr\.pdf#page=8$/);
    expect(pdf!.detail.en).toBe('“declaration.pdf” differs from the values to type on 2 lines.');
    // The estimate confirmed as a best figure, and the optional document, don't block.
    const best = check.know.find((i) => i.kind === 'best_figure')!;
    expect(best.detail.en).toMatch(/your best figure: “The insurer’s yearly letter is lost/);
    expect(check.know.find((i) => i.kind === 'optional_document')?.title.en).toBe(
      'Bank statement, you',
    );
    expect(check.know.some((i) => i.id.includes('gift'))).toBe(false);
  });

  it('says why the tax can’t be computed yet', () => {
    const check = finalCheck(
      clear(dupont(2025), {
        result: null,
        missing: [{ en: 'your commune on 31 December', fr: 'votre commune au 31 décembre' }],
      }),
    );
    expect(check.verdict).toBe('not_ready');
    expect(check.fix[0]).toMatchObject({
      kind: 'cannot_compute',
      detail: { en: 'It needs your commune on 31 December.' },
    });
  });
});

describe('final check: Ribeiro', () => {
  it('shows the travel cap, the meals just under their yearly limit, and the insurance limit', () => {
    const check = finalCheck(clear(ribeiro(2025)));
    expect(check.verdict).toBe('ready');
    expect(limits(check.know)).toEqual([
      '31.40 both cap at',
      '31.60 icc cap under',
      '31.60 ifd cap under',
      '31.70 icc cap over',
      '52.00 ifd cap over',
    ]);
    const travel = check.know.find((i) => i.limit?.code === '31.70')!;
    expect(travel.detail.en).toBe(
      'Travel costs: CHF 1’200.00; the limit is CHF 534.00, so CHF 534.00 is deducted and CHF 666.00 is not.',
    );
    expect(travel.sources.map((s) => `${s.id} ${s.where}`)).toEqual([
      'ge-2025-guide-declaration-pp p. 11, p. 21 (31.70)',
    ]);
    // 210 days x 15 = 3'150, CHF 50 under the yearly 3'200.
    const meals = check.know.find((i) => i.limit?.code === '31.60' && i.limit.tax === 'icc')!;
    expect(meals.title.en).toBe(
      '31.60 Meals away from home (Frais professionnels effectifs, frais de repas), ICC',
    );
    expect(meals.detail.en).toBe(
      'Meals away from home: CHF 3’150.00, CHF 50.00 under the limit of CHF 3’200.00: all of it is deducted.',
    );
  });

  it('shows medical costs just under the threshold and donations under the federal minimum', () => {
    const input = ribeiro(2026);
    input.household = {
      ...input.household,
      medicalCosts: { value: chf(260) },
      donations: { value: chf(95) },
    };
    const check = finalCheck(clear(input));
    const medical = check.know.find((i) => i.limit?.code === '71.00')!;
    expect(medical.limit).toMatchObject({
      tax: 'icc',
      kind: 'threshold',
      position: 'below',
      counted: 0,
    });
    expect(medical.detail.en).toMatch(
      /^Medical costs: CHF 260\.00, CHF \d+\.00 under the threshold of CHF \d+\.00: nothing is deducted, only the part above it counts\. This limit is an estimate until Geneva publishes its amounts for the year\.$/,
    );
    expect(medical.sources[0]?.url).toBe(
      'https://www.ge.ch/document/41995/annexe/file/573038#page=14',
    );
    const gifts = check.know.find((i) => i.limit?.kind === 'minimum')!;
    expect(gifts.detail.en).toBe(
      'Donations: CHF 95.00, CHF 5.00 under the minimum of CHF 100.00 in the year: nothing is deducted for the federal tax.',
    );
    expect(gifts.sources.map((s) => s.id)).toEqual([
      'ch-2026-ifd-progression-deductions',
      'ch-na-law-lifd',
    ]);
    expect(gifts.sources[1]?.url).toMatch(/#page=27$/);
  });

  it('blocks on a declaration PDF it can’t read, and only notes a clear one', () => {
    const unreadable = finalCheck(
      clear(ribeiro(2025), { officialPdf: { status: 'unreadable', file: 'scan.pdf' } }),
    );
    expect(unreadable.fix.map((i) => i.kind)).toEqual(['official_pdf']);
    const matched = finalCheck(
      clear(ribeiro(2025), {
        officialPdf: { status: 'checked', file: 'd.pdf', clear: true, toFix: 0, notFinal: 0 },
      }),
    );
    expect(matched.verdict).toBe('ready');
    expect(matched.know.find((i) => i.kind === 'official_pdf')?.detail.en).toBe(
      '“d.pdf” matches every value Taxpresso compared.',
    );
  });
});

describe('official links', () => {
  it('opens a PDF at the last page cited, and gives no link for an unknown document', () => {
    expect(officialLinks('ge-2025-guide-declaration-pp p. 11, p. 29 (52.21)')[0]?.url).toBe(
      'https://www.ge.ch/document/41995/annexe/file/573038#page=29',
    );
    const [lifd, lipp] = officialLinks(
      'ch-na-law-lifd art. 33 al. 1 let. h (p. 26); ge-na-law-lipp art. 31',
    );
    expect(lifd?.url).toMatch(/^https:\/\/www\.fedlex\.admin\.ch\/.+#page=26$/);
    expect([lipp]).toEqual([
      {
        id: 'ge-na-law-lipp',
        where: 'art. 31',
        title: OFFICIAL_DOCUMENTS['ge-na-law-lipp']!.title,
        url: 'https://silgeneve.ch/legis/data/rsg_d3_08.htm',
      },
    ]);
    expect(officialLinks('xx-unknown p. 3')).toEqual([{ id: 'xx-unknown', where: 'p. 3' }]);
  });

  it('are the URLs of the sources library, each document downloaded and checked', () => {
    const manifest = JSON.parse(
      readFileSync(new URL('../../../docs/sources/manifest.json', import.meta.url), 'utf8'),
    ) as { entries: { id: string; url: string; title: string; format: string }[] };
    const lock = JSON.parse(
      readFileSync(new URL('../../../docs/sources/lock.json', import.meta.url), 'utf8'),
    ) as Record<string, { status: string }>;
    for (const [id, doc] of Object.entries(OFFICIAL_DOCUMENTS)) {
      const entry = manifest.entries.find((e) => e.id === id);
      expect(entry, id).toBeDefined();
      expect(doc, id).toEqual({
        title: entry!.title,
        url: entry!.url,
        pdf: entry!.format === 'pdf',
      });
    }
    // Every limit the engine applies links to a document of the library.
    for (const input of [dupont(2025), dupont(2026), ribeiro(2025), ribeiro(2026)]) {
      for (const l of computeReturn(input).limits) {
        for (const link of officialLinks(l.source)) {
          expect(link.url, `${link.id} in ${l.source}`).toMatch(/^https:\/\//);
          expect(lock[link.id]?.status, link.id).toBe('ok');
        }
      }
    }
  });
});
