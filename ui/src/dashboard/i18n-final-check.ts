// UI strings for "Final check" (SPEC.md 10.0). Second person, plain words, official French terms
// next to their gloss. Status labels follow SPEC.md section 11b. The items' own texts come worded
// from the extension (extension/src/final-check.ts), in the page's language.
import type { Language } from './i18n';

const NB = String.fromCharCode(0xa0);

const messages = {
  en: {
    title: 'Final check',
    lead: 'Before you fill in the official form, Taxpresso runs your figures through its rules again and lists what to settle first. Each rule links to the official document it comes from.',
    summary: '{fix} to fix · {know} good to know',
    ready: 'Ready to fill in',
    readyLead:
      'Nothing to fix. Read what is good to know below, then fill in the official form with the values to type.',
    notReady: 'Fix before filing',
    notReadyLead: 'Settle these first, in this order. Claude can go through them with you.',
    know: 'Good to know',
    knowLead: 'Nothing here stops you. Amounts at or near a limit, and how Taxpresso counted.',
    more: 'What Taxpresso assumed or left out ({n})',
    toSettle: 'To settle',
    source: 'Source',
    sources: 'Sources',
    moreTime: 'A document won’t arrive in time? Ask the tax office (AFC) for more time to file',
    moreTimeAfter: 'instead of filing a guess.',
    near: '“Near” a limit means within {share} of it, and at least CHF {min}. A cap that cut an amount is always shown.',
    needs_ok: 'Needs your OK',
    estimate: 'Estimate',
    missing: 'Missing',
    fix: 'Fix',
    atLimit: 'At the limit',
    nearLimit: 'Near the limit',
    justBelow: 'Just under',
    justAbove: 'Just over',
    colon: ': ',
  },
  fr: {
    title: 'Vérification finale',
    lead: 'Avant que vous remplissiez le formulaire officiel, Taxpresso repasse vos montants dans ses règles et liste ce qu’il faut régler d’abord. Chaque règle renvoie au document officiel dont elle vient.',
    summary: '{fix} à corriger · {know} bon à savoir',
    ready: 'Prêt à remplir',
    readyLead:
      'Rien à corriger. Lisez ce qui est bon à savoir ci-dessous, puis remplissez le formulaire officiel avec les valeurs à saisir.',
    notReady: 'À corriger avant de déclarer',
    notReadyLead:
      'Réglez d’abord ces points, dans cet ordre. Claude peut les passer en revue avec vous.',
    know: 'Bon à savoir',
    knowLead: `Rien ici ne vous bloque. Les montants à la limite ou proches, et comment Taxpresso a compté.`,
    more: 'Ce que Taxpresso a supposé ou laissé de côté ({n})',
    toSettle: 'Pour régler',
    source: 'Source',
    sources: 'Sources',
    moreTime: `Un document n’arrivera pas à temps${NB}? Demandez un délai à l’administration fiscale (AFC)`,
    moreTimeAfter: 'plutôt que de déclarer une estimation.',
    near: `«${NB}Proche${NB}» d’une limite veut dire à {share} près, et au moins CHF {min}. Un plafond qui a réduit un montant est toujours affiché.`,
    needs_ok: 'À confirmer',
    estimate: 'Estimation',
    missing: 'Manquant',
    fix: 'À corriger',
    atLimit: 'À la limite',
    nearLimit: 'Proche de la limite',
    justBelow: 'Juste en dessous',
    justAbove: 'Juste au-dessus',
    colon: `${NB}: `,
  },
} as const;

export type FinalCheckMessageKey = keyof (typeof messages)['en'];

export function tf(
  lang: Language,
  key: FinalCheckMessageKey,
  vars: Record<string, string | number> = {},
): string {
  return messages[lang][key].replace(/\{(\w+)\}/g, (_, name: string) => String(vars[name] ?? ''));
}
