// Plain-words texts the engine attaches to a result (SPEC.md section 11b: second person, plain
// words, the official term next to its gloss), so Claude can explain without stating rules from
// memory.
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
    en: 'Rounding: the official documents Taxpresso has for Aargau say that income under CHF 100 and wealth under CHF 1,000 are dropped and that the simple income tax (einfache Steuer) is rounded down to the franc, but not how the cantonal, communal and church taxes are rounded. Taxpresso rounds each to 10 centimes, as the guide’s worked example does (Wegleitung 2025, Anhang II), so a bill can differ by a few centimes.',
    fr: `Arrondis${NB}: les documents officiels dont dispose Taxpresso pour Argovie disent que le revenu sous CHF 100 et la fortune sous CHF 1’000 sont laissés de côté et que l’impôt simple sur le revenu (einfache Steuer) est arrondi au franc inférieur, mais pas comment les impôts cantonal, communal et ecclésiastique sont arrondis. Taxpresso arrondit chacun à 10 centimes, comme l’exemple du guide (Wegleitung 2025, Anhang II)${NB}: un bordereau peut différer de quelques centimes.`,
  },
  medicalRounding: {
    en: 'Medical costs (Krankheitskosten): the guide computes the own share (Selbstbehalt) as the net income x 5 : 95 without saying how it is rounded; Taxpresso takes it to the franc.',
    fr: `Frais médicaux (Krankheitskosten)${NB}: le guide calcule la part à charge (Selbstbehalt) comme le revenu net x 5 : 95 sans dire comment elle est arrondie${NB}; Taxpresso la prend au franc.`,
  },
  medicalOrder: {
    en: 'Medical costs and donations: the law takes the own share of medical costs on the income less the deductions of §§ 35 to 40, without donations (§ 40a), and caps donations at 20 % of the income after the medical costs; the guide’s form lists donations (15.3) before the medical costs (17) and does not say whether its net income (Ziffer 20) includes them. Taxpresso follows the law.',
    fr: `Frais médicaux et dons${NB}: la loi calcule la part à charge des frais médicaux sur le revenu moins les déductions des §§ 35 à 40, sans les dons (§ 40a), et plafonne les dons à 20${NB}% du revenu après les frais médicaux${NB}; la formule du guide place les dons (15.3) avant les frais médicaux (17) et ne dit pas si son revenu net (Ziffer 20) les inclut. Taxpresso suit la loi.`,
  },
  maxBurdenRounding: {
    en: 'Maximum burden (Höchstbelastung): the law does not say how the cut is rounded or shared between the canton, the commune and the church. Taxpresso shows it as one cut, to the centime, and reads "jedoch höchstens auf die Hälfte der geschuldeten Vermögenssteuern" (StG § 56 Abs. 1) as: the cut is at most half of the wealth taxes.',
    fr: `Charge maximale (Höchstbelastung)${NB}: la loi ne dit pas comment la réduction est arrondie ni répartie entre le canton, la commune et l’Église. Taxpresso la montre en une seule réduction, au centime, et lit «${NB}jedoch höchstens auf die Hälfte der geschuldeten Vermögenssteuern${NB}» (LI § 56 al. 1) ainsi${NB}: la réduction est au plus la moitié des impôts sur la fortune.`,
  },
  // Why the tax is not computed (unsupported).
  selfEmployed: {
    en: 'Self-employment (selbstständige Erwerbstätigkeit) is not supported yet: the tax is not computed.',
    fr: `L’activité indépendante (selbstständige Erwerbstätigkeit) n’est pas encore prise en charge${NB}: l’impôt n’est pas calculé.`,
  },
  childSupport: {
    en: 'Shared parental authority: whether you receive or pay child support decides who counts the children (child deduction, Tarif B). Answer the question on child support.',
    fr: `Autorité parentale conjointe${NB}: recevoir ou verser une contribution d’entretien décide qui compte les enfants (déduction pour enfants, Tarif B). Répondez à la question sur la contribution d’entretien.`,
  },
  mainUpkeep: {
    en: 'Shared parental authority without child support: the child deduction and Tarif B go to the parent who mainly bears the children’s upkeep (Wegleitung 2025, 19.1). Say whether that is you.',
    fr: `Autorité parentale conjointe sans contribution d’entretien${NB}: la déduction pour enfants et le Tarif B reviennent au parent qui assume l’essentiel de l’entretien des enfants (Wegleitung 2025, 19.1). Dites si c’est vous.`,
  },
  coupleShared: {
    en: 'A married couple with a child whose parental authority is shared with a parent outside the household is not supported yet: who counts that child is not computed.',
    fr: `Un couple marié avec un enfant dont l’autorité parentale est partagée avec un parent hors du ménage n’est pas encore pris en charge${NB}: qui compte cet enfant n’est pas calculé.`,
  },
  childBand: {
    en: 'Say how old each child was at the end of the year (under 14, 14 to 17, or of age and in education): the child deduction (Kinderabzug) depends on it.',
    fr: `Dites quel âge avait chaque enfant à la fin de l’année (moins de 14 ans, 14 à 17 ans, ou majeur en formation)${NB}: la déduction pour enfants (Kinderabzug) en dépend.`,
  },
  parish: {
    en: 'Your commune has a further parish of your church (Zusatzkirche) with its own church tax rate. Say which parish you belong to (the names are those of the canton’s list).',
    fr: `Votre commune a une paroisse supplémentaire de votre Église (Zusatzkirche) avec son propre taux d’impôt ecclésiastique. Dites à quelle paroisse vous appartenez (les noms sont ceux de la liste du canton).`,
  },
  churchMixed: {
    en: 'Church tax not computed: when the spouses belong to different churches, or only one to a church, the law shares the church tax by the number of family members of each confession (StG § 154 Abs. 3), and the documents Taxpresso has don’t say how members without a church and children count.',
    fr: `Impôt ecclésiastique non calculé${NB}: quand les époux appartiennent à des Églises différentes, ou un seul à une Église, la loi partage l’impôt selon le nombre de membres de la famille de chaque confession (LI § 154 al. 3), et les documents dont dispose Taxpresso ne disent pas comment comptent les membres sans Église et les enfants.`,
  },
  churchForCap: {
    en: 'Your taxes may be cut by the maximum burden (Höchstbelastung, StG § 56), which counts the church tax too. Say whether you pay church tax, and to which church.',
    fr: `Vos impôts peuvent être réduits par la charge maximale (Höchstbelastung, LI § 56), qui compte aussi l’impôt ecclésiastique. Dites si vous payez l’impôt ecclésiastique, et à quelle Église.`,
  },
  lowIncomeStep: {
    en: 'Your income is just above a step of the low-income deduction (zusätzlicher Sozialabzug für tiefe Einkommen). The law says the marginal tax burden at a step never exceeds 100 % (StG § 43 Abs. 3) but not how this is applied, so the tax is not computed. Your commune’s tax office (Gemeindesteueramt) can tell you.',
    fr: `Votre revenu dépasse de peu un palier de la déduction supplémentaire pour revenus modestes (zusätzlicher Sozialabzug für tiefe Einkommen). La loi dit que la charge marginale à un palier ne dépasse jamais 100${NB}% (LI § 43 al. 3) mais pas comment l’appliquer${NB}: l’impôt n’est pas calculé. Le service des impôts de votre commune (Gemeindesteueramt) peut vous renseigner.`,
  },
  costsAboveSalary: {
    en: 'Your professional costs are higher than your net salary, and the documents Taxpresso has for Aargau don’t say whether they are cut to it: the tax is not computed.',
    fr: `Vos frais professionnels dépassent votre salaire net, et les documents dont dispose Taxpresso pour Argovie ne disent pas s’ils y sont ramenés${NB}: l’impôt n’est pas calculé.`,
  },
  catchUp2025: {
    en: 'A pillar 3a catch-up payment (Einkauf in die Säule 3a) is possible from tax year 2026 only, for gaps from 2025.',
    fr: `Un rachat dans le pilier 3a (Einkauf in die Säule 3a) n’est possible qu’à partir de l’année fiscale 2026, pour des lacunes dès 2025.`,
  },
  // What the engine assumed.
  insuranceFlat: {
    en: 'Insurance premiums and savings interest (Versicherungsprämien und Zinsen von Sparkapitalien): Aargau grants a flat amount whatever you paid, so the premiums you gave don’t change it.',
    fr: `Primes d’assurance et intérêts d’épargne (Versicherungsprämien und Zinsen von Sparkapitalien)${NB}: Argovie accorde un forfait quel que soit le montant payé${NB}; les primes indiquées ne le changent pas.`,
  },
  pensions: {
    en: 'Pensions are counted as given: pension fund pensions in full (80 % only for some pensions that began before 2002), and for a life annuity (Leibrente) only its taxable income share (Wegleitung 2025, section 3).',
    fr: `Les rentes sont comptées telles qu’indiquées${NB}: les rentes de caisse de pension en entier (80${NB}% seulement pour certaines rentes ayant commencé avant 2002), et pour une rente viagère (Leibrente) seulement sa part de rendement imposable (Wegleitung 2025, section 3).`,
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
  driving: {
    en: 'Driving to work: the car or motorbike counts only when public transport can’t reasonably be used (no connection, more than an hour a day saved, required by your employer, or health); otherwise the public transport price counts (Wegleitung 2025, 10.1).',
    fr: `Trajets en voiture ou moto${NB}: ils ne comptent que si les transports publics ne sont pas raisonnablement utilisables (pas de liaison, plus d’une heure gagnée par jour, exigence de l’employeur ou santé)${NB}; sinon, c’est le prix des transports publics qui compte (Wegleitung 2025, 10.1).`,
  },
  pillar3aEarned: {
    en: 'Pillar 3a: the deduction is at most your earned income after professional costs (Wegleitung 2025, 13.2), so part of what you paid is not deductible.',
    fr: `Pilier 3a${NB}: la déduction est au plus le revenu d’activité après frais professionnels (Wegleitung 2025, 13.2)${NB}; une partie de ce que vous avez versé n’est pas déductible.`,
  },
  pillar3aAbove: {
    en: 'Pillar 3a: what you paid above the limit is not deductible.',
    fr: `Pilier 3a${NB}: ce que vous avez versé au-delà du plafond n’est pas déductible.`,
  },
  childcareWork: {
    en: 'Childcare (Kinderbetreuungskosten) is deductible only when the parents caring for the child work, train or can’t work; for a married couple, both at the same time. It is not counted here.',
    fr: `Les frais de garde (Kinderbetreuungskosten) ne sont déductibles que si les parents qui s’occupent de l’enfant travaillent, se forment ou sont incapables de travailler${NB}; pour un couple marié, les deux en même temps. Ils ne sont pas comptés ici.`,
  },
  childcareYear: {
    en: 'Childcare: the limit per child is for a full year of work or training; for part of the year it is cut in proportion (Wegleitung 2025, 15.0). Taxpresso takes a full year.',
    fr: `Frais de garde${NB}: le plafond par enfant vaut pour une année entière d’activité ou de formation${NB}; pour une partie de l’année, il est réduit en proportion (Wegleitung 2025, 15.0). Taxpresso compte une année entière.`,
  },
  childcareOver14: {
    en: 'Childcare is deductible for children under 14 only; for a child who turned 14 during the year, the costs up to the end of the birthday month count in proportion (Merkblatt Kinderbetreuungskosten, 3.4). It is not counted here.',
    fr: `Les frais de garde ne sont déductibles que pour les enfants de moins de 14 ans${NB}; pour un enfant qui a eu 14 ans dans l’année, les frais jusqu’à la fin du mois de son anniversaire comptent en proportion (Merkblatt Kinderbetreuungskosten, 3.4). Ils ne sont pas comptés ici.`,
  },
  under14: {
    en: 'Childcare: the children are taken as under 14, unless their age was given.',
    fr: `Frais de garde${NB}: les enfants sont comptés comme ayant moins de 14 ans, sauf si leur âge est indiqué.`,
  },
  sharedChildcare: {
    en: 'Childcare for a child whose parents live apart and share authority or custody: each parent deducts what they paid, at most CHF 12,500 per child, unless you ask for another split and prove it (Merkblatt Kinderbetreuungskosten, 4.7).',
    fr: `Frais de garde d’un enfant dont les parents vivent séparés et partagent l’autorité ou la garde${NB}: chacun déduit ce qu’il a payé, au plus CHF 12’500 par enfant, sauf autre répartition demandée et prouvée (Merkblatt Kinderbetreuungskosten, 4.7).`,
  },
  childSupportPaid: {
    en: 'You pay child support: the children count for the parent who receives it, and you deduct the support instead (Wegleitung 2025, 19.1).',
    fr: `Vous versez une contribution d’entretien${NB}: les enfants comptent pour le parent qui la reçoit, et vous déduisez la contribution à la place (Wegleitung 2025, 19.1).`,
  },
  notMainUpkeep: {
    en: 'You don’t mainly bear the children’s upkeep: the child deduction and Tarif B go to the other parent (Wegleitung 2025, 19.1).',
    fr: `Vous n’assumez pas l’essentiel de l’entretien des enfants${NB}: la déduction pour enfants et le Tarif B reviennent à l’autre parent (Wegleitung 2025, 19.1).`,
  },
  childrenChurch: {
    en: 'Church tax: your children are taken to belong to your church. A family of several confessions shares the church tax by the number of members of each (StG § 154 Abs. 3).',
    fr: `Impôt ecclésiastique${NB}: vos enfants sont comptés comme membres de votre Église. Une famille de plusieurs confessions partage l’impôt selon le nombre de membres de chacune (LI § 154 al. 3).`,
  },
  maxBurdenChurch: {
    en: 'Maximum burden (Höchstbelastung): the church tax you said you pay is counted, as the law asks.',
    fr: `Charge maximale (Höchstbelastung)${NB}: l’impôt ecclésiastique que vous avez indiqué est compté, comme la loi le demande.`,
  },
  // What is not in the calculation.
  donationsMin: {
    en: 'Donations: under CHF 100 in the year, nothing is deductible.',
    fr: `Dons${NB}: en dessous de CHF 100 dans l’année, rien n’est déductible.`,
  },
  medicalBelow: {
    en: 'Medical costs: below the own share (Selbstbehalt, 5 % of the net income), nothing is deductible.',
    fr: `Frais médicaux${NB}: en dessous de la part à charge (Selbstbehalt, 5${NB}% du revenu net), rien n’est déductible.`,
  },
  transitPrice: {
    en: 'Travel to work not counted: when public transport can be used, the deduction is what it costs (or would cost). Give that price.',
    fr: `Frais de déplacement non comptés${NB}: si les transports publics sont utilisables, la déduction est ce qu’ils coûtent (ou coûteraient). Indiquez ce prix.`,
  },
  drivingDetails: {
    en: 'Travel to work by car or motorbike not counted: give the kilometres one way and the days driven.',
    fr: `Trajets en voiture ou moto non comptés${NB}: indiquez les kilomètres aller et le nombre de jours.`,
  },
  fireLevy: {
    en: 'Not in this calculation: the fire service replacement levy (Feuerwehrpflicht-Ersatzabgabe), 2 per mille of the taxable income, at least CHF 30 and at most CHF 300, for people of service age who don’t serve; years of service count, in a way the guide does not detail (Wegleitung 2025, Anhang III).',
    fr: `Pas dans ce calcul${NB}: la taxe d’exemption du service du feu (Feuerwehrpflicht-Ersatzabgabe), 2 pour mille du revenu imposable, au moins CHF 30 et au plus CHF 300, pour les personnes en âge de servir qui ne servent pas${NB}; les années de service comptent, d’une façon que le guide ne détaille pas (Wegleitung 2025, Anhang III).`,
  },
  unionDues: {
    en: 'Not in this calculation: membership fees to professional associations, deductible up to CHF 300 a year besides the flat amount (Wegleitung 2025, 10.5).',
    fr: `Pas dans ce calcul${NB}: les cotisations à des associations professionnelles, déductibles jusqu’à CHF 300 par an en plus du forfait (Wegleitung 2025, 10.5).`,
  },
} satisfies Record<string, Text>;
