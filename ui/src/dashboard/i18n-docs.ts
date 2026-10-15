// UI strings for the document cards, the "Check this" list and the assessment card (SPEC.md 5.5,
// 5.8, 10.5 second view, 10.8). Second person, plain words, official French terms next to their
// gloss. Status labels follow SPEC.md section 11b.
import type { Language } from './i18n';

const NB = String.fromCharCode(0xa0);

export const messages = {
  en: {
    save: 'Save',
    cancel: 'Cancel',
    statusNeedsOk: 'Needs your OK',
    statusConfirmed: 'Confirmed by you',
    statusConfirmedChat: 'Confirmed by you, in the chat',
    statusEstimate: 'Estimate',
    editHint: 'As on the document, e.g. 85’000.00',
    editProblem: 'Taxpresso can’t read this. Write it as on the document, for example 85’000.00.',
    editFailed: 'Taxpresso is not answering. Ask Claude to open the dashboard again.',
    addNote: 'It’s fine: add a note',
    notePlaceholder: 'Why it is fine, in a few words',
    saveNote: 'Save note',
    countOnce: 'It’s a copy: count it once',
    replaceDoc: 'Replace {name}',
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
    save: 'Enregistrer',
    cancel: 'Annuler',
    statusNeedsOk: 'À confirmer',
    statusConfirmed: 'Confirmé par vous',
    statusConfirmedChat: 'Confirmé par vous, dans la conversation',
    statusEstimate: 'Estimation',
    editHint: `Comme sur le document, p. ex. 85’000.00`,
    editProblem:
      'Taxpresso ne peut pas lire cette valeur. Écrivez-la comme sur le document, par exemple 85’000.00.',
    editFailed: 'Taxpresso ne répond plus. Demandez à Claude de rouvrir le tableau de bord.',
    addNote: `C’est correct${NB}: ajouter une remarque`,
    notePlaceholder: 'Pourquoi c’est correct, en quelques mots',
    saveNote: 'Enregistrer la remarque',
    countOnce: `C’est une copie${NB}: le compter une fois`,
    replaceDoc: 'Remplacer {name}',
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
  de: {
    save: 'Speichern',
    cancel: 'Abbrechen',
    statusNeedsOk: 'Braucht dein OK',
    statusConfirmed: 'Von dir bestätigt',
    statusConfirmedChat: 'Von dir bestätigt, im Chat',
    statusEstimate: 'Schätzung',
    editHint: 'Wie auf dem Dokument, z. B. 85’000.00',
    editProblem:
      'Taxpresso kann das nicht lesen. Schreib es wie auf dem Dokument, zum Beispiel 85’000.00.',
    editFailed: 'Taxpresso antwortet nicht. Bitte Claude, das Dashboard wieder zu öffnen.',
    addNote: 'Es passt: Notiz hinzufügen',
    notePlaceholder: 'Warum es passt, in wenigen Worten',
    saveNote: 'Notiz speichern',
    countOnce: 'Es ist eine Kopie: einmal zählen',
    replaceDoc: '{name} ersetzen',
    assessmentTitle: 'Deine Veranlagung',
    assessmentLead:
      'Was das Steueramt veranlagt hat (avis de taxation), neben dem, was du deklariert hast. Taxpresso vergleicht nur; du entscheidest.',
    objectBy: 'Für eine Einsprache (réclamation): spätestens am {date} einreichen',
    objectFor: '{tax}',
    deadlineLaw: 'Festgelegt durch {law}',
    assessed: 'Veranlagt',
    declared: 'Deklariert',
    difference: 'Differenz',
    same: 'Gleich',
    different: 'Anders: {amount}',
    colon: ': ',
    notDeclared: 'Nichts deklariert zum Vergleichen',
    item: 'Posten',
    totalsTitle: 'Totale auf deiner Veranlagung',
    totalsNote: 'Taxpresso vergleicht diese noch nicht mit seiner eigenen Berechnung.',
    unconfirmed:
      '{n} Werte aus deiner Veranlagung brauchen noch dein OK, in der Karte «Was Claude in deinen Dokumenten gelesen hat».',
    declaredUnconfirmed: '{n} deklarierte Werte brauchen noch dein OK: nicht gezählt.',
    notifiedOn: 'Veranlagung vom {date}',
  },
  it: {
    save: 'Salva',
    cancel: 'Annulla',
    statusNeedsOk: 'Da confermare',
    statusConfirmed: 'Confermato da te',
    statusConfirmedChat: 'Confermato da te, nella conversazione',
    statusEstimate: 'Stima',
    editHint: 'Come sul documento, p. es. 85’000.00',
    editProblem:
      'Taxpresso non riesce a leggerlo. Scrivilo come sul documento, per esempio 85’000.00.',
    editFailed: 'Taxpresso non risponde. Chiedi a Claude di riaprire la dashboard.',
    addNote: 'Va bene così: aggiungi una nota',
    notePlaceholder: 'Perché va bene, in poche parole',
    saveNote: 'Salva la nota',
    countOnce: 'È un doppione: contalo una volta sola',
    replaceDoc: 'Sostituisci {name}',
    assessmentTitle: 'La tua decisione di tassazione',
    assessmentLead:
      'Cosa ha stabilito l’amministrazione fiscale (avis de taxation), accanto a quello che hai dichiarato. Taxpresso si limita a confrontare: decidi tu.',
    objectBy: 'Per fare reclamo (réclamation): invialo entro il {date}',
    objectFor: '{tax}',
    deadlineLaw: 'Stabilito dalla {law}',
    assessed: 'Tassato',
    declared: 'Dichiarato',
    difference: 'Differenza',
    same: 'Uguale',
    different: 'Diverso: {amount}',
    colon: ': ',
    notDeclared: 'Niente di dichiarato da confrontare',
    item: 'Voce',
    totalsTitle: 'Totali sulla tua decisione di tassazione',
    totalsNote: 'Taxpresso non li confronta ancora con il proprio calcolo.',
    unconfirmed:
      '{n} valori letti dalla tua decisione di tassazione sono ancora da confermare, nella scheda “Cosa ha letto Claude nei tuoi documenti”.',
    declaredUnconfirmed: 'Valori dichiarati ancora da confermare: {n}, non contati.',
    notifiedOn: 'Decisione di tassazione del {date}',
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
