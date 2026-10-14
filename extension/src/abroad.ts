// A home or land abroad in Geneva (SPEC.md section 1, the owner's decision of 14 October 2026):
// what the extension says about it beside the engine. Simple first (docs/design/simple.md): no
// card and no field of its own; the facts are sentences in "About you" (journey.ts), the documents
// go through the documents flow, and the figures come from documents or from the user's own words.
import type { Text } from '@taxpresso/rules-ch';
import type { TaxResult } from '@taxpresso/rules-ge';
import { ABROAD_KINDS } from './kinds.js';
import type { Workspace } from './workspace.js';

/** The household said it owns a home or land abroad (Geneva), or has one of its documents. */
export function ownsPropertyAbroad(ws: Workspace): boolean {
  if (ws.canton().canton?.code !== 'GE') return false;
  const special = ws.snapshot().answers.get('profile.special|household');
  if (Array.isArray(special) && special.includes('property_abroad')) return true;
  return ws.activeDocuments().some((d) => d.kind !== undefined && ABROAD_KINDS.has(d.kind));
}

/** A sentence of "About you" about the property abroad, in every language, with its source. */
export interface AbroadFact {
  id: 'abroad';
  text: Required<Text>;
  source: string;
  estimate?: true;
}

const NB = ' ';

/** CHF 1'234, in whole francs, the Swiss way, for the sentences (the engine's lines have the cents). */
const francs = (centimes: number) =>
  `CHF${NB}${String(Math.round(Math.abs(centimes) / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, '’')}`;

const WHAT: Record<'own_use' | 'let' | 'land', Required<Text>> = {
  own_use: {
    en: 'Your home abroad',
    fr: 'Votre logement à l’étranger',
    de: 'Deine Wohnung im Ausland',
    it: 'La tua abitazione all’estero',
  },
  let: {
    en: 'Your property let abroad',
    fr: 'Votre immeuble loué à l’étranger',
    de: 'Deine vermietete Liegenschaft im Ausland',
    it: 'Il tuo immobile affittato all’estero',
  },
  land: {
    en: 'Your land abroad',
    fr: 'Votre terrain à l’étranger',
    de: 'Dein Grundstück im Ausland',
    it: 'Il tuo terreno all’estero',
  },
};

/**
 * "About you" for a household with a property abroad: that it is taxed where it lies and counted
 * here only for the rate, with its figures once the engine has them; how the debts are shared with
 * it; or, when Taxpresso can't prepare it, why (the engine's own words). Nothing without one.
 */
