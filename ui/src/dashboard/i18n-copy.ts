// UI strings for the copy panel (SPEC.md 10.5). Second person, plain words, the official label
// (French in Geneva and Vaud, German in Zurich and Bern) always next to its gloss. Status labels follow SPEC.md
// section 11b.
import { cantonKey, type Language } from './i18n';

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
    leadZh:
      'Type each value into ZHprivateTax or the paper form, page by page in the form’s order: first the Berufsauslagen and Versicherungsprämien forms, whose totals carry to page 3. Amounts are whole francs (CHF ohne Rappen), without separators. Tick each value once it is in.',
    coupleZh:
      'On the Zurich form, Person 1 is {a} and Person 2 is {b}. If your form has them the other way round, swap the values.',
    leadBe:
      'Type each value into TaxMe-Online or the paper form, form by form in the form’s order. Amounts are whole francs, without separators. TaxMe works out the limits and two summaries (Zusammenzug): check them against the last two sections. Tick each value once it is in.',
    coupleBe:
      'On the Bern form, the column Mann is {a} and the column Frau is {b}, registered partners included. If your form has them the other way round, swap the values.',
    leadBl:
      'Type each value into E-Tax BL or the paper form, page by page in the form’s order: page 2 the income, page 3 the deductions in two columns, Staatssteuer and Bundessteuer, page 4 the wealth. Amounts are whole francs (CHF ohne Rappen), without separators. Tick each value once it is in.',
    coupleBl:
      'On the Basel-Landschaft return, Person 1 is {a} and Person 2 is {b}. If your form has them the other way round, swap the values.',
    leadVd:
      'Type each value into VaudTax or the paper form, page by page in the form’s order. Amounts are whole francs, without centimes or separators. The last section, the federal tax (impôt fédéral direct), is only to check: VaudTax works it out. Tick each value once it is in.',
    coupleVd:
      'On the Vaud form, contribuable 1 is {a} and contribuable 2 is {b}. If your form has them the other way round, swap the values.',
    leadBs:
      'Type each value into BalTax Online or the paper form, form by form in the order the guide gives: first the auxiliary forms (W, B, K, Z, F), whose totals carry to pages 2 to 4. From 369 down, each line has a Kanton and a Bund column. Amounts are whole francs (CHF ohne Rappen), without separators. Tick each value once it is in.',
    leadAg:
      'Type each value into eTAX AARGAU or the paper form: the sheets first (Berufskosten, Schuldenverzeichnis, Wertschriftenverzeichnis, Krankheitskosten), then the main form. Amounts are whole francs, without centimes or separators. The codes are the sections of the Aargau guide: check each against your form or eTAX AARGAU. There is no federal column: the tax office works out the federal tax. Tick each value once it is in.',
    coupleBs:
      'On the Basel-Stadt form, Person 1 is {a} and Person 2 is {b}. If your form has them the other way round, swap the values.',
    coupleAg:
      'On the Aargau forms, Person 1 is {a} and Person 2 is {b}. If your form has them the other way round, swap the values.',
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
    leadZh: `Recopiez chaque valeur dans ZHprivateTax ou le formulaire papier, page par page dans l’ordre du formulaire${NB}: d’abord les formulaires Berufsauslagen et Versicherungsprämien, dont les totaux sont reportés en page 3. Les montants sont en francs entiers (CHF ohne Rappen), sans séparateurs. Cochez chaque valeur une fois saisie.`,
    coupleZh: `Sur le formulaire zurichois, la Person 1 est {a} et la Person 2 est {b}. Si votre formulaire les inverse, inversez les valeurs.`,
    leadBe: `Recopiez chaque valeur dans TaxMe-Online ou le formulaire papier, formule par formule dans l’ordre du formulaire. Les montants sont en francs entiers, sans séparateurs. TaxMe calcule les limites et deux récapitulatifs (Zusammenzug)${NB}: comparez-les avec les deux dernières sections. Cochez chaque valeur une fois saisie.`,
    coupleBe: `Sur le formulaire bernois, la colonne Mann est {a} et la colonne Frau est {b}, partenaires enregistrés compris. Si votre formulaire les inverse, inversez les valeurs.`,
    leadBl: `Recopiez chaque valeur dans E-Tax BL ou le formulaire papier, page par page dans l’ordre du formulaire${NB}: page 2 les revenus, page 3 les déductions en deux colonnes, Staatssteuer et Bundessteuer, page 4 la fortune. Les montants sont en francs entiers (CHF ohne Rappen), sans séparateurs. Cochez chaque valeur une fois saisie.`,
    coupleBl: `Sur la déclaration de Bâle-Campagne, la Person 1 est {a} et la Person 2 est {b}. Si votre formulaire les inverse, inversez les valeurs.`,
    leadVd: `Recopiez chaque valeur dans VaudTax ou le formulaire papier, page par page dans l’ordre du formulaire. Les montants sont en francs entiers, sans centimes ni séparateurs. La dernière section, l’impôt fédéral direct, est seulement à vérifier${NB}: VaudTax le calcule. Cochez chaque valeur une fois saisie.`,
    coupleVd: `Sur le formulaire vaudois, le contribuable 1 est {a} et le contribuable 2 est {b}. Si votre formulaire les inverse, inversez les valeurs.`,
    leadBs: `Recopiez chaque valeur dans BalTax Online ou le formulaire papier, formulaire par formulaire dans l’ordre du guide${NB}: d’abord les formulaires annexes (W, B, K, Z, F), dont les totaux sont reportés aux pages 2 à 4. À partir du 369, chaque ligne a une colonne Kanton et une colonne Bund. Les montants sont en francs entiers (CHF ohne Rappen), sans séparateurs. Cochez chaque valeur une fois saisie.`,
    leadAg: `Recopiez chaque valeur dans eTAX AARGAU ou le formulaire papier${NB}: d’abord les feuilles annexes (Berufskosten, Schuldenverzeichnis, Wertschriftenverzeichnis, Krankheitskosten), puis le formulaire principal. Les montants sont en francs entiers, sans centimes ni séparateurs. Les codes sont les sections du guide argovien${NB}: vérifiez chacun sur votre formulaire ou dans eTAX AARGAU. Il n’y a pas de colonne fédérale${NB}: l’administration calcule l’impôt fédéral. Cochez chaque valeur une fois saisie.`,
    coupleBs: `Sur le formulaire bâlois, la Person 1 est {a} et la Person 2 est {b}. Si votre formulaire les inverse, inversez les valeurs.`,
    coupleAg: `Sur les formulaires argoviens, la Person 1 est {a} et la Person 2 est {b}. Si votre formulaire les inverse, inversez les valeurs.`,
  },
  de: {
    title: 'Fülle deine Steuererklärung aus',
    lead: 'Tippe jeden Wert in die offizielle Steuererklärung (e-démarches oder GeTax), Seite für Seite in der Reihenfolge des Formulars. Beträge in ganzen Franken, ohne Rappen und ohne Trennzeichen, wie das Formular es verlangt. Hake jeden Wert ab, sobald er drin ist.',
    progress: '{n} von {total} eingetragen',
    pending: '{n} noch nicht definitiv',
    couple:
      'Auf dem Formular ist contribuable A die links gedruckte Person, B die andere. Hier ist A {a} und B {b}: Wenn dein Formular sie umgekehrt hat, tausche die Werte von A und B.',
    waiting: 'Noch nicht auf dem Formular, sag, was es ist: {list}',
    copy: 'Kopieren',
    copied: 'Kopiert',
    copyFailed: 'Kopiere das: {value}',
    copyLabel: '{label} kopieren',
    entered: 'Eingetragen',
    tick: 'Dieses Feld ankreuzen',
    rounded: 'Aus {amount}, auf den Franken gerundet',
    confirmFirst: 'Prüfe es zuerst, unter «Was Claude in deinen Dokumenten gelesen hat».',
    estimateFirst: 'Eine Schätzung: Kläre sie, bevor du sie einträgst.',
    formWorksOut: 'Das Formular rechnet das aus: Prüfe, ob es diesen Betrag zeigt.',
    from: 'Gelesen in {files}',
    statusNeedsOk: 'Braucht dein OK',
    statusConfirmed: 'Von dir bestätigt',
    statusVerified: 'Geprüft',
    statusEstimate: 'Schätzung',
    statusComputed: 'Berechnet',
    pageLabel: 'Seite {page} des Formulars',
    column: 'Spalte {list}',
    columns: 'Spalten {list}',
    split:
      'Für den ganzen Haushalt: Teile es auf dem Formular auf {parts} auf, wie auf deinem Dokument.',
    leadZh:
      'Tippe jeden Wert in ZHprivateTax oder ins Papierformular, Seite für Seite in der Reihenfolge des Formulars: zuerst die Formulare Berufsauslagen und Versicherungsprämien, deren Totale auf Seite 3 übertragen werden. Beträge in ganzen Franken (CHF ohne Rappen), ohne Trennzeichen. Hake jeden Wert ab, sobald er drin ist.',
    coupleZh:
      'Auf dem Zürcher Formular ist Person 1 {a} und Person 2 {b}. Wenn dein Formular sie umgekehrt hat, tausche die Werte.',
    leadBe:
      'Tippe jeden Wert in TaxMe-Online oder ins Papierformular, Formular für Formular in der Reihenfolge der Steuererklärung. Beträge in ganzen Franken, ohne Trennzeichen. TaxMe rechnet die Höchstbeträge und zwei Zusammenzüge aus: Vergleiche sie mit den letzten beiden Abschnitten. Hake jeden Wert ab, sobald er drin ist.',
    coupleBe:
      'Auf dem Berner Formular ist die Spalte Mann {a} und die Spalte Frau {b}, auch bei eingetragenen Partnerschaften. Wenn dein Formular sie umgekehrt hat, tausche die Werte.',
    leadBl:
      'Tippe jeden Wert in E-Tax BL oder ins Papierformular, Seite für Seite in der Reihenfolge der Steuererklärung: Seite 2 die Einkünfte, Seite 3 die Abzüge in zwei Spalten, Staatssteuer und Bundessteuer, Seite 4 das Vermögen. Beträge in ganzen Franken (CHF ohne Rappen), ohne Trennzeichen. Hake jeden Wert ab, sobald er drin ist.',
    coupleBl:
      'Auf der Steuererklärung von Basel-Landschaft ist Person 1 {a} und Person 2 {b}. Wenn dein Formular sie umgekehrt hat, tausche die Werte.',
    leadVd:
      'Tippe jeden Wert in VaudTax oder ins Papierformular, Seite für Seite in der Reihenfolge des Formulars. Beträge in ganzen Franken, ohne Rappen und ohne Trennzeichen. Der letzte Abschnitt, die direkte Bundessteuer (impôt fédéral direct), ist nur zum Prüfen: VaudTax rechnet sie aus. Hake jeden Wert ab, sobald er drin ist.',
    coupleVd:
      'Auf dem Waadtländer Formular ist contribuable 1 {a} und contribuable 2 {b}. Wenn dein Formular sie umgekehrt hat, tausche die Werte.',
    leadBs:
      'Tippe jeden Wert in BalTax Online oder ins Papierformular, Formular für Formular in der Reihenfolge der Wegleitung: zuerst die Hilfsformulare (W, B, K, Z, F), deren Totale auf die Seiten 2 bis 4 übertragen werden. Ab Ziffer 369 hat jede Zeile eine Spalte Kanton und eine Spalte Bund. Beträge in ganzen Franken (CHF ohne Rappen), ohne Trennzeichen. Hake jeden Wert ab, sobald er drin ist.',
    leadAg:
      'Tippe jeden Wert in eTAX AARGAU oder ins Papierformular: zuerst die Hilfsblätter (Berufskosten, Schuldenverzeichnis, Wertschriftenverzeichnis, Krankheitskosten), dann den Hauptbogen. Beträge in ganzen Franken, ohne Rappen und ohne Trennzeichen. Die Ziffern sind die Abschnitte der Wegleitung: Prüfe jede auf deinem Formular oder in eTAX AARGAU. Eine Spalte für die Bundessteuer gibt es nicht: Das Steueramt berechnet sie. Hake jeden Wert ab, sobald er drin ist.',
    coupleBs:
      'Auf dem Basler Formular ist Person 1 {a} und Person 2 {b}. Wenn dein Formular sie umgekehrt hat, tausche die Werte.',
    coupleAg:
      'Auf den Aargauer Formularen ist Person 1 {a} und Person 2 {b}. Wenn dein Formular sie umgekehrt hat, tausche die Werte.',
  },
} as const;

export type CopyMessageKey = keyof (typeof messages)['en'];

/** The key of a canton's own text, else Geneva's (./i18n.ts, cantonKey). */
export const cck = (key: CopyMessageKey, canton: string | undefined): CopyMessageKey =>
  cantonKey(messages.en, key, canton);

export function tc(
  lang: Language,
  key: CopyMessageKey,
  vars: Record<string, string | number> = {},
): string {
  return messages[lang][key].replace(/\{(\w+)\}/g, (_, name: string) => String(vars[name] ?? ''));
}
