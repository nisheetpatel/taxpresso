// Copy for the Geneva reference pages (/<lang>/geneva/ and one page per topic), in every language
// of the site. Same voice as content.ts: vous in French, the informal you in German, Italian,
// Spanish and Portuguese, Swiss spelling in German, no en or em dashes, official French terms next
// to their gloss. No numbers here: {placeholders} are filled from geneva-data.ts, where every figure
// comes from a cited constant of the rules engine ({year}, {count}, {date}, {days}, {cap}...). A
// native speaker reviews each language before launch (SPEC.md section 1).

import type { Lang } from './content.ts';
import type { DeadlineId, DeductionId } from './geneva-data.ts';
import { frenchSpacing } from './guides.ts';

export const GENEVA_IDS = ['communes', 'pillar-3a', 'deadlines', 'deductions'] as const;
export type GenevaId = (typeof GENEVA_IDS)[number];

interface Topic {
  /** The heading and the index card; "{year}" is the tax year. */
  title: string;
  /** The index card and the meta description. */
  summary: string;
  intro: string;
}

export interface GenevaCopy {
  htmlTitle: string;
  metaDescription: string;
  /** The footer link. */
  link: string;
  title: string;
  lead: string;
  open: string;
  year: string;
  /** "Check the official source", on every page. */
  check: string;
  basis: string;
  /** Shown where a figure is from an earlier year than the page's. */
  older: string;
  disclaimer: string;
  source: string;
  sources: string;
  cta: { title: string; text: string };
  more: string;
  all: string;
  /** The line under the guides; [text]({href}) links to the Geneva pages. */
  fromGuides: string;
  tax: { icc: string; ifd: string; both: string };
  pages: {
    communes: Topic & { colCommune: string; colRate: string };
    'pillar-3a': Topic & {
      colYear: string;
      colWith: string;
      colWithout: string;
      without: string;
      catchUpTitle: string;
      catchUp: string;
      paidInYear: string;
      cantonal: string;
    };
    deadlines: Topic & {
      days: string;
      items: Record<DeadlineId, { title: string; text: string }>;
      filing: string;
    };
    deductions: Topic & {
      guide: string;
      items: Record<DeductionId, { name: string; text: string }>;
    };
  };
}

// French: plain spaces before ? ! : ; here, frenchSpacing makes them non-breaking.
const fr: GenevaCopy = frenchSpacing({
  htmlTitle: 'Repères fiscaux genevois {year} : taux, plafonds et délais · Taxpresso',
  metaDescription:
    'Les chiffres de l’impôt genevois {year}, chacun avec sa source officielle : centimes additionnels communaux, plafonds du 3e pilier A, délais et déductions.',
  link: 'Repères genevois',
  title: 'Repères fiscaux genevois',
  lead: 'Les chiffres qui comptent pour votre déclaration genevoise, chacun avec sa source officielle. Les repères des autres cantons viendront plus tard.',
  open: 'Voir les chiffres',
  year: 'Année fiscale {year}',
  check: 'Vérifiez la source officielle avant de vous fier à un chiffre : c’est elle qui fait foi.',
  basis:
    'Chaque chiffre de ces pages vient du code de Taxpresso, où il cite le document officiel indiqué à côté.',
  older:
    'Un chiffre d’une année antérieure est affiché avec son année : c’est le dernier paru dans les sources officielles qu’utilise Taxpresso.',
  disclaimer:
    'Ces pages sont un repère, pas un conseil fiscal. En cas de doute, demandez à l’Administration fiscale cantonale (AFC).',
  source: 'Source',
  sources: 'Sources',
  cta: {
    title: 'Laissez Taxpresso s’en occuper',
    text: 'Taxpresso prépare votre déclaration genevoise avec Claude, sur votre ordinateur. Gratuit et open source.',
  },
  more: 'Les autres repères',
  all: 'Tous les repères genevois',
  fromGuides:
    'Vous cherchez des chiffres ? Voyez les [repères fiscaux genevois]({href}) : centimes additionnels, plafonds du 3e pilier A, délais et déductions.',
  tax: {
    icc: 'Impôt cantonal et communal (ICC)',
    ifd: 'Impôt fédéral direct (IFD)',
    both: 'ICC et IFD',
  },
  pages: {
    communes: {
      title: 'Centimes additionnels communaux {year}',
      summary:
        'Le taux des centimes additionnels de chacune des {count} communes genevoises pour {year}, dans un seul tableau.',
      intro:
        'Chaque commune fixe ses centimes additionnels, et le Conseil d’État les approuve. Ils se calculent sur l’impôt de base cantonal : plus le nombre est élevé, plus l’impôt communal l’est aussi.',
      colCommune: 'Commune',
      colRate: 'Centimes additionnels',
    },
    'pillar-3a': {
      title: 'Plafonds du 3e pilier A, année par année',
      summary:
        'Le montant maximal déductible pour vos versements au 3e pilier A, année par année, avec ou sans caisse de pension.',
      intro:
        'Ce que vous versez au 3e pilier A pendant l’année est déduit de votre revenu, jusqu’à un plafond. Le plafond dépend de votre affiliation à une caisse de pension (2e pilier).',
      colYear: 'Année',
      colWith: 'Avec caisse de pension',
      colWithout: 'Sans caisse de pension',
      without: '{share} du revenu d’activité, au plus {cap}',
      catchUpTitle: 'Le rachat 3a',
      catchUp:
        'En {year}, vous pouvez aussi rattraper les années où vous n’avez pas versé le maximum, à partir de {from} et sur les {years} dernières années : au plus {cap} l’année du rachat.',
      paidInYear: 'Seuls les versements effectués pendant l’année comptent.',
      cantonal:
        'Les mêmes plafonds valent pour l’impôt cantonal et communal : Genève suit ici le droit fédéral.',
    },
    deadlines: {
      title: 'Délais fiscaux {year}',
      summary:
        'Les dates qui comptent pour l’année fiscale {year} à Genève : 3e pilier A, rachat 2e pilier, TOU et réclamation.',
      intro:
        'Les dates qui comptent pour l’année fiscale {year}, chacune avec la loi ou le guide qui la fixe.',
      days: '{days} jours',
      items: {
        pillar3a: {
          title: 'Verser au 3e pilier A',
          text: 'Seuls les versements effectués pendant l’année comptent pour cette année.',
        },
        lppBuyin: {
          title: 'Racheter dans votre caisse de pension (rachat 2e pilier)',
          text: 'Un rachat se déduit l’année où vous le versez.',
        },
        tou: {
          title: 'Demander la taxation ordinaire ultérieure (TOU)',
          text: 'Si vous êtes imposé à la source et voulez une déclaration ordinaire pour {year}, envoyez votre demande écrite à l’AFC au plus tard ce jour-là. Une fois déposée, elle ne peut pas être retirée.',
        },
        objectionIcc: {
          title: 'Contester la taxation de l’impôt cantonal et communal (réclamation)',
          text: 'Par écrit, dans ce délai après la notification. Le délai commence le lendemain de la notification ; s’il finit un samedi, un dimanche ou un jour férié, il passe au jour ouvrable suivant.',
        },
        objectionIfd: {
          title: 'Contester la taxation de l’impôt fédéral direct (réclamation)',
          text: 'Par écrit, dans ce délai après la notification. Le délai commence le lendemain de la notification ; s’il finit un samedi, un dimanche ou un jour férié, il passe au jour ouvrable suivant.',
        },
      },
      filing:
        'Quand rendre votre déclaration, et comment demander un délai, sur la page de l’administration fiscale :',
    },
    deductions: {
      title: 'Déductions et plafonds {year}',
      summary:
        'Les principales déductions de votre déclaration genevoise et leurs plafonds, pour l’impôt cantonal et l’impôt fédéral, chacune avec sa source officielle.',
      intro:
        'Les déductions réduisent votre revenu imposable. L’impôt cantonal et communal (ICC) et l’impôt fédéral direct (IFD) ont chacun leurs plafonds. Cette page montre ceux que contient le code de Taxpresso, chacun avec sa source ; le guide officiel les liste tous.',
      guide: 'La liste complète, dans le guide officiel :',
      items: {
        professional: {
          name: 'Frais professionnels, déduction forfaitaire',
          text: '{rate} du salaire net, au moins {min} et au plus {max}',
        },
        pillar3a: {
          name: '3e pilier A',
          text: 'Avec caisse de pension : jusqu’à {withFund}. Sans : {share} du revenu d’activité, au plus {withoutFund}.',
        },
        pillar3aCatchUp: {
          name: 'Rachat 3a',
          text: 'Au plus {cap} dans l’année, pour les années depuis {from} où vous n’avez pas versé le maximum, sur les {years} dernières années.',
        },
        lppBuyin: {
          name: 'Rachat 2e pilier (caisse de pension)',
          text: 'Jusqu’au montant de rachat que votre caisse de pension vous indique.',
        },
        insurance: {
          name: 'Primes d’assurances et intérêts de capitaux d’épargne',
          text: 'Avec contributions aux piliers 2 et 3a : au plus {married} pour un couple marié vivant en ménage commun, {other} pour les autres contribuables, plus {perChild} par enfant.',
        },
        child: { name: 'Déduction pour enfant', text: '{amount} par enfant' },
        married: { name: 'Déduction pour couples mariés', text: '{amount}' },
        childTaxReduction: {
          name: 'Réduction du montant de l’impôt par enfant',
          text: '{amount} de moins sur l’impôt lui-même, par enfant',
        },
      },
    },
  },
});

