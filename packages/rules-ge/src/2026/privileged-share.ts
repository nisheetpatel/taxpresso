// Privileged share (part privilégiée) of each Geneva commune for tax year 2026, in percent of the
// base tax: the part the commune of residence taxes at its own centimes, the rest going to the
// commune where the income is earned (ge-na-law-lcp art. 295A al. 2 and 3).
// Source: ge-2026-part-privilegiee-communique p. 11 (Conseil d'Etat, 15 October 2025, "Fixation de
// la part privilégiée de chaque commune pour 2026").
import type { Cited } from '../2025/icc.js';
import type { CommuneSlug } from './communes.js';

export const PRIVILEGED_SHARE_2026: Cited<Readonly<Record<CommuneSlug, number>>> = {
  source: 'ge-2026-part-privilegiee-communique p. 11',
  value: {
    'aire-la-ville': 80,
    anieres: 20,
    avully: 80,
    avusy: 80,
    bardonnex: 79,
    bellevue: 53,
    bernex: 80,
    carouge: 27,
    cartigny: 78,
    celigny: 33,
    chancy: 80,
    'chene-bougeries': 20,
    'chene-bourg': 79,
    choulex: 34,
    'collex-bossy': 80,
    'collonge-bellerive': 20,
    cologny: 20,
    confignon: 76,
    corsier: 20,
    dardagny: 80,
    geneve: 29,
    genthod: 20,
    'grand-saconnex': 64,
    gy: 80,
    hermance: 56,
    jussy: 35,
    laconnex: 80,
    lancy: 51,
    meinier: 66,
    meyrin: 29,
    onex: 80,
    'perly-certoux': 80,
    'plan-les-ouates': 20,
    'pregny-chambesy': 26,
    presinge: 43,
    puplinge: 80,
    russin: 27,
    satigny: 29,
    soral: 80,
    thonex: 77,
    troinex: 60,
    vandoeuvres: 20,
    vernier: 75,
    versoix: 77,
    veyrier: 56,
  },
};
