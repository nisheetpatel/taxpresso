// Plain-words texts the engine attaches to a result (SPEC.md section 11b: second person, plain
// words, the official term next to its gloss; Basel-Stadt's official terms are German), so Claude
// can explain without stating rules from memory.
import type { BsEstimate } from './amounts.js';
import type { Text } from './types.js';

const NB = ' ';

export const ESTIMATE_TEXT: Record<BsEstimate | 'input-estimate', Text> = {
  'bs-2026-provisional': {
    en: '2026: the factor that turns the income of your accounts and securities into their yield value (Kapitalisierungssatz Wertschriften, 345) is provisional in the canton’s 2026 table. The canton sets it from the interest rates at the end of September 2026.',
    fr: `2026${NB}: le facteur qui convertit le rendement de vos avoirs et titres en valeur de rendement (Kapitalisierungssatz Wertschriften, 345) est provisoire dans le tableau 2026 du canton. Le canton le fixe d’après les taux d’intérêt de fin septembre 2026.`,
  },
  'input-estimate': {
    en: 'Some amounts you gave are estimates, so the taxes that rest on them are estimates too.',
    fr: `Certains montants indiqués sont des estimations${NB}: les impôts qui en dépendent le sont aussi.`,
  },
};

export const NOTE = {
  // Rules applied whose detail the documents don't spell out (unverifiedRules).
  rounding: {
    en: 'Rounding: the documents don’t say how the 5 % threshold for illness costs and the 20 % cap on donations are rounded, nor the mean value of accounts and securities, nor the canton’s and the commune’s shares of the tax in Riehen and Bettingen. Taxpresso rounds the shares of income to the franc, the mean value down to the franc and the shares of the tax to 5 centimes, so a bill can differ by a few centimes.',
    fr: `Arrondis${NB}: les documents ne disent pas comment arrondir le seuil de 5${NB}% des frais de maladie, le plafond de 20${NB}% des dons, la valeur moyenne des avoirs et titres, ni les parts du canton et de la commune à Riehen et Bettingen. Taxpresso arrondit les parts du revenu au franc, la valeur moyenne au franc inférieur et les parts de l’impôt à 5 centimes${NB}: un bordereau peut différer de quelques centimes.`,
  },
  reductionThenCommune: {
    en: 'Riehen and Bettingen levy their tax in percent of the tax computed under the law; Taxpresso takes the wealth tax after the reduction for a low income (StG § 51) as that tax, which the documents don’t say in so many words.',
    fr: `Riehen et Bettingen prélèvent leur impôt en pour-cent de l’impôt calculé selon la loi${NB}; Taxpresso prend pour cela l’impôt sur la fortune après la réduction pour revenu modeste (StG § 51), ce que les documents ne disent pas expressément.`,
  },
  // Why the tax is not computed (unsupported).
  selfEmployed: {
    en: 'Self-employment (selbstständige Erwerbstätigkeit, codes 150 to 175) is not supported yet: the tax is not computed.',
    fr: `L’activité indépendante (selbstständige Erwerbstätigkeit, codes 150 à 175) n’est pas encore prise en charge${NB}: l’impôt n’est pas calculé.`,
  },
  vehicles: {
    en: 'Vehicles and collections: vehicles you use every day are tax-free household goods, while others, boats and collections are taxed at their market value (code 835). Taxpresso does not sort them yet, so the tax is not computed.',
    fr: `Véhicules et collections${NB}: les véhicules d’usage quotidien font partie du mobilier de ménage exonéré, les autres, les bateaux et les collections sont imposés à leur valeur vénale (code 835). Taxpresso ne les distingue pas encore${NB}: l’impôt n’est pas calculé.`,
  },
  cohabitingAsk: {
    en: 'Say whether you live as a couple with a partner you are not married to (Konkubinat), as the return asks single parents: it decides the deduction for single parents (765), the tariff and the wealth allowance.',
    fr: `Dites si vous vivez en couple avec un partenaire auquel vous n’êtes pas marié (Konkubinat), comme la déclaration le demande aux parents seuls${NB}: cela décide la déduction pour famille monoparentale (765), le barème et le montant exonéré de fortune.`,
  },
  cohabiting: {
    en: 'An unmarried couple living with children (Konkubinat mit Kindern) has its own rules in Basel-Stadt (no deduction for single parents, a deduction for supporting the partner, code 757). Taxpresso does not support them yet: the tax is not computed.',
    fr: `Un couple non marié vivant avec des enfants (Konkubinat mit Kindern) a ses propres règles à Bâle-Ville (pas de déduction pour famille monoparentale, une déduction pour l’entretien du partenaire, code 757). Taxpresso ne les prend pas encore en charge${NB}: l’impôt n’est pas calculé.`,
  },
  childSupport: {
    en: 'Joint parental authority: whether you receive or pay child support (Unterhaltsbeiträge) decides who counts the children (the child deduction is shared half and half only without child support). Answer the question on child support.',
    fr: `Autorité parentale conjointe${NB}: recevoir ou verser une contribution d’entretien (Unterhaltsbeiträge) décide qui compte les enfants (la déduction pour enfant n’est partagée par moitié que sans contribution). Répondez à la question sur la contribution d’entretien.`,
  },
  mainUpkeep: {
    en: 'A child in shared custody: say whether you mainly bear the child’s upkeep, with your own income and wealth and the child support you receive (StV § 42). It decides the deduction for single parents (765), tariff B and the wealth allowance.',
    fr: `Enfant en garde partagée${NB}: dites si vous assumez principalement son entretien, avec vos revenus et votre fortune et la contribution reçue (StV § 42). Cela décide la déduction pour famille monoparentale (765), le barème B et le montant exonéré de fortune.`,
  },
  marriedShared: {
    en: 'A married couple with a child in shared custody with another parent: the documents Taxpresso has don’t say how the child counts for the couple. The tax is not computed.',
    fr: `Couple marié avec un enfant en garde partagée avec un autre parent${NB}: les documents dont dispose Taxpresso ne disent pas comment l’enfant compte pour le couple. L’impôt n’est pas calculé.`,
  },
  workRate: {
    en: 'Say how much you work, as a percentage of full time (Beschäftigungsgrad): the flat amount for professional costs (CHF 4,200) is cut in proportion at 60 % or less (form B, code 500).',
    fr: `Indiquez votre taux d’activité en pour-cent d’un plein temps (Beschäftigungsgrad)${NB}: le forfait des frais professionnels (CHF 4’200) est réduit en proportion à 60${NB}% ou moins (formulaire B, code 500).`,
  },
  referenceAge: {
    en: 'Say whether you reached the AHV reference age by the end of the year: it decides the deduction for single retirees (code 770).',
    fr: `Dites si vous aviez atteint l’âge de référence AVS à la fin de l’année${NB}: cela décide la déduction pour retraités seuls (code 770).`,
  },
  retireeConflict: {
    en: 'Deduction for single retirees (code 770) not decided: you have not reached the reference age, and whether your pensions are at least half your income depends on the reading. The ordinance counts them against your income (StV § 43), the guide against your pensions and earnings, and counts accident and military pensions (p. 39). The tax is not computed.',
    fr: `Déduction pour retraités seuls (code 770) non tranchée${NB}: vous n’avez pas atteint l’âge de référence, et savoir si vos rentes font au moins la moitié de votre revenu dépend de la lecture. L’ordonnance les compare à votre revenu (StV § 43), le guide à vos rentes et revenus d’activité, en comptant les rentes de l’assurance-accidents et militaire (p. 39). L’impôt n’est pas calculé.`,
  },
  catchUp2025: {
    en: 'A pillar 3a catch-up payment (Einkauf in die Säule 3a) is possible from tax year 2026 only.',
    fr: 'Un rachat dans le pilier 3a (Einkauf in die Säule 3a) n’est possible qu’à partir de l’année fiscale 2026.',
  },
  movableIncome: {
    en: 'Give the gross income of each account and security, even when it is zero: in Basel-Stadt their tax value is the market value or, when lower, the mean of the market value and the income times 345 (form W, lines 11 to 16).',
    fr: `Indiquez le rendement brut de chaque compte et titre, même nul${NB}: à Bâle-Ville, leur valeur fiscale est la valeur vénale ou, si elle est plus basse, la moyenne de la valeur vénale et du rendement multiplié par 345 (formulaire W, lignes 11 à 16).`,
  },
  lowIncome: {
    en: 'Your wealth tax may be reduced for a low income (StG § 51), and the documents differ on the details: the law says a taxable income of at most CHF 14,000 (CHF 20,000 for couples and parents), the guide less than that, and neither says which wealth sets the band (net or taxable). With your figures the readings give different taxes, so the tax is not computed.',
    fr: `Votre impôt sur la fortune peut être réduit pour revenu modeste (StG § 51), et les documents divergent sur les détails${NB}: la loi dit un revenu imposable d’au plus CHF 14’000 (CHF 20’000 pour les couples et les parents), le guide moins que cela, et aucun ne dit quelle fortune fixe la tranche (nette ou imposable). Avec vos chiffres, les lectures donnent des impôts différents${NB}: l’impôt n’est pas calculé.`,
  },
  lowYield: {
    en: 'Your wealth tax is above 5 per mille of your taxable wealth, so the reduction for wealth with a low yield may apply (StG § 52), and the documents don’t say how the income tax on that yield is measured. The tax is not computed.',
    fr: `Votre impôt sur la fortune dépasse 5 pour mille de votre fortune imposable${NB}: la réduction pour fortune à faible rendement peut s’appliquer (StG § 52), et les documents ne disent pas comment mesurer l’impôt sur le revenu de cette fortune. L’impôt n’est pas calculé.`,
  },
  twoEarnerConflict: {
    en: 'Deduction when both spouses work (code 660) not decided: the law excludes replacement income from it (StG § 32 al. 2), the guide counts daily allowances with the earnings (p. 35), and with your figures the two give different amounts. The tax is not computed.',
    fr: `Déduction pour activité des deux conjoints (code 660) non tranchée${NB}: la loi en exclut les revenus de remplacement (StG § 32 al. 2), le guide compte les indemnités journalières avec le revenu d’activité (p. 35), et avec vos chiffres les deux donnent des montants différents. L’impôt n’est pas calculé.`,
  },
  sharedChildcare: {
    en: 'Childcare for a child in shared custody: you paid more than half the limit of CHF 26,000, and the documents don’t say whether each parent has the whole limit or half of it. The tax is not computed.',
    fr: `Frais de garde pour un enfant en garde partagée${NB}: vous avez payé plus de la moitié de la limite de CHF 26’000, et les documents ne disent pas si chaque parent a la limite entière ou la moitié. L’impôt n’est pas calculé.`,
  },
  childcareSplit: {
    en: 'Childcare for several children (code 670): the limit is per child (form F), and with your total how it splits between the children changes the deduction. Give the childcare paid for each child: until then the tax is not computed.',
    fr: `Frais de garde pour plusieurs enfants (code 670)${NB}: la limite est par enfant (formulaire F), et avec votre total la répartition entre les enfants change la déduction. Indiquez les frais de garde payés pour chaque enfant${NB}: d’ici là, l’impôt n’est pas calculé.`,
  },
  childcareNotCounted: {
    en: 'Childcare for a child who counts for the other parent (you pay child support): the documents don’t say whether you may deduct it. The tax is not computed.',
    fr: `Frais de garde pour un enfant qui compte pour l’autre parent (vous versez la contribution d’entretien)${NB}: les documents ne disent pas si vous pouvez les déduire. L’impôt n’est pas calculé.`,
  },
  trainingCouple: {
    en: 'Professional training (codes 652 and 657): together you paid more than the limit, and the documents don’t say whether it applies to each spouse or to the couple. The tax is not computed.',
    fr: `Formation continue (codes 652 et 657)${NB}: ensemble, vous avez payé plus que la limite, et les documents ne disent pas si elle vaut pour chaque conjoint ou pour le couple. L’impôt n’est pas calculé.`,
  },
  minorChild: {
    en: 'Say whether each child was under 18 at the end of the year: the wealth allowance of CHF 15,000 (code 892) is only for minor children, and it changes your wealth tax.',
    fr: `Dites si chaque enfant avait moins de 18 ans à la fin de l’année${NB}: le montant exonéré de CHF 15’000 (code 892) ne vaut que pour les enfants mineurs, et il change votre impôt sur la fortune.`,
  },
  sharedAllowance: {
    en: 'Wealth allowance for a child in shared custody without child support (code 892): the law gives it to the parent who mainly provides for the child (StG § 49 al. 1 lit. c) and says nothing of sharing it, unlike the child deduction. With your wealth it changes the tax, so the tax is not computed.',
    fr: `Montant exonéré de fortune pour un enfant en garde partagée sans contribution d’entretien (code 892)${NB}: la loi le donne au parent qui pourvoit principalement à l’entretien (StG § 49 al. 1 let. c) et ne dit rien d’un partage, contrairement à la déduction pour enfant. Avec votre fortune, cela change l’impôt${NB}: l’impôt n’est pas calculé.`,
  },
  // What the engine assumed.
  fullYear: {
    en: 'The flat amount for professional costs is for a year of work, and the law cuts it for part of a year (StG § 27 al. 2), which Taxpresso does not ask yet: the calculation takes it that you worked all year.',
    fr: `Le forfait des frais professionnels vaut pour une année de travail, et la loi le réduit pour une partie de l’année (StG § 27 al. 2), ce que Taxpresso ne demande pas encore${NB}: le calcul suppose que vous avez travaillé toute l’année.`,
  },
  actualCosts: {
    en: 'Professional costs: your actual costs are higher than the flat amount and are used instead; they must be proven in detail (bs-2025-guide-wegleitung p. 30).',
    fr: `Frais professionnels${NB}: vos frais effectifs dépassent le forfait et le remplacent${NB}; ils doivent être prouvés en détail (guide 2025 p. 30).`,
  },
  insuranceFlat: {
    en: 'Insurance premiums and savings interest: Basel-Stadt gives a flat amount (Pauschalbetrag) whatever you paid, CHF 8,400 for spouses and CHF 4,200 for everyone else (StG § 32 al. 1 lit. g).',
    fr: `Primes d’assurance et intérêts d’épargne${NB}: Bâle-Ville accorde un forfait (Pauschalbetrag) quel que soit le montant payé, CHF 8’400 pour les époux et CHF 4’200 pour les autres (StG § 32 al. 1 let. g).`,
  },
  pensions: {
    en: 'Pensions are counted as given. AHV/IV and pension fund pensions are taxed in full, except some old pension fund pensions taxed at 80 % (guide p. 22); for a life annuity, give only its taxable share, as your insurer’s statement shows it.',
    fr: `Les rentes sont comptées telles qu’indiquées. Les rentes AVS/AI et de la prévoyance professionnelle sont imposées en entier, sauf certaines anciennes rentes imposées à 80${NB}% (guide p. 22)${NB}; pour une rente viagère, indiquez seulement sa part imposable, comme l’attestation de l’assureur la donne.`,
  },
  daysCapped: {
    en: 'Travel and lunch away from home count at most 220 working days a year (guide p. 31; form B).',
    fr: `Les trajets et les repas pris à l’extérieur comptent au plus 220 jours de travail par an (guide p. 31${NB}; formulaire B).`,
  },
  canteen: {
    en: 'Lunch with a canteen or meal vouchers counts CHF 7.50 a day; there is no deduction at all when a canteen meal costs you CHF 10 or less (guide p. 31).',
    fr: `Les repas avec cantine ou bons comptent CHF 7.50 par jour${NB}; aucune déduction si un repas de cantine vous coûte CHF 10 ou moins (guide p. 31).`,
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
  childSupportPaid: {
    en: 'You pay child support: the children count for the parent who receives it, and you deduct the support instead (code 561).',
    fr: `Vous versez une contribution d’entretien${NB}: les enfants comptent pour le parent qui la reçoit, et vous déduisez la contribution à la place (code 561).`,
  },
  sharedHalf: {
    en: 'Shared custody without child support: you have half the child deduction (code 750), as the law shares it between parents taxed apart (StG § 35 al. 1 lit. a).',
    fr: `Garde partagée sans contribution d’entretien${NB}: vous avez la moitié de la déduction pour enfant (code 750), que la loi partage entre parents imposés séparément (StG § 35 al. 1 let. a).`,
  },
  securitiesMean: {
    en: 'Accounts and securities: their tax value is the mean of their market value and their income times the capitalisation factor, because that mean is lower than the market value (form W, lines 11 to 16).',
    fr: `Avoirs et titres${NB}: leur valeur fiscale est la moyenne de leur valeur vénale et de leur rendement multiplié par le facteur de capitalisation, car cette moyenne est inférieure à la valeur vénale (formulaire W, lignes 11 à 16).`,
  },
  // What is not in the calculation.
  transitDetails: {
    en: 'Travel to work not counted: give what your public transport ticket cost (an annual U-Abo TNW, monthly tickets or a GA).',
    fr: `Frais de transport non comptés${NB}: indiquez ce qu’a coûté votre abonnement de transports publics (U-Abo TNW annuel, mensuel ou AG).`,
  },
  drivingDetails: {
    en: 'Travel to work by car or motorbike not counted: give the kilometres one way and the days driven.',
    fr: `Trajets en voiture ou moto non comptés${NB}: indiquez les kilomètres aller et le nombre de jours.`,
  },
  childcareNoChild: {
    en: 'Childcare is deductible for children under 14 who live with you (code 670): with none, it is not counted.',
    fr: `Les frais de garde sont déductibles pour les enfants de moins de 14 ans qui vivent avec vous (code 670)${NB}: sans enfant de ce genre, ils ne sont pas comptés.`,
  },
  childcareWork: {
    en: 'Childcare is deductible only when the parents caring for the child work, train or can’t work; for a married couple, both. It is not counted here.',
    fr: `Les frais de garde ne sont déductibles que si les parents qui s’occupent de l’enfant travaillent, se forment ou sont incapables de travailler${NB}; pour un couple marié, les deux. Ils ne sont pas comptés ici.`,
  },
  medicalBelow: {
    en: 'Illness costs: below 5 % of the net income (Nettoeinkommen II, code 719), nothing is deductible.',
    fr: `Frais de maladie${NB}: en dessous de 5${NB}% du revenu net (Nettoeinkommen II, code 719), rien n’est déductible.`,
  },
  donationsMin: {
    en: 'Donations: under CHF 100 in the year, nothing is deductible.',
    fr: `Dons${NB}: en dessous de CHF 100 dans l’année, rien n’est déductible.`,
  },
  dependents: {
    en: 'Not in this calculation: the deduction for supporting a relative (Unterstützungsabzug, code 755) and disability costs (Behinderungskosten), which Taxpresso does not ask about yet.',
    fr: `Pas dans ce calcul${NB}: la déduction pour personne à charge (Unterstützungsabzug, code 755) et les frais liés au handicap (Behinderungskosten), que Taxpresso ne demande pas encore.`,
  },
  church: {
    en: 'Not in this calculation: the church tax (Kirchensteuer). The recognised churches levy it on their members (StG § 2a), and its rates are not in the documents Taxpresso has.',
    fr: `Pas dans ce calcul${NB}: l’impôt ecclésiastique (Kirchensteuer). Les Églises reconnues le prélèvent auprès de leurs membres (StG § 2a), et ses taux ne figurent pas dans les documents dont dispose Taxpresso.`,
  },
} satisfies Record<string, Text>;
