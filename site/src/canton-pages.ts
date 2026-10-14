// Copy for the canton reference pages (/<lang>/<canton>/) and their index (/<lang>/cantons/), in
// every language of the site. Same voice as content.ts and geneva.ts: vous in French, the informal
// you in German, Italian, Spanish and Portuguese, Swiss spelling in German, no en or em dashes. No
// numbers and no canton names here: {placeholders} are filled from cantons.ts ({canton}), from the
// canton's figures module ({term}, {base}, {tax}: the canton's own words, next to their gloss here)
// and from the cited constants of the rules packages (every amount, share and year). A native
// speaker reviews each language before launch (SPEC.md section 1).

import type { Lang } from './content.ts';
import type { Church, DeductionId, How, LimitText } from './figures/shared.ts';
import { frenchSpacing } from './guides.ts';

export interface CantonPagesCopy {
  index: {
    htmlTitle: string;
    metaDescription: string;
    /** The footer link. */
    link: string;
    title: string;
    lead: string;
    open: string;
    /** A canton's card: "{term}" is its communal multiplier. */
    summary: string;
    /** Geneva's card, which links to its own pages. */
    geneva: string;
    /** On the card of a canton that is a preview in Taxpresso. */
    preview: string;
  };
  htmlTitle: string;
  metaDescription: string;
  title: string;
  lead: string;
  /** Where the canton is a preview in Taxpresso. */
  preview: string;
  onThisPage: string;
  basis: string;
  disclaimer: string;
  cta: { title: string; text: string };
  others: string;
  all: string;
  communes: {
    title: string;
    how: Record<How, string>;
    church: string;
    canton: string;
    incomeWealth: string;
    wide: string;
    colCommune: string;
    parts: string;
    empty: string;
  };
  churches: Record<Church, string>;
  deductions: {
    title: string;
    intro: string;
    tax: { cantonal: string; federal: string; both: string };
    names: Record<DeductionId, string>;
    limits: Record<LimitText, string>;
  };
}

const en: CantonPagesCopy = {
  index: {
    htmlTitle: 'Swiss tax figures by canton {year}: communal rates and deductions · Taxpresso',
    metaDescription:
      'Tax figures for {year}, canton by canton, each with its official source: the communal tax rate of every commune and the main deductions with their limits.',
    link: 'Tax figures by canton',
    title: 'Tax figures by canton',
    lead: 'Communal tax rates and the main deductions, canton by canton, each with its official source.',
    open: 'See the figures',
    summary: 'The communal multiplier ({term}) of every commune and the main deductions.',
    geneva: 'Centimes additionnels, pillar 3a limits, deadlines and deductions.',
    preview: 'A preview in Taxpresso',
  },
  htmlTitle: '{canton} tax figures {year}: communal rates and deductions · Taxpresso',
  metaDescription:
    '{canton} tax figures for {year}, each with its official source: the communal multiplier ({term}) of every commune and the main deductions with their limits.',
  title: '{canton} tax figures',
  lead: 'The figures that matter for your tax return, each with its official source: what each commune levies, and the main deductions.',
  preview:
    '{canton} works in Taxpresso as a preview: it prepares your return and tells you what it doesn’t cover yet.',
  onThisPage: 'On this page:',
  basis:
    'Every figure on this page comes from Taxpresso’s own code, where it cites the official document shown next to it.',
  disclaimer:
    'This page is a reference, not tax advice. If in doubt, ask your canton’s tax office.',
  cta: {
    title: 'Let Taxpresso do the paperwork',
    text: 'Taxpresso prepares your tax return with Claude, on your own computer. Free and open source.',
  },
  others: 'Other cantons',
  all: 'All cantons',
  communes: {
    title: 'Communal tax rates ({term})',
    how: {
      percent:
        'Each commune sets its own multiplier ({term}), in percent of the cantonal base tax ({base}): the higher it is, the more communal tax you pay.',
      multiple:
        'Each commune sets its own multiplier ({term}), as a multiple of the cantonal base tax ({base}): the higher it is, the more communal tax you pay.',
      units:
        'Your tax is the tax per unit ({base}) times the units ({term}) of the canton, of your commune and, if you belong to one, of your parish: the more units, the more tax you pay.',
      shares:
        'In some communes the canton levies the whole tax. In the others it levies its share ({base}), and the commune levies its own multiplier ({term}) on top, in percent of the tax worked out under the law.',
    },
    church:
      'If you belong to a recognised church, it levies its own church tax: its rate is in the table too.',
    canton: 'The canton’s own multiplier ({term}):',
    incomeWealth: '{income} on income, {wealth} on wealth',
    wide: 'The same in every commune:',
    colCommune: 'Commune',
    parts:
      'Where the parts of a commune or its parishes have different rates, the table shows each of them.',
    empty: 'An empty cell means the official source gives no rate for that year.',
  },
  churches: {
    reformed: 'Reformed church',
    catholic: 'Catholic church',
    christCatholic: 'Christ Catholic church',
    reformedOfIncome: 'Reformed church, % of taxable income',
    christCatholicOfIncome: 'Christ Catholic church, % of taxable income',
    catholicOnIncome: 'Catholic parish, on income',
    reformedOnIncome: 'Reformed parish, on income',
  },
  deductions: {
    title: 'Deductions and their limits {year}',
    intro:
      'Deductions lower your taxable income. The canton’s tax ({tax}) and the federal direct tax each set their own limits. Here are the main ones Taxpresso’s code holds, each with its source; your canton’s official guide lists them all.',
    tax: {
      cantonal: 'Cantonal and communal tax',
      federal: 'Federal direct tax',
      both: 'Cantonal, communal and federal tax',
    },
    names: {
      professional: 'Other professional expenses, flat deduction',
      commute: 'Travel to work',
      meals: 'Meals away from home',
      pillar3a: 'Pillar 3a',
      insurance: 'Insurance premiums and interest on savings',
      debtInterest: 'Private debt interest',
      childcare: 'Childcare by others',
      training: 'Professional training',
      twoEarner: 'Both spouses work',
      party: 'Donations to political parties',
      donations: 'Donations to charities',
      medical: 'Illness and accident costs',
      child: 'Deduction per child',
      childTaxReduction: 'Tax reduction per child',
    },
    limits: {
      shareMinMax: '{rate} of your net salary, at least {min} and at most {max}',
      baseShareMax: '{base} plus {rate} of your net salary, at most {max}',
      flat: 'A flat {amount}',
      perYear: 'At most {max} a year',
      meals: '{perDay} a day, at most {perYear} a year',
      mealsYear: 'At most {perYear} a year',
      pillar3a:
        'With a pension fund: up to {withFund}. Without one: {share} of your earned income, at most {withoutFund}.',
      family:
        'At most {married} for a married couple, {other} for everyone else, plus {perChild} per child',
      couple: 'At most {married} for a married couple and {other} for everyone else',
      flatCouple:
        'A flat {married} for a married couple and {other} for everyone else, whatever you paid',
      noPension:
        'Without contributions to a pension fund or pillar 3a: at most {married} for a married couple and {other} for everyone else',
      noPensionMore:
        'Without contributions to a pension fund or pillar 3a: {married} more for a married couple and {other} more for everyone else',
      noPensionShare:
        'Without contributions to a pension fund or pillar 3a: {share} of the amount for a married couple or for everyone else',
      premiums:
        'Insurance premiums: at most {married} for a married couple, {other} for everyone else, plus {perChild} per child',
      savings:
        'Interest on savings: at most {married} for a married couple, {other} for everyone else, plus {perChild} per child',
      savingsCouple:
        'Interest on savings: at most {married} for a married couple and {other} for everyone else',
      life: 'Life and other insurance premiums: at most {married} for a married couple and {other} for everyone else',
      health:
        'Health and accident insurance: a flat {adult} per adult, {young} per young adult in training and {child} per child, less any premium subsidy',
      atMost: 'At most {max}',
      perPersonMax: 'At most {max} per person',
      perChildMax: 'At most {max} per child',
      debtInterest: 'Up to your income from wealth plus {extra}',
      twoEarnerMax: 'At most {max}, and no more than the lower earned income',
      twoEarnerShare: '{share} of the lower earned income, at least {min} and at most {max}',
      twoEarnerBoth: '{share} of the two earned incomes together, at most {max}',
      twoEarnerFixed: '{amount} when you both have earned income',
      donations: 'From {min} in the year, up to {share} of your net income',
      medical: 'The part above {share} of your net income',
      child: '{amount} per child',
      childAge:
        'By age: {young} for a young child, {teen} for a teenager, {adult} for an adult child in education',
      childAway: '{base} per child, {away} for a child in education away from home',
      childSchool:
        '{preschool} for a child not yet at school, {school} for a child at school or in training',
      childOlder: '{base} per child, plus {extra} for an older child',
      childThird:
        '{first} per child, {fromThird} from the third child on; less above an income limit',
      taxReduction: '{amount} off the tax itself, per child',
    },
  },
};

