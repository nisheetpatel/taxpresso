// The guides: short how-tos, one page each, in every language of the site (render.ts renders the
// index at /guides/ and one page per guide). Same voice as content.ts: vous in French, the
// informal you in German, Italian, Spanish and Portuguese, Swiss spelling in German, no en or em
// dashes, official French terms next to their gloss. A native speaker reviews each language before
// launch (SPEC.md section 1).
//
// Facts come from the official documents in docs/sources (SPEC.md section 7b), never from memory.
// The comment above each French section names the manifest id and page or article it rests on;
// the other languages say the same things in the same order. Product claims ("With Taxpresso")
// follow SPEC.md and the README. No tax amounts, rates or limits in the prose: the official pages
// listed at the end of each guide have the numbers for the year. Links go only to pages listed in
// docs/sources/<canton>/manifest.json (a test checks it), plus the project's own source code.

import { SOURCE_URL, type Lang } from './content.ts';

export const GUIDE_IDS = [
  'documents',
  'pillar-3a',
  'tou',
  'couples',
  'assessment',
  'privacy',
] as const;
export type GuideId = (typeof GUIDE_IDS)[number];

export interface Section {
  h: string;
  /** Paragraphs; [text](https://...) and [text](/path/) become links. */
  p: string[];
  /** A bulleted list after the paragraphs. */
  list?: string[];
}

export interface Guide {
  title: string;
  /** One or two lines: the index card and the meta description. */
  summary: string;
  sections: Section[];
  /** Labels of the official pages, in the order of GUIDE_SOURCES. */
  sources: string[];
}

export interface GuidesCopy {
  htmlTitle: string;
  metaDescription: string;
  title: string;
  lead: string;
  /** What the guides rest on, and when the official pages were checked. */
  basis: string;
  disclaimer: string;
  sourcesTitle: string;
  sourcesNote: string;
  moreTitle: string;
  all: string;
  read: string;
  guides: Record<GuideId, Guide>;
}

// Official pages, by their id in docs/sources/<canton>/manifest.json. A PDF can open at a page.
const GE_GUIDE_2025 = 'https://www.ge.ch/document/41995/annexe/file/573038'; // ge-2025-guide-declaration-pp
const GE_E_RELEVE = 'https://www.ge.ch/node/13593'; // ge-na-other-e-releve-fiscal
const GE_DELAI =
  'https://www.ge.ch/remplir-ma-declaration-impot-tant-que-particulier/demander-delai-ma-declaration-impot'; // ge-na-other-demander-delai
const GE_REMPLIR =
  'https://www.ge.ch/remplir-ma-declaration-impot-tant-que-particulier/comment-remplir-ma-declaration-impot'; // ge-na-guide-remplir-declaration
const GE_DRIS_TOU = 'https://www.ge.ch/demande-rectification-taxation-ordinaire-ulterieure'; // ge-2025-dris-tou-page
const GE_EN_LIGNE = 'https://www.ge.ch/getax/declaration-ligne-particuliers'; // ge-2025-declaration-en-ligne
const GE_ESPACE_FISCAL = 'https://www.ge.ch/espace-fiscal-e-demarches/gerer-mes-declarations-impot'; // ge-na-efiling-espace-fiscal
const GE_LIPP = 'https://silgeneve.ch/legis/data/rsg_d3_08.htm'; // ge-na-law-lipp
const GE_LPFISC = 'https://silgeneve.ch/legis/data/rsg_d3_17.htm'; // ge-na-law-lpfisc
const CH_FORM_2A_2026 = 'https://www.estv.admin.ch/dam/fr/sd-web/oQ0wWcDmCJTS/2a-2026-fr.pdf'; // ch-2026-ifd-instructions-personnes-physiques
const CH_LIFD =
  'https://www.fedlex.admin.ch/filestore/fedlex.data.admin.ch/eli/cc/1991/1184_1184_1184/20260101/fr/pdf-a/fedlex-data-admin-ch-eli-cc-1991-1184_1184_1184-20260101-fr-pdf-a.pdf'; // ch-na-law-lifd
const at = (pdf: string, page: number) => `${pdf}#page=${page}`;

/** The official pages each guide ends with, the same in every language. */
export const GUIDE_SOURCES: Record<GuideId, string[]> = {
  documents: [at(GE_GUIDE_2025, 8), at(GE_GUIDE_2025, 10), GE_E_RELEVE, GE_DELAI, GE_REMPLIR],
  'pillar-3a': [at(CH_FORM_2A_2026, 7), at(GE_GUIDE_2025, 18)],
  tou: [GE_DRIS_TOU, at(GE_GUIDE_2025, 52), at(CH_LIFD, 51)],
  couples: [at(GE_GUIDE_2025, 5), at(GE_GUIDE_2025, 45), at(GE_GUIDE_2025, 53), GE_LIPP],
  assessment: [GE_LPFISC, at(CH_LIFD, 71), at(GE_GUIDE_2025, 4)],
  privacy: [GE_EN_LIGNE, GE_ESPACE_FISCAL],
};

/**
 * French typography on every string: a non-breaking space before ? ! : ; and inside « », and
 * between a day and its month, so "31 mars" never breaks across lines.
 */
const NB = String.fromCharCode(0xa0);
const MONTHS =
  /(\d(?:er)?) (janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)/g;
function frenchSpacing<T>(v: T): T {
  if (typeof v === 'string')
    return v
      .replace(/ ([?!:;»])/g, `${NB}$1`)
      .replace(/« /g, `«${NB}`)
      .replace(MONTHS, `$1${NB}$2`) as T;
  if (Array.isArray(v)) return v.map(frenchSpacing) as T;
  if (v && typeof v === 'object')
    return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, frenchSpacing(x)])) as T;
  return v;
}

