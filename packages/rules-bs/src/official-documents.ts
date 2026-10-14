// The official Basel-Stadt documents Taxpresso cites (SPEC.md 7b), with the URL of each as listed in
// docs/sources/bs/manifest.json. Data only: the extension never opens these links itself (C2); the
// user's browser does, when they click one. A test keeps every entry equal to the manifest
// (test/sources.test.ts).
import type { OfficialDocument } from '@taxpresso/rules-ch';

export type { OfficialDocument } from '@taxpresso/rules-ch';

export const BS_OFFICIAL_DOCUMENTS: Readonly<Record<string, OfficialDocument>> = {
  'bs-2025-communal-ansaetze-abzuege': {
    title:
      'Verzeichnis der Ansätze, Devisenkurse, Abzüge und Freibeträge für die Steuern von natürlichen Personen (18000.a.01.25)',
    url: 'https://media.bs.ch/original_file/138a8e2fb06d920cb89292256f1f3bee8aa06acb/18000-mb-np-ansaetze-devisenkurse-abzuege-freibetraege-v2025.pdf',
    pdf: true,
  },
  'bs-2025-deductions-spendenliste': {
    title: 'Spendenliste des Kantons Basel-Stadt, Ausgabe 2025',
    url: 'https://media.bs.ch/original_file/9562c945e5b6156eb0db6fac8cdbd6111cc0b235/18003-mb-np-spendenliste-internet-2025.pdf',
    pdf: true,
  },
  'bs-2025-efiling-baltax-tipps': {
    title: 'Hinweise und Tipps zu BalTax 2025',
    url: 'https://media.bs.ch/original_file/bfbf34b4727f4f55d7664f5bd2977ae7073a90db/hinweise-und-tipps-zu-baltax-2025.pdf',
    pdf: true,
  },
  'bs-2025-efiling-einreichen-page': {
    title: 'Steuererklärung als natürliche Person einreichen',
    url: 'https://www.bs.ch/themen/arbeit-und-steuern/steuererklaerung/steuererklaerung-als-natuerliche-person-einreichen',
    pdf: false,
  },
  'bs-2025-efiling-einreichungscode': {
    title: 'Steuererklärung 2025 - Ihr persönlicher Einreichungscode',
    url: 'https://media.bs.ch/original_file/6f42a4d02a6b52dbd9d2cdb989149cfa8b7fcd2a/15003-fw-np-ste-25-01-steuererklaerungsschreiben-baltax-ansi.pdf',
    pdf: true,
  },
  'bs-2025-efiling-steuerportal': {
    title: 'Steuerportal und BalTax Online',
    url: 'https://www.bs.ch/themen/arbeit-und-steuern/steuererklaerung/steuererklaerung-natuerliche-person/steuerportal-und-baltax-online',
    pdf: false,
  },
  'bs-2025-form-au-alimente-unterstuetzung': {
    title: 'Alimente A und Unterstützungen U 2025',
    url: 'https://media.bs.ch/original_file/75bda6a1c7cf7c27d9dff2af6fa2d4d9a747811b/15025-fw-np-ste-25-02-alimente-unterstuetzungen-ansichtsexem.pdf',
    pdf: true,
  },
  'bs-2025-form-b-berufskosten': {
    title: 'Berufskosten 2025 (Formular B)',
    url: 'https://media.bs.ch/original_file/630cae1c108bb2f52c9d0b4e45506b4f22e695d5/15020-fw-np-ste-25-02-berufskosten-ansichtsexemplar.pdf',
    pdf: true,
  },
  'bs-2025-form-d-da1-r-us164': {
    title:
      'Antrag auf Anrechnung ausländischer Quellensteuern (DA-1) und zusätzlichen Steuerrückbehalt USA (R-US164) 2025',
    url: 'https://media.bs.ch/original_file/056175efd152d9ef946c9127a1a5314869093d5d/15006-fw-np-ste-25-02-da-1-r-us164-ansichtsexemplar.pdf',
    pdf: true,
  },
  'bs-2025-form-einlagemappe-baltax': {
    title: 'Einlagemappe für Steuerunterlagen BalTax 2025',
    url: 'https://media.bs.ch/original_file/9fb72405911ebf9381999258d1d507db44afe6e7/15001-fw-np-ste-25-01-einlagemappe-baltax-ansichtsexemplar.pdf',
    pdf: true,
  },
  'bs-2025-form-hauptformular': {
    title: 'Steuererklärung 2025, Hauptformular Seite 1-4 für natürliche Personen',
    url: 'https://media.bs.ch/original_file/65fcfdaa82df1b23cb365a951416678aef461436/15000-fw-np-ste-25-02-hauptformular-ansichtsexemplar-0.pdf',
    pdf: true,
  },
  'bs-2025-form-kzf-krankheit-zuwendung-betreuung': {
    title: 'Formular K Krankheitskosten, Z Zuwendungen, F Kinderbetreuungskosten 2025',
    url: 'https://media.bs.ch/original_file/b40d5308954ad20f3d8b2e099f1eabbabe2046f8/15030-fw-np-ste-25-02-krankheitskosten-zuwendungen-kinderbet.pdf',
    pdf: true,
  },
  'bs-2025-form-l-liegenschaftenverzeichnis': {
    title: 'Liegenschaftenverzeichnis 2025 (Formular L)',
    url: 'https://media.bs.ch/original_file/42fecba0b8955fdf783e79c947ede1be59c505a1/15010-fw-np-ste-25-02-liegenschaftenverzeichnis-ansichtsexem.pdf',
    pdf: true,
  },
  'bs-2025-form-s-schuldenverzeichnis': {
    title: 'Schuldenverzeichnis 2025 (Formular S)',
    url: 'https://media.bs.ch/original_file/20188e7f0fe396b6200d6fb5e299804e81eac86a/15015-fw-np-ste-25-02-schuldenverzeichnis-ansichtsexemplar.pdf',
    pdf: true,
  },
  'bs-2025-form-w-wertschriftenverzeichnis': {
    title: 'Wertschriftenverzeichnis 2025 (Formular W)',
    url: 'https://media.bs.ch/original_file/07ff9ff885bd49287097c681c0bafe39b232923f/15005-fw-np-ste-25-01-wertschriftenverzeichnis-ansichtsexemp.pdf',
    pdf: true,
  },
  'bs-2025-guide-wegleitung': {
    title: 'Wegleitung zur Steuererklärung 2025 für natürliche Personen',
    url: 'https://media.bs.ch/original_file/909f72222b7511334f4dc4d1b9aeb74a9f5cc54c/15500-fw-np-ste-25-05-wegleitung-bf-1.pdf',
    pdf: true,
  },
  'bs-2025-law-stg': {
    title: 'Gesetz über die direkten Steuern (Steuergesetz, StG), SG 640.100, Stand 1. Januar 2025',
    url: 'https://www.gesetzessammlung.bs.ch/api/de/versions/6558/pdf_file',
    pdf: true,
  },
  'bs-2025-other-krypto-merkblatt': {
    title:
      'Besteuerung von Kryptowährungen und von passivem Einkommen aus Verdiensten im Internet bei natürlichen Personen',
    url: 'https://media.bs.ch/original_file/8c06838fade72c9930ac1c73967eca9ad0e70707/18023-mb-np-kryptowaehrungen-cd-bf.pdf',
    pdf: true,
  },
  'bs-2025-source-tax-wegleitung': {
    title: 'Wegleitung und Tarife zur Quellenbesteuerung, Ausgabe 2025 (19000.a.01.25)',
    url: 'https://media.bs.ch/original_file/40246fa5532f29efb46e23a14ac580c4c6add64e/19000-mb-qst-a-25-wegleitung-und-tariftabellen-0.pdf',
    pdf: true,
  },
  'bs-2025-tariff-einkommens-vermoegenssteuer': {
    title:
      'Tarife für die Einkommenssteuer ab Steuerperiode 2025 und die Vermögenssteuer ab Steuerperiode 2025, Ausgabe 2025',
    url: 'https://media.bs.ch/original_file/47a483fc991f91d59b9a86e4fbbbc0a9de77bd79/17000-steuertarife-2025.pdf',
    pdf: true,
  },
  'bs-2026-communal-ansaetze-abzuege': {
    title:
      'Verzeichnis der Ansätze, Devisenkurse, Abzüge und Freibeträge für die Steuern von natürlichen Personen (18000.a.01.26)',
    url: 'https://media.bs.ch/original_file/533ad44a44ceaf9be3374016c8f8bfecd7ab184a/18000-mb-np-ansaetze-devisenkurse-abzuege-freibetraege-v2026.pdf',
    pdf: true,
  },
  'bs-2026-communal-bettingen-steuersaetze': {
    title: 'Steuern und Finanzen - Gemeinde Bettingen',
    url: 'https://www.bs.ch/bettingen/gemeinde/steuern-und-finanzen',
    pdf: false,
  },
  'bs-2026-guide-wegleitung-b': {
    title:
      'Wegleitung zur Steuererklärung 2026 für natürliche Personen (B, Beendigung der Steuerpflicht 2026)',
    url: 'https://media.bs.ch/original_file/d2ea08f7875b1987c47f5323b96446582a81f30c/15500-fw-np-ste-26-01-b-wegleitung-bf.pdf',
    pdf: true,
  },
  'bs-2026-source-tax-wegleitung': {
    title: 'Wegleitung und Tarife zur Quellenbesteuerung, Ausgabe 2026 (19000.a.02.26)',
    url: 'https://media.bs.ch/original_file/445bc8b2afa6166c46741bdfda12f44792e12703/19000-mb-qst-a-26-wegleitung-und-tariftabellen.pdf',
    pdf: true,
  },
  'bs-2026-tariff-einkommenssteuer-uebersicht': {
    title: 'Übersicht über die Einkommenssteuertarife für die Steuerperioden 2018 bis 2026',
    url: 'https://media.bs.ch/original_file/d8cf2817b481307cd7943afa4f80b99a8878297a/einkommenssteuertarife-2019-2026.pdf',
    pdf: true,
  },
  'bs-na-deductions-liegenschaftskosten': {
    title:
      'Merkblatt betreffend den Abzug von Liegenschaftskosten mit Katalog für die Abgrenzung der abziehbaren Liegenschaftskosten von den nicht abziehbaren Anlagekosten',
    url: 'https://media.bs.ch/original_file/3bdd669de8e86f02e3557c5d4926af2417940d28/18002-mb-np-liegenschaftskosten-v2026-bf-0.pdf',
    pdf: true,
  },
  'bs-na-law-stg': {
    title: 'Gesetz über die direkten Steuern (Steuergesetz, StG), SG 640.100',
    url: 'https://www.gesetzessammlung.bs.ch/api/de/versions/6745/pdf_file_with_annexes',
    pdf: true,
  },
  'bs-na-law-stv': {
    title: 'Verordnung zum Gesetz über die direkten Steuern (Steuerverordnung, StV), SG 640.110',
    url: 'https://www.gesetzessammlung.bs.ch/api/de/versions/6658/pdf_file',
    pdf: true,
  },
  'bs-na-source-tax-info': {
    title: 'Informationen zur Quellensteuer',
    url: 'https://www.bs.ch/themen/arbeit-und-steuern/quellensteuer/informationen-zur-quellensteuer',
    pdf: false,
  },
};
