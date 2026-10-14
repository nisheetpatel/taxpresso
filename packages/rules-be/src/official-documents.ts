// The official Bern documents Taxpresso cites (SPEC.md 7b), with the URL of each as listed in
// docs/sources/be/manifest.json. Data only: the extension never opens these links itself (C2); the
// user's browser does, when they click one. A test keeps every entry equal to the manifest
// (test/sources.test.ts).
import type { OfficialDocument } from '@taxpresso/rules-ch';

export type { OfficialDocument } from '@taxpresso/rules-ch';

export const BE_OFFICIAL_DOCUMENTS: Readonly<Record<string, OfficialDocument>> = {
  'be-2025-info-np-jan2026-de': {
    title: 'Aktuelles aus Ihrer Steuerverwaltung: Wichtig zu wissen für Ihre Steuererklärung 2025',
    url: 'https://www.sv.fin.be.ch/content/dam/sv_fin/dokumente/de/info_10minuten/info-np_januar2026_de.pdf',
    pdf: true,
  },
  'be-2025-nov-antrag-ansaessig-de': {
    title: 'Antrag nachträgliche ordentliche Veranlagung (NOV) für Ansässige',
    url: 'https://www.sv.fin.be.ch/content/dam/sv_fin/dokumente/de/formulare/quellensteuer/aktuelles_steuerjahr/form_qst_antrag-nov-ansaessig_de.pdf',
    pdf: true,
  },
  'be-2025-nov-info-de': {
    title: 'Nachträgliche ordentliche Veranlagung (NOV), Aktuelles aus Ihrer Steuerverwaltung 2025',
    url: 'https://www.sv.fin.be.ch/content/dam/sv_fin/dokumente/de/info_10minuten/info-nov_de.pdf',
    pdf: true,
  },
  'be-2025-quellensteuer-tabellen-de': {
    title:
      "Steuertabellen für die Quellensteuer, Ausgabe 2025 / Barèmes fiscaux concernant l'impôt à la source, Edition 2025",
    url: 'https://www.sv.fin.be.ch/content/dam/sv_fin/dokumente/de/qst_quellensteuertabelle_2025_de_fr.pdf',
    pdf: true,
  },
  'be-2025-quellensteuer-tabellen-xlsx': {
    title: 'Steuertabellen Quellensteuer 2025',
    url: 'https://www.sv.fin.be.ch/content/dam/sv_fin/dokumente/de/qst_quellensteuertabelle_2025_de-fr.xlsx',
    pdf: false,
  },
  'be-2025-steueranlagen-gemeinden-de': {
    title:
      'Steueranlagen der Gemeinden und Steuersätze der Kirchgemeinden für 2025 (Dokument 556.6)',
    url: 'https://www.fin.be.ch/content/dam/fin/dokumente/de/finanzverwaltung/finanzausgleich/publikationen/fv-stat-steueranlage_2025.pdf',
    pdf: true,
  },
  'be-2025-steuererklaerung-formulare-de': {
    title: 'Steuererklärung 2025 Natürliche Personen',
    url: 'https://www.sv.fin.be.ch/content/dam/sv_fin/dokumente/de/loesung-formulare_de.pdf',
    pdf: true,
  },
  'be-2025-stg-de': {
    title: 'Steuergesetz (StG) vom 21.05.2000 (Stand 01.01.2025), BSG 661.11',
    url: 'https://www.belex.sites.be.ch/api/de/versions/3018/pdf_file',
    pdf: true,
  },
  'be-2025-tariff-einkommen-alleinstehende': {
    title: 'Einkommenssteuer (Art. 42 Abs. 2 - Alleinstehende), ab Steuerjahr 2025',
    url: 'https://www.taxinfo.sv.fin.be.ch/taxinfo/f56cd527-72c9-4a47-9552-5d0aaf1ba8cf',
    pdf: true,
  },
  'be-2025-tariff-einkommen-verheiratete': {
    title: 'Einkommenssteuer (Art. 42 Abs. 1 - Verheiratete), ab Steuerjahr 2025',
    url: 'https://www.taxinfo.sv.fin.be.ch/taxinfo/a2435e4c-8d14-4692-a542-9820c2d6281e',
    pdf: true,
  },
  'be-2025-wegleitung-aenderungen-de': {
    title: 'Wegleitung Natürliche Personen 2024 / 2025 (Änderungen)',
    url: 'https://www.sv.fin.be.ch/content/dam/sv_fin/dokumente/de/wegleitungen/2025/wl_natuerliche-personen_2025-2024-aenderungen_de.pdf',
    pdf: true,
  },
  'be-2025-wegleitung-np-de': {
    title: 'Wegleitung Natürliche Personen 2025',
    url: 'https://www.wegleitung.sv.fin.be.ch/content/dam/sv_fin/dokumente/de/wegleitungen/2025/wl_natuerliche-personen_2025_de.pdf',
    pdf: true,
  },
  'be-2025-wegleitung-np-fr': {
    title: 'Guide Personnes physiques 2025',
    url: 'https://www.wegleitung.sv.fin.be.ch/content/dam/sv_fin/dokumente/fr/wegleitungen/2025/wl_natuerliche-personen_2025_fr.pdf',
    pdf: true,
  },
  'be-2026-quellensteuer-berechnungsgrundlagen': {
    title:
      'Grundlagen für die Berechnung der Quellensteuertarife des Kantons Bern, Steuerjahr 2026',
    url: 'https://www.sv.fin.be.ch/content/dam/sv_fin/dokumente/de/qst_berechnung-quellensteuertarife_de.xlsx',
    pdf: false,
  },
  'be-2026-quellensteuer-tabellen-de': {
    title:
      "Steuertabellen für die Quellensteuer, Edition 2026 / Barèmes fiscaux concernant l'impôt à la source",
    url: 'https://www.sv.fin.be.ch/content/dam/sv_fin/dokumente/de/qst_quellensteuertabelle_2026_de_fr.pdf',
    pdf: true,
  },
  'be-2026-quellensteuer-tabellen-xlsx': {
    title: 'Steuertabellen Quellensteuer 2026',
    url: 'https://www.sv.fin.be.ch/content/dam/sv_fin/dokumente/de/qst_quellensteuertabelle_2026_de-fr.xlsx',
    pdf: false,
  },
  'be-2026-steueranlagen-gemeinden-de': {
    title:
      'Steueranlagen der Gemeinden und Steuersätze der Kirchgemeinden für 2026 (Dokument 556.6)',
    url: 'https://www.fin.be.ch/content/dam/fin/dokumente/de/finanzverwaltung/finanzausgleich/publikationen/fv-stat-steueranlage_2026_1.pdf',
    pdf: true,
  },
  'be-2026-stg-de': {
    title: 'Steuergesetz (StG) vom 21.05.2000 (Stand 01.01.2026), BSG 661.11',
    url: 'https://www.belex.sites.be.ch/api/de/versions/3330/pdf_file',
    pdf: true,
  },
  'be-2026-tariff-einkommen-alleinstehende': {
    title: 'Einkommenssteuer (Art. 42 Abs. 2 - Alleinstehende), ab Steuerjahr 2026',
    url: 'https://www.taxinfo.sv.fin.be.ch/taxinfo/f244ba97-5848-473f-9037-0621b32f8836',
    pdf: true,
  },
  'be-2026-tariff-einkommen-verheiratete': {
    title: 'Einkommenssteuer (Art. 42 Abs. 1 - Verheiratete), ab Steuerjahr 2026',
    url: 'https://www.taxinfo.sv.fin.be.ch/taxinfo/36f0ac7e-6293-4612-90dd-e4a1cb2f5915',
    pdf: true,
  },
  'be-na-communal-steueranlagen-1983-2026': {
    title: 'Steueranlagen der Gemeinden von 1983 bis 2026',
    url: 'https://www.sv.fin.be.ch/content/dam/sv_fin/dokumente/de/gemeindeanlagen_de_fr.xlsx',
    pdf: false,
  },
  'be-na-deductions-abzuege-freigrenzen': {
    title: 'Abzüge und Freigrenzen nach Steuerjahr (Abzüge 2022-2026)',
    url: 'https://www.taxinfo.sv.fin.be.ch/_assets/file/phonemos-media%3Afile.id%3A3513189d-e092-48b0-8e66-d084e51af8ad/Abz%C3%BCge%202022-2026.xlsx',
    pdf: false,
  },
  'be-na-deductions-berufskostenverordnung': {
    title:
      'Verordnung über die Berufskosten (Berufskostenverordnung, BKV) vom 18.10.2000 (Stand 01.01.2024), BSG 661.312.56',
    url: 'https://www.belex.sites.be.ch/api/de/versions/2873/pdf_file',
    pdf: true,
  },
  'be-na-deductions-taxinfo-fahrkosten': {
    title: 'Fahrkosten für den Arbeitsweg',
    url: 'https://www.taxinfo.sv.fin.be.ch/taxinfo/1613b2e2-276f-4293-ad05-3995d29b40cb',
    pdf: false,
  },
  'be-na-deductions-taxinfo-homeoffice': {
    title: 'Homeoffice bei unselbständiger Erwerbstätigkeit',
    url: 'https://www.taxinfo.sv.fin.be.ch/taxinfo/233e0b49-8907-4294-8057-0fa76116a4b2',
    pdf: false,
  },
  'be-na-deductions-taxinfo-kinderdrittbetreuung': {
    title: 'Kinderdrittbetreuungskosten',
    url: 'https://www.taxinfo.sv.fin.be.ch/taxinfo/291bf1b9-10c8-42eb-bdd4-fd54f1a8e708',
    pdf: false,
  },
  'be-na-deductions-taxinfo-krankheitskosten': {
    title: 'Krankheits- und Unfallkosten',
    url: 'https://www.taxinfo.sv.fin.be.ch/taxinfo/e11abaa8-c657-4848-bedd-4f4d5a647c4d',
    pdf: false,
  },
  'be-na-deductions-taxinfo-saeule-3a': {
    title: 'Beiträge an die Säule 3a (gebundene Vorsorge)',
    url: 'https://www.taxinfo.sv.fin.be.ch/taxinfo/a2830da2-1a00-4928-b58b-74da5d48a598',
    pdf: false,
  },
  'be-na-deductions-taxinfo-versicherungsabzug': {
    title: 'Versicherungsabzug',
    url: 'https://www.taxinfo.sv.fin.be.ch/taxinfo/fb35fd5b-0bd3-46c6-a28c-1656bec91f3b',
    pdf: false,
  },
  'be-na-deductions-taxinfo-weiterbildung': {
    title: 'Berufsorientierte Aus- und Weiterbildung',
    url: 'https://www.taxinfo.sv.fin.be.ch/taxinfo/8fc11889-fa95-4160-b59a-8cba8f1ad457',
    pdf: false,
  },
  'be-na-deductions-taxinfo-zweiverdienerabzug': {
    title: 'Zweiverdienerabzug',
    url: 'https://www.taxinfo.sv.fin.be.ch/taxinfo/5818ab45-a359-4462-8370-d93149535249',
    pdf: false,
  },
  'be-na-dr-tax-faq-treuhaender-de': {
    title: 'Dr. Tax Steuererklärungen: Häufige Fragen, Sicht Treuhänder/Treuhänderin',
    url: 'https://www.sv.fin.be.ch/content/dam/sv_fin/dokumente/de/argumentarium_dr-tax_treuhaender_de.pdf',
    pdf: true,
  },
  'be-na-dr-tax-leitfaden-de': {
    title: 'Steuererklärung online einreichen via Dr. Tax (Sicht Treuhänder)',
    url: 'https://www.sv.fin.be.ch/content/dam/sv_fin/dokumente/de/leitfaden_online_dr-tax_de.pdf',
    pdf: true,
  },
  'be-na-law-quellensteuerverordnung': {
    title: 'Quellensteuerverordnung (QSV) vom 16.09.2020 (Stand 01.01.2021), BSG 661.711.1',
    url: 'https://www.belex.sites.be.ch/api/de/versions/2017/pdf_file',
    pdf: true,
  },
  'be-na-nov-antrag-nichtansaessig-de': {
    title: 'Antrag nachträgliche ordentliche Veranlagung (NOV) für Nichtansässige',
    url: 'https://www.sv.fin.be.ch/content/dam/sv_fin/dokumente/de/formulare/quellensteuer/aktuelles_steuerjahr/form_qst_antrag-nov-nichtansaessig_de.pdf',
    pdf: true,
  },
  'be-na-other-taxinfo-ausgleich-kalte-progression': {
    title: 'Ausgleich der kalten Progression',
    url: 'https://www.taxinfo.sv.fin.be.ch/taxinfo/44dcc198-4a11-4ab4-aabc-051e94ae01f2',
    pdf: false,
  },
  'be-na-source-tax-taxinfo-nov-auf-antrag': {
    title: 'Nachträgliche ordentliche Veranlagung auf Antrag',
    url: 'https://www.taxinfo.sv.fin.be.ch/taxinfo/0f9796b7-81dc-4504-95cc-8a31400e94f4',
    pdf: false,
  },
  'be-na-source-tax-taxinfo-nov-obligatorisch': {
    title: 'Obligatorische nachträgliche ordentliche Veranlagung',
    url: 'https://www.taxinfo.sv.fin.be.ch/taxinfo/1ddebd20-de30-4181-9913-0cb49aeea127',
    pdf: false,
  },
  'be-na-tariff-taxinfo-tarif-einkommenssteuer': {
    title: 'Tarif Einkommenssteuer',
    url: 'https://www.taxinfo.sv.fin.be.ch/taxinfo/f3ad83d5-30d6-41c9-8f79-c34e192c57ad',
    pdf: false,
  },
};
