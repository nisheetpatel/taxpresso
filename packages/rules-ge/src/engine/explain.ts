// Plain-words texts the engine attaches to a result (SPEC.md section 11b: second person, plain
// words, official French terms next to their gloss), so Claude can explain without stating rules
// from memory.
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
  partialSplitting: {
    en: 'Shared custody: partial splitting (55.56 %) assumes a judgment or a signed agreement that you share the children’s care and costs half and half (LIPP art. 41 al. 4). Otherwise the parent who mainly supports them gets full splitting.',
    fr: `Garde alternée${NB}: le splitting partiel (55,56${NB}%) suppose un jugement ou une convention signée prévoyant une prise en charge et des frais partagés pour moitié (LIPP art. 41 al. 4). Sinon, le parent qui assume l’essentiel de l’entretien a le splitting intégral.`,
  },
  sharedCharges: {
    en: 'Shared custody: each child counts as half a family charge (half the cantonal and federal child deductions, half the wealth deduction per child), and the federal scale reduction counts each child.',
    fr: `Garde alternée${NB}: chaque enfant compte pour une demi-charge de famille (moitié des déductions pour enfants, cantonale et fédérale, et de la déduction sur la fortune par enfant), et la réduction du barème fédéral compte chaque enfant.`,
  },
  sharedInsurance: {
    en: 'Shared custody: the federal insurance limit adds 700 for each child.',
    fr: `Garde alternée${NB}: la limite fédérale des primes d’assurance ajoute 700 par enfant.`,
  },
  ifdShared: {
    en: 'Federal tax not computed: with shared custody, which parent gets the parental scale depends on who mainly supports the children, and the documents Taxpresso has don’t settle it. Tell Taxpresso whether you do.',
    fr: `Impôt fédéral non calculé${NB}: en garde alternée, le barème parental revient au parent qui assume l’essentiel de l’entretien, et les documents dont dispose Taxpresso ne permettent pas de trancher. Indiquez si c’est votre cas.`,
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
  halfFranc: {
    en: 'Life insurance limit (52.15): half as much again gives a half franc, rounded down.',
    fr: `Limite assurance-vie (52.15)${NB}: l’augmentation de moitié donne un demi-franc, arrondi vers le bas.`,
  },
} as const satisfies Record<string, Text>;
