// The official Zurich documents Taxpresso cites (SPEC.md 7b), with the URL of each as listed in
// docs/sources/zh/manifest.json. Data only: the extension never opens these links itself (C2); the
// user's browser does, when they click one. A test keeps every entry equal to the manifest
// (test/sources.test.ts).

export interface OfficialDocument {
  /** The title as published. */
  title: string;
  url: string;
  /** A PDF opens at a page with #page=N. */
  pdf: boolean;
}

export const ZH_OFFICIAL_DOCUMENTS: Readonly<Record<string, OfficialDocument>> = {
  'zh-2025-deductions-berufsauslagen-631-33': {
    title:
      'Verfügung der Finanzdirektion über die Pauschalierung von Berufsauslagen Unselbstständigerwerbender bei der Steuereinschätzung (ab Steuerperiode 2024), LS 631.33',
    url: 'https://www.notes.zh.ch/appl/zhlex_r.nsf/WebView/634DD7A2FF652108C1258A8C00281D29/$File/631.33_3.10.23_123.pdf',
    pdf: true,
  },
  'zh-2025-deductions-form-versicherungspraemien': {
    title: 'Versicherungsprämien 2025',
    url: 'https://www.zh.ch/content/dam/zhweb/bilder-dokumente/themen/steuern-finanzen/steuern/natuerlichepersonen/2025/est-formulare/365%20Versicherung%20ZH%202025%20HA%20DEF.pdf',
    pdf: true,
  },
  'zh-2025-form-berufsauslagen': {
    title: 'Berufsauslagen 2025',
    url: 'https://www.zh.ch/content/dam/zhweb/bilder-dokumente/themen/steuern-finanzen/steuern/natuerlichepersonen/2025/est-formulare/360%20Berufsauslagen%20ZH%202025%20HA%20DEF.pdf',
    pdf: true,
  },
  'zh-2025-form-steuererklaerung': {
    title: 'Steuererklärung 2025 (für natürliche Personen)',
    url: 'https://www.zh.ch/content/dam/zhweb/bilder-dokumente/themen/steuern-finanzen/steuern/natuerlichepersonen/2025/est-formulare-uj/300%20STE%20ZH%202025%20UJ%20DEF.pdf',
    pdf: true,
  },
  'zh-2025-form-steuererklaerung-hauptformular': {
    title: 'Steuererklärung 2025 für natürliche Personen',
    url: 'https://www.zh.ch/content/dam/zhweb/bilder-dokumente/themen/steuern-finanzen/steuern/natuerlichepersonen/2025/est-formulare/300%20STE%20ZH%202025%20HA%20DEF.pdf',
    pdf: true,
  },
  'zh-2025-guide-natuerliche-personen': {
    title: 'Wegleitung zur Steuererklärung 2025',
    url: 'https://www.zh.ch/content/dam/zhweb/bilder-dokumente/themen/steuern-finanzen/steuern/natuerlichepersonen/2025/est-wegleitungen/305_Wegleitung_ZH_2025_HA%20bf%20DEF.pdf',
    pdf: true,
  },
  'zh-2025-law-steuergesetz-631-1-stand-2025': {
    title: 'Steuergesetz (StG) vom 8. Juni 1997, LS 631.1 (Nachtrag 127, Stand 1.1.2025)',
    url: 'https://www.notes.zh.ch/appl/zhlex_r.nsf/WebView/B51FEC97C47FE954C1258BBF004304B6/$File/631.1_8.6.97_127.pdf',
    pdf: true,
  },
  'zh-2025-tariff-kalte-progression-ab-2024': {
    title:
      'Verordnung über den Ausgleich der kalten Progression bei der Einkommens- und Vermögenssteuer ab 1. Januar 2024',
    url: 'https://www.zh.ch/content/dam/zhweb/bilder-dokumente/themen/steuern-finanzen/steuern/vertreter/steuerbuch/zstb-nr-48-1/zstb-nr-48-1_gueltig-ab-01-01-2024.pdf',
    pdf: true,
  },
  'zh-2025-tariff-staatssteuerfuss-2024-2025': {
    title:
      'Beschluss des Kantonsrates über die Festsetzung des Steuerfusses für die Jahre 2024 und 2025 (LS 631.21)',
    url: 'https://www.notes.zh.ch/appl/zhlex_r.nsf/WebView/1B81DE4E42D6334EC1258A8C003009F9/$File/631.21_12.12.23_123.pdf',
    pdf: true,
  },
  'zh-2025-tariff-weisung-sozialabzuege': {
    title: 'Weisung der Finanzdirektion über Sozialabzüge und Steuertarife (ab Steuerperiode 2015)',
    url: 'https://www.zh.ch/content/dam/zhweb/bilder-dokumente/themen/steuern-finanzen/steuern/vertreter/steuerbuch/zstb-nr-34-1/zstb-nr-34-1_gueltig-bis-31_12_2025.pdf',
    pdf: true,
  },
  'zh-2026-deductions-berufsauslagen-631-33': {
    title:
      'Verfügung der Finanzdirektion über die Pauschalierung von Berufsauslagen Unselbstständigerwerbender bei der Steuereinschätzung (ab Steuerperiode 2026), LS 631.33',
    url: 'https://www.notes.zh.ch/appl/zhlex_r.nsf/WebView/51990C81724C3FB1C1258D64004D7357/$File/631.33_26.9.25_131.pdf',
    pdf: true,
  },
  'zh-2026-deductions-form-berufsauslagen': {
    title: 'Berufsauslagen 2026',
    url: 'https://www.zh.ch/content/dam/zhweb/bilder-dokumente/themen/steuern-finanzen/steuern/natuerlichepersonen/2026/est-formulare-uj/360%20Berufsauslagen%20ZH%202026.pdf',
    pdf: true,
  },
  'zh-2026-deductions-form-versicherungspraemien': {
    title: 'Versicherungsprämien 2026',
    url: 'https://www.zh.ch/content/dam/zhweb/bilder-dokumente/themen/steuern-finanzen/steuern/natuerlichepersonen/2026/est-formulare-uj/365%20Versicherung%20ZH%202026.pdf',
    pdf: true,
  },
  'zh-2026-guide-unterjaehrig': {
    title: 'Wegleitung zur Steuererklärung 2026 unterjährig',
    url: 'https://www.zh.ch/content/dam/zhweb/bilder-dokumente/themen/steuern-finanzen/steuern/natuerlichepersonen/2026/est-wegleitungen-uj/305%20Wegleitung%20ZH%202026%20UJ%20bf.pdf',
    pdf: true,
  },
  'zh-2026-law-steuergesetz-631-1-stand-2026': {
    title: 'Steuergesetz (StG) vom 8. Juni 1997, LS 631.1 (Nachtrag 132, Stand 1.4.2026)',
    url: 'https://www.notes.zh.ch/appl/zhlex_r.nsf/WebView/A1B72A220CD6E747C1258DC4002A921E/$File/631.1_8.6.97_132.pdf',
    pdf: true,
  },
  'zh-2026-source-tax-grundlagen-parameter': {
    title: 'Quellensteuertarife ab 2026: Grundlagen und Berechnungsparameter',
    url: 'https://www.zh.ch/content/dam/zhweb/bilder-dokumente/themen/steuern-finanzen/steuern/quellensteuer/quellensteuertarif/2026/grundlagen_und_berechnungsparameter_2026.pdf',
    pdf: true,
  },
  'zh-2026-tariff-kalte-progression-ab-2026': {
    title:
      'Verordnung über den Ausgleich der kalten Progression bei der Einkommens- und Vermögenssteuer ab 1. Januar 2026',
    url: 'https://www.zh.ch/content/dam/zhweb/bilder-dokumente/themen/steuern-finanzen/steuern/vertreter/steuerbuch/zstb-nr-48-1/zstb-nr-48-1.pdf',
    pdf: true,
  },
  'zh-2026-tariff-staatssteuerfuss-2026-2027': {
    title:
      'Beschluss des Kantonsrates über die Festsetzung des Steuerfusses für die Jahre 2026 und 2027 (LS 631.21)',
    url: 'https://www.notes.zh.ch/appl/zhlex_r.nsf/WebView/BA3B8CC78A88D4DEC1258D88003B2E23/$File/631.21_15.12.25_132.pdf',
    pdf: true,
  },
  'zh-2026-tariff-weisung-sozialabzuege': {
    title: 'Weisung der Finanzdirektion über Sozialabzüge und Steuertarife (ab Steuerperiode 2026)',
    url: 'https://www.zh.ch/content/dam/zhweb/bilder-dokumente/themen/steuern-finanzen/steuern/vertreter/steuerbuch/zstb-nr-34-1/ZStB-Nr-34-1%203.pdf',
    pdf: true,
  },
  'zh-na-communal-steuerfuesse-seit-2012': {
    title:
      'Steuerfüsse seit 2012 (Bezogene Gemeindesteuerfüsse, in Prozent der einfachen Staatssteuer)',
    url: 'https://daten.statistik.zh.ch/ogd/daten/ressourcen/KTZH_00000005_00001150.xlsx',
    pdf: false,
  },
  'zh-na-deductions-merkblatt-saeule-3a': {
    title:
      'Merkblatt des kantonalen Steueramtes über die steuerliche Abzugsberechtigung für Beiträge an anerkannte Formen der gebundenen Selbstvorsorge (3. Säule a)',
    url: 'https://www.zh.ch/content/dam/zhweb/bilder-dokumente/themen/steuern-finanzen/steuern/vertreter/steuerbuch/zstb-nr-31-1/zstb-nr-31-1.pdf',
    pdf: true,
  },
  'zh-na-efiling-steuererklaerung-privatpersonen': {
    title: 'Steuererklärung Privatpersonen',
    url: 'https://www.zh.ch/de/steuern-finanzen/steuern/steuern-natuerliche-personen/steuererklaerung-natuerliche-personen.html',
    pdf: false,
  },
  'zh-na-other-crypto-zstb-16-5': {
    title: 'Steuerliche Behandlung von Kryptowährungen (Bitcoin etc.)',
    url: 'https://www.zh.ch/de/steuern-finanzen/steuern/treuhaender/steuerbuch/steuerbuch-definition/zstb-16-5.html',
    pdf: false,
  },
  'zh-na-source-tax-nov-antrag': {
    title: 'Nachträgliche ordentliche Veranlagung beantragen',
    url: 'https://www.zh.ch/de/steuern-finanzen/steuern/quellensteuer/nachtraegliche-ordentliche-veranlagung-oder-quellensteuerkorrekt.html',
    pdf: false,
  },
};
