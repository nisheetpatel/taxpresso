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
    en: 'Rounding: the canton’s tariff sheets print the simple tax (einfache Steuer) at each bracket’s end in centimes, but no document says how a tax between two ends, or the canton’s, the commune’s, the parish’s and the Bürgergemeinde’s share of it, is rounded. Taxpresso rounds the simple tax to the centime and each of those taxes to the nearest 5 centimes, so a bill can differ by a few centimes.',
    fr: `Arrondis${NB}: les barèmes du canton impriment l’impôt simple (einfache Steuer) à la fin de chaque tranche, en centimes, mais aucun document ne dit comment arrondir un impôt entre deux fins de tranche, ni la part du canton, de la commune, de la paroisse et de la bourgeoisie. Taxpresso arrondit l’impôt simple au centime et chacun de ces impôts aux 5 centimes les plus proches${NB}: un bordereau peut différer de quelques centimes.`,
  },
  partyCouple: {
    en: 'Political parties (252): the law gives one total (bis zum Gesamtbetrag von 20’000 Franken); Taxpresso applies it once for the couple.',
    fr: `Partis politiques (252)${NB}: la loi donne un montant total (bis zum Gesamtbetrag von 20’000 Franken)${NB}; Taxpresso l’applique une fois pour le couple.`,
  },
  trainingCouple2026: {
    en: 'Professional training (245, 246): the 2025 guide caps it per person; the 2026 guide is not published yet, and Taxpresso keeps the cap per person.',
    fr: `Formation continue (245, 246)${NB}: le guide 2025 la plafonne par personne${NB}; le guide 2026 n’est pas encore publié, et Taxpresso garde le plafond par personne.`,
  },
  churchShares: {
    en: 'Church tax in a mixed marriage: the law levies it in proportion of the family members who belong to each parish (StG § 169 Abs. 2). With no children, Taxpresso counts the two of you, half each.',
    fr: `Impôt ecclésiastique d’un couple de confessions différentes${NB}: la loi le prélève en proportion des membres de la famille appartenant à chaque paroisse (StG § 169 al. 2). Sans enfants, Taxpresso compte vous deux, moitié chacun.`,
  },
  // Why the tax is not computed (unsupported).
  selfEmployed: {
    en: 'Self-employment (selbständige Erwerbstätigkeit, 115, 116) is not supported yet: the tax is not computed.',
    fr: `L’activité indépendante (selbständige Erwerbstätigkeit, 115, 116) n’est pas encore prise en charge${NB}: l’impôt n’est pas calculé.`,
  },
  catchUp2025: {
    en: 'A pillar 3a catch-up payment (Einkauf in die Säule 3a) is possible from tax year 2026 only.',
    fr: `Un rachat dans le pilier 3a n’est possible qu’à partir de l’année fiscale 2026.`,
  },
  childSupport: {
    en: 'Joint custody with a parent you are not taxed with: whether you receive or pay child support (Unterhaltsbeiträge) decides who counts the children. Answer the question on child support.',
    fr: `Autorité parentale conjointe avec un parent avec qui vous n’êtes pas taxé${NB}: recevoir ou verser une contribution d’entretien décide qui compte les enfants. Répondez à la question sur la contribution d’entretien.`,
  },
  mainCare: {
    en: 'Joint custody without child support: the children count for the parent with the larger share of their actual care (Verordnung § 18 Abs. 2). Say whether that is you.',
    fr: `Autorité parentale conjointe sans contribution d’entretien${NB}: les enfants comptent pour le parent qui en assume la plus grande part de la garde effective (Verordnung § 18 al. 2). Dites si c’est vous.`,
  },
  marriedShared: {
    en: 'A married couple with a child in joint custody with another parent: the documents Taxpresso has don’t say how the child counts for the couple. The tax is not computed.',
    fr: `Couple marié avec un enfant sous autorité parentale conjointe avec un autre parent${NB}: les documents dont dispose Taxpresso ne disent pas comment l’enfant compte pour le couple. L’impôt n’est pas calculé.`,
  },
  under15: {
    en: 'Say whether each child was under 15 on 31 December: under 15, you get the deduction for your own care (Eigenbetreuungsabzug, 404); from the year the child turns 15, a higher child deduction (Kinderabzug Zusatz, 403a).',
    fr: `Dites si chaque enfant avait moins de 15 ans au 31 décembre${NB}: avant 15 ans, vous avez la déduction pour la garde par les parents (Eigenbetreuungsabzug, 404)${NB}; dès l’année des 15 ans, une déduction pour enfant plus élevée (Kinderabzug Zusatz, 403a).`,
  },
  minor: {
    en: 'Say whether each child aged 15 or more was a minor (under 18) on 31 December: only minors give the tax-free wealth per child (673).',
    fr: `Dites si chaque enfant de 15 ans ou plus était mineur (moins de 18 ans) au 31 décembre${NB}: seuls les mineurs donnent droit à la fortune exonérée par enfant (673).`,
  },
  churchMixedChildren: {
    en: 'Church tax: you and your spouse do not belong to the same parish, and you have children. The law shares the tax by the family members who belong to each parish (StG § 169 Abs. 2), but the documents don’t say which children count. The tax is not computed; your parish can tell you the amount.',
    fr: `Impôt ecclésiastique${NB}: vous et votre conjoint n’appartenez pas à la même paroisse et vous avez des enfants. La loi répartit l’impôt selon les membres de la famille appartenant à chaque paroisse (StG § 169 al. 2), mais les documents ne disent pas quels enfants comptent. L’impôt n’est pas calculé${NB}; votre paroisse peut vous donner le montant.`,
  },
  citizensDifferent: {
    en: 'Bürgergemeinde tax: you and your spouse are Ortsbürger (citizens) of two different Zug communes. The law says a couple pays where both are citizens (StG § 170 Abs. 3), not what happens otherwise. The tax is not computed; your Bürgergemeinde can tell you the amount.',
    fr: `Impôt de la bourgeoisie${NB}: vous et votre conjoint êtes bourgeois (Ortsbürger) de deux communes zougoises différentes. La loi dit qu’un couple paie là où les deux sont bourgeois (StG § 170 al. 3), pas ce qui se passe sinon. L’impôt n’est pas calculé${NB}; votre bourgeoisie peut vous donner le montant.`,
  },
  days2026: {
    en: 'Travel to work by car or motorbike on more than 220 days: the 2025 guide counts at most 220 days, and no 2026 document says how many count. The tax is not computed; give 220 days at most, or ask the Steuerverwaltung.',
    fr: `Trajets en voiture ou moto plus de 220 jours${NB}: le guide 2025 compte au plus 220 jours, et aucun document 2026 ne dit combien comptent. L’impôt n’est pas calculé${NB}; indiquez 220 jours au plus, ou demandez à l’administration fiscale.`,
  },
  // What the engine assumed.
  wholeYear: {
    en: 'The commune where you lived on 31 December taxes the whole year, and so do its parish and its Bürgergemeinde (StG § 171).',
    fr: `La commune où vous habitiez le 31 décembre impose toute l’année, de même que sa paroisse et sa bourgeoisie (StG § 171).`,
  },
  fullYear: {
    en: 'The flat professional costs are for a full year of work; for a job held part of the year, the guide asks to reduce them in proportion.',
    fr: `Les frais professionnels forfaitaires valent pour une année entière de travail${NB}; pour une activité exercée une partie de l’année, le guide demande de les réduire en proportion.`,
  },
  childrenAtCharge: {
    en: 'Your children count for the child deduction (Kinderabzug): minors in your care, or adult children in training whom you mainly support.',
    fr: `Vos enfants comptent pour la déduction pour enfant (Kinderabzug)${NB}: mineurs sous votre garde, ou enfants majeurs en formation dont vous assumez l’essentiel de l’entretien.`,
  },
  childNotWithYou: {
    en: 'A child who does not live with you still gives the child deduction, but not the large personal deduction or the Mehrpersonentarif, which need the child to live with you.',
    fr: `Un enfant qui ne vit pas avec vous donne quand même droit à la déduction pour enfant, mais pas à la grande déduction personnelle ni au Mehrpersonentarif, qui supposent qu’il vive avec vous.`,
  },
  childSupportReceived: {
    en: 'You receive child support: the children count for you (child deduction, large personal deduction, Mehrpersonentarif), and the support is taxed (171).',
    fr: `Vous recevez une contribution d’entretien${NB}: les enfants comptent pour vous (déduction pour enfant, grande déduction personnelle, Mehrpersonentarif), et la contribution est imposable (171).`,
  },
  childSupportPaid: {
    en: 'You pay child support: the children count for the parent who receives it, and you deduct the support instead (211).',
    fr: `Vous versez une contribution d’entretien${NB}: les enfants comptent pour le parent qui la reçoit, et vous déduisez la contribution à la place (211).`,
  },
  mainCareYes: {
    en: 'Joint custody without child support: you have the larger share of the children’s care, so they count for you. The insurance deduction for them is shared half and half with the other parent.',
    fr: `Autorité parentale conjointe sans contribution d’entretien${NB}: vous assumez la plus grande part de la garde, les enfants comptent donc pour vous. La déduction d’assurance pour eux est partagée par moitié avec l’autre parent.`,
  },
  mainCareNo: {
    en: 'Joint custody without child support: the other parent has the larger share of the children’s care, so they count for the other parent. You keep half the insurance deduction for them.',
    fr: `Autorité parentale conjointe sans contribution d’entretien${NB}: l’autre parent assume la plus grande part de la garde, les enfants comptent donc pour lui. Vous gardez la moitié de la déduction d’assurance pour eux.`,
  },
  ownCareInstead: {
    en: 'For a child under 15, you get either the childcare deduction (253) or the deduction for your own care (404), not both; Taxpresso takes the higher one for each child.',
    fr: `Pour un enfant de moins de 15 ans, vous avez soit la déduction des frais de garde (253), soit la déduction pour la garde par les parents (404), pas les deux${NB}; Taxpresso prend la plus élevée pour chaque enfant.`,
  },
  under14: {
    en: 'Childcare: the children are taken as under 14, unless their age was given.',
    fr: `Frais de garde${NB}: les enfants sont comptés comme ayant moins de 14 ans, sauf si leur âge est indiqué.`,
  },
  pensions: {
    en: 'Pensions are counted as given. AHV/IV pensions are taxed in full; for a pension fund pension, give the taxable share your statement shows.',
    fr: `Les rentes sont comptées telles qu’indiquées. Les rentes AVS/AI sont imposées en entier${NB}; pour une rente de caisse de pension, indiquez la part imposable figurant sur l’attestation.`,
  },
  listedSecurities: {
    en: 'Accounts and securities are counted at the value and gross income you gave. The reduction for qualifying participations of 10 % or more (wirtschaftliche Doppelbelastung, 410) is not applied.',
    fr: `Les titres et avoirs sont comptés à la valeur et au rendement brut indiqués. La réduction pour participations qualifiées de 10${NB}% ou plus (wirtschaftliche Doppelbelastung, 410) n’est pas appliquée.`,
  },
  bikeFlat: {
    en: 'Travel by bike, moped or yellow-plate motorbike: the flat amount a year of the federal ordinance, which the canton applies too (Steuerbuch 16.1).',
    fr: `Déplacements à vélo, cyclomoteur ou motocycle à plaque jaune${NB}: le forfait annuel de l’ordonnance fédérale, que le canton applique aussi (Steuerbuch 16.1).`,
  },
  freeTransport: {
    en: 'Your employer provides transport to work (box F of the salary certificate): no travel costs.',
    fr: `Votre employeur fournit le transport (case F du certificat de salaire)${NB}: pas de frais de déplacement.`,
  },
  workFromHome: {
    en: 'Working from home: neither travel costs nor lunch away from home count for those days.',
    fr: `Télétravail${NB}: ni les frais de déplacement ni les repas pris à l’extérieur ne comptent pour ces jours.`,
  },
  citizensNone: {
    en: 'Your Bürgergemeinde levies no tax this year (the table of Steuerfüsse prints "-").',
    fr: `Votre bourgeoisie ne prélève pas d’impôt cette année (le tableau des Steuerfüsse indique «${NB}-${NB}»).`,
  },
  citizensSpecial: {
    en: 'Your Bürgergemeinde taxes only income under the special taxes (Sondersteuern), such as pension capital, not your ordinary income and wealth.',
    fr: `Votre bourgeoisie n’impose que les revenus soumis aux impôts spéciaux (Sondersteuern), comme les prestations en capital, pas votre revenu et votre fortune ordinaires.`,
  },
  citizensHalf: {
    en: 'Only one of you is an Ortsbürger of a Zug commune, so the Bürgergemeinde levies half its tax (StG § 170 Abs. 3).',
    fr: `Un seul de vous est bourgeois (Ortsbürger) d’une commune zougoise, la bourgeoisie prélève donc la moitié de son impôt (StG § 170 al. 3).`,
  },
  // What is not in the calculation.
  churchNotAsked: {
    en: 'Not in this calculation: the church tax (Kirchensteuer), which members of the Roman Catholic or the Evangelical Reformed parish pay. Say your church to add it.',
    fr: `Pas dans ce calcul${NB}: l’impôt ecclésiastique (Kirchensteuer), dû par les membres de la paroisse catholique romaine ou évangélique réformée. Indiquez votre Eglise pour l’ajouter.`,
  },
  citizensNotAsked: {
    en: 'Not in this calculation: the Bürgergemeinde tax, which some Bürgergemeinden levy on their Ortsbürger (citizens) living in the canton. Say whether you are an Ortsbürger of a Zug commune to add it.',
    fr: `Pas dans ce calcul${NB}: l’impôt de la bourgeoisie (Bürgergemeinde), que certaines bourgeoisies prélèvent sur leurs bourgeois (Ortsbürger) habitant le canton. Dites si vous êtes bourgeois d’une commune zougoise pour l’ajouter.`,
  },
  dependents: {
    en: 'Not in this calculation: the deduction for supporting a person who cannot work (Unterstützungsabzug, 405), which Taxpresso does not ask about yet.',
    fr: `Pas dans ce calcul${NB}: la déduction pour personne à charge incapable de travailler (Unterstützungsabzug, 405), que Taxpresso ne demande pas encore.`,
  },
  rentNotGiven: {
    en: 'Not in this calculation: the renters’ deduction (Mietzinsabzug, 407), 30 % of the net rent of your home in Zug, up to a yearly maximum. Give the rent you paid in the year, without service charges, to add it.',
    fr: `Pas dans ce calcul${NB}: la déduction pour locataires (Mietzinsabzug, 407), 30${NB}% du loyer net de votre logement à Zoug, jusqu’à un maximum annuel. Indiquez le loyer payé dans l’année, sans les charges, pour l’ajouter.`,
  },
  insuranceNotGiven: {
    en: 'Not in this calculation: the deduction for insurance premiums and savings interest (230), which is at most what you paid. Give your health insurance premiums to add it.',
    fr: `Pas dans ce calcul${NB}: la déduction des primes d’assurance et des intérêts de l’épargne (230), qui est au plus ce que vous avez payé. Indiquez vos primes d’assurance maladie pour l’ajouter.`,
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
    en: 'Childcare by others is deductible when it is needed because you work, train or cannot work; for a married couple, both of you. It is not counted here.',
    fr: `Les frais de garde par des tiers sont déductibles lorsqu’ils sont nécessaires parce que vous travaillez, êtes en formation ou ne pouvez pas travailler${NB}; pour un couple marié, les deux. Ils ne sont pas comptés ici.`,
  },
  childcareOther: {
    en: 'Childcare you paid for a child who counts for the other parent is not counted here: the documents give the deduction to the parent the child lives with and who supports it.',
    fr: `Les frais de garde payés pour un enfant qui compte pour l’autre parent ne sont pas comptés ici${NB}: les documents donnent la déduction au parent avec qui l’enfant vit et qui l’entretient.`,
  },
  pensionerWealth: {
    en: 'The pensioners’ deduction (406) is not given: your net wealth (660) is above the limit.',
    fr: `La déduction pour rentiers (406) n’est pas accordée${NB}: votre fortune nette (660) dépasse la limite.`,
  },
  pensionerIncome: {
    en: 'The pensioners’ deduction (406) is not given: your net income (299) is above the limit.',
    fr: `La déduction pour rentiers (406) n’est pas accordée${NB}: votre revenu net (299) dépasse la limite.`,
  },
  childcareSplit: {
    en: 'Childcare by others (Kinderdrittbetreuungskostenabzug, 253) not computed: the limit is per child, and for a child under 15 the deduction for your own care (Eigenbetreuungsabzug, 404) applies when it is higher (StG § 30 Abs. 1 Bst. l, § 33 Abs. 2bis). The costs you gave for the household are too high for every split to give the same, so how they split between your children decides the deduction. Taxpresso doesn’t compute the tax until it knows what was paid for each child.',
    fr: `Frais de garde par des tiers (Kinderdrittbetreuungskostenabzug, 253) non calculés${NB}: la limite est par enfant, et pour un enfant de moins de 15 ans la déduction pour la garde par les parents (Eigenbetreuungsabzug, 404) s’applique quand elle est plus élevée (StG § 30 al. 1 let. l, § 33 al. 2bis). Les frais indiqués pour le ménage sont trop élevés pour que toute répartition donne le même résultat${NB}: leur répartition entre vos enfants décide la déduction. Taxpresso ne calcule pas l’impôt avant de savoir ce qui a été payé pour chaque enfant.`,
  },
  childcareAge: {
    en: 'Childcare by others (Kinderdrittbetreuungskostenabzug, 253): not counted for a child aged 15 or more on 31 December; the deduction is for children under 14.',
    fr: `Frais de garde par des tiers (Kinderdrittbetreuungskostenabzug, 253)${NB}: non comptés pour un enfant de 15 ans ou plus au 31 décembre${NB}; la déduction vaut pour les enfants de moins de 14 ans.`,
  },
  childcareNoChild: {
    en: 'Childcare by others (Kinderdrittbetreuungskostenabzug, 253): not counted, no child under 14 living with you was given.',
    fr: `Frais de garde par des tiers (Kinderdrittbetreuungskostenabzug, 253)${NB}: non comptés, aucun enfant de moins de 14 ans vivant avec vous n’est indiqué.`,
  },
} satisfies Record<string, Text>;
