// The official Ticino documents Taxpresso cites (SPEC.md 7b), with the URL of each as listed in
// docs/sources/ti/manifest.json. Data only: the extension never opens these links itself (C2); the
// user’s browser does, when they click one. A test keeps every entry equal to the manifest
// (test/sources.test.ts).
import type { OfficialDocument } from '@taxpresso/rules-ch';

export type { OfficialDocument } from '@taxpresso/rules-ch';

export const TI_OFFICIAL_DOCUMENTS: Readonly<Record<string, OfficialDocument>> = {
  'ti-2025-communal-rates': {
    title: 'Moltiplicatori comunali',
    url: 'https://www4.ti.ch/dfe/dc/sportello/moltiplicatori-comunali',
    pdf: false,
  },
  'ti-2025-deductions-table': {
    title:
      "Tabella di confronto delle deduzioni per l'imposta cantonale e per l'imposta federale diretta",
    url: 'https://www4.ti.ch/fileadmin/DFE/DC/DOC-IPF/2025/Istruzioni/Tabella_deduzioni_PF_2025.pdf',
    pdf: true,
  },
  'ti-2025-efiling-etax-pf': {
    title: 'eTax PF',
    url: 'https://www4.ti.ch/dfe/dc/dichiarazione/dichiarazione-elettronica',
    pdf: false,
  },
  'ti-2025-efiling-guida-etax': {
    title: 'Guida completa eTax PF 2025',
    url: 'https://www4.ti.ch/fileadmin/DFE/DC/DOC-IPF/2025/Guida_al_programma-2025.pdf',
    pdf: true,
  },
  'ti-2025-efiling-proroga': {
    title: 'Richiesta di proroga',
    url: 'https://www4.ti.ch/index.php?id=135721',
    pdf: false,
  },
  'ti-2025-flyer-informativo': {
    title: 'Flyer informativo',
    url: 'https://www4.ti.ch/fileadmin/DFE/DC/DOC-IPF/2025/Istruzioni/Flyer_2025.pdf',
    pdf: true,
  },
  'ti-2025-form-moduli-pf-page': {
    title: 'Imposte persone fisiche - Moduli 2025',
    url: 'https://www4.ti.ch/dfe/dc/dichiarazione/moduli/moduli-pf-attuale',
    pdf: false,
  },
  'ti-2025-form-modulo-1-de': {
    title: 'Steuererklärung 2025 für natürliche Personen (Modulo 1), Übersetzung',
    url: 'https://www4.ti.ch/fileadmin/DFE/DC/DOC-IPF/2025/Moduli_principali/Mod_1_trad_intero.pdf',
    pdf: true,
  },
  'ti-2025-form-modulo-10': {
    title: 'Questionario complementare per indipendenti senza contabilità Modulo 10',
    url: 'https://www4.ti.ch/fileadmin/DFE/DC/DOC-IPF/2025/Moduli_principali/PF_VS_0608-2025_Mod10_A4.pdf',
    pdf: true,
  },
  'ti-2025-form-modulo-2': {
    title: 'Elenco dei titoli e di altri collocamenti di capitali Modulo 2',
    url: 'https://www4.ti.ch/fileadmin/DFE/DC/DOC-IPF/2025/Moduli_principali/PF_VS_0608-2025_Mod2_A4.pdf',
    pdf: true,
  },
  'ti-2025-form-modulo-4': {
    title: 'Spese professionali Modulo 4',
    url: 'https://www4.ti.ch/fileadmin/DFE/DC/DOC-IPF/2025/Moduli_principali/PF_VS_0608-2025_Mod4_A4.pdf',
    pdf: true,
  },
  'ti-2025-form-modulo-5': {
    title: 'Elenco debiti - Liberalità a enti di pubblica utilità Modulo 5',
    url: 'https://www4.ti.ch/fileadmin/DFE/DC/DOC-IPF/2025/Moduli_principali/PF_VS_0608-2025_Mod5_A4.pdf',
    pdf: true,
  },
  'ti-2025-form-modulo-6': {
    title:
      'Oneri assicurativi e interessi su capitali a risparmio - Spese per malattia e infortunio Modulo 6',
    url: 'https://www4.ti.ch/fileadmin/DFE/DC/DOC-IPF/2025/Moduli_principali/PF_VS_0608-2025_Mod6_A4.pdf',
    pdf: true,
  },
  'ti-2025-form-modulo-7': {
    title: 'Immobili, determinazione della sostanza 2025 e del reddito immobiliare (Modulo 7)',
    url: 'https://www4.ti.ch/fileadmin/DFE/DC/DOC-IPF/2025/Moduli_principali/PF_VS_0608-2025_Mod7_A4.pdf',
    pdf: true,
  },
  'ti-2025-guide-assoggettamento-inferiore': {
    title:
      "Nota di accompagnamento ai moduli della dichiarazione d'imposta 2025 per periodo di assoggettamento inferiore l'anno",
    url: 'https://www4.ti.ch/fileadmin/DFE/DC/DOC-IPF/2025/Istruzioni/Istruzioni_ass_inferiore_anno.pdf',
    pdf: true,
  },
  'ti-2025-guide-istruzioni-pf': {
    title: 'Imposte persone fisiche - Istruzioni 2025',
    url: 'https://www4.ti.ch/dfe/dc/dichiarazione/istruzioni-pf/istr-pf-attuale',
    pdf: false,
  },
  'ti-2025-guide-istruzioni-pf-pdf': {
    title:
      "Istruzioni per la compilazione della dichiarazione d'imposta 2025 delle persone fisiche",
    url: 'https://www4.ti.ch/fileadmin/DFE/DC/DOC-IPF/2025/Istruzioni/Istruzioni_PF_2025.pdf',
    pdf: true,
  },
  'ti-2025-press-release-declaration': {
    title: "Dichiarazione d'imposta 2025 delle persone fisiche",
    url: 'https://www4.ti.ch/tich/area-media/comunicati/dettaglio-comunicato?NEWS_ID=257983&cHash=155880c40e5f8328a3c7c401c6afa133',
    pdf: false,
  },
  'ti-2025-press-release-novita': {
    title: "Novità legislative per l'anno fiscale 2025",
    url: 'https://www4.ti.ch/tich/area-media/comunicati/dettaglio-comunicato?NEWS_ID=247871',
    pdf: false,
  },
  'ti-2025-source-tax-directive': {
    title: 'Direttiva cantonale in ambito imposte alla fonte, versione 1.0 del 01.01.2025',
    url: 'https://m4.ti.ch/fileadmin/DFE/DC/DOC-IF/Direttive/Direttiva_UIF__vers._1.0_del_01.01.2025_.pdf',
    pdf: true,
  },
  'ti-2025-source-tax-tabella-a': {
    title: 'Aliquote di imposta alla fonte Tabella A, edizione 2025',
    url: 'https://www4.ti.ch/fileadmin/DFE/DC/DOC-IF/Aliquote_2025/Ticino_tabella_A_2025.pdf',
    pdf: true,
  },
  'ti-2025-source-tax-tabella-b': {
    title: 'Aliquote di imposta alla fonte Tabella B, edizione 2025',
    url: 'https://www4.ti.ch/fileadmin/DFE/DC/DOC-IF/Aliquote_2025/Ticino_tabella_B_2025.pdf',
    pdf: true,
  },
  'ti-2025-source-tax-tabella-c': {
    title: 'Aliquote di imposta alla fonte Tabella C, edizione 2025',
    url: 'https://www4.ti.ch/fileadmin/DFE/DC/DOC-IF/Aliquote_2025/Ticino_tabella_C_2025.pdf',
    pdf: true,
  },
  'ti-2025-source-tax-tabella-h': {
    title: 'Aliquote di imposta alla fonte Tabella H, Edizione 2025',
    url: 'https://m4.ti.ch/fileadmin/DFE/DC/DOC-IF/Aliquote_2025/Ticino_tabella_H_2025.pdf',
    pdf: true,
  },
  'ti-2025-source-tax-tables-index': {
    title: "Tabelle di calcolo dell'imposta alla fonte",
    url: 'https://www4.ti.ch/dfe/dc/dichiarazione/imposte-alla-fonte-1/tabelle-di-calcolo-dellimposta-alla-fonte',
    pdf: false,
  },
  'ti-2025-tariff-decreto-esecutivo-pf': {
    title:
      "Decreto esecutivo concernente l'imposizione delle persone fisiche valido per il periodo fiscale 2025 (del 6 novembre 2024, BU 36/2024)",
    url: 'https://www4.ti.ch/fileadmin/DFE/DC/DOC-TRIBUTARIA/2025/D-BU_036-DE_Imposizione_PF_2025.pdf',
    pdf: true,
  },
  'ti-2026-communal-rates': {
    title: 'Moltiplicatori comunali',
    url: 'https://www4.ti.ch/dfe/dc/sportello/moltiplicatori-comunali',
    pdf: false,
  },
  'ti-2026-deductions-lt-art25': {
    title:
      'Legge tributaria (LT), modifica del 10 giugno 2026: art. 25 cpv. 2, deduzioni per le altre spese professionali (BU 28/2026)',
    url: 'https://www4.ti.ch/fileadmin/DFE/DC/DOC-TRIBUTARIA/2026/BU_028.pdf',
    pdf: true,
  },
  'ti-2026-source-tax-directive': {
    title: 'Direttiva cantonale in ambito imposte alla fonte (vers. 1.0 del 01.01.2026)',
    url: 'https://www4.ti.ch/fileadmin/DFE/DC/DOC-IF/Direttive/Direttiva_UIF__vers._1.0_del_01.01.2026_.pdf',
    pdf: true,
  },
  'ti-2026-source-tax-tabella-a': {
    title: 'Aliquote di imposta alla fonte Tabella A, edizione 2026',
    url: 'https://www4.ti.ch/fileadmin/DFE/DC/DOC-IF/Aliquote_2026/Ticino_tabella_A_2026.pdf',
    pdf: true,
  },
  'ti-2026-source-tax-tabella-b': {
    title: 'Aliquote di imposta alla fonte Tabella B, edizione 2026',
    url: 'https://www4.ti.ch/fileadmin/DFE/DC/DOC-IF/Aliquote_2026/Ticino_tabella_B_2026.pdf',
    pdf: true,
  },
  'ti-2026-source-tax-tabella-c': {
    title: 'Aliquote di imposta alla fonte Tabella C, edizione 2026',
    url: 'https://www4.ti.ch/fileadmin/DFE/DC/DOC-IF/Aliquote_2026/Ticino_tabella_C_2026.pdf',
    pdf: true,
  },
  'ti-2026-source-tax-tabella-h': {
    title: 'Aliquote di imposta alla fonte Tabella H, Edizione 2026',
    url: 'https://www4.ti.ch/fileadmin/DFE/DC/DOC-IF/Aliquote_2026/Ticino_tabella_H_2026.pdf',
    pdf: true,
  },
  'ti-2026-source-tax-tables-index': {
    title: "Tabelle di calcolo dell'imposta alla fonte",
    url: 'https://www4.ti.ch/dfe/dc/dichiarazione/imposte-alla-fonte-1/tabelle-di-calcolo-dellimposta-alla-fonte',
    pdf: false,
  },
  'ti-2026-tariff-decreto-esecutivo-pf': {
    title:
      "Decreto esecutivo concernente l'imposizione delle persone fisiche valido per il periodo fiscale 2026 (del 7 ottobre 2026, BU 34/2026)",
    url: 'https://www4.ti.ch/fileadmin/DFE/DC/DOC-TRIBUTARIA/2026/DE_Persone_fisiche_2026_7_10_2026.pdf',
    pdf: true,
  },
  'ti-na-calculators-pf': {
    title: "Calcolatori d'imposta",
    url: 'https://www4.ti.ch/dfe/dc/sportello/calcolatori-dimposta/',
    pdf: false,
  },
  'ti-na-efiling-rpeaf': {
    title: 'Regolamento sulle procedure elettroniche in ambito fiscale (RPEAF)',
    url: 'https://m3.ti.ch/CAN/RLeggi/public/index.php/raccolta-leggi/pdfatto/atto/10605',
    pdf: true,
  },
  'ti-na-law-lt-640-100': {
    title: 'Legge tributaria del 21 giugno 1994 (LT), 640.100',
    url: 'https://m3.ti.ch/CAN/RLeggi/public/index.php/index/nuovafinestra/atto/580/volume/numLegge',
    pdf: false,
  },
  'ti-na-sel-modifiche-legislazione': {
    title:
      'Impatto sui comuni di revisioni della legislazione fiscale e di altre importanti decisioni del Parlamento o del Popolo (nota del 25.09.2026)',
    url: 'https://www4.ti.ch/fileadmin/DI/DI_DI/SEL/Comuni/DatiFinanziari/NOT20260925-Modifiche_legislazione_tributaria-DEF.pdf',
    pdf: true,
  },
  'ti-na-software-house-source-tax': {
    title: 'File per Software House',
    url: 'https://www4.ti.ch/dfe/dc/dichiarazione/imposte-alla-fonte-1/software-house',
    pdf: false,
  },
  'ti-na-source-tax-rectification': {
    title: "Richiesta di correzione dell'imposizione alla fonte",
    url: 'https://www4.ti.ch/index.php?id=127378',
    pdf: false,
  },
};
