// UI strings for the document cards, the "Check this" list and the assessment card (SPEC.md 5.5,
// 5.8, 10.5 second view, 10.8). Second person, plain words, official French terms next to their
// gloss. Status labels follow SPEC.md section 11b.
import type { Language } from './i18n';

const NB = String.fromCharCode(0xa0);

const messages = {
  en: {
    cardsTitle: 'What Claude read in your documents',
    cardsLead:
      'Check each value against your document. Tap OK when it is right, or correct it. Then, when you fill in your declaration, copy each value and tick it as entered.',
    confirmAll: 'All OK',
    toConfirm: '{n} to check',
    allConfirmed: 'All checked',
    enteredCount: '{n} of {total} entered',
    entered: 'Entered',
    ok: 'OK',
    edit: 'Correct',
    save: 'Save',
    cancel: 'Cancel',
    copy: 'Copy',
    copied: 'Copied',
    copyFailed: 'Copy this: {value}',
    copyLabel: 'Copy {label}',
    box: 'box {box}',
    page: 'page {page}',
    statusNeedsOk: 'Needs your OK',
    statusConfirmed: 'Confirmed by you',
    statusConfirmedChat: 'Confirmed by you, in the chat',
    statusVerified: 'Verified',
    statusEstimate: 'Estimate',
    kindByClaude: 'Read by Claude: is this right?',
    period: '{from} to {to}',
    yearShort: 'Year {year}',
    nothingRead: 'Claude read this document and found no values to keep.',
    replaceFile: 'Replace with another file',
    replacedTitle: 'Replaced documents',
    replacedBy: 'replaced, no longer counts',
    yes: 'Yes',
    no: 'No',
    editHint: 'As on the document, e.g. 85’000.00',
    editProblem: 'Taxpresso can’t read this. Write it as on the document, for example 85’000.00.',
    editFailed: 'Taxpresso is not answering. Ask Claude to open the dashboard again.',
    checksTitle: 'Check this',
    checksNone: 'Nothing to check across your documents.',
    checksSettled: 'Settled',
    addNote: 'It’s fine: add a note',
    notePlaceholder: 'Why it is fine, in a few words',
    saveNote: 'Save note',
    reopen: 'Open again',
    countOnce: 'It’s a copy: count it once',
    replaceDoc: 'Replace {name}',
    source: 'Source',
    assessmentTitle: 'Your assessment',
    assessmentLead:
      'What the tax office assessed (avis de taxation), next to what you declared. Taxpresso only compares; you decide.',
    objectBy: 'To object (réclamation): send it by {date} at the latest',
    objectFor: '{tax}',
    deadlineLaw: 'Set by {law}',
    assessed: 'Assessed',
    declared: 'Declared',
    difference: 'Difference',
    same: 'Same',
    different: 'Different: {amount}',
    colon: ': ',
    notDeclared: 'Nothing declared to compare',
    item: 'Item',
    totalsTitle: 'Totals on your assessment',
    totalsNote: 'Taxpresso doesn’t compare these with its own calculation yet.',
    unconfirmed:
      '{n} values read from your assessment still need your OK, in the card “What Claude read in your documents”.',
    declaredUnconfirmed: '{n} declared value(s) still need your OK: not counted.',
    notifiedOn: 'Assessment dated {date}',
  },
  fr: {
    cardsTitle: 'Ce que Claude a lu dans vos documents',
    cardsLead: `Vérifiez chaque valeur sur votre document. Touchez OK si elle est juste, ou corrigez-la. Ensuite, en remplissant votre déclaration, copiez chaque valeur et cochez-la comme saisie.`,
    confirmAll: 'Tout est juste',
    toConfirm: '{n} à vérifier',
    allConfirmed: 'Tout vérifié',
    enteredCount: '{n} sur {total} saisies',
    entered: 'Saisi',
    ok: 'OK',
    edit: 'Corriger',
    save: 'Enregistrer',
    cancel: 'Annuler',
    copy: 'Copier',
    copied: 'Copié',
    copyFailed: `Copiez ceci${NB}: {value}`,
    copyLabel: 'Copier {label}',
    box: 'chiffre {box}',
    page: 'page {page}',
    statusNeedsOk: 'À confirmer',
    statusConfirmed: 'Confirmé par vous',
    statusConfirmedChat: 'Confirmé par vous, dans la conversation',
    statusVerified: 'Vérifié',
    statusEstimate: 'Estimation',
    kindByClaude: `Lu par Claude${NB}: est-ce juste${NB}?`,
    period: 'du {from} au {to}',
    yearShort: 'Année {year}',
    nothingRead: 'Claude a lu ce document et n’y a trouvé aucune valeur à garder.',
    replaceFile: 'Remplacer par un autre fichier',
    replacedTitle: 'Documents remplacés',
    replacedBy: 'remplacé, ne compte plus',
    yes: 'Oui',
    no: 'Non',
    editHint: `Comme sur le document, p. ex. 85’000.00`,
    editProblem:
      'Taxpresso ne peut pas lire cette valeur. Écrivez-la comme sur le document, par exemple 85’000.00.',
    editFailed: 'Taxpresso ne répond plus. Demandez à Claude de rouvrir le tableau de bord.',
    checksTitle: 'À vérifier',
    checksNone: 'Rien à vérifier entre vos documents.',
    checksSettled: 'Réglé',
    addNote: `C’est correct${NB}: ajouter une remarque`,
    notePlaceholder: 'Pourquoi c’est correct, en quelques mots',
    saveNote: 'Enregistrer la remarque',
    reopen: 'Rouvrir',
    countOnce: `C’est une copie${NB}: le compter une fois`,
    replaceDoc: 'Remplacer {name}',
    source: 'Source',
    assessmentTitle: 'Votre taxation',
    assessmentLead:
      'Ce que l’administration fiscale a retenu (avis de taxation), à côté de ce que vous avez déclaré. Taxpresso ne fait que comparer, c’est vous qui décidez.',
    objectBy: `Pour contester (réclamation)${NB}: envoyez-la au plus tard le {date}`,
    objectFor: '{tax}',
    deadlineLaw: 'Fixé par la {law}',
    assessed: 'Retenu',
    declared: 'Déclaré',
    difference: 'Différence',
    same: 'Identique',
    different: `Différent${NB}: {amount}`,
    colon: `${NB}: `,
    notDeclared: 'Rien de déclaré à comparer',
    item: 'Élément',
    totalsTitle: 'Totaux de votre taxation',
    totalsNote: 'Taxpresso ne les compare pas encore avec son propre calcul.',
    unconfirmed: `{n} valeurs lues dans votre avis de taxation sont encore à confirmer, dans la carte «${NB}Ce que Claude a lu dans vos documents${NB}».`,
    declaredUnconfirmed: '{n} valeur(s) déclarée(s) encore à confirmer, non comptée(s).',
    notifiedOn: 'Taxation datée du {date}',
  },
} as const;

