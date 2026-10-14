// The official St. Gallen documents Taxpresso cites (SPEC.md 7b), with the URL of each as listed in
// docs/sources/sg/manifest.json. Data only: the extension never opens these links itself (C2); the
// user’s browser does, when they click one. A test keeps every entry equal to the manifest
// (test/sources.test.ts).
import type { OfficialDocument } from '@taxpresso/rules-ch';

export type { OfficialDocument } from '@taxpresso/rules-ch';

export const SG_OFFICIAL_DOCUMENTS: Readonly<Record<string, OfficialDocument>> = {
  'sg-2025-communal-steuerfuesse': {
    title: 'Steuerfüsse der Gemeinden des Kantons St. Gallen im Jahr 2025',
    url: 'https://www.sg.ch/content/dam/sgch/steuern-finanzen/steuern/formulare-und-wegleitungen/einkommens-und-vermoegenssteuer/tarife-und-steuerfuesse/steuerfuesse-st-gallische-gemeinden/Steuerfuesse%202025%20finale%20Version%20fuer%20Internet.pdf',
    pdf: true,
  },
  'sg-2025-efiling-faltblatt-etax': {
    title: 'Faltblatt zur Steuererklärung 2025: Steuererklärung jetzt online!',
    url: 'https://www.sg.ch/content/dam/sgch/steuern-finanzen/steuern/formulare-und-wegleitungen/einkommens-und-vermoegenssteuer/2025-hs/Faltblatt_NP_2025.pdf',
    pdf: true,
  },
  'sg-2025-form-berufskosten': {
    title: 'Berufskosten 2025 (Formular 4)',
    url: 'https://www.sg.ch/content/dam/sgch/steuern-finanzen/steuern/formulare-und-wegleitungen/einkommens-und-vermoegenssteuer/2025-hs/Formular_4_NP_2025_HA.pdf',
    pdf: true,
  },
  'sg-2025-form-liegenschaften': {
    title: 'Liegenschaften 2025 (Formular 7)',
    url: 'https://www.sg.ch/content/dam/sgch/steuern-finanzen/steuern/formulare-und-wegleitungen/einkommens-und-vermoegenssteuer/2025-hs/Formular_7_NP_2025_HA.pdf',
    pdf: true,
  },
  'sg-2025-form-schulden-zuwendungen': {
    title: 'Schuldenverzeichnis, Freiwillige Zuwendungen / Parteispenden 2025 (Formular 5)',
    url: 'https://www.sg.ch/content/dam/sgch/steuern-finanzen/steuern/formulare-und-wegleitungen/einkommens-und-vermoegenssteuer/2025-hs/Formular_5_NP_2025_HA.pdf',
    pdf: true,
  },
  'sg-2025-form-steuererklaerung': {
    title: 'Steuererklärung für natürliche Personen 2025 (Formular 1)',
    url: 'https://www.sg.ch/content/dam/sgch/steuern-finanzen/steuern/formulare-und-wegleitungen/einkommens-und-vermoegenssteuer/2025-hs/Formular_1_NP_2025_HA.pdf',
    pdf: true,
  },
  'sg-2025-form-versicherungspraemien-krankheitskosten': {
    title:
      'Versicherungsprämien und Sparzinsen; Krankheits-, Unfall- und behinderungsbedingte Kosten 2025 (Formular 6)',
    url: 'https://www.sg.ch/content/dam/sgch/steuern-finanzen/steuern/formulare-und-wegleitungen/einkommens-und-vermoegenssteuer/2025-hs/Formular_6_NP_2025_HA.pdf',
    pdf: true,
  },
  'sg-2025-form-wertschriftenverzeichnis': {
    title:
      'Wertschriften- und Guthabenverzeichnis, Rückerstattungsantrag Verrechnungssteuer 2025 (Formular 2)',
    url: 'https://www.sg.ch/content/dam/sgch/steuern-finanzen/steuern/formulare-und-wegleitungen/einkommens-und-vermoegenssteuer/2025-hs/Formular_2_NP_2025_HA.pdf',
    pdf: true,
  },
  'sg-2025-guide-kurzuebersicht': {
    title: 'Kurzübersicht Wegleitung 2025',
    url: 'https://www.sg.ch/content/dam/sgch/steuern-finanzen/steuern/formulare-und-wegleitungen/einkommens-und-vermoegenssteuer/2025-hs/Kurzuebersicht_Wegleitung_NP_2025.pdf',
    pdf: true,
  },
  'sg-2025-guide-merkblatt-dbst': {
    title: 'Merkblatt 32: Merkblatt für die Direkte Bundessteuer 2025',
    url: 'https://www.sg.ch/content/dam/sgch/steuern-finanzen/steuern/formulare-und-wegleitungen/einkommens-und-vermoegenssteuer/2025-hs/Formular_32_NP_2025_HA.pdf',
    pdf: true,
  },
  'sg-2025-guide-wegleitung': {
    title: 'Wegleitung zur Steuererklärung 2025',
    url: 'https://www.sg.ch/content/dam/sgch/steuern-finanzen/steuern/formulare-und-wegleitungen/einkommens-und-vermoegenssteuer/2025-hs/Wegleitung_NP_2025.pdf',
    pdf: true,
  },
  'sg-2025-law-steuergesetz': {
    title: 'Steuergesetz vom 9. April 1998 (sGS 811.1), Stand 1. Januar 2025',
    url: 'https://www.gesetzessammlung.sg.ch/api/de/versions/3711/pdf_file',
    pdf: true,
  },
  'sg-2025-other-medienmitteilung-etax': {
    title: 'Neue Online-Steuererklärung E-Tax SG (Medienmitteilung)',
    url: 'https://www.sg.ch/news/sgch_allgemein/2026/01/neue-online-steuererklaerung-e-tax-sg.html',
    pdf: false,
  },
  'sg-2025-source-tax-tarif-a': {
    title:
      'Quellensteuer für ausländische Arbeitnehmer (ohne Niederlassungsbewilligung), Tarif A, Monatstarif für Alleinstehende, Stand 1. Januar 2025',
    url: 'https://www.sg.ch/content/dam/sgch/steuern-finanzen/steuern/formulare-und-wegleitungen/quellensteuer/tarife/2025/Tarif%20A%202025.pdf',
    pdf: true,
  },
  'sg-2025-tariff-einkommen-vermoegen': {
    title: 'Tarif 2025',
    url: 'https://www.sg.ch/content/dam/sgch/steuern-finanzen/steuern/formulare-und-wegleitungen/einkommens-und-vermoegenssteuer/tarife-und-steuerfuesse/tarife-privatpersonen-gueltig-ab/Tarif%202025%20SG%20Def.pdf',
    pdf: true,
  },
  'sg-2026-communal-steuerfuesse': {
    title: 'Steuerfüsse der Gemeinden des Kantons St. Gallen im Jahr 2026',
    url: 'https://www.sg.ch/content/dam/sgch/steuern-finanzen/steuern/formulare-und-wegleitungen/einkommens-und-vermoegenssteuer/tarife-und-steuerfuesse/steuerfuesse-st-gallische-gemeinden/Steuerf%C3%BCsse%202026%20f%C3%BCr%20Versand.pdf',
    pdf: true,
  },
  'sg-2026-guide-merkblatt-unterjaehrig': {
    title:
      'Merkblatt 8: Unterjährige Steuerpflicht zufolge Wegzugs ins Ausland sowie bei Tod im Jahr 2026',
    url: 'https://www.sg.ch/content/dam/sgch/steuern-finanzen/steuern/formulare-und-wegleitungen/einkommens-und-vermoegenssteuer/2026-uj/Formular_8_NP_2026_UJ.pdf',
    pdf: true,
  },
  'sg-2026-law-steuergesetz': {
    title: 'Steuergesetz vom 9. April 1998 (sGS 811.1), Stand 1. Januar 2026',
    url: 'https://www.gesetzessammlung.sg.ch/api/de/versions/3822/pdf_file',
    pdf: true,
  },
  'sg-2026-other-steuerbuch-nachtrag': {
    title: '15. Nachtrag zum Steuerbuch, Stand 1. Januar 2026 (Liste geänderte und neue Weisungen)',
    url: 'https://www.sg.ch/steuern-finanzen/steuern/steuerbuch/_jcr_content/Par/sgch_downloadlist_co/DownloadListPar/sgch_download.ocFile/Liste%20ge%C3%A4nderte%20und%20neue%20Weisungen%20Stand%2001.01.2026.pdf',
    pdf: true,
  },
  'sg-2026-source-tax-tarif-a': {
    title:
      'Quellensteuer für ausländische Arbeitnehmer (ohne Niederlassungsbewilligung), Tarif A, Monatstarif für Alleinstehende, Stand 1. Januar 2026',
    url: 'https://www.sg.ch/content/dam/sgch/steuern-finanzen/steuern/formulare-und-wegleitungen/quellensteuer/tarife/20251/Tarif%20A%202026.pdf',
    pdf: true,
  },
  'sg-2026-tariff-einkommen-vermoegen': {
    title: 'Tarif 2026',
    url: 'https://www.sg.ch/content/dam/sgch/steuern-finanzen/steuern/formulare-und-wegleitungen/einkommens-und-vermoegenssteuer/tarife-und-steuerfuesse/tarife-privatpersonen-gueltig-ab/Tarif_2026_SG_DEF.pdf',
    pdf: true,
  },
  'sg-2026-tariff-kantonssteuerfuss': {
    title: 'StB 6 Nr. 1: Kantonssteuerfuss in Prozenten der einfachen Steuer',
    url: 'https://www.sg.ch/content/dam/sgch/steuern-finanzen/steuern/steuerbuch/art-1-12-stg/006_1.pdf',
    pdf: true,
  },
  'sg-na-deductions-auswaertige-verpflegung': {
    title: 'StB 39 Nr. 8: Auswärtige Verpflegung',
    url: 'https://www.sg.ch/content/dam/sgch/steuern-finanzen/steuern/steuerbuch/art-29-52-stg/039_8.pdf',
    pdf: true,
  },
  'sg-na-deductions-fahrt-arbeitsort': {
    title: 'StB 39 Nr. 3: Fahrt zum Arbeitsort',
    url: 'https://www.sg.ch/content/dam/sgch/steuern-finanzen/steuern/steuerbuch/art-29-52-stg/039_3.pdf',
    pdf: true,
  },
  'sg-na-deductions-kinderabzug': {
    title: 'StB 48 Nr. 1: Kinderabzug',
    url: 'https://www.sg.ch/content/dam/sgch/steuern-finanzen/steuern/steuerbuch/art-29-52-stg/048_1.pdf',
    pdf: true,
  },
  'sg-na-deductions-kinderbetreuungskosten': {
    title: 'StB 45 Nr. 14: Kinderbetreuungskosten',
    url: 'https://www.sg.ch/content/dam/sgch/steuern-finanzen/steuern/steuerbuch/art-29-52-stg/045_14.pdf',
    pdf: true,
  },
  'sg-na-deductions-saeule-3a': {
    title: 'StB 45 Nr. 9: Beiträge an die gebundene Selbstvorsorge (Säule 3a)',
    url: 'https://www.sg.ch/content/dam/sgch/steuern-finanzen/steuern/steuerbuch/art-29-52-stg/045_9.pdf',
    pdf: true,
  },
  'sg-na-deductions-zuwendungen': {
    title:
      'StB 46 Nr. 4: Freiwillige Zuwendungen für öffentliche oder ausschliesslich gemeinnützige Zwecke',
    url: 'https://www.sg.ch/content/dam/sgch/steuern-finanzen/steuern/steuerbuch/art-29-52-stg/046_4.pdf',
    pdf: true,
  },
  'sg-na-efiling-etax-sg': {
    title: 'E-Tax SG für Privatpersonen',
    url: 'https://www.sg.ch/steuern-finanzen/steuern/elektronische-steuererklaerung/etaxnp.html',
    pdf: false,
  },
  'sg-na-efiling-fristen-steuerbuch': {
    title: 'StB 161 Nr. 1: Fristen',
    url: 'https://www.sg.ch/content/dam/sgch/steuern-finanzen/steuern/steuerbuch/art-158-227-stg/161_1.pdf',
    pdf: true,
  },
  'sg-na-form-ausbildungs-kinderbetreuungskosten': {
    title: 'Ausbildungskosten Kinder / Kinderbetreuungskosten (Formular 10)',
    url: 'https://www.sg.ch/content/dam/sgch/steuern-finanzen/steuern/formulare-und-wegleitungen/einkommens-und-vermoegenssteuer/jahresunabhaengige-formulare/formulare/Formular_10_eForm.pdf',
    pdf: true,
  },
  'sg-na-law-steuerverordnung': {
    title: 'Steuerverordnung vom 20. Oktober 1998 (sGS 811.11), Stand 1. Januar 2024',
    url: 'https://www.gesetzessammlung.sg.ch/api/de/versions/3565/pdf_file',
    pdf: true,
  },
  'sg-na-source-tax-faq': {
    title: 'Quellensteuer: Häufig gestellte Fragen',
    url: 'https://www.sg.ch/steuern-finanzen/steuern/steuerarten/quellensteuer/haeufig-gestellte-fragen.html',
    pdf: false,
  },
  'sg-na-source-tax-nov-antrag-ansaessige': {
    title:
      '51.1.13a Antrag auf nachträgliche ordentliche Veranlagung für quellensteuerpflichtige Personen mit steuerrechtlichem Wohnsitz oder Aufenthalt in der Schweiz',
    url: 'https://www.sg.ch/content/dam/sgch/steuern-finanzen/steuern/formulare-und-wegleitungen/quellensteuer/weitere-formulare/veranlagung/SG_51-1-13a_Antrag-Veranlagung_Ansaessige-Quest_def_.pdf',
    pdf: true,
  },
  'sg-na-source-tax-tarife-index': {
    title: 'Quellensteuer (Formulare, Merkblätter und Tarife)',
    url: 'https://www.sg.ch/steuern-finanzen/steuern/formulare-wegleitungen/quellensteuern.html',
    pdf: false,
  },
};
