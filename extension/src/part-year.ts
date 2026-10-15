// A year of arrival from abroad or of departure abroad in Geneva (SPEC.md section 1, the owner's
// decision of 14 October 2026): what the extension says about it beside the engine. Simple first
// (docs/design/simple.md): no card and no field of its own. The day is an answer (the questions
// arrival_date and departure_date); the fact is a sentence in "About you" (journey.ts); Claude's
// guidance sits in the next step (partYearHint) and in compute_tax's result (partYearGuide).
import { dayText } from '@taxpresso/questionnaire';
import type { Text } from '@taxpresso/rules-ch';
import type { TaxResult } from '@taxpresso/rules-ge';
import { sourceTaxOf } from './source-tax.js';
import type { Workspace } from './workspace.js';

type Lang = 'en' | 'fr' | 'de' | 'it';
const LANGS: readonly Lang[] = ['en', 'fr', 'de', 'it'];

/** The household's year of arrival or departure, as the answers give it (Geneva only). */
export interface PartYearAnswers {
  kind: 'arrival' | 'departure';
  /** Each person's day, when answered: the same for a couple, or not supported. */
  days: string[];
  couple: boolean;
}

export function partYearAnswers(ws: Workspace): PartYearAnswers | undefined {
  if (ws.canton().canton?.code !== 'GE') return undefined;
  const snap = ws.snapshot();
  const moved = snap.answers.get('profile.moved|household');
  const kind =
    moved === 'from_abroad' ? 'arrival' : moved === 'leaving_switzerland' ? 'departure' : undefined;
  if (!kind) return undefined;
  const key = kind === 'arrival' ? 'profile.arrival_date' : 'profile.departure_date';
  const people = snap.people.filter((p) => p === 'p1' || p === 'p2');
  const days = people
    .map((p) => snap.answers.get(`${key}|${p}`))
    .filter((d): d is string => typeof d === 'string');
  return { kind, days, couple: people.length > 1 };
}

/**
 * A fact of "About you" about the year of arrival or departure, in every language: one short
 * sentence, why in a few more words (behind "Why?" on the dashboard), and its source.
 */
export interface PartYearFact {
  id: 'part_year';
  text: Required<Text>;
  why?: Required<Text>;
  source: string;
}

const NB = ' ';

/** CHF 1’234, whole francs, the Swiss way. */
const francs = (centimes: number) =>
  `CHF${NB}${String(Math.round(Math.abs(centimes) / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, '’')}`;

const inEach = (f: (lang: Lang) => string) =>
  Object.fromEntries(LANGS.map((l) => [l, f(l)])) as Required<Text>;

/**
 * "About you" for a year of arrival or departure: the day, and that Geneva taxes the income of the
 * period at the rate of a full year's income (with that rate's income once the engine has it); or,
 * when Taxpresso can't prepare it, the engine's reason. Nothing otherwise, or before the day.
 */
