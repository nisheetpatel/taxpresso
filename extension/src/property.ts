// A property in Geneva (SPEC.md section 1, the owner's decision of 14 October 2026): what the
// extension says about it beside the engine. Simple first (docs/design/simple.md): no card and no
// field of its own; the facts are sentences in "About you" (journey.ts), the documents go through
// the documents flow, and the figures come from documents or from the user's own words.
import type { Text } from '@taxpresso/rules-ch';
import type { TaxResult } from '@taxpresso/rules-ge';
import { PROPERTY_KINDS } from './kinds.js';
import type { Workspace } from './workspace.js';

/** The answers that put a property outside the simple case (the questionnaire says so). */
const OUTSIDE = new Set(['other_canton', 'several', 'other']);

/**
 * The household said it owns real estate in Switzerland (Geneva), the simple case Taxpresso
 * prepares or still to be answered, or has one of its documents.
 */
export function ownsPropertyInGeneva(ws: Workspace): boolean {
  if (ws.canton().canton?.code !== 'GE') return false;
  const answers = ws.snapshot().answers;
  const special = answers.get('profile.special|household');
  if (Array.isArray(special) && special.includes('real_estate')) {
    const what = answers.get('profile.swiss_property|household');
    return typeof what !== 'string' || !OUTSIDE.has(what);
  }
  return ws.activeDocuments().some((d) => d.kind !== undefined && PROPERTY_KINDS.has(d.kind));
}

/** A sentence of "About you" about the property in Geneva, in every language, with its source. */
export interface PropertyFact {
  id: 'property';
  text: Required<Text>;
  source: string;
  estimate?: true;
}

const NB = ' ';

/** CHF 1'234, in whole francs, the Swiss way, for the sentences (the engine's lines have the cents). */
const francs = (centimes: number) =>
  `CHF${NB}${String(Math.round(Math.abs(centimes) / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, '’')}`;

/**
 * "About you" for a household with a property in Geneva: what is declared (its value after the
 * abattement, its rental value or rents), or, when Taxpresso can't prepare it, why (the engine's own
 * words). Nothing without one.
 */
