// The official Basel-Landschaft documents Taxpresso cites (SPEC.md 7b), with the URL of each as
// listed in docs/sources/bl/manifest.json. Data only: the extension never opens these links itself
// (C2); the user's browser does, when they click one. A test keeps every entry equal to the manifest
// (test/sources.test.ts).
import type { OfficialDocument } from '@taxpresso/rules-ch';

export type { OfficialDocument } from '@taxpresso/rules-ch';

export const BL_OFFICIAL_DOCUMENTS: Readonly<Record<string, OfficialDocument>> = {
  'bl-2025-berufsauslagen': {
    title: 'Berufsauslagen 2025',
    url: 'https://bl-api.webcloud7.ch/politik-und-behorden/direktionen/finanz-und-kirchendirektion/steuerverwaltung/onlineformulare-merkblaetter-formulare-wegleitungen/unselbstaendig-erwerbende-2025/berufsauslagen-2025_int_459_2025jn_240816.pdf',
    pdf: true,
  },
  'bl-2025-gemeindesteuerfuesse': {
    title: 'Steuerfüsse und Steuersätze der Einwohner- und Kirchgemeinden 2022 bis 2026',
    url: 'https://statistik.bl.ch/web_portal/18_4',
    pdf: false,
  },
  'bl-2025-informationen-neuerungen': {
    title: '2025 Informationen und Neuerungen',
    url: 'https://bl-api.webcloud7.ch/politik-und-behorden/direktionen/finanz-und-kirchendirektion/steuerverwaltung/onlineformulare-merkblaetter-formulare-wegleitungen/unselbstaendig-erwerbende-2025/informationen-und-neuerungen-2025_int_456_2025_240924.pdf',
    pdf: true,
  },
  'bl-2025-informationen-steuererklaerung-web': {
    title: 'Informationen zur Steuererklärung 2025 (neu)',
    url: 'https://www.baselland.ch/politik-und-behorden/direktionen/finanz-und-kirchendirektion/steuerverwaltung/aktuelles-aus-der-steuerverwaltung/informationen-zur-steuererklaerung-2025-neu',
    pdf: false,
  },
  'bl-2025-krankheitskosten': {
    title: 'Angaben zum Abzug von Krankheits-, Unfall- und behinderungsbedingten Kosten 2025',
    url: 'https://bl-api.webcloud7.ch/politik-und-behorden/direktionen/finanz-und-kirchendirektion/steuerverwaltung/onlineformulare-merkblaetter-formulare-wegleitungen/unselbstaendig-erwerbende-2025/krankheits-unfall-und-behinderungsbedingte-kosten-2025_int_460_210630_210809.pdf',
    pdf: true,
  },
  'bl-2025-law-verordnung-331-11': {
    title: 'Verordnung zum Steuergesetz, SGS 331.11 (Stand 1. Januar 2025)',
    url: 'https://bl.clex.ch/api/de/versions/4099/pdf_file',
    pdf: true,
  },
  'bl-2025-liegenschaften': {
    title: 'Wohn- und Geschäftsliegenschaften 2025',
    url: 'https://bl-api.webcloud7.ch/politik-und-behorden/direktionen/finanz-und-kirchendirektion/steuerverwaltung/onlineformulare-merkblaetter-formulare-wegleitungen/unselbstaendig-erwerbende-2025/wohn-und-geschaeftsliegenschaften-2025_int_462_220630_221026_ausfuellbar.pdf',
    pdf: true,
  },
  'bl-2025-source-tax-tarif-an': {
    title: 'Quellensteuer Tarif 2025, Tarif AN (Alleinstehende, ohne Kirchensteuer)',
    url: 'https://bl-api.webcloud7.ch/politik-und-behorden/direktionen/finanz-und-kirchendirektion/steuerverwaltung/quellensteuer/quellensteuer-dokumente-faq-und-weitere/bl_quellensteuer_2025_tarif_alleinstehende-ohne-k_an_s_31-41.pdf',
    pdf: true,
  },
  'bl-2025-source-tax-tarif-ay': {
    title: 'Quellensteuer Tarif 2025, Tarif AY (Alleinstehende, mit Kirchensteuer)',
    url: 'https://bl-api.webcloud7.ch/politik-und-behorden/direktionen/finanz-und-kirchendirektion/steuerverwaltung/quellensteuer/quellensteuer-dokumente-faq-und-weitere/bl_quellensteuer_2025_tarif_alleinstehende-mit-k_ay_s_42-52.pdf',
    pdf: true,
  },
  'bl-2025-source-tax-tarif-bn': {
    title: 'Quellensteuer Tarif 2025, Tarif BN (Verheiratete, ein Einkommen, ohne Kirchensteuer)',
    url: 'https://bl-api.webcloud7.ch/politik-und-behorden/direktionen/finanz-und-kirchendirektion/steuerverwaltung/quellensteuer/quellensteuer-dokumente-faq-und-weitere/bl_quellensteuer_2025_tarif_ungetrennte-ehe-ohne-k_bn_s_53-63.pdf',
    pdf: true,
  },
  'bl-2025-source-tax-tarif-by': {
    title: 'Quellensteuer Tarif 2025, Tarif BY (Verheiratete, ein Einkommen, mit Kirchensteuer)',
    url: 'https://bl-api.webcloud7.ch/politik-und-behorden/direktionen/finanz-und-kirchendirektion/steuerverwaltung/quellensteuer/quellensteuer-dokumente-faq-und-weitere/bl_quellensteuer_2025_tarif_ungetrennte-ehe-mit-k_by_s_64-74.pdf',
    pdf: true,
  },
  'bl-2025-source-tax-tarif-cn': {
    title: 'Quellensteuer Tarif 2025, Tarif CN (Verheiratete, zwei Einkommen, ohne Kirchensteuer)',
    url: 'https://bl-api.webcloud7.ch/politik-und-behorden/direktionen/finanz-und-kirchendirektion/steuerverwaltung/quellensteuer/quellensteuer-dokumente-faq-und-weitere/bl_quellensteuer_2025_tarif_ungetrennte-ehe-beide-ohne-k_cn_s_75-85.pdf',
    pdf: true,
  },
  'bl-2025-source-tax-tarif-cy': {
    title: 'Quellensteuer Tarif 2025, Tarif CY (Verheiratete, zwei Einkommen, mit Kirchensteuer)',
    url: 'https://bl-api.webcloud7.ch/politik-und-behorden/direktionen/finanz-und-kirchendirektion/steuerverwaltung/quellensteuer/quellensteuer-dokumente-faq-und-weitere/bl_quellensteuer_2025_tarif_ungetrennte-ehe-beide-mit-k_cy_s_86-96.pdf',
    pdf: true,
  },
  'bl-2025-source-tax-tarif-g': {
    title: 'Quellensteuer Tarif 2025, G-Tarif (Ersatzeinkünfte, nicht über Arbeitgeber ausbezahlt)',
    url: 'https://bl-api.webcloud7.ch/politik-und-behorden/direktionen/finanz-und-kirchendirektion/steuerverwaltung/quellensteuer/quellensteuer-dokumente-faq-und-weitere/bl_quellensteuer_2025_ersatzeinkuenfte-g-tarif_s_97-107.pdf',
    pdf: true,
  },
  'bl-2025-source-tax-tarif-hn': {
    title: 'Quellensteuer Tarif 2025, Tarif HN (Alleinstehende mit Kindern, ohne Kirchensteuer)',
    url: 'https://bl-api.webcloud7.ch/politik-und-behorden/direktionen/finanz-und-kirchendirektion/steuerverwaltung/quellensteuer/quellensteuer-dokumente-faq-und-weitere/bl_quellensteuer_2025_tarif_alleinstehende-mit-ki_ohne-k_hn_s_108-118.pdf',
    pdf: true,
  },
  'bl-2025-source-tax-tarif-hy': {
    title: 'Quellensteuer Tarif 2025, Tarif HY (Alleinstehende mit Kindern, mit Kirchensteuer)',
    url: 'https://bl-api.webcloud7.ch/politik-und-behorden/direktionen/finanz-und-kirchendirektion/steuerverwaltung/quellensteuer/quellensteuer-dokumente-faq-und-weitere/bl_quellensteuer_2025_tarif_alleinstehende-mit-ki_mit-k_hy_s_119-129.pdf',
    pdf: true,
  },
  'bl-2025-source-tax-tarif-kapital-ledige': {
    title:
      'Quellensteuer Tarif 2025, Quellensteuer auf Kapitalleistungen aus Vorsorge, Tarif für Ledige',
    url: 'https://bl-api.webcloud7.ch/politik-und-behorden/direktionen/finanz-und-kirchendirektion/steuerverwaltung/quellensteuer/quellensteuer-dokumente-faq-und-weitere/bl_quellensteuer_2025_kapitalleistungstarif_ledige_s_130-131.pdf',
    pdf: true,
  },
  'bl-2025-source-tax-tarif-kapital-verheiratete': {
    title:
      'Quellensteuer Tarif 2025, Quellensteuer auf Kapitalleistungen aus Vorsorge, Tarif für Verheiratete',
    url: 'https://bl-api.webcloud7.ch/politik-und-behorden/direktionen/finanz-und-kirchendirektion/steuerverwaltung/quellensteuer/quellensteuer-dokumente-faq-und-weitere/bl_quellensteuer_2025_kapitalleistungstarif_verh_s_132-133.pdf',
    pdf: true,
  },
  'bl-2025-source-tax-wegleitung': {
    title: 'Quellensteuer für ausländische Arbeitnehmer/innen gültig ab 1. Januar 2025, Wegleitung',
    url: 'https://bl-api.webcloud7.ch/politik-und-behorden/direktionen/finanz-und-kirchendirektion/steuerverwaltung/quellensteuer/quellensteuer-dokumente-faq-und-weitere/bl_quellensteuer_2025_wegleitung_gesamt.pdf',
    pdf: true,
  },
  'bl-2025-steuererklaerung-form': {
    title: 'Steuererklärung für natürliche Personen 2025',
    url: 'https://bl-api.webcloud7.ch/politik-und-behorden/direktionen/finanz-und-kirchendirektion/steuerverwaltung/onlineformulare-merkblaetter-formulare-wegleitungen/unselbstaendig-erwerbende-2025/steuererklaerung-fuer-natuerliche-personen-2025_int_2_2025_240816.pdf',
    pdf: true,
  },
  'bl-2025-tariff-staatssteuer': {
    title: 'Tarife für die Staatssteuer, gültig ab 2025',
    url: 'https://bl-api.webcloud7.ch/politik-und-behorden/direktionen/finanz-und-kirchendirektion/steuerverwaltung/steuerzahlungen/tarife-1/tarife-pdf/tarife-staatssteuer-2025.pdf',
    pdf: true,
  },
  'bl-2025-tariff-tariftabelle': {
    title: 'Tabelle 2025 Einheitstarif (Tariftabelle 2025)',
    url: 'https://bl-api.webcloud7.ch/politik-und-behorden/direktionen/finanz-und-kirchendirektion/steuerverwaltung/steuerzahlungen/tarife-1/tarife-pdf/tariftabelle-2025.xls',
    pdf: false,
  },
  'bl-2025-wegleitung': {
    title: 'Wegleitung zur Steuererklärung für natürliche Personen 2025',
    url: 'https://bl-api.webcloud7.ch/politik-und-behorden/direktionen/finanz-und-kirchendirektion/steuerverwaltung/onlineformulare-merkblaetter-formulare-wegleitungen/unselbstaendig-erwerbende-2025/wegleitung-zur-steuererklaerung-2025_int_2_w_2025_241024_stv.pdf',
    pdf: true,
  },
  'bl-2025-wertschriften-guthaben': {
    title: 'Wertschriften- und Guthabenverzeichnis 2025',
    url: 'https://bl-api.webcloud7.ch/politik-und-behorden/direktionen/finanz-und-kirchendirektion/steuerverwaltung/onlineformulare-merkblaetter-formulare-wegleitungen/unselbstaendig-erwerbende-2025/wertschriften-und-guthabenverzeichnis-2025_int_13_2025_240816.pdf',
    pdf: true,
  },
  'bl-2026-communal-steuerfuesse': {
    title: 'Steuerfüsse und Steuersätze der Einwohner- und Kirchgemeinden 2022 bis 2026 (Export)',
    url: 'https://statistik.bl.ch/web_portal/export/20069',
    pdf: false,
  },
  'bl-2026-deductions-berufsauslagen': {
    title: 'Berufsauslagen 2026',
    url: 'https://bl-api.webcloud7.ch/politik-und-behorden/direktionen/finanz-und-kirchendirektion/steuerverwaltung/onlineformulare-merkblaetter-formulare-wegleitungen/unselbstaendigerwerbende-2026/berufsauslagen-2026_int_459_2026jn_260316.pdf',
    pdf: true,
  },
  'bl-2026-guide-informationen-neuerungen': {
    title: 'Informationen und Neuerungen 2026',
    url: 'https://bl-api.webcloud7.ch/politik-und-behorden/direktionen/finanz-und-kirchendirektion/steuerverwaltung/onlineformulare-merkblaetter-formulare-wegleitungen/unselbstaendigerwerbende-2026/informationen-und-neuerungen-2026_int_456_2026_260316.pdf',
    pdf: true,
  },
  'bl-2026-law-verordnung-331-11': {
    title: 'Verordnung zum Steuergesetz, SGS 331.11 (Stand 1. Januar 2026)',
    url: 'https://bl.clex.ch/api/de/versions/4372/pdf_file',
    pdf: true,
  },
  'bl-2026-source-tax-wegleitung-tarife': {
    title:
      'Quellensteuer für ausländische Arbeitnehmer/innen gültig ab 1. Januar 2026, Wegleitung und Tarife (Ausgabe 2026)',
    url: 'https://bl-api.webcloud7.ch/politik-und-behorden/direktionen/finanz-und-kirchendirektion/steuerverwaltung/quellensteuer/quellensteuer-dokumente-faq-und-weitere/2026_bl_quellensteuer_2026_gesamt-pdf.pdf',
    pdf: true,
  },
  'bl-2026-steuererklaerung-form': {
    title: 'Steuererklärung für natürliche Personen 2026',
    url: 'https://bl-api.webcloud7.ch/politik-und-behorden/direktionen/finanz-und-kirchendirektion/steuerverwaltung/onlineformulare-merkblaetter-formulare-wegleitungen/unselbstaendigerwerbende-2026/steuererklaerung-fuer-natuerliche-personen-2026_int_2_2026_260320.pdf',
    pdf: true,
  },
  'bl-2026-tariff-staatssteuer': {
    title: 'Tarife für die Staatssteuer, gültig ab 2026',
    url: 'https://bl-api.webcloud7.ch/politik-und-behorden/direktionen/finanz-und-kirchendirektion/steuerverwaltung/steuerzahlungen/tarife-1/tarife-pdf/staatssteuer_2026_int_457_2026jn_251212.pdf',
    pdf: true,
  },
  'bl-2026-tariff-tariftabelle': {
    title: 'Tabelle 2026 Einheitstarif (Tariftabelle 2026)',
    url: 'https://bl-api.webcloud7.ch/politik-und-behorden/direktionen/finanz-und-kirchendirektion/steuerverwaltung/steuerzahlungen/tarife-1/tarife-pdf/tariftabelle-2026.xls',
    pdf: false,
  },
  'bl-2026-wegleitung': {
    title: 'Wegleitung zur Steuererklärung 2026 für natürliche Personen',
    url: 'https://bl-api.webcloud7.ch/politik-und-behorden/direktionen/finanz-und-kirchendirektion/steuerverwaltung/onlineformulare-merkblaetter-formulare-wegleitungen/unselbstaendigerwerbende-2026/wegleitung-zur-steuererklaerung-2026_int_2_w_2026_260320.pdf',
    pdf: true,
  },
  'bl-na-dekret-331-1': {
    title: 'Dekret zum Steuergesetz, SGS 331.1',
    url: 'https://bl.clex.ch/api/de/versions/488/pdf_file',
    pdf: true,
  },
  'bl-na-e-tax-bl': {
    title: 'E-Tax BL',
    url: 'https://www.baselland.ch/politik-und-behorden/direktionen/finanz-und-kirchendirektion/steuerverwaltung/steuererklaerung-natuerliche-personen-und-e-tax-bl/e-tax-bl-1',
    pdf: false,
  },
  'bl-na-e-tax-bl-faq': {
    title: 'FAQ e-Tax BL',
    url: 'https://www.baselland.ch/politik-und-behorden/direktionen/finanz-und-kirchendirektion/steuerverwaltung/faq/e-tax-bl',
    pdf: false,
  },
  'bl-na-efiling-nutzungsbestimmungen': {
    title: 'Nutzungsbestimmungen E-Tax BL vom 12. Januar 2023',
    url: 'https://bl-api.webcloud7.ch/politik-und-behorden/direktionen/finanz-und-kirchendirektion/steuerverwaltung/steuererklaerung-natuerliche-personen-und-e-tax-bl/e-tax-bl-1/nutzungsbestimmungen/e-tax-bl-nutzungsbestimmungen-2023-01-12.pdf',
    pdf: true,
  },
  'bl-na-efiling-verordnung-331-21': {
    title:
      'Verordnung über die elektronische Einreichung der Steuererklärung für natürliche Personen, SGS 331.21',
    url: 'https://bl.clex.ch/api/de/versions/3457/pdf_file',
    pdf: true,
  },
  'bl-na-fristen-termine': {
    title: 'Fristen und Termine (natürliche Personen)',
    url: 'https://www.baselland.ch/politik-und-behorden/direktionen/finanz-und-kirchendirektion/steuerverwaltung/steuererklaerung-natuerliche-personen-und-e-tax-bl/fristen-und-termine',
    pdf: false,
  },
  'bl-na-fristverlaengerung': {
    title: 'Fristverlängerung für Privatpersonen',
    url: 'https://www.baselland.ch/politik-und-behorden/direktionen/finanz-und-kirchendirektion/steuerverwaltung/steuererklaerung-natuerliche-personen-und-e-tax-bl/fristen-und-termine/fristverlaengerung-fuer-privatpersonen',
    pdf: false,
  },
  'bl-na-law-quellensteuer-verordnung-331-16': {
    title: 'Verordnung zur Quellensteuer, SGS 331.16',
    url: 'https://bl.clex.ch/api/de/versions/2802/pdf_file',
    pdf: true,
  },
  'bl-na-law-steuerfussdekret-331-2': {
    title: 'Dekret über den Steuerfuss (Steuerfussdekret BL), SGS 331.2 (Stand 1. Januar 2026)',
    url: 'https://bl.clex.ch/api/de/versions/4401/pdf_file',
    pdf: true,
  },
  'bl-na-nov-antrag': {
    title: 'Antrag auf nachträgliche ordentliche Veranlagung (NOV) für Ansässige',
    url: 'https://bl-api.webcloud7.ch/politik-und-behorden/direktionen/finanz-und-kirchendirektion/steuerverwaltung/quellensteuer/quellensteuer-dokumente-faq-und-weitere/antragsformular_nov_ansaessige_2024.pdf',
    pdf: true,
  },
  'bl-na-other-steuerbuch-band2': {
    title: 'Baselbieter Steuerbuch, Band 2 (Gesamtband)',
    url: 'https://kanton.baselland.ch/finanz-und-kirchendirektion/steuerverwaltung-steuerbuch/downloads-1/steuerbuch_bl_band2.pdf',
    pdf: true,
  },
  'bl-na-quellensteuer-entscheidungsraster': {
    title: 'Entscheidungsraster Tarif BL',
    url: 'https://bl-api.webcloud7.ch/politik-und-behorden/direktionen/finanz-und-kirchendirektion/steuerverwaltung/quellensteuer/quellensteuer-dokumente-faq-und-weitere/entscheidungsraster_tarif_bl.pdf',
    pdf: true,
  },
  'bl-na-quellensteuer-faq': {
    title: 'FAQ Quellensteuer',
    url: 'https://bl-api.webcloud7.ch/politik-und-behorden/direktionen/finanz-und-kirchendirektion/steuerverwaltung/quellensteuer/quellensteuer-dokumente-faq-und-weitere/faq_qst.pdf',
    pdf: true,
  },
  'bl-na-source-tax-neuberechnung-antrag': {
    title: 'Antrag auf Neuberechnung der Quellensteuer (Nr. 931)',
    url: 'https://bl-api.webcloud7.ch/politik-und-behorden/direktionen/finanz-und-kirchendirektion/steuerverwaltung/quellensteuer/quellensteuer-dokumente-faq-und-weitere/antrag-auf-neuberechnung-der-quellensteuer-gueltig-ab-1-1-2021_nr_931.pdf',
    pdf: true,
  },
  'bl-na-steuerarten': {
    title: 'Steuerarten (allgemeine Informationen)',
    url: 'https://www.baselland.ch/politik-und-behorden/direktionen/finanz-und-kirchendirektion/steuerverwaltung/steuerzahlungen/allgemeine-informationen',
    pdf: false,
  },
  'bl-na-steuerbuch': {
    title: 'Baselbieter Steuerbuch, Band 1 (Gesamtband)',
    url: 'https://kanton.baselland.ch/finanz-und-kirchendirektion/steuerverwaltung-steuerbuch/downloads-1/steuerbuch_bl_band1.pdf',
    pdf: true,
  },
  'bl-na-steuergesetz-331': {
    title: 'Gesetz über die Staats- und Gemeindesteuern (Steuergesetz), SGS 331',
    url: 'https://bl.clex.ch/api/de/versions/3502/pdf_file',
    pdf: true,
  },
  'bl-na-tariff-anwendungsregeln': {
    title: 'Anwendungsregeln zum neuen Steuertarif NP, gültig ab STJ 2007',
    url: 'https://bl-api.webcloud7.ch/politik-und-behorden/direktionen/finanz-und-kirchendirektion/steuerverwaltung/steuerzahlungen/tarife-1/tarife-pdf/anwendungsregeln-tarif-np-ab-2007_2022.pdf',
    pdf: true,
  },
};
