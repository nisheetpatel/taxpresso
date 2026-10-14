// Plain-words texts the engine attaches to a result (SPEC.md section 11b: second person, plain
// words, the official term next to its gloss), so Claude can explain without stating rules from
// memory.
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
    en: 'Rounding: the canton’s tariff gives the einfache Steuer (the tax at 100 percent) to the nearest 5 Rappen (kaufmännisch gerundet). The documents don’t say whether the taxable income and wealth are taken in whole francs, nor how the cantonal, communal and church taxes are rounded; Taxpresso takes whole francs and rounds each tax to the nearest 5 centimes, so a bill can differ by a few centimes.',
    fr: `Arrondis${NB}: le tarif du canton donne l’impôt simple (einfache Steuer, l’impôt à 100${NB}%) aux 5 centimes les plus proches (kaufmännisch gerundet). Les documents ne disent pas si le revenu et la fortune imposables sont pris en francs entiers, ni comment les impôts cantonal, communal et ecclésiastique sont arrondis${NB}; Taxpresso prend des francs entiers et arrondit chaque impôt aux 5 centimes les plus proches${NB}: un bordereau peut différer de quelques centimes.`,
  },
  otherFlatRounding: {
    en: 'Other professional costs (übrige Berufskosten, Form 4, 3.1): the flat amount is under its maximum, and the documents don’t say how 10 percent of the net salary is rounded; Taxpresso takes it to the nearest franc.',
    fr: `Autres frais professionnels (übrige Berufskosten, formulaire 4, 3.1)${NB}: le forfait est sous son maximum, et les documents ne disent pas comment 10${NB}% du salaire net est arrondi${NB}; Taxpresso l’arrondit au franc le plus proche.`,
  },
  insuranceExtra: {
    en: 'Insurance premiums (Versicherungsprämien, 14): you get the higher maximum because no pension fund or pillar 3a contributions are deducted, as the guide and Form 6 word the rule. The law (StG Art. 45 Abs. 1 lit. g) refers to all the contributions of lit. d, which names the AHV/IV too; Taxpresso follows the guide.',
    fr: `Primes d’assurance (Versicherungsprämien, 14)${NB}: vous avez le maximum plus élevé parce qu’aucune cotisation à une caisse de pension ni au pilier 3a n’est déduite, comme le guide et le formulaire 6 formulent la règle. La loi (StG Art. 45 al. 1 let. g) renvoie à toutes les cotisations de la let. d, qui nomme aussi l’AVS/AI${NB}; Taxpresso suit le guide.`,
  },
  churchHalfNone: {
    en: 'Church tax (Kirchensteuer): only one of you is a member of a church. In a mixed marriage half the tax goes to each spouse’s church (StV Art. 2 Abs. 1); the ordinance doesn’t say what happens to the half of a spouse without a church, and Taxpresso levies no church tax on it.',
    fr: `Impôt ecclésiastique (Kirchensteuer)${NB}: un seul de vous est membre d’une Eglise. Dans un mariage mixte, la moitié de l’impôt va à l’Eglise de chaque conjoint (StV Art. 2 al. 1)${NB}; l’ordonnance ne dit pas ce qu’il advient de la moitié d’un conjoint sans Eglise, et Taxpresso n’y prélève pas d’impôt ecclésiastique.`,
  },
  churchFootnote3: {
    en: 'Church tax: the canton’s table marks your church area’s rate with footnote 3: parts of the area belong to a parish outside the canton (ausserkantonale Kirchgemeinde), whose rate is not in the table. Taxpresso uses the area’s rate; if you belong to the parish outside the canton, your church tax differs.',
    fr: `Impôt ecclésiastique${NB}: le tableau du canton marque le taux de votre paroisse de la note 3${NB}: des parties du territoire appartiennent à une paroisse d’un autre canton (ausserkantonale Kirchgemeinde), dont le taux n’est pas dans le tableau. Taxpresso utilise le taux de la paroisse${NB}; si vous appartenez à la paroisse de l’autre canton, votre impôt ecclésiastique diffère.`,
  },
  churchFootnote4: {
    en: 'Church tax: the canton’s table marks your church area’s rate with footnote 4: larger parts of it belong to other parishes (Kirchgemeinden). Taxpresso uses the rate printed for the area; if you belong to another parish, your church tax differs.',
    fr: `Impôt ecclésiastique${NB}: le tableau du canton marque le taux de votre paroisse de la note 4${NB}: de grandes parties du territoire appartiennent à d’autres paroisses (Kirchgemeinden). Taxpresso utilise le taux imprimé pour ce territoire${NB}; si vous appartenez à une autre paroisse, votre impôt ecclésiastique diffère.`,
  },
  twoEarnerAllowances: {
    en: 'Both spouses work (Zweiverdienerabzug, 17): one of you has allowances (unemployment or loss of earnings) but no salary. The law speaks of earned income (Erwerbseinkommen); Taxpresso counts such allowances as earned income.',
    fr: `Activité des deux conjoints (Zweiverdienerabzug, 17)${NB}: l’un de vous a des indemnités (chômage ou perte de gain) mais pas de salaire. La loi parle de revenu d’activité (Erwerbseinkommen)${NB}; Taxpresso compte ces indemnités comme revenu d’activité.`,
  },
  // Why the tax is not computed (unsupported).
  selfEmployed: {
    en: 'Self-employment (selbständige Erwerbstätigkeit, 2.1 and 2.2) is not supported yet: the tax is not computed.',
    fr: `L’activité indépendante (selbständige Erwerbstätigkeit, 2.1 et 2.2) n’est pas encore prise en charge${NB}: l’impôt n’est pas calculé.`,
  },
  childSupport: {
    en: 'Joint custody with a parent you are not taxed with: whether you receive or pay child support (Unterhaltsbeiträge) decides who gets the child deduction (Kinderabzug). Answer the question on child support.',
    fr: `Autorité parentale conjointe avec un parent avec qui vous n’êtes pas taxé${NB}: recevoir ou verser une contribution d’entretien (Unterhaltsbeiträge) décide qui a la déduction pour enfant (Kinderabzug). Répondez à la question sur la contribution d’entretien.`,
  },
  mainUpkeep: {
    en: 'Joint custody without child support: the child deduction goes to the parent who mainly bears the children’s upkeep; when you share it equally, the canton’s practice presumes it is the parent with the lower net income (Steuerbuch StB 48 Nr. 1). Say whether that is you.',
    fr: `Autorité parentale conjointe sans contribution d’entretien${NB}: la déduction pour enfant va au parent qui assume l’essentiel de l’entretien des enfants${NB}; si vous le partagez à parts égales, la pratique du canton présume que c’est le parent au revenu net le plus bas (Steuerbuch StB 48 Nr. 1). Dites si c’est vous.`,
  },
  marriedShared: {
    en: 'A married couple with a child in joint custody with another parent: the documents Taxpresso has don’t say how the child counts for the couple. The tax is not computed.',
    fr: `Couple marié avec un enfant sous autorité parentale conjointe avec un autre parent${NB}: les documents dont dispose Taxpresso ne disent pas comment l’enfant compte pour le couple. L’impôt n’est pas calculé.`,
  },
  childStage: {
    en: 'Child deduction (Kinderabzug): say for each child whether it is not yet of school age (before the 1 August after its fourth birthday) or in school or training. The two deductions differ.',
    fr: `Déduction pour enfant (Kinderabzug)${NB}: dites pour chaque enfant s’il n’a pas encore l’âge scolaire (avant le 1er août qui suit son quatrième anniversaire) ou s’il est à l’école ou en formation. Les deux déductions diffèrent.`,
  },
  childMinor: {
    en: 'Wealth deduction for children (36.3): say whether each child in school or training was under 18 on 31 December. Only minor children count.',
    fr: `Déduction sur la fortune pour enfants (36.3)${NB}: dites si chaque enfant à l’école ou en formation avait moins de 18 ans au 31 décembre. Seuls les enfants mineurs comptent.`,
  },
  motorbikeRate: {
    en: 'Travel to work by motorbike without usable public transport: the canton’s practice (Steuerbuch StB 39 Nr. 3) and the 2025 guide give the same rate per km as for a car, while the ordinance (StV Art. 18 Abs. 3) refers to the federal rates, which are lower for motorbikes. The documents disagree: the tax is not computed.',
    fr: `Trajet en moto sans transports publics utilisables${NB}: la pratique du canton (Steuerbuch StB 39 Nr. 3) et le guide 2025 donnent le même taux par km que pour une voiture, alors que l’ordonnance (StV Art. 18 al. 3) renvoie aux taux fédéraux, plus bas pour les motos. Les documents divergent${NB}: l’impôt n’est pas calculé.`,
  },
  churchOther: {
    en: 'Church tax of another religious community (for example the Jewish community, jüdische Gemeinde): its rate is not in the canton’s table. The tax is not computed; your community can tell you its rate.',
    fr: `Impôt d’une autre communauté religieuse (par exemple la communauté juive, jüdische Gemeinde)${NB}: son taux n’est pas dans le tableau du canton. L’impôt n’est pas calculé${NB}; votre communauté peut vous donner son taux.`,
  },
  childcareSplit: {
    en: 'Childcare by third parties (Kinderbetreuungskosten bei Drittbetreuung, 16.2) not computed: the limit is per child under 14 (StG Art. 45 Abs. 1 lit. h), and the costs you gave for the household are too high for every split between your children to give the same deduction. Taxpresso doesn’t compute the tax until it knows what was paid for each child.',
    fr: `Frais de garde par des tiers (Kinderbetreuungskosten bei Drittbetreuung, 16.2) non calculés${NB}: la limite est par enfant de moins de 14 ans (StG Art. 45 al. 1 let. h), et les frais indiqués pour le ménage sont trop élevés pour que toute répartition entre vos enfants donne la même déduction. Taxpresso ne calcule pas l’impôt avant de savoir ce qui a été payé pour chaque enfant.`,
  },
  childcareNoChild: {
    en: 'Childcare by third parties (Kinderbetreuungskosten bei Drittbetreuung, 16.2): not counted, no child under 14 who lives with you and counts for you was given.',
    fr: `Frais de garde par des tiers (Kinderbetreuungskosten bei Drittbetreuung, 16.2)${NB}: non comptés, aucun enfant de moins de 14 ans vivant avec vous et compté pour vous n’est indiqué.`,
  },
  educationScholarships: {
    en: 'Children’s education costs with scholarships (Stipendien, 23.3): the law reduces the deduction by the scholarships (StG Art. 48 Abs. 1 lit. a), while Form 10 takes them off the costs before the excess and the maximum, and here the two give different amounts. The documents disagree: the tax is not computed.',
    fr: `Frais de formation des enfants avec bourses (Stipendien, 23.3)${NB}: la loi réduit la déduction des bourses (StG Art. 48 al. 1 let. a), alors que le formulaire 10 les retire des frais avant la franchise et le maximum, et ici les deux donnent des montants différents. Les documents divergent${NB}: l’impôt n’est pas calculé.`,
  },
  // What the engine assumed.
  wholeYear: {
    en: 'The commune where you lived on 31 December taxes the whole year; a move inside St. Gallen does not split the communal tax.',
    fr: `La commune où vous habitiez au 31 décembre impose toute l’année${NB}; un déménagement à l’intérieur de Saint-Gall ne partage pas l’impôt communal.`,
  },
  fullYear: {
    en: 'You were taxable in St. Gallen for the whole year (arriving from or leaving for abroad during the year is not supported).',
    fr: `Vous étiez imposable à Saint-Gall toute l’année (une arrivée de l’étranger ou un départ à l’étranger en cours d’année n’est pas pris en charge).`,
  },
  pensions: {
    en: 'Pensions (Renten und Pensionen, 3.2) are counted as given, at their taxable amount: a pension fund pension that began before 2002, from a pension relationship that existed before 1985, is taxable at 80 percent only.',
    fr: `Les rentes (Renten und Pensionen, 3.2) sont comptées telles que données, pour leur montant imposable${NB}: une rente de caisse de pension qui a commencé avant 2002, d’un rapport de prévoyance existant avant 1985, n’est imposable qu’à 80${NB}%.`,
  },
  sideOnly: {
    en: 'A side job without a main job: the guide (p. 25) says that people without a main job get no flat costs for a side job (Nebenerwerb, Form 4, 5.1) and refers them to "the deductions of Ziffer 1 to 5"; Taxpresso counts the job as your main job (Haupterwerb, 1.1), with the usual professional costs (Form 4, 1 to 3).',
    fr: `Une activité accessoire sans activité principale\u00a0: le guide (p. 25) dit que les personnes sans activité principale n’ont pas le forfait de l’activité accessoire (Nebenerwerb, formulaire 4, 5.1) et les renvoie «\u00a0aux déductions des chiffres 1 à 5\u00a0»\u00a0; Taxpresso compte cette activité comme activité principale (Haupterwerb, 1.1), avec les frais professionnels habituels (formulaire 4, 1 à 3).`,
  },
  freeTransport: {
    en: 'Your employer provides the transport to work (salary certificate, box F): no travel costs.',
    fr: `Votre employeur fournit le transport jusqu’au travail (certificat de salaire, case F)${NB}: pas de frais de déplacement.`,
  },
  bikeFlat: {
    en: 'Bike, moped or small motorbike (yellow plate): the yearly flat amount, given that the walk to work or to the next stop takes more than 10 minutes (Steuerbuch StB 39 Nr. 3).',
    fr: `Vélo, cyclomoteur ou petite moto (plaque jaune)${NB}: le forfait annuel, si le trajet à pied jusqu’au travail ou à l’arrêt le plus proche prend plus de 10 minutes (Steuerbuch StB 39 Nr. 3).`,
  },
  workFromHome: {
    en: 'Working from home: no travel and no meal costs for those days.',
    fr: `Télétravail${NB}: pas de frais de déplacement ni de repas pour ces jours.`,
  },
  childSupportReceived: {
    en: 'Joint custody, you receive child support: the children count for you (child deduction, Vollsplitting when they live with you).',
    fr: `Autorité parentale conjointe, vous recevez une contribution d’entretien${NB}: les enfants comptent pour vous (déduction pour enfant, Vollsplitting s’ils vivent avec vous).`,
  },
  childSupportPaid: {
    en: 'Joint custody, you pay child support: you deduct the support you pay (12.2) and the children count for the other parent.',
    fr: `Autorité parentale conjointe, vous versez une contribution d’entretien${NB}: vous déduisez ce que vous versez (12.2) et les enfants comptent pour l’autre parent.`,
  },
  mainUpkeepYes: {
    en: 'Joint custody without child support: you mainly bear the children’s upkeep, so they count for you.',
    fr: `Autorité parentale conjointe sans contribution d’entretien${NB}: vous assumez l’essentiel de l’entretien des enfants, ils comptent donc pour vous.`,
  },
  mainUpkeepNo: {
    en: 'Joint custody without child support: the other parent mainly bears the children’s upkeep, so they count for the other parent.',
    fr: `Autorité parentale conjointe sans contribution d’entretien${NB}: l’autre parent assume l’essentiel de l’entretien des enfants, ils comptent donc pour lui.`,
  },
  childNotWithYou: {
    en: 'A child who does not live with you still gets the child deduction when you mainly bear its upkeep, but gives neither Vollsplitting nor the childcare deduction.',
    fr: `Un enfant qui ne vit pas avec vous donne la déduction pour enfant si vous assumez l’essentiel de son entretien, mais ni le Vollsplitting ni la déduction pour frais de garde.`,
  },
  childrenAtCharge: {
    en: 'The children you listed are those whose upkeep you mainly bear and for whom you pay no child support (the conditions of the child deduction).',
    fr: `Les enfants indiqués sont ceux dont vous assumez l’essentiel de l’entretien et pour qui vous ne versez pas de contribution d’entretien (les conditions de la déduction pour enfant).`,
  },
  churchMixed: {
    en: 'Church tax in a mixed marriage: half the tax goes to each spouse’s church (StV Art. 2 Abs. 1). Either of you can ask for it to follow the whole family’s membership instead (Abs. 2); Taxpresso does not compute that.',
    fr: `Impôt ecclésiastique dans un mariage mixte${NB}: la moitié de l’impôt va à l’Eglise de chaque conjoint (StV Art. 2 al. 1). Chacun de vous peut demander qu’il suive plutôt l’appartenance de toute la famille (al. 2)${NB}; Taxpresso ne le calcule pas.`,
  },
  childcareMeals: {
    en: 'Childcare (16.2) is counted as you gave it: meals are not care costs, and when the bill does not show them apart, CHF 8 a day comes off (guide p. 28). Give the amount without meals.',
    fr: `Les frais de garde (16.2) sont comptés tels que donnés\u00a0: les repas ne sont pas des frais de garde, et si la facture ne les indique pas à part, CHF 8 par jour sont retirés (guide p. 28). Indiquez le montant sans les repas.`,
  },
  under14: {
    en: 'Childcare is counted for children under 14, as you gave it.',
    fr: `Les frais de garde sont comptés pour les enfants de moins de 14 ans, tels que donnés.`,
  },
  // What is not in the calculation (notCounted).
  churchNotAsked: {
    en: 'Church tax (Kirchensteuer) is not included: say whether you are a member of a church to add it.',
    fr: `L’impôt ecclésiastique (Kirchensteuer) n’est pas inclus${NB}: dites si vous êtes membre d’une Eglise pour l’ajouter.`,
  },
  fireLevy: {
    en: 'The communal fire service levy (Feuerwehrabgabe), which communes levy apart, is not part of this tax.',
    fr: `La taxe communale d’exemption du service du feu (Feuerwehrabgabe), perçue à part par les communes, ne fait pas partie de cet impôt.`,
  },
  childcareWork: {
    en: 'Childcare (Kinderbetreuungskosten, 16.2) is deductible only while you work, train or cannot work, and for a couple both of you: no earned income was given, so it is not counted.',
    fr: `Les frais de garde (Kinderbetreuungskosten, 16.2) ne sont déductibles que si vous travaillez, êtes en formation ou incapable de travailler, et pour un couple tous les deux${NB}: aucun revenu d’activité n’est indiqué, ils ne sont donc pas comptés.`,
  },
  childcareOtherParent: {
    en: 'Childcare for a child who counts for the other parent: the childcare deduction follows the child deduction (Steuerbuch StB 45 Nr. 14), so it is not counted here.',
    fr: `Frais de garde d’un enfant qui compte pour l’autre parent${NB}: la déduction pour frais de garde suit la déduction pour enfant (Steuerbuch StB 45 Nr. 14), elle n’est donc pas comptée ici.`,
  },
  catchUp2025: {
    en: 'A pillar 3a catch-up payment (Einkauf in die Säule 3a) can be deducted from the 2026 return on, for gaps from 2025: it is not deducted in 2025.',
    fr: `Un rachat dans le pilier 3a (Einkauf in die Säule 3a) se déduit dès la déclaration 2026, pour des lacunes dès 2025${NB}: il n’est pas déduit en 2025.`,
  },
  catchUpCap: {
    en: 'Pillar 3a catch-up (Einkauf in die Säule 3a): the deduction is at most the small pillar 3a maximum (Merkblatt 8); the rest is not deducted.',
    fr: `Rachat dans le pilier 3a (Einkauf in die Säule 3a)${NB}: la déduction est au plus le petit montant maximal du pilier 3a (Merkblatt 8)${NB}; le reste n’est pas déduit.`,
  },
  trainingFlat2026: {
    en: 'Professional training (16.4): the 2025 guide lets employees deduct a flat amount without proof for the cantonal tax; no 2026 document gives it yet, so only what you paid is deducted.',
    fr: `Formation professionnelle (16.4)${NB}: le guide 2025 permet aux salariés de déduire un forfait sans justificatif pour l’impôt cantonal${NB}; aucun document 2026 ne le donne encore, seul ce que vous avez payé est déduit.`,
  },
  insuranceNone: {
    en: 'Insurance premiums and savings interest (Versicherungsprämien und Sparzinsen, 14): none were given, so nothing is deducted. Health insurance premiums usually are.',
    fr: `Primes d’assurance et intérêts de l’épargne (Versicherungsprämien und Sparzinsen, 14)${NB}: aucun montant n’est indiqué, rien n’est donc déduit. Les primes d’assurance maladie le sont d’habitude.`,
  },
  savingsInterest: {
    en: 'Savings interest (Sparzinsen) also counts toward the insurance deduction (14, up to its maximum); it was not given apart from the other income of your accounts, so it is not counted there.',
    fr: `Les intérêts de l’épargne (Sparzinsen) comptent aussi dans la déduction pour assurances (14, jusqu’à son maximum)${NB}; ils ne sont pas indiqués à part des autres revenus de vos comptes, ils n’y sont donc pas comptés.`,
  },
  drivingDetails: {
    en: 'Travel by car without usable public transport: give the km one way and the days driven to count it.',
    fr: `Trajet en voiture sans transports publics utilisables${NB}: indiquez les km pour un aller et les jours de trajet pour le compter.`,
  },
  transitDetails: {
    en: 'Travel to work: give what public transport cost in the year (or would have cost) to count it.',
    fr: `Trajet jusqu’au travail${NB}: indiquez ce qu’ont coûté (ou auraient coûté) les transports publics dans l’année pour le compter.`,
  },
  donationsMinimum: {
    en: 'Donations (freiwillige Zuwendungen, 21.3) count once they reach CHF 100 in the year: yours are under that.',
    fr: `Les dons (freiwillige Zuwendungen, 21.3) comptent dès qu’ils atteignent CHF 100 dans l’année${NB}: les vôtres sont en dessous.`,
  },
  medicalThreshold: {
    en: 'Illness and accident costs (Krankheits- und Unfallkosten, 21.1): only the part above 2 percent of your Nettoeinkommen counts, and yours are under it.',
    fr: `Frais de maladie et d’accident (Krankheits- und Unfallkosten, 21.1)${NB}: seule la part au-delà de 2${NB}% du revenu net (Nettoeinkommen) compte, et les vôtres sont en dessous.`,
  },
} satisfies Record<string, Text>;

/** The church areas of a commune, for the question that names them. */
export function churchAreaNote(commune: string, areas: readonly string[]): Text {
  const list = areas.join(', ');
  return {
    en: `Church tax: the church areas (Kirchgemeinden) of ${commune} levy different rates. Say which one you live in: ${list}.`,
    fr: `Impôt ecclésiastique${NB}: les paroisses (Kirchgemeinden) de ${commune} ont des taux différents. Dites dans laquelle vous habitez${NB}: ${list}.`,
  };
}
