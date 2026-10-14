// The official Zug documents Taxpresso cites (SPEC.md 7b), with the URL of each as listed in
// docs/sources/zg/manifest.json. Data only: the extension never opens these links itself (C2); the
// user’s browser does, when they click one. A test keeps every entry equal to the manifest
// (test/sources.test.ts).
import type { OfficialDocument } from '@taxpresso/rules-ch';

export type { OfficialDocument } from '@taxpresso/rules-ch';

export const ZG_OFFICIAL_DOCUMENTS: Readonly<Record<string, OfficialDocument>> = {
  'zg-2025-communal-steuerfuesse': {
    title:
      'Steuerfüsse der Gemeinden des Kantons Zug für die Steuerjahre 2022 - 2025 in % der einfachen Steuer (100 %)',
    url: 'https://cdn.zg.ch/dam/jcr:a881ee10-cd3e-4194-ac51-b418aea50329/Steuerfuesse%202025.pdf',
    pdf: true,
  },
  'zg-2025-efiling-news-etax-online': {
    title: 'Steuererklärung 2025 ab Februar 2026 komplett online ausfüllen',
    url: 'https://zg.ch/de/news/2026/January/steuererklaerung-2025-ab-februar-2026-komplett-online-ausfuellen',
    pdf: false,
  },
  'zg-2025-efiling-webinar-fragen-antworten': {
    title: 'Fragen und Antworten aus dem Webinar zum neuen eTax.zug vom 19. März 2026',
    url: 'https://cdn.zg.ch/dam/jcr:780f86fe-cfdf-48cb-8b1e-3b609aba828c/Webinar-Fragen-Antworten-2026.pdf',
    pdf: true,
  },
  'zg-2025-efiling-webinar-praesentation': {
    title: 'Webinar neues eTax.zug vom 19. März 2026',
    url: 'https://cdn.zg.ch/dam/jcr:ce9d105c-06a1-4feb-bfc9-95fa05cb0c38/Webinar-Pr%C3%A4sentation-eTax-2026.pdf',
    pdf: true,
  },
  'zg-2025-form-liegenschaftenverzeichnis-lvz': {
    title: 'Zusammenzug Liegenschaftenverzeichnis (LVZ), Steuererklärung 2025',
    url: 'https://cdn.zg.ch/dam/jcr:65cf69f5-c2a9-4c3b-be38-feba2c8159b6/Formular_LV_25_A4.pdf',
    pdf: true,
  },
  'zg-2025-form-wertschriftenverzeichnis': {
    title:
      'Wertschriften- und Guthabenverzeichnis, Antrag Rückerstattung Verrechnungssteuer (WV), Steuererklärung 2025',
    url: 'https://cdn.zg.ch/dam/jcr:f137a2ab-b924-490c-bb1d-967d55659e0e/Formular_WV_25_A4.pdf',
    pdf: true,
  },
  'zg-2025-guide-en-how-to-fill': {
    title: 'How to Fill in Your Zug Individual Tax Return [2025]',
    url: 'https://cdn.zg.ch/dam/jcr:3cf9b0e6-3706-4446-a7ea-06c943df00c7/TaxReturn-English-2025.pdf',
    pdf: true,
  },
  'zg-2025-guide-wegleitung': {
    title: 'Wegleitung zur Steuererklärung für natürliche Personen 2025',
    url: 'https://cdn.zg.ch/dam/jcr:17c572af-908f-43a5-96b0-0fd25983f924/Wegleitung_2025_StKtZug_A4_20251119.pdf',
    pdf: true,
  },
  'zg-2025-law-steuergesetz': {
    title: 'Steuergesetz (BGS 632.1), Stand 1. Januar 2024',
    url: 'https://bgs.zg.ch/api/de/versions/2510/pdf_file',
    pdf: true,
  },
  'zg-2025-source-tax-tarif-an': {
    title:
      'Quellensteuer für ausländische Arbeitnehmer/Innen, Monatstarif für Alleinstehende (Tarif AN), gültig ab 01.01.2025',
    url: 'https://cdn.zg.ch/dam/jcr:0bd112a5-12b7-4ad1-8998-2049e9239948/AN_2025.pdf',
    pdf: true,
  },
  'zg-2026-communal-steuerfuesse': {
    title:
      'Steuerfüsse der Gemeinden des Kantons Zug für die Steuerjahre 2023 - 2026 in % der einfachen Steuer (100 %)',
    url: 'https://cdn.zg.ch/dam/jcr:24fb8832-3383-4718-9a48-9461bc7501fc/Steuerf%C3%BCsse%202026_effektiv%2021.1.26.pdf',
    pdf: true,
  },
  'zg-2026-deductions-sozialabzuege': {
    title: 'Sozialabzüge Kantonssteuern gültig Steuerperiode 2026 (Sozialabzüge ab 2001 bis 2026)',
    url: 'https://cdn.zg.ch/dam/jcr:736ef31a-f3e3-48f3-ad5d-9870761a47c1/Sozialabz%C3%BCge%20ab%202001-2026.pdf',
    pdf: true,
  },
  'zg-2026-deductions-steuerbuch-berufskosten': {
    title: '16.1 Grundsätzliches und Höhe der Abzüge',
    url: 'https://wissen.zg.ch/steuerbuch/erlaeuterung-zu-a7-25-berufskosten-bei-selbstaendiger-erwerbstaetigkeit/grundsaetzliches-und-hoehe-der-abzuege',
    pdf: false,
  },
  'zg-2026-deductions-steuerbuch-eigenbetreuung': {
    title: '22.8 Eigenbetreuungskostenabzug Steuerperiode (2013 - 2025)',
    url: 'https://wissen.zg.ch/steuerbuch/erlaeuterung-zu-a733-sozialabzuege/fremdbetreuungskostenabzug',
    pdf: false,
  },
  'zg-2026-deductions-steuerbuch-fahrkosten': {
    title: '16.2.1 Grundsätzliches zu Fahrkosten zum Arbeitsort',
    url: 'https://wissen.zg.ch/steuerbuch/erlaeuterung-zu-a7-25-berufskosten-bei-selbstaendiger-erwerbstaetigkeit/fahrkosten-zum-arbeitsort/grundsaetzliches-zu-fahrkosten-zum-arbeitsort',
    pdf: false,
  },
  'zg-2026-deductions-steuerbuch-kinderdrittbetreuung': {
    title: '20.10.1.2 Kantonssteuer (ab Steuerperiode 2024)',
    url: 'https://wissen.zg.ch/steuerbuch/erlaeuterung-zu-a7-30-allgemeine-abzuege-unabhaengig-von-der-einkommenshoehe/kinderdrittbetreuungskosten/allgemeines/kantonssteuer-ab-steuerperiode-2024',
    pdf: false,
  },
  'zg-2026-deductions-steuerbuch-krankheitskosten': {
    title: '21.1 Abzug von Krankheits- und Unfallkosten',
    url: 'https://wissen.zg.ch/steuerbuch/erlaeuterung-zu-a7-31-allgemeine-abzuege-abhaengig-von-der-einkommenshoehe/abzug-von-krankheits-und-unfallkosten',
    pdf: false,
  },
  'zg-2026-law-steuergesetz': {
    title: 'Steuergesetz (BGS 632.1), Stand 1. Januar 2026',
    url: 'https://bgs.zg.ch/api/de/versions/2956/pdf_file',
    pdf: true,
  },
  'zg-2026-other-abstimmung-mehrwert-fuer-alle': {
    title:
      'Kantonale Volksabstimmung vom 30. November 2025: Änderung des Steuergesetzes vom 28. August 2025 «Mehrwert für alle»',
    url: 'https://cdn.zg.ch/dam/jcr:09c43d5c-61d7-4ca1-b825-62f5cba55fba/20251130_Erl%C3%A4uterung%20KA2_%C3%84nderung_Steuergesetz-9_UA.pdf',
    pdf: true,
  },
  'zg-2026-other-news-mehrwert-fuer-alle': {
    title: 'Steuergesetzänderung «Mehrwert für alle» angenommen',
    url: 'https://zg.ch/de/news/2025/November/steuergesetzaenderung-mehrwert-fuer-alle-angenommen',
    pdf: false,
  },
  'zg-2026-source-tax-merkblatt-pauschalabzuege': {
    title:
      'Übersicht über die Grundlagen für die Berechnung der Quellensteuertarife der Bundes-, Kantons- & Gemeindesteuer',
    url: 'https://cdn.zg.ch/dam/jcr:8aa4e09f-58c8-4a73-b2b7-38b24a228227/2026_merk_QST-Pauschalabz%C3%BCge-Tarife%20def.%209.12.25.pdf',
    pdf: true,
  },
  'zg-2026-source-tax-nov-uebersicht': {
    title: 'Anhang II, Übersicht über die nachträgliche ordentliche Veranlagung (NOV)',
    url: 'https://cdn.zg.ch/dam/jcr:ce209ab2-284a-4c1d-ad2a-bbaa70a0da8d/2026_info_250_NOV_Uebersicht_def.26.11.25.pdf',
    pdf: true,
  },
  'zg-2026-source-tax-tarif-an': {
    title:
      'Quellensteuer für ausländische Arbeitnehmer/Innen, Monatstarif für Alleinstehende (Tarif AN), gültig ab 01.01.2026',
    url: 'https://cdn.zg.ch/dam/jcr:e56d9f91-5adf-44b0-9a8a-3781c5bc5544/AN%20Tarif%202026.pdf',
    pdf: true,
  },
  'zg-2026-source-tax-tarife': {
    title: 'Quellensteuertarife',
    url: 'https://zg.ch/de/steuern-finanzen/steuern/quellensteuer/quellensteuertarife',
    pdf: false,
  },
  'zg-2026-tariff-grundtarif': {
    title: 'Kantonssteuer «Grundtarif» gültig Steuerperiode 2026 (Grundtarif 2001 bis 2026)',
    url: 'https://cdn.zg.ch/dam/jcr:96c7eef4-eb2f-4f8a-a4c4-dad209249598/Grundtarif%202001%20bis%202026.pdf',
    pdf: true,
  },
  'zg-2026-tariff-mehrpersonentarif': {
    title:
      'Kantonssteuer «Mehrpersonentarif» gültig Steuerperiode 2026 (Mehrpersonentarif 2001 bis 2026)',
    url: 'https://cdn.zg.ch/dam/jcr:88fe7bb7-e1c0-4cf5-bf67-b2ccc633caae/Mehrpersonentarif%202001%20bis%202026.pdf',
    pdf: true,
  },
  'zg-na-deductions-steuerbuch': {
    title: 'Steuerbuch',
    url: 'https://wissen.zg.ch/steuerbuch',
    pdf: false,
  },
  'zg-na-efiling-etax-einreichen': {
    title: '3. Steuererklärung einreichen',
    url: 'https://zg.ch/de/steuern-finanzen/steuern/etax/etax-einreichen',
    pdf: false,
  },
  'zg-na-efiling-etax-zug': {
    title: 'eTax.zug',
    url: 'https://zg.ch/de/steuern-finanzen/steuern/etax',
    pdf: false,
  },
  'zg-na-efiling-fristerstreckung': {
    title: 'Fristerstreckung Steuererklärung natürliche Personen',
    url: 'https://zg.ch/de/steuern-finanzen/steuern/natuerliche-personen/fristerstreckung-steuererklaerung',
    pdf: false,
  },
  'zg-na-law-verordnung-steuergesetz': {
    title: 'Verordnung zum Steuergesetz (BGS 632.11), Stand 1. Januar 2022',
    url: 'https://bgs.zg.ch/api/de/versions/2286/pdf_file',
    pdf: true,
  },
  'zg-na-law-ves-elektronische-einreichung': {
    title:
      'Verordnung über die elektronische Einreichung der Steuererklärung (VES), BGS 632.12, Stand 1. Januar 2026',
    url: 'https://bgs.zg.ch/api/de/versions/2686/pdf_file',
    pdf: true,
  },
  'zg-na-source-tax-neuberechnung-antrag': {
    title: 'Antrag auf Neuberechnung der Quellensteuer',
    url: 'https://cdn.zg.ch/dam/jcr:1d78153a-7849-4c69-9093-8e80e9b2c600/2026_form_255_%20def.26.11.25.pdf',
    pdf: true,
  },
  'zg-na-source-tax-nov-antrag': {
    title: 'Antrag auf nachträgliche ordentliche Veranlagung (NOV)',
    url: 'https://cdn.zg.ch/dam/jcr:8c0b5334-bfc5-4d82-906f-27473b70777d/2026_form_250_NOV_Antrag_def.26.11.25.pdf',
    pdf: true,
  },
  'zg-na-tariff-steuern-berechnen': {
    title: 'Steuern für natürliche Personen berechnen',
    url: 'https://zg.ch/de/steuern-finanzen/steuern/natuerliche-personen/steuern-berechnen',
    pdf: false,
  },
};
