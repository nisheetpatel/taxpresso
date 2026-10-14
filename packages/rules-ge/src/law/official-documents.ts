// The official documents Taxpresso cites (SPEC.md 7b), with the URL of each as listed in
// docs/sources/manifest.json: Geneva, federal tax, and the salary certificate guide. Data only: the
// extension never opens these links itself (C2); the user's browser does, when they click one.
// A test keeps every entry equal to the manifest (test/official-documents.test.ts).

export interface OfficialDocument {
  /** The title as published. */
  title: string;
  url: string;
  /** A PDF opens at a page with #page=N. */
  pdf: boolean;
}

export const OFFICIAL_DOCUMENTS: Readonly<Record<string, OfficialDocument>> = {
  'ge-2026-part-privilegiee-communique': {
    title:
      "Communiqué hebdomadaire du Conseil d'Etat du 15 octobre 2025: Fixation de la part privilégiée de chaque commune pour 2026",
    url: 'https://www.ge.ch/document/40923/telecharger',
    pdf: true,
  },
  'ge-2025-communal-centimes-pdf': {
    title: 'Centimes additionnels communaux (CA) et part privilégiée (PP)',
    url: 'https://www.ge.ch/document/7698/telecharger',
    pdf: true,
  },
  'ge-2025-deductions-guide-chapter': {
    title: 'Principales déductions pour la déclaration 2025 (chapitre du guide)',
    url: 'https://www.ge.ch/document/41995/annexe/file/573038',
    pdf: true,
  },
  'ge-na-efiling-espace-fiscal': {
    title: "Gérer mes déclarations d'impôt",
    url: 'https://www.ge.ch/espace-fiscal-e-demarches/gerer-mes-declarations-impot',
    pdf: false,
  },
  'ge-na-efiling-homologation': {
    title: 'GeTax - Homologation',
    url: 'https://www.getax.ch/support/homologation',
    pdf: false,
  },
  'ge-na-efiling-rdioi-d3-17-03': {
    title:
      "Règlement relatif aux déclarations d'impôt établies à l'aide d'outils informatiques (RDIOI), D 3 17.03",
    url: 'https://www.getax.ch/support/sites/default/files/D_3_17.03_-_Rglt_relatif_aux_declarations_impot.pdf.pdf',
    pdf: true,
  },
  'ge-na-efiling-retour-internet': {
    title: 'Le retour des déclarations par internet',
    url: 'https://www.ge.ch/getax/retour-declarations-internet',
    pdf: false,
  },
  'ge-na-efiling-rpfisc-29a': {
    title:
      "Règlement d'application de l'article 29A de la loi de procédure fiscale (RPFisc-29A), rsGE D 3 17.07",
    url: 'https://silgeneve.ch/legis/program/books/rsg/htm/rsg_d3_17p07.htm',
    pdf: false,
  },
  'ge-2025-declaration-en-ligne': {
    title: 'La déclaration en ligne des particuliers',
    url: 'https://www.ge.ch/getax/declaration-ligne-particuliers',
    pdf: false,
  },
  'ge-2025-declaration-specimen': {
    title: 'Déclaration fiscale 2025 manuscrite (spécimen)',
    url: 'https://www.ge.ch/document/42265/telecharger',
    pdf: true,
  },
  'ge-2025-getax-software': {
    title: 'Télécharger et installer GeTax pour les particuliers',
    url: 'https://www.ge.ch/getax/telecharger-installer-getax-particuliers',
    pdf: false,
  },
  'ge-2025-guide-declaration-pp': {
    title:
      'DÉCLARATION 2025 PERSONNES PHYSIQUES - Une aide pratique pour remplir votre déclaration',
    url: 'https://www.ge.ch/document/41995/annexe/file/573038',
    pdf: true,
  },
  'ge-na-law-lcp': {
    title: 'Loi générale sur les contributions publiques (LCP), rsGE D 3 05',
    url: 'https://silgeneve.ch/legis/data/rsg_d3_05.htm',
    pdf: false,
  },
  'ge-na-law-lipp': {
    title: "Loi sur l'imposition des personnes physiques (LIPP)",
    url: 'https://silgeneve.ch/legis/data/rsg_d3_08.htm',
    pdf: false,
  },
  'ge-na-law-lisp': {
    title:
      "Loi sur l'imposition à la source des personnes physiques et morales (LISP), rsGE D 3 20",
    url: 'https://silgeneve.ch/legis/data/rsg_d3_20.htm',
    pdf: false,
  },
  'ge-na-law-lpfisc': {
    title: 'Loi de procédure fiscale (LPFisc)',
    url: 'https://silgeneve.ch/legis/data/rsg_d3_17.htm',
    pdf: false,
  },
  'ge-na-law-risp': {
    title:
      "Règlement d'application de la loi sur l'imposition à la source des personnes physiques et morales (RISP), rsGE D 3 20.01",
    url: 'https://silgeneve.ch/legis/data/rsg_d3_20p01.htm',
    pdf: false,
  },
  'ge-na-other-demander-delai': {
    title: "Demander un délai pour ma déclaration d'impôt",
    url: 'https://www.ge.ch/remplir-ma-declaration-impot-tant-que-particulier/demander-delai-ma-declaration-impot',
    pdf: false,
  },
  'ge-2026-source-directives': {
    title: "Directives concernant l'impôt à la source 2026",
    url: 'https://www.ge.ch/document/42009/annexe/file/580297',
    pdf: true,
  },
  'ge-2025-dris-tou-page': {
    title: 'Demande de rectification ou taxation ordinaire ultérieure',
    url: 'https://www.ge.ch/demande-rectification-taxation-ordinaire-ulterieure',
    pdf: false,
  },
  'ge-na-tou-quand-page': {
    title: 'Quand demander ou annoncer une Taxation Ordinaire Ultérieure?',
    url: 'https://www.ge.ch/demande-rectification-taxation-ordinaire-ulterieure/quand-demander-annoncer-taxation-ordinaire-ulterieure',
    pdf: false,
  },
  'ge-2026-source-tariff-ascii': {
    title: "Barèmes 2026 de perception de l'impôt à la source au format ASCII (tar26GE.zip)",
    url: 'https://www.ge.ch/document/41859/telecharger',
    pdf: false,
  },
  'ge-2026-source-tariff-pdf': {
    title: 'Barèmes 2026 impôt à la source',
    url: 'https://www.ge.ch/document/41802/telecharger',
    pdf: true,
  },
  'ge-2025-icc-tariff-pdf': {
    title: 'Barèmes 2025 pour les impôts sur le revenu et la fortune avec exemples de calcul',
    url: 'https://www.ge.ch/document/42267/telecharger',
    pdf: true,
  },
  'ge-2025-source-tariff-ascii': {
    title: "Barèmes 2025 de perception de l'impôt à la source au format ASCII (tar25GE.zip)",
    url: 'https://www.ge.ch/document/38091/telecharger',
    pdf: false,
  },
  'ge-2025-source-tariff-pdf': {
    title: 'Barèmes 2025 impôt à la source',
    url: 'https://www.ge.ch/document/37992/telecharger',
    pdf: true,
  },
  'ge-2026-communal-centimes-arca': {
    title:
      "Arrêté approuvant le nombre des centimes additionnels à percevoir pour l'année 2026 par les communes du canton de Genève (ArCA-2026)",
    url: 'https://silgeneve.ch/legis/data/rsg_D3_05p30.htm',
    pdf: false,
  },
  'ge-2025-documents-envoyes-page': {
    title: "Déclaration d'impôt 2025: les documents envoyés",
    url: 'https://www.ge.ch/document/declaration-impot-2025-documents-envoyes',
    pdf: false,
  },
  'ge-2025-guide-fiscal-page': {
    title: 'Guide fiscal 2025 pour les particuliers',
    url: 'https://www.ge.ch/document/guide-fiscal-2025-particuliers',
    pdf: false,
  },
  'ge-na-guide-remplir-declaration': {
    title: "Comment remplir ma déclaration d'impôt",
    url: 'https://www.ge.ch/remplir-ma-declaration-impot-tant-que-particulier/comment-remplir-ma-declaration-impot',
    pdf: false,
  },
  'ge-2025-taux-donnees-fiscales': {
    title: 'Taux et données fiscales',
    url: 'https://www.ge.ch/taux-donnees-fiscales',
    pdf: false,
  },
  'ge-na-other-e-releve-fiscal': {
    title: 'Déclarez vos titres avec le e-relevé fiscal',
    url: 'https://www.ge.ch/node/13593',
    pdf: false,
  },
  'ge-2025-source-declaration-form': {
    title: "Déclaration pour le prélèvement de l'impôt à la source",
    url: 'https://www.ge.ch/document/37885/annexe/file/371410',
    pdf: true,
  },
  'ge-2025-source-directives': {
    title: "Directives concernant l'impôt à la source 2025",
    url: 'https://www.ge.ch/document/38036/annexe/file/374849',
    pdf: true,
  },
  'ge-na-law-ldirpp': {
    title:
      "Loi relative à la diminution de l'impôt sur le revenu des personnes physiques (LDIRPP), rsGE D 3 06",
    url: 'https://silgeneve.ch/legis/data/rsg_d3_06.htm',
    pdf: false,
  },
  'ge-na-law-lcacant': {
    title: 'Loi sur les centimes additionnels cantonaux (LCACant), rsGE D 3 07',
    url: 'https://silgeneve.ch/legis/data/rsg_d3_07.htm',
    pdf: false,
  },
  'ge-2025-source-capital-icc-tariff': {
    title:
      "Barème 2025 ICC de l'impôt à la source sur les prestations de prévoyance en capital (art. 45 LIPP, 10 et 11 LISP)",
    url: 'https://www.ge.ch/document/38083/telecharger',
    pdf: true,
  },
  'ge-2026-source-capital-icc-tariff': {
    title:
      "Barème 2026 ICC de l'impôt à la source sur les prestations de prévoyance en capital (art. 45 LIPP, 10 et 11 LISP)",
    url: 'https://www.ge.ch/document/41804/telecharger',
    pdf: true,
  },
  'ch-2026-ifd-progression-deductions': {
    title:
      "Compensation des effets de la progression à froid et taux d'intérêt pour l'impôt fédéral direct pour l'année fiscale 2026",
    url: 'https://www.estv.admin.ch/dam/fr/sd-web/vFK3ntWLQ4s4/2-215-D-2025-f.pdf',
    pdf: true,
  },
  'ch-2025-ifd-frais-professionnels-progression': {
    title:
      "Frais professionnels forfaitaires et revenus en nature 2025 / Compensation des effets de la progression à froid en matière d'impôt fédéral direct pour l'année fiscale 2025",
    url: 'https://www.estv.admin.ch/dam/fr/sd-web/zkUbFt0fCQiy/dbst-rs-2-210-d-2024-fr.pdf',
    pdf: true,
  },
  'ch-2026-ifd-instructions-personnes-physiques': {
    title: '2a - Instruction concernant la déclaration des personnes physiques (Formulaire 2)',
    url: 'https://www.estv.admin.ch/dam/fr/sd-web/oQ0wWcDmCJTS/2a-2026-fr.pdf',
    pdf: true,
  },
  'ch-2025-oiis-dff-annexe': {
    title:
      "Ordonnance 1 du DFF relative à l'imputation d'impôts étrangers prélevés à la source, RS 672.201.1, avec son annexe (liste des États contractants)",
    url: 'https://fedlex.data.admin.ch/filestore/fedlex.data.admin.ch/eli/cc/2020/29/20260201/fr/pdf-a/fedlex-data-admin-ch-eli-cc-2020-29-20260201-fr-pdf-a.pdf',
    pdf: true,
  },
  'ch-na-circulaire-30-epoux-famille': {
    title:
      'Circulaire n° 30 du 21 décembre 2010: Imposition des époux et de la famille selon la loi fédérale sur l’impôt fédéral direct (LIFD)',
    url: 'https://www.estv.admin.ch/dam/fr/sd-web/2YuHXYYJMbn9/dbst-ks-2010-1-030-d-fr.pdf',
    pdf: true,
  },
  'ch-na-law-lia': {
    title: "Loi fédérale sur l'impôt anticipé (LIA), RS 642.21",
    url: 'https://fedlex.data.admin.ch/filestore/fedlex.data.admin.ch/eli/cc/1966/371_385_384/20250101/fr/pdf-a/fedlex-data-admin-ch-eli-cc-1966-371_385_384-20250101-fr-pdf-a.pdf',
    pdf: true,
  },
  'ch-na-law-lifd': {
    title: "Loi fédérale sur l'impôt fédéral direct (LIFD), RS 642.11",
    url: 'https://www.fedlex.admin.ch/filestore/fedlex.data.admin.ch/eli/cc/1991/1184_1184_1184/20260101/fr/pdf-a/fedlex-data-admin-ch-eli-cc-1991-1184_1184_1184-20260101-fr-pdf-a.pdf',
    pdf: true,
  },
  'ch-na-law-lpp': {
    title:
      'Loi fédérale sur la prévoyance professionnelle vieillesse, survivants et invalidité (LPP), RS 831.40',
    url: 'https://www.fedlex.admin.ch/filestore/fedlex.data.admin.ch/eli/cc/1983/797_797_797/20250101/fr/pdf-a/fedlex-data-admin-ch-eli-cc-1983-797_797_797-20250101-fr-pdf-a-7.pdf',
    pdf: true,
  },
  'ch-na-law-opp3': {
    title:
      'Ordonnance sur les déductions admises fiscalement pour les cotisations versées à des formes reconnues de prévoyance (OPP 3), RS 831.461.3',
    url: 'https://www.fedlex.admin.ch/filestore/fedlex.data.admin.ch/eli/cc/1985/1778_1778_1778/20250101/fr/pdf-a/fedlex-data-admin-ch-eli-cc-1985-1778_1778_1778-20250101-fr-pdf-a-1.pdf',
    pdf: true,
  },
  'ch-na-oiis': {
    title:
      "Ordonnance relative à l'imputation d'impôts étrangers prélevés à la source (OIIS), RS 672.201",
    url: 'https://fedlex.data.admin.ch/filestore/fedlex.data.admin.ch/eli/cc/1967/1129_1169_1163/20240101/fr/pdf-a/fedlex-data-admin-ch-eli-cc-1967-1129_1169_1163-20240101-fr-pdf-a.pdf',
    pdf: true,
  },
  'ch-na-ifd-chiffres-reperes-3a': {
    title: 'Chiffres repères dans la prévoyance professionnelle',
    url: 'https://www.bsv.admin.ch/dam/bsv/fr/dokumente/bv/anleitungen/masszahlen-2025-2026.pdf.download.pdf/masszahlen-2025-2026.pdf',
    pdf: true,
  },
  'ch-na-remboursement-impot-anticipe': {
    title: "Remboursement de l'impôt anticipé",
    url: 'https://www.estv.admin.ch/fr/remboursement-impot-anticipe',
    pdf: false,
  },
  'ch-2026-is-baremes-impot-source': {
    title: "Barèmes 2026 de l'impôt à la source",
    url: 'https://www.estv.admin.ch/dam/fr/sd-web/mljRXo4VcR0p/2-216-D-2025-f.pdf',
    pdf: true,
  },
  'ch-2026-is-bases-de-calcul': {
    title:
      "Aperçu des bases de calcul pour les barèmes fédéraux de l'impôt à la source pour l'année fiscale 2026",
    url: 'https://www.estv.admin.ch/dam/fr/sd-web/nuQbhdzXDPm0/qst-berechnungsgrundlagen-2026-fr.pdf',
    pdf: true,
  },
  'ch-na-is-faq-circulaire-45': {
    title: 'FAQ 2022 - Circulaire n° 45 AFC, impôt à la source',
    url: 'https://www.estv.admin.ch/dam/estv/fr/dokumente/dbst/kreisschreiben/dbst-ks-2022-1-045-d-faq-fr.pdf.download.pdf/dbst-ks-2022-1-045-d-faq-fr.pdf',
    pdf: true,
  },
  'ch-na-is-recordformat-salaires': {
    title:
      "Structure et formats d'enregistrement des barèmes de l'impôt à la source pour l'importation dans les systèmes de comptabilité salariale (dès 2025)",
    url: 'https://www.estv.admin.ch/dam/fr/sd-web/AvojuyFCZY95/qst-tarife-recordformate-loehne-2025-fr.pdf',
    pdf: true,
  },
  'ch-2026-ifd-tarif-personnes-physiques': {
    title: "Form. 58c - Taux d'imposition impôt fédéral direct personnes physiques 2026",
    url: 'https://www.estv.admin.ch/dam/fr/sd-web/gnde9CmEsalK/dbst-tairfe-58c-2026-dfi.pdf',
    pdf: true,
  },
  'ch-2025-ifd-tarif-personnes-physiques': {
    title: "Form. 58c - Taux d'imposition impôt fédéral direct personnes physiques 2025",
    url: 'https://www.estv.admin.ch/dam/fr/sd-web/ZbaRlMm2u6u2/dbst-tarife-58c-2025-fr.pdf',
    pdf: true,
  },
  'ch-2027-ifd-progression-deductions': {
    title:
      "Compensation des effets de la progression à froid et taux d'intérêt pour l'impôt fédéral direct pour l'année fiscale 2027",
    url: 'https://www.estv.admin.ch/dam/fr/sd-web/sqbIsYvx0tZg/2-220-D-2026-fr.pdf',
    pdf: true,
  },
  'ch-na-cryptoactifs-document-de-travail': {
    title:
      "Document de travail - Les cryptomonnaies et les initial coin/token offerings (ICO/ITO) comme objet de l'impôt sur la fortune, le revenu et le bénéfice, l'impôt anticipé et les droits de timbre",
    url: 'https://www.estv.admin.ch/dam/fr/sd-web/HgzNhzz7q7YD/dbst-arbeitspapier-kryptowaehrungen-fr.pdf',
    pdf: true,
  },
  'ch-na-formulaires-impot-federal-direct': {
    title: 'Formulaires et instructions impôt fédéral direct',
    url: 'https://www.estv.admin.ch/fr/formulaires-et-instructions-impot-federal-direct',
    pdf: false,
  },
  'ch-na-listes-des-cours-ictax': {
    title: "Listes des cours pour l'évaluation des titres et des devises (ICTax)",
    url: 'https://www.estv.admin.ch/fr/listes-des-cours-ictax',
    pdf: false,
  },
  'ch-na-simulateur-fiscal': {
    title: 'Simulateur fiscal : Calculez et comparez les impôts',
    url: 'https://www.estv.admin.ch/fr/simulateur-fiscal-calculer-vos-impots',
    pdf: false,
  },
  'std-lohnausweis-wegleitung-2026-fr': {
    title:
      "Guide d'établissement du certificat de salaire resp. de l'attestation de rentes (Formulaire 11)",
    url: 'https://www.estv.admin.ch/dam/fr/sd-web/afP1GDFr8gE3/dbst-form-lohna-wegleitung-2026-fr.pdf',
    pdf: true,
  },
};