export function partYearFacts(ws: Workspace): PartYearFact[] {
  const a = partYearAnswers(ws);
  if (!a || !a.days.length) return [];
  const r = ws.estimate().result as TaxResult | null;
  const arrival = a.kind === 'arrival';
  const source = arrival
    ? 'ge-2025-guide-declaration-pp p. 53; ge-na-law-lipp art. 62 al. 3; ch-na-law-lifd art. 40 al. 3 (p. 33)'
    : 'ge-2025-guide-declaration-pp p. 54; ge-na-law-lipp art. 62 al. 3 and 64 al. 1; ch-na-law-lifd art. 40 al. 3 (p. 33)';
  // Not prepared (fail closed): the engine's own reasons about this year, in its words, after the
  // fact itself (the pension capital's are its own: ./journey.ts says them with the capital).
  const year = arrival ? /arrived|part of a year/i : /left Switzerland|part of a year/i;
  const stopped: PartYearFact[] = (r?.unsupported ?? [])
    .filter((u) => year.test(u.en) && !/pension capital/i.test(u.en))
    .map((u) => ({
      id: 'part_year' as const,
      text: { en: u.en, fr: u.fr, de: u.de ?? u.en, it: u.it ?? u.en },
      source,
    }));
  const day = a.days[0]!;
  const both = a.couple && a.days.length > 1;
  const rate = r?.partYear?.icc?.rateTotal.amount;
  const rateText = (lang: Lang) =>
    rate === undefined
      ? ''
      : {
          en: ` (${francs(rate)} for the rate, revenu net pour le taux)`,
          fr: ` (${francs(rate)} pour le taux, revenu net pour le taux)`,
          de: ` (${francs(rate)} für den Satz, revenu net pour le taux)`,
          it: ` (${francs(rate)} per l’aliquota, revenu net pour le taux)`,
        }[lang];
  // The day first, in one sentence; how Geneva taxes the period behind "Why?". Leaving, the
  // sentence is what to do: the tax office's departure form, at least 15 days before.
  const text = (lang: Lang): string => {
    const d = dayText(day, lang);
    if (arrival) {
      return {
        en: `${both ? 'You both arrived' : 'You arrived'} on ${d}: Geneva taxes your income from that day.`,
        fr: `${both ? 'Vous êtes arrivés tous les deux' : 'Vous êtes arrivé'} le ${d}${NB}: Genève impose votre revenu dès cette date.`,
        de: `${both ? 'Ihr seid beide' : 'Du bist'} am ${d} zugezogen: Genf besteuert dein Einkommen ab diesem Tag.`,
        it: `${both ? 'Siete arrivati entrambi' : 'Sei arrivato'} il ${d}: Ginevra tassa il tuo reddito da quel giorno.`,
      }[lang];
    }
    return {
      en: `${both ? 'You both leave' : 'You leave'} Switzerland on ${d}: go to the tax office at least 15 days before, with its departure form (questionnaire de départ).`,
      fr: `${both ? 'Vous quittez tous les deux' : 'Vous quittez'} la Suisse le ${d}${NB}: présentez-vous à l’administration fiscale au moins 15 jours avant, avec son questionnaire de départ.`,
      de: `${both ? 'Ihr verlasst beide' : 'Du verlässt'} die Schweiz am ${d}: ${both ? 'Geht' : 'Geh'} mindestens 15 Tage vorher mit dem Wegzugsformular (questionnaire de départ) zur Steuerverwaltung.`,
      it: `${both ? 'Lasciate entrambi' : 'Lasci'} la Svizzera il ${d}: ${both ? 'presentatevi' : 'presentati'} all’amministrazione fiscale almeno 15 giorni prima, con il suo questionario di partenza (questionnaire de départ).`,
    }[lang];
  };
  const why = (lang: Lang): string => {
    const rt = rateText(lang);
    if (arrival) {
      return {
        en: `Your income is taxed at the rate of a full year’s income${rt}, and your wealth as it is on 31 December.`,
        fr: `Votre revenu est imposé au taux d’un revenu annuel${rt}, et votre fortune telle qu’elle est au 31 décembre.`,
        de: `Dein Einkommen wird zum Satz eines ganzen Jahreseinkommens besteuert${rt}, dein Vermögen nach dem Stand am 31. Dezember.`,
        it: `Il tuo reddito è tassato all’aliquota di un reddito annuo${rt}, la tua sostanza secondo il suo stato al 31 dicembre.`,
      }[lang];
    }
    return {
      en: `Geneva taxes your income from 1 January to that day, at the rate of a full year’s income${rt}, and your wealth as it is on that day.`,
      fr: `Genève impose votre revenu du 1er janvier à cette date, au taux d’un revenu annuel${rt}, et votre fortune telle qu’elle est ce jour-là.`,
      de: `Genf besteuert dein Einkommen vom 1. Januar bis zu diesem Tag, zum Satz eines ganzen Jahreseinkommens${rt}, und dein Vermögen nach dem Stand an diesem Tag.`,
      it: `Ginevra tassa il tuo reddito dal 1° gennaio fino a quel giorno, all’aliquota di un reddito annuo${rt}, e la tua sostanza secondo il suo stato a quel giorno.`,
    }[lang];
  };
  const out: PartYearFact[] = [{ id: 'part_year', text: inEach(text), why: inEach(why), source }];
  // Taxed at source and leaving: TOU goes with the departure form, before leaving (ch. 8.5).
  if (!arrival && sourceTaxOf(ws)?.any) {
    const d = (lang: Lang) => dayText(day, lang);
    out.push({
      id: 'part_year',
      text: {
        en: `A TOU (taxation ordinaire ultérieure) goes with your departure form, before ${d('en')}.`,
        fr: `Une TOU (taxation ordinaire ultérieure) se fait avec votre formulaire de départ, avant le ${d('fr')}.`,
        de: `Eine TOU (taxation ordinaire ultérieure) läuft über dein Wegzugsformular, vor dem ${d('de')}.`,
        it: `Una TOU (taxation ordinaire ultérieure) va con il tuo modulo di partenza, prima del ${d('it')}.`,
      },
      why: {
        en: 'Taxed at source and leaving: a TOU, compulsory or asked for, goes with the departure form you hand in at the tax office, not by 31 March.',
        fr: `Imposé à la source et sur le départ${NB}: une TOU, obligatoire ou demandée, se fait avec le formulaire de départ que vous déposez à l’administration fiscale, et non au 31 mars.`,
        de: 'An der Quelle besteuert und Wegzug: Eine TOU, obligatorisch oder beantragt, läuft über das Wegzugsformular, das du bei der Steuerverwaltung abgibst, nicht bis zum 31. März.',
        it: 'Imposta alla fonte e partenza: una TOU, obbligatoria o chiesta, va con il modulo di partenza che consegni all’amministrazione fiscale, non entro il 31 marzo.',
      },
      source: `ge-${ws.taxYear}-source-directives ${ws.taxYear === 2025 ? 'p. 53' : 'p. 54'} (ch. 8.5)`,
    });
  }
  return [...out, ...stopped];
}