// French: plain spaces before ? ! : ; here, frenchSpacing makes them non-breaking.
const fr: CantonPagesCopy = frenchSpacing({
  index: {
    htmlTitle: 'Repères fiscaux par canton {year} : taux communaux et déductions · Taxpresso',
    metaDescription:
      'Les chiffres fiscaux {year}, canton par canton, chacun avec sa source officielle : le taux communal de chaque commune et les principales déductions avec leurs plafonds.',
    link: 'Repères fiscaux par canton',
    title: 'Repères fiscaux par canton',
    lead: 'Les taux communaux et les principales déductions, canton par canton, chacun avec sa source officielle.',
    open: 'Voir les chiffres',
    summary: 'Le taux communal ({term}) de chaque commune et les principales déductions.',
    geneva: 'Centimes additionnels, plafonds du 3e pilier A, délais et déductions.',
    preview: 'En avant-première dans Taxpresso',
  },
  htmlTitle: '{canton} : repères fiscaux {year}, taux communaux et déductions · Taxpresso',
  metaDescription:
    '{canton} : les chiffres fiscaux {year}, chacun avec sa source officielle : le taux communal ({term}) de chaque commune et les principales déductions avec leurs plafonds.',
  title: '{canton} : repères fiscaux',
  lead: 'Les chiffres qui comptent pour votre déclaration, chacun avec sa source officielle : ce que prélève chaque commune, et les principales déductions.',
  preview:
    'Dans Taxpresso, {canton} fonctionne en avant-première : Taxpresso prépare votre déclaration et vous dit ce qu’il ne couvre pas encore.',
  onThisPage: 'Sur cette page :',
  basis:
    'Chaque chiffre de cette page vient du code de Taxpresso, où il cite le document officiel indiqué à côté.',
  disclaimer:
    'Cette page est un repère, pas un conseil fiscal. En cas de doute, demandez à l’administration fiscale de votre canton.',
  cta: {
    title: 'Laissez Taxpresso s’en occuper',
    text: 'Taxpresso prépare votre déclaration avec Claude, sur votre ordinateur. Gratuit et open source.',
  },
  others: 'Les autres cantons',
  all: 'Tous les cantons',
  communes: {
    title: 'Taux communaux ({term})',
    how: {
      percent:
        'Chaque commune fixe son propre taux ({term}), en pour cent de l’impôt cantonal simple ({base}) : plus il est élevé, plus vous payez d’impôt communal.',
      multiple:
        'Chaque commune fixe son propre taux ({term}), en multiple de l’impôt cantonal simple ({base}) : plus il est élevé, plus vous payez d’impôt communal.',
      units:
        'Votre impôt est l’impôt par unité ({base}) multiplié par les unités ({term}) du canton, de votre commune et, si vous en êtes membre, de votre paroisse : plus il y a d’unités, plus vous payez d’impôt.',
      shares:
        'Dans certaines communes, le canton prélève tout l’impôt. Dans les autres, il en prélève sa part ({base}), et la commune y ajoute son propre taux ({term}), en pour cent de l’impôt calculé selon la loi.',
    },
    church:
      'Si vous êtes membre d’une Église reconnue, elle prélève son propre impôt ecclésiastique : son taux figure aussi dans le tableau.',
    canton: 'Le taux du canton lui-même ({term}) :',
    incomeWealth: '{income} sur le revenu, {wealth} sur la fortune',
    wide: 'Le même dans toutes les communes :',
    colCommune: 'Commune',
    parts:
      'Lorsque les parties d’une commune ou ses paroisses ont des taux différents, le tableau les montre tous.',
    empty: 'Une case vide signifie que la source officielle ne donne pas de taux pour cette année.',
  },
  churches: {
    reformed: 'Église réformée',
    catholic: 'Église catholique',
    christCatholic: 'Église catholique-chrétienne',
    reformedOfIncome: 'Église réformée, % du revenu imposable',
    christCatholicOfIncome: 'Église catholique-chrétienne, % du revenu imposable',
    catholicOnIncome: 'Paroisse catholique, sur le revenu',
    reformedOnIncome: 'Paroisse réformée, sur le revenu',
  },
  deductions: {
    title: 'Déductions et plafonds {year}',
    intro:
      'Les déductions réduisent votre revenu imposable. L’impôt du canton ({tax}) et l’impôt fédéral direct ont chacun leurs plafonds. Voici les principaux que contient le code de Taxpresso, chacun avec sa source ; le guide officiel de votre canton les liste tous.',
    tax: {
      cantonal: 'Impôt cantonal et communal',
      federal: 'Impôt fédéral direct',
      both: 'Impôts cantonal, communal et fédéral',
    },
    names: {
      professional: 'Autres frais professionnels, déduction forfaitaire',
      commute: 'Frais de déplacement pour le travail',
      meals: 'Repas pris à l’extérieur',
      pillar3a: '3e pilier A',
      insurance: 'Primes d’assurances et intérêts de capitaux d’épargne',
      debtInterest: 'Intérêts des dettes privées',
      childcare: 'Frais de garde des enfants par des tiers',
      training: 'Formation professionnelle',
      twoEarner: 'Les deux conjoints travaillent',
      party: 'Dons aux partis politiques',
      donations: 'Dons d’utilité publique',
      medical: 'Frais de maladie et d’accident',
      child: 'Déduction par enfant',
      childTaxReduction: 'Réduction d’impôt par enfant',
    },
    limits: {
      shareMinMax: '{rate} du salaire net, au moins {min} et au plus {max}',
      baseShareMax: '{base} plus {rate} du salaire net, au plus {max}',
      flat: 'Un forfait de {amount}',
      perYear: 'Au plus {max} par année',
      meals: '{perDay} par jour, au plus {perYear} par année',
      mealsYear: 'Au plus {perYear} par année',
      pillar3a:
        'Avec caisse de pension : jusqu’à {withFund}. Sans : {share} du revenu d’activité, au plus {withoutFund}.',
      family:
        'Au plus {married} pour un couple marié, {other} pour les autres contribuables, plus {perChild} par enfant',
      couple: 'Au plus {married} pour un couple marié et {other} pour les autres contribuables',
      flatCouple:
        'Un forfait de {married} pour un couple marié et de {other} pour les autres contribuables, quel que soit le montant payé',
      noPension:
        'Sans cotisations à une caisse de pension ni au 3e pilier A : au plus {married} pour un couple marié et {other} pour les autres contribuables',
      noPensionMore:
        'Sans cotisations à une caisse de pension ni au 3e pilier A : {married} de plus pour un couple marié et {other} de plus pour les autres contribuables',
      noPensionShare:
        'Sans cotisations à une caisse de pension ni au 3e pilier A : {share} du montant pour un couple marié ou pour les autres contribuables',
      premiums:
        'Primes d’assurances : au plus {married} pour un couple marié, {other} pour les autres contribuables, plus {perChild} par enfant',
      savings:
        'Intérêts de capitaux d’épargne : au plus {married} pour un couple marié, {other} pour les autres contribuables, plus {perChild} par enfant',
      savingsCouple:
        'Intérêts de capitaux d’épargne : au plus {married} pour un couple marié et {other} pour les autres contribuables',
      life: 'Assurance vie et autres primes : au plus {married} pour un couple marié et {other} pour les autres contribuables',
      health:
        'Assurance maladie et accidents : un forfait de {adult} par adulte, {young} par jeune adulte en formation et {child} par enfant, moins les subsides reçus',
      atMost: 'Au plus {max}',
      perPersonMax: 'Au plus {max} par personne',
      perChildMax: 'Au plus {max} par enfant',
      debtInterest: 'Jusqu’au rendement de votre fortune plus {extra}',
      twoEarnerMax: 'Au plus {max}, et pas plus que le revenu d’activité le plus bas',
      twoEarnerShare: '{share} du revenu d’activité le plus bas, au moins {min} et au plus {max}',
      twoEarnerBoth: '{share} des deux revenus d’activité ensemble, au plus {max}',
      twoEarnerFixed: '{amount} si vous avez tous deux un revenu d’activité',
      donations: 'À partir de {min} dans l’année, jusqu’à {share} du revenu net',
      medical: 'La part qui dépasse {share} du revenu net',
      child: '{amount} par enfant',
      childAge:
        'Selon l’âge : {young} pour un jeune enfant, {teen} pour un adolescent, {adult} pour un enfant majeur en formation',
      childAway: '{base} par enfant, {away} pour un enfant en formation hors du domicile',
      childSchool:
        '{preschool} pour un enfant pas encore scolarisé, {school} pour un enfant scolarisé ou en formation',
      childOlder: '{base} par enfant, plus {extra} pour un enfant plus âgé',
      childThird:
        '{first} par enfant, {fromThird} dès le troisième ; moins au-delà d’une limite de revenu',
      taxReduction: '{amount} de moins sur l’impôt lui-même, par enfant',
    },
  },
});