const en: GenevaCopy = {
  htmlTitle: 'Geneva tax reference {year}: rates, limits and deadlines · Taxpresso',
  metaDescription:
    'Geneva tax figures for {year}, each with its official source: communal tax rates, pillar 3a limits, deadlines and deductions.',
  link: 'Geneva tax figures',
  title: 'Geneva tax reference',
  lead: 'The figures that matter for your Geneva tax return, each with its official source. Pages for the other cantons come later.',
  open: 'See the figures',
  year: 'Tax year {year}',
  check: 'Check the official source before you rely on a figure: it has the final word.',
  basis:
    'Every figure on these pages comes from Taxpresso’s own code, where it cites the official document shown next to it. The official documents are in French.',
  older:
    'A figure from an earlier year is shown with its year: it is the latest one published in the official sources Taxpresso uses.',
  disclaimer:
    'These pages are a reference, not tax advice. If in doubt, ask the cantonal tax office (AFC).',
  source: 'Source',
  sources: 'Sources',
  cta: {
    title: 'Let Taxpresso do the paperwork',
    text: 'Taxpresso prepares your Geneva tax return with Claude, on your own computer. Free and open source.',
  },
  more: 'More Geneva figures',
  all: 'All Geneva figures',
  fromGuides:
    'Looking for figures? See the [Geneva tax reference]({href}): communal tax rates, pillar 3a limits, deadlines and deductions.',
  tax: {
    icc: 'Cantonal and communal tax (ICC)',
    ifd: 'Federal direct tax (IFD)',
    both: 'Cantonal, communal and federal tax',
  },
  pages: {
    communes: {
      title: 'Communal tax rates {year} (centimes additionnels)',
      summary:
        'The centimes additionnels of each of Geneva’s {count} communes for {year}, in one table.',
      intro:
        'Each commune sets its own surcharge, the centimes additionnels, and the canton’s government (Conseil d’État) approves it. It is worked out on the cantonal base tax (impôt de base): the higher the number, the higher the communal tax.',
      colCommune: 'Commune',
      colRate: 'Centimes additionnels',
    },
    'pillar-3a': {
      title: 'Pillar 3a limits by year',
      summary:
        'The most you can deduct for payments into pillar 3a (3e pilier A), year by year, with or without a pension fund.',
      intro:
        'What you pay into pillar 3a (3e pilier A) during the year is deducted from your income, up to a limit. The limit depends on whether you have a pension fund (2nd pillar, caisse de pension).',
      colYear: 'Year',
      colWith: 'With a pension fund',
      colWithout: 'Without a pension fund',
      without: '{share} of your earned income, at most {cap}',
      catchUpTitle: 'Catching up (rachat 3a)',
      catchUp:
        'In {year}, you can also make up for years when you didn’t pay in the maximum, from {from} on and within the last {years} years: at most {cap} in the year you catch up.',
      paidInYear: 'Only payments made during the year count.',
      cantonal:
        'The same limits apply to cantonal and communal tax: here Geneva follows federal law.',
    },
    deadlines: {
      title: 'Key tax deadlines {year}',
      summary:
        'The dates that matter for your {year} Geneva tax year: pillar 3a, pension fund buy-ins, TOU and objections.',
      intro: 'The dates that count for tax year {year}, each with the law or guide that sets it.',
      days: '{days} days',
      items: {
        pillar3a: {
          title: 'Pay into pillar 3a (3e pilier A)',
          text: 'Only payments made during the year count for that year.',
        },
        lppBuyin: {
          title: 'Buy into your pension fund (rachat 2e pilier)',
          text: 'A buy-in is deducted in the year you pay it.',
        },
        tou: {
          title: 'Ask for ordinary taxation afterwards (taxation ordinaire ultérieure, TOU)',
          text: 'If you’re taxed at source and want a normal tax return for {year}, send your written request to the tax office (AFC) by this day. Once sent, it can’t be withdrawn.',
        },
        objectionIcc: {
          title: 'Object to your cantonal and communal tax assessment (réclamation)',
          text: 'In writing, within this time after you’re notified. The time starts the day after notification; a last day on a Saturday, a Sunday or a public holiday moves to the next working day.',
        },
        objectionIfd: {
          title: 'Object to your federal direct tax assessment (réclamation)',
          text: 'In writing, within this time after you’re notified. The time starts the day after notification; a last day on a Saturday, a Sunday or a public holiday moves to the next working day.',
        },
      },
      filing:
        'When your return is due, and how to ask for more time (délai), on the tax office’s page:',
    },
    deductions: {
      title: 'Deductions and their limits {year}',
      summary:
        'The main deductions on your Geneva tax return and their limits, for cantonal and federal tax, each with its official source.',
      intro:
        'Deductions lower your taxable income. Cantonal and communal tax (ICC) and federal direct tax (IFD) each have their own limits. This page shows the ones Taxpresso’s code holds, each with its source; the official guide lists them all.',
      guide: 'The full list, in the official guide:',
      items: {
        professional: {
          name: 'Professional expenses, flat deduction (frais professionnels)',
          text: '{rate} of your net salary, at least {min} and at most {max}',
        },
        pillar3a: {
          name: 'Pillar 3a (3e pilier A)',
          text: 'With a pension fund: up to {withFund}. Without one: {share} of your earned income, at most {withoutFund}.',
        },
        pillar3aCatchUp: {
          name: 'Pillar 3a catch-up (rachat 3a)',
          text: 'At most {cap} in the year, for years from {from} on when you didn’t pay in the maximum, within the last {years} years.',
        },
        lppBuyin: {
          name: 'Pension fund buy-in (rachat 2e pilier)',
          text: 'Up to the buy-in amount your pension fund tells you.',
        },
        insurance: {
          name: 'Insurance premiums and interest on savings (primes d’assurances et intérêts de capitaux d’épargne)',
          text: 'With contributions to the 2nd pillar and pillar 3a (avec contributions aux piliers 2 et 3a): at most {married} for a married couple living together, {other} for everyone else, plus {perChild} per child.',
        },
        child: { name: 'Deduction per child (déduction pour enfant)', text: '{amount} per child' },
        married: {
          name: 'Deduction for married couples (déduction pour couples mariés)',
          text: '{amount}',
        },
        childTaxReduction: {
          name: 'Tax reduction per child (réduction du montant de l’impôt par enfant)',
          text: '{amount} off the tax itself, per child',
        },
      },
    },
  },
};