export function propertyFacts(ws: Workspace): PropertyFact[] {
  if (!ownsPropertyInGeneva(ws)) return [];
  const r = ws.estimate().result as TaxResult | null;
  // Outside the simple case (fail closed): the engine's reason, in its words.
  const stopped = (r?.unsupported ?? []).filter((u) =>
    /property in Geneva|home in Geneva|home’s rental value|rental value of a home its owner/i.test(
      u.en,
    ),
  );
  if (stopped.length) {
    return stopped.map((u) => ({
      id: 'property' as const,
      text: { en: u.en, fr: u.fr, de: u.de ?? u.en, it: u.it ?? u.en },
      source: 'ge-na-law-lipp art. 24 and 50 let. e; ge-2025-guide-declaration-pp p. 32 to 35',
    }));
  }
  const p = r?.property;
  if (!p) return [];
  const own = p.use === 'own_home';
  const code = own ? '15.10' : '15.20';
  const value = p.wealth.find((i) => i.code === code);
  const income = p.icc.find((i) => i.code === code);
  const rentalIfd = p.ifd.find((i) => i.code === code);
  const estimate = [value, income].some(
    (l) => l?.estimates?.includes('input-estimate') || l?.needsOk,
  );
  const pct = p.abattementBp !== undefined ? String(p.abattementBp / 100) : undefined;
  const parts = {
    en: [
      value
        ? `its value ${francs(value.amount)}${own && pct ? ` (after the ${pct} % abattement)` : ''}`
        : '',
      income
        ? own
          ? `its rental value ${francs(rentalIfd?.amount ?? income.amount)}, ${francs(income.amount)} for the cantonal tax`
          : `its rents ${francs(income.amount)}`
        : '',
    ],
    fr: [
      value
        ? `sa valeur ${francs(value.amount)}${own && pct ? ` (après l’abattement de ${pct}${NB}%)` : ''}`
        : '',
      income
        ? own
          ? `sa valeur locative ${francs(rentalIfd?.amount ?? income.amount)}, ${francs(income.amount)} pour l’impôt cantonal`
          : `ses loyers ${francs(income.amount)}`
        : '',
    ],
    de: [
      value
        ? `ihr Wert ${francs(value.amount)}${own && pct ? ` (nach dem abattement von ${pct} %)` : ''}`
        : '',
      income
        ? own
          ? `ihr Eigenmietwert ${francs(rentalIfd?.amount ?? income.amount)}, ${francs(income.amount)} für die Kantonssteuer`
          : `die Mieten ${francs(income.amount)}`
        : '',
    ],
    it: [
      value
        ? `il suo valore ${francs(value.amount)}${own && pct ? ` (dopo l’abattement del ${pct} %)` : ''}`
        : '',
      income
        ? own
          ? `il suo valore locativo ${francs(rentalIfd?.amount ?? income.amount)}, ${francs(income.amount)} per l’imposta cantonale`
          : `gli affitti ${francs(income.amount)}`
        : '',
    ],
  };
  const join = (lang: 'en' | 'fr' | 'de' | 'it') =>
    parts[lang].filter(Boolean).join({ en: ' and ', fr: ' et ', de: ' und ', it: ' e ' }[lang]);
  const what = own
    ? {
        en: 'Your home in Geneva is declared on annexe D (immeubles occupés par le propriétaire)',
        fr: 'Votre logement à Genève est déclaré à l’annexe D (immeubles occupés par le propriétaire)',
        de: 'Deine Wohnung in Genf wird in der annexe D deklariert (immeubles occupés par le propriétaire)',
        it: 'La tua abitazione a Ginevra si dichiara nell’annexe D (immeubles occupés par le propriétaire)',
      }
    : {
        en: 'Your property let in Geneva is declared on annexe D (immeubles locatifs ou loués)',
        fr: 'Votre immeuble loué à Genève est déclaré à l’annexe D (immeubles locatifs ou loués)',
        de: 'Deine vermietete Liegenschaft in Genf wird in der annexe D deklariert (immeubles locatifs ou loués)',
        it: 'Il tuo immobile affittato a Ginevra si dichiara nell’annexe D (immeubles locatifs ou loués)',
      };
  return [
    {
      id: 'property',
      text: {
        en: `${what.en}${join('en') ? `: ${join('en')}` : ''}.`,
        fr: `${what.fr}${join('fr') ? `${NB}: ${join('fr')}` : ''}.`,
        de: `${what.de}${join('de') ? `: ${join('de')}` : ''}.`,
        it: `${what.it}${join('it') ? `: ${join('it')}` : ''}.`,
      },
      source: own
        ? 'ge-2025-guide-declaration-pp p. 32 to 34; ge-na-law-lipp art. 24 al. 2 and 50 let. e'
        : 'ge-2025-guide-declaration-pp p. 34 and 35; ge-na-revenu-immobilier-page (Si vous louez votre bien)',
      ...(estimate ? { estimate: true as const } : {}),
    },
  ];
}

/**
 * What Claude asks for a property in Geneva whose figures aren't in yet: in plain words, saved as
 * estimates until its documents are in (docs/design/simple.md: never a technical figure). Empty
 * when the property's value is known or there is none.
 */
export function propertyHint(ws: Workspace): string {
  if (!ownsPropertyInGeneva(ws)) return '';
  const r = ws.estimate().result as TaxResult | null;
  if (r?.property?.wealth.length) return '';
  const answers = ws.snapshot().answers;
  const let_ = answers.get('profile.swiss_property|household') === 'let';
  const loan = answers.get('profile.swiss_property_loan|household') === true;
  return ` Their property in Geneva’s figures come from its documents: the AFC’s letter with its tax value${let_ ? '' : ' and rental value'} (sent before 31 March; the avis de taxation immobilier shows them too)${let_ ? ', the management account (compte de gestion)' : ''}${loan ? ' and the mortgage statement' : ''}. Until they are in, ask roughly what their last tax notice gives as its value${let_ ? ' and the rent of the year' : ' and its rental value'}${loan ? ', and roughly what they owe on the mortgage and its interest this year' : ''}, and save them with set_fact (plan.property_value, ${let_ ? 'plan.property_rent' : 'plan.property_rental_value'}${loan ? ', plan.mortgage_balance, plan.mortgage_interest' : ''}, in francs): Taxpresso uses them as estimates. Never ask for the abattement, the flat rates or the taux d’effort: Taxpresso works them out.`;
}

/** What Claude reads in a property's documents (the reading step). */
export function propertyReadingHint(ws: Workspace): string {
  if (!ownsPropertyInGeneva(ws)) return '';
  return ' The property in Geneva’s documents: from the AFC’s letter or avis de taxation immobilier, the tax value and the rental value for the year as printed (before any abattement); from upkeep invoices and the PPE charges statement, only the deductible upkeep (repairs that keep the value, energy saving, building insurance, the renovation fund, the impôt immobilier complémentaire billed; never heating, hot water or works that add value).';
}
