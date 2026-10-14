// UI strings for "Last year, reviewed" (Review.tsx): second person, plain words, the official French
// term next to its gloss. Status labels come from SPEC.md 11b: Computed, Estimate, Fix ("Check
// this" for a total that doesn't match, as in the "Check this" list).
import type { Language } from './i18n';

const NB = String.fromCharCode(0xa0);

const messages = {
  en: {
    title: 'Last year, reviewed',
    official: 'déclaration {year}',
    noneLead:
      'Drop in last year’s declaration (the PDF from GeTax, the online declaration or your tax software) and Taxpresso reviews it here, on this computer: what you could have saved, what you may have missed, and what you can still do.',
    lead: 'From your {year} declaration, read by Taxpresso on this computer, with the {year} rules. Nothing here changes your {taxYear} tax.',
    taxTitle: 'Your {year} tax, recomputed',
    taxOfficial: 'impôts {year}',
    total: 'Total',
    icc: 'Cantonal and communal tax (ICC)',
    ifd: 'Federal direct tax (IFD)',
    computed: 'Computed',
    estimate: 'Estimate',
    checkThis: 'Check this',
    taxNote:
      'Your declaration doesn’t show the tax; your assessment (bordereau) does. These figures come from what Taxpresso read in your declaration.',
    allMatch: 'The totals printed on your declaration match Taxpresso’s ({n} of {n}).',
    someMatch: 'The other totals printed on your declaration match ({n}).',
    checkLine: '{what} ({column}): {printed} on your {where}, {recomputed} recomputed.',
    checkWhy:
      'It may be a figure Taxpresso misread, or a rule it doesn’t cover yet. Compare with the page of your declaration.',
    whereDeclaration: 'declaration',
    whereAssessment: 'assessment',
    needsCommune:
      'To recompute it, Taxpresso needs your commune at the end of {year}: answer the question about your commune above.',
    needsCivil:
      'To recompute it, Taxpresso needs your civil status at the end of {year}: answer the question above.',
    savedTitle: 'What you could have saved',
    pillar3a: 'Pillar 3a',
    pillar3aOfficial: '3e pilier A',
    paidOf: 'You paid {paid} of {limit}.',
    paidOfPartner: 'Paid {paid} of {limit}.',
    paidAll: 'Paid in full: {limit}.',
    upTo: 'up to {amount}',
    withFund: 'With a pension fund (2e pilier)',
    withoutFund: 'Without a pension fund',
    fundUnknown:
      'Did you have a pension fund (2e pilier) in {year}? Your salary certificate shows contributions in box 10.1.',
    left: '{amount} left',
    saved: 'Tax you’d have saved, about',
    noSaving: 'Taxpresso shows what it would have saved once it can recompute the tax.',
    nothingMissed: 'Taxpresso found no pillar 3a left unpaid.',
    askTitle: 'Worth asking yourself',
    askLead: 'These were empty, or at the flat rate, last year. Only questions: no amounts.',
    stillTitle: 'What you can still do',
    catchUp:
      'Make up for {gapYear} in your 3a (rachat 3a): up to {amount} in {year}, on top of this year’s payment.',
    catchUpFirst: 'Pay this year’s 3a in full first.',
    catchUpEnter:
      'Your declaration shows {paid} paid into 3a in {gapYear}: enter it in the catch-up card if it’s right.',
    catchUpLink: 'Plan it, with the saving',
    catchUpNone: 'A 3a gap from before 2025 can never be made up.',
    deadline: 'Deadline to object (réclamation), {tax}: {date}',
    deadlinePassed: 'passed',
    deadlineNoDate:
      'Taxpresso doesn’t know the date of your {year} assessment: the deadline to object is printed on it.',
    deadlineNote:
      'The date printed on your assessment always wins. If you disagree, you write the objection (réclamation) yourself; Taxpresso never sends it.',
    noAssessment:
      'If you have your {year} assessment (avis de taxation), drop it in: Taxpresso shows its deadline to object.',
    unknownYear:
      '{n} assessment in your documents has no tax year yet: tell Claude which year it is for.',
    unknownYears:
      '{n} assessments in your documents have no tax year yet: tell Claude which year each is for.',
    final:
      'Once an assessment is final, it can’t simply be changed: a revision (révision) is refused for anything you could have raised before, with reasonable care.',
    how: 'How it’s worked out',
    assumptions: 'What Taxpresso assumed',
    sources: 'Sources',
    page: 'page {page}',
    you: 'You',
    partner: 'Partner',
    household: 'Household',
    'tax.icc': 'cantonal',
    'tax.ifd': 'federal',
    'column.icc': 'cantonal',
    'column.ifd': 'federal',
    'column.total': 'cantonal and federal',
    'check.gross_income': 'Gross income (revenu brut, 91.00)',
    'check.subtotal_9220': 'Subtotal 92.20',
    'check.subtotal_9240': 'Subtotal 92.40',
    'check.net_income': 'Total net income (revenu net total, 95.00)',
    'check.taxable_income': 'Taxable income (revenu imposable, 99.00)',
    'check.gross_wealth': 'Gross wealth (fortune brute, 91.00)',
    'check.net_wealth': 'Net wealth (fortune nette, 95.00)',
    'check.taxable_wealth': 'Taxable wealth (fortune imposable, 99.00)',
    'check.assessed_tax': 'Tax on your assessment (montant de l’impôt)',
    'q.professional_actual':
      'The flat deduction for work costs (déduction forfaitaire). Were the actual costs (frais effectifs) higher, for example tools or union dues?',
    'q.commute':
      'No commuting costs (frais de déplacement). Do you pay to get to work, for example a public transport pass or a bike?',
    'q.meals':
      'No meal costs (frais de repas). Do you eat your main meal away from home on working days?',
    'q.childcare':
      'No childcare costs (frais de garde). Do you pay for a crèche, after-school care (parascolaire) or a nanny for a child under 14?',
    'q.medical':
      'No medical costs (frais médicaux). Did costs your health insurance didn’t cover, like the dentist, glasses or your deductible, add up? Only the part above a share of your income counts.',
    'q.donations': 'No donations (dons). Do you give to charities that are exempt from tax?',
    'q.pension_buyin':
      'No pension fund buy-in (rachat 2e pilier). Your pension certificate shows if you can buy in; a buy-in your fund receives by 31 December counts for this year.',
    'u.year': 'Taxpresso recomputes a 2025 declaration only: those are the rules it has.',
    'u.not_read':
      'Taxpresso couldn’t read the summary pages (récapitulation, pages 2 and 3) of your declaration.',
    'u.income_elsewhere':
      'Part of your income was taxable elsewhere (97.00): the rate depends on income Taxpresso can’t see.',
    'u.shield':
      'The tax shield (bouclier fiscal) may apply to you, which Taxpresso doesn’t compute yet; GeTax does.',
    'u.ifd_shared_custody':
      'With shared custody, which parent gets the federal parental scale isn’t known yet.',
    'a.year_not_printed': 'Your declaration doesn’t print its year: taken as last year.',
    'a.commune_from_answers': 'Your commune as you gave it for this year.',
    'a.couple_from_answers': 'Your civil status as you gave it for this year.',
    'a.children_from_answers': 'Your children as you gave them for this year.',
    'a.no_children_given': 'No children counted: none given in your answers.',
    'a.home_commune_only':
      'All the communal tax at your home commune: Taxpresso doesn’t keep where you worked.',
    'a.others_as_declared':
      'Each saving changes one figure and keeps the others as declared, medical costs and donations too, whose limits move with income: the real saving can differ a little.',
    'a.pension_fund_2025_same': 'Your pension fund taken as it is now, for last year too.',
  },
  fr: {
    title: 'L’an dernier, revu',
    official: 'déclaration {year}',
    noneLead: `Déposez votre déclaration de l’an dernier (le PDF de GeTax, de la déclaration en ligne ou de votre logiciel) et Taxpresso la revoit ici, sur cet ordinateur${NB}: ce que vous auriez pu économiser, ce que vous avez peut-être oublié, et ce que vous pouvez encore faire.`,
    lead: 'D’après votre déclaration {year}, lue par Taxpresso sur cet ordinateur, avec les règles {year}. Rien ici ne change votre impôt {taxYear}.',
    taxTitle: 'Votre impôt {year}, recalculé',
    taxOfficial: 'impôts {year}',
    total: 'Total',
    icc: 'Impôt cantonal et communal (ICC)',
    ifd: 'Impôt fédéral direct (IFD)',
    computed: 'Calculé',
    estimate: 'Estimation',
    checkThis: 'À vérifier',
    taxNote: `Votre déclaration n’indique pas l’impôt${NB}; votre bordereau, oui. Ces montants viennent de ce que Taxpresso a lu dans votre déclaration.`,
    allMatch:
      'Les totaux imprimés sur votre déclaration correspondent à ceux de Taxpresso ({n} sur {n}).',
    someMatch: 'Les autres totaux imprimés sur votre déclaration correspondent ({n}).',
    checkLine: `{what} ({column})${NB}: {printed} sur votre {where}, {recomputed} recalculé.`,
    checkWhy:
      'Il peut s’agir d’un montant mal lu par Taxpresso, ou d’une règle qu’il ne couvre pas encore. Comparez avec la page de votre déclaration.',
    whereDeclaration: 'déclaration',
    whereAssessment: 'taxation',
    needsCommune: `Pour le recalculer, Taxpresso a besoin de votre commune à la fin de {year}${NB}: répondez à la question sur votre commune ci-dessus.`,
    needsCivil: `Pour le recalculer, Taxpresso a besoin de votre état civil à la fin de {year}${NB}: répondez à la question ci-dessus.`,
    savedTitle: 'Ce que vous auriez pu économiser',
    pillar3a: '3e pilier A',
    pillar3aOfficial: '',
    paidOf: 'Vous avez versé {paid} sur {limit}.',
    paidOfPartner: 'Versé {paid} sur {limit}.',
    paidAll: `Versé en entier${NB}: {limit}.`,
    upTo: 'jusqu’à {amount}',
    withFund: 'Avec caisse de pension (2e pilier)',
    withoutFund: 'Sans caisse de pension',
    fundUnknown: `Aviez-vous une caisse de pension (2e pilier) en {year}${NB}? Votre certificat de salaire indique les cotisations au chiffre 10.1.`,
    left: '{amount} de marge',
    saved: 'Impôt que vous auriez économisé, environ',
    noSaving: 'Taxpresso affichera l’économie dès qu’il pourra recalculer l’impôt.',
    nothingMissed: 'Taxpresso n’a trouvé aucun 3e pilier A non versé.',
    askTitle: 'À vous demander',
    askLead: `Ces postes étaient vides, ou au forfait, l’an dernier. Seulement des questions${NB}: aucun montant.`,
    stillTitle: 'Ce que vous pouvez encore faire',
    catchUp: `Rattraper {gapYear} dans votre 3a (rachat 3a)${NB}: jusqu’à {amount} en {year}, en plus du versement de cette année.`,
    catchUpFirst: 'Versez d’abord le 3a de cette année en entier.',
    catchUpEnter: `Votre déclaration indique {paid} versés au 3a en {gapYear}${NB}: saisissez ce montant dans la carte du rachat s’il est juste.`,
    catchUpLink: 'Le planifier, avec l’économie',
    catchUpNone: 'Une lacune de 3a antérieure à 2025 ne peut jamais être rattrapée.',
    deadline: `Délai de réclamation, {tax}${NB}: {date}`,
    deadlinePassed: 'dépassé',
    deadlineNoDate: `Taxpresso ne connaît pas la date de votre taxation {year}${NB}: le délai de réclamation y est imprimé.`,
    deadlineNote: `Le délai imprimé sur votre avis de taxation fait foi. Si vous n’êtes pas d’accord, vous écrivez vous-même la réclamation${NB}; Taxpresso ne l’envoie jamais.`,
    noAssessment: `Si vous avez votre avis de taxation {year}, déposez-le${NB}: Taxpresso affiche son délai de réclamation.`,
    unknownYear: `{n} avis de taxation dans vos documents n’a pas encore d’année fiscale${NB}: dites à Claude à quelle année il se rapporte.`,
    unknownYears: `{n} avis de taxation dans vos documents n’ont pas encore d’année fiscale${NB}: dites à Claude à quelle année chacun se rapporte.`,
    final: `Une fois votre taxation entrée en force, elle ne peut pas simplement être modifiée${NB}: une révision est refusée pour tout ce que vous auriez pu faire valoir avant, en faisant preuve de la diligence voulue.`,
    how: 'Comment c’est calculé',
    assumptions: 'Ce que Taxpresso a supposé',
    sources: 'Sources',
    page: 'page {page}',
    you: 'Vous',
    partner: 'Conjoint',
    household: 'Ménage',
    'tax.icc': 'cantonal',
    'tax.ifd': 'fédéral',
    'column.icc': 'cantonal',
    'column.ifd': 'fédéral',
    'column.total': 'cantonal et fédéral',
    'check.gross_income': 'Revenu brut (91.00)',
    'check.subtotal_9220': 'Sous-total 92.20',
    'check.subtotal_9240': 'Sous-total 92.40',
    'check.net_income': 'Revenu net total (95.00)',
    'check.taxable_income': 'Revenu imposable (99.00)',
    'check.gross_wealth': 'Fortune brute (91.00)',
    'check.net_wealth': 'Fortune nette (95.00)',
    'check.taxable_wealth': 'Fortune imposable (99.00)',
    'check.assessed_tax': 'Montant de l’impôt sur votre taxation',
    'q.professional_actual': `La déduction forfaitaire pour frais professionnels. Les frais effectifs étaient-ils plus élevés, par exemple des outils ou une cotisation syndicale${NB}?`,
    'q.commute': `Aucuns frais de déplacement. Payez-vous pour aller au travail, par exemple un abonnement de transports publics ou un vélo${NB}?`,
    'q.meals': `Aucuns frais de repas. Prenez-vous votre repas principal hors de chez vous les jours de travail${NB}?`,
    'q.childcare': `Aucuns frais de garde. Payez-vous une crèche, le parascolaire ou une personne pour garder un enfant de moins de 14 ans${NB}?`,
    'q.medical': `Aucuns frais médicaux. Les frais que votre assurance-maladie n’a pas couverts, comme le dentiste, les lunettes ou votre franchise, se sont-ils accumulés${NB}? Seule la part au-dessus d’une part de votre revenu compte.`,
    'q.donations': `Aucun don. Donnez-vous à des institutions d’utilité publique exonérées d’impôt${NB}?`,
    'q.pension_buyin': `Aucun rachat 2e pilier. Votre certificat de prévoyance indique si vous pouvez en faire un${NB}; un rachat reçu par votre caisse d’ici au 31 décembre compte pour cette année.`,
    'u.year': `Taxpresso ne recalcule qu’une déclaration 2025${NB}: ce sont les règles dont il dispose.`,
    'u.not_read':
      'Taxpresso n’a pas pu lire les pages de récapitulation (pages 2 et 3) de votre déclaration.',
    'u.income_elsewhere': `Une partie de votre revenu était imposable ailleurs (97.00)${NB}: le taux dépend d’un revenu que Taxpresso ne voit pas.`,
    'u.shield': `Le bouclier fiscal pourrait s’appliquer à vous, et Taxpresso ne le calcule pas encore${NB}; GeTax, oui.`,
    'u.ifd_shared_custody':
      'En garde alternée, on ne sait pas encore quel parent a droit au barème parental fédéral.',
    'a.year_not_printed': `Votre déclaration n’indique pas son année${NB}: prise comme celle de l’an dernier.`,
    'a.commune_from_answers': 'Votre commune telle que vous l’avez indiquée pour cette année.',
    'a.couple_from_answers': 'Votre état civil tel que vous l’avez indiqué pour cette année.',
    'a.children_from_answers': 'Vos enfants tels que vous les avez indiqués pour cette année.',
    'a.no_children_given': `Aucun enfant compté${NB}: aucun n’est indiqué dans vos réponses.`,
    'a.home_commune_only': `Tout l’impôt communal dans votre commune de domicile${NB}: Taxpresso ne garde pas où vous travailliez.`,
    'a.others_as_declared': `Chaque économie change un seul montant et garde les autres tels que déclarés, y compris les frais médicaux et les dons, dont les limites varient avec le revenu${NB}: l’économie réelle peut différer un peu.`,
    'a.pension_fund_2025_same':
      'Votre caisse de pension prise comme aujourd’hui, aussi pour l’an dernier.',
  },
  de: {
    title: 'Letztes Jahr, überprüft',
    official: 'déclaration {year}',
    noneLead:
      'Leg die Steuererklärung des Vorjahres ab (das PDF aus GeTax, der Online-Steuererklärung oder deiner Steuersoftware), und Taxpresso überprüft sie hier, auf diesem Computer: was du hättest sparen können, was du vielleicht vergessen hast, und was du noch tun kannst.',
    lead: 'Aus deiner Steuererklärung {year}, von Taxpresso auf diesem Computer gelesen, mit den Regeln von {year}. Nichts davon ändert deine Steuern {taxYear}.',
    taxTitle: 'Deine Steuern {year}, neu berechnet',
    taxOfficial: 'impôts {year}',
    total: 'Total',
    icc: 'Kantons- und Gemeindesteuer (ICC)',
    ifd: 'Direkte Bundessteuer (IFD)',
    computed: 'Berechnet',
    estimate: 'Schätzung',
    checkThis: 'Prüf das',
    taxNote:
      'Deine Steuererklärung zeigt die Steuer nicht, deine Veranlagung (bordereau) schon. Diese Zahlen stammen aus dem, was Taxpresso in deiner Steuererklärung gelesen hat.',
    allMatch:
      'Die Totale auf deiner Steuererklärung stimmen mit denen von Taxpresso überein ({n} von {n}).',
    someMatch: 'Die anderen Totale auf deiner Steuererklärung stimmen überein ({n}).',
    checkLine: '{what} ({column}): {printed} auf deiner {where}, {recomputed} neu berechnet.',
    checkWhy:
      'Vielleicht hat Taxpresso eine Zahl falsch gelesen, oder eine Regel ist noch nicht abgedeckt. Vergleiche mit der Seite deiner Steuererklärung.',
    whereDeclaration: 'Steuererklärung',
    whereAssessment: 'Veranlagung',
    needsCommune:
      'Um sie neu zu berechnen, braucht Taxpresso deine Gemeinde Ende {year}: Beantworte oben die Frage zu deiner Gemeinde.',
    needsCivil:
      'Um sie neu zu berechnen, braucht Taxpresso deinen Zivilstand Ende {year}: Beantworte oben die Frage.',
    savedTitle: 'Was du hättest sparen können',
    pillar3a: 'Säule 3a',
    pillar3aOfficial: '3e pilier A',
    paidOf: 'Du hast {paid} von {limit} eingezahlt.',
    paidOfPartner: '{paid} von {limit} eingezahlt.',
    paidAll: 'Voll eingezahlt: {limit}.',
    upTo: 'bis zu {amount}',
    withFund: 'Mit Pensionskasse (2e pilier)',
    withoutFund: 'Ohne Pensionskasse',
    fundUnknown:
      'Hattest du {year} eine Pensionskasse (2e pilier)? Dein Lohnausweis zeigt Beiträge in Feld 10.1.',
    left: 'noch {amount}',
    saved: 'Steuern, die du gespart hättest, etwa',
    noSaving: 'Taxpresso zeigt die mögliche Ersparnis, sobald es die Steuer neu berechnen kann.',
    nothingMissed: 'Taxpresso hat keine ungenutzte Säule 3a gefunden.',
    askTitle: 'Eine Frage wert',
    askLead: 'Diese waren letztes Jahr leer oder pauschal. Nur Fragen: keine Beträge.',
    stillTitle: 'Was du noch tun kannst',
    catchUp:
      'Hol {gapYear} in deiner Säule 3a nach (rachat 3a): bis zu {amount} im Jahr {year}, zusätzlich zur Einzahlung dieses Jahres.',
    catchUpFirst: 'Zahl zuerst die Säule 3a dieses Jahres voll ein.',
    catchUpEnter:
      'Deine Steuererklärung zeigt {paid} in die Säule 3a eingezahlt im Jahr {gapYear}: Trag es in der Karte zum Nachkauf ein, wenn es stimmt.',
    catchUpLink: 'Plane es, mit der Ersparnis',
    catchUpNone: 'Eine 3a-Lücke vor 2025 kann nie nachgeholt werden.',
    deadline: 'Frist für eine Einsprache (réclamation), {tax}: {date}',
    deadlinePassed: 'abgelaufen',
    deadlineNoDate:
      'Taxpresso kennt das Datum deiner Veranlagung {year} nicht: Die Einsprachefrist steht darauf.',
    deadlineNote:
      'Das Datum auf deiner Veranlagung gilt immer. Wenn du nicht einverstanden bist, schreibst du die Einsprache (réclamation) selbst; Taxpresso schickt sie nie.',
    noAssessment:
      'Wenn du deine Veranlagung {year} (avis de taxation) hast, leg sie ab: Taxpresso zeigt ihre Einsprachefrist.',
    unknownYear:
      '{n} Veranlagung in deinen Dokumenten hat noch kein Steuerjahr: Sag Claude, für welches Jahr sie ist.',
    unknownYears:
      '{n} Veranlagungen in deinen Dokumenten haben noch kein Steuerjahr: Sag Claude, für welches Jahr jede ist.',
    final:
      'Ist eine Veranlagung rechtskräftig, kann sie nicht einfach geändert werden: Eine Revision (révision) wird für alles abgelehnt, was du mit zumutbarer Sorgfalt vorher hättest geltend machen können.',
    how: 'So wird es berechnet',
    assumptions: 'Was Taxpresso angenommen hat',
    sources: 'Quellen',
    page: 'Seite {page}',
    you: 'Du',
    partner: 'Partner',
    household: 'Haushalt',
    'tax.icc': 'Kanton',
    'tax.ifd': 'Bund',
    'column.icc': 'Kanton',
    'column.ifd': 'Bund',
    'column.total': 'Kanton und Bund',
    'check.gross_income': 'Bruttoeinkommen (revenu brut, 91.00)',
    'check.subtotal_9220': 'Zwischentotal 92.20',
    'check.subtotal_9240': 'Zwischentotal 92.40',
    'check.net_income': 'Total Nettoeinkommen (revenu net total, 95.00)',
    'check.taxable_income': 'Steuerbares Einkommen (revenu imposable, 99.00)',
    'check.gross_wealth': 'Bruttovermögen (fortune brute, 91.00)',
    'check.net_wealth': 'Nettovermögen (fortune nette, 95.00)',
    'check.taxable_wealth': 'Steuerbares Vermögen (fortune imposable, 99.00)',
    'check.assessed_tax': 'Steuer auf deiner Veranlagung (montant de l’impôt)',
    'q.professional_actual':
      'Der Pauschalabzug für Berufskosten (déduction forfaitaire). Waren die tatsächlichen Kosten (frais effectifs) höher, zum Beispiel Werkzeug oder Gewerkschaftsbeiträge?',
    'q.commute':
      'Keine Fahrkosten (frais de déplacement). Zahlst du für den Arbeitsweg, zum Beispiel ein Abonnement oder ein Velo?',
    'q.meals':
      'Keine Verpflegungskosten (frais de repas). Isst du an Arbeitstagen deine Hauptmahlzeit auswärts?',
    'q.childcare':
      'Keine Kinderbetreuungskosten (frais de garde). Zahlst du für eine Krippe, eine schulergänzende Betreuung (parascolaire) oder eine Nanny für ein Kind unter 14?',
    'q.medical':
      'Keine Krankheitskosten (frais médicaux). Sind Kosten, die deine Krankenkasse nicht übernommen hat, wie Zahnarzt, Brille oder Franchise, zusammengekommen? Nur der Teil über einem Anteil deines Einkommens zählt.',
    'q.donations': 'Keine Spenden (dons). Spendest du an steuerbefreite Organisationen?',
    'q.pension_buyin':
      'Kein Einkauf in die Pensionskasse (rachat 2e pilier). Dein Vorsorgeausweis zeigt, ob du dich einkaufen kannst; ein Einkauf, den deine Kasse bis zum 31. Dezember erhält, zählt für dieses Jahr.',
    'u.year':
      'Taxpresso berechnet nur eine Steuererklärung 2025 neu: Das sind die Regeln, die es hat.',
    'u.not_read':
      'Taxpresso konnte die Übersichtsseiten (récapitulation, Seiten 2 und 3) deiner Steuererklärung nicht lesen.',
    'u.income_elsewhere':
      'Ein Teil deines Einkommens war anderswo steuerbar (97.00): Der Satz hängt von Einkommen ab, das Taxpresso nicht sieht.',
    'u.shield':
      'Der Steuerschild (bouclier fiscal) könnte für dich gelten, den Taxpresso noch nicht berechnet; GeTax schon.',
    'u.ifd_shared_custody':
      'Bei geteilter Obhut ist noch nicht bekannt, welcher Elternteil den Elterntarif der Bundessteuer erhält.',
    'a.year_not_printed': 'Deine Steuererklärung druckt ihr Jahr nicht: als Vorjahr angenommen.',
    'a.commune_from_answers': 'Deine Gemeinde, wie du sie für dieses Jahr angegeben hast.',
    'a.couple_from_answers': 'Dein Zivilstand, wie du ihn für dieses Jahr angegeben hast.',
    'a.children_from_answers': 'Deine Kinder, wie du sie für dieses Jahr angegeben hast.',
    'a.no_children_given': 'Keine Kinder gezählt: keine in deinen Antworten angegeben.',
    'a.home_commune_only':
      'Die ganze Gemeindesteuer in deiner Wohngemeinde: Taxpresso behält nicht, wo du gearbeitet hast.',
    'a.others_as_declared':
      'Jede Ersparnis ändert eine Zahl und lässt die anderen wie deklariert, auch Krankheitskosten und Spenden, deren Grenzen mit dem Einkommen gehen: Die tatsächliche Ersparnis kann etwas anders sein.',
    'a.pension_fund_2025_same': 'Deine Pensionskasse wie heute, auch für letztes Jahr.',
  },
} as const;

export type ReviewMessageKey = keyof (typeof messages)['en'];

export function tr(
  lang: Language,
  key: ReviewMessageKey,
  vars: Record<string, string | number> = {},
): string {
  return messages[lang][key].replace(/\{(\w+)\}/g, (_, name: string) => String(vars[name] ?? ''));
}

/** A key built from an id the extension sends ("q.medical"), or the id itself if unknown. */
export function trId(lang: Language, prefix: string, id: string): string {
  const key = `${prefix}.${id}`;
  return key in messages.en ? tr(lang, key as ReviewMessageKey) : id;
}