const de: GenevaCopy = {
  htmlTitle: 'Genfer Steuerzahlen {year}: Sätze, Obergrenzen und Fristen · Taxpresso',
  metaDescription:
    'Die Genfer Steuerzahlen {year}, jede mit ihrer offiziellen Quelle: Gemeindezuschläge, Obergrenzen der Säule 3a, Fristen und Abzüge.',
  link: 'Genfer Steuerzahlen',
  title: 'Genfer Steuerzahlen',
  lead: 'Die Zahlen, die für deine Genfer Steuererklärung zählen, jede mit ihrer offiziellen Quelle. Seiten für die anderen Kantone folgen später.',
  open: 'Zu den Zahlen',
  year: 'Steuerjahr {year}',
  check: 'Prüf die offizielle Quelle, bevor du dich auf eine Zahl verlässt: Sie ist massgebend.',
  basis:
    'Jede Zahl auf diesen Seiten stammt aus dem Code von Taxpresso, wo sie das offizielle Dokument nennt, das daneben steht. Die offiziellen Dokumente sind auf Französisch.',
  older:
    'Eine Zahl aus einem früheren Jahr steht mit ihrem Jahr da: Es ist die neuste, die in den offiziellen Quellen von Taxpresso veröffentlicht ist.',
  disclaimer:
    'Diese Seiten sind eine Orientierungshilfe, keine Steuerberatung. Im Zweifel frag die kantonale Steuerverwaltung (AFC).',
  source: 'Quelle',
  sources: 'Quellen',
  cta: {
    title: 'Lass Taxpresso den Papierkram machen',
    text: 'Taxpresso bereitet deine Genfer Steuererklärung mit Claude vor, auf deinem eigenen Computer. Kostenlos und Open Source.',
  },
  more: 'Weitere Genfer Zahlen',
  all: 'Alle Genfer Steuerzahlen',
  fromGuides:
    'Du suchst Zahlen? Sieh dir die [Genfer Steuerzahlen]({href}) an: Gemeindezuschläge, Obergrenzen der Säule 3a, Fristen und Abzüge.',
  tax: {
    icc: 'Kantons- und Gemeindesteuer (ICC)',
    ifd: 'Direkte Bundessteuer (IFD)',
    both: 'Kantons-, Gemeinde- und Bundessteuer',
  },
  pages: {
    communes: {
      title: 'Gemeindezuschläge {year} (centimes additionnels)',
      summary:
        'Die Zuschläge (centimes additionnels) aller {count} Genfer Gemeinden für {year}, in einer Tabelle.',
      intro:
        'Jede Gemeinde legt ihren Zuschlag fest, die centimes additionnels, und der Staatsrat (Conseil d’État) genehmigt ihn. Er wird auf der kantonalen Basissteuer (impôt de base) berechnet: Je höher die Zahl, desto höher die Gemeindesteuer.',
      colCommune: 'Gemeinde',
      colRate: 'Zuschlag (centimes additionnels)',
    },
    'pillar-3a': {
      title: 'Obergrenzen der Säule 3a, Jahr für Jahr',
      summary:
        'Wie viel du für Einzahlungen in die Säule 3a (3e pilier A) höchstens abziehen kannst, Jahr für Jahr, mit oder ohne Pensionskasse.',
      intro:
        'Was du während des Jahres in die Säule 3a (3e pilier A) einzahlst, wird von deinem Einkommen abgezogen, bis zu einer Obergrenze. Sie hängt davon ab, ob du einer Pensionskasse (2. Säule, caisse de pension) angeschlossen bist.',
      colYear: 'Jahr',
      colWith: 'Mit Pensionskasse',
      colWithout: 'Ohne Pensionskasse',
      without: '{share} des Erwerbseinkommens, höchstens {cap}',
      catchUpTitle: 'Nachzahlen (rachat 3a)',
      catchUp:
        'Im Jahr {year} kannst du auch Jahre nachholen, in denen du nicht das Maximum eingezahlt hast, ab {from} und innerhalb der letzten {years} Jahre: höchstens {cap} im Jahr des Nachzahlens.',
      paidInYear: 'Es zählen nur Einzahlungen, die während des Jahres gemacht werden.',
      cantonal:
        'Dieselben Obergrenzen gelten für die Kantons- und Gemeindesteuer: Genf folgt hier dem Bundesrecht.',
    },
    deadlines: {
      title: 'Steuerfristen {year}',
      summary:
        'Die Daten, die für das Genfer Steuerjahr {year} zählen: Säule 3a, Pensionskasseneinkauf, TOU und Einsprache.',
      intro:
        'Die Daten, die für das Steuerjahr {year} zählen, jedes mit dem Gesetz oder Leitfaden, das es festlegt.',
      days: '{days} Tage',
      items: {
        pillar3a: {
          title: 'In die Säule 3a einzahlen (3e pilier A)',
          text: 'Nur Einzahlungen während des Jahres zählen für dieses Jahr.',
        },
        lppBuyin: {
          title: 'Dich in die Pensionskasse einkaufen (rachat 2e pilier)',
          text: 'Ein Einkauf wird im Jahr abgezogen, in dem du ihn einzahlst.',
        },
        tou: {
          title:
            'Nachträgliche ordentliche Veranlagung beantragen (taxation ordinaire ultérieure, TOU)',
          text: 'Wenn du quellenbesteuert bist und für {year} eine normale Steuererklärung willst, schick deinen schriftlichen Antrag spätestens an diesem Tag an die Steuerverwaltung (AFC). Einmal eingereicht, kann er nicht zurückgezogen werden.',
        },
        objectionIcc: {
          title: 'Einsprache gegen die Veranlagung der Kantons- und Gemeindesteuer (réclamation)',
          text: 'Schriftlich, innert dieser Frist nach der Zustellung. Die Frist beginnt am Tag nach der Zustellung; endet sie an einem Samstag, Sonntag oder Feiertag, verschiebt sie sich auf den nächsten Werktag.',
        },
        objectionIfd: {
          title: 'Einsprache gegen die Veranlagung der direkten Bundessteuer (réclamation)',
          text: 'Schriftlich, innert dieser Frist nach der Zustellung. Die Frist beginnt am Tag nach der Zustellung; endet sie an einem Samstag, Sonntag oder Feiertag, verschiebt sie sich auf den nächsten Werktag.',
        },
      },
      filing:
        'Wann deine Steuererklärung fällig ist und wie du mehr Zeit (délai) beantragst, steht auf der Seite der Steuerverwaltung:',
    },
    deductions: {
      title: 'Abzüge und Obergrenzen {year}',
      summary:
        'Die wichtigsten Abzüge deiner Genfer Steuererklärung und ihre Obergrenzen, für die Kantons- und die Bundessteuer, jeder mit seiner offiziellen Quelle.',
      intro:
        'Abzüge senken dein steuerbares Einkommen. Die Kantons- und Gemeindesteuer (ICC) und die direkte Bundessteuer (IFD) haben je eigene Obergrenzen. Diese Seite zeigt die, die der Code von Taxpresso enthält, jede mit ihrer Quelle; der offizielle Leitfaden listet alle auf.',
      guide: 'Die vollständige Liste im offiziellen Leitfaden:',
      items: {
        professional: {
          name: 'Berufskosten, Pauschalabzug (frais professionnels)',
          text: '{rate} des Nettolohns, mindestens {min} und höchstens {max}',
        },
        pillar3a: {
          name: 'Säule 3a (3e pilier A)',
          text: 'Mit Pensionskasse: bis {withFund}. Ohne: {share} des Erwerbseinkommens, höchstens {withoutFund}.',
        },
        pillar3aCatchUp: {
          name: 'Nachzahlen in die Säule 3a (rachat 3a)',
          text: 'Höchstens {cap} im Jahr, für Jahre ab {from}, in denen du nicht das Maximum eingezahlt hast, innerhalb der letzten {years} Jahre.',
        },
        lppBuyin: {
          name: 'Einkauf in die Pensionskasse (rachat 2e pilier)',
          text: 'Bis zum Einkaufsbetrag, den dir deine Pensionskasse nennt.',
        },
        insurance: {
          name: 'Versicherungsprämien und Sparzinsen (primes d’assurances et intérêts de capitaux d’épargne)',
          text: 'Mit Beiträgen an die 2. Säule und die Säule 3a (avec contributions aux piliers 2 et 3a): höchstens {married} für Ehepaare, die zusammenleben, {other} für alle anderen, plus {perChild} pro Kind.',
        },
        child: { name: 'Kinderabzug (déduction pour enfant)', text: '{amount} pro Kind' },
        married: {
          name: 'Abzug für Ehepaare (déduction pour couples mariés)',
          text: '{amount}',
        },
        childTaxReduction: {
          name: 'Steuerermässigung pro Kind (réduction du montant de l’impôt par enfant)',
          text: '{amount} weniger Steuer, pro Kind',
        },
      },
    },
  },
};

