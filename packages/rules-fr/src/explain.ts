// Plain-words texts the engine attaches to a result (SPEC.md section 11b: second person, plain
// words, the official French term next to its gloss), so Claude can explain without stating rules
// from memory.
import type { Text } from './types.js';

const NB = '\u00a0';

export const ESTIMATE_TEXT: Record<'input-estimate', Text> = {
  'input-estimate': {
    en: 'Some amounts you gave are estimates, so the taxes that rest on them are estimates too.',
    fr: `Certains montants indiqués sont des estimations${NB}: les impôts qui en dépendent le sont aussi.`,
  },
};

export const NOTE = {
  // Rules applied whose detail the documents don't spell out (unverifiedRules).
  rounding: {
    en: 'Rounding: the base tax is the one the canton’s detailed tariff prints, to 5 centimes. Taxpresso rounds the cantonal tax (96 % of it on income), the communal tax and the church tax each to the nearest 5 centimes, which the documents don’t state, so a bill can differ by a few centimes.',
    fr: `Arrondis${NB}: l’impôt de base est celui du barème détaillé du canton, à 5 centimes. Taxpresso arrondit l’impôt cantonal (96${NB}% de celui-ci sur le revenu), l’impôt communal et l’impôt ecclésiastique chacun aux 5 centimes les plus proches, ce que les documents ne précisent pas${NB}: un bordereau peut différer de quelques centimes.`,
  },
  sharedCustody: {
    en: 'Alternating custody: the canton’s source-tax documents give the child (the child deduction and the reduced rate) to the parent who receives child support, and none to the parent who pays it. Taxpresso applies the same to your return; the law and the guide don’t spell it out.',
    fr: `Garde alternée${NB}: les documents du canton sur l’impôt à la source attribuent l’enfant (la déduction pour enfant et le taux réduit) au parent qui reçoit la contribution d’entretien, et pas au parent qui la verse. Taxpresso applique la même règle à votre déclaration${NB}; la loi et le guide ne le précisent pas.`,
  },
  partyCouple: {
    en: 'Political parties: the law and the guide give one amount (LICD art. 34 al. 1 let. i); Taxpresso applies it once for the couple.',
    fr: `Partis politiques${NB}: la loi et le guide donnent un seul montant (LICD art. 34 al. 1 let. i)${NB}; Taxpresso l’applique une fois pour le couple.`,
  },
  trainingCouple: {
    en: 'Professional training: the law and the guide give one amount (LICD art. 34 al. 1 let. j); Taxpresso applies it to each spouse.',
    fr: `Formation et perfectionnement${NB}: la loi et le guide donnent un seul montant (LICD art. 34 al. 1 let. j)${NB}; Taxpresso l’applique à chaque conjoint.`,
  },
  // Why the tax is not computed (unsupported).
  communes2026: {
    en: 'Tax year 2026: Fribourg’s communal tax rates for 2026 (coefficients communaux) aren’t published yet, so Taxpresso doesn’t estimate your tax: your estimate comes once they are, in a Taxpresso update (node scripts/fr-communes.mjs adds them). Taxpresso never guesses a rate. Your questions, your documents and the values to type on your return don’t need them and work already.',
    fr: `Année fiscale 2026${NB}: les coefficients d’impôt communaux 2026 de Fribourg ne sont pas encore publiés, Taxpresso n’estime donc pas votre impôt${NB}: votre estimation viendra dès leur publication, avec une mise à jour de Taxpresso (node scripts/fr-communes.mjs les ajoute). Taxpresso ne devine jamais un coefficient. Vos questions, vos documents et les valeurs à saisir dans votre déclaration n’en ont pas besoin et fonctionnent déjà.`,
    de: 'Steuerjahr 2026: Die Gemeindesteuerfüsse 2026 von Freiburg (coefficients communaux, Gemeindesteuerkoeffizienten) sind noch nicht veröffentlicht, deshalb schätzt Taxpresso deine Steuer nicht: Deine Schätzung kommt, sobald sie veröffentlicht sind, mit einem Update von Taxpresso (node scripts/fr-communes.mjs fügt sie hinzu). Taxpresso rät nie einen Steuerfuss. Deine Fragen, deine Dokumente und die Werte für deine Steuererklärung brauchen sie nicht und funktionieren schon.',
  },
  selfEmployed: {
    en: 'Self-employment (activité indépendante, codes 1.210 and 1.220) is not supported yet: the tax is not computed.',
    fr: `L’activité indépendante (codes 1.210 et 1.220) n’est pas encore prise en charge${NB}: l’impôt n’est pas calculé.`,
  },
  catchUp2025: {
    en: 'A pillar 3a catch-up payment (rachat 3a) is possible from tax year 2026 only.',
    fr: `Un rachat dans le pilier 3a n’est possible qu’à partir de l’année fiscale 2026.`,
  },
  childSupport: {
    en: 'Alternating custody (garde alternée): whether you receive or pay child support (contribution d’entretien) decides who counts the children. Answer the question on child support.',
    fr: `Garde alternée${NB}: recevoir ou verser une contribution d’entretien décide qui compte les enfants. Répondez à la question sur la contribution d’entretien.`,
  },
  sharedNoSupport: {
    en: 'Alternating custody without child support: the documents differ. The law splits the child deduction in proportion to the upkeep each parent bears (LICD art. 36 al. 3) without saying how, while the canton’s source-tax documents give the child to the parent with the higher income. The tax is not computed.',
    fr: `Garde alternée sans contribution d’entretien${NB}: les documents divergent. La loi répartit la déduction pour enfant proportionnellement à la charge de chaque parent (LICD art. 36 al. 3) sans dire comment, alors que les documents du canton sur l’impôt à la source attribuent l’enfant au parent dont le revenu est le plus élevé. L’impôt n’est pas calculé.`,
  },
  marriedShared: {
    en: 'A married couple with a child in alternating custody with another parent: the documents Taxpresso has don’t say how the child counts for the couple. The tax is not computed.',
    fr: `Couple marié avec un enfant en garde alternée avec un autre parent${NB}: les documents dont dispose Taxpresso ne disent pas comment l’enfant compte pour le couple. L’impôt n’est pas calculé.`,
  },
  childcarePays: {
    en: 'Childcare for a child who counts for the other parent (you pay child support): the documents don’t say whether you can deduct it. The tax is not computed.',
    fr: `Frais de garde d’un enfant qui compte pour l’autre parent (vous versez une contribution d’entretien)${NB}: les documents ne disent pas si vous pouvez les déduire. L’impôt n’est pas calculé.`,
  },
  adultChild: {
    en: 'A child over 25 at your charge: the health insurance flat amount (code 4.110) has no category for them in the documents. The tax is not computed.',
    fr: `Enfant de plus de 25 ans à charge${NB}: les documents ne prévoient pas de catégorie pour lui dans la déduction forfaitaire d’assurance-maladie (code 4.110). L’impôt n’est pas calculé.`,
  },
  avsCouple: {
    en: 'Modest income deduction (code 7.110): one of you receives AVS/AI benefits and the other doesn’t, and the documents don’t say which amount applies to the couple, which changes your deduction. The tax is not computed.',
    fr: `Déduction pour revenu modeste (code 7.110)${NB}: l’un de vous reçoit des prestations AVS/AI et l’autre non, et les documents ne disent pas quel montant s’applique au couple, ce qui change votre déduction. L’impôt n’est pas calculé.`,
  },
  lowSalary: {
    en: 'Other professional costs (code 2.130): your net salary is below the CHF 2,000 minimum of the flat amount, and the documents don’t say whether the flat amount can exceed the salary. The tax is not computed.',
    fr: `Autres frais professionnels (code 2.130)${NB}: votre salaire net est inférieur au minimum de CHF 2’000 de la déduction forfaitaire, et les documents ne disent pas si celle-ci peut dépasser le salaire. L’impôt n’est pas calculé.`,
  },
  churchMixed: {
    en: 'Church tax: you and your spouse are not members of the same church, and the documents Taxpresso has don’t say how the church tax is then shared. The tax is not computed.',
    fr: `Impôt ecclésiastique${NB}: vous et votre conjoint n’êtes pas membres de la même Eglise, et les documents dont dispose Taxpresso ne disent pas comment l’impôt ecclésiastique est alors réparti. L’impôt n’est pas calculé.`,
  },
  parish: {
    en: 'Church tax: your commune has several parishes of your church with different coefficients. Say which parish you belong to.',
    fr: `Impôt ecclésiastique${NB}: votre commune compte plusieurs paroisses de votre Eglise avec des coefficients différents. Dites de quelle paroisse vous faites partie.`,
  },
  // What the engine assumed.
  healthFlat: {
    en: 'Health and accident insurance (code 4.110): the deduction is a flat amount per insured person, whatever premiums you paid, less any premium subsidy (réduction de primes).',
    fr: `Caisse-maladie et accidents (code 4.110)${NB}: la déduction est un montant forfaitaire par personne assurée, quelles que soient les primes payées, moins les éventuels subsides (réduction de primes).`,
  },
  pensions: {
    en: 'Pensions are counted as given. AVS/AI and pension fund pensions are taxed in full; for a life annuity (rente viagère), give only its taxable income share, as your insurer’s statement shows it.',
    fr: `Les rentes sont comptées telles qu’indiquées. Les rentes AVS/AI et de la prévoyance professionnelle sont imposées en entier${NB}; pour une rente viagère, indiquez seulement sa part de rendement imposable, comme l’attestation de l’assureur la donne.`,
  },
  childrenAtCharge: {
    en: 'Your children count as at your charge: you bear the main part of their upkeep (LICD art. 37 al. 3). The reduced rate for single parents needs at least one of them to live with you.',
    fr: `Vos enfants comptent comme étant à votre charge${NB}: vous assumez pour l’essentiel leur entretien (LICD art. 37 al. 3). Le taux réduit des familles monoparentales suppose qu’au moins l’un d’eux vive avec vous.`,
  },
  childSupportPaid: {
    en: 'You pay child support: the children count for the parent who receives it, and you deduct the support instead (code 4.340).',
    fr: `Vous versez une contribution d’entretien${NB}: les enfants comptent pour le parent qui la reçoit, et vous déduisez la contribution à la place (code 4.340).`,
  },
  childSupportReceived: {
    en: 'You receive child support: the children count in full for you, and the support is taxed (code 3.150).',
    fr: `Vous recevez une contribution d’entretien${NB}: les enfants comptent entièrement pour vous, et la contribution est imposable (code 3.150).`,
  },
  partYear: {
    en: 'Travel and lunch are for a full year of 220 working days; for fewer days given, the yearly amounts are cut in proportion.',
    fr: `Les déplacements et les repas valent pour une année de 220 jours de travail${NB}; pour moins de jours indiqués, les montants annuels sont réduits en proportion.`,
  },
  daysCapped: {
    en: 'Travel to work counts at most 220 working days a year.',
    fr: `Les trajets comptent au plus 220 jours de travail par an.`,
  },
  freeTransport: {
    en: 'Your employer provides transport to work (box F of the salary certificate): no travel costs.',
    fr: `Votre employeur fournit le transport (case F du certificat de salaire)${NB}: pas de frais de déplacement.`,
  },
  workFromHome: {
    en: 'Working from home: neither travel costs nor lunch away from home count for those days.',
    fr: `Télétravail${NB}: ni les frais de déplacement ni les repas pris à l’extérieur ne comptent pour ces jours.`,
  },
  actualCosts: {
    en: 'Other professional costs: your actual costs are higher than the 3 % flat amount and are used instead; they must be proven on request.',
    fr: `Autres frais professionnels${NB}: vos frais effectifs dépassent le forfait de 3${NB}% et le remplacent${NB}; ils doivent être justifiés sur demande.`,
  },
  fullYear: {
    en: 'The flat professional costs are for a full year of work; for a job held part of the year, the guide asks to reduce them.',
    fr: `La déduction forfaitaire pour frais professionnels vaut pour une année entière${NB}; pour une activité exercée une partie de l’année, le guide demande de la réduire.`,
  },
  under14: {
    en: 'Childcare: the children are taken as under 14, unless their age was given.',
    fr: `Frais de garde${NB}: les enfants sont comptés comme ayant moins de 14 ans, sauf si leur âge est indiqué.`,
  },
  wholeYear: {
    en: 'You lived in the same Fribourg commune all year. After a move between Fribourg communes, each commune taxes its share of the year (LICo art. 9 al. 2), which Taxpresso does not compute yet.',
    fr: `Vous avez habité la même commune fribourgeoise toute l’année. Après un déménagement entre communes fribourgeoises, chaque commune impose sa part de l’année (LICo art. 9 al. 2), ce que Taxpresso ne calcule pas encore.`,
  },
  listedSecurities: {
    en: 'Accounts and securities are taken as accounts and listed securities. Shares not listed on a stock exchange (code 3.250) have a reduced wealth tax rate, which is not applied here.',
    fr: `Les titres et placements sont comptés comme des comptes et des titres cotés. Les titres non cotés (code 3.250) bénéficient d’un taux réduit de l’impôt sur la fortune, non appliqué ici.`,
  },
  // What is not in the calculation.
  churchNotAsked: {
    en: 'Not in this calculation: the church tax (impôt ecclésiastique), which members of the Roman Catholic or Evangelical Reformed church pay. Say your church to add it.',
    fr: `Pas dans ce calcul${NB}: l’impôt ecclésiastique, dû par les membres de l’Eglise catholique romaine ou évangélique réformée. Indiquez votre Eglise pour l’ajouter.`,
  },
  dependents: {
    en: 'Not in this calculation: the deductions for another person you support (6.120), for a taxpayer in training up to 25 (6.130), in a wheelchair or orphaned (6.140), and for home care allowances (6.145), which Taxpresso does not ask about yet.',
    fr: `Pas dans ce calcul${NB}: les déductions pour personne nécessiteuse à charge (6.120), pour contribuable aux études ou en apprentissage jusqu’à 25 ans (6.130), en fauteuil roulant ou orphelin (6.140) et pour les soins à domicile (6.145), que Taxpresso ne demande pas encore.`,
  },
  transitDetails: {
    en: 'Travel to work not counted: give what the trip cost a year by public transport (2nd class).',
    fr: `Frais de transport non comptés${NB}: indiquez ce que le trajet a coûté par an en transports publics (2e classe).`,
  },
  drivingDetails: {
    en: 'Travel to work by car or motorbike not counted: give the kilometres one way and the days driven, or, when public transport could be used, what it would have cost.',
    fr: `Trajets en voiture ou moto non comptés${NB}: indiquez les kilomètres aller et le nombre de jours, ou, si les transports publics pouvaient être utilisés, ce qu’ils auraient coûté.`,
  },
  childcareWork: {
    en: 'Childcare is deductible only when you work (or train, or receive an AI pension); for a married couple, both. It is not counted here.',
    fr: `Les frais de garde ne sont déductibles que si vous travaillez (ou suivez une formation, ou touchez une rente AI)${NB}; pour un couple marié, les deux. Ils ne sont pas comptés ici.`,
  },
  medicalBelow: {
    en: 'Medical costs: below 5 % of the net income (code 4.910), nothing is deductible.',
    fr: `Frais médicaux${NB}: en dessous de 5${NB}% du revenu net (code 4.910), rien n’est déductible.`,
  },
  donationsMin: {
    en: 'Donations: under CHF 100 in the year, nothing is deductible.',
    fr: `Dons${NB}: en dessous de CHF 100 dans l’année, rien n’est déductible.`,
  },
  savingsAbove: {
    en: 'Interest on savings (code 4.150): the deduction is never more than the income of the accounts and securities (code 3.210); the interest you gave is above it, so only that income counts.',
    fr: `Intérêts de capitaux d’épargne (code 4.150)${NB}: la déduction ne dépasse jamais le rendement des titres et placements (code 3.210)${NB}; les intérêts indiqués le dépassent, seul ce rendement compte donc.`,
  },
  childcareNotCounted: {
    en: 'Childcare (frais de garde, code 4.380) counts only for a child under 14 living with you: the costs you gave for another child are not counted.',
    fr: `Les frais de garde (code 4.380) ne comptent que pour un enfant de moins de 14 ans vivant avec vous${NB}: les frais indiqués pour un autre enfant ne sont pas comptés.`,
  },
  childcareSplit: {
    en: 'Childcare (frais de garde, code 4.380) not computed: the limit is per child under 14 living with you (LICD art. 34 al. 3). The costs you gave for the household are above one child’s limit, so how they split between your children decides the deduction. Taxpresso doesn’t compute the tax until it knows what was paid for each child.',
    fr: `Frais de garde (code 4.380) non calculés${NB}: la limite est par enfant de moins de 14 ans vivant avec vous (LICD art. 34 al. 3). Les frais indiqués pour le ménage dépassent la limite d’un enfant${NB}: leur répartition entre vos enfants décide la déduction. Taxpresso ne calcule pas l’impôt avant de savoir ce qui a été payé pour chaque enfant.`,
  },
  savingsNoIncome: {
    en: 'Interest on savings (code 4.150): only deductible when the accounts and securities have an income; none was given.',
    fr: `Intérêts de capitaux d’épargne (code 4.150)${NB}: déductibles seulement si les titres et placements ont un rendement${NB}; aucun n’est indiqué.`,
  },
} satisfies Record<string, Text>;
