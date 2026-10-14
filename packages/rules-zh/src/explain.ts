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
  rounding: {
    en: 'Rounding: the official documents Taxpresso has for Zurich don’t say whether the taxable income and wealth are rounded (to CHF 100 or 1,000, for example) before the tariff, or how the tax is rounded. Taxpresso applies the tariff to whole francs and rounds each tax to the centime, so a bill can differ by a few francs.',
    fr: `Arrondis${NB}: les documents officiels dont dispose Taxpresso pour Zurich ne disent pas si le revenu et la fortune imposables sont arrondis (à CHF 100 ou 1’000, par exemple) avant le barème, ni comment l’impôt est arrondi. Taxpresso applique le barème aux francs entiers et arrondit chaque impôt au centime${NB}: un bordereau peut différer de quelques francs.`,
  },
  childSupport: {
    en: 'Shared parental authority: whether you receive or pay child support decides who counts the children (child deduction, married tariff). Answer the question on child support.',
    fr: `Autorité parentale conjointe${NB}: recevoir ou verser une contribution d’entretien décide qui compte les enfants (déduction pour enfants, barème des personnes mariées). Répondez à la question sur la contribution d’entretien.`,
  },
  marriedTariff: {
    en: 'Shared custody without child support: the married tariff (Verheiratetentarif) goes to the parent who mainly supports the children from taxed income, as a rule the one who earns more (Weisung ZStB 34.1). Say whether that is you.',
    fr: `Garde partagée sans contribution d’entretien${NB}: le barème des personnes mariées (Verheiratetentarif) revient au parent qui assume l’essentiel de l’entretien avec ses revenus imposés, en règle générale celui qui gagne le plus (directive ZStB 34.1). Dites si c’est vous.`,
  },
  selfEmployed: {
    en: 'Self-employment (selbständige Erwerbstätigkeit, Hilfsblatt A) is not supported yet: the tax is not computed.',
    fr: `L’activité indépendante (selbständige Erwerbstätigkeit, Hilfsblatt A) n’est pas encore prise en charge${NB}: l’impôt n’est pas calculé.`,
  },
  communeVariant: {
    en: 'Your commune has parts with different multipliers (for example two school districts). Say which part you live in: the official table numbers them 1, 2 or 3 without naming them, so ask your commune’s tax office (Gemeindesteueramt) if unsure.',
    fr: `Votre commune a des parties avec des coefficients différents (par exemple deux arrondissements scolaires). Dites dans laquelle vous habitez${NB}: le tableau officiel les numérote 1, 2 ou 3 sans les nommer, demandez à l’office des impôts de la commune (Gemeindesteueramt) en cas de doute.`,
  },
  parish: {
    en: 'Your commune has two parishes of your church with different church tax multipliers. Say which one (1 or 2) you belong to.',
    fr: `Votre commune compte deux paroisses de votre Église avec des coefficients d’impôt ecclésiastique différents. Dites à laquelle (1 ou 2) vous appartenez.`,
  },
  pensions100: {
    en: 'Pensions are counted at 100 %. Some are taxed at a lower share (for example 80 % for some pension fund pensions that began before 2002, or only the income share of a life annuity): the guide explains which (Wegleitung 2025 p. 11).',
    fr: `Les rentes sont comptées à 100${NB}%. Certaines le sont à une part moindre (par exemple 80${NB}% pour certaines rentes de caisse de pension ayant commencé avant 2002, ou seulement la part de rendement d’une rente viagère)${NB}: le guide explique lesquelles (Wegleitung 2025 p. 11).`,
  },
  days240: {
    en: 'Driving to work: the days are limited to 240 a year, as the form does as a rule (Berufsauslagen, Ziffer 1.3).',
    fr: `Trajets en voiture${NB}: les jours sont limités à 240 par an, comme le formulaire le fait en règle générale (Berufsauslagen, chiffre 1.3).`,
  },
  transitPrice: {
    en: 'Travel to work not counted: when public transport can be used, the deduction is the price of the pass (Abonnement). Give that price.',
    fr: `Frais de déplacement non comptés${NB}: si les transports publics sont utilisables, la déduction est le prix de l’abonnement. Indiquez ce prix.`,
  },
  drivingDetails: {
    en: 'Travel to work by car or motorbike not counted: give the kilometres one way and the days driven.',
    fr: `Trajets en voiture ou moto non comptés${NB}: indiquez les kilomètres aller et le nombre de jours.`,
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
    en: 'Other professional costs: your actual costs are higher than the 3 % flat amount and are used instead; they must be listed and proven in full (Verfügung 631.33, Ziff. IV).',
    fr: `Autres frais professionnels${NB}: vos frais effectifs dépassent le forfait de 3${NB}% et le remplacent${NB}; ils doivent être listés et entièrement justifiés (Verfügung 631.33, ch. IV).`,
  },
  pillar3aAbove: {
    en: 'Pillar 3a: what you paid above the limit is not deductible.',
    fr: `Pilier 3a${NB}: ce que vous avez versé au-delà du plafond n’est pas déductible.`,
  },
  childcareWork: {
    en: 'Childcare (Kinderdrittbetreuung) is deductible only when the parents caring for the child work, train or can’t work; for a married couple, both. It is not counted here.',
    fr: `Les frais de garde (Kinderdrittbetreuung) ne sont déductibles que si les parents qui s’occupent de l’enfant travaillent, se forment ou sont incapables de travailler${NB}; pour un couple marié, les deux. Ils ne sont pas comptés ici.`,
  },
  under14: {
    en: 'Childcare: the children are taken as under 14, unless their age was given.',
    fr: `Frais de garde${NB}: les enfants sont comptés comme ayant moins de 14 ans, sauf si leur âge est indiqué.`,
  },
  medicalBelow: {
    en: 'Medical costs: below 5 % of the net income (Nettoeinkommen, line 310), nothing is deductible.',
    fr: `Frais médicaux${NB}: en dessous de 5${NB}% du revenu net (Nettoeinkommen, ligne 310), rien n’est déductible.`,
  },
  donationsMin: {
    en: 'Donations: under CHF 100 in the year, nothing is deductible.',
    fr: `Dons${NB}: en dessous de CHF 100 dans l’année, rien n’est déductible.`,
  },
} satisfies Record<string, Text>;
