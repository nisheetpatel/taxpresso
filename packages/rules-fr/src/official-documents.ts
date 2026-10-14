// The official Fribourg documents Taxpresso cites (SPEC.md 7b), with the URL of each as listed in
// docs/sources/fr/manifest.json. Data only: the extension never opens these links itself (C2); the
// user’s browser does, when they click one. A test keeps every entry equal to the manifest
// (test/sources.test.ts).
import type { OfficialDocument } from '@taxpresso/rules-ch';

export type { OfficialDocument } from '@taxpresso/rules-ch';

export const FR_OFFICIAL_DOCUMENTS: Readonly<Record<string, OfficialDocument>> = {
  'fr-2024-instructions-employeurs-source': {
    title: 'Instructions « impôt à la source »',
    url: 'https://www.fr.ch/document/517411',
    pdf: true,
  },
  'fr-2024-pis-guide': {
    title:
      'Infos pour les personnes imposées à la source (PIS), spécialement pour les travailleurs',
    url: 'https://www.fr.ch/document/431746',
    pdf: true,
  },
  'fr-2025-autres-baremes-impot-source': {
    title: "Barèmes de l'impôt à la source (autres barèmes dès 2025)",
    url: 'https://www.fr.ch/document/542596',
    pdf: true,
  },
  'fr-2025-bareme-fortune': {
    title: "Barème de l'impôt sur la fortune en vigueur à partir de la période fiscale 2021",
    url: 'https://www.fr.ch/document/434631',
    pdf: true,
  },
  'fr-2025-bareme-impot-source-a': {
    title: 'Barème A 2025, impôt à la source: personnes seules sans enfants à charge',
    url: 'https://www.fr.ch/document/542166',
    pdf: true,
  },
  'fr-2025-bareme-impot-source-b': {
    title: 'Barème B 2025, impôt à la source',
    url: 'https://www.fr.ch/document/542171',
    pdf: true,
  },
  'fr-2025-bareme-impot-source-c': {
    title: 'Barème C 2025, impôt à la source',
    url: 'https://www.fr.ch/document/542176',
    pdf: true,
  },
  'fr-2025-bareme-impot-source-g': {
    title: 'Barème G 2025, impôt à la source: revenus acquis en compensation',
    url: 'https://www.fr.ch/document/542181',
    pdf: true,
  },
  'fr-2025-bareme-impot-source-h': {
    title: 'Barème H 2025, impôt à la source: personnes seules avec enfants à charge',
    url: 'https://www.fr.ch/document/542186',
    pdf: true,
  },
  'fr-2025-bareme-revenu': {
    title:
      "Barème de l'impôt cantonal sur le revenu des personnes physiques valable dès l'année 2023",
    url: 'https://www.fr.ch/document/491766',
    pdf: true,
  },
  'fr-2025-bases-calcul-cantonales': {
    title:
      "Aperçu des bases de calcul pour les barèmes cantonaux de l'impôt à la source (art. 73 LICD), année fiscale 2025",
    url: 'https://www.fr.ch/document/542216',
    pdf: true,
  },
  'fr-2025-communal-coefficients-opendata': {
    title: "Coefficients et taux d'impôts, par commune, dès 2023 (extrait 2025)",
    url: 'https://opendata.fr.ch/api/explore/v2.1/catalog/datasets/18_03_coefficients/exports/csv?select=annee,commune,commune_id,district,coefficients,valeur,unite&refine=annee:2025&delimiter=%3B',
    pdf: false,
  },
  'fr-2025-deductions-enfants-calculette': {
    title:
      "Calcul des déductions sociales pour enfants, valable dès l'année fiscale 2025 (calculette)",
    url: 'https://www.fr.ch/document/520166',
    pdf: false,
  },
  'fr-2025-fritax-accueil': {
    title: 'FriTax',
    url: 'https://www.fr.ch/impots/personnes-physiques/fritax',
    pdf: false,
  },
  'fr-2025-fritax-actualite': {
    title: "FriTax 2025 : votre déclaration d'impôt en ligne",
    url: 'https://www.fr.ch/dfin/scc/actualites/frchfritax-ladresse-pour-faire-sa-declaration-dimpot-en-ligne',
    pdf: false,
  },
  'fr-2025-fritax-faq': {
    title: 'FAQ FriTax',
    url: 'https://www.fr.ch/impots/personnes-physiques/fritax/fritax-faq',
    pdf: false,
  },
  'fr-2025-fritax-telechargement': {
    title: 'Télécharger FriTax',
    url: 'https://www.fr.ch/impots/personnes-physiques/fritax/telecharger-fritax',
    pdf: false,
  },
  'fr-2025-guide-instructions-generales': {
    title: 'Instructions générales concernant la déclaration des personnes physiques 2025',
    url: 'https://www.fr.ch/document/57721',
    pdf: true,
  },
  'fr-2025-law-coefficient-annuel': {
    title:
      'Loi fixant le coefficient annuel des impôts cantonaux directs de la période fiscale 2025 (RSF 631.12)',
    url: 'https://bdlf.fr.ch/api/fr/versions/8110/pdf_file',
    pdf: true,
  },
  'fr-2025-law-licd-consolidee': {
    title:
      'Loi du 6 juin 2000 sur les impôts cantonaux directs (LICD, RSF 631.1), version entrée en vigueur le 01.01.2025',
    url: 'https://bdlf.fr.ch/api/fr/versions/8109/pdf_file',
    pdf: true,
  },
  'fr-2025-parish-coefficients-catholic': {
    title: "Coefficients d'impôt des paroisses catholiques, par commune, état au 1er août 2025",
    url: 'https://www.fr.ch/document/570376',
    pdf: true,
  },
  'fr-2025-parish-coefficients-reformed': {
    title: "Coefficients d'impôt des paroisses réformées, par commune, état au 1er août 2025",
    url: 'https://www.fr.ch/document/570381',
    pdf: true,
  },
  'fr-2025-source-tax-ordonnance': {
    title: "Ordonnance relative à la perception de l'impôt à la source (RSF 631.32), version 2025",
    url: 'https://bdlf.fr.ch/api/fr/versions/8085/pdf_file',
    pdf: true,
  },
  'fr-2025-tou-demande-non-resident': {
    title: 'Demande de taxation ordinaire ultérieure pour non-résident suisse',
    url: 'https://www.fr.ch/document/542591',
    pdf: true,
  },
  'fr-2026-bareme-fortune': {
    title: "Barème de l'impôt sur la fortune en vigueur à partir de la période fiscale 2021",
    url: 'https://www.fr.ch/document/434631',
    pdf: true,
  },
  'fr-2026-bareme-impot-source-a': {
    title: 'Barème A Tarif A',
    url: 'https://www.fr.ch/document/574966',
    pdf: true,
  },
  'fr-2026-bareme-impot-source-b': {
    title: 'Barème B 2026, impôt à la source',
    url: 'https://www.fr.ch/document/574971',
    pdf: true,
  },
  'fr-2026-bareme-impot-source-c': {
    title: 'Barème C 2026, impôt à la source',
    url: 'https://www.fr.ch/document/574976',
    pdf: true,
  },
  'fr-2026-bareme-impot-source-g': {
    title: 'Barème G 2026, impôt à la source: revenus acquis en compensation',
    url: 'https://www.fr.ch/document/574981',
    pdf: true,
  },
  'fr-2026-bareme-impot-source-h': {
    title: 'Barème H 2026, impôt à la source: personnes seules avec enfants à charge',
    url: 'https://www.fr.ch/document/574986',
    pdf: true,
  },
  'fr-2026-bareme-impot-source-page': {
    title: "Barèmes et calculs de l'impôt à la source",
    url: 'https://www.fr.ch/impots/impot-a-la-source/baremes-et-calculs-de-limpot-a-la-source',
    pdf: false,
  },
  'fr-2026-bareme-revenu': {
    title:
      "Barème de l'impôt cantonal sur le revenu des personnes physiques valable dès l'année 2023",
    url: 'https://www.fr.ch/document/491766',
    pdf: true,
  },
  'fr-2026-bases-calcul-cantonales': {
    title:
      "Aperçu des bases de calcul pour les barèmes cantonaux de l'impôt à la source (art. 73 LICD) Année fiscale 2026",
    url: 'https://www.fr.ch/document/574991',
    pdf: true,
  },
  'fr-2026-deductions-enfants-calculette': {
    title:
      "Calcul des déductions sociales pour enfants, valable dès l'année fiscale 2026 (calculette)",
    url: 'https://www.fr.ch/document/583526',
    pdf: false,
  },
  'fr-2026-law-coefficient-annuel': {
    title:
      'Loi fixant le coefficient annuel des impôts cantonaux directs de la période fiscale 2026 (RSF 631.12)',
    url: 'https://bdlf.fr.ch/api/fr/versions/8359/pdf_file',
    pdf: true,
  },
  'fr-2026-parish-coefficients-catholic-opendata': {
    title: "Coefficients d'impôt des paroisses catholiques, par commune (extrait 2026)",
    url: 'https://opendata.fr.ch/api/explore/v2.1/catalog/datasets/18_03_coefficients_impots_catholiques/exports/csv?refine=annee:2026&delimiter=%3B',
    pdf: false,
  },
  'fr-2026-parish-coefficients-reformed-opendata': {
    title: "Coefficients d'impôt des paroisses réformées, par commune (extrait 2026)",
    url: 'https://opendata.fr.ch/api/explore/v2.1/catalog/datasets/18_03_coefficients_impots_reformes/exports/csv?refine=annee:2026&delimiter=%3B',
    pdf: false,
  },
  'fr-2026-source-tax-ordonnance': {
    title: "Ordonnance relative à la perception de l'impôt à la source (RSF 631.32), version 2026",
    url: 'https://bdlf.fr.ch/api/fr/versions/8651/pdf_file',
    pdf: true,
  },
  'fr-na-coefficients-communaux-taux': {
    title: "Coefficients et taux d'impôts communaux",
    url: 'https://www.fr.ch/finances-collectivites',
    pdf: false,
  },
  'fr-na-coefficients-statistiques': {
    title: 'Statistiques financières des collectivités et péréquation',
    url: 'https://www.fr.ch/diaf/scom/statistiques-financieres-des-collectivites-perequation',
    pdf: false,
  },
  'fr-na-coefficients-trouver': {
    title: 'Trouver les coefficients',
    url: 'https://www.fr.ch/impots/personnes-physiques/coefficients-communaux-et-paroisses',
    pdf: false,
  },
  'fr-na-deductions-frais-professionnels': {
    title:
      'Ordonnance DFIN du 14 décembre 2006 sur la déduction des frais professionnels des personnes exerçant une activité lucrative dépendante (RSF 631.411)',
    url: 'https://bdlf.fr.ch/api/fr/versions/7574/pdf_file',
    pdf: true,
  },
  'fr-na-deductions-primes-assurance': {
    title:
      "Ordonnance du 8 septembre 2020 concernant la déduction des primes d'assurance-maladie et accidents (RSF 631.48)",
    url: 'https://bdlf.fr.ch/api/fr/versions/6598/pdf_file',
    pdf: true,
  },
  'fr-na-delais-depot': {
    title: 'Obtenir un délai pour le dépôt de sa déclaration',
    url: 'https://www.fr.ch/impots/personnes-physiques/obtenir-un-delai-pour-le-depot-de-sa-declaration',
    pdf: false,
  },
  'fr-na-efiling-ordonnance-631-15': {
    title:
      'Ordonnance du 10 décembre 2014 concernant le dépôt par voie électronique de la déclaration fiscale des personnes physiques (RSF 631.15)',
    url: 'https://bdlf.fr.ch/api/fr/versions/5292/pdf_file',
    pdf: true,
  },
  'fr-na-fixation-impots-communaux': {
    title: 'Fixation et perception des impôts communaux',
    url: 'https://www.fr.ch/document/549436',
    pdf: true,
  },
  'fr-na-impot-source': {
    title: 'Impôt à la source',
    url: 'https://www.fr.ch/impots/impot-a-la-source',
    pdf: false,
  },
  'fr-na-law-lico': {
    title: 'Loi du 10 mai 1963 sur les impôts communaux (LICo, RSF 632.1)',
    url: 'https://bdlf.fr.ch/api/fr/versions/8653/pdf_file',
    pdf: true,
  },
  'fr-na-licd': {
    title: 'Loi du 6 juin 2000 sur les impôts cantonaux directs (LICD)',
    url: 'https://bdlf.fr.ch/api/fr/versions/4221/pdf_file',
    pdf: true,
  },
  'fr-na-licd-projet-2027': {
    title: 'Loi modifiant la loi sur les impôts cantonaux directs',
    url: 'https://www.fr.ch/document/588431',
    pdf: true,
  },
  'fr-na-ordonnance-impot-source-631-32': {
    title: "Ordonnance relative à la perception de l'impôt à la source",
    url: 'https://bdlf.fr.ch/api/fr/versions/7002/pdf_file',
    pdf: true,
  },
  'fr-na-personnes-physiques': {
    title: 'Personnes physiques',
    url: 'https://www.fr.ch/impots/personnes-physiques',
    pdf: false,
  },
  'fr-na-themes-particuliers': {
    title: 'Impôt des personnes physiques: thèmes particuliers',
    url: 'https://www.fr.ch/impots/personnes-physiques/impot-des-personnes-physiques-themes-particuliers',
    pdf: false,
  },
};
