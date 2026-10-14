// The official Aargau documents Taxpresso cites (SPEC.md 7b), with the URL of each as listed in
// docs/sources/ag/manifest.json. Data only: the extension never opens these links itself (C2); the
// user's browser does, when they click one. A test keeps every entry equal to the manifest
// (test/sources.test.ts).
import type { OfficialDocument } from '@taxpresso/rules-ch';

export type { OfficialDocument } from '@taxpresso/rules-ch';

export const AG_OFFICIAL_DOCUMENTS: Readonly<Record<string, OfficialDocument>> = {
  'ag-2025-communal-steuerfuesse': {
    title: 'Verzeichnis der Gemeinde- und Kirchensteuerfüsse für das Jahr 2025',
    url: 'https://www.ag.ch/media/kanton-aargau/dfr/dokumente/steuern/natuerliche-personen/steuerberechnung-tarife-natuerliche-personen/gemeinde-und-kirchensteuerf-sse-2025-v6.pdf',
    pdf: true,
  },
  'ag-2025-deductions-spenden-institutionen': {
    title: 'Liste Zuwendungen (Spenden) an Institutionen',
    url: 'https://www.ag.ch/media/kanton-aargau/dfr/dokumente/steuern/natuerliche-personen/merkblaetter-zu-steuern-natuerliche-personen/zuwendungen-spenden-an-institutionen-stp-2025.pdf',
    pdf: true,
  },
  'ag-2025-efiling-belege-online': {
    title: 'eTAX AARGAU Natürliche Personen: Liste der notwendigen Belege bei Online-Übermittlung',
    url: 'https://www.ag.ch/media/kanton-aargau/dfr/dokumente/steuern/natuerliche-personen/etax-aargau/20260105-etax-belegeonline.pdf',
    pdf: true,
  },
  'ag-2025-guide-wegleitung': {
    title: 'Wegleitung zur Steuererklärung 2025',
    url: 'https://www.ag.ch/media/kanton-aargau/dfr/dokumente/steuern/natuerliche-personen/steuererklaerung/wegleitung-zur-steuererkl-rung-2025-kanton-aargau.pdf',
    pdf: true,
  },
  'ag-2025-other-formularbestellung': {
    title: 'Bestellung Formulare Steuerperiode 2025 für natürliche Personen',
    url: 'https://www.ag.ch/media/kanton-aargau/dfr/dokumente/steuern/natuerliche-personen/steuerformulare-natuerliche-personen/2025-steuerformulare-bestellen.xlsx',
    pdf: false,
  },
  'ag-2025-source-tax-tarif-mit-kirchensteuer': {
    title: 'Quellensteuer 2025 Monatstarif mit Kirchensteuer (Y)',
    url: 'https://www.ag.ch/media/kanton-aargau/dfr/dokumente/steuern/quellensteuer/quellensteuer-arbeitgebende/qust-tarife-und-wegleitungen/quellensteuer-monatstarif-mit-kirchensteuer-ausgabe-2025.pdf',
    pdf: true,
  },
  'ag-2025-source-tax-tarif-ohne-kirchensteuer': {
    title: 'Quellensteuer 2025 Monatstarif ohne Kirchensteuer (N)',
    url: 'https://www.ag.ch/media/kanton-aargau/dfr/dokumente/steuern/quellensteuer/quellensteuer-arbeitgebende/qust-tarife-und-wegleitungen/quellensteuer-monatstarif-ohne-kirchensteuer-ausgabe-2025.pdf',
    pdf: true,
  },
  'ag-2025-tariff-einkommenssteuer': {
    title: 'Tarif für die Einkommenssteuer 2025',
    url: 'https://www.ag.ch/media/kanton-aargau/dfr/dokumente/steuern/natuerliche-personen/steuerberechnung-tarife-natuerliche-personen/einkommenssteuertarif-2025.pdf',
    pdf: true,
  },
  'ag-2025-tariff-vermoegenssteuer': {
    title: 'Tarif für die Vermögenssteuer 2025',
    url: 'https://www.ag.ch/media/kanton-aargau/dfr/dokumente/steuern/natuerliche-personen/steuerberechnung-tarife-natuerliche-personen/verm-genssteuertarif-2025.pdf',
    pdf: true,
  },
  'ag-2026-communal-kantonssteuerfuss-zinssaetze': {
    title: 'Steuerfüsse und Zinssätze Natürliche Personen',
    url: 'https://www.ag.ch/media/kanton-aargau/dfr/dokumente/steuern/natuerliche-personen/bezahlen-der-steuern-natuerliche-personen/steuerfuesse-zinssaetze-np-2026.pdf',
    pdf: true,
  },
  'ag-2026-communal-steuerfuesse': {
    title: 'Verzeichnis der Gemeinde- und Kirchensteuerfüsse für das Jahr 2026',
    url: 'https://www.ag.ch/media/kanton-aargau/dfr/dokumente/steuern/natuerliche-personen/steuerberechnung-tarife-natuerliche-personen/gemeinde-und-kirchensteuerf-sse-2026-v5.pdf',
    pdf: true,
  },
  'ag-2026-deductions-kinderbetreuungskosten': {
    title: 'Merkblatt Kinderbetreuungskosten',
    url: 'https://www.ag.ch/media/kanton-aargau/dfr/dokumente/steuern/natuerliche-personen/merkblaetter-zu-steuern-natuerliche-personen/kinderbetreuungskosten.pdf',
    pdf: true,
  },
  'ag-2026-deductions-uebersicht-abzuege': {
    title:
      'Übersicht gesetzliche Abzüge bei der Einkommenssteuer für die Kantons- und Gemeindesteuern §§ 35 bis 42 StG',
    url: 'https://www.ag.ch/media/kanton-aargau/dfr/dokumente/steuern/natuerliche-personen/steuerthemen-natuerliche-personen/bersicht-abz-ge-np-12-2025.pdf',
    pdf: true,
  },
  'ag-2026-deductions-versicherungspauschale': {
    title:
      'Pauschalabzug für Versicherungsprämien und Sparkapitalzinsen für die Steuerperiode 2026; Anpassung an die Prämienentwicklung gemäss § 40 Abs. 2 StG; Berechnungsgrundlagen',
    url: 'https://www.ag.ch/media/kanton-aargau/dfr/dokumente/steuern/natuerliche-personen/steuerthemen-natuerliche-personen/2025-09-24-bericht-anpassung-versicherungsabzug-an-praemienentwicklung.pdf',
    pdf: true,
  },
  'ag-2026-deductions-weiterbildungskosten': {
    title: 'Merkblatt Aus-, Weiterbildungs- und Umschulungskosten',
    url: 'https://www.ag.ch/media/kanton-aargau/dfr/dokumente/steuern/natuerliche-personen/merkblaetter-zu-steuern-natuerliche-personen/aus-weiterbildungs-und-umschulungskosten-2026.pdf',
    pdf: true,
  },
  'ag-2026-law-quellensteuerverordnung': {
    title: 'Verordnung über die Quellensteuer (QStV-AG)',
    url: 'https://gesetzessammlungen.ag.ch/api/de/versions/3911/pdf_file',
    pdf: true,
  },
  'ag-2026-law-steuerverordnung': {
    title: 'Verordnung zum Steuergesetz (StGV)',
    url: 'https://gesetzessammlungen.ag.ch/api/de/versions/3915/pdf_file',
    pdf: true,
  },
  'ag-2026-law-vevst': {
    title: 'Verordnung über elektronische Verfahren im Steuerbereich (VeVSt)',
    url: 'https://gesetzessammlungen.ag.ch/api/de/versions/3872/pdf_file',
    pdf: true,
  },
  'ag-2026-source-tax-tarif-mit-kirchensteuer': {
    title: 'Quellensteuer 2026 Monatstarif mit Kirchensteuer (Y)',
    url: 'https://www.ag.ch/media/kanton-aargau/dfr/dokumente/steuern/quellensteuer/quellensteuer-arbeitgebende/qust-tarife-und-wegleitungen/quellensteuer-monatstarif-mit-kirchensteuer-ausgabe-2026-1.pdf',
    pdf: true,
  },
  'ag-2026-source-tax-tarif-ohne-kirchensteuer': {
    title: 'Quellensteuer 2026 Monatstarif ohne Kirchensteuer (N)',
    url: 'https://www.ag.ch/media/kanton-aargau/dfr/dokumente/steuern/quellensteuer/quellensteuer-arbeitgebende/qust-tarife-und-wegleitungen/quellensteuer-monatstarif-ohne-kirchensteuer-ausgabe-2026.pdf',
    pdf: true,
  },
  'ag-2026-tariff-progressionsverordnung': {
    title:
      'Verordnung über die Anpassung des Steuergesetzes an die Teuerung (Progressionsverordnung 2025)',
    url: 'https://gesetzessammlungen.ag.ch/api/de/versions/3895/pdf_file',
    pdf: true,
  },
  'ag-na-deductions-krankheitskosten': {
    title: 'Merkblatt Krankheits- und Unfallkosten sowie behinderungsbedingte Kosten',
    url: 'https://www.ag.ch/media/kanton-aargau/dfr/dokumente/steuern/natuerliche-personen/merkblaetter-zu-steuern-natuerliche-personen/2021-mb-krankheitskosten.pdf',
    pdf: true,
  },
  'ag-na-efiling-etax-aargau': {
    title: 'Ihre Steuererklärung mit eTAX AARGAU',
    url: 'https://www.ag.ch/de/themen/steuern-finanzen/steuern/steuererklaerung-einreichen/etax-aargau',
    pdf: false,
  },
  'ag-na-efiling-etax-fachinfo': {
    title: 'eTAX AARGAU Fachinformationen',
    url: 'https://www.ag.ch/de/themen/steuern-finanzen/steuern/steuererklaerung-einreichen/etax-aargau/etax-aargau-fachinfo',
    pdf: false,
  },
  'ag-na-efiling-etax-hilfe': {
    title: 'eTAX AARGAU Natürliche Personen Hilfe & Anleitungen',
    url: 'https://www.ag.ch/de/themen/steuern-finanzen/steuern/steuererklaerung-einreichen/etax-aargau/etax-aargau-hilfe-anleitungen',
    pdf: false,
  },
  'ag-na-efiling-steuererklaerung-einreichen': {
    title: 'Steuererklärung einreichen',
    url: 'https://www.ag.ch/de/themen/steuern-finanzen/steuern/steuererklaerung-einreichen/steuererklaerung-einreichen',
    pdf: false,
  },
  'ag-na-law-steuergesetz': {
    title: 'Steuergesetz (StG)',
    url: 'https://gesetzessammlungen.ag.ch/api/de/versions/4018/pdf_file',
    pdf: true,
  },
  'ag-na-other-esteuerauszug': {
    title: 'eSteuerauszug',
    url: 'https://www.ag.ch/de/themen/steuern-finanzen/steuern-startseite/alles-zu-steuern?dc=e22c5f9c-d44e-447a-afb2-69f3f7d01148_de',
    pdf: false,
  },
  'ag-na-source-tax-antrag-neuberechnung': {
    title: 'Antrag auf Neuberechnung der Quellensteuer',
    url: 'https://www.ag.ch/media/kanton-aargau/dfr/dokumente/steuern/quellensteuer/quellensteuer-arbeitnehmende/antrag-neuberechnung-247.pdf',
    pdf: true,
  },
  'ag-na-source-tax-nov-beantragen': {
    title: 'Nachträgliche ordentliche Veranlagung beantragen',
    url: 'https://www.ag.ch/de/smartserviceportal/dienstleistungen?dl=nachtraegliche-ordentliche-veranlagung-beantragen-08fb882a-157a-4b9d-8a40-6c690d107e06_de',
    pdf: false,
  },
  'ag-na-source-tax-quellensteuerpflichtige-personen': {
    title: 'Quellensteuerpflichtige Personen',
    url: 'https://www.ag.ch/de/themen/steuern-finanzen/steuern/qellensteuern-abwickeln/quellensteuerpflichtige-personen',
    pdf: false,
  },
  'ag-na-source-tax-tarife-index': {
    title: 'Quellensteuertarife',
    url: 'https://www.ag.ch/de/themen/steuern-finanzen/steuern/qellensteuern-abwickeln/quellensteuertarife',
    pdf: false,
  },
  'ag-na-tariff-steuern-berechnen': {
    title: 'Steuern berechnen',
    url: 'https://www.ag.ch/de/themen/steuern-finanzen/steuern/steuern-berechnen/steuerberechnungen-neu',
    pdf: false,
  },
};
