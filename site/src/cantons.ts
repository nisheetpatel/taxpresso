// The cantons Taxpresso works in, and the ones coming next: the one place the website names them.
// Copy that lists cantons (the FAQ "Which cantons work?") is generated from these lists with
// listOf, so a new canton is one line here. Names are the official exonyms in each language of the
// site. The extension's own list is SUPPORTED_CANTONS (packages/rules-ch); keep the two in step.

import type { Lang } from './content.ts';

/** Complete: every rule of the return is covered. Preview: works, with the gaps the app says. */
export type CantonStatus = 'complete' | 'preview';

export interface Canton {
  /** The official two-letter code. */
  code: string;
  name: Record<Lang, string>;
}

/** The cantons that work today, the most complete first. */
export const CANTONS: readonly (Canton & { status: CantonStatus })[] = [
  {
    code: 'GE',
    status: 'complete',
    name: { en: 'Geneva', fr: 'Genève', de: 'Genf', it: 'Ginevra', es: 'Ginebra', pt: 'Genebra' },
  },
  {
    code: 'ZH',
    status: 'preview',
    name: { en: 'Zurich', fr: 'Zurich', de: 'Zürich', it: 'Zurigo', es: 'Zúrich', pt: 'Zurique' },
  },
  {
    code: 'BE',
    status: 'preview',
    name: { en: 'Bern', fr: 'Berne', de: 'Bern', it: 'Berna', es: 'Berna', pt: 'Berna' },
  },
  {
    code: 'VD',
    status: 'preview',
    name: { en: 'Vaud', fr: 'Vaud', de: 'Waadt', it: 'Vaud', es: 'Vaud', pt: 'Vaud' },
  },
  {
    code: 'BS',
    status: 'preview',
    name: {
      en: 'Basel-Stadt',
      fr: 'Bâle-Ville',
      de: 'Basel-Stadt',
      it: 'Basilea Città',
      es: 'Basilea-Ciudad',
      pt: 'Basileia-Cidade',
    },
  },
  {
    code: 'BL',
    status: 'preview',
    name: {
      en: 'Basel-Landschaft',
      fr: 'Bâle-Campagne',
      de: 'Basel-Landschaft',
      it: 'Basilea Campagna',
      es: 'Basilea-Campiña',
      pt: 'Basileia-Campo',
    },
  },
  {
    code: 'ZG',
    status: 'preview',
    name: { en: 'Zug', fr: 'Zoug', de: 'Zug', it: 'Zugo', es: 'Zug', pt: 'Zug' },
  },
  {
    code: 'LU',
    status: 'preview',
    name: {
      en: 'Lucerne',
      fr: 'Lucerne',
      de: 'Luzern',
      it: 'Lucerna',
      es: 'Lucerna',
      pt: 'Lucerna',
    },
  },
  {
    code: 'SG',
    status: 'preview',
    name: {
      en: 'St. Gallen',
      fr: 'Saint-Gall',
      de: 'St. Gallen',
      it: 'San Gallo',
      es: 'San Galo',
      pt: 'São Galo',
    },
  },
  {
    code: 'AG',
    status: 'preview',
    name: {
      en: 'Aargau',
      fr: 'Argovie',
      de: 'Aargau',
      it: 'Argovia',
      es: 'Argovia',
      pt: 'Argóvia',
    },
  },
];

/** When a canton that doesn't work yet should come: the next ones, then the ones after. */
export type CantonWhen = 'next' | 'then';

/** The cantons coming next, in order. Not in the extension yet. */
export const NEXT_CANTONS: readonly (Canton & { when: CantonWhen })[] = [
  {
    code: 'FR',
    when: 'then',
    name: {
      en: 'Fribourg',
      fr: 'Fribourg',
      de: 'Freiburg',
      it: 'Friburgo',
      es: 'Friburgo',
      pt: 'Friburgo',
    },
  },
  {
    code: 'TI',
    when: 'then',
    name: { en: 'Ticino', fr: 'Tessin', de: 'Tessin', it: 'Ticino', es: 'Tesino', pt: 'Ticino' },
  },
];

const AND: Record<Lang, string> = { en: 'and', fr: 'et', de: 'und', it: 'e', es: 'y', pt: 'e' };

/**
 * Names as a list in running text: "A, B and C", "A, B et C", "A, B und C", "A, B e C",
 * "A, B y C". Spanish says "e" before a word that starts with the sound i ("Zug e Ibiza").
 */
export function listOf(lang: Lang, items: readonly string[]): string {
  if (items.length < 2) return items[0] ?? '';
  const last = items[items.length - 1]!;
  const and = lang === 'es' && /^h?i(?![aeouáéóú])/i.test(last) ? 'e' : AND[lang];
  return `${items.slice(0, -1).join(', ')} ${and} ${last}`;
}

/** The cantons of one group, named in a language, in the order of the lists above. */
export function cantonNames(lang: Lang, group: CantonStatus | CantonWhen): string[] {
  return [
    ...CANTONS.filter((c) => c.status === group),
    ...NEXT_CANTONS.filter((c) => c.when === group),
  ].map((c) => c.name[lang]);
}