// French: plain spaces before ? ! : ; here, frenchSpacing makes them non-breaking.
const fr: GuidesCopy = frenchSpacing({
  htmlTitle: 'Guides Taxpresso : votre déclaration genevoise, en clair',
  metaDescription:
    'Des guides courts sur la déclaration d’impôt à Genève : documents, 3e pilier A, TOU, couple, avis de taxation, confidentialité. Avec les liens officiels.',
  title: 'Guides',
  lead: 'Des guides courts pour comprendre votre déclaration genevoise. Chacun se termine par les pages officielles, qui font foi.',
  basis:
    'D’après le guide fiscal genevois 2025, le dernier paru, les instructions fédérales 2026 et les lois en vigueur. Pages officielles consultées le 13 octobre 2026.',
  disclaimer:
    'Ces guides expliquent comment les choses fonctionnent. Ils ne remplacent ni les documents officiels ni un conseil fiscal. En cas de doute, demandez à l’Administration fiscale cantonale (AFC).',
  sourcesTitle: 'Sources officielles',
  sourcesNote: 'Pages de l’administration. Elles s’ouvrent dans un nouvel onglet.',
  moreTitle: 'Les autres guides',
  all: 'Tous les guides',
  read: 'Lire le guide',
  guides: {
    documents: {
      title: 'Vos documents : quoi rassembler, et où les trouver',
      summary:
        'Les justificatifs à réunir pour votre déclaration, ceux à joindre et ceux à garder, et le délai du 31 mars.',
      sections: [
        // ge-2025-guide-declaration-pp p. 8
        {
          h: 'Pour tout votre foyer',
          p: [
            'Rassemblez les justificatifs de l’année pour tout votre foyer fiscal : vous, votre conjoint ou partenaire, et vos enfants mineurs à charge.',
          ],
        },
        // ge-2025-guide-declaration-pp p. 8 (Revenus), p. 10 (Annexe A)
        {
          h: 'Vos revenus',
          p: ['Ce que vous avez touché dans l’année :'],
          list: [
            'Le certificat de salaire, un par employeur.',
            'Les attestations d’indemnités : chômage, maladie, accident.',
            'Les attestations de rentes : AVS ou AI, caisse de pension.',
            'Le montant de la pension alimentaire reçue.',
          ],
        },
        // ge-2025-guide-declaration-pp p. 8 (Comptes bancaires et titres), p. 10 (Annexe F);
        // ge-na-other-e-releve-fiscal (import into GeTax, no direct bank-to-AFC transmission)
        {
          h: 'Vos comptes et vos titres',
          p: [
            'Pour chaque banque, le relevé de vos comptes au 31 décembre, y compris les comptes joints et ceux de vos enfants mineurs, avec les frais bancaires. Pour un portefeuille de titres, le relevé fiscal qui regroupe toutes les positions.',
            'Certaines banques proposent un e-relevé fiscal, un état des titres électronique : GeTax, le logiciel du canton, peut l’importer et remplir ces pages pour vous. Votre banque n’envoie rien elle-même à l’administration fiscale.',
          ],
        },
        // ge-2025-guide-declaration-pp p. 8 (Déductions, Frais professionnels, Intérêts), p. 10 (21EDP)
        {
          h: 'Vos déductions',
          p: ['Les attestations et justificatifs de ce que vous avez payé :'],
          list: [
            'L’attestation 3e pilier A, de votre banque ou de votre assurance.',
            'L’attestation de rachat 2e pilier (formulaire 21EDP), si vous en avez fait un.',
            'Les primes d’assurance-maladie, de base et complémentaires.',
            'Les frais médicaux restés à votre charge (décompte LAMal).',
            'Les frais de garde des enfants : crèche, nourrice, parascolaire.',
            'Les dons à des associations ou à des partis politiques en Suisse.',
            'Les intérêts d’emprunt : le relevé de la banque ou du prêteur.',
            'La pension alimentaire versée, et le jugement ou la convention qui la fixe.',
          ],
        },
        // ge-2025-guide-declaration-pp p. 10 (Les justificatifs: three columns)
        {
          h: 'À joindre, ou à garder',
          p: ['Le guide fiscal genevois distingue trois cas :'],
          list: [
            'À joindre toujours : certificats de salaire et d’indemnités, attestations 3e pilier A et de rachat 2e pilier, relevés fiscaux de vos titres.',
            'À joindre seulement si c’est nouveau ou si le montant a nettement changé : certificats de rentes, justificatifs de dettes, jugement de divorce ou de séparation.',
            'À garder, au cas où l’AFC les demande : attestations de vos comptes salaire et épargne, justificatifs des frais médicaux et des dons.',
          ],
        },
        // ge-na-guide-remplir-declaration (31 mars, sauf exception); ge-na-other-demander-delai
        // (channels by period, fee by length); ge-na-efiling-espace-fiscal (zéro papier)
        {
          h: 'Quand',
          p: [
            'Sauf exception, le délai pour envoyer votre déclaration est le 31 mars de l’année qui suit. Besoin de plus de temps ? Demandez un délai : du 1er janvier au 31 octobre depuis votre espace fiscal (e-démarches), par formulaire en ligne, par téléphone ou par courrier, puis du 1er novembre au 31 décembre par courrier seulement. Un délai est facturé, selon sa durée.',
            'En ligne, vous pouvez déposer en mode zéro papier si tous vos justificatifs sont joints en PDF.',
          ],
        },
        // Product: the "Encore manquant" list is derived from the answers (SPEC.md sections 5, 6).
        {
          h: 'Avec Taxpresso',
          p: [
            'Ajoutez vos documents à votre dossier Taxpresso au fur et à mesure. La liste « Encore manquant » suit vos réponses : elle ne demande que ce qui vous concerne.',
          ],
        },
      ],
      sources: [
        'Guide fiscal 2025 : Documents nécessaires (PDF, p. 8)',
        'Guide fiscal 2025 : Les justificatifs (PDF, p. 10)',
        'Déclarez vos titres avec le e-relevé fiscal',
        'Demander un délai pour ma déclaration d’impôt',
        'Comment remplir ma déclaration d’impôt',
      ],
    },

    'pillar-3a': {
      title: '3e pilier A : versez avant le 31 décembre',
      summary:
        'Ce que vous versez au 3e pilier A diminue votre revenu imposable, mais seulement si l’argent est versé dans l’année.',
      sections: [
        // ch-2026-ifd-instructions-personnes-physiques p. 7 (chiffre 13); ge-2025-guide-declaration-pp p. 18
        {
          h: 'C’est quoi ?',
          p: [
            'Le 3e pilier A (prévoyance individuelle liée) est un compte de prévoyance dans une banque ou une assurance. Ce que vous y versez dans l’année est déduit de votre revenu imposable, jusqu’à une limite annuelle.',
          ],
        },
        // ch-2026-ifd-instructions-personnes-physiques p. 7: "Seules les cotisations effectivement
        // versées en 2026 peuvent être déduites"; ge-2025-guide-declaration-pp p. 18 ("effectués en 2025")
        {
          h: 'Pourquoi avant le 31 décembre',
          p: [
            'Seuls les versements effectués pendant l’année fiscale comptent. Un versement fait en janvier compte pour la nouvelle année, pas pour celle que vous déclarez. Laissez à votre virement le temps d’arriver.',
          ],
        },
        // ch-2026-ifd-instructions-personnes-physiques p. 7 (gainful activity, AVS/AI, interruptions)
        {
          h: 'Qui peut verser',
          p: [
            'Il faut un revenu d’une activité lucrative, salariée ou indépendante, et être assuré à l’AVS/AI. Une interruption passagère (service militaire, chômage, maladie) ne fait pas perdre ce droit.',
          ],
        },
        // ch-2026-ifd-instructions-personnes-physiques p. 7 (two limits), p. 8 (rachats from 2026
        // for gaps since 1 January 2025, under conditions); ge-2025-guide-declaration-pp p. 18
        {
          h: 'Combien',
          p: [
            'La limite dépend de votre caisse de pension (2e pilier). Si vous y êtes affilié, c’est un montant maximum fixe. Sinon, c’est une part de votre revenu d’activité, jusqu’à un maximum plus élevé. Les montants changent selon les années : ils figurent dans les instructions fédérales et dans le guide genevois, liés ci-dessous.',
            'Depuis 2026, vous pouvez aussi rattraper les années où vous n’avez pas versé le maximum, à partir de 2025 et sous conditions.',
          ],
        },
        // ge-2025-guide-declaration-pp p. 18 (codes 31.40 c.A and 41.40 c.B)
        {
          h: 'En couple',
          p: [
            'Chacun verse sur son propre compte et a sa propre ligne dans la déclaration (c.A et c.B).',
          ],
        },
        // ch-2026-ifd-instructions-personnes-physiques p. 7 (attestation must be attached);
        // ge-2025-guide-declaration-pp p. 10
        {
          h: 'Ce qu’il faut garder',
          p: [
            'Votre banque ou votre assurance vous envoie une attestation. Joignez-la à votre déclaration : sans elle, la déduction n’est pas admise.',
          ],
        },
        // ch-2026-ifd-instructions-personnes-physiques p. 3 (chiffre 3: capital taxed separately;
        // chiffre 3.2: pillar 3a payouts taxable). Product: the 3a plan (README, SPEC.md section 8 B).
        {
          h: 'Bon à savoir',
          p: [
            'Cet argent est fait pour la retraite. Quand il vous est versé, il est imposé : à part, s’il est versé en capital.',
            'Avec Taxpresso, demandez à Claude ce qu’un versement vous ferait économiser cette année : il vous montre la marge qui vous reste, d’après les limites officielles.',
          ],
        },
      ],
      sources: [
        'Instructions IFD 2026 (formulaire 2a), chiffre 13 (PDF, p. 7)',
        'Guide fiscal 2025 : Déductions des cotisations et des rachats (PDF, p. 18)',
      ],
    },

    tou: {
      title: 'Imposé à la source : la taxation ordinaire ultérieure (TOU)',
      summary:
        'Comment fonctionne la TOU, quand elle est obligatoire, le délai du 31 mars, et pourquoi on ne peut pas revenir en arrière.',
      sections: [
        // ge-2025-dris-tou-page (L’essentiel en bref)
        {
          h: 'L’impôt à la source',
          p: [
            'Si vous êtes imposé à la source, votre employeur retient l’impôt directement sur votre salaire, selon un barème. Ce barème ne connaît pas toute votre situation : enfants à charge, revenus de votre conjoint, déductions ou frais effectifs.',
          ],
        },
        // ge-2025-guide-declaration-pp p. 52 (what TOU allows), p. 53 (withheld tax deducted,
        // refund or supplement)
        {
          h: 'Ce qu’est la TOU',
          p: [
            'Avec la taxation ordinaire ultérieure (TOU), vous remplissez une déclaration d’impôt normale. L’AFC peut alors tenir compte de déductions et de frais effectifs que les barèmes n’intègrent pas. L’impôt déjà retenu est déduit de l’impôt final : selon votre situation, vous êtes remboursé ou vous payez un supplément.',
          ],
        },
        // ge-2025-guide-declaration-pp p. 52 (Résidents en Suisse: the mandatory cases);
        // ch-na-law-lifd art. 89 al. 1, art. 89a al. 1 (p. 51)
        {
          h: 'Obligatoire ou sur demande',
          p: [
            'Si vous habitez en Suisse, la TOU est obligatoire dans certains cas : salaire brut annuel au-dessus d’un seuil, autres revenus non imposés à la source au-dessus d’un montant, bien immobilier à Genève, fortune imposable, ou TOU l’année précédente. Le guide genevois donne les seuils de l’année. Dans les autres cas, vous pouvez la demander.',
          ],
        },
        // ge-2025-dris-tou-page (31 March, online or paper, otherwise final); ge-2025-guide-declaration-pp
        // p. 52; ch-na-law-lifd art. 89a al. 3 (p. 51)
        {
          h: 'Le délai : le 31 mars',
          p: [
            'Envoyez le formulaire DRIS/TOU au plus tard le 31 mars de l’année qui suit celle où l’impôt a été retenu. Il se remplit en ligne depuis votre espace fiscal (e-démarches), ou sur papier si vous l’avez reçu par courrier. Sans formulaire, l’impôt retenu par votre employeur devient définitif, sauf rectification par l’AFC.',
          ],
        },
        // ge-2025-guide-declaration-pp p. 52 ("il ne vous sera plus possible de revenir...";
        // "Vous resterez soumis à la TOU pour toutes les années fiscales futures"); ch-na-law-lifd
        // art. 89 al. 5, art. 89a al. 2 and 5 (p. 51)
        {
          h: 'On ne peut pas revenir en arrière',
          p: [
            'Une fois la TOU demandée, il n’est plus possible de revenir à l’impôt à la source, quel que soit le résultat. Vous restez en TOU toutes les années suivantes, jusqu’à la fin de votre imposition à la source. Si vous êtes marié et vivez ensemble, la demande vaut aussi pour votre conjoint.',
          ],
        },
        // ge-2025-dris-tou-page (DRIS on the same form)
        {
          h: 'Juste une correction ?',
          p: [
            'Si vous voulez seulement faire corriger l’impôt retenu, parce qu’il ne tient pas compte de votre situation réelle, le même formulaire permet une demande de rectification de l’impôt à la source (DRIS), dans le même délai.',
          ],
        },
        // Product: the TOU question's help text (data/ge/2026/questionnaire.yaml), SPEC.md section 8 C.
        {
          h: 'Avec Taxpresso',
          p: [
            'Prenez le temps de comparer avant de décider : Taxpresso vous montrera les deux cas, avec leurs montants. C’est vous qui envoyez le formulaire.',
          ],
        },
      ],
      sources: [
        'Demande de rectification ou taxation ordinaire ultérieure',
        'Guide fiscal 2025 : la TOU pour les contribuables imposés à la source (PDF, p. 52)',
        'Loi sur l’impôt fédéral direct (LIFD), art. 89a (PDF, p. 51)',
      ],
    },

    couples: {
      title: 'Déclarer en couple',
      summary:
        'Mariés ou partenaires enregistrés : une seule déclaration, qui remplit quoi, et comment Genève calcule le taux.',
      sections: [
        // ge-na-law-lipp art. 8 al. 1 and 2; ch-na-law-lifd art. 9 al. 1 and 1bis (p. 5). Joint
        // taxation is for spouses and registered partners only.
        {
          h: 'Une déclaration pour deux',
          p: [
            'Si vous êtes mariés ou liés par un partenariat enregistré et vivez ensemble, vous remplissez une seule déclaration. Vos revenus et vos fortunes s’additionnent, quel que soit votre régime matrimonial. En concubinage, chacun remplit sa propre déclaration.',
          ],
        },
        // ge-2025-guide-declaration-pp p. 53 (Changements de situation); ge-na-law-lipp art. 66 al. 1 and 3
        {
          h: 'Le 31 décembre décide',
          p: [
            'Votre état civil au 31 décembre compte pour toute l’année. Mariés pendant l’année : une seule déclaration, avec tout ce qui concerne le couple depuis le 1er janvier. Séparés ou divorcés pendant l’année : chacun remplit sa propre déclaration pour toute l’année.',
          ],
        },
        // ge-2025-guide-declaration-pp p. 5 (c.A, c.B, scission informative)
        {
          h: 'Qui remplit quoi',
          p: [
            'La personne dont le nom figure à gauche de la déclaration remplit les rubriques c.A (contribuable A), son conjoint à droite les rubriques c.B. Remplissez chacun les vôtres avec soin : l’AFC s’en sert pour calculer la part d’impôt de chacun, indiquée sur une scission informative jointe au bordereau.',
          ],
        },
        // ge-2025-guide-declaration-pp p. 45 (splitting intégral); ge-na-law-lipp art. 41 al. 2;
        // ge-2025-guide-declaration-pp p. 11 and p. 21 (deduction for two-income couples, ICC and IFD)
        {
          h: 'Le taux à Genève',
          p: [
            'Pour atténuer l’effet de deux revenus additionnés, Genève divise par deux le revenu total du couple pour trouver le taux d’impôt (splitting intégral). Si vous travaillez tous les deux, une déduction sur le gain de l’un des époux s’ajoute, pour l’impôt cantonal comme pour l’impôt fédéral.',
          ],
        },
        // ge-na-law-lipp art. 12 al. 1; ch-na-law-lifd art. 13 al. 1
        {
          h: 'Responsables ensemble',
          p: ['Les époux qui vivent ensemble répondent solidairement de l’impôt total du couple.'],
        },
        // Product: per-person questions and documents (data/ge/2026/questionnaire.yaml).
        {
          h: 'Avec Taxpresso',
          p: [
            'Dites à Claude que vous êtes mariés : Taxpresso pose ensuite ses questions pour chacun de vous, et classe les documents par personne.',
          ],
        },
      ],
      sources: [
        'Guide fiscal 2025 : Comment remplir ma déclaration (PDF, p. 5)',
        'Guide fiscal 2025 : Barème et splitting (PDF, p. 45)',
        'Guide fiscal 2025 : Changements de situation (PDF, p. 53)',
        'Loi sur l’imposition des personnes physiques (LIPP), art. 8, 41 et 66',
      ],
    },

    assessment: {
      title: 'Votre avis de taxation, et comment le contester',
      summary:
        'Ce que vous recevez après votre déclaration, comment le vérifier, et comment faire une réclamation dans les 30 jours.',
      sections: [
        // ge-2025-guide-declaration-pp p. 4 (bordereaux définitifs, avis de taxation), p. 53
        {
          h: 'Ce que vous recevez',
          p: [
            'Une fois votre déclaration traitée, l’AFC vous envoie vos bordereaux d’impôt (les factures) pour l’impôt cantonal et communal (ICC) et pour l’impôt fédéral direct (IFD), et un avis de taxation qui récapitule les montants pris en compte pour le calcul.',
          ],
        },
        // ge-2025-guide-declaration-pp p. 4 (refund within 30 days; 30 days to pay or contest).
        // Product: the assessment check (SPEC.md section 10.8, README).
        {
          h: 'Vérifiez-le',
          p: [
            'Comparez l’avis de taxation avec votre déclaration, ligne par ligne. Si vos acomptes dépassent l’impôt, l’AFC vous rembourse dans les 30 jours. Sinon, vous avez 30 jours pour payer ou contester le montant demandé.',
            'Avec Taxpresso, déposez l’avis dans votre dossier : Taxpresso le compare à votre déclaration, poste par poste, et vous indique le délai de réclamation.',
          ],
        },
        // ge-na-law-lpfisc art. 39 al. 1; ch-na-law-lifd art. 132 al. 1 (p. 71)
        {
          h: 'La réclamation : 30 jours',
          p: [
            'Si vous n’êtes pas d’accord, adressez une réclamation écrite à l’administration fiscale qui vous a taxé, dans les 30 jours qui suivent la notification. Ce délai vaut pour l’impôt cantonal et communal comme pour l’impôt fédéral direct.',
          ],
        },
        // ge-na-law-lpfisc art. 41 al. 1; ch-na-law-lifd art. 133 al. 1 (p. 71)
        {
          h: 'Comment compter',
          p: [
            'Le délai commence le lendemain de la notification. Il est respecté si vous remettez votre réclamation à l’administration fiscale ou à un bureau de poste suisse au plus tard le dernier jour. Si ce jour tombe un samedi, un dimanche ou un jour férié, le délai passe au jour ouvrable suivant. En cas de doute, demandez à l’AFC.',
          ],
        },
        // ge-na-law-lpfisc art. 39 al. 2; ch-na-law-lifd art. 132 al. 3 (taxation d’office);
        // ge-na-guide-remplir-declaration (taxation d’office after unanswered reminders)
        {
          h: 'Quoi écrire',
          p: [
            'Indiquez ce que vous contestez et pourquoi, et joignez une copie des documents qui le montrent. Si vous avez été taxé d’office, par exemple faute de déclaration, la réclamation doit expliquer en quoi la taxation est manifestement inexacte et donner les preuves.',
          ],
        },
        // ge-na-law-lpfisc art. 40 al. 2, art. 43 al. 1 and 3; ch-na-law-lifd art. 135 al. 1 and 3
        // (p. 72). Product: Taxpresso never files the objection (SPEC.md section 10.8).
        {
          h: 'Ensuite',
          p: [
            'La réclamation est en principe gratuite. L’administration fiscale peut revoir tous les éléments de votre taxation et, après vous avoir entendu, la modifier aussi en votre défaveur. Le montant que vous ne contestez pas reste à payer dans les délais. Taxpresso n’envoie jamais la réclamation à votre place.',
          ],
        },
      ],
      sources: [
        'Loi de procédure fiscale (LPFisc), art. 39 à 43',
        'Loi sur l’impôt fédéral direct (LIFD), art. 132 à 135 (PDF, p. 71)',
        'Guide fiscal 2025 : Agenda (PDF, p. 4)',
      ],
    },

    privacy: {
      title: 'Vos données restent sur votre ordinateur',
      summary:
        'Ce que Taxpresso garde chez vous, ce que Claude voit, et comment régler la confidentialité de Claude.',
      sections: [
        // Product: SPEC.md C2 and sections 3 and 15; README (folder, no network requests).
        {
          h: 'Sur votre ordinateur',
          p: [
            'Taxpresso est une extension qui fonctionne dans Claude Desktop, sur votre ordinateur. Vos réponses et vos documents restent dans un dossier à vous, Documents/Taxpresso, sauf si vous en avez choisi un autre. L’extension ne fait aucune requête sur internet : pas de serveur, pas de compte, pas de traceur. Le tableau de bord ne fonctionne que sur votre ordinateur.',
          ],
        },
        // Product: SPEC.md C6, C7 and section 15 (documents reach Claude only when it reads them).
        {
          h: 'Ce que Claude voit',
          p: [
            'Claude, l’IA avec laquelle vous parlez, fonctionne avec votre propre compte Claude. Il voit ce que vous écrivez dans la conversation et les documents qu’il lit avec vous, pour vous proposer des valeurs que vous confirmez. Taxpresso ne lit que les documents de votre dossier, jamais votre historique de conversations.',
          ],
        },
        // Same setting as on the home and Get started pages (content.ts).
        {
          h: 'Vos réglages dans Claude',
          p: [
            'Dans les paramètres de Claude, rubrique Confidentialité, vous décidez si vos conversations peuvent servir à améliorer Claude. Faites ce réglage avant de commencer, et supprimez vos conversations sur vos impôts une fois votre déclaration faite.',
          ],
        },
        // Product: SPEC.md C4. ge-2025-declaration-en-ligne (data kept, editable until final
        // transmission; "Vous êtes responsable de l’exactitude des chiffres déclarés").
        {
          h: 'Vous vous connectez, vous transmettez',
          p: [
            'Pour remplir la déclaration en ligne officielle, vous vous connectez vous-même à votre compte e-démarches. Claude ne tape jamais vos mots de passe et n’appuie jamais sur Transmettre : c’est vous. La déclaration en ligne garde vos saisies et reste modifiable jusqu’à la transmission finale, et vous restez responsable des chiffres déclarés.',
          ],
        },
        // Product: SPEC.md section 3 (a normal folder; disk encryption recommended).
        {
          h: 'Protégez votre dossier',
          p: [
            'C’est un dossier normal : sauvegardez-le ou supprimez-le comme n’importe quel autre. Il est aussi sûr que votre ordinateur : protégez celui-ci par un mot de passe et activez le chiffrement du disque.',
          ],
        },
        {
          h: 'Vérifiez par vous-même',
          p: [
            `Taxpresso est open source : chacun peut lire son [code source](${SOURCE_URL}) et vérifier ce qu’il fait.`,
          ],
        },
      ],
      sources: ['La déclaration en ligne des particuliers', 'Gérer mes déclarations d’impôt'],
    },
  },
});