const it: GenevaCopy = {
  htmlTitle: 'Cifre fiscali di Ginevra {year}: aliquote, limiti e scadenze · Taxpresso',
  metaDescription:
    'Le cifre dell’imposta ginevrina {year}, ognuna con la sua fonte ufficiale: centesimi addizionali comunali, limiti del pilastro 3a, scadenze e deduzioni.',
  link: 'Cifre fiscali di Ginevra',
  title: 'Cifre fiscali di Ginevra',
  lead: 'Le cifre che contano per la tua dichiarazione ginevrina, ognuna con la sua fonte ufficiale. Le pagine per gli altri cantoni arriveranno più avanti.',
  open: 'Vedi le cifre',
  year: 'Anno fiscale {year}',
  check: 'Controlla la fonte ufficiale prima di fidarti di una cifra: è lei che fa fede.',
  basis:
    'Ogni cifra di queste pagine viene dal codice di Taxpresso, dove cita il documento ufficiale indicato accanto. I documenti ufficiali sono in francese.',
  older:
    'Una cifra di un anno precedente è indicata con il suo anno: è l’ultima pubblicata nelle fonti ufficiali usate da Taxpresso.',
  disclaimer:
    'Queste pagine sono un riferimento, non una consulenza fiscale. Se hai dubbi, chiedi all’Amministrazione fiscale cantonale (AFC).',
  source: 'Fonte',
  sources: 'Fonti',
  cta: {
    title: 'Lascia le scartoffie a Taxpresso',
    text: 'Taxpresso prepara la tua dichiarazione ginevrina con Claude, sul tuo computer. Gratuito e open source.',
  },
  more: 'Altre cifre di Ginevra',
  all: 'Tutte le cifre di Ginevra',
  fromGuides:
    'Cerchi delle cifre? Guarda le [cifre fiscali di Ginevra]({href}): centesimi addizionali, limiti del pilastro 3a, scadenze e deduzioni.',
  tax: {
    icc: 'Imposta cantonale e comunale (ICC)',
    ifd: 'Imposta federale diretta (IFD)',
    both: 'Imposte cantonali, comunali e federali',
  },
  pages: {
    communes: {
      title: 'Centesimi addizionali comunali {year} (centimes additionnels)',
      summary:
        'I centesimi addizionali (centimes additionnels) di ciascuno dei {count} comuni ginevrini per il {year}, in un’unica tabella.',
      intro:
        'Ogni comune fissa i propri centesimi addizionali (centimes additionnels), e il Consiglio di Stato (Conseil d’État) li approva. Si calcolano sull’imposta di base cantonale (impôt de base): più alto è il numero, più alta è l’imposta comunale.',
      colCommune: 'Comune',
      colRate: 'Centesimi addizionali',
    },
    'pillar-3a': {
      title: 'Limiti del pilastro 3a, anno per anno',
      summary:
        'Quanto puoi dedurre al massimo per i versamenti nel pilastro 3a (3e pilier A), anno per anno, con o senza cassa pensione.',
      intro:
        'Ciò che versi nel pilastro 3a (3e pilier A) durante l’anno si deduce dal tuo reddito, fino a un limite. Il limite dipende dal fatto che tu sia affiliato a una cassa pensione (2° pilastro, caisse de pension).',
      colYear: 'Anno',
      colWith: 'Con cassa pensione',
      colWithout: 'Senza cassa pensione',
      without: '{share} del reddito da lavoro, al massimo {cap}',
      catchUpTitle: 'Il riscatto (rachat 3a)',
      catchUp:
        'Nel {year} puoi anche recuperare gli anni in cui non hai versato il massimo, a partire dal {from} ed entro gli ultimi {years} anni: al massimo {cap} nell’anno del riscatto.',
      paidInYear: 'Contano solo i versamenti fatti durante l’anno.',
      cantonal:
        'Gli stessi limiti valgono per l’imposta cantonale e comunale: qui Ginevra segue il diritto federale.',
    },
    deadlines: {
      title: 'Scadenze fiscali {year}',
      summary:
        'Le date che contano per l’anno fiscale {year} a Ginevra: pilastro 3a, riscatto nella cassa pensione, TOU e reclamo.',
      intro:
        'Le date che contano per l’anno fiscale {year}, ognuna con la legge o la guida che la stabilisce.',
      days: '{days} giorni',
      items: {
        pillar3a: {
          title: 'Versare nel pilastro 3a (3e pilier A)',
          text: 'Contano per quell’anno solo i versamenti fatti durante l’anno.',
        },
        lppBuyin: {
          title: 'Fare un riscatto nella cassa pensione (rachat 2e pilier)',
          text: 'Un riscatto si deduce nell’anno in cui lo versi.',
        },
        tou: {
          title: 'Chiedere la tassazione ordinaria ulteriore (taxation ordinaire ultérieure, TOU)',
          text: 'Se sei tassato alla fonte e vuoi una dichiarazione ordinaria per il {year}, invia la tua domanda scritta all’amministrazione fiscale (AFC) entro questo giorno. Una volta presentata, non può essere ritirata.',
        },
        objectionIcc: {
          title: 'Contestare la tassazione dell’imposta cantonale e comunale (réclamation)',
          text: 'Per iscritto, entro questo termine dalla notifica. Il termine decorre dal giorno dopo la notifica; se l’ultimo giorno è un sabato, una domenica o un giorno festivo, passa al primo giorno feriale successivo.',
        },
        objectionIfd: {
          title: 'Contestare la tassazione dell’imposta federale diretta (réclamation)',
          text: 'Per iscritto, entro questo termine dalla notifica. Il termine decorre dal giorno dopo la notifica; se l’ultimo giorno è un sabato, una domenica o un giorno festivo, passa al primo giorno feriale successivo.',
        },
      },
      filing:
        'Quando va presentata la dichiarazione e come chiedere una proroga (délai), sulla pagina dell’amministrazione fiscale:',
    },
    deductions: {
      title: 'Deduzioni e limiti {year}',
      summary:
        'Le principali deduzioni della tua dichiarazione ginevrina e i loro limiti, per l’imposta cantonale e quella federale, ognuna con la sua fonte ufficiale.',
      intro:
        'Le deduzioni riducono il tuo reddito imponibile. L’imposta cantonale e comunale (ICC) e l’imposta federale diretta (IFD) hanno ciascuna i propri limiti. Questa pagina mostra quelli contenuti nel codice di Taxpresso, ognuno con la sua fonte; la guida ufficiale li elenca tutti.',
      guide: 'L’elenco completo, nella guida ufficiale:',
      items: {
        professional: {
          name: 'Spese professionali, deduzione forfettaria (frais professionnels)',
          text: '{rate} del salario netto, almeno {min} e al massimo {max}',
        },
        pillar3a: {
          name: 'Pilastro 3a (3e pilier A)',
          text: 'Con cassa pensione: fino a {withFund}. Senza: {share} del reddito da lavoro, al massimo {withoutFund}.',
        },
        pillar3aCatchUp: {
          name: 'Riscatto nel pilastro 3a (rachat 3a)',
          text: 'Al massimo {cap} nell’anno, per gli anni dal {from} in cui non hai versato il massimo, entro gli ultimi {years} anni.',
        },
        lppBuyin: {
          name: 'Riscatto nella cassa pensione (rachat 2e pilier)',
          text: 'Fino all’importo di riscatto che ti indica la tua cassa pensione.',
        },
        insurance: {
          name: 'Premi assicurativi e interessi dei capitali a risparmio (primes d’assurances et intérêts de capitaux d’épargne)',
          text: 'Con contributi al 2° pilastro e al pilastro 3a (avec contributions aux piliers 2 et 3a): al massimo {married} per una coppia sposata che vive insieme, {other} per gli altri contribuenti, più {perChild} per figlio.',
        },
        child: { name: 'Deduzione per figli (déduction pour enfant)', text: '{amount} per figlio' },
        married: {
          name: 'Deduzione per coniugi (déduction pour couples mariés)',
          text: '{amount}',
        },
        childTaxReduction: {
          name: 'Riduzione dell’imposta per figlio (réduction du montant de l’impôt par enfant)',
          text: '{amount} in meno sull’imposta, per figlio',
        },
      },
    },
  },
};

