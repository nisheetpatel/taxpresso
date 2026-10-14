// The separate tax on lump sums from the 2nd pillar (pension fund, vested benefits) and pillar 3a
// (prestations en capital, 98.12): a tax of its own, never part of the progressive income base.
//
// Cantonal and communal (ge-na-law-lipp art. 45; ../law/capital.ts): every lump sum of the year
// added up, the spouses' too; the scale of art. 41 read at the rate of that amount, with the
// splitting of art. 41 al. 2 to 4; a fifth of it is the base tax; then, as on income, 47.5 %
// cantonal centimes, 12 % off the base and those centimes, 1 % for home care (ge-2025-icc-tariff-pdf
// p. 4; ge-na-law-lcacant art. 2; ge-na-law-ldirpp art. 1) and the commune of residence's centimes on
// the base (ge-na-law-lcp art. 293 let. A, art. 295A al. 2).
// Federal (ch-na-law-lifd art. 38): packages/rules-ch, ifd/capital.ts.
//
// Fails closed (not computed, with the reason): an attestation that gives a reason Taxpresso can't
// tax yet (leaving Switzerland, taxed at source: ge-2025-source-directives and
// ge-2026-source-directives p. 39; another reason: another rubric, 98.75, or no tax); a person whose
// salary is taxed at source (the directives tax some lump sums at source and others in the
// declaration, p. 11); a household that arrived from abroad in the year. A reason not read is an
// assumption, said: you live in Geneva on 31 December, so not leaving Switzerland, and the other
// reasons the law allows (retirement, a home, self-employment) are taxed the same way.
// A lump sum dated another year belongs to that year's tax (art. 38 al. 1bis LIFD).
import {
  bracketTax,
  chf,
  floorFranc,
  ifdCapitalTax,
  percent,
  round5,
  roundFranc,
  share5,
  Trace,
  type IfdScale,
} from '@taxpresso/rules-ch';
import type { IccSplitting } from '../2025/icc.js';
import type { CommuneSlug } from '../2026/communes.js';
import { COMMUNES_2026 } from '../2026/communes.js';
import {
  CAPITAL_ADDED_UP,
  CAPITAL_CENTIMES,
  CAPITAL_COMMUNE,
  CAPITAL_FIFTH,
} from '../law/capital.js';
import { NOTE } from './explain.js';
import type { YearParams } from './params.js';
import { RUBRICS } from './rubrics.js';
import type {
  CapitalBenefitInput,
  CapitalIcc,
  CapitalInput,
  CapitalTax,
  EnginePerson,
  Item,
  Line,
  Text,
} from './types.js';

const t = (en: string, fr: string): Text => ({ en, fr });
const NB = ' ';
const LIPP = 'ge-na-law-lipp art. 45 al. 1 and 2';
const LIFD_YEAR = 'ch-na-law-lifd art. 38 al. 1bis (p. 32)';
const PILLAR: Record<CapitalBenefitInput['pillar'], Text> = {
  pillar2: t(
    '2nd pillar (pension fund or vested benefits)',
    '2e pilier (caisse de pension ou libre passage)',
  ),
  pillar3a: t('pillar 3a', '3e pilier A'),
};
const WHO: Record<EnginePerson, Text> = {
  p1: t('taxpayer A', 'contribuable A'),
  p2: t('taxpayer B', 'contribuable B'),
};

/** What the capital tax adds to the result's notes. */
export interface CapitalNotes {
  unsupported: Text[];
  notCounted: Text[];
  assumptions: Text[];
  unverified: Text[];
}

/** The capital tax, or none when no lump sum counts this year; and the notes it adds. */
export interface CapitalOutcome {
  capital?: CapitalTax<CapitalIcc>;
  notes: CapitalNotes;
  /** People with a lump sum from the 2nd pillar counted this year (the buy-in rule). */
  secondPillar: EnginePerson[];
}

