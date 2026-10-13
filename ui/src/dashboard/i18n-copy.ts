// UI strings for the copy panel (SPEC.md 10.5). Second person, plain words, the official French
// label always next to its gloss. Status labels follow SPEC.md section 11b.
import type { Language } from './i18n';

const NB = String.fromCharCode(0xa0);

const messages = {
  en: {
    title: 'Fill in your declaration',
    lead: 'Type each value into the official declaration (e-démarches or GeTax), page by page in the form’s order. Amounts are whole francs, without centimes or separators, as the form asks. Tick each value once it is in.',
    progress: '{n} of {total} entered',
    pending: '{n} not final yet',
    couple:
      'On the form, contribuable A is the person printed on the left, B the other one. Here A is {a} and B is {b}: if your form has them the other way round, swap the A and B values.',
    waiting: 'Not on the form yet, say what it is: {list}',
    copy: 'Copy',
    copied: 'Copied',
    copyFailed: 'Copy this: {value}',
    copyLabel: 'Copy {label}',
    entered: 'Entered',
    tick: 'Tick this box',
    rounded: 'From {amount}, rounded to the franc',
    confirmFirst: 'Check it first, in “What Claude read in your documents”.',
    estimateFirst: 'An estimate: settle it before you type it.',
    formWorksOut: 'The form works this out: check it shows this.',
    from: 'Read from {files}',
    statusNeedsOk: 'Needs your OK',
    statusConfirmed: 'Confirmed by you',
    statusVerified: 'Verified',
    statusEstimate: 'Estimate',
    statusComputed: 'Computed',
    pageLabel: 'Page {page} of the form',
    column: 'Column {list}',
    columns: 'Columns {list}',
    split: 'For the whole household: on the form, split it into {parts}, as on your document.',
  },
  fr: {
    title: 'Remplir votre déclaration',
    lead: 'Recopiez chaque valeur dans la déclaration officielle (e-démarches ou GeTax), page par page dans l’ordre du formulaire. Les montants sont en francs entiers, sans centimes ni séparateurs, comme le demande le formulaire. Cochez chaque valeur une fois saisie.',
    progress: '{n} sur {total} saisies',
    pending: '{n} pas encore définitive(s)',
    couple: `Sur le formulaire, le contribuable A est la personne imprimée à gauche, B l’autre. Ici, A est {a} et B est {b}${NB}: si votre formulaire les inverse, inversez les valeurs A et B.`,
    waiting: `Pas encore sur le formulaire, dites ce que c’est${NB}: {list}`,
    copy: 'Copier',
    copied: 'Copié',
    copyFailed: `Copiez ceci${NB}: {value}`,
    copyLabel: 'Copier {label}',
    entered: 'Saisi',
    tick: 'Cochez cette case',
    rounded: 'De {amount}, arrondi au franc',
    confirmFirst: `Vérifiez-la d’abord, dans «${NB}Ce que Claude a lu dans vos documents${NB}».`,
    estimateFirst: `Une estimation${NB}: réglez-la avant de la saisir.`,
    formWorksOut: `Le formulaire le calcule${NB}: vérifiez qu’il affiche ce montant.`,
    from: 'Lu dans {files}',
    statusNeedsOk: 'À confirmer',
    statusConfirmed: 'Confirmé par vous',
    statusVerified: 'Vérifié',
    statusEstimate: 'Estimation',
    statusComputed: 'Calculé',
    pageLabel: 'Page {page} du formulaire',
    column: 'Colonne {list}',
    columns: 'Colonnes {list}',
    split: `Pour tout le ménage${NB}: sur le formulaire, répartissez-le entre {parts}, comme sur votre document.`,
  },
} as const;

export type CopyMessageKey = keyof (typeof messages)['en'];

export function tc(
  lang: Language,
  key: CopyMessageKey,
  vars: Record<string, string | number> = {},
): string {
  return messages[lang][key].replace(/\{(\w+)\}/g, (_, name: string) => String(vars[name] ?? ''));
}
