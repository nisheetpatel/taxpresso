// Plain-words texts the engine attaches to a result (SPEC.md section 11b: second person, plain
// words, official French terms next to their gloss), so Claude can explain without stating rules
// from memory.
import { IFD_NOTE } from '@taxpresso/rules-ch';
import type { TaxYear } from './params.js';
import type { EstimateReason, Text } from './types.js';

const NB = '\u00a0';

export const ESTIMATE_TEXT: Record<EstimateReason, Text> = {
  'ge-2026-unpublished': {
    en: 'Geneva publishes its 2026 scales and amounts in January 2027. Until then the 2025 values are used for the cantonal and communal tax, so its figures are estimates.',
    fr: `Genève publie ses barèmes et montants 2026 en janvier 2027. D’ici là, les valeurs 2025 sont utilisées pour l’impôt cantonal et communal${NB}: ses montants sont des estimations.`,
  },
};

export const NOTE = {
  ages: {
    en: 'Health premium limits: adults are taken as 26 or older and children as 18 or younger, unless their age was given.',
    fr: `Limites des primes d’assurance-maladie${NB}: les adultes sont comptés dès 26 ans et les enfants jusqu’à 18 ans, sauf si leur âge est indiqué.`,
  },
  under14: {
    en: 'Childcare: the children are taken as under 14, unless their age was given.',
    fr: `Frais de garde${NB}: les enfants sont comptés comme ayant moins de 14 ans, sauf si leur âge est indiqué.`,
  },
  childcareAge: {
    en: 'Childcare (frais de garde, 59.10 and 59.12) counts only up to the month of the child’s 14th birthday (guide p. 30). The costs given for a child of 14 or more at the end of the year are not counted here.',
    fr: `Les frais de garde (59.10 et 59.12) ne comptent que jusqu’au mois du 14e anniversaire de l’enfant (guide p. 30). Les frais indiqués pour un enfant de 14 ans ou plus à la fin de l’année ne sont pas comptés ici.`,
  },
  partialSplitting: {
    en: 'Shared custody: partial splitting (55.56 %) assumes a judgment or a signed agreement that you share the children’s care and costs half and half (LIPP art. 41 al. 4). Otherwise the parent who mainly supports them gets full splitting.',
    fr: `Garde alternée${NB}: le splitting partiel (55,56${NB}%) suppose un jugement ou une convention signée prévoyant une prise en charge et des frais partagés pour moitié (LIPP art. 41 al. 4). Sinon, le parent qui assume l’essentiel de l’entretien a le splitting intégral.`,
  },
  sharedCharges: {
    en: 'Shared custody without child support: each child counts as half a family charge (half the cantonal and federal child deductions, half the federal insurance amount per child, half the wealth deduction per child); the parent on the federal parental scale gets the whole reduction per child.',
    fr: `Garde alternée sans contribution d’entretien${NB}: chaque enfant compte pour une demi-charge de famille (moitié des déductions pour enfants, cantonale et fédérale, du montant fédéral d’assurance par enfant et de la déduction sur la fortune par enfant)${NB}; le parent au barème parental fédéral a toute la réduction par enfant.`,
  },
  ifdShared: IFD_NOTE.ifdShared,
  supportReceived: {
    en: 'Shared custody, child support received: you count as the parent who mainly supports the children, so they are full family charges here, with full splitting and the federal parental scale (barème parental).',
    fr: `Garde alternée, contribution d’entretien reçue${NB}: vous êtes le parent qui assure l’essentiel de l’entretien, les enfants sont donc des charges de famille entières ici, avec le splitting intégral et le barème parental fédéral.`,
  },
  supportPaid: {
    en: 'Shared custody, child support paid: the children count for the other parent, so no family charge, child deduction or parental scale here; the child support itself is what you deduct (53.10).',
    fr: `Garde alternée, contribution d’entretien versée${NB}: les enfants comptent pour l’autre parent, donc ni charge de famille, ni déduction pour enfant, ni barème parental ici${NB}; c’est la contribution elle-même que vous déduisez (53.10).`,
  },
  iccCommutePricing: {
    en: 'Travel costs, cantonal tax: the Geneva guide caps them whatever the means of transport (p. 19 and 21) without saying how a bike or the kilometres are priced; Taxpresso prices them as the federal tax does (Form. 2a 2026 p. 6), then applies the Geneva cap.',
    fr: `Frais de déplacement, impôt cantonal${NB}: le guide genevois les plafonne quel que soit le moyen de transport (p. 19 et 21) sans dire comment compter un vélo ou les kilomètres${NB}; Taxpresso les compte comme l’impôt fédéral (formule 2a 2026 p. 6), puis applique le plafond genevois.`,
  },
  bikeFlat: IFD_NOTE.bikeFlat,
  mealsIccLimited: {
    en: 'Meals (frais de repas), cantonal tax: counted only when the trip to work by public transport takes over 2 hours a day (guide p. 19), so here they count for the federal tax only.',
    fr: `Frais de repas, impôt cantonal${NB}: comptés seulement si le trajet en transports publics dépasse 2 heures par jour (guide p. 19)${NB}; ici, ils comptent pour l’impôt fédéral seulement.`,
  },
  workFromHome: {
    en: 'Working from home almost every day: no travel costs or meals are counted, as neither is deductible on days worked from home (guide p. 20).',
    fr: `Télétravail presque tous les jours${NB}: ni frais de déplacement ni frais de repas ne sont comptés, car ils ne sont pas déductibles les jours de télétravail (guide p. 20).`,
  },
  shield: {
    en: 'Cantonal and communal tax not computed: your income and wealth taxes may exceed 60 % of your taxable income, where the tax shield (bouclier fiscal, LIPP art. 60) lowers the wealth tax. Taxpresso does not compute the shield yet; GeTax does.',
    fr: `Impôt cantonal et communal non calculé${NB}: vos impôts sur le revenu et la fortune pourraient dépasser 60${NB}% du revenu imposable, seuil du bouclier fiscal (LIPP art. 60) qui réduit l’impôt sur la fortune. Taxpresso ne le calcule pas encore${NB}; GeTax le fait.`,
  },
  lineRounding: {
    en: 'Each cantonal and communal line (centimes, reduction, home care, communal shares) is rounded to the nearest 5 centimes, like every amount in the official tariff; the tariff does not spell out the rounding of these lines.',
    fr: `Chaque ligne cantonale et communale (centimes, diminution, aide à domicile, parts communales) est arrondie aux 5 centimes les plus proches, comme tous les montants du barème officiel${NB}; le barème ne précise pas l’arrondi de ces lignes.`,
  },
  communalSplit: {
    en: 'Salary earned in another commune: the rest of the base tax after the privileged share is split in proportion to the gross salary earned in each commune (LCP art. 295A).',
    fr: `Salaire gagné dans une autre commune${NB}: le solde de l’impôt de base après la part privilégiée est réparti au prorata du salaire brut gagné dans chaque commune (LCP art. 295A).`,
  },
  subsidyIfd: {
    en: 'Health insurance subsidy: income for the cantonal tax (guide p. 27); for the federal tax it is left out of income (LIFD art. 24 let. d) and only the premiums left to pay are deducted. The Geneva guide does not say how the federal tax treats it.',
    fr: `Subside d’assurance-maladie${NB}: revenu pour l’impôt cantonal (guide p. 27)${NB}; pour l’impôt fédéral, il n’est pas compté comme revenu (LIFD art. 24 let. d) et seules les primes restant à charge sont déduites. Le guide genevois ne précise pas le traitement fédéral.`,
  },
  coupleOrder: {
    en: 'The federal married couple deduction (59.20) is taken before the medical costs and donations limits, as on the Geneva form; the federal law counts it among the social deductions, after them.',
    fr: `La déduction fédérale pour conjoints (59.20) est prise avant les limites des frais médicaux et des dons, comme sur la formule genevoise${NB}; la loi fédérale la classe parmi les déductions sociales, après elles.`,
  },
  personalTax: {
    en: 'Taxe personnelle: not due when you have no taxable wealth and a taxable income under the law’s limit (LCP art. 377); the law says "revenu", read here as the taxable income.',
    fr: `Taxe personnelle${NB}: pas due sans fortune imposable et avec un revenu imposable sous la limite de la loi (LCP art. 377)${NB}; la loi dit «${NB}revenu${NB}», lu ici comme le revenu imposable.`,
  },
  capitalBuyIn: {
    en: 'Tax on your income not computed: you bought into your pension fund and took a lump sum from the 2nd pillar in the same year. The tax office may take back the buy-in’s deduction (rachat, 31.30; LPP art. 79b al. 3; guide p. 18), and the documents don’t say how much. The tax on the lump sum itself is computed. GeTax or the AFC can tell you more.',
    fr: `Impôt sur votre revenu non calculé${NB}: vous avez fait un rachat dans votre caisse de pension et reçu un capital du 2e pilier la même année. L’administration peut supprimer la déduction du rachat (31.30${NB}; LPP art. 79b al. 3${NB}; guide p. 18), et les documents ne disent pas de combien. L’impôt sur le capital lui-même est calculé. GeTax ou l’AFC peuvent vous en dire plus.`,
  },
  capitalRounding: {
    en: 'Tax on pension capital, cantonal and communal: a fifth of the scale’s tax and each line after it are rounded to the nearest 5 centimes, and the commune of residence taxes the whole base. The AFC’s capital tariffs give the same rates to the hundredth of a percent (ge-2025-source-capital-icc-tariff); they don’t spell out the rounding of each line.',
    fr: `Impôt cantonal et communal sur les prestations en capital${NB}: le cinquième de l’impôt du barème et chaque ligne qui suit sont arrondis aux 5 centimes les plus proches, et la commune de domicile impose toute la base. Les barèmes de l’AFC pour les prestations en capital donnent les mêmes taux au centième de pour cent (ge-2025-source-capital-icc-tariff)${NB}; ils ne précisent pas l’arrondi de chaque ligne.`,
  },
  halfFranc: {
    en: 'Life insurance limit (52.15): half as much again gives a half franc, rounded down.',
    fr: `Limite assurance-vie (52.15)${NB}: l’augmentation de moitié donne un demi-franc, arrondi vers le bas.`,
  },
} as const satisfies Record<string, Text>;

/**
 * The note on pricing travel costs for the cantonal tax, by tax year: it cites that year's document
 * for the federal pricing (docs/design/tax-years.md). For 2025, whose federal instructions are not
 * in the library, the 2025 guide gives the federal pricing itself (p. 20).
 */
export const ICC_COMMUTE_PRICING: Readonly<Record<TaxYear, Text>> = {
  2025: {
    en: 'Travel costs, cantonal tax: the Geneva guide caps them whatever the means of transport (p. 19 and 21) without saying how a bike or the kilometres are priced; Taxpresso prices them as the federal tax does (guide p. 20), then applies the Geneva cap.',
    fr: `Frais de déplacement, impôt cantonal${NB}: le guide genevois les plafonne quel que soit le moyen de transport (p. 19 et 21) sans dire comment compter un vélo ou les kilomètres${NB}; Taxpresso les compte comme l’impôt fédéral (guide p. 20), puis applique le plafond genevois.`,
  },
  2026: NOTE.iccCommutePricing,
};