const en: GuidesCopy = {
  htmlTitle: 'Taxpresso guides: your Geneva tax return, in plain words',
  metaDescription:
    'Short guides to the Geneva tax return: documents, pillar 3a, TOU, couples, your assessment, privacy. With links to the official pages.',
  title: 'Guides',
  lead: 'Short guides to help you understand your Geneva tax return. Each one ends with the official pages, which have the final word.',
  basis:
    'Based on the 2025 Geneva tax guide, the latest published, the 2026 federal instructions and the laws in force. Official pages checked on 13 October 2026.',
  disclaimer:
    'These guides explain how things work. They don’t replace the official documents or tax advice. If in doubt, ask the cantonal tax office (AFC).',
  sourcesTitle: 'Official sources',
  sourcesNote: 'Government pages, in French. They open in a new tab.',
  moreTitle: 'Other guides',
  all: 'All guides',
  read: 'Read the guide',
  guides: {
    documents: {
      title: 'Your documents: what to gather, and where to find them',
      summary:
        'The papers your return needs, which ones to attach and which to keep, and the 31 March deadline.',
      sections: [
        {
          h: 'For your whole household',
          p: [
            'Gather the year’s documents for everyone in your tax household: you, your spouse or partner, and the minor children you support.',
          ],
        },
        {
          h: 'Your income',
          p: ['What you were paid during the year:'],
          list: [
            'Your salary certificate (certificat de salaire), one from each employer.',
            'Benefit attestations (attestations d’indemnités): unemployment, sickness, accident.',
            'Pension statements (attestations de rentes): AVS or AI, pension fund.',
            'The alimony or child support you received (pension alimentaire).',
          ],
        },
        {
          h: 'Your accounts and securities',
          p: [
            'For each bank, the statement of your accounts on 31 December, including joint accounts and your minor children’s, with your bank fees. For a securities portfolio, the tax statement (relevé fiscal) that lists every position.',
            'Some banks offer an e-tax statement (e-relevé fiscal), an electronic list of your securities: GeTax, the canton’s software, can import it and fill in those pages for you. Your bank doesn’t send anything to the tax office itself.',
          ],
        },
        {
          h: 'Your deductions',
          p: ['Attestations and receipts for what you paid:'],
          list: [
            'Pillar 3a attestation (attestation 3e pilier A), from your bank or insurer.',
            'Pension fund buy-in attestation (rachat 2e pilier, form 21EDP), if you made one.',
            'Health insurance premiums, basic and supplementary.',
            'Medical costs left for you to pay (décompte LAMal).',
            'Childcare costs (frais de garde): crèche, nanny, after-school care.',
            'Donations to charities or political parties in Switzerland.',
            'Loan interest: the statement from your bank or lender.',
            'Alimony you paid, and the judgment or agreement that sets it.',
          ],
        },
        {
          h: 'Attach, or keep',
          p: ['The Geneva tax guide sorts them into three groups:'],
          list: [
            'Always attach: salary and benefit certificates, pillar 3a and pension fund buy-in attestations, the tax statements for your securities.',
            'Attach only if it’s new or the amount changed a lot: pension certificates, debt statements, a divorce or separation judgment.',
            'Keep, in case the tax office (AFC) asks: attestations for your salary and savings accounts, receipts for medical costs and donations.',
          ],
        },
        {
          h: 'When',
          p: [
            'Unless there is an exception, your return is due on 31 March of the following year. Need more time? Ask for an extension (délai): from 1 January to 31 October in your tax space (espace fiscal, e-démarches), with the online form, by phone or by post, then from 1 November to 31 December by post only. An extension costs a fee that depends on how long it is.',
            'Online, you can file without paper (zéro papier) if every supporting document is attached as a PDF.',
          ],
        },
        {
          h: 'With Taxpresso',
          p: [
            'Add your documents to your Taxpresso folder as they arrive. The “Still missing” list follows your answers: it only asks for what applies to you.',
          ],
        },
      ],
      sources: [
        'Geneva tax guide 2025: documents to gather (Documents nécessaires), PDF p. 8',
        'Geneva tax guide 2025: supporting documents (Les justificatifs), PDF p. 10',
        'Declaring securities with the e-tax statement (Déclarez vos titres avec le e-relevé fiscal)',
        'Asking for more time (Demander un délai pour ma déclaration d’impôt)',
        'How to fill in your return (Comment remplir ma déclaration d’impôt)',
      ],
    },

    'pillar-3a': {
      title: 'Pillar 3a: pay in before 31 December',
      summary:
        'What you pay into pillar 3a lowers your taxable income, but only if the money is paid in during the year.',
      sections: [
        {
          h: 'What it is',
          p: [
            'Pillar 3a (3e pilier A) is a retirement savings account at a bank or an insurer. What you pay in during the year is deducted from your taxable income, up to a yearly limit.',
          ],
        },
        {
          h: 'Why before 31 December',
          p: [
            'Only payments actually made during the tax year count. A payment made in January counts for the new year, not the one you’re declaring. Give your transfer time to arrive.',
          ],
        },
        {
          h: 'Who can pay in',
          p: [
            'You need income from work, employed or self-employed, and to be insured with AVS/AI. A short break (military service, unemployment, illness) doesn’t take that right away.',
          ],
        },
        {
          h: 'How much',
          p: [
            'The limit depends on your pension fund (2nd pillar, caisse de pension). If you’re in one, it’s a fixed maximum. If not, it’s a share of your earned income, up to a higher maximum. The amounts change over the years: you’ll find them in the federal instructions and the Geneva guide, linked below.',
            'From 2026, you can also make up for years since 2025 when you didn’t pay in the maximum, under conditions.',
          ],
        },
        {
          h: 'As a couple',
          p: [
            'Each of you pays into your own account and has your own line on the return (c.A and c.B).',
          ],
        },
        {
          h: 'What to keep',
          p: [
            'Your bank or insurer sends you an attestation. Attach it to your return: without it, the deduction isn’t allowed.',
          ],
        },
        {
          h: 'Good to know',
          p: [
            'This money is for retirement. When it’s paid out to you, it’s taxed: separately, if it’s paid as a lump sum.',
            'In Taxpresso, ask Claude what a payment would save you this year: it shows the room you have left, from the official limits.',
          ],
        },
      ],
      sources: [
        'Federal instructions 2026, pillar 3a (Form. 2a, chiffre 13), PDF p. 7',
        'Geneva tax guide 2025: contributions and buy-ins (Déductions des cotisations et des rachats), PDF p. 18',
      ],
    },

    tou: {
      title: 'Taxed at source: ordinary taxation afterwards (TOU)',
      summary:
        'How TOU works, when it’s mandatory, the 31 March deadline, and why you can’t go back.',
      sections: [
        {
          h: 'Tax at source',
          p: [
            'If you’re taxed at source (impôt à la source), your employer takes the tax straight off your salary, using a scale (barème). The scale doesn’t know your whole situation: children, your spouse’s income, deductions or actual costs.',
          ],
        },
        {
          h: 'What TOU is',
          p: [
            'With ordinary taxation afterwards (taxation ordinaire ultérieure, TOU), you file a normal tax return. The tax office (AFC) can then count deductions and actual costs that the scales leave out. The tax already withheld is subtracted from your final tax: depending on your situation, you get money back or pay more.',
          ],
        },
        {
          h: 'Mandatory, or on request',
          p: [
            'If you live in Switzerland, TOU is mandatory in some cases: a gross yearly salary above a threshold, other income not taxed at source above an amount, property in Geneva, taxable wealth, or TOU the year before. The Geneva guide gives the year’s thresholds. Otherwise, you can ask for it.',
          ],
        },
        {
          h: 'The deadline: 31 March',
          p: [
            'Send the DRIS/TOU form by 31 March of the year after the tax was withheld. You fill it in online in your tax space (espace fiscal, e-démarches), or on paper if you received it by post. Without the form, the tax your employer withheld becomes final, unless the AFC corrects it.',
          ],
        },
        {
          h: 'You can’t go back',
          p: [
            'Once you’ve asked for TOU, you can’t return to tax at source, whatever the result. You stay in TOU every year after that, until you’re no longer taxed at source. If you’re married and live together, the request covers your spouse too.',
          ],
        },
        {
          h: 'Just a correction?',
          p: [
            'If you only want the tax withheld corrected, because it doesn’t reflect your real situation, the same form lets you ask for a correction (demande de rectification de l’impôt à la source, DRIS), by the same deadline.',
          ],
        },
        {
          h: 'With Taxpresso',
          p: [
            'Take time to compare before you decide: Taxpresso will show you both cases, with their amounts. You send the form yourself.',
          ],
        },
      ],
      sources: [
        'Tax at source: correction or TOU (Demande de rectification ou taxation ordinaire ultérieure)',
        'Geneva tax guide 2025: TOU for people taxed at source, PDF p. 52',
        'Federal Direct Tax Act (LIFD), art. 89a, PDF p. 51',
      ],
    },

    couples: {
      title: 'Filing as a couple',
      summary:
        'Married or in a registered partnership: one return, who fills in what, and how Geneva sets the rate.',
      sections: [
        {
          h: 'One return for two',
          p: [
            'If you’re married or in a registered partnership and live together, you file one return. Your incomes and your wealth are added up, whatever your marital property regime. If you live together without being married or registered, you each file your own.',
          ],
        },
        {
          h: '31 December decides',
          p: [
            'Your civil status (état civil) on 31 December counts for the whole year. Married during the year: one return, with everything about the couple from 1 January. Separated or divorced during the year: each of you files your own return for the whole year.',
          ],
        },
        {
          h: 'Who fills in what',
          p: [
            'The person named on the left of the return fills in the c.A columns (contribuable A), and their spouse, on the right, fills in c.B. Fill in your own carefully: the tax office uses them to work out each person’s share of the tax, shown on a breakdown (scission informative) sent with the bill.',
          ],
        },
        {
          h: 'How Geneva sets the rate',
          p: [
            'To soften the effect of adding two incomes, Geneva divides the couple’s total income by two to find the tax rate (splitting intégral). If you both work, there is also a deduction for two-income couples (déduction sur le gain de l’un des époux), for cantonal and federal tax.',
          ],
        },
        {
          h: 'Responsible together',
          p: ['Spouses who live together are jointly liable for the couple’s total tax.'],
        },
        {
          h: 'With Taxpresso',
          p: [
            'Tell Claude you’re married: Taxpresso then asks its questions for each of you, and files documents by person.',
          ],
        },
      ],
      sources: [
        'Geneva tax guide 2025: how to fill in your return (Comment remplir ma déclaration), PDF p. 5',
        'Geneva tax guide 2025: scale and splitting (Barème et splitting), PDF p. 45',
        'Geneva tax guide 2025: changes of situation (Changements de situation), PDF p. 53',
        'Geneva act on the taxation of individuals (LIPP), art. 8, 41 and 66',
      ],
    },

    assessment: {
      title: 'Your assessment (avis de taxation), and how to object',
      summary:
        'What you receive after filing, how to check it, and how to object (réclamation) within 30 days.',
      sections: [
        {
          h: 'What you receive',
          p: [
            'Once your return is processed, the tax office (AFC) sends your tax bills (bordereaux) for cantonal and communal tax (ICC) and for federal direct tax (IFD), and an assessment (avis de taxation) that sums up the amounts used to calculate your tax.',
          ],
        },
        {
          h: 'Check it',
          p: [
            'Compare the assessment with your return, line by line. If your instalments were more than the tax, the AFC refunds you within 30 days. If not, you have 30 days to pay or contest the amount.',
            'In Taxpresso, drop the assessment into your folder: Taxpresso compares it with your return, item by item, and shows you the deadline to object.',
          ],
        },
        {
          h: 'Objecting: 30 days',
          p: [
            'If you disagree, send a written objection (réclamation) to the tax office that assessed you, within 30 days of being notified. The same deadline applies to cantonal and communal tax and to federal direct tax.',
          ],
        },
        {
          h: 'How to count',
          p: [
            'The 30 days start the day after notification. You’re on time if you hand your objection to the tax office, or to a Swiss post office, by the last day. If that day is a Saturday, a Sunday or a public holiday, the deadline moves to the next working day. If in doubt, ask the AFC.',
          ],
        },
        {
          h: 'What to write',
          p: [
            'Say what you contest and why, and attach copies of the documents that show it. If you were assessed by default (taxation d’office), for example because no return was filed, your objection must explain why the assessment is clearly wrong and give the evidence.',
          ],
        },
        {
          h: 'What happens next',
          p: [
            'The objection is free, in principle. The tax office can review every part of your assessment and, after hearing you, change it to your disadvantage too. You still pay the amount you don’t contest on time. Taxpresso never sends the objection for you.',
          ],
        },
      ],
      sources: [
        'Geneva tax procedure act (LPFisc), art. 39 to 43',
        'Federal Direct Tax Act (LIFD), art. 132 to 135, PDF p. 71',
        'Geneva tax guide 2025: the year’s calendar (Agenda), PDF p. 4',
      ],
    },

    privacy: {
      title: 'Your data stays on your computer',
      summary:
        'What Taxpresso keeps on your computer, what Claude sees, and how to set Claude’s privacy settings.',
      sections: [
        {
          h: 'On your computer',
          p: [
            'Taxpresso is an extension that runs inside Claude Desktop, on your computer. Your answers and documents stay in a folder you own, Documents/Taxpresso, unless you chose another one. The extension makes no requests over the internet: no server, no account, no tracking. The dashboard runs on your computer only.',
          ],
        },
        {
          h: 'What Claude sees',
          p: [
            'Claude, the AI you talk to, runs under your own Claude account. It sees what you write in the chat and the documents it reads with you, to suggest values that you confirm. Taxpresso only reads the documents in your folder, never your chat history.',
          ],
        },
        {
          h: 'Your settings in Claude',
          p: [
            'In Claude’s settings, under Privacy, you decide whether your chats may be used to improve Claude. Set this before you start, and delete your tax conversations once your return is done.',
          ],
        },
        {
          h: 'You sign in, you transmit',
          p: [
            'To fill in the official online declaration, you sign in to your e-démarches account yourself. Claude never types your passwords and never presses Transmettre: you do. The online declaration keeps what you enter and stays editable until you transmit it, and you remain responsible for the figures you declare.',
          ],
        },
        {
          h: 'Look after your folder',
          p: [
            'It’s a normal folder: back it up or delete it like any other. It’s as safe as your computer, so protect your computer with a password and turn on disk encryption.',
          ],
        },
        {
          h: 'Check for yourself',
          p: [
            `Taxpresso is open source: anyone can read its [source code](${SOURCE_URL}) and check what it does.`,
          ],
        },
      ],
      sources: [
        'The online declaration (La déclaration en ligne des particuliers)',
        'Your returns in e-démarches (Gérer mes déclarations d’impôt)',
      ],
    },
  },
};