export function abroadFacts(ws: Workspace): AbroadFact[] {
  if (!ownsPropertyAbroad(ws)) return [];
  const r = ws.estimate().result as TaxResult | null;
  const out: AbroadFact[] = [];
  // Outside the simple case (fail closed): the engine's reason, in its words.
  const stopped = (r?.unsupported ?? []).filter((u) => /abroad/i.test(u.en));
  if (stopped.length) {
    return stopped.map((u) => ({
      id: 'abroad' as const,
      text: { en: u.en, fr: u.fr, de: u.de ?? u.en, it: u.it ?? u.en },
      source: 'ge-na-law-lipp art. 5 al. 3 and 4; ch-na-law-lifd art. 6 al. 3',
    }));
  }
  const a = r?.abroad;
  const use = a?.use ?? 'own_use';
  const what = WHAT[use];
  const code = use === 'own_use' ? '15.10' : '15.20';
  const value = a?.wealth.find((i) => i.code === code);
  const income = a?.icc.find((i) => i.code === code);
  const estimate = [value, income].some((l) => l?.estimates?.length || l?.needsOk);
  const figures = (lang: 'en' | 'fr' | 'de' | 'it') => {
    if (!value && !income) return '';
    const words = {
      en: [
        income
          ? `${use === 'let' ? 'its rents' : 'its rental value'} ${francs(income.amount)}`
          : '',
        value ? `its value ${francs(value.amount)}` : '',
      ],
      fr: [
        income
          ? `${use === 'let' ? 'ses loyers' : 'sa valeur locative'} ${francs(income.amount)}`
          : '',
        value ? `sa valeur ${francs(value.amount)}` : '',
      ],
      de: [
        income
          ? `${use === 'let' ? 'die Mieten' : 'der Eigenmietwert'} ${francs(income.amount)}`
          : '',
        value ? `der Wert ${francs(value.amount)}` : '',
      ],
      it: [
        income
          ? `${use === 'let' ? 'gli affitti' : 'il valore locativo'} ${francs(income.amount)}`
          : '',
        value ? `il valore ${francs(value.amount)}` : '',
      ],
    }[lang].filter(Boolean);
    const join = { en: ' and ', fr: ' et ', de: ' und ', it: ' e ' }[lang];
    return words.join(join);
  };
  out.push({
    id: 'abroad',
    text: {
      en: `${what.en} is taxed in its country. Switzerland counts it only to set your rate (exemption avec réserve de progression)${figures('en') ? `: ${figures('en')}` : ''}.`,
      fr: `${what.fr} est imposé dans son pays. La Suisse le compte seulement pour fixer votre taux (exemption avec réserve de progression)${figures('fr') ? `${NB}: ${figures('fr')}` : ''}.`,
      de: `${what.de} wird in ihrem Land besteuert. Die Schweiz zählt sie nur für deinen Steuersatz (exemption avec réserve de progression)${figures('de') ? `: ${figures('de')}` : ''}.`,
      it: `${what.it} è tassato nel suo Paese. La Svizzera lo conta solo per stabilire la tua aliquota (exemption avec réserve de progression)${figures('it') ? `: ${figures('it')}` : ''}.`,
    },
    source: 'ge-na-law-lipp art. 5 and 6; ch-na-law-lifd art. 6 al. 1 and art. 7 al. 1',
    ...(estimate ? { estimate: true as const } : {}),
  });
  const interest = a?.interestIcc;
  if (interest && interest.amount > 0 && a) {
    const pct = (a.shareBp / 100).toFixed(1);
    out.push({
      id: 'abroad',
      text: {
        en: `Your debts and their interest are shared with it by where your assets lie (${pct} % abroad): ${francs(interest.amount)} of interest goes abroad, wherever the loan was taken out.`,
        fr: `Vos dettes et leurs intérêts sont répartis avec lui selon la situation de vos actifs (${pct.replace('.', ',')}${NB}% à l’étranger)${NB}: ${francs(interest.amount)} d’intérêts vont à l’étranger, où que l’emprunt ait été contracté.`,
        de: `Deine Schulden und ihre Zinsen werden nach der Lage deiner Vermögenswerte aufgeteilt (${pct} % im Ausland): ${francs(interest.amount)} Zinsen gehen ins Ausland, wo auch immer der Kredit aufgenommen wurde.`,
        it: `I tuoi debiti e i loro interessi sono ripartiti secondo dove si trovano i tuoi beni (${pct.replace('.', ',')} % all’estero): ${francs(interest.amount)} di interessi vanno all’estero, ovunque sia stato contratto il prestito.`,
      },
      source: 'ge-na-law-lipp art. 57; ch-na-law-lifd art. 6 al. 3; zh-na-zstb-5-3 p. 1',
      ...(interest.estimates?.length || interest.needsOk ? { estimate: true as const } : {}),
    });
  }
  return out;
}

/**
 * What Claude asks for a property abroad whose figures aren't in yet: in plain words, each with its
 * currency, saved as estimates until its documents are in (docs/design/simple.md: never a
 * technical figure). Empty when the property's value is known or there is none.
 */
export function abroadHint(ws: Workspace): string {
  if (!ownsPropertyAbroad(ws)) return '';
  const r = ws.estimate().result as TaxResult | null;
  if (r?.abroad?.wealth.length) return '';
  return ' Their property abroad’s figures come from its documents, read like any other, each amount as printed with its currency: the country’s tax notice or the deed of purchase, the management account of a property let, and the loan statement. Until they are in, ask roughly what it is worth and, if it is let, the rent of the year, each with its currency, and save them with set_fact (plan.abroad_value, plan.abroad_rent, for example "250000 EUR"): Taxpresso converts them at the official rate, as estimates.';
}
