// Plain-words texts the engine attaches to a result (SPEC.md section 11b: second person, plain
// words, the official term next to its gloss), so Claude can explain without stating rules from
// memory.
import type { Text } from './types.js';

const NB = ' ';

export const ESTIMATE_TEXT: Record<'input-estimate', Text> = {
  'input-estimate': {
    en: 'Some amounts you gave are estimates, so the taxes that rest on them are estimates too.',
    fr: `Certains montants indiqués sont des estimations${NB}: les impôts qui en dépendent le sont aussi.`,
  },
};

export const NOTE = {
  // Rules applied whose detail the documents don't spell out (unverifiedRules).
  rounding: {
    en: 'Rounding: the official documents Taxpresso has for Bern say that income under CHF 100 and wealth under CHF 1,000 are dropped before the tariff, but not how the cantonal, communal and church taxes are rounded. Taxpresso rounds each to the centime, so a bill can differ by a few centimes.',
    fr: `Arrondis${NB}: les documents officiels dont dispose Taxpresso pour Berne disent que le revenu sous CHF 100 et la fortune sous CHF 1’000 sont laissés de côté avant le barème, mais pas comment les impôts cantonal, communal et ecclésiastique sont arrondis. Taxpresso arrondit chacun au centime${NB}: un bordereau peut différer de quelques centimes.`,
  },
  modestSteps: {
    en: 'Modest income deduction (Abzug für bescheidene Einkommen): the law cuts it by a fixed amount per CHF 2,000 of income above the limit (StG Art. 40 Abs. 6 and 7) without saying how a part of CHF 2,000 counts. Taxpresso cuts it once per full CHF 2,000, so it can be up to one cut too high.',
    fr: `Déduction pour revenus modestes (Abzug für bescheidene Einkommen)${NB}: la loi la réduit d’un montant fixe par tranche de CHF 2’000 de revenu au-delà de la limite (LI art. 40 al. 6 et 7) sans dire comment compte une tranche entamée. Taxpresso la réduit une fois par tranche entière de CHF 2’000${NB}: elle peut être d’une réduction trop élevée.`,
  },
  insuranceFloor: {
    en: 'Insurance premiums (Versicherungsabzug): without contributions to a pension fund or pillar 3a, the law raises the fixed amount to at most a higher one (StG Art. 38 Abs. 1 lit. g Ziff. 3). You paid less than the fixed amount, and Taxpresso keeps the fixed amount, as the canton’s page describes it as a minimum.',
    fr: `Primes d’assurance (Versicherungsabzug)${NB}: sans cotisations à une caisse de pension ni au pilier 3a, la loi élève le montant fixe jusqu’à un montant plus haut (LI art. 38 al. 1 let. g ch. 3). Vous avez payé moins que le montant fixe, et Taxpresso garde le montant fixe, que la page du canton décrit comme un minimum.`,
  },
  trainingCouple: {
    en: 'Professional training: the law caps it at CHF 12,500 (StG Art. 38 Abs. 1 lit. n) and the form has a column for each spouse; Taxpresso applies the cap to each of you.',
    fr: `Formation professionnelle${NB}: la loi la plafonne à CHF 12’500 (LI art. 38 al. 1 let. n) et la formule a une colonne par époux${NB}; Taxpresso applique le plafond à chacun de vous.`,
  },
  wealthCapRounding: {
    en: 'Maximum burden (Höchstbelastung): the law does not say how the cut is rounded or shared between the canton, the commune and the church. Taxpresso shows it as one cut, to the centime.',
    fr: `Charge maximale (Höchstbelastung)${NB}: la loi ne dit pas comment la réduction est arrondie ni répartie entre le canton, la commune et l’Église. Taxpresso la montre en une seule réduction, au centime.`,
  },
  // Why the tax is not computed (unsupported).
  selfEmployed: {
    en: 'Self-employment (selbstständige Erwerbstätigkeit, form 9) is not supported yet: the tax is not computed.',
    fr: `L’activité indépendante (selbstständige Erwerbstätigkeit, formulaire 9) n’est pas encore prise en charge${NB}: l’impôt n’est pas calculé.`,
  },
  childSupport: {
    en: 'Shared parental authority: whether you receive or pay child support decides who counts the children (child deduction, tariff). Answer the question on child support.',
    fr: `Autorité parentale conjointe${NB}: recevoir ou verser une contribution d’entretien décide qui compte les enfants (déduction pour enfants, barème). Répondez à la question sur la contribution d’entretien.`,
  },
  marriedTariff: {
    en: 'Shared custody without child support: the tariff for married couples and single parents (Art. 42 Abs. 1) goes to the parent who mainly bears the children’s upkeep, and the documents Taxpresso has don’t say how Bern decides it between two households. Say whether your last assessment (Veranlagungsverfügung) applied it to you.',
    fr: `Garde partagée sans contribution d’entretien${NB}: le barème des couples mariés et des familles monoparentales (art. 42 al. 1) revient au parent qui assume l’essentiel de l’entretien des enfants, et les documents dont dispose Taxpresso ne disent pas comment Berne le décide entre deux ménages. Dites si votre dernière taxation (Veranlagungsverfügung) vous l’a appliqué.`,
  },
  sharedChildWealth: {
    en: 'Shared custody without child support: the law gives a wealth deduction per child with the child deduction (Art. 64 Abs. 1 lit. b) but does not say whether a shared child deduction gives it in full or half. Say which your last assessment (Veranlagungsverfügung) applied.',
    fr: `Garde partagée sans contribution d’entretien${NB}: la loi accorde une déduction sur la fortune par enfant donnant droit à la déduction pour enfant (art. 64 al. 1 let. b) mais ne dit pas si une déduction pour enfant partagée la donne en entier ou à moitié. Dites ce que votre dernière taxation (Veranlagungsverfügung) a appliqué.`,
  },
  ownHousehold: {
    en: 'Say whether you keep your own household alone, or only with your own children or people in need you support (form 1.2, "Führen Sie alleine einen eigenen Haushalt?"): it decides the deduction for people living alone (Abzug für Alleinstehende).',
    fr: `Dites si vous tenez seul votre propre ménage, ou seulement avec vos propres enfants ou des personnes à votre charge (formule 1.2, «${NB}Führen Sie alleine einen eigenen Haushalt?${NB}»)${NB}: cela décide la déduction pour personnes seules (Abzug für Alleinstehende).`,
  },
  part: {
    en: 'Your commune has parts whose parishes levy different church tax rates. Say which part you live in (the names are those of the canton’s table).',
    fr: `Votre commune a des parties dont les paroisses prélèvent des taux d’impôt ecclésiastique différents. Dites dans quelle partie vous habitez (les noms sont ceux du tableau du canton).`,
  },
  churchConflict: {
    en: 'Church tax not computed: the canton’s two official tables give different church tax rates for your church in your commune this year. Taxpresso does not choose between them; your commune’s tax office (Steuerbüro) can tell you the rate.',
    fr: `Impôt ecclésiastique non calculé${NB}: les deux tableaux officiels du canton donnent des taux différents pour votre Église dans votre commune cette année. Taxpresso ne choisit pas entre eux${NB}; le service des impôts de votre commune (Steuerbüro) peut vous indiquer le taux.`,
  },
  churchMixed: {
    en: 'Church tax not computed: when only one spouse belongs to a church with a church tax, or each to a different one, the Kirchensteuergesetz decides how the tax is shared, and Taxpresso does not have it yet.',
    fr: `Impôt ecclésiastique non calculé${NB}: quand un seul des époux appartient à une Église prélevant un impôt, ou chacun à une Église différente, la loi sur les impôts paroissiaux (Kirchensteuergesetz) décide du partage, et Taxpresso ne l’a pas encore.`,
  },
  churchForCap: {
    en: 'Your wealth tax may be cut by the maximum burden (Höchstbelastung, Art. 66), which counts the church tax too. Say whether you pay church tax, and to which church.',
    fr: `Votre impôt sur la fortune peut être réduit par la charge maximale (Höchstbelastung, art. 66), qui compte aussi l’impôt ecclésiastique. Dites si vous payez l’impôt ecclésiastique, et à quelle Église.`,
  },
  catchUp2025: {
    en: 'A pillar 3a catch-up payment (Einkauf in die Säule 3a) is possible from tax year 2026 only, for gaps from 2025.',
    fr: `Un rachat dans le pilier 3a (Einkauf in die Säule 3a) n’est possible qu’à partir de l’année fiscale 2026, pour des lacunes dès 2025.`,
  },
  twoEarnerBuyIn: {
    en: 'Two-earner deduction (Zweiverdienerabzug) not computed: it may not exceed the lower earned income less certain contributions, and the law counts pension fund buy-ins among them (StG Art. 38 Abs. 2 lit. a, Abs. 1 lit. d) while the canton’s practice page leaves them out ("ohne Einkauf"). With your buy-in the two give different amounts.',
    fr: `Déduction pour double revenu (Zweiverdienerabzug) non calculée${NB}: elle ne peut dépasser le plus bas des revenus du travail moins certaines cotisations, et la loi y compte les rachats de prévoyance (LI art. 38 al. 2 let. a, al. 1 let. d) alors que la page de pratique du canton les exclut («${NB}ohne Einkauf${NB}»). Avec votre rachat, les deux donnent des montants différents.`,
  },
  partySplit: {
    en: 'Payments to political parties: the limit is CHF 5,300 per person, so for more than that, say how much each of you paid.',
    fr: `Versements aux partis politiques${NB}: la limite est de CHF 5’300 par personne${NB}; au-delà, dites combien chacun de vous a versé.`,
  },
  // What the engine assumed.
  pensions100: {
    en: 'Pensions are counted as given. The canton taxes pension fund pensions at 100 %; for a life annuity (Leibrente), give only its taxable income share, as your insurer’s statement shows it (Wegleitung 2025, Seite 104).',
    fr: `Les rentes sont comptées telles qu’indiquées. Le canton impose les rentes de caisse de pension à 100${NB}%${NB}; pour une rente viagère (Leibrente), indiquez seulement sa part de rendement imposable, comme l’attestation de l’assureur la donne (Wegleitung 2025, Seite 104).`,
  },
  days220: {
    en: 'Driving to work: more than 220 working days. The guide takes 220 days for a full year of full-time work as a rule (Wegleitung 2025, Seite 179); be ready to explain more.',
    fr: `Trajets en voiture${NB}: plus de 220 jours de travail. Le guide compte en règle générale 220 jours pour une année entière à plein temps (Wegleitung 2025, Seite 179)${NB}; soyez prêt à justifier davantage.`,
  },
  transitPrice: {
    en: 'Travel to work not counted: when public transport can be used, the deduction is what it costs (or would cost). Give that price.',
    fr: `Frais de déplacement non comptés${NB}: si les transports publics sont utilisables, la déduction est ce qu’ils coûtent (ou coûteraient). Indiquez ce prix.`,
  },
  drivingDetails: {
    en: 'Travel to work by car or motorbike not counted: give the kilometres one way and the days driven.',
    fr: `Trajets en voiture ou moto non comptés${NB}: indiquez les kilomètres aller et le nombre de jours.`,
  },
  freeTransport: {
    en: 'Your employer provides transport to work (box F of the salary certificate): no travel costs.',
    fr: `Votre employeur fournit le transport (case F du certificat de salaire)${NB}: pas de frais de déplacement.`,
  },
  workFromHome: {
    en: 'Working from home: neither travel costs nor meals away from home count for those days.',
    fr: `Télétravail${NB}: ni les frais de déplacement ni les repas pris à l’extérieur ne comptent pour ces jours.`,
  },
  actualCosts: {
    en: 'Other professional costs: your actual costs are higher than the 3 % flat amount and are used instead; they must be listed and proven in full.',
    fr: `Autres frais professionnels${NB}: vos frais effectifs dépassent le forfait de 3${NB}% et le remplacent${NB}; ils doivent être listés et entièrement justifiés.`,
  },
  costCap: {
    en: 'Professional costs are deductible at most up to the net salary (Wegleitung 2025, Seite 175): Taxpresso cut the other costs first, then meals, then travel.',
    fr: `Les frais professionnels ne sont déductibles qu’à hauteur du salaire net (Wegleitung 2025, Seite 175)${NB}: Taxpresso a réduit d’abord les autres frais, puis les repas, puis les déplacements.`,
  },
  partTime: {
    en: 'The flat amounts for professional costs are for a full year of full-time work; the ordinance reduces them "appropriately" for part of a year or part-time work without saying how (BKV Art. 6 Abs. 3), so they are counted in full.',
    fr: `Les forfaits pour frais professionnels valent pour une année entière à plein temps${NB}; l’ordonnance les réduit «${NB}de manière appropriée${NB}» pour une partie de l’année ou un temps partiel sans dire comment (BKV art. 6 al. 3), ils sont donc comptés en entier.`,
  },
  pillar3aAbove: {
    en: 'Pillar 3a: what you paid above the limit is not deductible.',
    fr: `Pilier 3a${NB}: ce que vous avez versé au-delà du plafond n’est pas déductible.`,
  },
  childcareSplit: {
    en: 'Childcare (Kinderdrittbetreuungskosten) not computed: the limit is per child (StG Art. 38 Abs. 1 lit. l), and the costs you gave for the household are above one child’s limit, so how they split between your children decides the deduction. Taxpresso doesn’t compute the tax until it knows what was paid for each child.',
    fr: `Frais de garde (Kinderdrittbetreuungskosten) non calculés${NB}: la limite est par enfant (LI art. 38 al. 1 let. l), et les frais indiqués pour le ménage dépassent la limite d’un enfant${NB}: leur répartition entre vos enfants décide la déduction. Taxpresso ne calcule pas l’impôt avant de savoir ce qui a été payé pour chaque enfant.`,
  },
  childcareNoChild: {
    en: 'Childcare (Kinderdrittbetreuungskosten): not counted, no child under 14 living with you was given.',
    fr: `Frais de garde (Kinderdrittbetreuungskosten)${NB}: non comptés, aucun enfant de moins de 14 ans vivant avec vous n’est indiqué.`,
  },
  childcareWork: {
    en: 'Childcare (Kinderdrittbetreuung) is deductible only when the parents caring for the child work, train or can’t work; for a married couple, both. It is not counted here.',
    fr: `Les frais de garde (Kinderdrittbetreuung) ne sont déductibles que si les parents qui s’occupent de l’enfant travaillent, se forment ou sont incapables de travailler${NB}; pour un couple marié, les deux. Ils ne sont pas comptés ici.`,
  },
  under14: {
    en: 'Childcare: the children are taken as under 14, unless their age was given.',
    fr: `Frais de garde${NB}: les enfants sont comptés comme ayant moins de 14 ans, sauf si leur âge est indiqué.`,
  },
  sharedChildcare: {
    en: 'Childcare for a child living with each parent in turn: each parent deducts what they paid, at most half the limit per child (the two together at most the limit).',
    fr: `Frais de garde d’un enfant vivant tour à tour chez chaque parent${NB}: chacun déduit ce qu’il a payé, au plus la moitié du plafond par enfant (les deux ensemble au plus le plafond).`,
  },
  childSupportPaid: {
    en: 'You pay child support: the children count for the parent who receives it, and you deduct the support instead (StG Art. 40 Abs. 4).',
    fr: `Vous versez une contribution d’entretien${NB}: les enfants comptent pour le parent qui la reçoit, et vous déduisez la contribution à la place (LI art. 40 al. 4).`,
  },
  singleParentFull: {
    en: 'Single parent: the amount per child for living alone with your children (CHF 1,300) is counted in full for a child whose deduction you share; the law halves only the child-related deductions it lists (StG Art. 40 Abs. 8).',
    fr: `Parent seul${NB}: le montant par enfant pour un ménage tenu seul avec vos enfants (CHF 1’300) est compté en entier pour un enfant dont vous partagez la déduction${NB}; la loi ne réduit de moitié que les déductions liées aux enfants qu’elle énumère (LI art. 40 al. 8).`,
  },
  wealthCapChurch: {
    en: 'Maximum burden (Höchstbelastung): the church tax you said you pay is counted in the comparison, as the law asks.',
    fr: `Charge maximale (Höchstbelastung)${NB}: l’impôt ecclésiastique que vous avez indiqué est compté dans la comparaison, comme la loi le demande.`,
  },
  // What is not in the calculation.
  medicalBelow: {
    en: 'Medical costs: below 5 % of the net income (Reineinkommen), nothing is deductible.',
    fr: `Frais médicaux${NB}: en dessous de 5${NB}% du revenu net (Reineinkommen), rien n’est déductible.`,
  },
  donationsMin: {
    en: 'Donations: under CHF 100 in the year, nothing is deductible.',
    fr: `Dons${NB}: en dessous de CHF 100 dans l’année, rien n’est déductible.`,
  },
  fireLevy: {
    en: 'Not in this calculation: the fire service replacement levy (Feuerwehrdienstersatzabgabe) your commune may charge. The guide lists it among the facts the commune’s register gives (Wegleitung 2025, Seite 9); the documents Taxpresso has don’t give its amounts.',
    fr: `Pas dans ce calcul${NB}: la taxe d’exemption du service du feu (Feuerwehrdienstersatzabgabe) que votre commune peut prélever. Le guide la range parmi les données du registre de la commune (Wegleitung 2025, Seite 9)${NB}; les documents dont dispose Taxpresso n’en donnent pas les montants.`,
  },
} satisfies Record<string, Text>;