const de: GuidesCopy = {
  htmlTitle: 'Taxpresso-Ratgeber: deine Genfer Steuererklärung, einfach erklärt',
  metaDescription:
    'Kurze Ratgeber zur Genfer Steuererklärung: Dokumente, Säule 3a, TOU, als Paar, Veranlagung, Datenschutz. Mit Links zu den offiziellen Seiten.',
  title: 'Ratgeber',
  lead: 'Kurze Ratgeber, damit du deine Genfer Steuererklärung verstehst. Jeder endet mit den offiziellen Seiten: Sie sind massgebend.',
  basis:
    'Gestützt auf den Genfer Steuerleitfaden 2025, den neusten veröffentlichten, die Anleitung des Bundes 2026 und die geltenden Gesetze. Offizielle Seiten geprüft am 13. Oktober 2026.',
  disclaimer:
    'Diese Ratgeber erklären, wie es funktioniert. Sie ersetzen weder die offiziellen Dokumente noch eine Steuerberatung. Im Zweifel frag die kantonale Steuerverwaltung (AFC).',
  sourcesTitle: 'Offizielle Quellen',
  sourcesNote: 'Seiten der Verwaltung, auf Französisch. Sie öffnen sich in einem neuen Tab.',
  moreTitle: 'Weitere Ratgeber',
  all: 'Alle Ratgeber',
  read: 'Ratgeber lesen',
  guides: {
    documents: {
      title: 'Deine Dokumente: was du sammelst und wo du es findest',
      summary:
        'Welche Belege deine Erklärung braucht, welche du beilegst und welche du aufbewahrst, und die Frist vom 31. März.',
      sections: [
        {
          h: 'Für deinen ganzen Haushalt',
          p: [
            'Sammle die Belege des Jahres für alle in deinem Steuerhaushalt: dich, die Person, mit der du verheiratet oder eingetragen bist, und deine minderjährigen Kinder.',
          ],
        },
        {
          h: 'Dein Einkommen',
          p: ['Was du im Jahr erhalten hast:'],
          list: [
            'Den Lohnausweis (certificat de salaire), einen pro Arbeitgeber.',
            'Bescheinigungen über Taggelder (attestations d’indemnités): Arbeitslosigkeit, Krankheit, Unfall.',
            'Rentenbescheinigungen (attestations de rentes): AHV oder IV, Pensionskasse.',
            'Die Unterhaltsbeiträge, die du erhalten hast (pension alimentaire).',
          ],
        },
        {
          h: 'Deine Konten und Wertschriften',
          p: [
            'Für jede Bank den Auszug deiner Konten per 31. Dezember, auch gemeinsame Konten und die deiner minderjährigen Kinder, mit den Bankspesen. Für ein Wertschriftendepot den Steuerauszug (relevé fiscal) mit allen Positionen.',
            'Manche Banken bieten einen elektronischen Steuerauszug an (e-relevé fiscal): GeTax, die Software des Kantons, kann ihn importieren und diese Seiten für dich ausfüllen. Deine Bank schickt selbst nichts an die Steuerverwaltung.',
          ],
        },
        {
          h: 'Deine Abzüge',
          p: ['Bescheinigungen und Belege für das, was du bezahlt hast:'],
          list: [
            'Die Bescheinigung für die Säule 3a (attestation 3e pilier A), von deiner Bank oder Versicherung.',
            'Die Bescheinigung über einen Einkauf in die Pensionskasse (rachat 2e pilier, Formular 21EDP), falls du einen gemacht hast.',
            'Die Krankenkassenprämien, Grund- und Zusatzversicherung.',
            'Krankheitskosten, die du selbst getragen hast (décompte LAMal).',
            'Kinderbetreuungskosten (frais de garde): Krippe, Tagesmutter, schulergänzende Betreuung.',
            'Spenden an gemeinnützige Organisationen oder politische Parteien in der Schweiz.',
            'Schuldzinsen: der Auszug der Bank oder des Kreditgebers.',
            'Unterhaltsbeiträge, die du bezahlt hast, und das Urteil oder die Vereinbarung, die sie festlegt.',
          ],
        },
        {
          h: 'Beilegen oder aufbewahren',
          p: ['Der Genfer Steuerleitfaden unterscheidet drei Fälle:'],
          list: [
            'Immer beilegen: Lohnausweise und Taggeldbescheinigungen, Bescheinigungen für Säule 3a und Pensionskasseneinkauf, die Steuerauszüge deiner Wertschriften.',
            'Nur beilegen, wenn es neu ist oder sich der Betrag deutlich geändert hat: Rentenbescheinigungen, Schuldenbelege, ein Scheidungs- oder Trennungsurteil.',
            'Aufbewahren, falls die Steuerverwaltung (AFC) danach fragt: Bescheinigungen für Lohn- und Sparkonten, Belege für Krankheitskosten und Spenden.',
          ],
        },
        {
          h: 'Bis wann',
          p: [
            'Ausser in Sonderfällen ist die Frist für deine Erklärung der 31. März des Folgejahres. Brauchst du mehr Zeit? Beantrage eine Fristerstreckung (délai): vom 1. Januar bis 31. Oktober in deinem Steuerkonto (espace fiscal, e-démarches), mit dem Online-Formular, per Telefon oder per Post, danach vom 1. November bis 31. Dezember nur per Post. Eine Fristerstreckung kostet eine Gebühr, je nach Dauer.',
            'Online kannst du papierlos einreichen (zéro papier), wenn alle Belege als PDF beigelegt sind.',
          ],
        },
        {
          h: 'Mit Taxpresso',
          p: [
            'Leg deine Dokumente in deinen Taxpresso-Ordner, sobald sie ankommen. Die Liste der fehlenden Dokumente folgt deinen Antworten: Sie verlangt nur, was dich betrifft.',
          ],
        },
      ],
      sources: [
        'Genfer Steuerleitfaden 2025: nötige Dokumente (Documents nécessaires), PDF S. 8',
        'Genfer Steuerleitfaden 2025: Belege (Les justificatifs), PDF S. 10',
        'Wertschriften mit dem elektronischen Steuerauszug deklarieren (Déclarez vos titres avec le e-relevé fiscal)',
        'Fristerstreckung beantragen (Demander un délai pour ma déclaration d’impôt)',
        'So füllst du die Erklärung aus (Comment remplir ma déclaration d’impôt)',
      ],
    },

    'pillar-3a': {
      title: 'Säule 3a: vor dem 31. Dezember einzahlen',
      summary:
        'Was du in die Säule 3a einzahlst, senkt dein steuerbares Einkommen, aber nur, wenn das Geld im selben Jahr einbezahlt wird.',
      sections: [
        {
          h: 'Was ist das?',
          p: [
            'Die Säule 3a (3e pilier A, gebundene Vorsorge) ist ein Vorsorgekonto bei einer Bank oder Versicherung. Was du im Jahr einzahlst, wird von deinem steuerbaren Einkommen abgezogen, bis zu einer jährlichen Obergrenze.',
          ],
        },
        {
          h: 'Warum vor dem 31. Dezember',
          p: [
            'Es zählen nur Einzahlungen, die im Steuerjahr tatsächlich geleistet wurden. Eine Einzahlung im Januar zählt für das neue Jahr, nicht für das, das du deklarierst. Gib deiner Überweisung Zeit anzukommen.',
          ],
        },
        {
          h: 'Wer einzahlen kann',
          p: [
            'Du brauchst ein Erwerbseinkommen, angestellt oder selbständig, und musst bei der AHV/IV versichert sein. Eine vorübergehende Unterbrechung (Militärdienst, Arbeitslosigkeit, Krankheit) ändert daran nichts.',
          ],
        },
        {
          h: 'Wie viel',
          p: [
            'Die Obergrenze hängt von deiner Pensionskasse (2. Säule) ab. Bist du in einer, gilt ein fester Höchstbetrag. Sonst ist es ein Anteil deines Erwerbseinkommens, bis zu einem höheren Höchstbetrag. Die Beträge ändern sich mit den Jahren: Du findest sie in der Anleitung des Bundes und im Genfer Leitfaden, unten verlinkt.',
            'Ab 2026 kannst du ausserdem Jahre ab 2025 nachholen, in denen du nicht den Höchstbetrag einbezahlt hast, unter Bedingungen.',
          ],
        },
        {
          h: 'Als Paar',
          p: [
            'Jede und jeder zahlt auf das eigene Konto ein und hat eine eigene Zeile in der Erklärung (c.A und c.B).',
          ],
        },
        {
          h: 'Was du aufbewahrst',
          p: [
            'Deine Bank oder Versicherung schickt dir eine Bescheinigung. Leg sie deiner Erklärung bei: Ohne sie wird der Abzug nicht gewährt.',
          ],
        },
        {
          h: 'Gut zu wissen',
          p: [
            'Das Geld ist für das Alter bestimmt. Wird es dir ausbezahlt, wird es besteuert: separat, wenn du es als Kapital beziehst.',
            'Frag Claude in Taxpresso, wie viel dir eine Einzahlung dieses Jahr sparen würde: Es zeigt dir, wie viel Spielraum du noch hast, nach den offiziellen Obergrenzen.',
          ],
        },
      ],
      sources: [
        'Anleitung des Bundes 2026, Säule 3a (Form. 2a, chiffre 13), PDF S. 7',
        'Genfer Steuerleitfaden 2025: Beiträge und Einkäufe (Déductions des cotisations et des rachats), PDF S. 18',
      ],
    },

    tou: {
      title: 'Quellensteuer: die nachträgliche ordentliche Veranlagung (TOU)',
      summary:
        'Wie die TOU funktioniert, wann sie Pflicht ist, die Frist vom 31. März und warum es kein Zurück gibt.',
      sections: [
        {
          h: 'Die Quellensteuer',
          p: [
            'Wirst du an der Quelle besteuert (impôt à la source), zieht dein Arbeitgeber die Steuer direkt vom Lohn ab, nach einem Tarif (barème). Der Tarif kennt nicht deine ganze Situation: Kinder, das Einkommen deines Ehepartners oder deiner Ehepartnerin, Abzüge oder tatsächliche Kosten.',
          ],
        },
        {
          h: 'Was die TOU ist',
          p: [
            'Mit der nachträglichen ordentlichen Veranlagung (taxation ordinaire ultérieure, TOU) füllst du eine normale Steuererklärung aus. Die Steuerverwaltung (AFC) kann dann Abzüge und tatsächliche Kosten berücksichtigen, die in den Tarifen fehlen. Die bereits einbehaltene Steuer wird an die endgültige Steuer angerechnet: Je nach Situation bekommst du Geld zurück oder zahlst nach.',
          ],
        },
        {
          h: 'Pflicht oder auf Antrag',
          p: [
            'Wohnst du in der Schweiz, ist die TOU in bestimmten Fällen Pflicht: ein Bruttojahreslohn über einer Schwelle, andere Einkünfte ohne Quellensteuer über einem Betrag, eine Liegenschaft in Genf, steuerbares Vermögen oder eine TOU im Vorjahr. Der Genfer Leitfaden nennt die Schwellen des Jahres. Sonst kannst du sie beantragen.',
          ],
        },
        {
          h: 'Die Frist: 31. März',
          p: [
            'Schick das Formular DRIS/TOU spätestens am 31. März des Jahres nach dem Steuerabzug. Du füllst es online in deinem Steuerkonto aus (espace fiscal, e-démarches), oder auf Papier, wenn du es per Post erhalten hast. Ohne Formular wird die vom Arbeitgeber abgezogene Steuer endgültig, ausser die AFC korrigiert sie.',
          ],
        },
        {
          h: 'Kein Zurück',
          p: [
            'Hast du die TOU einmal beantragt, kannst du nicht zur Quellensteuer zurück, egal wie das Ergebnis ausfällt. Du bleibst in allen folgenden Jahren in der TOU, bis du nicht mehr an der Quelle besteuert wirst. Bist du verheiratet und lebt ihr zusammen, gilt der Antrag auch für deinen Ehepartner oder deine Ehepartnerin.',
          ],
        },
        {
          h: 'Nur eine Korrektur?',
          p: [
            'Willst du nur die abgezogene Steuer korrigieren lassen, weil sie deiner tatsächlichen Situation nicht entspricht, kannst du mit demselben Formular eine Berichtigung beantragen (demande de rectification de l’impôt à la source, DRIS), mit derselben Frist.',
          ],
        },
        {
          h: 'Mit Taxpresso',
          p: [
            'Nimm dir Zeit zum Vergleichen, bevor du entscheidest: Taxpresso wird dir beide Fälle mit ihren Beträgen zeigen. Das Formular schickst du selbst.',
          ],
        },
      ],
      sources: [
        'Berichtigung oder nachträgliche ordentliche Veranlagung (Demande de rectification ou taxation ordinaire ultérieure)',
        'Genfer Steuerleitfaden 2025: die TOU bei Quellensteuer, PDF S. 52',
        'Bundesgesetz über die direkte Bundessteuer (LIFD), Art. 89a, PDF S. 51',
      ],
    },

    couples: {
      title: 'Steuererklärung als Paar',
      summary:
        'Verheiratet oder eingetragen: eine Erklärung, wer was ausfüllt und wie Genf den Steuersatz bestimmt.',
      sections: [
        {
          h: 'Eine Erklärung für zwei',
          p: [
            'Seid ihr verheiratet oder in eingetragener Partnerschaft und lebt zusammen, füllt ihr eine gemeinsame Erklärung aus. Eure Einkommen und Vermögen werden zusammengezählt, egal welcher Güterstand gilt. Lebt ihr ohne Trauschein und ohne Eintragung zusammen, füllt jede und jeder eine eigene aus.',
          ],
        },
        {
          h: 'Der 31. Dezember entscheidet',
          p: [
            'Dein Zivilstand (état civil) am 31. Dezember gilt für das ganze Jahr. Im Jahr geheiratet: eine Erklärung, mit allem, was das Paar betrifft, ab dem 1. Januar. Im Jahr getrennt oder geschieden: Jede und jeder füllt für das ganze Jahr eine eigene Erklärung aus.',
          ],
        },
        {
          h: 'Wer was ausfüllt',
          p: [
            'Die Person, die links auf der Erklärung steht, füllt die Rubriken c.A (contribuable A) aus, die Person rechts die Rubriken c.B. Füllt eure eigenen sorgfältig aus: Die Steuerverwaltung berechnet damit den Steueranteil jeder Person, den eine Aufteilung (scission informative) mit der Rechnung zeigt.',
          ],
        },
        {
          h: 'Wie Genf den Satz bestimmt',
          p: [
            'Damit zwei zusammengezählte Einkommen nicht zu stark ins Gewicht fallen, teilt Genf das Gesamteinkommen des Paares durch zwei, um den Steuersatz zu finden (splitting intégral). Arbeitet ihr beide, gibt es zusätzlich einen Abzug für Zweiverdienerpaare (déduction sur le gain de l’un des époux), bei der Kantons- und bei der Bundessteuer.',
          ],
        },
        {
          h: 'Gemeinsam verantwortlich',
          p: ['Ehepaare, die zusammenleben, haften solidarisch für die gesamte Steuer des Paares.'],
        },
        {
          h: 'Mit Taxpresso',
          p: [
            'Sag Claude, dass ihr verheiratet seid: Taxpresso stellt seine Fragen dann für euch beide und ordnet die Dokumente nach Person.',
          ],
        },
      ],
      sources: [
        'Genfer Steuerleitfaden 2025: so füllst du die Erklärung aus (Comment remplir ma déclaration), PDF S. 5',
        'Genfer Steuerleitfaden 2025: Tarif und Splitting (Barème et splitting), PDF S. 45',
        'Genfer Steuerleitfaden 2025: Änderungen der Situation (Changements de situation), PDF S. 53',
        'Genfer Gesetz über die Besteuerung natürlicher Personen (LIPP), Art. 8, 41 und 66',
      ],
    },

    assessment: {
      title: 'Deine Veranlagung (avis de taxation) und wie du Einsprache erhebst',
      summary:
        'Was du nach der Erklärung bekommst, wie du es prüfst und wie du innert 30 Tagen Einsprache (réclamation) erhebst.',
      sections: [
        {
          h: 'Was du bekommst',
          p: [
            'Hat die Steuerverwaltung (AFC) deine Erklärung bearbeitet, schickt sie dir die Steuerrechnungen (bordereaux) für die Kantons- und Gemeindesteuer (ICC) und die direkte Bundessteuer (IFD), und eine Veranlagungsverfügung (avis de taxation), die die Beträge zusammenfasst, mit denen deine Steuer berechnet wurde.',
          ],
        },
        {
          h: 'Prüf sie',
          p: [
            'Vergleiche die Veranlagung Zeile für Zeile mit deiner Erklärung. Waren deine Akontozahlungen höher als die Steuer, zahlt dir die AFC die Differenz innert 30 Tagen zurück. Sonst hast du 30 Tage, um den Betrag zu zahlen oder anzufechten.',
            'Leg die Veranlagung in deinen Taxpresso-Ordner: Taxpresso vergleicht sie Posten für Posten mit deiner Erklärung und zeigt dir die Einsprachefrist.',
          ],
        },
        {
          h: 'Einsprache: 30 Tage',
          p: [
            'Bist du nicht einverstanden, schick der Steuerverwaltung, die dich veranlagt hat, eine schriftliche Einsprache (réclamation), innert 30 Tagen nach der Zustellung. Dieselbe Frist gilt für die Kantons- und Gemeindesteuer und für die direkte Bundessteuer.',
          ],
        },
        {
          h: 'Wie man zählt',
          p: [
            'Die 30 Tage beginnen am Tag nach der Zustellung. Die Frist ist eingehalten, wenn du deine Einsprache spätestens am letzten Tag der Steuerverwaltung oder einer Schweizer Poststelle übergibst. Fällt dieser Tag auf einen Samstag, einen Sonntag oder einen Feiertag, verschiebt sich die Frist auf den nächsten Werktag. Im Zweifel frag die AFC.',
          ],
        },
        {
          h: 'Was du schreibst',
          p: [
            'Schreib, was du anfichtst und warum, und leg Kopien der Belege bei. Wurdest du nach Ermessen veranlagt (taxation d’office), etwa weil keine Erklärung eingereicht wurde, muss die Einsprache begründen, warum die Veranlagung offensichtlich falsch ist, und die Beweise nennen.',
          ],
        },
        {
          h: 'Wie es weitergeht',
          p: [
            'Die Einsprache ist grundsätzlich kostenlos. Die Steuerverwaltung kann die ganze Veranlagung neu prüfen und sie, nachdem sie dich angehört hat, auch zu deinen Ungunsten ändern. Den Betrag, den du nicht anfichtst, zahlst du trotzdem fristgerecht. Taxpresso reicht die Einsprache nie für dich ein.',
          ],
        },
      ],
      sources: [
        'Genfer Steuerverfahrensgesetz (LPFisc), Art. 39 bis 43',
        'Bundesgesetz über die direkte Bundessteuer (LIFD), Art. 132 bis 135, PDF S. 71',
        'Genfer Steuerleitfaden 2025: Jahreskalender (Agenda), PDF S. 4',
      ],
    },

    privacy: {
      title: 'Deine Daten bleiben auf deinem Computer',
      summary:
        'Was Taxpresso bei dir speichert, was Claude sieht und wie du die Datenschutzeinstellungen von Claude setzt.',
      sections: [
        {
          h: 'Auf deinem Computer',
          p: [
            'Taxpresso ist eine Erweiterung, die in Claude Desktop auf deinem Computer läuft. Deine Antworten und Dokumente bleiben in einem Ordner, der dir gehört: Dokumente/Taxpresso, ausser du hast einen anderen gewählt. Die Erweiterung stellt keine Anfragen ins Internet: kein Server, kein Konto, kein Tracking. Das Dashboard läuft nur auf deinem Computer.',
          ],
        },
        {
          h: 'Was Claude sieht',
          p: [
            'Claude, die KI, mit der du sprichst, läuft mit deinem eigenen Claude-Konto. Claude sieht, was du im Chat schreibst, und die Dokumente, die es mit dir liest, um dir Werte vorzuschlagen, die du bestätigst. Taxpresso liest nur die Dokumente in deinem Ordner, nie deinen Chatverlauf.',
          ],
        },
        {
          h: 'Deine Einstellungen in Claude',
          p: [
            'In den Einstellungen von Claude, unter Datenschutz, entscheidest du, ob deine Chats helfen dürfen, Claude zu verbessern. Stell das ein, bevor du anfängst, und lösch deine Steuer-Chats, wenn deine Erklärung fertig ist.',
          ],
        },
        {
          h: 'Du meldest dich an, du übermittelst',
          p: [
            'Um die offizielle Online-Erklärung auszufüllen, meldest du dich selbst in deinem e-démarches-Konto an. Claude tippt nie deine Passwörter ein und drückt nie auf «Transmettre»: Das machst du. Die Online-Erklärung speichert deine Eingaben und bleibt bis zur Übermittlung änderbar, und du bleibst für die deklarierten Zahlen verantwortlich.',
          ],
        },
        {
          h: 'Pass auf deinen Ordner auf',
          p: [
            'Es ist ein normaler Ordner: Sichere oder lösche ihn wie jeden anderen. Er ist so sicher wie dein Computer: Schütz ihn mit einem Passwort und schalte die Festplattenverschlüsselung ein.',
          ],
        },
        {
          h: 'Prüf es selbst',
          p: [
            `Taxpresso ist Open Source: Alle können den [Quellcode](${SOURCE_URL}) lesen und prüfen, was es tut.`,
          ],
        },
      ],
      sources: [
        'Die Online-Erklärung (La déclaration en ligne des particuliers)',
        'Deine Erklärungen in e-démarches (Gérer mes déclarations d’impôt)',
      ],
    },
  },
};

