// The official Vaud documents Taxpresso cites (SPEC.md 7b), with the URL of each as listed in
// docs/sources/vd/manifest.json. Data only: the extension never opens these links itself (C2); the
// user's browser does, when they click one. A test keeps every entry equal to the manifest
// (test/sources.test.ts).
import type { OfficialDocument } from '@taxpresso/rules-ch';

export type { OfficialDocument } from '@taxpresso/rules-ch';

export const VD_OFFICIAL_DOCUMENTS: Readonly<Record<string, OfficialDocument>> = {
  'vd-2025-annexe-01': {
    title: "Annexe 01, Déclaration d'impôt 2025, Rendements bruts échus en 2025",
    url: 'https://www.vd.ch/fileadmin/user_upload/organisation/dfin/aci/fichiers_pdf/0220_21014_2025.pdf',
    pdf: true,
  },
  'vd-2025-annexe-07': {
    title: "Annexe 07, Déclaration d'impôt 2025, immeubles",
    url: 'https://www.vd.ch/fileadmin/user_upload/organisation/dfin/aci/fichiers_pdf/0320_21028_21028_2025.pdf',
    pdf: true,
  },
  'vd-2025-annexes-02-03': {
    title: "Déclaration d'impôt 2025, Annexe 02 (formule 21018) et Annexe 03 (formule 21019)",
    url: 'https://www.vd.ch/fileadmin/user_upload/organisation/dfin/aci/fichiers_pdf/0330_21018_21019_2025.pdf',
    pdf: true,
  },
  'vd-2025-annexes-04-05': {
    title: "Déclaration d'impôt 2025, Annexes 04 et 05 (formules 21024 et 22025)",
    url: 'https://www.vd.ch/fileadmin/user_upload/organisation/dfin/aci/fichiers_pdf/0240_21024_22025_2025.pdf',
    pdf: true,
  },
  'vd-2025-coefficient-cantonal': {
    title: 'Coefficient cantonal',
    url: 'https://www.vd.ch/etat-droit-finances/impots/formulaires-directives-et-baremes/coefficient-cantonal',
    pdf: false,
  },
  'vd-2025-communal-arretes-imposition': {
    title: "Impôts communaux 2025, arrêtés d'imposition (mis à jour après référendum)",
    url: 'https://www.vd.ch/fileadmin/user_upload/themes/territoire/communes/finances_communales/Arr%C3%AAt%C3%A9s_d_imposition_2025-mis_%C3%A0_jour_apr%C3%A8s_r%C3%A9f%C3%A9rendum.xls',
    pdf: false,
  },
  'vd-2025-deductions': {
    title: 'Tableau des principales déductions vaudoises 2025',
    url: 'https://www.vd.ch/fileadmin/user_upload/organisation/dfin/aci/fichiers_pdf/Tableau_des_d%C3%A9ductions_2025.pdf',
    pdf: true,
  },
  'vd-2025-delais-directive': {
    title: 'Demandes de délais unitaires (personnes physiques) : Directive',
    url: 'https://www.vd.ch/fileadmin/user_upload/organisation/dfin/aci/fichiers_pdf/Directive_D%C3%A9lai_d%C3%A9p%C3%B4t_DI_PP_Demandes_unitaires.pdf',
    pdf: true,
  },
  'vd-2025-form-21010': {
    title: "Déclaration d'impôt 2025, personnes physiques (formule 21010)",
    url: 'https://www.vd.ch/fileadmin/user_upload/organisation/dfin/aci/fichiers_pdf/0210_21010_2025.pdf',
    pdf: true,
  },
  'vd-2025-frontaliers': {
    title:
      "Directive concernant l'imposition des travailleurs frontaliers domiciliés en France et exerçant une activité lucrative dépendante en Suisse auprès d'un employeur vaudois pour l'année 2025",
    url: 'https://www.vd.ch/fileadmin/user_upload/organisation/dfin/aci/fichiers_pdf/Directives_concernant_l_imposition_des_travailleurs_frontaliers.pdf',
    pdf: true,
  },
  'vd-2025-guide': {
    title:
      "Instructions générales sur la manière de remplir la déclaration d'impôt des personnes physiques",
    url: 'https://www.vd.ch/fileadmin/user_upload/organisation/dfin/aci/fichiers_pdf/21001_2025.pdf',
    pdf: true,
  },
  'vd-2025-law-impot-annuel': {
    title: "Loi du 1er octobre 2024 sur l'impôt 2025 (BLV 642.00.011024.1)",
    url: 'https://prestations.vd.ch/pub/blv-publication/api/actes/2253963/pdf?type=PDF_RENDU',
    pdf: true,
  },
  'vd-2025-law-li': {
    title: 'Loi du 4 juillet 2000 sur les impôts directs cantonaux (LI, BLV 642.11), version 2025',
    url: 'https://prestations.vd.ch/pub/blv-publication/api/actes/002eaf00-bebb-4bf2-a811-4f9abd04b89f/pdf?type=PDF_RENDU',
    pdf: true,
  },
  'vd-2025-law-lripp': {
    title:
      "Loi du 10 octobre 2023 sur la réduction de l'impôt cantonal sur le revenu des personnes physiques (LRIPP, BLV 642.12), version 2025",
    url: 'https://prestations.vd.ch/pub/blv-publication/api/actes/77e5659e-4ab5-4829-8946-4d5e3a6467b1/pdf?type=PDF_RENDU',
    pdf: true,
  },
  'vd-2025-source-tax': {
    title: "Barèmes et instructions concernant l'imposition à la source pour l'année 2025",
    url: 'https://www.vd.ch/fileadmin/user_upload/organisation/dfin/aci/fichiers_pdf/21034-10_Employeurs_2025.pdf',
    pdf: true,
  },
  'vd-2025-source-tax-deductions-incluses': {
    title: "Déductions incluses dans les barèmes 2025 de l'impôt à la source",
    url: 'https://www.vd.ch/fileadmin/user_upload/organisation/dfin/aci/fichiers_pdf/Publications_d%C3%A9ductions_bar%C3%A8ms_IS_2025.pdf',
    pdf: true,
  },
  'vd-2025-source-tax-ijk': {
    title:
      'Impôt à la source, tarifs I, J et K (prestations en capital de la prévoyance professionnelle), valable dès le 1er janvier 2025',
    url: 'https://www.vd.ch/fileadmin/user_upload/organisation/dfin/aci/fichiers_pdf/2025_IJK.pdf',
    pdf: true,
  },
  'vd-2025-source-tax-tarif-g': {
    title:
      'Impôt à la source, tarif G (revenus acquis en compensation), valable dès le 1er janvier 2025',
    url: 'https://www.vd.ch/fileadmin/user_upload/organisation/dfin/aci/fichiers_pdf/2025_G.pdf',
    pdf: true,
  },
  'vd-2025-tariff-fortune': {
    title: "Barème de l'impôt sur la fortune 2025",
    url: 'https://www.vd.ch/fileadmin/user_upload/organisation/dfin/aci/fichiers_pdf/bar%C3%A8me_fortune_2025.pdf',
    pdf: true,
  },
  'vd-2025-tariff-revenu': {
    title: "Barème de l'impôt sur le revenu 2025",
    url: 'https://www.vd.ch/fileadmin/user_upload/organisation/dfin/aci/fichiers_pdf/bar%C3%A8me_revenu_2025.pdf',
    pdf: true,
  },
  'vd-2025-vaudtax-general': {
    title: "Remplir ma déclaration d'impôt avec VaudTax",
    url: 'https://www.vd.ch/etat-droit-finances/impots/impots-pour-les-individus/remplir-ma-declaration-dimpot',
    pdf: false,
  },
  'vd-2025-vaudtax-prestation': {
    title:
      "Remplir ma déclaration d'impôt 2025 avec la prestation VaudTax pour les individus (personnes physiques)",
    url: 'https://www.vd.ch/prestation/remplir-ma-declaration-dimpot-2025-avec-la-prestation-vaudtax-pour-les-individus-personnes-physiques',
    pdf: false,
  },
  'vd-2026-communal-arretes-imposition': {
    title: "Taux d'impôt 2026, arrêtés d'imposition des communes vaudoises",
    url: 'https://www.vd.ch/fileadmin/user_upload/themes/territoire/communes/finances_communales/fichiers_xls/Arr%C3%AAt%C3%A9s_d_imposition_2026.xls',
    pdf: false,
  },
  'vd-2026-deductions': {
    title: 'Tableau des principales déductions vaudoises 2026',
    url: 'https://www.vd.ch/fileadmin/user_upload/organisation/dfin/aci/fichiers_pdf/Tableau_des_d%C3%A9ductions_2026.pdf',
    pdf: true,
  },
  'vd-2026-law-impot-annuel': {
    title: "Loi du 1er octobre 2024 sur l'impôt 2026 (BLV 642.00.011024.2)",
    url: 'https://prestations.vd.ch/pub/blv-publication/api/actes/2253990/pdf?type=PDF_RENDU',
    pdf: true,
  },
  'vd-2026-law-li': {
    title:
      'Loi du 4 juillet 2000 sur les impôts directs cantonaux (LI, BLV 642.11), version en vigueur dès le 1er mai 2026',
    url: 'https://prestations.vd.ch/pub/blv-publication/api/actes/47ac13a4-78a9-4327-ae95-c6adce9124a7/pdf?type=PDF_RENDU',
    pdf: true,
  },
  'vd-2026-law-lripp': {
    title:
      "Loi du 10 octobre 2023 sur la réduction de l'impôt cantonal sur le revenu des personnes physiques (LRIPP, BLV 642.12), version 2026",
    url: 'https://prestations.vd.ch/pub/blv-publication/api/actes/91623681-55fd-42c7-b37c-16e7fe3ef402/pdf?type=PDF_RENDU',
    pdf: true,
  },
  'vd-2026-law-ris': {
    title:
      "Règlement du 9 décembre 2020 sur l'imposition à la source (RIS, BLV 641.11.1), version 2026",
    url: 'https://prestations.vd.ch/pub/blv-publication/api/actes/0fb0ca28-b0f4-40db-b178-de8719767ef5/pdf?type=PDF_RENDU',
    pdf: true,
  },
  'vd-2026-source-tax': {
    title: "Barèmes et instructions concernant l'imposition à la source pour l'année 2026",
    url: 'https://www.vd.ch/fileadmin/user_upload/organisation/dfin/aci/fichiers_pdf/21034-10_Employeurs_2026.pdf',
    pdf: true,
  },
  'vd-2026-source-tax-deductions-incluses': {
    title: "Déductions incluses dans les barèmes 2026 de l'impôt à la source",
    url: 'https://www.vd.ch/fileadmin/user_upload/organisation/dfin/aci/fichiers_pdf/Publications_d%C3%A9ductions_bar%C3%A8ms_IS_2026.pdf',
    pdf: true,
  },
  'vd-2026-source-tax-ijk': {
    title:
      'Impôt à la source, tarifs I, J et K (prestations en capital de la prévoyance professionnelle), valable dès le 1er janvier 2026',
    url: 'https://www.vd.ch/fileadmin/user_upload/organisation/dfin/aci/fichiers_pdf/2026_IJK.pdf',
    pdf: true,
  },
  'vd-2026-source-tax-tarif-g': {
    title:
      'Impôt à la source, tarif G (revenus acquis en compensation), valable dès le 1er janvier 2026',
    url: 'https://www.vd.ch/fileadmin/user_upload/organisation/dfin/aci/fichiers_pdf/2026_G.pdf',
    pdf: true,
  },
  'vd-2026-tariff-fortune': {
    title: "Barème de l'impôt sur la fortune 2026",
    url: 'https://www.vd.ch/fileadmin/user_upload/organisation/dfin/aci/fichiers_pdf/Bar%C3%A8mes_Fortune_2026.pdf',
    pdf: true,
  },
  'vd-2026-tariff-revenu': {
    title: "Barème de l'impôt sur le revenu 2026",
    url: 'https://www.vd.ch/fileadmin/user_upload/organisation/dfin/aci/fichiers_pdf/Bar%C3%A8mes_Revenu_2026.pdf',
    pdf: true,
  },
  'vd-na-arretes-imposition': {
    title: "Arrêtés d'imposition",
    url: 'https://publication.vd.ch/publications/dgaic/aide-memoire/finances-communales/arretes-dimposition',
    pdf: false,
  },
  'vd-na-communal-rates': {
    title: 'Finances communales',
    url: 'https://www.vd.ch/etat-droit-finances/statistique/statistiques-par-domaine/18-finances-publiques-et-administration/finances-communales',
    pdf: false,
  },
  'vd-na-directive-frais-maladie': {
    title:
      "Directive sur la déductibilité des frais de maladie et d'accident et des frais liés à un handicap dès la période fiscale 2005",
    url: 'https://www.vd.ch/fileadmin/user_upload/organisation/dfin/aci/fichiers_pdf/Directive_ACI_FM-LHand.pdf',
    pdf: true,
  },
  'vd-na-law-licom': {
    title: 'Loi du 5 décembre 1956 sur les impôts communaux (LICom, BLV 650.11)',
    url: 'https://prestations.vd.ch/pub/blv-publication/api/actes/0848120c-c688-409b-9bf7-fe174efd0bfc/pdf?type=PDF_RENDU',
    pdf: true,
  },
  'vd-na-law-rdve': {
    title:
      "Règlement du 14 décembre 2016 sur le dépôt de la déclaration d'impôt des personnes physiques et des personnes morales, en particulier par voie électronique (RDVE, BLV 642.11.9.7)",
    url: 'https://prestations.vd.ch/pub/blv-publication/api/actes/42a955c1-f170-495d-badc-8d2881e476f5/pdf?type=PDF_RENDU',
    pdf: true,
  },
  'vd-na-law-rifam': {
    title: 'Règlement du 6 avril 2011 sur l’imposition de la famille (RIFam, BLV 642.11.3)',
    url: 'https://prestations.vd.ch/pub/blv-publication/api/actes/e3bdeafc-c047-494d-b959-11a2eba919ec/pdf?type=PDF_RENDU',
    pdf: true,
  },
  'vd-na-software-notice': {
    title:
      "Notice relative à l'établissement de la déclaration d'impôt et de la demande de modification d'acomptes à l'aide d'un outil informatique",
    url: 'https://www.vd.ch/fileadmin/user_upload/organisation/dfin/aci/fichiers_pdf/Notice_relative_etablissement_declaration_impot_PC.pdf',
    pdf: true,
  },
  'vd-na-tou-request': {
    title: 'Demande de taxation ordinaire ultérieure (TOU)',
    url: 'https://www.vd.ch/fileadmin/user_upload/organisation/dfin/aci/fichiers_pdf/21049_TOU_Formulaire_WEB.pdf',
    pdf: true,
  },
};
