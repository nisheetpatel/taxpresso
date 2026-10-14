// Checking the assessment (SPEC.md section 10.8): what the tax office assessed against what was
// declared, item by item, and the deadline to object (réclamation). Pure functions; Taxpresso
// never files the objection.
//
// The deadline, read in the law itself:
// - Cantonal and communal tax (ICC): LPFisc, rsGE D 3 17 (ge-na-law-lpfisc), ./objection.ts.
// - Federal direct tax (IFD): LIFD, RS 642.11 (ch-na-law-lifd, p. 71), the same in every canton:
//   packages/rules-ch (ifd/objection.ts). Art. 132 al. 1: 30 days after notification. Art. 133
//   al. 1: the same counting and the same weekend and holiday rule.
// Public holidays are not computed here (no official calendar in the sources yet), so the date
// shown is never later than the real deadline: it can only be earlier, by the holiday. The deadline
// printed on the assessment always wins.
import type { Fact, VaultDocument } from '@taxpresso/ledger';
import { IFD_OBJECTION, type ObjectionRule } from '@taxpresso/rules-ch';
import type { Text } from './checks.js';
import { ICC_OBJECTION_2026 } from './objection.js';

export type AssessedTax = 'icc' | 'ifd';

export type { ObjectionRule };

export const OBJECTION_2026: Record<AssessedTax, ObjectionRule> = {
  icc: ICC_OBJECTION_2026,
  ifd: IFD_OBJECTION,
};

export interface ObjectionDeadline {
  tax: AssessedTax;
  /** The last day to send the réclamation, YYYY-MM-DD. */
  date: string;
  /** True when the 30th day fell on a weekend and the deadline moved to the Monday. */
  movedFromWeekend: boolean;
  days: number;
  sources: string[];
  law: string;
}

const addDays = (iso: string, days: number): Date => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
};

/**
 * The last day to object, counted from the notification date as the law says: the day after
 * notification is day 1, so the last day is notification + 30 days; a Saturday or Sunday moves it
 * to the Monday. Public holidays are not counted (see the file comment): the result is never later
 * than the real deadline.
 */
export function objectionDeadline(notification: string, tax: AssessedTax): ObjectionDeadline {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(notification)) throw new Error('notification must be YYYY-MM-DD');
  const rule = OBJECTION_2026[tax];
  const last = addDays(notification, rule.days.value);
  const weekday = last.getUTCDay(); // 0 Sunday, 6 Saturday
  const shift = weekday === 6 ? 2 : weekday === 0 ? 1 : 0;
  if (shift) last.setUTCDate(last.getUTCDate() + shift);
  return {
    tax,
    date: last.toISOString().slice(0, 10),
    movedFromWeekend: shift > 0,
    days: rule.days.value,
    sources: [rule.days.source, rule.counting],
    law: rule.law,
  };
}

/** Assessed items and the declared values they compare with (summed over people and documents). */
export const ASSESSMENT_ITEMS_2026: readonly { assessed: string; declared: readonly string[] }[] = [
  { assessed: 'assessment.salary_gross', declared: ['salary.gross'] },
  { assessed: 'assessment.social_contributions', declared: ['salary.social_contributions'] },
  { assessed: 'assessment.lpp_contributions', declared: ['salary.lpp_ordinary'] },
  { assessed: 'assessment.lpp_buyin', declared: ['salary.lpp_buyin', 'lpp.buyin'] },
  { assessed: 'assessment.pillar3a', declared: ['pillar3a.paid'] },
  { assessed: 'assessment.replacement_income', declared: ['replacement.amount'] },
  { assessed: 'assessment.pension', declared: ['pension.amount'] },
  { assessed: 'assessment.health_premiums', declared: ['health.premiums'] },
  { assessed: 'assessment.medical_costs', declared: ['medical.costs'] },
  { assessed: 'assessment.childcare', declared: ['childcare.costs'] },
  { assessed: 'assessment.donations', declared: ['donation.amount'] },
  { assessed: 'assessment.debt_interest', declared: ['debt.interest'] },
];

/** Totals the assessment shows that Taxpresso doesn't compare with its engine's figures yet. */
export const ASSESSMENT_TOTALS_2026 = [
  'assessment.taxable_income',
  'assessment.taxable_wealth',
  'assessment.tax_amount',
] as const;

export interface AssessmentItem {
  key: string;
  assessed: number;
  /** Sum of the confirmed values (Confirmed by you, Verified, Estimate) for the declared keys. */
  declared?: number;
  /** assessed - declared, in centimes. */
  difference?: number;
  /** Values for these keys that still need the user's OK are left out of `declared`. */
  unconfirmed: number;
}

