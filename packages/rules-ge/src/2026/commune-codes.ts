// The commune codes printed on Geneva declarations ("code lieu", e.g. 6643 for Vernier): the work
// commune on each salary line of annex A, and the residence commune. Official list: the guide's
// "Codes de taxation (communes, cantons, pays)", ge-2025-guide-declaration-pp p. 59 (the city of
// Geneva's four cadastral areas, Cité, Eaux-Vives, Petit-Saconnex and Plainpalais, share 6621).
// Only these codes are mapped; any other number is left for the user to answer.
import { COMMUNES_2026, type CommuneSlug } from './communes.js';

export const COMMUNE_CODES_SOURCE = 'ge-2025-guide-declaration-pp p. 59';

/** Code lieu -> the commune's name as printed in the guide's list. */
export const COMMUNE_CODES: Readonly<Record<number, string>> = {
  6601: 'Aire-la-Ville',
  6602: 'Anières',
  6603: 'Avully',
  6604: 'Avusy',
  6605: 'Bardonnex',
  6606: 'Bellevue',
  6607: 'Bernex',
  6608: 'Carouge',
  6609: 'Cartigny',
  6610: 'Céligny',
  6611: 'Chancy',
  6612: 'Chêne-Bougeries',
  6613: 'Chêne-Bourg',
  6614: 'Choulex',
  6615: 'Collex-Bossy',
  6616: 'Collonge-Bellerive',
  6617: 'Cologny',
  6618: 'Confignon',
  6619: 'Corsier',
  6620: 'Dardagny',
  6621: 'Genève',
  6622: 'Genthod',
  6623: 'Grand-Saconnex',
  6624: 'Gy',
  6625: 'Hermance',
  6626: 'Jussy',
  6627: 'Laconnex',
  6628: 'Lancy',
  6629: 'Meinier',
  6630: 'Meyrin',
  6631: 'Onex',
  6632: 'Perly-Certoux',
  6633: 'Plan-les-Ouates',
  6634: 'Pregny-Chambésy',
  6635: 'Presinge',
  6636: 'Puplinge',
  6637: 'Russin',
  6638: 'Satigny',
  6639: 'Soral',
  6640: 'Thônex',
  6641: 'Troinex',
  6642: 'Vandoeuvres',
  6643: 'Vernier',
  6644: 'Versoix',
  6645: 'Veyrier',
};

/** Names compared without accents, case, "œ" or punctuation: "Vandœuvres" = "VANDOEUVRES". */
export function foldName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/œ/gi, 'oe')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const BY_NAME = new Map<string, CommuneSlug>(COMMUNES_2026.map((c) => [foldName(c.name), c.slug]));

/** The commune slug of a Geneva code lieu, only where the official list maps it. */
export function communeByCode(code: number): CommuneSlug | undefined {
  const name = COMMUNE_CODES[code];
  return name === undefined ? undefined : BY_NAME.get(foldName(name));
}

/**
 * The commune slug whose official name is exactly this place name, e.g. the locality of a
 * postal address ("Vernier", "Le Grand-Saconnex"). A locality that is not a commune's name
 * (Petit-Lancy, Le Lignon, Vésenaz) gives nothing: the user is asked instead.
 */
export function communeByName(place: string): CommuneSlug | undefined {
  // "Le Grand-Saconnex" is the commune Grand-Saconnex; "Genève 3" a post office in Genève.
  const folded = foldName(place)
    .replace(/^(le|la|les) /, '')
    .replace(/ \d{1,2}$/, '');
  return BY_NAME.get(folded);
}