/**
 * a x b / den to the nearest 5 centimes, halves up, exactly: a lump sum of millions times its
 * scale's tax goes beyond the integers a JavaScript number holds exactly.
 */
function round5Exact(a: number, b: number, den: number): number {
  const num = BigInt(a) * BigInt(b);
  const d = BigInt(den);
  const exact = Number(((2n * num + 5n * d) / (10n * d)) * 5n);
  // The same as round5 where the product is a safe integer.
  return Number.isSafeInteger(a * b) ? round5(a * b, den) : exact;
}

/** Year of a YYYY-MM-DD date. */
const yearOf = (date: string) => Number(date.slice(0, 4));

/**
 * The cantonal and communal tax on `amount` (the lump sums of the year added up) with `splitting`,
 * at the centimes of `commune`. Pure: the AFC's capital tariffs are checked against it with their
 * own flat communal rate (`communalBp`).
 */
export function capitalIcc(
  P: YearParams,
  amount: Line,
  splitting: IccSplitting,
  communal: { bp: number; label: Text; sources: readonly string[] },
): CapitalIcc {
  const I = P.icc;
  const C = amount.amount;
  const rateTrace = new Trace().from(amount).src(CAPITAL_ADDED_UP.source);
  let rateIncome = C;
  let rateHow = t(
    `No splitting: the rate is the one for the whole amount, ${chf(C)}.`,
    `Pas de splitting${NB}: le taux est celui du montant entier, ${chf(C)}.`,
  );
  if (splitting !== 'none') {
    const share = rateTrace.p(I.splittingShare)[splitting];
    rateIncome = roundFranc(C * share, 10_000);
    rateHow = t(
      `${splitting === 'full' ? 'Full' : 'Partial'} splitting (LIPP art. 41, kept by art. 45 al. 3): the rate is the one for ${percent(share, 'en')} of ${chf(C)}, to the franc: ${chf(rateIncome)}.`,
      `Splitting ${splitting === 'full' ? 'intégral' : 'partiel'} (LIPP art. 41, réservé par l’art. 45 al. 3)${NB}: le taux est celui de ${percent(share, 'fr')} de ${chf(C)}, au franc${NB}: ${chf(rateIncome)}.`,
    );
  }
  const rateLine = rateTrace.line(
    rateIncome,
    t(
      'Pension capital: amount the rate is read at (revenu déterminant le taux)',
      'Prestations en capital, revenu déterminant le taux',
    ),
    rateHow,
  );

  const sTrace = new Trace().from(rateLine);
  const scale = sTrace.p(I.incomeScale);
  const rateTax = bracketTax(scale, rateIncome);
  const scaleTax =
    splitting === 'none' || rateIncome === 0 ? rateTax : round5Exact(C, rateTax, rateIncome);
  const scaleTaxLine = sTrace.line(
    scaleTax,
    t(
      'Pension capital: income scale on the whole amount',
      'Prestations en capital, barème du revenu sur le montant entier',
    ),
    splitting === 'none'
      ? t(
          `The income scale (LIPP art. 41) applied to ${chf(C)}, bracket by bracket, each to 5 centimes: ${chf(scaleTax)}.`,
          `Le barème du revenu (LIPP art. 41) appliqué à ${chf(C)}, tranche par tranche, chacune aux 5 centimes${NB}: ${chf(scaleTax)}.`,
        )
      : t(
          `The income scale gives ${chf(rateTax)} on ${chf(rateIncome)}; on the whole amount: ${chf(C)} x ${chf(rateTax)} / ${chf(rateIncome)}, to 5 centimes: ${chf(scaleTax)}.`,
          `Le barème du revenu donne ${chf(rateTax)} sur ${chf(rateIncome)}${NB}; sur le montant entier${NB}: ${chf(C)} x ${chf(rateTax)} / ${chf(rateIncome)}, aux 5 centimes${NB}: ${chf(scaleTax)}.`,
        ),
  );

  const bTrace = new Trace().from(scaleTaxLine);
  const fifth = bTrace.p(CAPITAL_FIFTH);
  const base = round5(scaleTax, fifth);
  const baseLine = bTrace.line(
    base,
    t(
      'Base tax on pension capital (impôt de base, au 1/5ème du barème)',
      'Impôt de base sur les prestations en capital (au 1/5ème du barème)',
    ),
    t(
      `A fifth of ${chf(scaleTax)} (the rate of a fifth of the scale, LIPP art. 45 al. 2), to 5 centimes: ${chf(base)}.`,
      `Le cinquième de ${chf(scaleTax)} (le taux représentant le cinquième du barème, LIPP art. 45 al. 2), aux 5 centimes${NB}: ${chf(base)}.`,
    ),
  );

  const ccTrace = new Trace().from(baseLine).src(CAPITAL_CENTIMES.cantonal);
  const ccBp = ccTrace.p(I.incomeCantonalCentimesBp);
  const cc = share5(base, ccBp);
  const ccLine = ccTrace.line(
    cc,
    t(
      'Cantonal centimes on pension capital (centimes additionnels cantonaux)',
      'Centimes additionnels cantonaux sur les prestations en capital',
    ),
    t(
      `${percent(ccBp, 'en')} of the base tax ${chf(base)}, to 5 centimes: ${chf(cc)}.`,
      `${percent(ccBp, 'fr')} de l’impôt de base ${chf(base)}, aux 5 centimes${NB}: ${chf(cc)}.`,
    ),
  );
  const redTrace = new Trace().from(ccLine).src(CAPITAL_CENTIMES.reduction);
  const redBp = redTrace.p(I.incomeReductionBp);
  const reduction = -share5(base + cc, redBp);
  const redLine = redTrace.line(
    reduction,
    t(
      'Reduction of the tax on pension capital (diminution d’impôt 12 %)',
      `Diminution d’impôt de 12${NB}% sur les prestations en capital`,
    ),
    t(
      `${percent(redBp, 'en')} of the base tax plus cantonal centimes (${chf(base + cc)}), to 5 centimes: ${chf(reduction)}.`,
      `${percent(redBp, 'fr')} de l’impôt de base plus les centimes cantonaux (${chf(base + cc)}), aux 5 centimes${NB}: ${chf(reduction)}.`,
    ),
  );
  const hcTrace = new Trace().from(baseLine).src(CAPITAL_CENTIMES.homeCare);
  const hcBp = hcTrace.p(I.incomeHomeCareBp);
  const homeCare = share5(base, hcBp);
  const hcLine = hcTrace.line(
    homeCare,
    t(
      'Home care centime on pension capital (aide à domicile)',
      'Centime additionnel pour l’aide à domicile, prestations en capital',
    ),
    t(
      `${percent(hcBp, 'en')} of the base tax ${chf(base)}, to 5 centimes: ${chf(homeCare)}.`,
      `${percent(hcBp, 'fr')} de l’impôt de base ${chf(base)}, aux 5 centimes${NB}: ${chf(homeCare)}.`,
    ),
  );
  const cantonal = base + cc + reduction + homeCare;
  const cantonalLine = new Trace()
    .src(LIPP, 'ge-2025-icc-tariff-pdf p. 4')
    .from(baseLine, ccLine, redLine, hcLine)
    .line(
      cantonal,
      t('Cantonal tax on pension capital', 'Impôt cantonal sur les prestations en capital'),
      t(
        `Base ${chf(base)} + centimes ${chf(cc)} - reduction ${chf(-reduction)} + home care ${chf(homeCare)} = ${chf(cantonal)}.`,
        `Base ${chf(base)} + centimes ${chf(cc)} - diminution ${chf(-reduction)} + aide à domicile ${chf(homeCare)} = ${chf(cantonal)}.`,
      ),
    );
  const coTrace = new Trace().from(baseLine).src(CAPITAL_COMMUNE.source, ...communal.sources);
  const communalTax = share5(base, communal.bp);
  const communalLine = coTrace.line(
    communalTax,
    t(
      `Communal tax of ${communal.label.en} on pension capital`,
      `Impôt communal de ${communal.label.fr} sur les prestations en capital`,
    ),
    t(
      `${chf(base)} x ${percent(communal.bp, 'en')} (centimes additionnels of ${communal.label.en}, the commune of residence, which taxes the whole base), to 5 centimes: ${chf(communalTax)}.`,
      `${chf(base)} x ${percent(communal.bp, 'fr')} (centimes additionnels de ${communal.label.fr}, la commune de domicile, qui impose toute la base), aux 5 centimes${NB}: ${chf(communalTax)}.`,
    ),
  );
  const tax = cantonal + communalTax;
  const taxLine = new Trace()
    .src(LIPP)
    .from(cantonalLine, communalLine)
    .line(
      tax,
      t(
        'Cantonal and communal tax on pension capital (ICC)',
        'Impôt cantonal et communal sur les prestations en capital (ICC)',
      ),
      t(
        `Cantonal ${chf(cantonal)} + communal ${chf(communalTax)} = ${chf(tax)}.`,
        `Cantonal ${chf(cantonal)} + communal ${chf(communalTax)} = ${chf(tax)}.`,
      ),
    );
  return {
    splitting,
    rateIncome: rateLine,
    scaleTax: scaleTaxLine,
    base: baseLine,
    cantonalCentimes: ccLine,
    reduction12: redLine,
    homeCare: hcLine,
    cantonal: cantonalLine,
    communal: communalLine,
    tax: taxLine,
  };
}