const it: GuidesCopy = {
  htmlTitle: 'Guide Taxpresso: la tua dichiarazione ginevrina, in parole semplici',
  metaDescription:
    'Brevi guide alla dichiarazione d’imposta di Ginevra: documenti, pilastro 3a, TOU, in coppia, tassazione, privacy. Con i link alle pagine ufficiali.',
  title: 'Guide',
  lead: 'Brevi guide per capire la tua dichiarazione d’imposta ginevrina. Ognuna finisce con le pagine ufficiali, che fanno fede.',
  basis:
    'In base alla guida fiscale ginevrina 2025, l’ultima pubblicata, alle istruzioni federali 2026 e alle leggi in vigore. Pagine ufficiali verificate il 13 ottobre 2026.',
  disclaimer:
    'Queste guide spiegano come funzionano le cose. Non sostituiscono i documenti ufficiali né una consulenza fiscale. Se hai dubbi, chiedi all’Amministrazione fiscale cantonale (AFC).',
  sourcesTitle: 'Fonti ufficiali',
  sourcesNote: 'Pagine dell’amministrazione, in francese. Si aprono in una nuova scheda.',
  moreTitle: 'Le altre guide',
  all: 'Tutte le guide',
  read: 'Leggi la guida',
  guides: {
    documents: {
      title: 'I tuoi documenti: cosa raccogliere e dove trovarli',
      summary:
        'I giustificativi per la tua dichiarazione, quali allegare e quali conservare, e il termine del 31 marzo.',
      sections: [
        {
          h: 'Per tutto il tuo nucleo familiare',
          p: [
            'Raccogli i giustificativi dell’anno per tutto il tuo nucleo familiare: te, il tuo coniuge o partner e i tuoi figli minorenni a carico.',
          ],
        },
        {
          h: 'I tuoi redditi',
          p: ['Quello che hai ricevuto durante l’anno:'],
          list: [
            'Il certificato di salario (certificat de salaire), uno per datore di lavoro.',
            'Gli attestati delle indennità (attestations d’indemnités): disoccupazione, malattia, infortunio.',
            'Gli attestati delle rendite (attestations de rentes): AVS o AI, cassa pensione.',
            'Gli alimenti che hai ricevuto (pension alimentaire).',
          ],
        },
        {
          h: 'I tuoi conti e titoli',
          p: [
            'Per ogni banca, l’estratto dei tuoi conti al 31 dicembre, compresi i conti cointestati e quelli dei tuoi figli minorenni, con le spese bancarie. Per un portafoglio di titoli, l’estratto fiscale (relevé fiscal) con tutte le posizioni.',
            'Alcune banche offrono un estratto fiscale elettronico (e-relevé fiscal): GeTax, il software del cantone, può importarlo e compilare queste pagine per te. La tua banca non invia nulla da sola all’amministrazione fiscale.',
          ],
        },
        {
          h: 'Le tue deduzioni',
          p: ['Gli attestati e i giustificativi di quello che hai pagato:'],
          list: [
            'L’attestato del pilastro 3a (attestation 3e pilier A), della tua banca o assicurazione.',
            'L’attestato di riscatto nella cassa pensione (rachat 2e pilier, modulo 21EDP), se ne hai fatto uno.',
            'I premi dell’assicurazione malattia, di base e complementare.',
            'Le spese mediche rimaste a tuo carico (décompte LAMal).',
            'Le spese di custodia dei figli (frais de garde): asilo nido, tata, doposcuola.',
            'Le donazioni a enti di pubblica utilità o a partiti politici in Svizzera.',
            'Gli interessi su prestiti: l’estratto della banca o del creditore.',
            'Gli alimenti che hai versato, e la sentenza o la convenzione che li fissa.',
          ],
        },
        {
          h: 'Allegare o conservare',
          p: ['La guida fiscale ginevrina distingue tre casi:'],
          list: [
            'Da allegare sempre: certificati di salario e di indennità, attestati del pilastro 3a e di riscatto nella cassa pensione, estratti fiscali dei tuoi titoli.',
            'Da allegare solo se è nuovo o se l’importo è cambiato molto: certificati di rendita, giustificativi dei debiti, sentenza di divorzio o di separazione.',
            'Da conservare, nel caso l’amministrazione fiscale (AFC) li chieda: attestati dei conti salario e di risparmio, giustificativi delle spese mediche e delle donazioni.',
          ],
        },
        {
          h: 'Entro quando',
          p: [
            'Salvo eccezioni, il termine per inviare la dichiarazione è il 31 marzo dell’anno successivo. Ti serve più tempo? Chiedi una proroga (délai): dal 1° gennaio al 31 ottobre dal tuo spazio fiscale (espace fiscal, e-démarches), con il modulo online, per telefono o per posta, poi dal 1° novembre al 31 dicembre solo per posta. La proroga costa una tassa, secondo la durata.',
            'Online puoi presentarla senza carta (zéro papier) se alleghi tutti i giustificativi in PDF.',
          ],
        },
        {
          h: 'Con Taxpresso',
          p: [
            'Metti i tuoi documenti nella cartella Taxpresso man mano che arrivano. La lista di ciò che manca segue le tue risposte: chiede solo quello che ti riguarda.',
          ],
        },
      ],
      sources: [
        'Guida fiscale ginevrina 2025: documenti necessari (Documents nécessaires), PDF p. 8',
        'Guida fiscale ginevrina 2025: giustificativi (Les justificatifs), PDF p. 10',
        'Dichiarare i titoli con l’estratto fiscale elettronico (Déclarez vos titres avec le e-relevé fiscal)',
        'Chiedere una proroga (Demander un délai pour ma déclaration d’impôt)',
        'Come compilare la dichiarazione (Comment remplir ma déclaration d’impôt)',
      ],
    },

    'pillar-3a': {
      title: 'Pilastro 3a: versa prima del 31 dicembre',
      summary:
        'Quello che versi nel pilastro 3a riduce il tuo reddito imponibile, ma solo se il versamento avviene entro l’anno.',
      sections: [
        {
          h: 'Cos’è',
          p: [
            'Il pilastro 3a (3e pilier A, previdenza individuale vincolata) è un conto di previdenza presso una banca o un’assicurazione. Quello che versi durante l’anno si deduce dal tuo reddito imponibile, fino a un limite annuo.',
          ],
        },
        {
          h: 'Perché prima del 31 dicembre',
          p: [
            'Contano solo i versamenti effettuati davvero durante l’anno fiscale. Un versamento a gennaio conta per il nuovo anno, non per quello che stai dichiarando. Lascia al bonifico il tempo di arrivare.',
          ],
        },
        {
          h: 'Chi può versare',
          p: [
            'Ti serve un reddito da attività lucrativa, dipendente o indipendente, e devi essere assicurato all’AVS/AI. Una breve interruzione (servizio militare, disoccupazione, malattia) non ti toglie il diritto.',
          ],
        },
        {
          h: 'Quanto',
          p: [
            'Il limite dipende dalla tua cassa pensione (2° pilastro). Se sei affiliato, è un importo massimo fisso. Se no, è una parte del tuo reddito da lavoro, fino a un massimo più alto. Gli importi cambiano negli anni: li trovi nelle istruzioni federali e nella guida ginevrina, linkate qui sotto.',
            'Dal 2026 puoi anche recuperare gli anni dal 2025 in cui non hai versato il massimo, a certe condizioni.',
          ],
        },
        {
          h: 'In coppia',
          p: [
            'Ognuno versa sul proprio conto e ha la propria riga nella dichiarazione (c.A e c.B).',
          ],
        },
        {
          h: 'Cosa conservare',
          p: [
            'La tua banca o assicurazione ti invia un attestato. Allegalo alla dichiarazione: senza, la deduzione non è ammessa.',
          ],
        },
        {
          h: 'Buono a sapersi',
          p: [
            'Questi soldi sono per la pensione. Quando ti vengono versati, sono tassati: separatamente, se li ricevi come capitale.',
            'In Taxpresso, chiedi a Claude quanto ti farebbe risparmiare un versamento quest’anno: ti mostra il margine che ti resta, secondo i limiti ufficiali.',
          ],
        },
      ],
      sources: [
        'Istruzioni federali 2026, pilastro 3a (Form. 2a, chiffre 13), PDF p. 7',
        'Guida fiscale ginevrina 2025: contributi e riscatti (Déductions des cotisations et des rachats), PDF p. 18',
      ],
    },

    tou: {
      title: 'Imposta alla fonte: la tassazione ordinaria ulteriore (TOU)',
      summary:
        'Come funziona la TOU, quando è obbligatoria, il termine del 31 marzo e perché non si torna indietro.',
      sections: [
        {
          h: 'L’imposta alla fonte',
          p: [
            'Se sei tassato alla fonte (impôt à la source), il tuo datore di lavoro trattiene l’imposta direttamente dal salario, secondo una tariffa (barème). La tariffa non conosce tutta la tua situazione: figli, reddito del coniuge, deduzioni o spese effettive.',
          ],
        },
        {
          h: 'Cos’è la TOU',
          p: [
            'Con la tassazione ordinaria ulteriore (taxation ordinaire ultérieure, TOU) compili una normale dichiarazione d’imposta. L’amministrazione fiscale (AFC) può così tenere conto di deduzioni e spese effettive che le tariffe non includono. L’imposta già trattenuta si sottrae da quella finale: secondo la tua situazione, ricevi un rimborso o paghi un supplemento.',
          ],
        },
        {
          h: 'Obbligatoria o su richiesta',
          p: [
            'Se vivi in Svizzera, la TOU è obbligatoria in alcuni casi: salario lordo annuo sopra una soglia, altri redditi non tassati alla fonte sopra un importo, un immobile a Ginevra, sostanza imponibile, o TOU l’anno precedente. La guida ginevrina indica le soglie dell’anno. Negli altri casi puoi chiederla.',
          ],
        },
        {
          h: 'Il termine: 31 marzo',
          p: [
            'Invia il modulo DRIS/TOU entro il 31 marzo dell’anno successivo a quello della trattenuta. Si compila online dal tuo spazio fiscale (espace fiscal, e-démarches), o su carta se l’hai ricevuto per posta. Senza modulo, l’imposta trattenuta dal datore di lavoro diventa definitiva, salvo rettifica dell’AFC.',
          ],
        },
        {
          h: 'Non si torna indietro',
          p: [
            'Una volta chiesta la TOU, non puoi più tornare all’imposta alla fonte, qualunque sia il risultato. Resti in TOU per tutti gli anni successivi, finché non sei più tassato alla fonte. Se sei sposato e vivete insieme, la richiesta vale anche per il tuo coniuge.',
          ],
        },
        {
          h: 'Solo una correzione?',
          p: [
            'Se vuoi solo far correggere l’imposta trattenuta, perché non rispecchia la tua situazione reale, lo stesso modulo ti permette una domanda di rettifica (demande de rectification de l’impôt à la source, DRIS), con lo stesso termine.',
          ],
        },
        {
          h: 'Con Taxpresso',
          p: [
            'Prenditi il tempo di confrontare prima di decidere: Taxpresso ti mostrerà i due casi, con i loro importi. Il modulo lo invii tu.',
          ],
        },
      ],
      sources: [
        'Rettifica o tassazione ordinaria ulteriore (Demande de rectification ou taxation ordinaire ultérieure)',
        'Guida fiscale ginevrina 2025: la TOU per chi è tassato alla fonte, PDF p. 52',
        'Legge federale sull’imposta federale diretta (LIFD), art. 89a, PDF p. 51',
      ],
    },

    couples: {
      title: 'La dichiarazione in coppia',
      summary:
        'Sposati o in unione domestica registrata: una sola dichiarazione, chi compila cosa e come Ginevra fissa l’aliquota.',
      sections: [
        {
          h: 'Una dichiarazione per due',
          p: [
            'Se siete sposati o in unione domestica registrata e vivete insieme, compilate una sola dichiarazione. I vostri redditi e le vostre sostanze si sommano, qualunque sia il regime dei beni. Se convivete senza essere sposati né registrati, ognuno compila la propria.',
          ],
        },
        {
          h: 'Decide il 31 dicembre',
          p: [
            'Il tuo stato civile (état civil) al 31 dicembre vale per tutto l’anno. Sposati durante l’anno: una sola dichiarazione, con tutto ciò che riguarda la coppia dal 1° gennaio. Separati o divorziati durante l’anno: ognuno compila la propria dichiarazione per tutto l’anno.',
          ],
        },
        {
          h: 'Chi compila cosa',
          p: [
            'La persona indicata a sinistra sulla dichiarazione compila le rubriche c.A (contribuable A), il coniuge a destra le rubriche c.B. Compilate ognuno le vostre con cura: l’amministrazione fiscale le usa per calcolare la parte d’imposta di ciascuno, indicata su una ripartizione (scission informative) allegata alla fattura.',
          ],
        },
        {
          h: 'Come Ginevra fissa l’aliquota',
          p: [
            'Per attenuare l’effetto di due redditi sommati, Ginevra divide per due il reddito totale della coppia per trovare l’aliquota (splitting intégral). Se lavorate entrambi, c’è anche una deduzione per le coppie con due redditi (déduction sur le gain de l’un des époux), per l’imposta cantonale e per quella federale.',
          ],
        },
        {
          h: 'Responsabili insieme',
          p: [
            'I coniugi che vivono insieme rispondono solidalmente dell’imposta totale della coppia.',
          ],
        },
        {
          h: 'Con Taxpresso',
          p: [
            'Di’ a Claude che siete sposati: Taxpresso fa allora le sue domande per ognuno di voi e ordina i documenti per persona.',
          ],
        },
      ],
      sources: [
        'Guida fiscale ginevrina 2025: come compilare la dichiarazione (Comment remplir ma déclaration), PDF p. 5',
        'Guida fiscale ginevrina 2025: tariffa e splitting (Barème et splitting), PDF p. 45',
        'Guida fiscale ginevrina 2025: cambiamenti di situazione (Changements de situation), PDF p. 53',
        'Legge ginevrina sull’imposizione delle persone fisiche (LIPP), art. 8, 41 e 66',
      ],
    },

    assessment: {
      title: 'La tua tassazione (avis de taxation), e come contestarla',
      summary:
        'Cosa ricevi dopo la dichiarazione, come verificarlo e come fare reclamo (réclamation) entro 30 giorni.',
      sections: [
        {
          h: 'Cosa ricevi',
          p: [
            'Una volta elaborata la tua dichiarazione, l’amministrazione fiscale (AFC) ti invia le fatture d’imposta (bordereaux) per l’imposta cantonale e comunale (ICC) e per l’imposta federale diretta (IFD), e una decisione di tassazione (avis de taxation) che riassume gli importi usati per calcolare l’imposta.',
          ],
        },
        {
          h: 'Verificala',
          p: [
            'Confronta la tassazione con la tua dichiarazione, riga per riga. Se gli acconti hanno superato l’imposta, l’AFC ti rimborsa entro 30 giorni. Altrimenti hai 30 giorni per pagare o contestare l’importo.',
            'In Taxpresso, metti la tassazione nella tua cartella: Taxpresso la confronta con la tua dichiarazione, voce per voce, e ti indica il termine per il reclamo.',
          ],
        },
        {
          h: 'Il reclamo: 30 giorni',
          p: [
            'Se non sei d’accordo, invia un reclamo scritto (réclamation) all’amministrazione fiscale che ti ha tassato, entro 30 giorni dalla notifica. Lo stesso termine vale per l’imposta cantonale e comunale e per l’imposta federale diretta.',
          ],
        },
        {
          h: 'Come contare',
          p: [
            'I 30 giorni iniziano il giorno dopo la notifica. Sei nei termini se consegni il reclamo all’amministrazione fiscale o a un ufficio postale svizzero entro l’ultimo giorno. Se quel giorno è un sabato, una domenica o un giorno festivo, il termine passa al primo giorno feriale successivo. Se hai dubbi, chiedi all’AFC.',
          ],
        },
        {
          h: 'Cosa scrivere',
          p: [
            'Indica cosa contesti e perché, e allega una copia dei documenti che lo dimostrano. Se sei stato tassato d’ufficio (taxation d’office), per esempio perché non hai presentato la dichiarazione, il reclamo deve spiegare perché la tassazione è manifestamente inesatta e indicare le prove.',
          ],
        },
        {
          h: 'E poi',
          p: [
            'Il reclamo è in linea di principio gratuito. L’amministrazione fiscale può riesaminare tutta la tassazione e, dopo averti sentito, modificarla anche a tuo sfavore. L’importo che non contesti va comunque pagato nei termini. Taxpresso non invia mai il reclamo al posto tuo.',
          ],
        },
      ],
      sources: [
        'Legge ginevrina di procedura fiscale (LPFisc), art. 39 a 43',
        'Legge federale sull’imposta federale diretta (LIFD), art. 132 a 135, PDF p. 71',
        'Guida fiscale ginevrina 2025: calendario (Agenda), PDF p. 4',
      ],
    },

    privacy: {
      title: 'I tuoi dati restano sul tuo computer',
      summary:
        'Cosa conserva Taxpresso sul tuo computer, cosa vede Claude e come impostare la privacy di Claude.',
      sections: [
        {
          h: 'Sul tuo computer',
          p: [
            'Taxpresso è un’estensione che funziona in Claude Desktop, sul tuo computer. Le tue risposte e i tuoi documenti restano in una cartella tua, Documenti/Taxpresso, a meno che tu ne abbia scelta un’altra. L’estensione non fa nessuna richiesta su internet: niente server, niente account, niente tracciamento. La dashboard funziona solo sul tuo computer.',
          ],
        },
        {
          h: 'Cosa vede Claude',
          p: [
            'Claude, l’IA con cui parli, funziona con il tuo account Claude. Vede quello che scrivi nella conversazione e i documenti che legge con te, per proporti valori che confermi tu. Taxpresso legge solo i documenti nella tua cartella, mai la cronologia delle tue conversazioni.',
          ],
        },
        {
          h: 'Le tue impostazioni in Claude',
          p: [
            'Nelle impostazioni di Claude, alla voce Privacy, decidi tu se le tue conversazioni possono aiutare a migliorare Claude. Fallo prima di iniziare, e cancella le conversazioni sulle tasse quando hai finito la dichiarazione.',
          ],
        },
        {
          h: 'Accedi tu, trasmetti tu',
          p: [
            'Per compilare la dichiarazione online ufficiale, accedi tu stesso al tuo account e-démarches. Claude non digita mai le tue password e non preme mai Transmettre: lo fai tu. La dichiarazione online conserva i tuoi dati e resta modificabile fino alla trasmissione finale, e resti responsabile delle cifre dichiarate.',
          ],
        },
        {
          h: 'Proteggi la tua cartella',
          p: [
            'È una cartella normale: fanne un backup o cancellala come qualsiasi altra. È sicura quanto il tuo computer: proteggilo con una password e attiva la cifratura del disco.',
          ],
        },
        {
          h: 'Verifica tu stesso',
          p: [
            `Taxpresso è open source: chiunque può leggere il suo [codice sorgente](${SOURCE_URL}) e verificare cosa fa.`,
          ],
        },
      ],
      sources: [
        'La dichiarazione online (La déclaration en ligne des particuliers)',
        'Le tue dichiarazioni in e-démarches (Gérer mes déclarations d’impôt)',
      ],
    },
  },
};

