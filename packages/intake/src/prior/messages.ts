// Warnings about last year's declaration, in English and French. Second person, plain words.
// Placeholders are filled from rubric codes, page numbers and years only: never from the
// document's own text, so no name or number of the taxpayer can end up in a warning.
import type { PriorWarning } from './types.js';

const MESSAGES = {
  no_text: {
    en: 'This declaration has no text layer (a scan or a photo), so Taxpresso can’t read it. Use the PDF from GeTax or from your online declaration.',
    fr: 'Cette déclaration n’a pas de couche texte (un scan ou une photo), Taxpresso ne peut donc pas la lire. Utilisez le PDF de GeTax ou de votre déclaration en ligne.',
  },
  no_year: {
    en: 'The tax year can’t be read from this declaration. Check that it is last year’s.',
    fr: 'L’année fiscale ne peut pas être lue dans cette déclaration. Vérifiez qu’il s’agit bien de celle de l’an dernier.',
  },
  years_differ: {
    en: 'The pages of this declaration name different tax years ({years}). Check that they all belong to one declaration.',
    fr: 'Les pages de cette déclaration indiquent des années fiscales différentes ({years}). Vérifiez qu’elles appartiennent toutes à la même déclaration.',
  },
  no_summary: {
    en: 'The summary pages (récapitulation, pages 2 to 4) were not found, so last year’s totals are missing.',
    fr: 'Les pages de récapitulation (pages 2 à 4) sont introuvables, les totaux de l’an dernier manquent donc.',
  },
  pages_missing: {
    en: 'The declaration says it has {total} pages, but this file has {pages}. Some figures may be missing.',
    fr: 'La déclaration indique {total} pages, mais ce fichier en contient {pages}. Certains montants peuvent manquer.',
  },
  column_guess: {
    en: 'Page {page}, code {code}: Taxpresso can’t tell whether the amount is for the cantonal tax (ICC) or the federal tax (IFD). It is kept as cantonal: check it.',
    fr: 'Page {page}, code {code} : Taxpresso ne peut pas dire si le montant concerne l’impôt cantonal (ICC) ou l’impôt fédéral (IFD). Il est gardé comme cantonal : vérifiez-le.',
  },
  commune_unclear: {
    en: 'Page {page}: more than one commune appears, so your commune is not suggested. Taxpresso asks you instead.',
    fr: 'Page {page} : plusieurs communes apparaissent, votre commune n’est donc pas proposée. Taxpresso vous la demande.',
  },
} as const satisfies Record<string, { en: string; fr: string }>;

export type PriorWarningCode = keyof typeof MESSAGES;

const NBSP = String.fromCharCode(0xa0);
const frenchSpacing = (s: string) =>
  s.replace(/ ([?!:;»])/g, `${NBSP}$1`).replace(/« /g, `«${NBSP}`);

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * A warning stored in English (documents.json keeps one language) in the page's language: the
 * English text is matched against its template and the French one filled with the same values.
 * Unknown text comes back as it is.
 */
export function localizePriorWarning(text: string, lang: 'en' | 'fr'): string {
  if (lang === 'en') return text;
  for (const m of Object.values(MESSAGES)) {
    const names: string[] = [];
    const re = new RegExp(
      `^${escapeRe(m.en).replace(/\\\{(\w+)\\\}/g, (_, name: string) => {
        names.push(name);
        return '(.*?)';
      })}$`,
    );
    const hit = re.exec(text);
    if (!hit) continue;
    const params = Object.fromEntries(names.map((n, i) => [n, hit[i + 1] ?? '']));
    return frenchSpacing(m.fr.replace(/\{(\w+)\}/g, (_, k: string) => params[k] ?? ''));
  }
  return text;
}

export function priorWarning(
  code: PriorWarningCode,
  params: Record<string, string | number> = {},
  page?: number,
): PriorWarning {
  const fill = (s: string) =>
    s.replace(/\{(\w+)\}/g, (_, k: string) => String(params[k] ?? (k === 'page' ? page : '')));
  return {
    code,
    en: fill(MESSAGES[code].en),
    fr: frenchSpacing(fill(MESSAGES[code].fr)),
    ...(page !== undefined ? { page } : {}),
  };
}