/** Why Taxpresso doesn't compute it, for a reason it can't tax yet. */
function reasonText(r: 'leaving' | 'other', year: number): Text {
  return r === 'leaving'
    ? t(
        `Tax on pension capital not computed: a lump sum paid on leaving Switzerland is taxed at source (ge-${year}-source-directives p. 39). Taxpresso doesn’t support it yet.`,
        `Impôt sur les prestations en capital non calculé${NB}: un capital versé lors d’un départ de Suisse est imposé à la source (directives ${year} p. 39). Taxpresso ne le prend pas encore en charge.`,
      )
    : t(
        'Tax on pension capital not computed: a lump sum paid for another reason (disability, a death, a divorce, a transfer) may go on another rubric (98.75) or not be taxed. Taxpresso doesn’t support it yet.',
        `Impôt sur les prestations en capital non calculé${NB}: un capital versé pour un autre motif (invalidité, décès, divorce, transfert) peut relever d’une autre rubrique (98.75) ou ne pas être imposé. Taxpresso ne le prend pas encore en charge.`,
      );
}

/**
 * The separate tax on the household's lump sums of the year. `splitting` and `ifdScale` are the
 * return's own (the capital tax keeps them: LIPP art. 45 al. 3, LIFD art. 38 al. 2); `ifdScale`
 * undefined when the federal scale is not known.
 */
