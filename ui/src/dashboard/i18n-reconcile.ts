// UI strings for "Check before you transmit" (SPEC.md 10.4).
// Second person, plain words, official French terms next to their gloss. Status labels follow
// SPEC.md section 11b: a difference is "Fix".
import { cantonKey, type Language } from './i18n';

const NB = String.fromCharCode(0xa0);

const messages = {
  en: {
    title: 'Check before you transmit',
    notAvailable:
      'Taxpresso checks the PDF of Geneva declarations only, for now. Compare what you typed in your canton’s software with the values to type above. You transmit your declaration yourself.',
    notAvailableZh:
      'Taxpresso checks the PDF of Geneva declarations only, for now. For your Zurich return, compare what you typed in ZHprivateTax with the values to type above. You transmit your declaration yourself.',
    notAvailableBe:
      'Taxpresso checks the PDF of Geneva declarations only, for now. For your Bern return, compare what you typed in TaxMe-Online with the values to type above, and TaxMe’s summaries (Zusammenzug) with the last two sections. You transmit your declaration yourself.',
    notAvailableBl:
      'Taxpresso checks the PDF of Geneva declarations only, for now. For your Basel-Landschaft return, compare what you typed in E-Tax BL with the values to type above. You transmit your declaration yourself.',
    notAvailableBs:
      'Taxpresso checks the PDF of Geneva declarations only, for now. For your Basel-Stadt return, compare what you typed in BalTax Online with the values to type above. You transmit your declaration yourself.',
    notAvailableZg:
      'Taxpresso checks the PDF of Geneva declarations only, for now. For your Zug return, compare what you typed in eTax.zug with the values to type above. You transmit your declaration yourself.',
    notAvailableLu:
      'Taxpresso checks the PDF of Geneva declarations only, for now. For your Lucerne return, compare what you typed in eSteuern.LU with the values to type above. You transmit your declaration yourself.',
    notAvailableSg:
      'Taxpresso checks the PDF of Geneva declarations only, for now. For your St. Gallen return, compare what you typed in E-Tax SG with the values to type above. You transmit your declaration yourself.',
    lead: 'When you have typed everything, download the PDF of your declaration from GeTax or the online declaration (e-démarches) and add it here. Taxpresso reads it on this computer and compares each amount with what you had to type, in whole francs. It keeps no name or number from it.',
    add: 'Add the PDF of your declaration',
    addAgain: 'Add the new PDF',
    reading: 'Reading {name}…',
    pending: 'Taxpresso is reading your PDF.',
    checkedAgainst: 'Checked against “{file}”',
    printedBy: 'printed by {software}',
    olderOne: 'Only the latest PDF counts (1 earlier).',
    older: 'Only the latest PDF counts ({n} earlier).',
    summary: '{n} compared · {match} match · {fix} to fix',
    unreadable:
      'Taxpresso can’t read “{file}” as a Geneva declaration. It needs the PDF printed by GeTax or the online declaration, with its text, not a scan or a photo. Download it again from there and add it.',
    otherYear:
      '“{file}” is your {printed} declaration, not the {year} one. Add the PDF of your {year} declaration.',
    clear:
      'Everything Taxpresso compared matches. You can transmit your declaration yourself, in GeTax or the online declaration.',
    toFixLead:
      'Fix these in GeTax or the online declaration, then download the PDF again and add it here: Taxpresso checks it again.',
    notFinalOne:
      '1 compared value is not final in Taxpresso yet (Needs your OK or Estimate). Settle it first, above.',
    notFinal:
      '{n} compared values are not final in Taxpresso yet (Needs your OK or Estimate). Settle them first, above.',
    fix: 'Fix',
    differs: 'Different amount',
    pdfOnly: 'Only in your PDF',
    taxpressoOnly: 'Missing from your PDF',
    matches: 'Matches',
    inPdf: 'In your PDF',
    toType: 'To type',
    nothing: 'nothing',
    unknownCode: 'Taxpresso doesn’t fill this line: check it against your documents.',
    pdfPage: 'page {page} of the PDF',
    showMatches: 'Show the {n} matching values',
    computedTitle: 'Lines the form works out ({n})',
    computedLead:
      'Totals, carried totals and amounts worked out by a rule. Taxpresso checks that totals add up; they never count as differences.',
    addsUp: 'Adds up',
    sameAs: 'Same as on {page}',
    off: 'Doesn’t add up: the lines above give {amount}',
    offFrom: 'Not the same as on {page}: {amount}',
    shown: 'Worked out by the form',
    computed: 'Computed',
    byEyeTitle: 'Check these yourself',
    byEyeTick: 'A box to tick',
    byEyeText: 'Text: {value}',
    byEyeTextNoValue: 'Text',
    byEyeColumns: 'Taxpresso can’t tell the amounts apart on this line',
    notCompared:
      'Names, addresses and the securities list (état des titres, annexe F) are not compared: check them yourself.',
    warnings: 'Read with warnings: {list}',
    transmitTitle: 'Your turn: transmit',
    transmit1: 'Fix any difference in GeTax or the online declaration.',
    transmit2: 'Download the PDF again and add it here, until everything matches.',
    transmit3:
      'Press Transmettre (transmit) yourself. Neither Taxpresso nor Claude ever transmits your declaration.',
    statusNeedsOk: 'Needs your OK',
    statusEstimate: 'Estimate',
    colon: ': ',
    notAvailableVd:
      'Taxpresso checks the PDF of Geneva declarations only, for now. For your Vaud return, compare what you typed in VaudTax with the values to type above. You transmit your declaration yourself.',
  },
  fr: {
    title: 'Vérifier avant de transmettre',
    notAvailable:
      'Pour l’instant, Taxpresso ne vérifie que le PDF des déclarations genevoises. Comparez vous-même ce que vous avez saisi dans le logiciel de votre canton avec les valeurs à saisir ci-dessus. Vous transmettez votre déclaration vous-même.',
    notAvailableZh: `Pour l’instant, Taxpresso ne vérifie que le PDF des déclarations genevoises. Pour votre déclaration zurichoise, comparez vous-même ce que vous avez saisi dans ZHprivateTax avec les valeurs à saisir ci-dessus. Vous transmettez votre déclaration vous-même.`,
    notAvailableBe: `Pour l’instant, Taxpresso ne vérifie que le PDF des déclarations genevoises. Pour votre déclaration bernoise, comparez vous-même ce que vous avez saisi dans TaxMe-Online avec les valeurs à saisir ci-dessus, et les récapitulatifs de TaxMe (Zusammenzug) avec les deux dernières sections. Vous transmettez votre déclaration vous-même.`,
    notAvailableBl: `Pour l’instant, Taxpresso ne vérifie que le PDF des déclarations genevoises. Pour votre déclaration de Bâle-Campagne, comparez vous-même ce que vous avez saisi dans E-Tax BL avec les valeurs à saisir ci-dessus. Vous transmettez votre déclaration vous-même.`,
    notAvailableBs: `Pour l’instant, Taxpresso ne vérifie que le PDF des déclarations genevoises. Pour votre déclaration bâloise, comparez vous-même ce que vous avez saisi dans BalTax Online avec les valeurs à saisir ci-dessus. Vous transmettez votre déclaration vous-même.`,
    notAvailableZg: `Pour l’instant, Taxpresso ne vérifie que le PDF des déclarations genevoises. Pour votre déclaration zougoise, comparez vous-même ce que vous avez saisi dans eTax.zug avec les valeurs à saisir ci-dessus. Vous transmettez votre déclaration vous-même.`,
    notAvailableLu: `Pour l’instant, Taxpresso ne vérifie que le PDF des déclarations genevoises. Pour votre déclaration lucernoise, comparez vous-même ce que vous avez saisi dans eSteuern.LU avec les valeurs à saisir ci-dessus. Vous transmettez votre déclaration vous-même.`,
    notAvailableSg: `Pour l’instant, Taxpresso ne vérifie que le PDF des déclarations genevoises. Pour votre déclaration saint-galloise, comparez vous-même ce que vous avez saisi dans E-Tax SG avec les valeurs à saisir ci-dessus. Vous transmettez votre déclaration vous-même.`,
    lead: 'Quand vous avez tout saisi, téléchargez le PDF de votre déclaration depuis GeTax ou la déclaration en ligne (e-démarches) et ajoutez-le ici. Taxpresso le lit sur cet ordinateur et compare chaque montant avec ce que vous deviez saisir, en francs entiers. Il n’en garde aucun nom ni numéro.',
    add: 'Ajouter le PDF de votre déclaration',
    addAgain: 'Ajouter le nouveau PDF',
    reading: 'Lecture de {name}…',
    pending: 'Taxpresso lit votre PDF.',
    checkedAgainst: `Comparé avec «${NB}{file}${NB}»`,
    printedBy: 'imprimé par {software}',
    olderOne: 'Seul le dernier PDF compte (1 plus ancien).',
    older: 'Seul le dernier PDF compte ({n} plus anciens).',
    summary: '{n} comparées · {match} identiques · {fix} à corriger',
    unreadable: `Taxpresso ne peut pas lire «${NB}{file}${NB}» comme une déclaration genevoise. Il faut le PDF imprimé par GeTax ou la déclaration en ligne, avec son texte, pas un scan ni une photo. Téléchargez-le à nouveau depuis là et ajoutez-le.`,
    otherYear: `«${NB}{file}${NB}» est votre déclaration {printed}, pas celle de {year}. Ajoutez le PDF de votre déclaration {year}.`,
    clear:
      'Tout ce que Taxpresso a comparé est identique. Vous pouvez transmettre votre déclaration vous-même, dans GeTax ou la déclaration en ligne.',
    toFixLead: `Corrigez ces valeurs dans GeTax ou la déclaration en ligne, puis téléchargez à nouveau le PDF et ajoutez-le ici${NB}: Taxpresso le vérifie à nouveau.`,
    notFinalOne:
      '1 valeur comparée n’est pas encore définitive dans Taxpresso (À confirmer ou Estimation). Réglez-la d’abord, plus haut.',
    notFinal:
      '{n} valeurs comparées ne sont pas encore définitives dans Taxpresso (À confirmer ou Estimation). Réglez-les d’abord, plus haut.',
    fix: 'À corriger',
    differs: 'Montant différent',
    pdfOnly: 'Seulement dans votre PDF',
    taxpressoOnly: 'Absent de votre PDF',
    matches: 'Identique',
    inPdf: 'Dans votre PDF',
    toType: 'À saisir',
    nothing: 'rien',
    unknownCode: `Taxpresso ne remplit pas cette ligne${NB}: vérifiez-la sur vos documents.`,
    pdfPage: 'page {page} du PDF',
    showMatches: 'Voir les {n} valeurs identiques',
    computedTitle: 'Lignes calculées par le formulaire ({n})',
    computedLead:
      'Totaux, reports et montants calculés selon une règle. Taxpresso vérifie que les totaux sont justes, sans jamais les compter comme des différences.',
    addsUp: 'Total juste',
    sameAs: 'Identique à {page}',
    off: `Ne correspond pas${NB}: les lignes au-dessus donnent {amount}`,
    offFrom: `Différent de {page}${NB}: {amount}`,
    shown: 'Calculé par le formulaire',
    computed: 'Calculé',
    byEyeTitle: 'À vérifier vous-même',
    byEyeTick: 'Une case à cocher',
    byEyeText: `Texte${NB}: {value}`,
    byEyeTextNoValue: 'Texte',
    byEyeColumns: 'Taxpresso ne distingue pas les montants de cette ligne',
    notCompared: `Les noms, les adresses et l’état des titres (annexe F) ne sont pas comparés${NB}: vérifiez-les vous-même.`,
    warnings: `Lu avec des remarques${NB}: {list}`,
    transmitTitle: `À vous${NB}: transmettre`,
    transmit1: 'Corrigez chaque différence dans GeTax ou la déclaration en ligne.',
    transmit2:
      'Téléchargez à nouveau le PDF et ajoutez-le ici, jusqu’à ce que tout soit identique.',
    transmit3:
      'Appuyez vous-même sur Transmettre. Ni Taxpresso ni Claude ne transmettent jamais votre déclaration.',
    statusNeedsOk: 'À confirmer',
    statusEstimate: 'Estimation',
    colon: `${NB}: `,
    notAvailableVd: `Pour l’instant, Taxpresso ne vérifie que le PDF des déclarations genevoises. Pour votre déclaration vaudoise, comparez vous-même ce que vous avez saisi dans VaudTax avec les valeurs à saisir ci-dessus. Vous transmettez votre déclaration vous-même.`,
  },
  de: {
    title: 'Vor dem Übermitteln prüfen',
    notAvailable:
      'Taxpresso prüft vorerst nur das PDF von Genfer Steuererklärungen. Vergleiche selbst, was du in der Software deines Kantons eingetragen hast, mit den Werten zum Eintragen oben. Du übermittelst deine Steuererklärung selbst.',
    notAvailableZh:
      'Taxpresso prüft vorerst nur das PDF von Genfer Steuererklärungen. Für deine Zürcher Steuererklärung vergleiche selbst, was du in ZHprivateTax eingetragen hast, mit den Werten zum Eintragen oben. Du übermittelst deine Steuererklärung selbst.',
    notAvailableBe:
      'Taxpresso prüft vorerst nur das PDF von Genfer Steuererklärungen. Für deine Berner Steuererklärung vergleiche selbst, was du in TaxMe-Online eingetragen hast, mit den Werten zum Eintragen oben, und die Zusammenzüge von TaxMe mit den letzten beiden Abschnitten. Du übermittelst deine Steuererklärung selbst.',
    notAvailableBl:
      'Taxpresso prüft vorerst nur das PDF von Genfer Steuererklärungen. Für deine Steuererklärung von Basel-Landschaft vergleiche selbst, was du in E-Tax BL eingetragen hast, mit den Werten zum Eintragen oben. Du übermittelst deine Steuererklärung selbst.',
    notAvailableBs:
      'Taxpresso prüft vorerst nur das PDF von Genfer Steuererklärungen. Für deine Basler Steuererklärung vergleiche selbst, was du in BalTax Online eingetragen hast, mit den Werten zum Eintragen oben. Du übermittelst deine Steuererklärung selbst.',
    notAvailableZg:
      'Taxpresso prüft vorerst nur das PDF von Genfer Steuererklärungen. Für deine Zuger Steuererklärung vergleiche selbst, was du in eTax.zug eingetragen hast, mit den Werten zum Eintragen oben. Du übermittelst deine Steuererklärung selbst.',
    notAvailableLu:
      'Taxpresso prüft vorerst nur das PDF von Genfer Steuererklärungen. Für deine Luzerner Steuererklärung vergleiche selbst, was du in eSteuern.LU eingetragen hast, mit den Werten zum Eintragen oben. Du übermittelst deine Steuererklärung selbst.',
    notAvailableSg:
      'Taxpresso prüft vorerst nur das PDF von Genfer Steuererklärungen. Für deine St. Galler Steuererklärung vergleiche selbst, was du in E-Tax SG eingetragen hast, mit den Werten zum Eintragen oben. Du übermittelst deine Steuererklärung selbst.',
    lead: 'Wenn du alles eingetragen hast, lade das PDF deiner Steuererklärung aus GeTax oder der Online-Steuererklärung (e-démarches) herunter und füge es hier hinzu. Taxpresso liest es auf diesem Computer und vergleicht jeden Betrag mit dem, was du eintragen solltest, in ganzen Franken. Es behält keinen Namen und keine Nummer daraus.',
    add: 'PDF deiner Steuererklärung hinzufügen',
    addAgain: 'Das neue PDF hinzufügen',
    reading: '{name} wird gelesen…',
    pending: 'Taxpresso liest dein PDF.',
    checkedAgainst: 'Geprüft mit «{file}»',
    printedBy: 'gedruckt von {software}',
    olderOne: 'Nur das neueste PDF zählt (1 früheres).',
    older: 'Nur das neueste PDF zählt ({n} frühere).',
    summary: '{n} verglichen · {match} stimmen · {fix} zu korrigieren',
    unreadable:
      'Taxpresso kann «{file}» nicht als Genfer Steuererklärung lesen. Es braucht das von GeTax oder der Online-Steuererklärung gedruckte PDF, mit Text, keinen Scan und kein Foto. Lade es dort nochmals herunter und füge es hinzu.',
    otherYear:
      '«{file}» ist deine Steuererklärung {printed}, nicht die von {year}. Füge das PDF deiner Steuererklärung {year} hinzu.',
    clear:
      'Alles, was Taxpresso verglichen hat, stimmt. Du kannst deine Steuererklärung selbst übermitteln, in GeTax oder der Online-Steuererklärung.',
    toFixLead:
      'Korrigiere diese in GeTax oder der Online-Steuererklärung, lade dann das PDF nochmals herunter und füge es hier hinzu: Taxpresso prüft es erneut.',
    notFinalOne:
      '1 verglichener Wert ist in Taxpresso noch nicht definitiv (Braucht dein OK oder Schätzung). Kläre ihn zuerst, oben.',
    notFinal:
      '{n} verglichene Werte sind in Taxpresso noch nicht definitiv (Braucht dein OK oder Schätzung). Kläre sie zuerst, oben.',
    fix: 'Korrigieren',
    differs: 'Anderer Betrag',
    pdfOnly: 'Nur in deinem PDF',
    taxpressoOnly: 'Fehlt in deinem PDF',
    matches: 'Stimmt',
    inPdf: 'In deinem PDF',
    toType: 'Einzutragen',
    nothing: 'nichts',
    unknownCode: 'Taxpresso füllt diese Zeile nicht aus: Prüfe sie anhand deiner Dokumente.',
    pdfPage: 'Seite {page} des PDFs',
    showMatches: 'Die {n} übereinstimmenden Werte zeigen',
    computedTitle: 'Zeilen, die das Formular ausrechnet ({n})',
    computedLead:
      'Totale, übertragene Totale und Beträge, die eine Regel ausrechnet. Taxpresso prüft, ob die Totale aufgehen; sie zählen nie als Differenzen.',
    addsUp: 'Geht auf',
    sameAs: 'Gleich wie auf {page}',
    off: 'Geht nicht auf: Die Zeilen oben ergeben {amount}',
    offFrom: 'Nicht gleich wie auf {page}: {amount}',
    shown: 'Vom Formular ausgerechnet',
    computed: 'Berechnet',
    byEyeTitle: 'Prüfe diese selbst',
    byEyeTick: 'Ein Feld zum Ankreuzen',
    byEyeText: 'Text: {value}',
    byEyeTextNoValue: 'Text',
    byEyeColumns: 'Taxpresso kann die Beträge auf dieser Zeile nicht auseinanderhalten',
    notCompared:
      'Namen, Adressen und das Wertschriftenverzeichnis (état des titres, annexe F) werden nicht verglichen: Prüfe sie selbst.',
    warnings: 'Mit Warnungen gelesen: {list}',
    transmitTitle: 'Du bist dran: übermitteln',
    transmit1: 'Korrigiere jede Differenz in GeTax oder der Online-Steuererklärung.',
    transmit2: 'Lade das PDF nochmals herunter und füge es hier hinzu, bis alles stimmt.',
    transmit3:
      'Drück selbst auf Transmettre (übermitteln). Weder Taxpresso noch Claude übermitteln je deine Steuererklärung.',
    statusNeedsOk: 'Braucht dein OK',
    statusEstimate: 'Schätzung',
    colon: ': ',
    notAvailableVd:
      'Taxpresso prüft vorerst nur das PDF von Genfer Steuererklärungen. Für deine Waadtländer Steuererklärung vergleiche selbst, was du in VaudTax eingetragen hast, mit den Werten zum Eintragen oben. Du übermittelst deine Steuererklärung selbst.',
  },
} as const;

export type ReconcileMessageKey = keyof (typeof messages)['en'];

/** The key of a canton's own text, else the default (./i18n.ts, cantonKey). */
export const rck = (key: ReconcileMessageKey, canton: string | undefined): ReconcileMessageKey =>
  cantonKey(messages.en, key, canton);

export function tr(
  lang: Language,
  key: ReconcileMessageKey,
  vars: Record<string, string | number> = {},
): string {
  return messages[lang][key].replace(/\{(\w+)\}/g, (_, name: string) => String(vars[name] ?? ''));
}
