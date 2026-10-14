// Plain-words texts the engine attaches to a result (SPEC.md section 11b: second person, plain
// words, the official French term next to its gloss), so Claude can explain without stating rules
// from memory.
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
    en: 'Rounding: the guide’s worked examples take the rate to six decimals of a percent and round the base tax, the LRIPP reduction, the cantonal and the communal tax to 5 centimes, for the income tax. Taxpresso rounds the wealth tax the same way and the 5 % and 20 % shares to the franc, which the documents don’t state, so a bill can differ by a few centimes.',
    fr: `Arrondis${NB}: les exemples du guide prennent le taux à six décimales et arrondissent l’impôt de base, la réduction LRIPP, l’impôt cantonal et l’impôt communal à 5 centimes, pour l’impôt sur le revenu. Taxpresso arrondit de même l’impôt sur la fortune, et au franc les parts de 5${NB}% et 20${NB}%, ce que les documents ne précisent pas${NB}: un bordereau peut différer de quelques centimes.`,
  },
  guide2026: {
    en: '2026: the 2026 guide (instructions générales) is not published yet. Taxpresso uses the 2026 table of deductions and scales, and the 2025 guide’s methods where the table gives none (240 working days a year for travel and meals, the rate to six decimals, the rounding of the modest taxpayer deduction).',
    fr: `2026${NB}: le guide 2026 (instructions générales) n’est pas encore publié. Taxpresso utilise le tableau des déductions et les barèmes 2026, et les méthodes du guide 2025 là où le tableau n’en donne pas (240 jours de travail par an pour les déplacements et les repas, le taux à six décimales, l’arrondi de la déduction pour contribuable modeste).`,
  },
  sharedChildcare: {
    en: 'Childcare with shared custody: each parent deducts what they paid up to CHF 7,500 a child (RIFam art. 4 al. 2). The regulation keeps this figure while the full limit is adjusted each year (CHF 15,200); Taxpresso uses the regulation’s figure.',
    fr: `Frais de garde en garde partagée${NB}: chaque parent déduit ce qu’il a payé, jusqu’à CHF 7’500 par enfant (RIFam art. 4 al. 2). Le règlement garde ce montant alors que la limite entière est adaptée chaque année (CHF 15’200)${NB}; Taxpresso applique le montant du règlement.`,
  },
  partyCouple: {
    en: 'Political parties: the law and the guide give one amount a year (LI art. 37 al. 1 lit. j); Taxpresso applies it once for the couple.',
    fr: `Partis politiques${NB}: la loi et le guide donnent un seul montant par an (LI art. 37 al. 1 let. j)${NB}; Taxpresso l’applique une fois pour le couple.`,
  },
  // Why the tax is not computed (unsupported).
  selfEmployed: {
    en: 'Self-employment (activité indépendante, codes 180 to 190) is not supported yet: the tax is not computed.',
    fr: `L’activité indépendante (codes 180 à 190) n’est pas encore prise en charge${NB}: l’impôt n’est pas calculé.`,
  },
  catchUp2025: {
    en: 'A pillar 3a catch-up payment (rachat 3a) is possible from tax year 2026 only.',
    fr: `Un rachat dans le pilier 3a n’est possible qu’à partir de l’année fiscale 2026.`,
  },
  ownHousehold: {
    en: 'Say whether you keep a household alone with your children, not living as a couple (annex 03: "Tenez-vous un ménage indépendant seul avec cet (ces) enfant(s) ?"): it decides the part of 1.3 of the quotient familial and several deductions.',
    fr: `Dites si vous tenez un ménage indépendant seul avec vos enfants, sans vivre en couple (annexe 03${NB}: «${NB}Tenez-vous un ménage indépendant seul avec cet (ces) enfant(s)${NB}?${NB}»)${NB}: cela décide la part de 1,3 du quotient familial et plusieurs déductions.`,
  },
  childSupport: {
    en: 'Shared parental authority: whether you receive or pay child support (contribution d’entretien) decides who counts the children (the part of 0.5 and the deductions per child). Answer the question on child support.',
    fr: `Autorité parentale conjointe${NB}: recevoir ou verser une contribution d’entretien décide qui compte les enfants (la part de 0,5 et les déductions par enfant). Répondez à la question sur la contribution d’entretien.`,
  },
  mainUpkeep: {
    en: 'Shared custody without child support: the part of 1.3 goes to the parent who mainly bears the child’s upkeep (RIFam art. 5 al. 2). Say whether that is you.',
    fr: `Garde partagée sans contribution d’entretien${NB}: la part de 1,3 revient au parent qui assume principalement l’entretien de l’enfant (RIFam art. 5 al. 2). Dites si c’est vous.`,
  },
  marriedShared: {
    en: 'A married couple with a child in shared custody with another parent: the documents Taxpresso has don’t say how the child counts for the couple. The tax is not computed.',
    fr: `Couple marié avec un enfant en garde partagée avec un autre parent${NB}: les documents dont dispose Taxpresso ne disent pas comment l’enfant compte pour le couple. L’impôt n’est pas calculé.`,
  },
  rent: {
    en: 'Say the yearly net rent of your home, without charges (loyer annuel net), or zero if you pay none: it decides the housing deduction (déduction sociale pour le logement, code 660). Owners are not supported yet.',
    fr: `Indiquez le loyer annuel net de votre logement, sans les charges, ou zéro si vous n’en payez pas${NB}: il décide la déduction sociale pour le logement (code 660). Les propriétaires ne sont pas encore pris en charge.`,
  },
  communePart: {
    en: 'Your commune has fractions (fractions de commune) that levy their own tax on top of the commune’s. Say which fraction you live in, or that you live in the rest of the commune.',
    fr: `Votre commune a des fractions de commune qui prélèvent leur propre impôt en plus de celui de la commune. Dites dans quelle fraction vous habitez, ou que vous habitez le reste de la commune.`,
  },
  familyConflict: {
    en: 'Family deduction (déduction pour famille, code 725) not computed: you have children with a part of 0.5 but not the part of 1.3, and the documents differ. The law gives the deduction only to spouses and to single parents with the part of 1.3 (LI art. 42a al. 1), as the guide’s text does; the guide’s example 3 and the family regulation give CHF 1,000 per child in your situation (vd-2025-guide p. 51, RIFam art. 10, 12, 14).',
    fr: `Déduction pour famille (code 725) non calculée${NB}: vous avez des enfants avec une part de 0,5 mais pas la part de 1,3, et les documents divergent. La loi n’accorde la déduction qu’aux époux et aux familles monoparentales avec la part de 1,3 (LI art. 42a al. 1), comme le texte du guide${NB}; l’exemple 3 du guide et le règlement sur l’imposition de la famille donnent CHF 1’000 par enfant dans votre situation (guide 2025 p. 51, RIFam art. 10, 12, 14).`,
  },
  housingShared: {
    en: 'Housing deduction (code 660) not computed: with a child in shared custody without child support, the documents don’t say whether the rent counted is raised for the child (LI art. 39 al. 2; RIFam shares only other deductions), and with your rent it changes the deduction.',
    fr: `Déduction pour le logement (code 660) non calculée${NB}: avec un enfant en garde partagée sans contribution d’entretien, les documents ne disent pas si le loyer pris en compte est augmenté pour l’enfant (LI art. 39 al. 2${NB}; le RIFam ne partage que d’autres déductions), et avec votre loyer cela change la déduction.`,
  },
  housing2026: {
    en: 'Housing deduction (code 660) not computed: the most rent counted for 2026 is not published yet (it is in the 2026 guide), and your rent is above the 2025 amount, so it changes the deduction.',
    fr: `Déduction pour le logement (code 660) non calculée${NB}: le loyer maximum pris en compte pour 2026 n’est pas encore publié (il figure dans le guide 2026), et votre loyer dépasse le montant 2025${NB}: cela change la déduction.`,
  },
  quotientCap: {
    en: 'Rate-determining income (code 820) not computed: above the first threshold, the cap on what the children’s parts take off (LI art. 43 al. 3) needs the guide’s table for your situation, which is not published for it (shared parts, more children than the table lists, or tax year 2026).',
    fr: `Revenu déterminant pour le taux (code 820) non calculé${NB}: au-delà du premier seuil, le plafonnement de l’effet des parts pour enfants (LI art. 43 al. 3) demande le tableau du guide pour votre situation, qui n’est pas publié pour elle (parts partagées, plus d’enfants que le tableau, ou année fiscale 2026).`,
  },
  furniture2026: {
    en: 'Household contents (objets mobiliers, code 440) not computed: 30 % of their fire insurance value is above the 2025 deduction, and the 2026 deduction is not published yet.',
    fr: `Objets mobiliers (code 440) non calculés${NB}: 30${NB}% de leur valeur d’assurance incendie dépasse la déduction 2025, et la déduction 2026 n’est pas encore publiée.`,
  },
  transport2026: {
    en: 'Travel to work (code 140) not computed for 2026: the flat amounts for public transport, bikes and motorbikes are in the 2026 guide, which is not published yet.',
    fr: `Frais de transport (code 140) non calculés pour 2026${NB}: les forfaits pour les transports publics, le vélo et la moto figurent dans le guide 2026, pas encore publié.`,
  },
  maxima: {
    en: 'Your cantonal and communal tax may reach a legal maximum (LICom art. 8: 30 % of income, 10 per mille of wealth, or 60 % of net income for both), and the documents don’t say how the cut is computed in detail. The tax is not computed.',
    fr: `Votre impôt cantonal et communal peut atteindre un maximum légal (LICom art. 8${NB}: 30${NB}% du revenu, 10 pour mille de la fortune, ou 60${NB}% du revenu net pour les deux), et les documents ne précisent pas le calcul de la réduction. L’impôt n’est pas calculé.`,
  },
  // What the engine assumed.
  pensions: {
    en: 'Pensions are counted as given. AVS/AI and pension fund pensions are taxed in full (LI art. 26 al. 1); for a life annuity (rente viagère), give only its taxable income share, as your insurer’s statement shows it.',
    fr: `Les rentes sont comptées telles qu’indiquées. Les rentes AVS/AI et de la prévoyance professionnelle sont imposées en entier (LI art. 26 al. 1)${NB}; pour une rente viagère, indiquez seulement sa part de rendement imposable, comme l’attestation de l’assureur la donne.`,
  },
  partYear: {
    en: 'Travel and lunch deductions are for a full year of 240 working days and are cut in proportion for fewer days (vd-2025-guide p. 19).',
    fr: `Les déductions pour déplacements et repas valent pour une année de 240 jours de travail et sont réduites en proportion pour moins de jours (guide 2025 p. 19).`,
  },
  daysCapped: {
    en: 'Driving to work counts at most 240 days a year (annex 04).',
    fr: `Les trajets en voiture comptent au plus 240 jours par an (annexe 04).`,
  },
  actualTransport: {
    en: 'Travel to work: what you paid is more than the flat amount and is used instead; keep the proof (vd-2025-guide p. 20).',
    fr: `Frais de transport${NB}: ce que vous avez payé dépasse le forfait et le remplace${NB}; gardez les justificatifs (guide 2025 p. 20).`,
  },
  transitCostOnly: {
    en: 'Travel to work: what you paid is counted as given. The flat amount for public transport depends on the one-way distance and may be higher; give the distance to compare (vd-2025-guide p. 19).',
    fr: `Frais de transport${NB}: ce que vous avez payé est compté tel qu’indiqué. Le forfait des transports publics dépend de la distance aller et peut être plus élevé${NB}; indiquez la distance pour comparer (guide 2025 p. 19).`,
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
  under14: {
    en: 'Childcare: the children are taken as under 14, unless their age was given.',
    fr: `Frais de garde${NB}: les enfants sont comptés comme ayant moins de 14 ans, sauf si leur âge est indiqué.`,
  },
  childSupportPaid: {
    en: 'You pay child support: the children count for the parent who receives it, and you deduct the support instead (code 630).',
    fr: `Vous versez une contribution d’entretien${NB}: les enfants comptent pour le parent qui la reçoit, et vous déduisez la contribution à la place (code 630).`,
  },
  sharedHalf: {
    en: 'Shared custody without child support: you have half the part of 0.5 for the child (0.25), and half its insurance, savings, modest taxpayer and family amounts (RIFam art. 5 al. 2 and art. 6).',
    fr: `Garde partagée sans contribution d’entretien${NB}: vous avez la moitié de la part de 0,5 pour l’enfant (0,25), et la moitié des montants pour enfant des déductions d’assurances et d’épargne, pour contribuable modeste et pour famille (RIFam art. 5 al. 2 et art. 6).`,
  },
  furnitureNotGiven: {
    en: 'Household contents (objets mobiliers): not given, so taken as no more than the deduction for household contents (30 % of their fire insurance value up to CHF 60,000, CHF 120,000 for a couple, is not taxed).',
    fr: `Objets mobiliers${NB}: non indiqués, donc comptés comme ne dépassant pas la déduction (30${NB}% de la valeur d’assurance incendie jusqu’à CHF 60’000, CHF 120’000 pour un couple, ne sont pas imposés).`,
  },
  // What is not in the calculation.
  transitDetails: {
    en: 'Travel to work not counted: give the one-way distance in km for the flat amount, or what the trip actually cost.',
    fr: `Frais de transport non comptés${NB}: indiquez la distance aller en km pour le forfait, ou ce que le trajet a réellement coûté.`,
  },
  drivingDetails: {
    en: 'Travel to work by car or motorbike not counted: give the kilometres one way and the days driven.',
    fr: `Trajets en voiture ou moto non comptés${NB}: indiquez les kilomètres aller et le nombre de jours.`,
  },
  childcareWork: {
    en: 'Childcare is deductible only when the parents caring for the child work, train or can’t work; for a married couple, both. It is not counted here.',
    fr: `Les frais de garde ne sont déductibles que si les parents qui s’occupent de l’enfant travaillent, se forment ou sont incapables de travailler${NB}; pour un couple marié, les deux. Ils ne sont pas comptés ici.`,
  },
  medicalBelow: {
    en: 'Medical costs: below 5 % of the intermediate income (revenu intermédiaire, code 700), nothing is deductible.',
    fr: `Frais médicaux${NB}: en dessous de 5${NB}% du revenu intermédiaire (code 700), rien n’est déductible.`,
  },
  donationsMin: {
    en: 'Donations: under CHF 100 in the year, nothing is deductible.',
    fr: `Dons${NB}: en dessous de CHF 100 dans l’année, rien n’est déductible.`,
  },
  dependents: {
    en: 'Not in this calculation: the deduction for another person you support (déduction pour personne à charge, code 680), which Taxpresso does not ask about yet.',
    fr: `Pas dans ce calcul${NB}: la déduction pour personne à charge (code 680), que Taxpresso ne demande pas encore.`,
  },
} satisfies Record<string, Text>;

/** The fixed personal tax (impôt personnel fixe) of a commune: not in the calculation. */
export function personalTaxNote(commune: string, amount: string): Text {
  return {
    en: `Not in this calculation: ${commune}’s fixed personal tax (impôt personnel fixe), ${amount} a year per adult living in the commune on 1 January, less for spouses and with the commune’s exemptions (LICom art. 21).`,
    fr: `Pas dans ce calcul${NB}: l’impôt personnel fixe de ${commune}, ${amount} par an et par adulte domicilié dans la commune au 1er janvier, moins pour les époux et selon les exonérations de la commune (LICom art. 21).`,
  };
}