/** One document a source string cites, with where in it and a link that opens there. */
export interface OfficialLink {
  /** Manifest id, e.g. ge-2025-guide-declaration-pp. */
  id: string;
  /** Where in it, as cited: "p. 11, p. 29 (52.21)", "art. 31 let. c". */
  where: string;
  title?: string;
  /** The official URL; at the page cited for a PDF (the last "p. N" of the citation). */
  url?: string;
}

/**
 * The documents a source string cites ("id p. 5; other-id art. 3"), each with its official link.
 * An id that is not in the list keeps no link (never a guessed one).
 */
/** The links of a citation; `more`: another canton's documents (docs/design/cantons.md). */
export function officialLinks(
  source: string,
  more: Readonly<Record<string, OfficialDocument>> = {},
): OfficialLink[] {
  const out: OfficialLink[] = [];
  for (const part of source.split(';')) {
    const text = part.trim();
    if (!text) continue;
    const [id = '', ...rest] = text.split(' ');
    const where = rest.join(' ');
    const doc = OFFICIAL_DOCUMENTS[id] ?? more[id];
    const page = [...where.matchAll(/\bp\. (\d+)/g)].at(-1)?.[1];
    const url = doc ? (doc.pdf && page ? `${doc.url}#page=${page}` : doc.url) : undefined;
    const link: OfficialLink = {
      id,
      where,
      ...(doc ? { title: doc.title } : {}),
      ...(url ? { url } : {}),
    };
    if (!out.some((l) => l.id === link.id && l.where === link.where)) out.push(link);
  }
  return out;
}