/**
 * What Claude asks for in a year of arrival or departure, in the steps where it asks for figures or
 * documents: the figures of the period only, never a full year's. Empty otherwise.
 */
export function partYearHint(ws: Workspace): string {
  const a = partYearAnswers(ws);
  if (!a) return '';
  if (a.kind === 'arrival') {
    return ' They arrived from abroad this year: every figure is from the day they arrived (salary, premiums, 3a), never a full year’s; a rough salary saved with set_fact (plan.gross_salary) is what they earn in Switzerland from that day. Their salary certificate shows the period; their arrival attestation or permit, the day.';
  }
  return ' They leave Switzerland this year: every figure is from 1 January to the day they leave, never a full year’s, and their accounts and debts on that day; a rough salary saved with set_fact (plan.gross_salary) is what they earn until then.';
}

/** compute_tax's line for a year of arrival or departure, only when the result has one. */
export function partYearGuide(r: TaxResult): string {
  const p = r.partYear;
  if (!p) return '';
  const icc = p.icc?.rateTotal.amount;
  const ifd = p.ifd?.rateTotal.amount;
  const chf = (c: number) => `CHF ${Math.round(c / 100).toLocaleString('en-US')}`;
  return `A year of ${p.kind === 'arrival' ? 'arrival from abroad' : 'departure abroad'}: the taxes are on the income of ${p.from} to ${p.to} (${p.days} of 360 days), at the rate of a full year's income${icc !== undefined ? ` (revenu net pour le taux, 95.00: ${chf(icc)} cantonal${ifd !== undefined ? `, ${chf(ifd)} federal` : ''})` : ''}. Say it as it is; never present a full year's tax, and say the readings it lists as not spelled out.`;
}
