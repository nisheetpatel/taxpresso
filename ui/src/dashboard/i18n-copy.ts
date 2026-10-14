// UI strings for the copy panel (SPEC.md 10.5). Second person, plain words, the official label
// (French in Geneva and Vaud, German in Zurich and Bern) always next to its gloss. Status labels follow SPEC.md
// section 11b.
import { cantonKey, type Language } from './i18n';

const NB = String.fromCharCode(0xa0);

export const messages = {
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
    coupleBs:
      'On the Basel-Stadt form, Person 1 is {a} and Person 2 is {b}. If your form has them the other way round, swap the values.',
    leadZg:
      'Type each value into eTax.zug or the paper form K, page by page in the form’s order: page 2 the income, page 3 the deductions, each in two columns, Kanton and Bund, page 4 the wealth. Amounts are whole francs (keine Rappenbeträge), without separators. Tick each value once it is in.',
    coupleZg:
      'On Zug’s form K, Person 1 is {a} and Person 2 is {b}. If your form has them the other way round, swap the values.',
    leadLu:
      'Type each value into eSteuern.LU or the paper forms, in the order the guide advises: form B and the securities list first, then pages 2 to 4 of the return, in its one column. Amounts are whole francs (CHF ohne Rappen), without separators. The Ergänzungsblatt Direkte Bundessteuer is optional: its values are there to check. Tick each value once it is in.',
    coupleLu:
      'On the Lucerne return, Person 1 is {a} and Person 2 is {b}. The return prints the husband as Person 1: if yours has them the other way round, swap the values.',
    leadSg:
      'Type each value into E-Tax SG or the paper forms, in the form’s order: first Form 4 (Berufskosten) for each person, whose total goes to 10.1 or 10.2, then the return’s page 2 the income, page 3 the deductions, page 4 the wealth. The return has one column: the tax office works out the federal tax from it. Amounts are whole francs, without separators. Tick each value once it is in.',
    coupleSg:
      'On the St. Gallen return, Person 1 is {a} and Person 2 is {b}. If your form has them the other way round, swap the values.',
    leadTi:
      'Type each value into eTax PF or the paper forms, in the forms’ order: first Modulo 4 (spese professionali) for each person, whose total goes to 9.1 or 9.2, then Modulo 6 and Modulo 5, then the return (Modulo 1) page 2 the income, page 3 the deductions, page 4 the wealth. The return has one column: the tax authority works out the federal tax from it. Amounts are whole francs, without separators. Tick each value once it is in.',
    coupleTi:
      'On the Ticino forms, the taxpayer (contribuente) is {a} and the spouse (coniuge/partner registrato) is {b}. If your forms have them the other way round, swap the values.',
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
    coupleBs: `Sur le formulaire bâlois, la Person 1 est {a} et la Person 2 est {b}. Si votre formulaire les inverse, inversez les valeurs.`,
    leadZg: `Recopiez chaque valeur dans eTax.zug ou le formulaire K papier, page par page dans l’ordre du formulaire${NB}: page 2 les revenus, page 3 les déductions, chacune en deux colonnes, Kanton et Bund, page 4 la fortune. Les montants sont en francs entiers (keine Rappenbeträge), sans séparateurs. Cochez chaque valeur une fois saisie.`,
    coupleZg: `Sur le formulaire K de Zoug, la Person 1 est {a} et la Person 2 est {b}. Si votre formulaire les inverse, inversez les valeurs.`,
    leadLu: `Recopiez chaque valeur dans eSteuern.LU ou les formulaires papier, dans l’ordre que conseille le guide${NB}: d’abord le formulaire B et l’état des titres, puis les pages 2 à 4 de la déclaration, dans sa colonne unique. Les montants sont en francs entiers (CHF ohne Rappen), sans séparateurs. L’Ergänzungsblatt Direkte Bundessteuer est facultatif${NB}: ses valeurs sont là pour vérifier. Cochez chaque valeur une fois saisie.`,
    coupleLu: `Sur la déclaration lucernoise, la Person 1 est {a} et la Person 2 est {b}. La déclaration imprime le mari comme Person 1${NB}: si la vôtre les inverse, inversez les valeurs.`,
    leadSg: `Recopiez chaque valeur dans E-Tax SG ou les formulaires papier, dans l’ordre du formulaire${NB}: d’abord le formulaire 4 (Berufskosten, frais professionnels) de chaque personne, dont le total va au 10.1 ou au 10.2, puis la page 2 de la déclaration les revenus, la page 3 les déductions, la page 4 la fortune. La déclaration a une seule colonne${NB}: l’administration fiscale en déduit l’impôt fédéral. Les montants sont en francs entiers, sans séparateurs. Cochez chaque valeur une fois saisie.`,
    coupleSg: `Sur la déclaration saint-galloise, la Person 1 est {a} et la Person 2 est {b}. Si votre formulaire les inverse, inversez les valeurs.`,
    leadTi: `Recopiez chaque valeur dans eTax PF ou les formulaires papier, dans l’ordre des formulaires${NB}: d’abord le Modulo 4 (spese professionali, frais professionnels) de chaque personne, dont le total va au 9.1 ou au 9.2, puis le Modulo 6 et le Modulo 5, puis la déclaration (Modulo 1), la page 2 les revenus, la page 3 les déductions, la page 4 la fortune. La déclaration a une seule colonne${NB}: l’autorité fiscale en déduit l’impôt fédéral. Les montants sont en francs entiers, sans séparateurs. Cochez chaque valeur une fois saisie.`,
    coupleTi:
      'Sur les formulaires tessinois, le contribuable (contribuente) est {a} et le conjoint (coniuge/partner registrato) est {b}. Si vos formulaires les inversent, inversez les valeurs.',
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
    coupleBs:
      'Auf dem Basler Formular ist Person 1 {a} und Person 2 {b}. Wenn dein Formular sie umgekehrt hat, tausche die Werte.',
    leadZg:
      'Tippe jeden Wert in eTax.zug oder ins Papierformular K, Seite für Seite in der Reihenfolge des Formulars: Seite 2 die Einkünfte, Seite 3 die Abzüge, je in zwei Spalten, Kanton und Bund, Seite 4 das Vermögen. Beträge in ganzen Franken (keine Rappenbeträge), ohne Trennzeichen. Hake jeden Wert ab, sobald er drin ist.',
    coupleZg:
      'Auf dem Formular K von Zug ist Person 1 {a} und Person 2 {b}. Wenn dein Formular sie umgekehrt hat, tausche die Werte.',
    leadLu:
      'Tippe jeden Wert in eSteuern.LU oder in die Papierformulare, in der Reihenfolge, die die Wegleitung empfiehlt: zuerst das Formular B und das Wertschriftenverzeichnis, dann die Seiten 2 bis 4 der Steuererklärung, in ihrer einen Spalte. Beträge in ganzen Franken (CHF ohne Rappen), ohne Trennzeichen. Das Ergänzungsblatt Direkte Bundessteuer ist freiwillig: Seine Werte sind zum Prüfen da. Hake jeden Wert ab, sobald er drin ist.',
    coupleLu:
      'Auf der Luzerner Steuererklärung ist Person 1 {a} und Person 2 {b}. Die Steuererklärung führt den Ehemann als Person 1: Wenn deine sie umgekehrt hat, tausche die Werte.',
    leadSg:
      'Tippe jeden Wert in E-Tax SG oder in die Papierformulare, in der Reihenfolge des Formulars: zuerst das Formular 4 (Berufskosten) für jede Person, dessen Total in Ziffer 10.1 oder 10.2 kommt, dann auf der Steuererklärung Seite 2 die Einkünfte, Seite 3 die Abzüge, Seite 4 das Vermögen. Die Steuererklärung hat eine Spalte: Die Steuerbehörde leitet die direkte Bundessteuer daraus ab. Beträge in ganzen Franken, ohne Trennzeichen. Hake jeden Wert ab, sobald er drin ist.',
    coupleSg:
      'Auf der St. Galler Steuererklärung ist Person 1 {a} und Person 2 {b}. Wenn dein Formular sie umgekehrt hat, tausche die Werte.',
    leadTi:
      'Tippe jeden Wert in eTax PF oder in die Papierformulare, in der Reihenfolge der Formulare: zuerst das Modulo 4 (spese professionali, Berufskosten) für jede Person, dessen Total in 9.1 oder 9.2 kommt, dann das Modulo 6 und das Modulo 5, dann die Steuererklärung (Modulo 1), Seite 2 die Einkünfte, Seite 3 die Abzüge, Seite 4 das Vermögen. Die Steuererklärung hat eine Spalte: Die Steuerbehörde leitet die direkte Bundessteuer daraus ab. Beträge in ganzen Franken, ohne Trennzeichen. Hake jeden Wert ab, sobald er drin ist.',
    coupleTi:
      'Auf den Tessiner Formularen ist der Steuerpflichtige (contribuente) {a} und der Ehegatte (coniuge/partner registrato) {b}. Wenn deine Formulare sie umgekehrt haben, tausche die Werte.',
  },
  it: {
    title: 'Compila la tua dichiarazione',
    lead: 'Inserisci ogni valore nella dichiarazione ufficiale (e-démarches o GeTax), pagina per pagina nell’ordine del modulo. Gli importi sono in franchi interi, senza centesimi né separatori, come chiede il modulo. Spunta ogni valore una volta inserito.',
    progress: '{n} di {total} inseriti',
    pending: '{n} non ancora definitivi',
    couple:
      'Sul modulo, il contribuable A è la persona stampata a sinistra, B l’altra. Qui A è {a} e B è {b}: se il tuo modulo li ha al contrario, scambia i valori di A e B.',
    waiting: 'Non ancora sul modulo, indica cos’è: {list}',
    copy: 'Copia',
    copied: 'Copiato',
    copyFailed: 'Copia questo: {value}',
    copyLabel: 'Copia {label}',
    entered: 'Inserito',
    tick: 'Spunta questa casella',
    rounded: 'Da {amount}, arrotondato al franco',
    confirmFirst: 'Controllalo prima, in “Cosa ha letto Claude nei tuoi documenti”.',
    estimateFirst: 'Una stima: sistemala prima di inserirla.',
    formWorksOut: 'Il modulo lo calcola: controlla che mostri questo importo.',
    from: 'Letto in {files}',
    statusNeedsOk: 'Da confermare',
    statusConfirmed: 'Confermato da te',
    statusVerified: 'Verificato',
    statusEstimate: 'Stima',
    statusComputed: 'Calcolato',
    pageLabel: 'Pagina {page} del modulo',
    column: 'Colonna {list}',
    columns: 'Colonne {list}',
    split:
      'Per tutta l’economia domestica: sul modulo, ripartiscilo tra {parts}, come sul tuo documento.',
    leadZh:
      'Inserisci ogni valore in ZHprivateTax o nel modulo cartaceo, pagina per pagina nell’ordine del modulo: prima i moduli Berufsauslagen e Versicherungsprämien, i cui totali vanno riportati a pagina 3. Gli importi sono in franchi interi (CHF ohne Rappen), senza separatori. Spunta ogni valore una volta inserito.',
    coupleZh:
      'Sul modulo di Zurigo, Person 1 è {a} e Person 2 è {b}. Se il tuo modulo li ha al contrario, scambia i valori.',
    leadBe:
      'Inserisci ogni valore in TaxMe-Online o nel modulo cartaceo, modulo per modulo nell’ordine della dichiarazione. Gli importi sono in franchi interi, senza separatori. TaxMe calcola i limiti e due riepiloghi (Zusammenzug): confrontali con le ultime due sezioni. Spunta ogni valore una volta inserito.',
    coupleBe:
      'Sul modulo di Berna, la colonna Mann è {a} e la colonna Frau è {b}, anche per le unioni domestiche registrate. Se il tuo modulo li ha al contrario, scambia i valori.',
    leadBl:
      'Inserisci ogni valore in E-Tax BL o nel modulo cartaceo, pagina per pagina nell’ordine del modulo: a pagina 2 i redditi, a pagina 3 le deduzioni in due colonne, Staatssteuer e Bundessteuer, a pagina 4 la sostanza. Gli importi sono in franchi interi (CHF ohne Rappen), senza separatori. Spunta ogni valore una volta inserito.',
    coupleBl:
      'Sulla dichiarazione di Basilea Campagna, Person 1 è {a} e Person 2 è {b}. Se il tuo modulo li ha al contrario, scambia i valori.',
    leadVd:
      'Inserisci ogni valore in VaudTax o nel modulo cartaceo, pagina per pagina nell’ordine del modulo. Gli importi sono in franchi interi, senza centesimi né separatori. L’ultima sezione, l’imposta federale diretta (impôt fédéral direct), serve solo da controllo: la calcola VaudTax. Spunta ogni valore una volta inserito.',
    coupleVd:
      'Sul modulo di Vaud, il contribuable 1 è {a} e il contribuable 2 è {b}. Se il tuo modulo li ha al contrario, scambia i valori.',
    leadBs:
      'Inserisci ogni valore in BalTax Online o nel modulo cartaceo, modulo per modulo nell’ordine indicato dalla guida: prima i moduli ausiliari (W, B, K, Z, F), i cui totali vanno riportati alle pagine da 2 a 4. Dal 369 in poi, ogni riga ha una colonna Kanton e una colonna Bund. Gli importi sono in franchi interi (CHF ohne Rappen), senza separatori. Spunta ogni valore una volta inserito.',
    coupleBs:
      'Sul modulo di Basilea Città, Person 1 è {a} e Person 2 è {b}. Se il tuo modulo li ha al contrario, scambia i valori.',
    leadZg:
      'Inserisci ogni valore in eTax.zug o nel modulo cartaceo K, pagina per pagina nell’ordine del modulo: a pagina 2 i redditi, a pagina 3 le deduzioni, ognuna in due colonne, Kanton e Bund, a pagina 4 la sostanza. Gli importi sono in franchi interi (keine Rappenbeträge), senza separatori. Spunta ogni valore una volta inserito.',
    coupleZg:
      'Sul modulo K di Zugo, Person 1 è {a} e Person 2 è {b}. Se il tuo modulo li ha al contrario, scambia i valori.',
    leadLu:
      'Inserisci ogni valore in eSteuern.LU o nei moduli cartacei, nell’ordine consigliato dalla guida: prima il modulo B e l’elenco dei titoli, poi le pagine da 2 a 4 della dichiarazione, nella sua unica colonna. Gli importi sono in franchi interi (CHF ohne Rappen), senza separatori. L’Ergänzungsblatt Direkte Bundessteuer è facoltativo: i suoi valori servono da controllo. Spunta ogni valore una volta inserito.',
    coupleLu:
      'Sulla dichiarazione di Lucerna, Person 1 è {a} e Person 2 è {b}. La dichiarazione stampa il marito come Person 1: se la tua li ha al contrario, scambia i valori.',
    leadSg:
      'Inserisci ogni valore in E-Tax SG o nei moduli cartacei, nell’ordine del modulo: prima il modulo 4 (Berufskosten) per ogni persona, il cui totale va al 10.1 o al 10.2, poi sulla dichiarazione a pagina 2 i redditi, a pagina 3 le deduzioni, a pagina 4 la sostanza. La dichiarazione ha una sola colonna: l’amministrazione fiscale ne ricava l’imposta federale. Gli importi sono in franchi interi, senza separatori. Spunta ogni valore una volta inserito.',
    coupleSg:
      'Sulla dichiarazione di San Gallo, Person 1 è {a} e Person 2 è {b}. Se il tuo modulo li ha al contrario, scambia i valori.',
    leadTi:
      'Inserisci ogni valore in eTax PF o sui moduli cartacei, nell’ordine dei moduli: prima il Modulo 4 (spese professionali) di ogni persona, il cui totale va alla cifra 9.1 o 9.2, poi il Modulo 6 e il Modulo 5, poi la dichiarazione (Modulo 1), pagina 2 i redditi, pagina 3 le deduzioni, pagina 4 la sostanza. La dichiarazione ha una sola colonna: l’autorità fiscale ne ricava l’imposta federale diretta. Gli importi sono in franchi interi, senza separatori. Spunta ogni valore una volta inserito.',
    coupleTi:
      'Sui moduli ticinesi, il contribuente è {a} e il coniuge/partner registrato è {b}. Se i tuoi moduli li hanno al contrario, scambia i valori.',
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
