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
    en: 'Rounding: the canton’s tariff rules round the state income tax to 5 centimes. The documents don’t say how the wealth tax, the communal tax and the church tax are rounded; Taxpresso rounds each to the nearest 5 centimes, so a bill can differ by a few centimes.',
    fr: `Arrondis${NB}: les règles du tarif arrondissent l’impôt cantonal sur le revenu à 5 centimes. Les documents ne disent pas comment l’impôt sur la fortune, l’impôt communal et l’impôt ecclésiastique sont arrondis${NB}; Taxpresso arrondit chacun aux 5 centimes les plus proches${NB}: un bordereau peut différer de quelques centimes.`,
  },
  splittingMinimum: {
    en: 'Vollsplitting (the rate of half your income): half your taxable income is under the tax-free limit, so Taxpresso applies the minimum rate to the whole income, as the law (StG § 34 Abs. 2) and the canton’s tariff tables do. The canton’s practice handbook (Steuerbuch, 34 Nr. 3) says such an income stays tax-free; the documents disagree.',
    fr: `Vollsplitting (le taux de la moitié du revenu)${NB}: la moitié de votre revenu imposable est sous la limite d’exonération, Taxpresso applique donc le taux minimal à tout le revenu, comme la loi (StG § 34 al. 2) et les tableaux du tarif du canton. Le manuel de pratique du canton (Steuerbuch, 34 Nr. 3) dit qu’un tel revenu reste exonéré${NB}; les documents divergent.`,
  },
  twoEarnerLow: {
    en: 'Both spouses work (680): the lower earned income is under CHF 1,000. The law takes the lower earned income without saying whether its professional costs come off first; Taxpresso takes the net salary and allowances as declared.',
    fr: `Activité des deux conjoints (680)${NB}: le revenu d’activité le plus bas est inférieur à CHF 1’000. La loi prend le revenu d’activité le plus bas sans dire si ses frais professionnels sont déduits d’abord${NB}; Taxpresso prend le salaire net et les indemnités tels que déclarés.`,
  },
  partyCouple: {
    en: 'Political parties (735): the law gives one total (bis zum Gesamtbetrag von CHF 10’000); Taxpresso applies it once for the couple.',
    fr: `Partis politiques (735)${NB}: la loi donne un montant total (bis zum Gesamtbetrag von CHF 10’000)${NB}; Taxpresso l’applique une fois pour le couple.`,
  },
  churchBase: {
    en: 'Church tax: the canton’s table gives the Roman Catholic church tax in percent of the state tax; Taxpresso applies it to the state tax on income and on wealth together, as the canton’s example adds the communal and church tax to the state tax.',
    fr: `Impôt ecclésiastique${NB}: le tableau du canton donne l’impôt de l’Eglise catholique romaine en pour-cent de l’impôt cantonal${NB}; Taxpresso l’applique à l’impôt cantonal sur le revenu et sur la fortune ensemble, comme l’exemple du canton ajoute l’impôt communal et ecclésiastique à l’impôt cantonal.`,
  },
  // Why the tax is not computed (unsupported).
  selfEmployed: {
    en: 'Self-employment (selbständige Erwerbstätigkeit, 150 to 165) is not supported yet: the tax is not computed.',
    fr: `L’activité indépendante (selbständige Erwerbstätigkeit, 150 à 165) n’est pas encore prise en charge${NB}: l’impôt n’est pas calculé.`,
  },
  catchUp2025: {
    en: 'A pillar 3a catch-up payment (Einkauf in die Säule 3a) is possible from tax year 2026 only.',
    fr: `Un rachat dans le pilier 3a n’est possible qu’à partir de l’année fiscale 2026.`,
  },
  childSupport: {
    en: 'Joint custody with a parent you are not taxed with: whether you receive or pay child support (Unterhaltsbeiträge) decides who counts the children. Answer the question on child support.',
    fr: `Autorité parentale conjointe avec un parent avec qui vous n’êtes pas taxé${NB}: recevoir ou verser une contribution d’entretien décide qui compte les enfants. Répondez à la question sur la contribution d’entretien.`,
  },
  mainUpkeep: {
    en: 'Joint custody without child support: the children count for the parent who mainly bears their upkeep, in practice the one with the higher income. Say whether that is you.',
    fr: `Autorité parentale conjointe sans contribution d’entretien${NB}: les enfants comptent pour le parent qui assume l’essentiel de leur entretien, en pratique celui qui a le revenu le plus élevé. Dites si c’est vous.`,
  },
  marriedShared: {
    en: 'A married couple with a child in joint custody with another parent: the documents Taxpresso has don’t say how the child counts for the couple. The tax is not computed.',
    fr: `Couple marié avec un enfant sous autorité parentale conjointe avec un autre parent${NB}: les documents dont dispose Taxpresso ne disent pas comment l’enfant compte pour le couple. L’impôt n’est pas calculé.`,
  },
  pensionKind: {
    en: 'From 2026 the pensioners’ deduction differs for AHV pensions (old age, 770) and IV pensions (disability, 771). Say which one you receive.',
    fr: `Dès 2026, la déduction pour rentiers diffère pour les rentes AVS (vieillesse, 770) et AI (invalidité, 771). Dites laquelle vous recevez.`,
  },
  pensionKindMixed: {
    en: 'Pensioners’ deduction (770, 771): one of you receives an AHV pension and the other an IV pension, and the 2026 guide doesn’t say which table applies to the couple. The tax is not computed.',
    fr: `Déduction pour rentiers (770, 771)${NB}: l’un de vous reçoit une rente AVS et l’autre une rente AI, et le guide 2026 ne dit pas quel tableau s’applique au couple. L’impôt n’est pas calculé.`,
  },
  church2025: {
    en: 'Church tax (Kirchensteuer) 2025: the documents Taxpresso has give the parishes’ rates for 2026 only. The tax is not computed for a church member; your commune’s tax office (Gemeindesteuerverwaltung) can tell you the 2025 rate.',
    fr: `Impôt ecclésiastique (Kirchensteuer) 2025${NB}: les documents dont dispose Taxpresso donnent les taux des paroisses pour 2026 seulement. L’impôt n’est pas calculé pour un membre d’une Eglise${NB}; l’administration fiscale de votre commune peut vous donner le taux 2025.`,
  },
  churchRules: {
    en: 'Church tax of the Evangelical Reformed or the Christ Catholic church: the canton’s table gives their rates in percent of the taxable income and wealth and an amount per child, but the documents Taxpresso has don’t say how the church applies them. The tax is not computed; your parish can tell you the amount.',
    fr: `Impôt de l’Eglise évangélique réformée ou catholique chrétienne${NB}: le tableau du canton donne leurs taux en pour-cent du revenu et de la fortune imposables et un montant par enfant, mais les documents dont dispose Taxpresso ne disent pas comment l’Eglise les applique. L’impôt n’est pas calculé${NB}; votre paroisse peut vous donner le montant.`,
  },
  churchMixed: {
    en: 'Church tax: you and your spouse are not members of the same church, and the documents Taxpresso has don’t say how the church tax is then shared. The tax is not computed.',
    fr: `Impôt ecclésiastique${NB}: vous et votre conjoint n’êtes pas membres de la même Eglise, et les documents dont dispose Taxpresso ne disent pas comment l’impôt ecclésiastique est alors réparti. L’impôt n’est pas calculé.`,
  },
  // What the engine assumed.
  wholeYear: {
    en: 'The commune where you lived on 31 December taxes the whole year; a move inside Basel-Landschaft does not split the communal tax.',
    fr: `La commune où vous habitiez le 31 décembre impose toute l’année${NB}; un déménagement à l’intérieur de Bâle-Campagne ne partage pas l’impôt communal.`,
  },
  insuranceFlat: {
    en: 'Insurance premiums and savings interest (620 to 630): the canton deducts the maximum whatever you paid, CHF 4,000 for a married couple and CHF 2,000 for anyone else, plus CHF 450 for each child with the child reduction.',
    fr: `Primes d’assurance et intérêts d’épargne (620 à 630)${NB}: le canton déduit le maximum quels que soient les montants payés, CHF 4’000 pour un couple marié et CHF 2’000 pour les autres, plus CHF 450 par enfant donnant droit à la réduction pour enfant.`,
  },
  childrenAtCharge: {
    en: 'Your children count for the child reduction (Kinderabzug, CHF 750 off the income tax each): they are minors, or in training or unable to work, live with you, and have no taxable income of their own above the tax-free limit, unless you said otherwise.',
    fr: `Vos enfants comptent pour la réduction pour enfant (Kinderabzug, CHF 750 de moins sur l’impôt sur le revenu chacun)${NB}: ils sont mineurs, en formation ou incapables de travailler, vivent avec vous et n’ont pas de revenu imposable propre au-dessus de la limite d’exonération, sauf si vous avez indiqué le contraire.`,
  },
  childNotWithYou: {
    en: 'A child who does not live with you gets no child reduction in Basel-Landschaft (it needs a common household); child support you pay is deducted instead (575).',
    fr: `Un enfant qui ne vit pas avec vous ne donne pas droit à la réduction pour enfant à Bâle-Campagne (il faut un ménage commun)${NB}; la contribution d’entretien versée est déduite à la place (575).`,
  },
  childOwnIncome: {
    en: 'A child with taxable income of their own above the tax-free limit gets no child reduction (StG § 34 Abs. 4).',
    fr: `Un enfant ayant un revenu imposable propre au-dessus de la limite d’exonération ne donne pas droit à la réduction pour enfant (StG § 34 al. 4).`,
  },
  childSupportReceived: {
    en: 'You receive child support: the children count for you (child reduction, Vollsplitting, the higher wealth allowance), and the support is taxed (320).',
    fr: `Vous recevez une contribution d’entretien${NB}: les enfants comptent pour vous (réduction pour enfant, Vollsplitting, montant exonéré plus élevé sur la fortune), et la contribution est imposable (320).`,
  },
  childSupportPaid: {
    en: 'You pay child support: the children count for the parent who receives it, and you deduct the support instead (575).',
    fr: `Vous versez une contribution d’entretien${NB}: les enfants comptent pour le parent qui la reçoit, et vous déduisez la contribution à la place (575).`,
  },
  mainUpkeepYes: {
    en: 'Joint custody without child support: you mainly bear the children’s upkeep, so they count for you.',
    fr: `Autorité parentale conjointe sans contribution d’entretien${NB}: vous assumez l’essentiel de l’entretien des enfants, ils comptent donc pour vous.`,
  },
  mainUpkeepNo: {
    en: 'Joint custody without child support: the other parent mainly bears the children’s upkeep, so they count for the other parent.',
    fr: `Autorité parentale conjointe sans contribution d’entretien${NB}: l’autre parent assume l’essentiel de l’entretien des enfants, ils comptent donc pour lui.`,
  },
  childcareShared: {
    en: 'Alternating custody: each parent deducts the childcare they paid (640). If you pay child support, the childcare must be paid on top of it.',
    fr: `Garde alternée${NB}: chaque parent déduit les frais de garde qu’il a payés (640). Si vous versez une contribution d’entretien, les frais de garde doivent être payés en plus de celle-ci.`,
  },
  childReductionCapped: {
    en: 'The child reduction is larger than your income tax, so your income tax is zero; the rest is lost.',
    fr: `La réduction pour enfant dépasse votre impôt sur le revenu, qui est donc nul${NB}; le solde est perdu.`,
  },
  pensions: {
    en: 'Pensions are counted as given. AHV/IV pensions are taxed in full; for a pension fund pension, give the taxable share; for a life annuity (Leibrente), its taxable income share as your insurer’s statement shows it.',
    fr: `Les rentes sont comptées telles qu’indiquées. Les rentes AVS/AI sont imposées en entier${NB}; pour une rente de caisse de pension, indiquez la part imposable${NB}; pour une rente viagère (Leibrente), sa part de rendement imposable, comme l’attestation de l’assureur la donne.`,
  },
  pensionerWealth: {
    en: 'The pensioners’ deduction (770, 771) is not given: you have taxable wealth of CHF 10,000 or more.',
    fr: `La déduction pour rentiers (770, 771) n’est pas accordée${NB}: vous avez une fortune imposable de CHF 10’000 ou plus.`,
  },
  pensionerCouple: {
    en: 'The pensioners’ deduction for a married couple needs both spouses to receive an AHV or IV pension.',
    fr: `La déduction pour rentiers d’un couple marié suppose que les deux conjoints reçoivent une rente AVS ou AI.`,
  },
  fullYear: {
    en: 'The flat professional costs are for a full year of work; for a job held part of the year, or part-time, the ordinance asks to reduce them (Verordnung § 3 Abs. 2).',
    fr: `Les déductions forfaitaires pour frais professionnels valent pour une année entière${NB}; pour une activité exercée une partie de l’année ou à temps partiel, l’ordonnance demande de les réduire (Verordnung § 3 al. 2).`,
  },
  bikeFlat: {
    en: 'Travel by bike, moped or yellow-plate motorbike: the canton’s flat amount for a full year, CHF 700.',
    fr: `Déplacements à vélo, cyclomoteur ou motocycle à plaque jaune${NB}: le forfait annuel du canton, CHF 700.`,
  },
  freeTransport: {
    en: 'Your employer provides transport to work (box F of the salary certificate): no travel costs.',
    fr: `Votre employeur fournit le transport (case F du certificat de salaire)${NB}: pas de frais de déplacement.`,
  },
  workFromHome: {
    en: 'Working from home: neither travel costs nor lunch away from home count for those days.',
    fr: `Télétravail${NB}: ni les frais de déplacement ni les repas pris à l’extérieur ne comptent pour ces jours.`,
  },
  under14: {
    en: 'Childcare: the children are taken as under 14, unless their age was given.',
    fr: `Frais de garde${NB}: les enfants sont comptés comme ayant moins de 14 ans, sauf si leur âge est indiqué.`,
  },
  childcareAge: {
    en: 'Childcare (Kinderbetreuung durch Dritte, 640) counts only up to the child’s 14th birthday (StG § 29 Abs. 1 lit. c). The costs given for a child of 14 or more at the end of the year are not counted here.',
    fr: `Les frais de garde (Kinderbetreuung durch Dritte, 640) ne comptent que jusqu’aux 14 ans de l’enfant (StG § 29 al. 1 let. c). Les frais indiqués pour un enfant de 14 ans ou plus à la fin de l’année ne sont pas comptés ici.`,
  },
  listedSecurities: {
    en: 'Accounts and securities are counted at the value and gross income you gave (the ESTV price list on 31 December).',
    fr: `Les titres et avoirs sont comptés à la valeur et au rendement brut indiqués (cours de l’AFC au 31 décembre).`,
  },
  // What is not in the calculation.
  churchNotAsked: {
    en: 'Not in this calculation: the church tax (Kirchensteuer), which members of the Roman Catholic, Evangelical Reformed or Christ Catholic church pay. Say your church to add it.',
    fr: `Pas dans ce calcul${NB}: l’impôt ecclésiastique (Kirchensteuer), dû par les membres de l’Eglise catholique romaine, évangélique réformée ou catholique chrétienne. Indiquez votre Eglise pour l’ajouter.`,
  },
  dependents: {
    en: 'Not in this calculation: the deductions for a person you support (760) or care for at home (765), which Taxpresso does not ask about yet. Supporting someone in your household also gives Vollsplitting and the higher wealth allowance.',
    fr: `Pas dans ce calcul${NB}: les déductions pour une personne que vous soutenez (760) ou soignez à domicile (765), que Taxpresso ne demande pas encore. Soutenir une personne vivant chez vous donne aussi droit au Vollsplitting et au montant exonéré plus élevé sur la fortune.`,
  },
  fireLevy: {
    en: 'Not in this calculation: the commune’s fire service levy (Feuerwehrersatzabgabe), which the commune bills on its own.',
    fr: `Pas dans ce calcul${NB}: la taxe d’exemption du service du feu de la commune (Feuerwehrersatzabgabe), facturée à part par la commune.`,
  },
  transitDetails: {
    en: 'Travel to work not counted: give what your public transport ticket cost in the year.',
    fr: `Frais de déplacement non comptés${NB}: indiquez ce que votre abonnement de transports publics a coûté dans l’année.`,
  },
  drivingDetails: {
    en: 'Travel to work by car or motorbike not counted: give the kilometres one way and the days driven, or, when public transport could be used, what it would have cost.',
    fr: `Trajets en voiture ou moto non comptés${NB}: indiquez les kilomètres aller et le nombre de jours, ou, si les transports publics pouvaient être utilisés, ce qu’ils auraient coûté.`,
  },
  childcareWork: {
    en: 'Childcare is deductible when it is needed because you work (or train, or are disabled); for a married couple, both. It is not counted here.',
    fr: `Les frais de garde sont déductibles lorsqu’ils sont nécessaires parce que vous travaillez (ou êtes en formation, ou invalide)${NB}; pour un couple marié, les deux. Ils ne sont pas comptés ici.`,
  },
  childcareSplit: {
    en: 'Childcare (Kinderbetreuung durch Dritte, 640) not computed: the limit is per child (StG § 29 Abs. 1 lit. c), and the costs you gave for the household are above one child’s limit, so how they split between your children decides the deduction. Taxpresso doesn’t compute the tax until it knows what was paid for each child.',
    fr: `Frais de garde (Kinderbetreuung durch Dritte, 640) non calculés${NB}: la limite est par enfant (StG § 29 al. 1 let. c), et les frais indiqués pour le ménage dépassent la limite d’un enfant${NB}: leur répartition entre vos enfants décide la déduction. Taxpresso ne calcule pas l’impôt avant de savoir ce qui a été payé pour chaque enfant.`,
  },
  childcareNoChild: {
    en: 'Childcare (Kinderbetreuung durch Dritte, 640): not counted, no child under 14 living with you was given.',
    fr: `Frais de garde (Kinderbetreuung durch Dritte, 640)${NB}: non comptés, aucun enfant de moins de 14 ans vivant avec vous n’est indiqué.`,
  },
} satisfies Record<string, Text>;