export function capitalTax(
  P: YearParams,
  input: CapitalInput | undefined,
  ctx: {
    taxYear: number;
    commune: CommuneSlug;
    people: readonly EnginePerson[];
    splitting: IccSplitting;
    ifdScale: IfdScale | undefined;
  },
): CapitalOutcome {
  const notes: CapitalNotes = { unsupported: [], notCounted: [], assumptions: [], unverified: [] };
  const add = (list: Text[], x: Text) => list.some((n) => n.en === x.en) || list.push(x);
  const benefits = input?.benefits ?? [];
  // Each counts for the year it was paid (LIFD art. 38 al. 1bis).
  const counted = benefits.filter((b) => !b.date || yearOf(b.date) === ctx.taxYear);
  for (const b of benefits.filter((x) => !counted.includes(x))) {
    add(
      notes.notCounted,
      t(
        `A lump sum from ${PILLAR[b.pillar].en} paid on ${b.date}: it belongs to the tax of ${yearOf(b.date!)}, not ${ctx.taxYear} (LIFD art. 38 al. 1bis).`,
        `Un capital du ${PILLAR[b.pillar].fr} versé le ${b.date}${NB}: il relève de l’impôt ${yearOf(b.date!)}, pas ${ctx.taxYear} (LIFD art. 38 al. 1bis).`,
      ),
    );
  }
  if (!counted.length) return { notes, secondPillar: [] };
  if (counted.some((b) => !b.date)) {
    add(
      notes.assumptions,
      t(
        `Pension capital: an attestation without its date is counted for ${ctx.taxYear}, the year it is for.`,
        `Prestations en capital${NB}: une attestation sans date est comptée pour ${ctx.taxYear}, l’année qu’elle concerne.`,
      ),
    );
  }

  // One item per lump sum, on 98.12.
  const rubric = RUBRICS['98.12'];
  const items: Item[] = counted.map((b) => {
    const tr = new Trace().src(rubric.source);
    const v = tr.a(b.amount);
    const when = b.date ? t(`, paid on ${b.date}`, `, versé le ${b.date}`) : t('', '');
    return {
      code: '98.12',
      person: b.person,
      ...tr.line(
        v,
        rubric.label,
        t(
          `Lump sum from ${PILLAR[b.pillar].en}${when.en}, as on its attestation: ${chf(v)}.`,
          `Capital du ${PILLAR[b.pillar].fr}${when.fr}, selon son attestation${NB}: ${chf(v)}.`,
        ),
      ),
    };
  });
  const sum = items.reduce((s, i) => s + i.amount, 0);
  const C = floorFranc(sum);
  const couple = ctx.people.length > 1;
  const amountLine = new Trace()
    .src(
      CAPITAL_ADDED_UP.source,
      'ch-na-law-lifd art. 9 al. 1 (p. 5)',
      LIFD_YEAR,
      'ge-2025-guide-declaration-pp p. 9',
    )
    .from(...items)
    .line(
      C,
      t('Pension capital of the year (98.12)', 'Prestations en capital de l’année (98.12)'),
      t(
        `${items.length === 1 ? 'The lump sum' : `The ${items.length} lump sums`} of the year${couple ? ', both spouses’ together' : ''}, added up for one tax, in whole francs: ${chf(C)}.`,
        `${items.length === 1 ? 'Le capital' : `Les ${items.length} capitaux`} de l’année${couple ? ', ceux des deux conjoints ensemble' : ''}, additionnés pour un seul impôt, en francs entiers${NB}: ${chf(C)}.`,
      ),
    );
  const secondPillar = [
    ...new Set(counted.filter((b) => b.pillar === 'pillar2').map((b) => b.person)),
  ];

  // What Taxpresso can't tax yet: then neither tax is computed.
  const blocked: Text[] = [];
  for (const b of counted) {
    if (b.reason === 'leaving' || b.reason === 'other') {
      const text = reasonText(b.reason, ctx.taxYear);
      if (!blocked.some((x) => x.en === text.en)) blocked.push(text);
    }
  }
  if (counted.some((b) => !b.reason)) {
    add(
      notes.assumptions,
      t(
        'Pension capital: the reason for the payment (motif du versement) is not read on its attestation. Taxpresso counts it as paid for retirement, a home or self-employment, taxed the same way, since you live in Geneva on 31 December. If it was paid because you left Switzerland, or for another reason, say so: its tax is then not computed.',
        `Prestations en capital${NB}: le motif du versement n’est pas lu sur l’attestation. Taxpresso le compte comme versé pour la retraite, un logement ou une activité indépendante, imposés de la même façon, puisque vous habitez Genève au 31 décembre. S’il a été versé pour un départ de Suisse ou pour un autre motif, dites-le${NB}: son impôt n’est alors pas calculé.`,
      ),
    );
  }
  for (const person of new Set(counted.map((b) => b.person))) {
    const who = couple ? t(` (${WHO[person].en})`, ` (${WHO[person].fr})`) : t('', '');
    if (input?.atSource?.includes(person)) {
      blocked.push(
        t(
          `Tax on pension capital not computed: your salary is taxed at source${who.en}, and the source-tax directives tax some lump sums at source and others in the declaration (ge-${ctx.taxYear}-source-directives p. 11). Taxpresso doesn’t support it yet.`,
          `Impôt sur les prestations en capital non calculé${NB}: votre salaire est imposé à la source${who.fr}, et les directives imposent certains capitaux à la source, d’autres dans la déclaration (directives ${ctx.taxYear} p. 11). Taxpresso ne le prend pas encore en charge.`,
        ),
      );
    }
  }
  if (input?.arrivedFromAbroad) {
    blocked.push(
      t(
        'Tax on pension capital not computed: you arrived from abroad this year, and a lump sum paid before you arrived is not taxed here. Taxpresso doesn’t support it yet.',
        `Impôt sur les prestations en capital non calculé${NB}: vous êtes arrivé de l’étranger cette année, et un capital versé avant votre arrivée n’est pas imposé ici. Taxpresso ne le prend pas encore en charge.`,
      ),
    );
  }
  for (const b of blocked) add(notes.unsupported, b);
  if (blocked.length) {
    return {
      capital: {
        items,
        amount: amountLine,
        secondPillar: secondPillar.length > 0,
        icc: null,
        ifd: null,
        total: null,
      },
      notes,
      secondPillar,
    };
  }

  const name = COMMUNES_2026.find((c) => c.slug === ctx.commune)?.name ?? ctx.commune;
  const centimes = P.communes.centimes;
  const icc = capitalIcc(P, amountLine, ctx.splitting, {
    bp: centimes.value[ctx.commune],
    label: t(name, name),
    sources: [centimes.source],
  });
  add(notes.unverified, NOTE.capitalRounding);

  let ifd: CapitalTax['ifd'] = null;
  if (!ctx.ifdScale) {
    add(
      notes.unsupported,
      t(
        'Federal tax on pension capital not computed: it takes the same scale as your federal tax, which is not known yet.',
        `Impôt fédéral sur les prestations en capital non calculé${NB}: il prend le même barème que votre impôt fédéral, pas encore connu.`,
      ),
    );
  } else {
    const r = ifdCapitalTax(P.ifd, amountLine, ctx.ifdScale, ctx.taxYear);
    if ('unsupported' in r) add(notes.unsupported, r.unsupported);
    else {
      ifd = r.tax;
      for (const u of r.unverified) add(notes.unverified, u);
    }
  }
  const total = ifd
    ? new Trace()
        .from(icc.tax, ifd.tax)
        .src(LIPP, 'ch-na-law-lifd art. 38 al. 1 (p. 32)')
        .line(
          icc.tax.amount + ifd.tax.amount,
          t(
            'Tax on pension capital (taxed apart)',
            'Impôt sur les prestations en capital (imposées à part)',
          ),
          t(
            `Cantonal and communal ${chf(icc.tax.amount)} + federal ${chf(ifd.tax.amount)} = ${chf(icc.tax.amount + ifd.tax.amount)}, a tax of its own, apart from the tax on your income.`,
            `Cantonal et communal ${chf(icc.tax.amount)} + fédéral ${chf(ifd.tax.amount)} = ${chf(icc.tax.amount + ifd.tax.amount)}, un impôt distinct de l’impôt sur votre revenu.`,
          ),
        )
    : null;
  return {
    capital: { items, amount: amountLine, secondPillar: secondPillar.length > 0, icc, ifd, total },
    notes,
    secondPillar,
  };
}