const es: GenevaCopy = {
  htmlTitle: 'Cifras fiscales de Ginebra {year}: tipos, límites y plazos · Taxpresso',
  metaDescription:
    'Las cifras del impuesto de Ginebra {year}, cada una con su fuente oficial: recargos municipales, límites del pilar 3a, plazos y deducciones.',
  link: 'Cifras de Ginebra',
  title: 'Cifras fiscales de Ginebra',
  lead: 'Las cifras que cuentan para tu declaración de Ginebra, cada una con su fuente oficial. Las páginas de los demás cantones llegarán más adelante.',
  open: 'Ver las cifras',
  year: 'Año fiscal {year}',
  check: 'Comprueba la fuente oficial antes de fiarte de una cifra: es la que cuenta.',
  basis:
    'Cada cifra de estas páginas viene del código de Taxpresso, donde cita el documento oficial que aparece al lado. Los documentos oficiales están en francés.',
  older:
    'Una cifra de un año anterior aparece con su año: es la última publicada en las fuentes oficiales que usa Taxpresso.',
  disclaimer:
    'Estas páginas son una referencia, no asesoramiento fiscal. Si tienes dudas, pregunta a la Administración fiscal cantonal (AFC).',
  source: 'Fuente',
  sources: 'Fuentes',
  cta: {
    title: 'Deja el papeleo a Taxpresso',
    text: 'Taxpresso prepara tu declaración de Ginebra con Claude, en tu propio ordenador. Gratis y de código abierto.',
  },
  more: 'Más cifras de Ginebra',
  all: 'Todas las cifras de Ginebra',
  fromGuides:
    '¿Buscas cifras? Mira las [cifras fiscales de Ginebra]({href}): recargos municipales, límites del pilar 3a, plazos y deducciones.',
  tax: {
    icc: 'Impuesto cantonal y municipal (ICC)',
    ifd: 'Impuesto federal directo (IFD)',
    both: 'Impuestos cantonal, municipal y federal',
  },
  pages: {
    communes: {
      title: 'Recargos municipales {year} (centimes additionnels)',
      summary:
        'Los recargos (centimes additionnels) de cada uno de los {count} municipios de Ginebra para {year}, en una sola tabla.',
      intro:
        'Cada municipio fija su recargo, los centimes additionnels, y el Consejo de Estado (Conseil d’État) lo aprueba. Se calcula sobre el impuesto de base cantonal (impôt de base): cuanto más alto es el número, más alto es el impuesto municipal.',
      colCommune: 'Municipio',
      colRate: 'Centimes additionnels',
    },
    'pillar-3a': {
      title: 'Límites del pilar 3a, año por año',
      summary:
        'Lo máximo que puedes deducir por tus aportaciones al pilar 3a (3e pilier A), año por año, con o sin caja de pensiones.',
      intro:
        'Lo que aportas al pilar 3a (3e pilier A) durante el año se deduce de tus ingresos, hasta un límite. El límite depende de si estás afiliado a una caja de pensiones (2.º pilar, caisse de pension).',
      colYear: 'Año',
      colWith: 'Con caja de pensiones',
      colWithout: 'Sin caja de pensiones',
      without: '{share} de los ingresos del trabajo, como máximo {cap}',
      catchUpTitle: 'Recuperar años (rachat 3a)',
      catchUp:
        'En {year} también puedes recuperar los años en que no aportaste el máximo, desde {from} y dentro de los últimos {years} años: como máximo {cap} en el año en que recuperas.',
      paidInYear: 'Solo cuentan las aportaciones hechas durante el año.',
      cantonal:
        'Los mismos límites valen para el impuesto cantonal y municipal: aquí Ginebra sigue el derecho federal.',
    },
    deadlines: {
      title: 'Plazos fiscales {year}',
      summary:
        'Las fechas que cuentan para el año fiscal {year} en Ginebra: pilar 3a, aportaciones a la caja de pensiones, TOU y reclamación.',
      intro:
        'Las fechas que cuentan para el año fiscal {year}, cada una con la ley o la guía que la fija.',
      days: '{days} días',
      items: {
        pillar3a: {
          title: 'Aportar al pilar 3a (3e pilier A)',
          text: 'Solo cuentan para ese año las aportaciones hechas durante el año.',
        },
        lppBuyin: {
          title: 'Hacer una aportación voluntaria a tu caja de pensiones (rachat 2e pilier)',
          text: 'Una aportación voluntaria se deduce el año en que la pagas.',
        },
        tou: {
          title: 'Pedir la tributación ordinaria posterior (taxation ordinaire ultérieure, TOU)',
          text: 'Si tributas en la fuente y quieres una declaración ordinaria para {year}, envía tu solicitud por escrito a la administración fiscal (AFC) a más tardar ese día. Una vez presentada, no se puede retirar.',
        },
        objectionIcc: {
          title: 'Reclamar contra la liquidación del impuesto cantonal y municipal (réclamation)',
          text: 'Por escrito, dentro de este plazo desde la notificación. El plazo empieza el día después de la notificación; si el último día cae en sábado, domingo o festivo, pasa al siguiente día hábil.',
        },
        objectionIfd: {
          title: 'Reclamar contra la liquidación del impuesto federal directo (réclamation)',
          text: 'Por escrito, dentro de este plazo desde la notificación. El plazo empieza el día después de la notificación; si el último día cae en sábado, domingo o festivo, pasa al siguiente día hábil.',
        },
      },
      filing:
        'Cuándo hay que presentar la declaración y cómo pedir más tiempo (délai), en la página de la administración fiscal:',
    },
    deductions: {
      title: 'Deducciones y límites {year}',
      summary:
        'Las principales deducciones de tu declaración de Ginebra y sus límites, para el impuesto cantonal y el federal, cada una con su fuente oficial.',
      intro:
        'Las deducciones reducen tu base imponible. El impuesto cantonal y municipal (ICC) y el impuesto federal directo (IFD) tienen cada uno sus límites. Esta página muestra los que contiene el código de Taxpresso, cada uno con su fuente; la guía oficial los enumera todos.',
      guide: 'La lista completa, en la guía oficial:',
      items: {
        professional: {
          name: 'Gastos profesionales, deducción a tanto alzado (frais professionnels)',
          text: '{rate} del salario neto, como mínimo {min} y como máximo {max}',
        },
        pillar3a: {
          name: 'Pilar 3a (3e pilier A)',
          text: 'Con caja de pensiones: hasta {withFund}. Sin ella: {share} de los ingresos del trabajo, como máximo {withoutFund}.',
        },
        pillar3aCatchUp: {
          name: 'Recuperar años en el pilar 3a (rachat 3a)',
          text: 'Como máximo {cap} en el año, por los años desde {from} en que no aportaste el máximo, dentro de los últimos {years} años.',
        },
        lppBuyin: {
          name: 'Aportación voluntaria a la caja de pensiones (rachat 2e pilier)',
          text: 'Hasta el importe que te indique tu caja de pensiones.',
        },
        insurance: {
          name: 'Primas de seguros e intereses de capitales de ahorro (primes d’assurances et intérêts de capitaux d’épargne)',
          text: 'Con aportaciones al 2.º pilar y al pilar 3a (avec contributions aux piliers 2 et 3a): como máximo {married} para un matrimonio que vive junto, {other} para los demás contribuyentes, más {perChild} por hijo.',
        },
        child: { name: 'Deducción por hijo (déduction pour enfant)', text: '{amount} por hijo' },
        married: {
          name: 'Deducción para matrimonios (déduction pour couples mariés)',
          text: '{amount}',
        },
        childTaxReduction: {
          name: 'Reducción del impuesto por hijo (réduction du montant de l’impôt par enfant)',
          text: '{amount} menos de impuesto, por hijo',
        },
      },
    },
  },
};