const de: CantonPagesCopy = {
  index: {
    htmlTitle: 'Steuerzahlen nach Kanton {year}: Gemeindesteuern und Abzüge · Taxpresso',
    metaDescription:
      'Die Steuerzahlen {year}, Kanton für Kanton, jede mit ihrer offiziellen Quelle: der Steuersatz jeder Gemeinde und die wichtigsten Abzüge mit ihren Obergrenzen.',
    link: 'Steuerzahlen nach Kanton',
    title: 'Steuerzahlen nach Kanton',
    lead: 'Gemeindesteuern und die wichtigsten Abzüge, Kanton für Kanton, jede Zahl mit ihrer offiziellen Quelle.',
    open: 'Zu den Zahlen',
    summary: 'Der Gemeindesteuersatz ({term}) jeder Gemeinde und die wichtigsten Abzüge.',
    geneva:
      'Gemeindezuschläge (centimes additionnels), Obergrenzen der Säule 3a, Fristen und Abzüge.',
    preview: 'Als Vorschau in Taxpresso',
  },
  htmlTitle: 'Kanton {canton}: Steuerzahlen {year}, Gemeindesteuern und Abzüge · Taxpresso',
  metaDescription:
    'Die Steuerzahlen {year} für den Kanton {canton}, jede mit ihrer offiziellen Quelle: der Gemeindesteuersatz ({term}) jeder Gemeinde und die wichtigsten Abzüge mit ihren Obergrenzen.',
  title: 'Kanton {canton}: Steuerzahlen',
  lead: 'Die Zahlen, die für deine Steuererklärung zählen, jede mit ihrer offiziellen Quelle: was jede Gemeinde erhebt, und die wichtigsten Abzüge.',
  preview:
    '{canton} funktioniert in Taxpresso als Vorschau: Taxpresso bereitet deine Steuererklärung vor und sagt dir, was es noch nicht abdeckt.',
  onThisPage: 'Auf dieser Seite:',
  basis:
    'Jede Zahl auf dieser Seite stammt aus dem Code von Taxpresso, wo sie das offizielle Dokument nennt, das daneben steht.',
  disclaimer:
    'Diese Seite ist eine Orientierungshilfe, keine Steuerberatung. Im Zweifel frag die Steuerverwaltung deines Kantons.',
  cta: {
    title: 'Lass Taxpresso den Papierkram machen',
    text: 'Taxpresso bereitet deine Steuererklärung mit Claude vor, auf deinem eigenen Computer. Kostenlos und Open Source.',
  },
  others: 'Weitere Kantone',
  all: 'Alle Kantone',
  communes: {
    title: 'Gemeindesteuern ({term})',
    how: {
      percent:
        'Jede Gemeinde legt ihren eigenen Satz fest ({term}), in Prozent der nach dem Tarif berechneten Steuer ({base}): Je höher er ist, desto mehr Gemeindesteuer zahlst du.',
      multiple:
        'Jede Gemeinde legt ihren eigenen Satz fest ({term}), als Vielfaches der nach dem Tarif berechneten Steuer ({base}): Je höher er ist, desto mehr Gemeindesteuer zahlst du.',
      units:
        'Deine Steuer ist die Steuer pro Einheit ({base}) mal die Einheiten ({term}) des Kantons, deiner Gemeinde und, wenn du einer angehörst, deiner Kirchgemeinde: Je mehr Einheiten, desto mehr Steuer zahlst du.',
      shares:
        'In einigen Gemeinden erhebt der Kanton die ganze Steuer. In den anderen erhebt er seinen Anteil ({base}), und die Gemeinde erhebt dazu ihren eigenen Satz ({term}), in Prozent der nach Gesetz berechneten Steuer.',
    },
    church:
      'Wenn du einer anerkannten Kirche angehörst, erhebt sie ihre eigene Kirchensteuer: Ihr Satz steht auch in der Tabelle.',
    canton: 'Der eigene Satz des Kantons ({term}):',
    incomeWealth: '{income} auf dem Einkommen, {wealth} auf dem Vermögen',
    wide: 'In allen Gemeinden gleich:',
    colCommune: 'Gemeinde',
    parts:
      'Wo die Teile einer Gemeinde oder ihre Kirchgemeinden verschiedene Sätze haben, zeigt die Tabelle jeden davon.',
    empty: 'Ein leeres Feld heisst: Die offizielle Quelle gibt für dieses Jahr keinen Satz an.',
  },
  churches: {
    reformed: 'Reformierte Kirche',
    catholic: 'Katholische Kirche',
    christCatholic: 'Christkatholische Kirche',
    reformedOfIncome: 'Reformierte Kirche, % des steuerbaren Einkommens',
    christCatholicOfIncome: 'Christkatholische Kirche, % des steuerbaren Einkommens',
    catholicOnIncome: 'Katholische Pfarrei, auf dem Einkommen',
    reformedOnIncome: 'Reformierte Kirchgemeinde, auf dem Einkommen',
  },
  deductions: {
    title: 'Abzüge und Obergrenzen {year}',
    intro:
      'Abzüge senken dein steuerbares Einkommen. Die Steuer des Kantons ({tax}) und die direkte Bundessteuer haben je eigene Obergrenzen. Hier sind die wichtigsten, die der Code von Taxpresso enthält, jede mit ihrer Quelle; die offizielle Wegleitung deines Kantons listet alle auf.',
    tax: {
      cantonal: 'Kantons- und Gemeindesteuer',
      federal: 'Direkte Bundessteuer',
      both: 'Kantons-, Gemeinde- und Bundessteuer',
    },
    names: {
      professional: 'Übrige Berufskosten, Pauschalabzug',
      commute: 'Fahrkosten zur Arbeit',
      meals: 'Auswärtige Verpflegung',
      pillar3a: 'Säule 3a',
      insurance: 'Versicherungsprämien und Sparzinsen',
      debtInterest: 'Private Schuldzinsen',
      childcare: 'Fremdbetreuung der Kinder',
      training: 'Berufliche Aus- und Weiterbildung',
      twoEarner: 'Beide Ehegatten arbeiten',
      party: 'Spenden an politische Parteien',
      donations: 'Gemeinnützige Spenden',
      medical: 'Krankheits- und Unfallkosten',
      child: 'Abzug pro Kind',
      childTaxReduction: 'Steuerermässigung pro Kind',
    },
    limits: {
      shareMinMax: '{rate} des Nettolohns, mindestens {min} und höchstens {max}',
      baseShareMax: '{base} plus {rate} des Nettolohns, höchstens {max}',
      flat: 'Pauschal {amount}',
      perYear: 'Höchstens {max} im Jahr',
      meals: '{perDay} pro Tag, höchstens {perYear} im Jahr',
      mealsYear: 'Höchstens {perYear} im Jahr',
      pillar3a:
        'Mit Pensionskasse: bis {withFund}. Ohne: {share} des Erwerbseinkommens, höchstens {withoutFund}.',
      family:
        'Höchstens {married} für Ehepaare, {other} für alle anderen, plus {perChild} pro Kind',
      couple: 'Höchstens {married} für Ehepaare und {other} für alle anderen',
      flatCouple:
        'Pauschal {married} für Ehepaare und {other} für alle anderen, egal wie viel du bezahlt hast',
      noPension:
        'Ohne Beiträge an eine Pensionskasse oder die Säule 3a: höchstens {married} für Ehepaare und {other} für alle anderen',
      noPensionMore:
        'Ohne Beiträge an eine Pensionskasse oder die Säule 3a: {married} mehr für Ehepaare und {other} mehr für alle anderen',
      noPensionShare:
        'Ohne Beiträge an eine Pensionskasse oder die Säule 3a: {share} des Betrags für Ehepaare oder für alle anderen',
      premiums:
        'Versicherungsprämien: höchstens {married} für Ehepaare, {other} für alle anderen, plus {perChild} pro Kind',
      savings:
        'Sparzinsen: höchstens {married} für Ehepaare, {other} für alle anderen, plus {perChild} pro Kind',
      savingsCouple: 'Sparzinsen: höchstens {married} für Ehepaare und {other} für alle anderen',
      life: 'Lebens- und andere Versicherungen: höchstens {married} für Ehepaare und {other} für alle anderen',
      health:
        'Kranken- und Unfallversicherung: pauschal {adult} pro erwachsene Person, {young} pro junge erwachsene Person in Ausbildung und {child} pro Kind, abzüglich Prämienverbilligung',
      atMost: 'Höchstens {max}',
      perPersonMax: 'Höchstens {max} pro Person',
      perChildMax: 'Höchstens {max} pro Kind',
      debtInterest: 'Bis zum Vermögensertrag plus {extra}',
      twoEarnerMax: 'Höchstens {max}, und nicht mehr als das tiefere Erwerbseinkommen',
      twoEarnerShare:
        '{share} des tieferen Erwerbseinkommens, mindestens {min} und höchstens {max}',
      twoEarnerBoth: '{share} der beiden Erwerbseinkommen zusammen, höchstens {max}',
      twoEarnerFixed: '{amount}, wenn ihr beide ein Erwerbseinkommen habt',
      donations: 'Ab {min} im Jahr, bis {share} des Nettoeinkommens',
      medical: 'Der Teil über {share} des Nettoeinkommens',
      child: '{amount} pro Kind',
      childAge:
        'Nach Alter: {young} für ein junges Kind, {teen} für ein Kind im Teenageralter, {adult} für ein volljähriges Kind in Ausbildung',
      childAway: '{base} pro Kind, {away} für ein Kind in auswärtiger Ausbildung',
      childSchool:
        '{preschool} für ein Kind, das noch nicht zur Schule geht, {school} für ein Kind in Schule oder Ausbildung',
      childOlder: '{base} pro Kind, plus {extra} für ein älteres Kind',
      childThird:
        '{first} pro Kind, {fromThird} ab dem dritten; weniger über einer Einkommensgrenze',
      taxReduction: '{amount} weniger Steuer, pro Kind',
    },
  },
};

