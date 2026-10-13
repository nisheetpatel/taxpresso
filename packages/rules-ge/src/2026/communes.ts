// Geneva's 45 communes for tax year 2026.
// Names: ge-2026-communal-centimes-arca (ArCA-2026, D 3 05.30, list of communes and rates).
// Official numbers: ge-2025-communal-centimes-pdf p. 1. Rates are rule data and come later, cited.

export interface Commune {
  no: number;
  slug: string;
  name: string;
}

export const COMMUNES_2026 = [
  { no: 1, slug: 'aire-la-ville', name: 'Aire-la-Ville' },
  { no: 2, slug: 'anieres', name: 'Anières' },
  { no: 3, slug: 'avully', name: 'Avully' },
  { no: 4, slug: 'avusy', name: 'Avusy' },
  { no: 5, slug: 'bardonnex', name: 'Bardonnex' },
  { no: 6, slug: 'bellevue', name: 'Bellevue' },
  { no: 7, slug: 'bernex', name: 'Bernex' },
  { no: 8, slug: 'carouge', name: 'Carouge' },
  { no: 9, slug: 'cartigny', name: 'Cartigny' },
  { no: 10, slug: 'celigny', name: 'Céligny' },
  { no: 11, slug: 'chancy', name: 'Chancy' },
  { no: 12, slug: 'chene-bougeries', name: 'Chêne-Bougeries' },
  { no: 13, slug: 'chene-bourg', name: 'Chêne-Bourg' },
  { no: 14, slug: 'choulex', name: 'Choulex' },
  { no: 15, slug: 'collex-bossy', name: 'Collex-Bossy' },
  { no: 16, slug: 'collonge-bellerive', name: 'Collonge-Bellerive' },
  { no: 17, slug: 'cologny', name: 'Cologny' },
  { no: 18, slug: 'confignon', name: 'Confignon' },
  { no: 19, slug: 'corsier', name: 'Corsier' },
  { no: 20, slug: 'dardagny', name: 'Dardagny' },
  { no: 21, slug: 'geneve', name: 'Genève' },
  { no: 22, slug: 'genthod', name: 'Genthod' },
  { no: 23, slug: 'grand-saconnex', name: 'Grand-Saconnex' },
  { no: 24, slug: 'gy', name: 'Gy' },
  { no: 25, slug: 'hermance', name: 'Hermance' },
  { no: 26, slug: 'jussy', name: 'Jussy' },
  { no: 27, slug: 'laconnex', name: 'Laconnex' },
  { no: 28, slug: 'lancy', name: 'Lancy' },
  { no: 29, slug: 'meinier', name: 'Meinier' },
  { no: 30, slug: 'meyrin', name: 'Meyrin' },
  { no: 31, slug: 'onex', name: 'Onex' },
  { no: 32, slug: 'perly-certoux', name: 'Perly-Certoux' },
  { no: 33, slug: 'plan-les-ouates', name: 'Plan-les-Ouates' },
  { no: 34, slug: 'pregny-chambesy', name: 'Pregny-Chambésy' },
  { no: 35, slug: 'presinge', name: 'Presinge' },
  { no: 36, slug: 'puplinge', name: 'Puplinge' },
  { no: 37, slug: 'russin', name: 'Russin' },
  { no: 38, slug: 'satigny', name: 'Satigny' },
  { no: 39, slug: 'soral', name: 'Soral' },
  { no: 40, slug: 'thonex', name: 'Thônex' },
  { no: 41, slug: 'troinex', name: 'Troinex' },
  { no: 42, slug: 'vandoeuvres', name: 'Vandœuvres' },
  { no: 43, slug: 'vernier', name: 'Vernier' },
  { no: 44, slug: 'versoix', name: 'Versoix' },
  { no: 45, slug: 'veyrier', name: 'Veyrier' },
] as const satisfies readonly Commune[];

export type CommuneSlug = (typeof COMMUNES_2026)[number]['slug'];

/**
 * Communal centimes for 2026, in hundredths (45.49 -> 4549), applied to the base tax.
 * Source: ge-2026-communal-centimes-arca (ArCA-2026, list of approved rates). Vernier carries a
 * footnote: its rate was amended on 19 August 2026, effective 1 January 2026; the consolidated
 * text shows 50.
 */
export const COMMUNE_CENTIMES_2026: {
  value: Readonly<Record<CommuneSlug, number>>;
  source: string;
} = {
  source: 'ge-2026-communal-centimes-arca',
  value: {
    'aire-la-ville': 5000,
    anieres: 3100,
    avully: 5100,
    avusy: 4900,
    bardonnex: 4300,
    bellevue: 3900,
    bernex: 4800,
    carouge: 4000,
    cartigny: 4200,
    celigny: 3300,
    chancy: 5100,
    'chene-bougeries': 3200,
    'chene-bourg': 4600,
    choulex: 4000,
    'collex-bossy': 4600,
    'collonge-bellerive': 2800,
    cologny: 2500,
    confignon: 4600,
    corsier: 3100,
    dardagny: 4800,
    geneve: 4549,
    genthod: 2500,
    'grand-saconnex': 4400,
    gy: 4600,
    hermance: 4200,
    jussy: 4100,
    laconnex: 4400,
    lancy: 4700,
    meinier: 4200,
    meyrin: 4200,
    onex: 5050,
    'perly-certoux': 4300,
    'plan-les-ouates': 3700,
    'pregny-chambesy': 3200,
    presinge: 4000,
    puplinge: 4900,
    russin: 3900,
    satigny: 3900,
    soral: 4400,
    thonex: 4400,
    troinex: 4000,
    vandoeuvres: 2700,
    vernier: 5000,
    versoix: 4550,
    veyrier: 3700,
  },
};