const es: GuidesCopy = {
  htmlTitle: 'Guías de Taxpresso: tu declaración de Ginebra, en palabras sencillas',
  metaDescription:
    'Guías breves sobre la declaración de impuestos de Ginebra: documentos, pilar 3a, TOU, en pareja, liquidación, privacidad. Con enlaces a las páginas oficiales.',
  title: 'Guías',
  lead: 'Guías breves para entender tu declaración de impuestos de Ginebra. Cada una termina con las páginas oficiales, que son las que cuentan.',
  basis:
    'Basadas en la guía fiscal de Ginebra 2025, la última publicada, las instrucciones federales 2026 y las leyes vigentes. Páginas oficiales consultadas el 13 de octubre de 2026.',
  disclaimer:
    'Estas guías explican cómo funcionan las cosas. No sustituyen a los documentos oficiales ni a un asesoramiento fiscal. Si tienes dudas, pregunta a la Administración fiscal cantonal (AFC).',
  sourcesTitle: 'Fuentes oficiales',
  sourcesNote: 'Páginas de la administración, en francés. Se abren en una pestaña nueva.',
  moreTitle: 'Otras guías',
  all: 'Todas las guías',
  read: 'Leer la guía',
  guides: {
    documents: {
      title: 'Tus documentos: qué reunir y dónde encontrarlo',
      summary:
        'Los justificantes que necesita tu declaración, cuáles adjuntar y cuáles guardar, y el plazo del 31 de marzo.',
      sections: [
        {
          h: 'Para todo tu hogar',
          p: [
            'Reúne los justificantes del año de todo tu hogar fiscal: tú, tu cónyuge o pareja y tus hijos menores a cargo.',
          ],
        },
        {
          h: 'Tus ingresos',
          p: ['Lo que cobraste durante el año:'],
          list: [
            'El certificado de salario (certificat de salaire), uno por empleador.',
            'Los certificados de prestaciones (attestations d’indemnités): desempleo, enfermedad, accidente.',
            'Los certificados de pensiones (attestations de rentes): AVS o AI, caja de pensiones.',
            'La pensión alimenticia que recibiste (pension alimentaire).',
          ],
        },
        {
          h: 'Tus cuentas y valores',
          p: [
            'Para cada banco, el extracto de tus cuentas a 31 de diciembre, incluidas las cuentas conjuntas y las de tus hijos menores, con los gastos bancarios. Para una cartera de valores, el extracto fiscal (relevé fiscal) con todas las posiciones.',
            'Algunos bancos ofrecen un extracto fiscal electrónico (e-relevé fiscal): GeTax, el programa del cantón, puede importarlo y rellenar esas páginas por ti. Tu banco no envía nada por su cuenta a la administración fiscal.',
          ],
        },
        {
          h: 'Tus deducciones',
          p: ['Los certificados y justificantes de lo que pagaste:'],
          list: [
            'El certificado del pilar 3a (attestation 3e pilier A), de tu banco o aseguradora.',
            'El certificado de aportación voluntaria a tu caja de pensiones (rachat 2e pilier, formulario 21EDP), si hiciste una.',
            'Las primas del seguro de enfermedad, básico y complementario.',
            'Los gastos médicos que pagaste tú (décompte LAMal).',
            'Los gastos de cuidado de los hijos (frais de garde): guardería, niñera, cuidado extraescolar.',
            'Los donativos a asociaciones o partidos políticos en Suiza.',
            'Los intereses de préstamos: el extracto del banco o del prestamista.',
            'La pensión alimenticia que pagaste, y la sentencia o el convenio que la fija.',
          ],
        },
        {
          h: 'Adjuntar o guardar',
          p: ['La guía fiscal de Ginebra distingue tres casos:'],
          list: [
            'Adjuntar siempre: certificados de salario y de prestaciones, certificados del pilar 3a y de aportaciones voluntarias a la caja de pensiones, extractos fiscales de tus valores.',
            'Adjuntar solo si es nuevo o si el importe cambió mucho: certificados de pensiones, justificantes de deudas, sentencia de divorcio o de separación.',
            'Guardar, por si la administración fiscal (AFC) los pide: certificados de tus cuentas de nómina y de ahorro, justificantes de gastos médicos y de donativos.',
          ],
        },
        {
          h: 'Cuándo',
          p: [
            'Salvo excepciones, el plazo para enviar tu declaración es el 31 de marzo del año siguiente. ¿Necesitas más tiempo? Pide una prórroga (délai): del 1 de enero al 31 de octubre desde tu espacio fiscal (espace fiscal, e-démarches), con el formulario en línea, por teléfono o por correo, y del 1 de noviembre al 31 de diciembre, solo por correo. La prórroga tiene una tasa, según su duración.',
            'En línea puedes presentarla sin papel (zéro papier) si adjuntas todos los justificantes en PDF.',
          ],
        },
        {
          h: 'Con Taxpresso',
          p: [
            'Deja tus documentos en tu carpeta de Taxpresso a medida que llegan. La lista de lo que falta sigue tus respuestas: solo pide lo que te corresponde.',
          ],
        },
      ],
      sources: [
        'Guía fiscal de Ginebra 2025: documentos necesarios (Documents nécessaires), PDF p. 8',
        'Guía fiscal de Ginebra 2025: justificantes (Les justificatifs), PDF p. 10',
        'Declarar tus valores con el extracto fiscal electrónico (Déclarez vos titres avec le e-relevé fiscal)',
        'Pedir una prórroga (Demander un délai pour ma déclaration d’impôt)',
        'Cómo rellenar la declaración (Comment remplir ma déclaration d’impôt)',
      ],
    },

    'pillar-3a': {
      title: 'Pilar 3a: aporta antes del 31 de diciembre',
      summary:
        'Lo que aportas al pilar 3a reduce tu renta imponible, pero solo si el dinero se ingresa durante el año.',
      sections: [
        {
          h: '¿Qué es?',
          p: [
            'El pilar 3a (3e pilier A, previsión individual vinculada) es una cuenta de ahorro para la jubilación en un banco o una aseguradora. Lo que aportas durante el año se deduce de tu renta imponible, hasta un límite anual.',
          ],
        },
        {
          h: '¿Por qué antes del 31 de diciembre?',
          p: [
            'Solo cuentan las aportaciones hechas de verdad durante el año fiscal. Una aportación en enero cuenta para el año nuevo, no para el que declaras. Dale tiempo a tu transferencia para que llegue.',
          ],
        },
        {
          h: 'Quién puede aportar',
          p: [
            'Necesitas ingresos de una actividad lucrativa, por cuenta ajena o propia, y estar asegurado en la AVS/AI. Una interrupción pasajera (servicio militar, desempleo, enfermedad) no te quita el derecho.',
          ],
        },
        {
          h: 'Cuánto',
          p: [
            'El límite depende de tu caja de pensiones (2.º pilar). Si estás afiliado a una, es un máximo fijo. Si no, es una parte de tus ingresos del trabajo, hasta un máximo más alto. Los importes cambian con los años: los encontrarás en las instrucciones federales y en la guía de Ginebra, enlazadas abajo.',
            'Desde 2026 también puedes recuperar los años desde 2025 en los que no aportaste el máximo, con condiciones.',
          ],
        },
        {
          h: 'En pareja',
          p: [
            'Cada uno aporta a su propia cuenta y tiene su propia línea en la declaración (c.A y c.B).',
          ],
        },
        {
          h: 'Qué guardar',
          p: [
            'Tu banco o aseguradora te envía un certificado. Adjúntalo a tu declaración: sin él, no se admite la deducción.',
          ],
        },
        {
          h: 'Bueno saberlo',
          p: [
            'Este dinero es para la jubilación. Cuando te lo pagan, tributa: por separado, si lo cobras en forma de capital.',
            'En Taxpresso, pregúntale a Claude cuánto te ahorraría una aportación este año: te muestra el margen que te queda, según los límites oficiales.',
          ],
        },
      ],
      sources: [
        'Instrucciones federales 2026, pilar 3a (Form. 2a, chiffre 13), PDF p. 7',
        'Guía fiscal de Ginebra 2025: aportaciones y compras (Déductions des cotisations et des rachats), PDF p. 18',
      ],
    },

    tou: {
      title: 'Impuesto en la fuente: la tributación ordinaria posterior (TOU)',
      summary:
        'Cómo funciona la TOU, cuándo es obligatoria, el plazo del 31 de marzo y por qué no hay vuelta atrás.',
      sections: [
        {
          h: 'El impuesto en la fuente',
          p: [
            'Si tributas en la fuente (impôt à la source), tu empleador te retiene el impuesto directamente del salario, según una tabla (barème). La tabla no conoce toda tu situación: hijos, ingresos de tu cónyuge, deducciones o gastos reales.',
          ],
        },
        {
          h: 'Qué es la TOU',
          p: [
            'Con la tributación ordinaria posterior (taxation ordinaire ultérieure, TOU) presentas una declaración de impuestos normal. Así la administración fiscal (AFC) puede tener en cuenta deducciones y gastos reales que las tablas no incluyen. El impuesto ya retenido se resta del impuesto final: según tu situación, te devuelven dinero o pagas más.',
          ],
        },
        {
          h: 'Obligatoria o a petición',
          p: [
            'Si vives en Suiza, la TOU es obligatoria en algunos casos: un salario bruto anual por encima de un umbral, otros ingresos no sujetos al impuesto en la fuente por encima de un importe, un inmueble en Ginebra, patrimonio imponible, o TOU el año anterior. La guía de Ginebra da los umbrales del año. En los demás casos, puedes pedirla.',
          ],
        },
        {
          h: 'El plazo: 31 de marzo',
          p: [
            'Envía el formulario DRIS/TOU a más tardar el 31 de marzo del año siguiente a la retención. Se rellena en línea desde tu espacio fiscal (espace fiscal, e-démarches), o en papel si lo recibiste por correo. Sin formulario, el impuesto que retuvo tu empleador pasa a ser definitivo, salvo que la AFC lo corrija.',
          ],
        },
        {
          h: 'No hay vuelta atrás',
          p: [
            'Una vez pedida la TOU, ya no puedes volver al impuesto en la fuente, sea cual sea el resultado. Sigues en TOU todos los años siguientes, hasta que dejes de tributar en la fuente. Si estás casado y vivís juntos, la solicitud vale también para tu cónyuge.',
          ],
        },
        {
          h: '¿Solo una corrección?',
          p: [
            'Si solo quieres que corrijan el impuesto retenido, porque no refleja tu situación real, el mismo formulario te permite pedir una rectificación (demande de rectification de l’impôt à la source, DRIS), en el mismo plazo.',
          ],
        },
        {
          h: 'Con Taxpresso',
          p: [
            'Tómate tu tiempo para comparar antes de decidir: Taxpresso te mostrará los dos casos, con sus importes. El formulario lo envías tú.',
          ],
        },
      ],
      sources: [
        'Rectificación o tributación ordinaria posterior (Demande de rectification ou taxation ordinaire ultérieure)',
        'Guía fiscal de Ginebra 2025: la TOU para quien tributa en la fuente, PDF p. 52',
        'Ley federal del impuesto federal directo (LIFD), art. 89a, PDF p. 51',
      ],
    },

    couples: {
      title: 'Declarar en pareja',
      summary:
        'Casados o pareja registrada: una sola declaración, quién rellena qué y cómo fija Ginebra el tipo.',
      sections: [
        {
          h: 'Una declaración para dos',
          p: [
            'Si estáis casados o sois pareja registrada y vivís juntos, presentáis una sola declaración. Vuestros ingresos y patrimonios se suman, sea cual sea vuestro régimen económico matrimonial. Si vivís juntos sin estar casados ni registrados, cada uno presenta la suya.',
          ],
        },
        {
          h: 'El 31 de diciembre decide',
          p: [
            'Tu estado civil (état civil) a 31 de diciembre vale para todo el año. Si os casasteis durante el año: una sola declaración, con todo lo de la pareja desde el 1 de enero. Si os separasteis o divorciasteis durante el año: cada uno presenta su propia declaración por todo el año.',
          ],
        },
        {
          h: 'Quién rellena qué',
          p: [
            'La persona que figura a la izquierda de la declaración rellena las casillas c.A (contribuable A), y su cónyuge, a la derecha, las casillas c.B. Rellenad cada uno las vuestras con cuidado: la administración fiscal las usa para calcular la parte del impuesto de cada uno, que aparece en un desglose (scission informative) junto con la factura.',
          ],
        },
        {
          h: 'Cómo fija Ginebra el tipo',
          p: [
            'Para suavizar el efecto de sumar dos ingresos, Ginebra divide entre dos los ingresos totales de la pareja para hallar el tipo impositivo (splitting intégral). Si trabajáis los dos, hay además una deducción para parejas con dos ingresos (déduction sur le gain de l’un des époux), en el impuesto cantonal y en el federal.',
          ],
        },
        {
          h: 'Responsables juntos',
          p: [
            'Los cónyuges que viven juntos responden solidariamente del impuesto total de la pareja.',
          ],
        },
        {
          h: 'Con Taxpresso',
          p: [
            'Dile a Claude que estáis casados: Taxpresso hace entonces sus preguntas para cada uno y ordena los documentos por persona.',
          ],
        },
      ],
      sources: [
        'Guía fiscal de Ginebra 2025: cómo rellenar la declaración (Comment remplir ma déclaration), PDF p. 5',
        'Guía fiscal de Ginebra 2025: tabla y splitting (Barème et splitting), PDF p. 45',
        'Guía fiscal de Ginebra 2025: cambios de situación (Changements de situation), PDF p. 53',
        'Ley ginebrina sobre la tributación de las personas físicas (LIPP), art. 8, 41 y 66',
      ],
    },

    assessment: {
      title: 'Tu liquidación (avis de taxation) y cómo reclamar',
      summary:
        'Lo que recibes después de declarar, cómo comprobarlo y cómo presentar una reclamación (réclamation) en 30 días.',
      sections: [
        {
          h: 'Lo que recibes',
          p: [
            'Una vez tramitada tu declaración, la administración fiscal (AFC) te envía las facturas (bordereaux) del impuesto cantonal y municipal (ICC) y del impuesto federal directo (IFD), y una liquidación (avis de taxation) que resume los importes usados para calcular tu impuesto.',
          ],
        },
        {
          h: 'Compruébala',
          p: [
            'Compara la liquidación con tu declaración, línea por línea. Si tus pagos a cuenta superaron el impuesto, la AFC te devuelve la diferencia en 30 días. Si no, tienes 30 días para pagar o impugnar el importe.',
            'En Taxpresso, deja la liquidación en tu carpeta: Taxpresso la compara con tu declaración, partida por partida, y te muestra el plazo para reclamar.',
          ],
        },
        {
          h: 'La reclamación: 30 días',
          p: [
            'Si no estás de acuerdo, envía una reclamación por escrito (réclamation) a la administración fiscal que te liquidó, en los 30 días siguientes a la notificación. El mismo plazo vale para el impuesto cantonal y municipal y para el impuesto federal directo.',
          ],
        },
        {
          h: 'Cómo contar',
          p: [
            'Los 30 días empiezan al día siguiente de la notificación. Llegas a tiempo si entregas tu reclamación a la administración fiscal o en una oficina de correos suiza, como tarde el último día. Si ese día cae en sábado, domingo o festivo, el plazo pasa al siguiente día hábil. Si tienes dudas, pregunta a la AFC.',
          ],
        },
        {
          h: 'Qué escribir',
          p: [
            'Indica qué impugnas y por qué, y adjunta una copia de los documentos que lo demuestran. Si te liquidaron de oficio (taxation d’office), por ejemplo porque no presentaste la declaración, la reclamación debe explicar por qué la liquidación es manifiestamente incorrecta y aportar las pruebas.',
          ],
        },
        {
          h: 'Después',
          p: [
            'La reclamación es, en principio, gratuita. La administración fiscal puede revisar toda tu liquidación y, después de oírte, cambiarla también en tu contra. El importe que no impugnas lo sigues pagando a tiempo. Taxpresso nunca presenta la reclamación por ti.',
          ],
        },
      ],
      sources: [
        'Ley ginebrina de procedimiento fiscal (LPFisc), art. 39 a 43',
        'Ley federal del impuesto federal directo (LIFD), art. 132 a 135, PDF p. 71',
        'Guía fiscal de Ginebra 2025: calendario (Agenda), PDF p. 4',
      ],
    },

    privacy: {
      title: 'Tus datos se quedan en tu ordenador',
      summary:
        'Lo que Taxpresso guarda en tu ordenador, lo que ve Claude y cómo configurar la privacidad de Claude.',
      sections: [
        {
          h: 'En tu ordenador',
          p: [
            'Taxpresso es una extensión que funciona dentro de Claude Desktop, en tu ordenador. Tus respuestas y tus documentos se quedan en una carpeta tuya, Documentos/Taxpresso, salvo que hayas elegido otra. La extensión no hace ninguna petición a internet: ni servidor, ni cuenta, ni rastreo. El panel solo funciona en tu ordenador.',
          ],
        },
        {
          h: 'Lo que ve Claude',
          p: [
            'Claude, la IA con la que hablas, funciona con tu propia cuenta de Claude. Ve lo que escribes en la conversación y los documentos que lee contigo, para proponerte valores que tú confirmas. Taxpresso solo lee los documentos de tu carpeta, nunca tu historial de conversaciones.',
          ],
        },
        {
          h: 'Tu configuración en Claude',
          p: [
            'En la configuración de Claude, en el apartado Privacidad, tú decides si tus conversaciones pueden servir para mejorar Claude. Ajústalo antes de empezar, y borra tus conversaciones sobre impuestos cuando termines la declaración.',
          ],
        },
        {
          h: 'Tú inicias sesión, tú transmites',
          p: [
            'Para rellenar la declaración oficial en línea, inicias sesión tú mismo en tu cuenta e-démarches. Claude nunca escribe tus contraseñas ni pulsa Transmettre: eso lo haces tú. La declaración en línea guarda lo que introduces y se puede modificar hasta la transmisión final, y tú sigues siendo responsable de las cifras declaradas.',
          ],
        },
        {
          h: 'Cuida tu carpeta',
          p: [
            'Es una carpeta normal: haz copia de seguridad o bórrala como cualquier otra. Está tan segura como tu ordenador: protégelo con una contraseña y activa el cifrado del disco.',
          ],
        },
        {
          h: 'Compruébalo tú mismo',
          p: [
            `Taxpresso es de código abierto: cualquiera puede leer su [código fuente](${SOURCE_URL}) y comprobar lo que hace.`,
          ],
        },
      ],
      sources: [
        'La declaración en línea (La déclaration en ligne des particuliers)',
        'Tus declaraciones en e-démarches (Gérer mes déclarations d’impôt)',
      ],
    },
  },
};