const it: CantonPagesCopy = {
  index: {
    htmlTitle: 'Cifre fiscali per cantone {year}: aliquote comunali e deduzioni · Taxpresso',
    metaDescription:
      'Le cifre fiscali {year}, cantone per cantone, ognuna con la sua fonte ufficiale: l’aliquota comunale di ogni comune e le principali deduzioni con i loro limiti.',
    link: 'Cifre fiscali per cantone',
    title: 'Cifre fiscali per cantone',
    lead: 'Le aliquote comunali e le principali deduzioni, cantone per cantone, ognuna con la sua fonte ufficiale.',
    open: 'Vedi le cifre',
    summary: 'L’aliquota comunale ({term}) di ogni comune e le principali deduzioni.',
    geneva: 'Centesimi addizionali, limiti del pilastro 3a, scadenze e deduzioni.',
    preview: 'In anteprima in Taxpresso',
  },
  htmlTitle: '{canton}: cifre fiscali {year}, aliquote comunali e deduzioni · Taxpresso',
  metaDescription:
    '{canton}: le cifre fiscali {year}, ognuna con la sua fonte ufficiale: l’aliquota comunale ({term}) di ogni comune e le principali deduzioni con i loro limiti.',
  title: '{canton}: cifre fiscali',
  lead: 'Le cifre che contano per la tua dichiarazione, ognuna con la sua fonte ufficiale: quanto preleva ogni comune, e le principali deduzioni.',
  preview:
    '{canton} funziona in Taxpresso in anteprima: Taxpresso prepara la tua dichiarazione e ti dice cosa non copre ancora.',
  onThisPage: 'In questa pagina:',
  basis:
    'Ogni cifra di questa pagina viene dal codice di Taxpresso, dove cita il documento ufficiale indicato accanto.',
  disclaimer:
    'Questa pagina è un riferimento, non una consulenza fiscale. Se hai dubbi, chiedi all’amministrazione fiscale del tuo cantone.',
  cta: {
    title: 'Lascia le scartoffie a Taxpresso',
    text: 'Taxpresso prepara la tua dichiarazione con Claude, sul tuo computer. Gratuito e open source.',
  },
  others: 'Gli altri cantoni',
  all: 'Tutti i cantoni',
  communes: {
    title: 'Aliquote comunali ({term})',
    how: {
      percent:
        'Ogni comune fissa la propria aliquota ({term}), in percentuale dell’imposta cantonale semplice ({base}): più è alta, più imposta comunale paghi.',
      multiple:
        'Ogni comune fissa la propria aliquota ({term}), come multiplo dell’imposta cantonale semplice ({base}): più è alta, più imposta comunale paghi.',
      units:
        'La tua imposta è l’imposta per unità ({base}) moltiplicata per le unità ({term}) del cantone, del tuo comune e, se ne fai parte, della tua parrocchia: più unità, più imposta paghi.',
      shares:
        'In alcuni comuni il cantone preleva tutta l’imposta. Negli altri ne preleva la sua quota ({base}), e il comune aggiunge la propria aliquota ({term}), in percentuale dell’imposta calcolata secondo la legge.',
    },
    church:
      'Se fai parte di una chiesa riconosciuta, questa preleva la propria imposta di culto: anche la sua aliquota è nella tabella.',
    canton: 'L’aliquota del cantone stesso ({term}):',
    incomeWealth: '{income} sul reddito, {wealth} sulla sostanza',
    wide: 'Uguale in tutti i comuni:',
    colCommune: 'Comune',
    parts:
      'Dove le parti di un comune o le sue parrocchie hanno aliquote diverse, la tabella le mostra tutte.',
    empty:
      'Una casella vuota significa che la fonte ufficiale non indica un’aliquota per quell’anno.',
  },
  churches: {
    reformed: 'Chiesa riformata',
    catholic: 'Chiesa cattolica',
    christCatholic: 'Chiesa cattolica cristiana',
    reformedOfIncome: 'Chiesa riformata, % del reddito imponibile',
    christCatholicOfIncome: 'Chiesa cattolica cristiana, % del reddito imponibile',
    catholicOnIncome: 'Parrocchia cattolica, sul reddito',
    reformedOnIncome: 'Parrocchia riformata, sul reddito',
  },
  deductions: {
    title: 'Deduzioni e limiti {year}',
    intro:
      'Le deduzioni riducono il tuo reddito imponibile. L’imposta del cantone ({tax}) e l’imposta federale diretta hanno ciascuna i propri limiti. Ecco i principali contenuti nel codice di Taxpresso, ognuno con la sua fonte; la guida ufficiale del tuo cantone li elenca tutti.',
    tax: {
      cantonal: 'Imposta cantonale e comunale',
      federal: 'Imposta federale diretta',
      both: 'Imposte cantonali, comunali e federali',
    },
    names: {
      professional: 'Altre spese professionali, deduzione forfettaria',
      commute: 'Spese di trasporto per il lavoro',
      meals: 'Pasti fuori casa',
      pillar3a: 'Pilastro 3a',
      insurance: 'Premi assicurativi e interessi dei capitali a risparmio',
      debtInterest: 'Interessi passivi privati',
      childcare: 'Custodia dei figli da parte di terzi',
      training: 'Formazione professionale',
      twoEarner: 'Entrambi i coniugi lavorano',
      party: 'Donazioni ai partiti politici',
      donations: 'Donazioni di utilità pubblica',
      medical: 'Spese di malattia e infortunio',
      child: 'Deduzione per figlio',
      childTaxReduction: 'Riduzione d’imposta per figlio',
    },
    limits: {
      shareMinMax: '{rate} del salario netto, almeno {min} e al massimo {max}',
      baseShareMax: '{base} più {rate} del salario netto, al massimo {max}',
      flat: 'Un importo forfettario di {amount}',
      perYear: 'Al massimo {max} all’anno',
      meals: '{perDay} al giorno, al massimo {perYear} all’anno',
      mealsYear: 'Al massimo {perYear} all’anno',
      pillar3a:
        'Con cassa pensione: fino a {withFund}. Senza: {share} del reddito da lavoro, al massimo {withoutFund}.',
      family:
        'Al massimo {married} per una coppia sposata, {other} per gli altri contribuenti, più {perChild} per figlio',
      couple: 'Al massimo {married} per una coppia sposata e {other} per gli altri contribuenti',
      flatCouple:
        'Un importo forfettario di {married} per una coppia sposata e di {other} per gli altri contribuenti, qualunque sia l’importo pagato',
      noPension:
        'Senza contributi a una cassa pensione né al pilastro 3a: al massimo {married} per una coppia sposata e {other} per gli altri contribuenti',
      noPensionMore:
        'Senza contributi a una cassa pensione né al pilastro 3a: {married} in più per una coppia sposata e {other} in più per gli altri contribuenti',
      noPensionShare:
        'Senza contributi a una cassa pensione né al pilastro 3a: {share} dell’importo per una coppia sposata o per gli altri contribuenti',
      premiums:
        'Premi assicurativi: al massimo {married} per una coppia sposata, {other} per gli altri contribuenti, più {perChild} per figlio',
      savings:
        'Interessi dei capitali a risparmio: al massimo {married} per una coppia sposata, {other} per gli altri contribuenti, più {perChild} per figlio',
      savingsCouple:
        'Interessi dei capitali a risparmio: al massimo {married} per una coppia sposata e {other} per gli altri contribuenti',
      life: 'Assicurazioni sulla vita e altri premi: al massimo {married} per una coppia sposata e {other} per gli altri contribuenti',
      health:
        'Assicurazione malattia e infortuni: un importo forfettario di {adult} per adulto, {young} per giovane adulto in formazione e {child} per figlio, meno i sussidi ricevuti',
      atMost: 'Al massimo {max}',
      perPersonMax: 'Al massimo {max} per persona',
      perChildMax: 'Al massimo {max} per figlio',
      debtInterest: 'Fino al reddito della sostanza più {extra}',
      twoEarnerMax: 'Al massimo {max}, e non più del reddito da lavoro più basso',
      twoEarnerShare: '{share} del reddito da lavoro più basso, almeno {min} e al massimo {max}',
      twoEarnerBoth: '{share} dei due redditi da lavoro insieme, al massimo {max}',
      twoEarnerFixed: '{amount} se avete entrambi un reddito da lavoro',
      donations: 'Da {min} nell’anno, fino a {share} del reddito netto',
      medical: 'La parte oltre {share} del reddito netto',
      child: '{amount} per figlio',
      childAge:
        'Secondo l’età: {young} per un figlio piccolo, {teen} per un figlio adolescente, {adult} per un figlio maggiorenne in formazione',
      childAway: '{base} per figlio, {away} per un figlio in formazione fuori casa',
      childSchool:
        '{preschool} per un figlio non ancora a scuola, {school} per un figlio a scuola o in formazione',
      childOlder: '{base} per figlio, più {extra} per un figlio più grande',
      childThird:
        '{first} per figlio, {fromThird} dal terzo in poi; meno oltre un limite di reddito',
      taxReduction: '{amount} in meno sull’imposta, per figlio',
    },
  },
};