const pt: GenevaCopy = {
  htmlTitle: 'Números fiscais de Genebra {year}: taxas, limites e prazos · Taxpresso',
  metaDescription:
    'Os números do imposto de Genebra {year}, cada um com a sua fonte oficial: adicionais comunais, limites do pilar 3a, prazos e deduções.',
  link: 'Números de Genebra',
  title: 'Números fiscais de Genebra',
  lead: 'Os números que contam para a tua declaração de Genebra, cada um com a sua fonte oficial. As páginas dos outros cantões chegam mais tarde.',
  open: 'Ver os números',
  year: 'Ano fiscal {year}',
  check: 'Verifica a fonte oficial antes de confiares num número: é ela que conta.',
  basis:
    'Cada número destas páginas vem do código do Taxpresso, onde cita o documento oficial indicado ao lado. Os documentos oficiais estão em francês.',
  older:
    'Um número de um ano anterior aparece com o seu ano: é o último publicado nas fontes oficiais que o Taxpresso usa.',
  disclaimer:
    'Estas páginas são uma referência, não aconselhamento fiscal. Em caso de dúvida, pergunta à Administração Fiscal Cantonal (AFC).',
  source: 'Fonte',
  sources: 'Fontes',
  cta: {
    title: 'Deixa a papelada com o Taxpresso',
    text: 'O Taxpresso prepara a tua declaração de Genebra com o Claude, no teu próprio computador. Grátis e de código aberto.',
  },
  more: 'Mais números de Genebra',
  all: 'Todos os números de Genebra',
  fromGuides:
    'Procuras números? Vê os [números fiscais de Genebra]({href}): adicionais comunais, limites do pilar 3a, prazos e deduções.',
  tax: {
    icc: 'Imposto cantonal e comunal (ICC)',
    ifd: 'Imposto federal direto (IFD)',
    both: 'Impostos cantonal, comunal e federal',
  },
  pages: {
    communes: {
      title: 'Adicionais comunais {year} (centimes additionnels)',
      summary:
        'Os adicionais (centimes additionnels) de cada uma das {count} comunas de Genebra para {year}, numa só tabela.',
      intro:
        'Cada comuna fixa o seu adicional, os centimes additionnels, e o Conselho de Estado (Conseil d’État) aprova-o. Calcula-se sobre o imposto de base cantonal (impôt de base): quanto mais alto o número, mais alto o imposto comunal.',
      colCommune: 'Comuna',
      colRate: 'Centimes additionnels',
    },
    'pillar-3a': {
      title: 'Limites do pilar 3a, ano a ano',
      summary:
        'O máximo que podes deduzir pelas tuas contribuições para o pilar 3a (3e pilier A), ano a ano, com ou sem caixa de pensões.',
      intro:
        'O que contribuis para o pilar 3a (3e pilier A) durante o ano é deduzido do teu rendimento, até um limite. O limite depende de estares inscrito numa caixa de pensões (2.º pilar, caisse de pension).',
      colYear: 'Ano',
      colWith: 'Com caixa de pensões',
      colWithout: 'Sem caixa de pensões',
      without: '{share} do rendimento do trabalho, no máximo {cap}',
      catchUpTitle: 'Recuperar anos (rachat 3a)',
      catchUp:
        'Em {year} também podes recuperar os anos em que não contribuíste com o máximo, desde {from} e dentro dos últimos {years} anos: no máximo {cap} no ano da recuperação.',
      paidInYear: 'Só contam as contribuições feitas durante o ano.',
      cantonal:
        'Os mesmos limites valem para o imposto cantonal e comunal: aqui Genebra segue o direito federal.',
    },
    deadlines: {
      title: 'Prazos fiscais {year}',
      summary:
        'As datas que contam para o ano fiscal {year} em Genebra: pilar 3a, contribuições para a caixa de pensões, TOU e reclamação.',
      intro:
        'As datas que contam para o ano fiscal {year}, cada uma com a lei ou o guia que a fixa.',
      days: '{days} dias',
      items: {
        pillar3a: {
          title: 'Contribuir para o pilar 3a (3e pilier A)',
          text: 'Só contam para esse ano as contribuições feitas durante o ano.',
        },
        lppBuyin: {
          title: 'Fazer uma contribuição voluntária para a caixa de pensões (rachat 2e pilier)',
          text: 'Uma contribuição voluntária é deduzida no ano em que a pagas.',
        },
        tou: {
          title: 'Pedir a tributação ordinária posterior (taxation ordinaire ultérieure, TOU)',
          text: 'Se és tributado na fonte e queres uma declaração normal para {year}, envia o teu pedido por escrito à administração fiscal (AFC) até este dia. Depois de entregue, não pode ser retirado.',
        },
        objectionIcc: {
          title: 'Reclamar da liquidação do imposto cantonal e comunal (réclamation)',
          text: 'Por escrito, dentro deste prazo após a notificação. O prazo começa no dia seguinte à notificação; se o último dia calhar a um sábado, domingo ou feriado, passa para o dia útil seguinte.',
        },
        objectionIfd: {
          title: 'Reclamar da liquidação do imposto federal direto (réclamation)',
          text: 'Por escrito, dentro deste prazo após a notificação. O prazo começa no dia seguinte à notificação; se o último dia calhar a um sábado, domingo ou feriado, passa para o dia útil seguinte.',
        },
      },
      filing:
        'Quando entregar a declaração e como pedir mais tempo (délai), na página da administração fiscal:',
    },
    deductions: {
      title: 'Deduções e limites {year}',
      summary:
        'As principais deduções da tua declaração de Genebra e os seus limites, para o imposto cantonal e o federal, cada uma com a sua fonte oficial.',
      intro:
        'As deduções reduzem o teu rendimento tributável. O imposto cantonal e comunal (ICC) e o imposto federal direto (IFD) têm cada um os seus limites. Esta página mostra os que o código do Taxpresso contém, cada um com a sua fonte; o guia oficial lista-os todos.',
      guide: 'A lista completa, no guia oficial:',
      items: {
        professional: {
          name: 'Despesas profissionais, dedução forfetária (frais professionnels)',
          text: '{rate} do salário líquido, no mínimo {min} e no máximo {max}',
        },
        pillar3a: {
          name: 'Pilar 3a (3e pilier A)',
          text: 'Com caixa de pensões: até {withFund}. Sem: {share} do rendimento do trabalho, no máximo {withoutFund}.',
        },
        pillar3aCatchUp: {
          name: 'Recuperar anos no pilar 3a (rachat 3a)',
          text: 'No máximo {cap} no ano, pelos anos desde {from} em que não contribuíste com o máximo, dentro dos últimos {years} anos.',
        },
        lppBuyin: {
          name: 'Contribuição voluntária para a caixa de pensões (rachat 2e pilier)',
          text: 'Até ao montante que a tua caixa de pensões te indicar.',
        },
        insurance: {
          name: 'Prémios de seguros e juros de capitais de poupança (primes d’assurances et intérêts de capitaux d’épargne)',
          text: 'Com contribuições para o 2.º pilar e o pilar 3a (avec contributions aux piliers 2 et 3a): no máximo {married} para um casal casado que vive junto, {other} para os outros contribuintes, mais {perChild} por filho.',
        },
        child: { name: 'Dedução por filho (déduction pour enfant)', text: '{amount} por filho' },
        married: {
          name: 'Dedução para casais casados (déduction pour couples mariés)',
          text: '{amount}',
        },
        childTaxReduction: {
          name: 'Redução do imposto por filho (réduction du montant de l’impôt par enfant)',
          text: '{amount} a menos no imposto, por filho',
        },
      },
    },
  },
};

export const geneva: Record<Lang, GenevaCopy> = { fr, en, de, it, es, pt };

/** The Geneva reference pages of a language. */
export const genevaPath = (path: string) => `${path}geneva/`;
export const genevaPagePath = (path: string, id: GenevaId) => `${genevaPath(path)}${id}/`;