export type DocMessageKey = keyof (typeof messages)['en'];

export function td(
  lang: Language,
  key: DocMessageKey,
  vars: Record<string, string | number> = {},
): string {
  return messages[lang][key].replace(/\{(\w+)\}/g, (_, name: string) => String(vars[name] ?? ''));
}

/** The official French term, unless it says exactly what the label already says. */
export function showOfficial(label: string, official: string | undefined): official is string {
  return !!official && official.toLowerCase() !== label.toLowerCase();
}

/** CHF from integer centimes, formatted for the page language without ever dividing money. */
export function formatChf(centimes: number, lang: Language): string {
  const locale = `${lang}-CH`;
  const abs = Math.abs(centimes);
  const francs = (abs - (abs % 100)) / 100;
  const parts = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'CHF',
    maximumFractionDigits: 0,
  }).formatToParts(francs);
  const decimal =
    new Intl.NumberFormat(locale).formatToParts(1.5).find((p) => p.type === 'decimal')?.value ??
    '.';
  const last = parts.map((p) => p.type).lastIndexOf('integer');
  const body = parts
    .map((p, i) =>
      i === last ? `${p.value}${decimal}${String(abs % 100).padStart(2, '0')}` : p.value,
    )
    .join('');
  return centimes < 0 ? `−${body}` : body;
}