const es: CantonPagesCopy = {
  index: {
    htmlTitle: 'Cifras fiscales por cantón {year}: tipos municipales y deducciones · Taxpresso',
    metaDescription:
      'Las cifras fiscales de {year}, cantón por cantón, cada una con su fuente oficial: el tipo municipal de cada municipio y las principales deducciones con sus límites.',
    link: 'Cifras fiscales por cantón',
    title: 'Cifras fiscales por cantón',
    lead: 'Los tipos municipales y las principales deducciones, cantón por cantón, cada cifra con su fuente oficial.',
    open: 'Ver las cifras',
    summary: 'El tipo municipal ({term}) de cada municipio y las principales deducciones.',
    geneva:
      'Recargos municipales (centimes additionnels), límites del pilar 3a, plazos y deducciones.',
    preview: 'Versión preliminar en Taxpresso',
  },
  htmlTitle: '{canton}: cifras fiscales {year}, tipos municipales y deducciones · Taxpresso',
  metaDescription:
    '{canton}: las cifras fiscales de {year}, cada una con su fuente oficial: el tipo municipal ({term}) de cada municipio y las principales deducciones con sus límites.',
  title: '{canton}: cifras fiscales',
  lead: 'Las cifras que cuentan para tu declaración, cada una con su fuente oficial: lo que cobra cada municipio, y las principales deducciones.',
  preview:
    '{canton} funciona en Taxpresso como versión preliminar: Taxpresso prepara tu declaración y te dice lo que aún no cubre.',
  onThisPage: 'En esta página:',
  basis:
    'Cada cifra de esta página viene del código de Taxpresso, donde cita el documento oficial que aparece al lado.',
  disclaimer:
    'Esta página es una referencia, no asesoramiento fiscal. Si tienes dudas, pregunta a la administración fiscal de tu cantón.',
  cta: {
    title: 'Deja el papeleo a Taxpresso',
    text: 'Taxpresso prepara tu declaración con Claude, en tu propio ordenador. Gratis y de código abierto.',
  },
  others: 'Los demás cantones',
  all: 'Todos los cantones',
  communes: {
    title: 'Tipos municipales ({term})',
    how: {
      percent:
        'Cada municipio fija su propio tipo ({term}), en porcentaje del impuesto cantonal de base ({base}): cuanto más alto es, más impuesto municipal pagas.',
      multiple:
        'Cada municipio fija su propio tipo ({term}), como múltiplo del impuesto cantonal de base ({base}): cuanto más alto es, más impuesto municipal pagas.',
      units:
        'Tu impuesto es el impuesto por unidad ({base}) multiplicado por las unidades ({term}) del cantón, de tu municipio y, si perteneces a una, de tu parroquia: cuantas más unidades, más impuesto pagas.',
      shares:
        'En algunos municipios el cantón cobra todo el impuesto. En los demás cobra su parte ({base}), y el municipio añade su propio tipo ({term}), en porcentaje del impuesto calculado según la ley.',
    },
    church:
      'Si perteneces a una iglesia reconocida, esta cobra su propio impuesto eclesiástico: su tipo también aparece en la tabla.',
    canton: 'El tipo del propio cantón ({term}):',
    incomeWealth: '{income} sobre los ingresos, {wealth} sobre el patrimonio',
    wide: 'Igual en todos los municipios:',
    colCommune: 'Municipio',
    parts:
      'Cuando las partes de un municipio o sus parroquias tienen tipos distintos, la tabla los muestra todos.',
    empty: 'Una casilla vacía significa que la fuente oficial no da ningún tipo para ese año.',
  },
  churches: {
    reformed: 'Iglesia reformada',
    catholic: 'Iglesia católica',
    christCatholic: 'Iglesia católica cristiana',
    reformedOfIncome: 'Iglesia reformada, % de la base imponible',
    christCatholicOfIncome: 'Iglesia católica cristiana, % de la base imponible',
    catholicOnIncome: 'Parroquia católica, sobre los ingresos',
    reformedOnIncome: 'Parroquia reformada, sobre los ingresos',
  },
  deductions: {
    title: 'Deducciones y límites {year}',
    intro:
      'Las deducciones reducen tu base imponible. El impuesto del cantón ({tax}) y el impuesto federal directo tienen cada uno sus límites. Aquí están los principales que contiene el código de Taxpresso, cada uno con su fuente; la guía oficial de tu cantón los enumera todos.',
    tax: {
      cantonal: 'Impuesto cantonal y municipal',
      federal: 'Impuesto federal directo',
      both: 'Impuestos cantonal, municipal y federal',
    },
    names: {
      professional: 'Otros gastos profesionales, deducción a tanto alzado',
      commute: 'Desplazamientos al trabajo',
      meals: 'Comidas fuera de casa',
      pillar3a: 'Pilar 3a',
      insurance: 'Primas de seguros e intereses de capitales de ahorro',
      debtInterest: 'Intereses de deudas privadas',
      childcare: 'Cuidado de los hijos por terceros',
      training: 'Formación profesional',
      twoEarner: 'Los dos cónyuges trabajan',
      party: 'Donaciones a partidos políticos',
      donations: 'Donaciones de utilidad pública',
      medical: 'Gastos de enfermedad y accidente',
      child: 'Deducción por hijo',
      childTaxReduction: 'Reducción del impuesto por hijo',
    },
    limits: {
      shareMinMax: '{rate} del salario neto, como mínimo {min} y como máximo {max}',
      baseShareMax: '{base} más {rate} del salario neto, como máximo {max}',
      flat: 'Un importe a tanto alzado de {amount}',
      perYear: 'Como máximo {max} al año',
      meals: '{perDay} al día, como máximo {perYear} al año',
      mealsYear: 'Como máximo {perYear} al año',
      pillar3a:
        'Con caja de pensiones: hasta {withFund}. Sin ella: {share} de los ingresos del trabajo, como máximo {withoutFund}.',
      family:
        'Como máximo {married} para un matrimonio, {other} para los demás contribuyentes, más {perChild} por hijo',
      couple: 'Como máximo {married} para un matrimonio y {other} para los demás contribuyentes',
      flatCouple:
        'Un importe a tanto alzado de {married} para un matrimonio y de {other} para los demás contribuyentes, pagues lo que pagues',
      noPension:
        'Sin aportaciones a una caja de pensiones ni al pilar 3a: como máximo {married} para un matrimonio y {other} para los demás contribuyentes',
      noPensionMore:
        'Sin aportaciones a una caja de pensiones ni al pilar 3a: {married} más para un matrimonio y {other} más para los demás contribuyentes',
      noPensionShare:
        'Sin aportaciones a una caja de pensiones ni al pilar 3a: {share} del importe para un matrimonio o para los demás contribuyentes',
      premiums:
        'Primas de seguros: como máximo {married} para un matrimonio, {other} para los demás contribuyentes, más {perChild} por hijo',
      savings:
        'Intereses de capitales de ahorro: como máximo {married} para un matrimonio, {other} para los demás contribuyentes, más {perChild} por hijo',
      savingsCouple:
        'Intereses de capitales de ahorro: como máximo {married} para un matrimonio y {other} para los demás contribuyentes',
      life: 'Seguros de vida y otras primas: como máximo {married} para un matrimonio y {other} para los demás contribuyentes',
      health:
        'Seguro de enfermedad y accidentes: un importe a tanto alzado de {adult} por adulto, {young} por joven adulto en formación y {child} por hijo, menos las subvenciones recibidas',
      atMost: 'Como máximo {max}',
      perPersonMax: 'Como máximo {max} por persona',
      perChildMax: 'Como máximo {max} por hijo',
      debtInterest: 'Hasta los rendimientos de tu patrimonio más {extra}',
      twoEarnerMax: 'Como máximo {max}, y no más que los ingresos del trabajo más bajos',
      twoEarnerShare:
        '{share} de los ingresos del trabajo más bajos, como mínimo {min} y como máximo {max}',
      twoEarnerBoth: '{share} de los dos ingresos del trabajo juntos, como máximo {max}',
      twoEarnerFixed: '{amount} si los dos tenéis ingresos del trabajo',
      donations: 'Desde {min} en el año, hasta {share} de los ingresos netos',
      medical: 'La parte que supera {share} de los ingresos netos',
      child: '{amount} por hijo',
      childAge:
        'Según la edad: {young} por un hijo pequeño, {teen} por un hijo adolescente, {adult} por un hijo mayor de edad en formación',
      childAway: '{base} por hijo, {away} por un hijo que estudia fuera de casa',
      childSchool:
        '{preschool} por un hijo que aún no va a la escuela, {school} por un hijo en la escuela o en formación',
      childOlder: '{base} por hijo, más {extra} por un hijo mayor',
      childThird:
        '{first} por hijo, {fromThird} a partir del tercero; menos por encima de un límite de ingresos',
      taxReduction: '{amount} menos de impuesto, por hijo',
    },
  },
};