const pt: GuidesCopy = {
  htmlTitle: 'Guias Taxpresso: a tua declaração de Genebra, em palavras simples',
  metaDescription:
    'Guias curtos sobre a declaração de impostos de Genebra: documentos, pilar 3a, TOU, em casal, liquidação, privacidade. Com ligações para as páginas oficiais.',
  title: 'Guias',
  lead: 'Guias curtos para perceberes a tua declaração de impostos de Genebra. Cada um termina com as páginas oficiais, que são as que contam.',
  basis:
    'Com base no guia fiscal de Genebra 2025, o último publicado, nas instruções federais 2026 e nas leis em vigor. Páginas oficiais consultadas a 13 de outubro de 2026.',
  disclaimer:
    'Estes guias explicam como as coisas funcionam. Não substituem os documentos oficiais nem um aconselhamento fiscal. Em caso de dúvida, pergunta à Administração Fiscal Cantonal (AFC).',
  sourcesTitle: 'Fontes oficiais',
  sourcesNote: 'Páginas da administração, em francês. Abrem num novo separador.',
  moreTitle: 'Outros guias',
  all: 'Todos os guias',
  read: 'Ler o guia',
  guides: {
    documents: {
      title: 'Os teus documentos: o que juntar e onde os encontrar',
      summary:
        'Os comprovativos de que a tua declaração precisa, quais anexar e quais guardar, e o prazo de 31 de março.',
      sections: [
        {
          h: 'Para todo o teu agregado',
          p: [
            'Junta os comprovativos do ano de todo o teu agregado fiscal: tu, o teu cônjuge ou parceiro e os teus filhos menores a cargo.',
          ],
        },
        {
          h: 'Os teus rendimentos',
          p: ['O que recebeste durante o ano:'],
          list: [
            'O certificado de salário (certificat de salaire), um por empregador.',
            'As declarações de subsídios (attestations d’indemnités): desemprego, doença, acidente.',
            'As declarações de pensões (attestations de rentes): AVS ou AI, caixa de pensões.',
            'A pensão de alimentos que recebeste (pension alimentaire).',
          ],
        },
        {
          h: 'As tuas contas e títulos',
          p: [
            'Para cada banco, o extrato das tuas contas a 31 de dezembro, incluindo as contas conjuntas e as dos teus filhos menores, com as despesas bancárias. Para uma carteira de títulos, o extrato fiscal (relevé fiscal) com todas as posições.',
            'Alguns bancos oferecem um extrato fiscal eletrónico (e-relevé fiscal): o GeTax, o programa do cantão, pode importá-lo e preencher essas páginas por ti. O teu banco não envia nada por si à administração fiscal.',
          ],
        },
        {
          h: 'As tuas deduções',
          p: ['As declarações e comprovativos do que pagaste:'],
          list: [
            'A declaração do pilar 3a (attestation 3e pilier A), do teu banco ou seguradora.',
            'A declaração de contribuição voluntária para a caixa de pensões (rachat 2e pilier, formulário 21EDP), se fizeste alguma.',
            'Os prémios do seguro de saúde, básico e complementar.',
            'As despesas médicas que ficaram a teu cargo (décompte LAMal).',
            'As despesas com a guarda dos filhos (frais de garde): creche, ama, acolhimento depois da escola.',
            'Os donativos a associações ou partidos políticos na Suíça.',
            'Os juros de empréstimos: o extrato do banco ou do credor.',
            'A pensão de alimentos que pagaste, e a sentença ou o acordo que a fixa.',
          ],
        },
        {
          h: 'Anexar ou guardar',
          p: ['O guia fiscal de Genebra distingue três casos:'],
          list: [
            'Anexar sempre: certificados de salário e de subsídios, declarações do pilar 3a e das contribuições voluntárias para a caixa de pensões, extratos fiscais dos teus títulos.',
            'Anexar só se for novo ou se o montante mudou muito: certificados de pensões, comprovativos de dívidas, sentença de divórcio ou de separação.',
            'Guardar, caso a administração fiscal (AFC) os peça: declarações das tuas contas de ordenado e de poupança, comprovativos de despesas médicas e de donativos.',
          ],
        },
        {
          h: 'Quando',
          p: [
            'Salvo exceções, o prazo para enviar a tua declaração é 31 de março do ano seguinte. Precisas de mais tempo? Pede uma prorrogação (délai): de 1 de janeiro a 31 de outubro no teu espaço fiscal (espace fiscal, e-démarches), com o formulário online, por telefone ou por correio, e de 1 de novembro a 31 de dezembro, só por correio. A prorrogação tem uma taxa, conforme a duração.',
            'Online podes entregar sem papel (zéro papier) se anexares todos os comprovativos em PDF.',
          ],
        },
        {
          h: 'Com o Taxpresso',
          p: [
            'Põe os teus documentos na tua pasta Taxpresso à medida que chegam. A lista do que falta segue as tuas respostas: só pede o que te diz respeito.',
          ],
        },
      ],
      sources: [
        'Guia fiscal de Genebra 2025: documentos necessários (Documents nécessaires), PDF p. 8',
        'Guia fiscal de Genebra 2025: comprovativos (Les justificatifs), PDF p. 10',
        'Declarar os teus títulos com o extrato fiscal eletrónico (Déclarez vos titres avec le e-relevé fiscal)',
        'Pedir uma prorrogação (Demander un délai pour ma déclaration d’impôt)',
        'Como preencher a declaração (Comment remplir ma déclaration d’impôt)',
      ],
    },

    'pillar-3a': {
      title: 'Pilar 3a: contribui antes de 31 de dezembro',
      summary:
        'O que pões no pilar 3a reduz o teu rendimento tributável, mas só se o dinheiro entrar durante o ano.',
      sections: [
        {
          h: 'O que é',
          p: [
            'O pilar 3a (3e pilier A, previdência individual vinculada) é uma conta de poupança para a reforma num banco ou numa seguradora. O que contribuis durante o ano é deduzido do teu rendimento tributável, até um limite anual.',
          ],
        },
        {
          h: 'Porquê antes de 31 de dezembro',
          p: [
            'Só contam as contribuições efetivamente feitas durante o ano fiscal. Uma contribuição em janeiro conta para o ano novo, não para o que estás a declarar. Dá tempo à tua transferência para chegar.',
          ],
        },
        {
          h: 'Quem pode contribuir',
          p: [
            'Precisas de um rendimento de uma atividade profissional, por conta de outrem ou própria, e de estar segurado na AVS/AI. Uma interrupção passageira (serviço militar, desemprego, doença) não te tira esse direito.',
          ],
        },
        {
          h: 'Quanto',
          p: [
            'O limite depende da tua caixa de pensões (2.º pilar). Se estás inscrito numa, é um máximo fixo. Se não, é uma parte do teu rendimento do trabalho, até um máximo mais alto. Os montantes mudam ao longo dos anos: estão nas instruções federais e no guia de Genebra, com ligação abaixo.',
            'A partir de 2026, também podes recuperar os anos desde 2025 em que não contribuíste o máximo, sob condições.',
          ],
        },
        {
          h: 'Em casal',
          p: [
            'Cada um contribui para a sua própria conta e tem a sua própria linha na declaração (c.A e c.B).',
          ],
        },
        {
          h: 'O que guardar',
          p: [
            'O teu banco ou seguradora envia-te uma declaração. Anexa-a à tua declaração de impostos: sem ela, a dedução não é aceite.',
          ],
        },
        {
          h: 'Bom saber',
          p: [
            'Este dinheiro é para a reforma. Quando te é pago, é tributado: à parte, se for pago em capital.',
            'No Taxpresso, pergunta ao Claude quanto te pouparia uma contribuição este ano: mostra-te a margem que ainda tens, segundo os limites oficiais.',
          ],
        },
      ],
      sources: [
        'Instruções federais 2026, pilar 3a (Form. 2a, chiffre 13), PDF p. 7',
        'Guia fiscal de Genebra 2025: contribuições e compras (Déductions des cotisations et des rachats), PDF p. 18',
      ],
    },

    tou: {
      title: 'Imposto na fonte: a tributação ordinária posterior (TOU)',
      summary:
        'Como funciona a TOU, quando é obrigatória, o prazo de 31 de março e porque não há volta atrás.',
      sections: [
        {
          h: 'O imposto na fonte',
          p: [
            'Se és tributado na fonte (impôt à la source), o teu empregador retém o imposto diretamente do salário, segundo uma tabela (barème). A tabela não conhece toda a tua situação: filhos, rendimentos do cônjuge, deduções ou despesas reais.',
          ],
        },
        {
          h: 'O que é a TOU',
          p: [
            'Com a tributação ordinária posterior (taxation ordinaire ultérieure, TOU), preenches uma declaração de impostos normal. A administração fiscal (AFC) pode então ter em conta deduções e despesas reais que as tabelas não incluem. O imposto já retido é descontado do imposto final: conforme a tua situação, recebes dinheiro de volta ou pagas mais.',
          ],
        },
        {
          h: 'Obrigatória ou a pedido',
          p: [
            'Se vives na Suíça, a TOU é obrigatória em certos casos: salário bruto anual acima de um limiar, outros rendimentos não tributados na fonte acima de um montante, um imóvel em Genebra, património tributável, ou TOU no ano anterior. O guia de Genebra indica os limiares do ano. Nos outros casos, podes pedi-la.',
          ],
        },
        {
          h: 'O prazo: 31 de março',
          p: [
            'Envia o formulário DRIS/TOU até 31 de março do ano seguinte ao da retenção. Preenche-se online no teu espaço fiscal (espace fiscal, e-démarches), ou em papel se o recebeste por correio. Sem formulário, o imposto retido pelo teu empregador torna-se definitivo, salvo retificação pela AFC.',
          ],
        },
        {
          h: 'Não há volta atrás',
          p: [
            'Depois de pedires a TOU, já não podes voltar ao imposto na fonte, seja qual for o resultado. Ficas em TOU em todos os anos seguintes, até deixares de ser tributado na fonte. Se és casado e vivem juntos, o pedido vale também para o teu cônjuge.',
          ],
        },
        {
          h: 'Só uma correção?',
          p: [
            'Se só queres corrigir o imposto retido, porque não reflete a tua situação real, o mesmo formulário permite um pedido de retificação (demande de rectification de l’impôt à la source, DRIS), no mesmo prazo.',
          ],
        },
        {
          h: 'Com o Taxpresso',
          p: [
            'Dá-te tempo para comparar antes de decidir: o Taxpresso vai mostrar-te os dois casos, com os seus montantes. O formulário és tu que o envias.',
          ],
        },
      ],
      sources: [
        'Retificação ou tributação ordinária posterior (Demande de rectification ou taxation ordinaire ultérieure)',
        'Guia fiscal de Genebra 2025: a TOU para quem é tributado na fonte, PDF p. 52',
        'Lei federal do imposto federal direto (LIFD), art. 89a, PDF p. 51',
      ],
    },

    couples: {
      title: 'Declarar em casal',
      summary:
        'Casados ou em parceria registada: uma só declaração, quem preenche o quê e como Genebra fixa a taxa.',
      sections: [
        {
          h: 'Uma declaração para dois',
          p: [
            'Se são casados ou estão em parceria registada e vivem juntos, entregam uma só declaração. Os vossos rendimentos e patrimónios somam-se, seja qual for o regime de bens. Se vivem juntos sem serem casados nem registados, cada um entrega a sua.',
          ],
        },
        {
          h: 'O 31 de dezembro decide',
          p: [
            'O teu estado civil (état civil) a 31 de dezembro conta para o ano inteiro. Casaram durante o ano: uma só declaração, com tudo o que diz respeito ao casal desde 1 de janeiro. Separaram-se ou divorciaram-se durante o ano: cada um entrega a sua própria declaração para o ano inteiro.',
          ],
        },
        {
          h: 'Quem preenche o quê',
          p: [
            'A pessoa indicada à esquerda na declaração preenche as rubricas c.A (contribuable A), e o cônjuge, à direita, as rubricas c.B. Preencham cada um as vossas com cuidado: a administração fiscal usa-as para calcular a parte do imposto de cada um, indicada numa repartição (scission informative) enviada com a fatura.',
          ],
        },
        {
          h: 'Como Genebra fixa a taxa',
          p: [
            'Para atenuar o efeito de somar dois rendimentos, Genebra divide por dois o rendimento total do casal para encontrar a taxa de imposto (splitting intégral). Se ambos trabalham, há ainda uma dedução para casais com dois rendimentos (déduction sur le gain de l’un des époux), no imposto cantonal e no federal.',
          ],
        },
        {
          h: 'Responsáveis em conjunto',
          p: ['Os cônjuges que vivem juntos respondem solidariamente pelo imposto total do casal.'],
        },
        {
          h: 'Com o Taxpresso',
          p: [
            'Diz ao Claude que são casados: o Taxpresso faz então as perguntas a cada um de vocês e organiza os documentos por pessoa.',
          ],
        },
      ],
      sources: [
        'Guia fiscal de Genebra 2025: como preencher a declaração (Comment remplir ma déclaration), PDF p. 5',
        'Guia fiscal de Genebra 2025: tabela e splitting (Barème et splitting), PDF p. 45',
        'Guia fiscal de Genebra 2025: mudanças de situação (Changements de situation), PDF p. 53',
        'Lei genebrina sobre a tributação das pessoas singulares (LIPP), art. 8, 41 e 66',
      ],
    },

    assessment: {
      title: 'A tua liquidação (avis de taxation) e como reclamar',
      summary:
        'O que recebes depois de declarar, como o verificar e como fazer uma reclamação (réclamation) em 30 dias.',
      sections: [
        {
          h: 'O que recebes',
          p: [
            'Depois de tratar a tua declaração, a administração fiscal (AFC) envia-te as faturas (bordereaux) do imposto cantonal e municipal (ICC) e do imposto federal direto (IFD), e uma nota de liquidação (avis de taxation) que resume os montantes usados para calcular o teu imposto.',
          ],
        },
        {
          h: 'Verifica-a',
          p: [
            'Compara a liquidação com a tua declaração, linha a linha. Se os teus pagamentos por conta foram maiores do que o imposto, a AFC devolve-te a diferença em 30 dias. Se não, tens 30 dias para pagar ou contestar o montante.',
            'No Taxpresso, põe a liquidação na tua pasta: o Taxpresso compara-a com a tua declaração, rubrica a rubrica, e mostra-te o prazo para reclamar.',
          ],
        },
        {
          h: 'A reclamação: 30 dias',
          p: [
            'Se não concordas, envia uma reclamação por escrito (réclamation) à administração fiscal que te tributou, nos 30 dias seguintes à notificação. O mesmo prazo vale para o imposto cantonal e municipal e para o imposto federal direto.',
          ],
        },
        {
          h: 'Como contar',
          p: [
            'Os 30 dias começam no dia seguinte à notificação. Estás dentro do prazo se entregares a reclamação à administração fiscal ou numa estação de correios suíça até ao último dia. Se esse dia for um sábado, um domingo ou um feriado, o prazo passa para o dia útil seguinte. Em caso de dúvida, pergunta à AFC.',
          ],
        },
        {
          h: 'O que escrever',
          p: [
            'Indica o que contestas e porquê, e anexa uma cópia dos documentos que o mostram. Se foste tributado oficiosamente (taxation d’office), por exemplo por não teres entregado a declaração, a reclamação tem de explicar porque é que a tributação está manifestamente errada e apresentar as provas.',
          ],
        },
        {
          h: 'Depois',
          p: [
            'A reclamação é, em princípio, gratuita. A administração fiscal pode rever toda a tua liquidação e, depois de te ouvir, alterá-la também em teu desfavor. O montante que não contestas continua a ter de ser pago no prazo. O Taxpresso nunca envia a reclamação por ti.',
          ],
        },
      ],
      sources: [
        'Lei genebrina de processo fiscal (LPFisc), art. 39 a 43',
        'Lei federal do imposto federal direto (LIFD), art. 132 a 135, PDF p. 71',
        'Guia fiscal de Genebra 2025: calendário (Agenda), PDF p. 4',
      ],
    },

    privacy: {
      title: 'Os teus dados ficam no teu computador',
      summary:
        'O que o Taxpresso guarda no teu computador, o que o Claude vê e como configurar a privacidade do Claude.',
      sections: [
        {
          h: 'No teu computador',
          p: [
            'O Taxpresso é uma extensão que funciona dentro do Claude Desktop, no teu computador. As tuas respostas e documentos ficam numa pasta tua, Documentos/Taxpresso, a não ser que tenhas escolhido outra. A extensão não faz nenhum pedido à internet: sem servidor, sem conta, sem rastreio. O painel só funciona no teu computador.',
          ],
        },
        {
          h: 'O que o Claude vê',
          p: [
            'O Claude, a IA com quem falas, funciona com a tua própria conta Claude. Vê o que escreves na conversa e os documentos que lê contigo, para te propor valores que tu confirmas. O Taxpresso só lê os documentos da tua pasta, nunca o teu histórico de conversas.',
          ],
        },
        {
          h: 'As tuas configurações no Claude',
          p: [
            'Nas configurações do Claude, em Privacidade, decides se as tuas conversas podem ajudar a melhorar o Claude. Faz isto antes de começar, e apaga as tuas conversas sobre impostos quando terminares a declaração.',
          ],
        },
        {
          h: 'Tu entras, tu transmites',
          p: [
            'Para preencher a declaração oficial online, inicias sessão tu mesmo na tua conta e-démarches. O Claude nunca escreve as tuas palavras-passe nem clica em Transmettre: és tu que o fazes. A declaração online guarda o que introduzes e pode ser alterada até à transmissão final, e continuas responsável pelos números declarados.',
          ],
        },
        {
          h: 'Cuida da tua pasta',
          p: [
            'É uma pasta normal: faz cópia de segurança ou apaga-a como qualquer outra. Está tão segura como o teu computador: protege-o com uma palavra-passe e ativa a encriptação do disco.',
          ],
        },
        {
          h: 'Verifica tu mesmo',
          p: [
            `O Taxpresso é open source: qualquer pessoa pode ler o seu [código-fonte](${SOURCE_URL}) e verificar o que faz.`,
          ],
        },
      ],
      sources: [
        'A declaração online (La déclaration en ligne des particuliers)',
        'As tuas declarações em e-démarches (Gérer mes déclarations d’impôt)',
      ],
    },
  },
};

export const guides: Record<Lang, GuidesCopy> = { fr, en, de, it, es, pt };

/** The guides index of a language, e.g. /en/guides/. */
export const guidesPath = (path: string) => `${path}guides/`;
/** One guide of a language, e.g. /en/guides/tou/. */
export const guidePath = (path: string, id: GuideId) => `${guidesPath(path)}${id}/`;
