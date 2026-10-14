// Plain-words texts the engine attaches to a result (SPEC.md section 11b: second person, plain
// words, the official term next to its gloss), so Claude can explain without stating rules from
// memory. "Wegleitung 2025" is lu-2025-guide-wegleitung; the 2026 guide has the same pages.
import type { Text } from './types.js';

const NB = ' ';

export const ESTIMATE_TEXT: Record<'input-estimate', Text> = {
  'input-estimate': {
    en: 'Some amounts you gave are estimates, so the taxes that rest on them are estimates too.',
    fr: `Certains montants indiqués sont des estimations${NB}: les impôts qui en dépendent le sont aussi.`,
  },
};

export const NOTE = {
  // Rules applied whose detail the documents don't spell out (unverifiedRules).
  rounding: {
    en: 'Rounding: the documents Taxpresso has for Lucerne say that income under CHF 100 and wealth under CHF 1,000 are dropped (StG § 57 Abs. 3, § 60 Abs. 2), but not how the tax per unit times the units is rounded: the guide’s own examples round CHF 2,201.50 x 3.75 = 8,255.625 up to 8,255.65 and CHF 55.50 x 3.75 = 208.125 down to 208.10 (Wegleitung 2025, p. 58 and 60). Taxpresso rounds each tax to the centime, and the shares of the deductions (3 %, 5 %, 14 %, 20 %) to the franc, so a bill can differ by a few centimes.',
    fr: `Arrondis${NB}: les documents dont dispose Taxpresso pour Lucerne disent que le revenu sous CHF 100 et la fortune sous CHF 1’000 sont laissés de côté (StG § 57 al. 3, § 60 al. 2), mais pas comment l’impôt par unité multiplié par les unités est arrondi${NB}: les exemples du guide arrondissent CHF 2’201.50 x 3,75 = 8’255.625 vers le haut à 8’255.65 et CHF 55.50 x 3,75 = 208.125 vers le bas à 208.10 (Wegleitung 2025, p. 58 et 60). Taxpresso arrondit chaque impôt au centime, et les parts des déductions (3${NB}%, 5${NB}%, 14${NB}%, 20${NB}%) au franc${NB}: un bordereau peut différer de quelques centimes.`,
  },
  churchShares: {
    en: 'Church tax (Kirchensteuer): your family’s members belong to different churches, or not all to one. The law shares the church tax in proportion of each church’s members to all the family’s members (StG § 240 Abs. 2); Taxpresso counts you, your spouse and the children on your return, as the return asks each one’s confession, and applies each church’s units to its share. The documents give no worked example.',
    fr: `Impôt ecclésiastique (Kirchensteuer)${NB}: les membres de votre famille appartiennent à des Églises différentes, ou pas tous à une Église. La loi partage l’impôt en proportion des membres de chaque Église parmi tous les membres de la famille (StG § 240 al. 2)${NB}; Taxpresso compte vous, votre conjoint et les enfants de votre déclaration, dont la déclaration demande la confession, et applique les unités de chaque Église à sa part. Les documents ne donnent pas d’exemple chiffré.`,
  },
  capShare: {
    en: 'Maximum burden (Höchstbelastung, StG § 62): the documents don’t say how the cut is rounded or shared between the state, the commune and the parish. Taxpresso shows it as one cut, to the centime.',
    fr: `Charge maximale (Höchstbelastung, StG § 62)${NB}: les documents ne disent pas comment la réduction est arrondie ni répartie entre l’État, la commune et la paroisse. Taxpresso la montre en une seule réduction, au centime.`,
  },
  childcareCap: {
    en: 'Childcare by others (Fremdbetreuungskosten): the law counts them up to CHF 20,000 in § 40 Abs. 1 lit. l but, in § 42 Abs. 1 lit. b, raises the own care amount to at most CHF 20,000 with them. Taxpresso follows § 42 with the Steuerbuch and the guide: own care plus childcare at most that amount (CHF 18,000 of childcare on top of own care in 2025, 18,200 in 2026).',
    fr: `Frais de garde par des tiers (Fremdbetreuungskosten)${NB}: la loi les compte jusqu’à CHF 20’000 au § 40 al. 1 let. l mais, au § 42 al. 1 let. b, élève avec eux la déduction pour garde par les parents à CHF 20’000 au plus. Taxpresso suit le § 42 avec le Steuerbuch et le guide${NB}: garde par les parents et frais de garde au plus ce montant (CHF 18’000 de frais de garde en plus en 2025, 18’200 en 2026).`,
  },
  trainingCouple: {
    en: 'Professional training: the law caps it at CHF 13,000 (StG § 40 Abs. 1 lit. m) and the form has a line for each spouse (Ziffer 248 and 249); Taxpresso applies the cap to each of you.',
    fr: `Formation professionnelle${NB}: la loi la plafonne à CHF 13’000 (StG § 40 al. 1 let. m) et la formule a une ligne par époux (Ziffer 248 et 249)${NB}; Taxpresso applique le plafond à chacun de vous.`,
  },
  // Why the tax is not computed (unsupported).
  selfEmployed: {
    en: 'Self-employment (selbständige Erwerbstätigkeit, Ziffer 110 to 119) is not supported yet: the tax is not computed.',
    fr: `L’activité indépendante (selbständige Erwerbstätigkeit, Ziffer 110 à 119) n’est pas encore prise en charge${NB}: l’impôt n’est pas calculé.`,
  },
  catchUp: {
    en: 'A pillar 3a catch-up payment (Einkauf in die Säule 3a) was given, and no Lucerne document Taxpresso has says how it is deducted: the tax is not computed. Your commune’s tax office (Gemeindesteueramt) can tell you.',
    fr: `Un rachat dans le pilier 3a (Einkauf in die Säule 3a) est indiqué, et aucun document lucernois dont dispose Taxpresso ne dit comment il se déduit${NB}: l’impôt n’est pas calculé. Le service des impôts de votre commune (Gemeindesteueramt) peut vous renseigner.`,
  },
  childSupport: {
    en: 'Shared parental authority: whether you receive or pay child support decides who counts the children (child deduction, family tariff). Answer the question on child support.',
    fr: `Autorité parentale conjointe${NB}: recevoir ou verser une contribution d’entretien décide qui compte les enfants (déduction pour enfants, barème des familles). Répondez à la question sur la contribution d’entretien.`,
  },
  familyTariff: {
    en: 'Shared custody without child support: the family tariff (Familientarif, StG § 57 Abs. 2) goes to the parent who cares for the children longer, or, at equal time, earns more; living with the other parent, to the one who bears more of their costs (Wegleitung 2025, p. 20). Say whether that is you.',
    fr: `Garde partagée sans contribution d’entretien${NB}: le barème des familles (Familientarif, StG § 57 al. 2) revient au parent qui s’occupe le plus longtemps des enfants ou, à temps égal, gagne le plus${NB}; en vivant avec l’autre parent, à celui qui assume la plus grande part de leurs frais (Wegleitung 2025, p. 20). Dites si c’est vous.`,
  },
  under14: {
    en: 'Say for each child living with you whether they were still under 14 at the end of the year: it decides the deduction for own care (Abzug für Eigenbetreuung, Ziffer 353).',
    fr: `Dites pour chaque enfant vivant avec vous s’il avait encore moins de 14 ans à la fin de l’année${NB}: cela décide la déduction pour garde par les parents (Abzug für Eigenbetreuung, Ziffer 353).`,
  },
  childConfession: {
    en: 'Church tax: say each child’s confession too (the return asks it, page 1 Ziffer 3): when the members of a family belong to different churches, the law shares the church tax among them (StG § 240 Abs. 2).',
    fr: `Impôt ecclésiastique${NB}: indiquez aussi la confession de chaque enfant (la déclaration la demande, page 1 Ziffer 3)${NB}: quand les membres d’une famille appartiennent à des Églises différentes, la loi partage l’impôt ecclésiastique entre elles (StG § 240 al. 2).`,
  },
  churchForCap: {
    en: 'Your income or wealth tax may be cut by the maximum burden (Höchstbelastung, StG § 62), which counts the church tax too. Say whether you pay church tax, and to which church.',
    fr: `Votre impôt sur le revenu ou la fortune peut être réduit par la charge maximale (Höchstbelastung, StG § 62), qui compte aussi l’impôt ecclésiastique. Dites si vous payez l’impôt ecclésiastique, et à quelle Église.`,
  },
  trainingBase: {
    en: 'Medical costs or donations not computed: the law takes their limit from the income after the deductions up to § 40 Abs. 1 lit. g, so before professional training (StG § 40 Abs. 1 lit. h and i), while the form and the guide take it from the Nettoeinkommen (Ziffer 310), after training. With your training costs the two give different amounts; your commune’s tax office (Gemeindesteueramt) can tell you which applies.',
    fr: `Frais médicaux ou dons non calculés${NB}: la loi prend leur limite sur le revenu après les déductions jusqu’au § 40 al. 1 let. g, donc avant la formation professionnelle (StG § 40 al. 1 let. h et i), alors que la formule et le guide la prennent sur le revenu net (Ziffer 310), après la formation. Avec vos frais de formation, les deux donnent des montants différents${NB}; le service des impôts de votre commune (Gemeindesteueramt) peut vous dire lequel s’applique.`,
  },
  // What the engine assumed.
  pensions100: {
    en: 'Pension fund pensions (Renten/Pensionen, Ziffer 132/133) are counted in full, as most are. A pension that began before 2002 under a pension relationship that existed at the end of 1986 can be taxed at 60 % or 80 % (Wegleitung 2025, p. 22): then give only the taxable part.',
    fr: `Les rentes de prévoyance (Renten/Pensionen, Ziffer 132/133) sont comptées en entier, comme la plupart. Une rente ayant commencé avant 2002 sur un rapport de prévoyance existant fin 1986 peut être imposée à 60${NB}% ou 80${NB}% (Wegleitung 2025, p. 22)${NB}: indiquez alors seulement la part imposable.`,
  },
  otherPensions: {
    en: 'Other pensions are counted in full (übrige Renten, Ziffer 136/137). A life annuity (Leibrente, Ziffer 134/135) is not covered: the 2025 law taxes 40 % of it (StG § 29 Abs. 3) while the 2025 guide taxes its income share (Wegleitung 2025, p. 22).',
    fr: `Les autres rentes sont comptées en entier (übrige Renten, Ziffer 136/137). Une rente viagère (Leibrente, Ziffer 134/135) n’est pas couverte${NB}: la loi de 2025 en impose 40${NB}% (StG § 29 al. 3) alors que le guide 2025 impose sa part de rendement (Wegleitung 2025, p. 22).`,
  },
  days220: {
    en: 'Driving to work: more than 220 working days. The Steuerbuch takes 220 days for a year as a rule (§ 33 Nr. 1); be ready to explain more.',
    fr: `Trajets en voiture${NB}: plus de 220 jours de travail. Le Steuerbuch compte en règle générale 220 jours par an (§ 33 Nr. 1)${NB}; soyez prêt à justifier davantage.`,
  },
  freeTransport: {
    en: 'Your employer provides transport to work or a company car (box F of the salary certificate): no travel costs.',
    fr: `Votre employeur fournit le transport ou une voiture de service (case F du certificat de salaire)${NB}: pas de frais de déplacement.`,
  },
  workFromHome: {
    en: 'Working from home: neither travel costs nor meals away from home count for those days.',
    fr: `Télétravail${NB}: ni les frais de déplacement ni les repas pris à l’extérieur ne comptent pour ces jours.`,
  },
  actualCosts: {
    en: 'Other professional costs: your actual costs are higher than the 3 % flat amount and are used instead; they must be listed and proven in full (Wegleitung 2025, p. 28).',
    fr: `Autres frais professionnels${NB}: vos frais effectifs dépassent le forfait de 3${NB}% et le remplacent${NB}; ils doivent être listés et entièrement justifiés (Wegleitung 2025, p. 28).`,
  },
  partYear: {
    en: 'The flat amounts for professional costs are for a full year of work: for part of a year they are reduced by whole months (Wegleitung 2025, p. 28; Steuerbuch § 33 Nr. 3). Taxpresso counts a full year.',
    fr: `Les forfaits pour frais professionnels valent pour une année entière de travail${NB}: pour une partie de l’année, ils sont réduits par mois entiers (Wegleitung 2025, p. 28${NB}; Steuerbuch § 33 Nr. 3). Taxpresso compte une année entière.`,
  },
  flatReplacement: {
    en: 'Other professional costs: the 3 % flat amount is taken on your net salary and your daily allowances or unemployment benefits together, as the Steuerbuch counts them like a salary (§ 33 Nr. 3), and never above them.',
    fr: `Autres frais professionnels${NB}: le forfait de 3${NB}% est pris sur votre salaire net et vos indemnités journalières ou de chômage ensemble, que le Steuerbuch compte comme un salaire (§ 33 Nr. 3), et jamais au-delà.`,
  },
  assetFlat: {
    en: 'Costs of keeping securities and accounts: the flat amount (0.3 % of their tax value up to CHF 3 million, at most their income) is taken on all the accounts and securities you gave; it does not apply to loans and unlisted private shares (Wegleitung 2025, p. 40).',
    fr: `Frais de gestion des titres et avoirs${NB}: le forfait (0,3${NB}% de leur valeur fiscale jusqu’à CHF 3 millions, au plus leur rendement) est pris sur tous les comptes et titres indiqués${NB}; il ne s’applique pas aux prêts ni aux participations privées non cotées (Wegleitung 2025, p. 40).`,
  },
  assetActual: {
    en: 'Costs of keeping securities and accounts: the costs you gave are higher than the flat amount and are used instead; both what you paid and that it is deductible must be proven (Wegleitung 2025, p. 40).',
    fr: `Frais de gestion des titres et avoirs${NB}: les frais indiqués dépassent le forfait et le remplacent${NB}; il faut prouver ce qui a été payé et que c’est déductible (Wegleitung 2025, p. 40).`,
  },
  personalTax: {
    en: 'The Personalsteuer of CHF 50 (StG § 232) is counted once for your return: you are taken as 18 or older and not exempt for need (§ 231).',
    fr: `La Personalsteuer de CHF 50 (StG § 232) est comptée une fois pour votre déclaration${NB}: vous êtes considéré comme ayant 18 ans ou plus et non exonéré pour indigence (§ 231).`,
  },
  childSupportPaid: {
    en: 'You pay child support: the children count for the parent who receives it, and you deduct the support instead (Steuerbuch § 42 Nr. 2, Kumulationsverbot).',
    fr: `Vous versez une contribution d’entretien${NB}: les enfants comptent pour le parent qui la reçoit, et vous déduisez la contribution à la place (Steuerbuch § 42 Nr. 2, Kumulationsverbot).`,
  },
  sharedCare: {
    en: 'A child living with each parent in turn: each parent deducts CHF 1,000 for own care and their childcare costs up to the limit for each parent (StV § 14b), as when both parents qualify; a different split must be proven.',
    fr: `Enfant vivant tour à tour chez chaque parent${NB}: chaque parent déduit CHF 1’000 pour la garde par les parents et ses frais de garde jusqu’à la limite de chaque parent (StV § 14b), comme lorsque les deux parents y ont droit${NB}; une autre répartition doit être prouvée.`,
  },
  receivesShared: {
    en: 'Shared custody with child support received: the child counts in full for you, own care and childcare included. If the child lives with each of you in turn, each parent has half of those two (StV § 14b).',
    fr: `Garde partagée avec contribution d’entretien reçue${NB}: l’enfant compte en entier pour vous, garde par les parents et frais de garde compris. S’il vit tour à tour chez chacun de vous, chaque parent a la moitié de ces deux déductions (StV § 14b).`,
  },
  childAway: {
    en: 'A child in education who stays away from home for it all the time has the higher child deduction (Ziffer 352), when the stay is due to the education (Steuerbuch § 42 Nr. 2).',
    fr: `Un enfant en formation qui doit pour cela séjourner en permanence hors du domicile a la déduction pour enfant plus élevée (Ziffer 352), si le séjour est dû à la formation (Steuerbuch § 42 Nr. 2).`,
  },
  // What is not in the calculation.
  transitPrice: {
    en: 'Travel to work not counted: when public transport can be used, the deduction is what it costs (or would cost). Give that price.',
    fr: `Frais de déplacement non comptés${NB}: si les transports publics sont utilisables, la déduction est ce qu’ils coûtent (ou coûteraient). Indiquez ce prix.`,
  },
  drivingDetails: {
    en: 'Travel to work by car or motorbike not counted: give the kilometres one way and the days driven.',
    fr: `Trajets en voiture ou moto non comptés${NB}: indiquez les kilomètres aller et le nombre de jours.`,
  },
  pillar3aAbove: {
    en: 'Pillar 3a: what you paid above the limit is not deductible.',
    fr: `Pilier 3a${NB}: ce que vous avez versé au-delà du plafond n’est pas déductible.`,
  },
  childcareWork: {
    en: 'Childcare by others (Fremdbetreuungskosten) is deductible only when it is due to work or education (StG § 42 Abs. 1 lit. b); for a married couple Taxpresso counts it when both of you earn. It is not counted here; costs due to an inability to work have no limit and are not covered.',
    fr: `Les frais de garde par des tiers (Fremdbetreuungskosten) ne sont déductibles que s’ils sont dus à une activité ou une formation (StG § 42 al. 1 let. b)${NB}; pour un couple marié, Taxpresso les compte quand vous gagnez tous deux un revenu. Ils ne sont pas comptés ici${NB}; les frais dus à une incapacité de travail n’ont pas de limite et ne sont pas couverts.`,
  },
  medicalBelow: {
    en: 'Medical costs: below 5 % of the net income (Nettoeinkommen, Ziffer 310), nothing is deductible.',
    fr: `Frais médicaux${NB}: en dessous de 5${NB}% du revenu net (Nettoeinkommen, Ziffer 310), rien n’est déductible.`,
  },
  donationsMin: {
    en: 'Donations: under CHF 100 in the year, nothing is deductible.',
    fr: `Dons${NB}: en dessous de CHF 100 dans l’année, rien n’est déductible.`,
  },
  fireLevy: {
    en: 'Not in this calculation: the fire service replacement levy (Feuerwehrersatzabgabe) your commune may charge. The documents Taxpresso has give its amount only for people taxed at source (CHF 100 a year, Steuerbuch Band 2).',
    fr: `Pas dans ce calcul${NB}: la taxe d’exemption du service du feu (Feuerwehrersatzabgabe) que votre commune peut prélever. Les documents dont dispose Taxpresso n’en donnent le montant que pour les personnes imposées à la source (CHF 100 par an, Steuerbuch Band 2).`,
  },
} satisfies Record<string, Text>;