const pt: CantonPagesCopy = {
  index: {
    htmlTitle: 'Números fiscais por cantão {year}: taxas comunais e deduções · Taxpresso',
    metaDescription:
      'Os números fiscais de {year}, cantão a cantão, cada um com a sua fonte oficial: a taxa comunal de cada comuna e as principais deduções com os seus limites.',
    link: 'Números fiscais por cantão',
    title: 'Números fiscais por cantão',
    lead: 'As taxas comunais e as principais deduções, cantão a cantão, cada número com a sua fonte oficial.',
    open: 'Ver os números',
    summary: 'A taxa comunal ({term}) de cada comuna e as principais deduções.',
    geneva: 'Adicionais comunais (centimes additionnels), limites do pilar 3a, prazos e deduções.',
    preview: 'Em pré-visualização no Taxpresso',
  },
  htmlTitle: '{canton}: números fiscais {year}, taxas comunais e deduções · Taxpresso',
  metaDescription:
    '{canton}: os números fiscais de {year}, cada um com a sua fonte oficial: a taxa comunal ({term}) de cada comuna e as principais deduções com os seus limites.',
  title: '{canton}: números fiscais',
  lead: 'Os números que contam para a tua declaração, cada um com a sua fonte oficial: o que cada comuna cobra, e as principais deduções.',
  preview:
    '{canton} funciona no Taxpresso em pré-visualização: o Taxpresso prepara a tua declaração e diz-te o que ainda não cobre.',
  onThisPage: 'Nesta página:',
  basis:
    'Cada número desta página vem do código do Taxpresso, onde cita o documento oficial indicado ao lado.',
  disclaimer:
    'Esta página é uma referência, não aconselhamento fiscal. Em caso de dúvida, pergunta à administração fiscal do teu cantão.',
  cta: {
    title: 'Deixa a papelada com o Taxpresso',
    text: 'O Taxpresso prepara a tua declaração com o Claude, no teu próprio computador. Grátis e de código aberto.',
  },
  others: 'Os outros cantões',
  all: 'Todos os cantões',
  communes: {
    title: 'Taxas comunais ({term})',
    how: {
      percent:
        'Cada comuna fixa a sua própria taxa ({term}), em percentagem do imposto cantonal de base ({base}): quanto mais alta, mais imposto comunal pagas.',
      multiple:
        'Cada comuna fixa a sua própria taxa ({term}), como múltiplo do imposto cantonal de base ({base}): quanto mais alta, mais imposto comunal pagas.',
      units:
        'O teu imposto é o imposto por unidade ({base}) multiplicado pelas unidades ({term}) do cantão, da tua comuna e, se pertences a uma, da tua paróquia: quanto mais unidades, mais imposto pagas.',
      shares:
        'Em algumas comunas o cantão cobra todo o imposto. Nas outras cobra a sua parte ({base}), e a comuna acrescenta a sua própria taxa ({term}), em percentagem do imposto calculado segundo a lei.',
    },
    church:
      'Se pertences a uma igreja reconhecida, ela cobra o seu próprio imposto eclesiástico: a sua taxa também está na tabela.',
    canton: 'A taxa do próprio cantão ({term}):',
    incomeWealth: '{income} sobre o rendimento, {wealth} sobre o património',
    wide: 'Igual em todas as comunas:',
    colCommune: 'Comuna',
    parts:
      'Quando as partes de uma comuna ou as suas paróquias têm taxas diferentes, a tabela mostra-as todas.',
    empty: 'Uma célula vazia significa que a fonte oficial não indica taxa para esse ano.',
  },
  churches: {
    reformed: 'Igreja reformada',
    catholic: 'Igreja católica',
    christCatholic: 'Igreja católica cristã',
    reformedOfIncome: 'Igreja reformada, % do rendimento tributável',
    christCatholicOfIncome: 'Igreja católica cristã, % do rendimento tributável',
    catholicOnIncome: 'Paróquia católica, sobre o rendimento',
    reformedOnIncome: 'Paróquia reformada, sobre o rendimento',
  },
  deductions: {
    title: 'Deduções e limites {year}',
    intro:
      'As deduções reduzem o teu rendimento tributável. O imposto do cantão ({tax}) e o imposto federal direto têm cada um os seus limites. Aqui estão os principais que o código do Taxpresso contém, cada um com a sua fonte; o guia oficial do teu cantão lista-os todos.',
    tax: {
      cantonal: 'Imposto cantonal e comunal',
      federal: 'Imposto federal direto',
      both: 'Impostos cantonal, comunal e federal',
    },
    names: {
      professional: 'Outras despesas profissionais, dedução forfetária',
      commute: 'Deslocações para o trabalho',
      meals: 'Refeições fora de casa',
      pillar3a: 'Pilar 3a',
      insurance: 'Prémios de seguros e juros de capitais de poupança',
      debtInterest: 'Juros de dívidas privadas',
      childcare: 'Guarda dos filhos por terceiros',
      training: 'Formação profissional',
      twoEarner: 'Os dois cônjuges trabalham',
      party: 'Donativos a partidos políticos',
      donations: 'Donativos de utilidade pública',
      medical: 'Despesas de doença e acidente',
      child: 'Dedução por filho',
      childTaxReduction: 'Redução do imposto por filho',
    },
    limits: {
      shareMinMax: '{rate} do salário líquido, no mínimo {min} e no máximo {max}',
      baseShareMax: '{base} mais {rate} do salário líquido, no máximo {max}',
      flat: 'Um montante forfetário de {amount}',
      perYear: 'No máximo {max} por ano',
      meals: '{perDay} por dia, no máximo {perYear} por ano',
      mealsYear: 'No máximo {perYear} por ano',
      pillar3a:
        'Com caixa de pensões: até {withFund}. Sem: {share} do rendimento do trabalho, no máximo {withoutFund}.',
      family:
        'No máximo {married} para um casal casado, {other} para os outros contribuintes, mais {perChild} por filho',
      couple: 'No máximo {married} para um casal casado e {other} para os outros contribuintes',
      flatCouple:
        'Um montante forfetário de {married} para um casal casado e de {other} para os outros contribuintes, pagues o que pagares',
      noPension:
        'Sem contribuições para uma caixa de pensões nem para o pilar 3a: no máximo {married} para um casal casado e {other} para os outros contribuintes',
      noPensionMore:
        'Sem contribuições para uma caixa de pensões nem para o pilar 3a: mais {married} para um casal casado e mais {other} para os outros contribuintes',
      noPensionShare:
        'Sem contribuições para uma caixa de pensões nem para o pilar 3a: {share} do montante para um casal casado ou para os outros contribuintes',
      premiums:
        'Prémios de seguros: no máximo {married} para um casal casado, {other} para os outros contribuintes, mais {perChild} por filho',
      savings:
        'Juros de capitais de poupança: no máximo {married} para um casal casado, {other} para os outros contribuintes, mais {perChild} por filho',
      savingsCouple:
        'Juros de capitais de poupança: no máximo {married} para um casal casado e {other} para os outros contribuintes',
      life: 'Seguros de vida e outros prémios: no máximo {married} para um casal casado e {other} para os outros contribuintes',
      health:
        'Seguro de doença e acidentes: um montante forfetário de {adult} por adulto, {young} por jovem adulto em formação e {child} por filho, menos os subsídios recebidos',
      atMost: 'No máximo {max}',
      perPersonMax: 'No máximo {max} por pessoa',
      perChildMax: 'No máximo {max} por filho',
      debtInterest: 'Até ao rendimento do teu património mais {extra}',
      twoEarnerMax: 'No máximo {max}, e não mais do que o rendimento do trabalho mais baixo',
      twoEarnerShare:
        '{share} do rendimento do trabalho mais baixo, no mínimo {min} e no máximo {max}',
      twoEarnerBoth: '{share} dos dois rendimentos do trabalho juntos, no máximo {max}',
      twoEarnerFixed: '{amount} se ambos tiverem rendimentos do trabalho',
      donations: 'A partir de {min} no ano, até {share} do rendimento líquido',
      medical: 'A parte acima de {share} do rendimento líquido',
      child: '{amount} por filho',
      childAge:
        'Conforme a idade: {young} por um filho pequeno, {teen} por um filho adolescente, {adult} por um filho maior de idade em formação',
      childAway: '{base} por filho, {away} por um filho em formação fora de casa',
      childSchool:
        '{preschool} por um filho que ainda não anda na escola, {school} por um filho na escola ou em formação',
      childOlder: '{base} por filho, mais {extra} por um filho mais velho',
      childThird:
        '{first} por filho, {fromThird} a partir do terceiro; menos acima de um limite de rendimento',
      taxReduction: '{amount} a menos no imposto, por filho',
    },
  },
};

export const cantonPages: Record<Lang, CantonPagesCopy> = { fr, en, de, it, es, pt };
