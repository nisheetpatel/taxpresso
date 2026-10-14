// The official Lucerne documents Taxpresso cites (SPEC.md 7b), with the URL of each as listed in
// docs/sources/lu/manifest.json. Data only: the extension never opens these links itself (C2); the
// user’s browser does, when they click one. A test keeps every entry equal to the manifest
// (test/sources.test.ts).
import type { OfficialDocument } from '@taxpresso/rules-ch';

export type { OfficialDocument } from '@taxpresso/rules-ch';

export const LU_OFFICIAL_DOCUMENTS: Readonly<Record<string, OfficialDocument>> = {
  'lu-2025-communal-steuereinheiten': {
    title: 'Steuereinheiten 2025, Staat / Einwohner- und Kirchgemeinde',
    url: 'https://steuern.lu.ch/-/media/Steuern/Dokumente/Publikationen/2025/Steuereinheiten_2025_NP.pdf',
    pdf: true,
  },
  'lu-2025-deductions-abzuege-auf-einen-blick': {
    title: 'Abzüge 2025 auf einen Blick',
    url: 'https://steuern.lu.ch/-/media/Steuern/Dokumente/Publikationen/2025/Abzge_auf_einen_Blick_2025.pdf',
    pdf: true,
  },
  'lu-2025-deductions-steuerbuch-band1': {
    title: 'Luzerner Steuerbuch Band 1 (Stand 01.01.2025)',
    url: 'https://steuerbuch.lu.ch/-/media/Steuerbuch/Dokumente/Archiv/01012025/LUStB_Band1_2025_01_01.pdf',
    pdf: true,
  },
  'lu-2025-efiling-merkblatt-esteuern': {
    title: 'eSteuern.lu.ch: Ihre neue Online-Lösung zum Ausfüllen der Steuererklärung',
    url: 'https://steuern.lu.ch/-/media/Steuern/Dokumente/Publikationen/2026/Merkblatt_2025_eSteuern.pdf',
    pdf: true,
  },
  'lu-2025-efiling-mitteilung-esteuern': {
    title: 'Steuererklärung erstmals komplett digital ausfüllen',
    url: 'https://news.lu.ch/html_mail.jsp?id=0&email=news.lu.ch&mailref=000l6dq0000ti000000000000cgcqzjb',
    pdf: false,
  },
  'lu-2025-form-ergaenzungsblatt-dbst': {
    title: 'Ergänzungsblatt Direkte Bundessteuer 2025',
    url: 'https://steuern.lu.ch/-/media/Steuern/Dokumente/Steuerformulare/2025/Ergaenzungsblatt_DB_LU_2025_HA_rechenbar.pdf',
    pdf: true,
  },
  'lu-2025-guide-informationen-steuererklaerung': {
    title: 'Informationen zur Steuererklärung 2025',
    url: 'https://steuern.lu.ch/-/media/Steuern/Dokumente/Publikationen/2026/Merkblatt_2025_A_Information_zur_Steuererklrung.pdf',
    pdf: true,
  },
  'lu-2025-guide-wegleitung': {
    title:
      'Wegleitung zur Steuererklärung 2025, Natürliche Personen, Kantons-, Gemeinde-, direkte Bundessteuer',
    url: 'https://steuern.lu.ch/-/media/Steuern/Dokumente/Steuerformulare/2025/Wegleitung930109LU2025HADEFneu.pdf',
    pdf: true,
  },
  'lu-2025-law-steuergesetz': {
    title: 'Steuergesetz (StG), SRL Nr. 620, Stand 1. Juni 2025',
    url: 'https://srl.lu.ch/api/de/versions/4405/pdf_file',
    pdf: true,
  },
  'lu-2025-law-steuerverordnung': {
    title: 'Steuerverordnung (StV), SRL Nr. 621, Stand 1. Januar 2025',
    url: 'https://srl.lu.ch/api/de/versions/4354/pdf_file',
    pdf: true,
  },
  'lu-2025-source-tax-merkblatt-nov': {
    title: 'Nachträgliche ordentliche Veranlagung (NOV)',
    url: 'https://steuern.lu.ch/-/media/Steuern/Dokumente/Publikationen/2025/930498_Merkblatt_2025_Nachtrgliche_ordentliche_Veranlagung_NOV.pdf',
    pdf: true,
  },
  'lu-2025-source-tax-tarif-a-b-mit-kirche': {
    title: 'Quellensteuer Tarif AY und BY mit Kirchensteuer 2025',
    url: 'https://steuern.lu.ch/-/media/Steuern/Dokumente/Quellensteuer/2025/Tarif2025_A_B_mit_Kirchensteuer.pdf',
    pdf: true,
  },
  'lu-2025-source-tax-tarif-a-b-ohne-kirche': {
    title: 'Quellensteuer Tarif AN und BN ohne Kirchensteuer 2025',
    url: 'https://steuern.lu.ch/-/media/Steuern/Dokumente/Quellensteuer/2025/Tarif2025_A_B_ohne_Kirchensteuer.pdf',
    pdf: true,
  },
  'lu-2025-tariff-berechnungstabelle-einkommen': {
    title: 'Berechnungstabelle zu § 57 des Steuergesetzes (SRL Nr. 620) 2025',
    url: 'https://steuern.lu.ch/-/media/Steuern/Dokumente/Publikationen/2024/Tabelle_Einkommenstarife_2025.pdf',
    pdf: true,
  },
  'lu-2025-tariff-tariftabellen-abzuege': {
    title: 'Tariftabellen 2025 und Abzüge 2025',
    url: 'https://steuern.lu.ch/-/media/Steuern/Dokumente/Publikationen/2024/Tariftabellen_und_Abzge_fr_Homepage_2025.pdf',
    pdf: true,
  },
  'lu-2026-communal-steuereinheiten': {
    title: 'Steuereinheiten 2026, Staat / Einwohner- und Kirchgemeinde',
    url: 'https://steuern.lu.ch/-/media/Steuern/Dokumente/Publikationen/2026/Steuereinheiten_2026_NP.pdf',
    pdf: true,
  },
  'lu-2026-deductions-abzuege-auf-einen-blick': {
    title: 'Abzüge 2026 auf einen Blick',
    url: 'https://steuern.lu.ch/-/media/Steuern/Dokumente/Publikationen/2026/Abzge_auf_einen_Blick_2026.pdf',
    pdf: true,
  },
  'lu-2026-deductions-steuerbuch-band1': {
    title: 'Luzerner Steuerbuch Band 1 (Stand 01.01.2026)',
    url: 'https://steuerbuch.lu.ch/-/media/Steuerbuch/Dokumente/Archiv/01_01_2026/LUStB_Band1_2026_01_01.pdf',
    pdf: true,
  },
  'lu-2026-guide-merkblatt-unterjaehrig': {
    title: 'Unterjährige Steuerpflicht 2026',
    url: 'https://steuern.lu.ch/-/media/Steuern/Dokumente/Steuerformulare/2026/Merkblatt_2026_Unterjhrige_Steuerpflicht_01_CD23.pdf',
    pdf: true,
  },
  'lu-2026-guide-wegleitung-unterjaehrig': {
    title: 'Wegleitung zur Steuererklärung 2026, Natürliche Personen (unterjährige Steuerpflicht)',
    url: 'https://steuern.lu.ch/-/media/Steuern/Dokumente/Steuerformulare/2026/Wegleitung930109LU2026VADEFneu.pdf',
    pdf: true,
  },
  'lu-2026-law-steuergesetz': {
    title: 'Steuergesetz (StG), SRL Nr. 620, Stand 1. Januar 2026',
    url: 'https://srl.lu.ch/api/de/versions/4667/pdf_file',
    pdf: true,
  },
  'lu-2026-law-steuerverordnung': {
    title: 'Steuerverordnung (StV), SRL Nr. 621, Stand 1. Januar 2026',
    url: 'https://srl.lu.ch/api/de/versions/4586/pdf_file',
    pdf: true,
  },
  'lu-2026-other-steuerbuch-band2': {
    title: 'Luzerner Steuerbuch Band 2 (Stand 01.01.2026)',
    url: 'https://steuerbuch.lu.ch/-/media/Steuerbuch/Dokumente/Archiv/01_01_2026/LUStB_Band2_2026_01_01.pdf',
    pdf: true,
  },
  'lu-2026-source-tax-tarif-a-b-mit-kirche': {
    title: 'Quellensteuer Tarif AY und BY mit Kirchensteuer 2026',
    url: 'https://steuern.lu.ch/-/media/Steuern/Dokumente/Quellensteuer/2026/AundBTarifmitKirchensteuerA0YB0YB5Y.pdf',
    pdf: true,
  },
  'lu-2026-source-tax-tarif-a-b-ohne-kirche': {
    title: 'Quellensteuer Tarif AN und BN ohne Kirchensteuer 2026',
    url: 'https://steuern.lu.ch/-/media/Steuern/Dokumente/Quellensteuer/2026/AundBTarifohneKirchensteuerA0NB0NB5N.pdf',
    pdf: true,
  },
  'lu-2026-tariff-berechnungstabelle-einkommen': {
    title: 'Berechnungstabelle zu § 57 des Steuergesetzes (SRL Nr. 620) 2026',
    url: 'https://steuern.lu.ch/-/media/Steuern/Dokumente/Publikationen/2025/Tabelle_Einkommenstarife_2026.pdf',
    pdf: true,
  },
  'lu-2026-tariff-tariftabellen-abzuege': {
    title: 'Tariftabellen 2026 und Abzüge 2026',
    url: 'https://steuern.lu.ch/-/media/Steuern/Dokumente/Publikationen/2025/Tariftabellen_und_Abzge_2026.pdf',
    pdf: true,
  },
  'lu-na-communal-steuereinheiten-tarife': {
    title: 'Steuereinheiten / Tarife',
    url: 'https://steuern.lu.ch/publikationen/nav_einheiten_tarife',
    pdf: false,
  },
  'lu-na-efiling-deklaration': {
    title: 'Deklaration',
    url: 'https://steuern.lu.ch/steuererklaerung/steuererklaerung_natp/Installation',
    pdf: false,
  },
  'lu-na-form-bestellservice': {
    title: 'Bestellservice für Steuerformulare',
    url: 'https://steuern.lu.ch/publikationen/bestellservice',
    pdf: false,
  },
  'lu-na-law-quellensteuerverordnung': {
    title: 'Verordnung über die Quellensteuer (QStV), SRL Nr. 624, Stand 1. Januar 2021',
    url: 'https://srl.lu.ch/api/de/versions/3670/pdf_file',
    pdf: true,
  },
  'lu-na-source-tax-neuberechnung': {
    title: 'Neuberechnung Quellensteuer',
    url: 'https://steuern.lu.ch/natuerlichepersonen/Steuerarten/quellensteuer/Neuberechnung',
    pdf: false,
  },
  'lu-na-source-tax-nov': {
    title: 'Steuererklärung (NOV)',
    url: 'https://steuern.lu.ch/natuerlichepersonen/Steuerarten/quellensteuer/Steuererklaerung_NOV',
    pdf: false,
  },
  'lu-na-source-tax-tarife': {
    title: 'Quellensteuer Tarife Kanton Luzern',
    url: 'https://steuern.lu.ch/natuerlichepersonen/Steuerarten/quellensteuer/quellensteuer_tarife',
    pdf: false,
  },
  'lu-na-tariff-berechnungstabellen': {
    title: 'Berechnungstabellen Steuertarife',
    url: 'https://steuern.lu.ch/publikationen/nav_einheiten_tarife/b_berechnungstabellen_steuertarife',
    pdf: false,
  },
};
