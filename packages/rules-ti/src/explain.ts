// Plain-words texts the engine attaches to a result (SPEC.md section 11b: second person, plain
// words, the official term next to its gloss; Ticino's official terms are Italian), so Claude can
// explain without stating rules from memory.
import type { Text } from './types.js';

const NB = '\u00a0';

/** Why a figure can be an estimate. No Ticino constant is one: only amounts given as estimates. */
export const ESTIMATE_TEXT: Record<'input-estimate', Text> = {
  'input-estimate': {
    en: 'Some amounts you gave are estimates, so the taxes that rest on them are estimates too.',
    fr: `Certains montants indiqués sont des estimations${NB}: les impôts qui en dépendent le sont aussi.`,
  },
};

export const NOTE = {
  // Rules applied whose detail the documents don't spell out (unverifiedRules).
  tariffLine: {
    en: 'Tariff: the tax law gives the tax at the top of each income band and the rate of each band (LT art. 35). Between two of those amounts Taxpresso draws a straight line, to 5 centimes. The canton’s own 2025 table (Istruzioni p. 51) differs from it by 5 to 50 centimes at some incomes, because the canton’s method between those amounts is not published.',
    fr: `Barème${NB}: la loi fiscale donne l’impôt au sommet de chaque tranche de revenu et le taux de chaque tranche (LT art. 35). Entre deux de ces montants, Taxpresso trace une droite, à 5 centimes près. Le tableau 2025 du canton (Istruzioni p. 51) en diffère de 5 à 50 centimes pour certains revenus, car la méthode du canton entre ces montants n’est pas publiée.`,
  },
  rounding: {
    en: 'Rounding: the documents don’t say how the 5 % threshold for illness costs, the 20 % cap on donations and the communal tax are rounded. Taxpresso rounds the shares of income to the franc and the communal tax to 5 centimes, so a bill can differ by a few centimes.',
    fr: `Arrondis${NB}: les documents ne disent pas comment arrondir le seuil de 5${NB}% des frais de maladie, le plafond de 20${NB}% des dons et l’impôt communal. Taxpresso arrondit les parts du revenu au franc et l’impôt communal à 5 centimes${NB}: un bordereau peut différer de quelques centimes.`,
  },
  sharedTariff: {
    en: 'A child in shared custody without child support lives with you and you provide for it, so Taxpresso applies the family tariff (LT art. 35 cpv. 2) to you. The documents don’t address shared custody for the tariff in so many words.',
    fr: `Un enfant en garde partagée sans contribution d’entretien vit avec vous et vous pourvoyez à son entretien${NB}: Taxpresso vous applique donc le barème familial (LT art. 35 cpv. 2). Les documents ne traitent pas expressément la garde partagée pour le barème.`,
  },
  sharedInsurance: {
    en: 'For a child in shared custody without child support, the law halves the child deduction (LT art. 34 cpv. 1 lett. a) but says nothing of halving the CHF 1,200 added to the insurance cap (art. 32 cpv. 1bis): Taxpresso adds it in full.',
    fr: `Pour un enfant en garde partagée sans contribution d’entretien, la loi partage par moitié la déduction pour enfant (LT art. 34 cpv. 1 lett. a), mais ne dit rien d’un partage des CHF 1’200 ajoutés au plafond des assurances (art. 32 cpv. 1bis)${NB}: Taxpresso les ajoute en entier.`,
  },
  // What the engine was told to assume (assumptions).
  adults: {
    en: 'Each of you is 18 or older, so each pays the communal personal tax (imposta personale, CHF 40).',
    fr: `Chacun de vous a 18 ans ou plus et paie donc l’impôt personnel communal (imposta personale, CHF 40).`,
  },
  fullYear: {
    en: 'You worked the whole year: the flat amounts for professional costs are for a full year, and in proportion for part of it (Modulo 4, cifra 1).',
    fr: `Vous avez travaillé toute l’année${NB}: les forfaits des frais professionnels valent pour une année entière, et au prorata pour une partie (Modulo 4, cifra 1).`,
  },
  canteen: {
    en: 'Your certificate shows a canteen or meal vouchers (box G): meals count at half the rate (CHF 7.50 a day, at most CHF 1,600).',
    fr: `Votre certificat indique une cantine ou des bons de repas (case G)${NB}: les repas comptent à moitié (CHF 7.50 par jour, au plus CHF 1’600).`,
  },
  freeTransport: {
    en: 'Your employer provides the transport to work (box F): no travel costs.',
    fr: `Votre employeur fournit le transport au travail (case F)${NB}: pas de frais de transport.`,
  },
  workFromHome: {
    en: 'You work from home: no travel costs and no meals away from home.',
    fr: `Vous travaillez à domicile${NB}: pas de frais de transport ni de repas hors du domicile.`,
  },
  replacement: {
    en: 'Daily allowances not on a salary certificate are put on 3.5 (sickness and accident insurance), unemployment benefits on 3.4. The tax is the same either way.',
    fr: `Les indemnités journalières hors certificat de salaire vont sous 3.5 (assurance maladie et accident), les indemnités de chômage sous 3.4. L’impôt est le même dans les deux cas.`,
  },
  lifeAnnuity: {
    en: 'Other pensions are taken as given. For a life annuity, give the taxable part the insurer certifies (quota di reddito imponibile), as asked from 2025.',
    fr: `Les autres rentes sont prises telles quelles. Pour une rente viagère, indiquez la part imposable attestée par l’assureur (quota di reddito imponibile), comme demandé dès 2025.`,
  },
  receivesSupport: {
    en: 'You receive child support for the children in shared custody: they count in full for you (the deduction is shared only without child support).',
    fr: `Vous recevez une contribution d’entretien pour les enfants en garde partagée${NB}: ils comptent entièrement pour vous (la déduction n’est partagée que sans contribution).`,
  },
  paysSupport: {
    en: 'You pay child support for the children in shared custody: they count for the other parent, and you deduct what you pay (cifra 14.2).',
    fr: `Vous versez une contribution d’entretien pour les enfants en garde partagée${NB}: ils comptent pour l’autre parent, et vous déduisez ce que vous versez (cifra 14.2).`,
  },
  sharedHalf: {
    en: 'Shared custody without child support: the child deduction is shared half and half with the other parent (LT art. 34 cpv. 1 lett. a).',
    fr: `Garde partagée sans contribution d’entretien${NB}: la déduction pour enfant est partagée par moitié avec l’autre parent (LT art. 34 cpv. 1 lett. a).`,
  },
  under14: {
    en: 'The children with childcare are taken as under 14 at the end of the year.',
    fr: `Les enfants gardés sont considérés comme ayant moins de 14 ans à la fin de l’année.`,
  },
  daysCapped: {
    en: 'Travel by car counts at most 220 working days a year for a full-time job (Istruzioni p. 23).',
    fr: `Le trajet en voiture compte au plus 220 jours de travail par an pour un plein temps (Istruzioni p. 23).`,
  },
  wealthChildLeftOut: {
    en: 'The wealth deduction per minor child (35.2, CHF 30,000) for a child in shared custody, or whose age is not given, is not settled by the documents. With your figures it does not change the tax, so it is left out.',
    fr: `La déduction de fortune par enfant mineur (35.2, CHF 30’000) pour un enfant en garde partagée, ou dont l’âge n’est pas indiqué, n’est pas tranchée par les documents. Avec vos chiffres, elle ne change pas l’impôt${NB}: elle est laissée de côté.`,
  },
  // What is not in the calculation (notCounted).
  notAsked: {
    en: 'Not in this calculation because Taxpresso does not ask about them yet: children in education (25.2, CHF 1,300 to 13,900), dependants (25.3), disability costs (15.1), permanent charges and annuities you pay (14.3, 14.4).',
    fr: `Pas dans ce calcul, car Taxpresso ne les demande pas encore${NB}: enfants aux études (25.2, CHF 1’300 à 13’900), personnes à charge (25.3), frais liés au handicap (15.1), charges durables et rentes versées (14.3, 14.4).`,
  },
  church: {
    en: 'Church tax: the canton’s documents in Taxpresso’s library give none for natural persons, so none is computed.',
    fr: `Impôt ecclésiastique${NB}: les documents du canton dont dispose Taxpresso n’en prévoient pas pour les personnes physiques${NB}: aucun n’est calculé.`,
  },
  medicalBelow: {
    en: 'Illness costs (22.1): below 5 % of the net income II (21), nothing to deduct.',
    fr: `Frais de maladie (22.1)${NB}: sous 5${NB}% du revenu net II (21), rien à déduire.`,
  },
  donationsMin: {
    en: 'Donations (24): deducted only from CHF 100 in the year.',
    fr: `Dons (24)${NB}: déductibles seulement dès CHF 100 dans l’année.`,
  },
  transitDetails: {
    en: 'Travel to work: give what public transport cost (or would have cost) in the year; without it, nothing is counted.',
    fr: `Trajet au travail${NB}: indiquez ce qu’ont coûté (ou auraient coûté) les transports publics dans l’année${NB}; sans cela, rien n’est compté.`,
  },
  drivingDetails: {
    en: 'Driving to work without usable public transport: give the km one way and the days driven; without them, nothing is counted.',
    fr: `Trajet en voiture sans transports publics utilisables${NB}: indiquez les km pour un trajet et les jours de trajet${NB}; sans cela, rien n’est compté.`,
  },
  bikeAmount: {
    en: 'Bike or moped to work: the deduction is up to CHF 700 a year, never more than public transport would cost. Give the amount (and what public transport would cost); without it, nothing is counted.',
    fr: `Vélo ou cyclomoteur${NB}: la déduction va jusqu’à CHF 700 par an, jamais plus que les transports publics. Indiquez le montant (et le coût des transports publics)${NB}; sans cela, rien n’est compté.`,
  },
  childcareAway: {
    en: 'Childcare (20) counts only for a child under 14 who lives with you.',
    fr: `Les frais de garde (20) ne comptent que pour un enfant de moins de 14 ans qui vit avec vous.`,
  },
  // Why the tax is not computed (unsupported).
  selfEmployed: {
    en: 'Self-employment (attività indipendente, cifra 2) is not supported yet: the tax is not computed.',
    fr: `L’activité indépendante (attività indipendente, cifra 2) n’est pas encore prise en charge${NB}: l’impôt n’est pas calculé.`,
  },
  workRate: {
    en: 'Say how much you work, as a percentage of full time (grado di occupazione): under 50 %, the flat amount for other professional costs is halved (Modulo 4, cifra 1).',
    fr: `Indiquez votre taux d’activité en pour-cent d’un plein temps (grado di occupazione)${NB}: sous 50${NB}%, le forfait des autres frais professionnels est réduit de moitié (Modulo 4, cifra 1).`,
  },
  partYear: {
    en: 'You worked only part of the year: the flat amounts for professional costs are then in proportion, and halved under 6 months, and the documents don’t say how the two combine. The tax is not computed.',
    fr: `Vous n’avez travaillé qu’une partie de l’année${NB}: les forfaits des frais professionnels sont alors au prorata, et réduits de moitié sous 6 mois, et les documents ne disent pas comment combiner les deux. L’impôt n’est pas calculé.`,
  },
  costsAboveSalary: {
    en: 'Your professional costs are higher than your salary, and the documents don’t say whether they can be deducted beyond it. The tax is not computed.',
    fr: `Vos frais professionnels dépassent votre salaire, et les documents ne disent pas s’ils sont déductibles au-delà. L’impôt n’est pas calculé.`,
  },
  twoEarnerConflict: {
    en: 'Both spouses work (15.5): the deduction is at most the lower of your two incomes, and with your figures the result depends on which income counts (the net salary, the salary after its costs, or with daily allowances). The tax is not computed.',
    fr: `Activité des deux conjoints (15.5)${NB}: la déduction est au plus le plus bas de vos deux revenus, et avec vos chiffres le résultat dépend du revenu retenu (salaire net, salaire après frais, ou avec les indemnités journalières). L’impôt n’est pas calculé.`,
  },
  childcareWork: {
    en: 'Childcare (20) is deductible when it is needed for your work, training or inability to work; for a couple, Taxpresso supports it only when both spouses have a salary, and for a single parent when you have one. The tax is not computed.',
    fr: `Les frais de garde (20) sont déductibles s’ils sont liés à votre travail, votre formation ou votre incapacité de travailler${NB}; pour un couple, Taxpresso ne les prend en charge que si les deux conjoints ont un salaire, et pour un parent seul s’il en a un. L’impôt n’est pas calculé.`,
  },
  sharedChildcare: {
    en: 'Childcare for a child in shared custody without child support: the documents don’t say how the CHF 26,200 limit is shared between the parents, and you paid more than half of it. The tax is not computed.',
    fr: `Frais de garde d’un enfant en garde partagée sans contribution d’entretien${NB}: les documents ne disent pas comment la limite de CHF 26’200 se partage entre les parents, et vous avez payé plus de la moitié. L’impôt n’est pas calculé.`,
  },
  childcarePays: {
    en: 'Childcare for a child who counts for the other parent (you pay child support): the documents don’t say who deducts it. The tax is not computed.',
    fr: `Frais de garde d’un enfant qui compte pour l’autre parent (vous versez une contribution d’entretien)${NB}: les documents ne disent pas qui les déduit. L’impôt n’est pas calculé.`,
  },
  childSupport: {
    en: 'Joint parental authority: whether you receive or pay child support (alimenti) decides who counts the children (the child deduction is shared half and half only without child support). Answer the question on child support.',
    fr: `Autorité parentale conjointe${NB}: recevoir ou verser une contribution d’entretien (alimenti) décide qui compte les enfants (la déduction pour enfant n’est partagée par moitié que sans contribution). Répondez à la question sur la contribution d’entretien.`,
  },
  marriedShared: {
    en: 'A married couple with a child in shared custody with another parent: the documents Taxpresso has don’t say how the child counts for the couple. The tax is not computed.',
    fr: `Couple marié avec un enfant en garde partagée avec un autre parent${NB}: les documents dont dispose Taxpresso ne disent pas comment l’enfant compte pour le couple. L’impôt n’est pas calculé.`,
  },
  paysLiving: {
    en: 'You pay child support for a child in shared custody who also lives with you: the documents don’t say whether the family tariff (LT art. 35 cpv. 2) then applies to you. The tax is not computed.',
    fr: `Vous versez une contribution d’entretien pour un enfant en garde partagée qui vit aussi avec vous${NB}: les documents ne disent pas si le barème familial (LT art. 35 cpv. 2) s’applique alors à vous. L’impôt n’est pas calculé.`,
  },
  statusChange: {
    en: 'Say whether you were divorced, separated or widowed during the year: for that year the family tariff applies (LT art. 35 cpv. 5).',
    fr: `Dites si vous avez divorcé, été séparé ou êtes devenu veuf ou veuve pendant l’année${NB}: pour cette année, le barème familial s’applique (LT art. 35 cpv. 5).`,
  },
  widowedThisYear: {
    en: 'Your spouse died during the year: you are taxed together up to that day and separately after it, each for part of the year (LT art. 53 cpv. 3). Taxpresso does not support part of a year yet: the tax is not computed.',
    fr: `Votre conjoint est décédé pendant l’année${NB}: vous êtes imposés ensemble jusqu’à ce jour et séparément ensuite, chacun pour une partie de l’année (LT art. 53 cpv. 3). Taxpresso ne prend pas encore en charge une partie d’année${NB}: l’impôt n’est pas calculé.`,
  },
  drivingDays2026: {
    en: 'Driving to work in 2026: the 2026 instructions are not published, and with them the most working days a year that count (220 in 2025). The tax is not computed.',
    fr: `Trajet en voiture en 2026${NB}: les instructions 2026 ne sont pas publiées, ni le nombre maximal de jours de travail par an qui comptent (220 en 2025). L’impôt n’est pas calculé.`,
  },
  catchUp2025: {
    en: 'A pillar 3a catch-up payment (riscatto nel 3° pilastro A) is possible from tax year 2026 only.',
    fr: `Un rachat dans le pilier 3a (riscatto nel 3° pilastro A) n’est possible qu’à partir de l’année fiscale 2026.`,
  },
  wealthBrake: {
    en: 'Your cantonal and communal taxes are more than 60 % of your taxable income: on request, the wealth tax is cut (freno all’imposta sulla sostanza, LT art. 49a). Taxpresso does not compute that request: the tax is not computed.',
    fr: `Vos impôts cantonaux et communaux dépassent 60${NB}% de votre revenu imposable${NB}: sur demande, l’impôt sur la fortune est réduit (freno all’imposta sulla sostanza, LT art. 49a). Taxpresso ne calcule pas cette demande${NB}: l’impôt n’est pas calculé.`,
  },
  wealthChild: {
    en: 'The wealth deduction per minor child (35.2, CHF 30,000) for a child in shared custody, or whose age is not given, is not settled by the documents, and with your figures it changes the tax. Say whether each child was under 18 at the end of the year; for shared custody, the tax is not computed.',
    fr: `La déduction de fortune par enfant mineur (35.2, CHF 30’000) pour un enfant en garde partagée, ou dont l’âge n’est pas indiqué, n’est pas tranchée par les documents, et avec vos chiffres elle change l’impôt. Indiquez si chaque enfant avait moins de 18 ans à la fin de l’année${NB}; en garde partagée, l’impôt n’est pas calculé.`,
  },
} as const satisfies Record<string, Text>;