export interface AssessmentView {
  docId: string;
  taxes: AssessedTax[];
  notificationDate?: string;
  /** One per tax covered. Empty when the notification date is unknown: read the printed deadline. */
  deadlines: ObjectionDeadline[];
  items: AssessmentItem[];
  totals: { key: string; assessed: number }[];
  /** Assessed values that still need the user's OK. */
  unconfirmed: number;
}

const CONFIRMED = new Set(['stated', 'verified', 'estimate']);

/**
 * One view per assessment document. `facts` is the current ledger view, limited by the caller to
 * the documents that count (replaced ones left out).
 */
export function assessmentViews(
  documents: readonly VaultDocument[],
  facts: readonly Fact[],
): AssessmentView[] {
  return documents
    .filter((d) => d.kind === 'tax_assessment')
    .map((doc) => {
      const own = facts.filter((f) => f.instance === doc.id && f.key.startsWith('assessment.'));
      const get = (key: string) => own.find((f) => f.key === key);
      const tax = get('assessment.tax')?.value;
      const taxes: AssessedTax[] =
        tax === 'icc' ? ['icc'] : tax === 'ifd' ? ['ifd'] : ['icc', 'ifd'];
      const date = get('assessment.notification_date')?.value;
      const notificationDate = typeof date === 'string' ? date : undefined;
      const items: AssessmentItem[] = [];
      for (const item of ASSESSMENT_ITEMS_2026) {
        const assessed = get(item.assessed)?.value;
        if (typeof assessed !== 'number') continue;
        const declaredFacts = facts.filter(
          (f) => item.declared.includes(f.key) && typeof f.value === 'number',
        );
        const confirmed = declaredFacts.filter((f) => CONFIRMED.has(f.status));
        const declared = confirmed.length
          ? confirmed.reduce((sum, f) => sum + (f.value as number), 0)
          : undefined;
        items.push({
          key: item.assessed,
          assessed,
          ...(declared !== undefined ? { declared, difference: assessed - declared } : {}),
          unconfirmed: declaredFacts.length - confirmed.length,
        });
      }
      return {
        docId: doc.id,
        taxes,
        ...(notificationDate ? { notificationDate } : {}),
        deadlines: notificationDate ? taxes.map((t) => objectionDeadline(notificationDate, t)) : [],
        items,
        totals: ASSESSMENT_TOTALS_2026.flatMap((key) => {
          const v = get(key)?.value;
          return typeof v === 'number' ? [{ key, assessed: v }] : [];
        }),
        unconfirmed: own.filter((f) => f.status === 'extracted').length,
      };
    });
}

/** Plain words for the assessment card, EN and FR. `days` comes from OBJECTION_2026 (cited). */
export function assessmentText(days: number): Record<string, Text> {
  const nb = '\u00a0';
  return {
    noDate: {
      en: 'Taxpresso doesn’t know the date of your assessment yet, so it shows no deadline. Read the deadline to object printed on your assessment.',
      fr: 'Taxpresso ne connaît pas encore la date de votre taxation et n’affiche donc aucun délai. Lisez le délai de réclamation imprimé sur votre avis de taxation.',
    },
    counting: {
      en: `Counted from the date of your assessment: ${days} days, starting the next day; a last day on a Saturday or Sunday moves to the Monday. A public holiday, or getting the letter after that date, can only move the real deadline later, never earlier. The deadline printed on your assessment always wins.`,
      fr: `Compté depuis la date de votre taxation${nb}: ${days} jours, à partir du lendemain${nb}; un dernier jour tombant un samedi ou un dimanche passe au lundi. Un jour férié, ou un courrier reçu après cette date, ne peut que repousser le vrai délai, jamais l’avancer. Le délai imprimé sur votre avis de taxation fait foi.`,
    },
    notAMistake: {
      en: 'A difference is not always a mistake: the tax office applies the limits the law sets for some deductions. Read the explanation on your assessment first.',
      fr: `Une différence n’est pas forcément une erreur${nb}: l’administration applique les plafonds que la loi fixe pour certaines déductions. Lisez d’abord les explications de votre avis de taxation.`,
    },
    never: {
      en: 'If you disagree, you send the objection (réclamation) yourself, in writing, before the deadline. Taxpresso never sends it for you.',
      fr: 'Si vous n’êtes pas d’accord, vous envoyez vous-même la réclamation, par écrit, avant la fin du délai. Taxpresso ne l’envoie jamais à votre place.',
    },
  };
}
