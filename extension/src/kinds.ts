// How each kind of document is called, in the guide’s words (ge-2025-guide-declaration-pp p. 8, p. 10, p. 53);
// in German in plain words, with the Zurich guide's terms where it has them (Lohnausweis, eSteuerauszug:
// zh-2025-guide-natuerliche-personen p. 10 and 24); in Italian in plain words, with the Ticino
// instructions' terms where they have them (certificato di salario, ti-2025-guide-istruzioni-pf-pdf).
import type { DocumentKind } from '@taxpresso/ledger';

/** The documents of a property abroad (Geneva): offered only to a household that has one. */
export const ABROAD_KINDS: ReadonlySet<DocumentKind> = new Set<DocumentKind>([
  'foreign_property_tax_notice',
  'foreign_property_deed',
  'foreign_property_rent_statement',
]);

/** The documents of a property in Geneva: offered only to a household that has one. */
export const PROPERTY_KINDS: ReadonlySet<DocumentKind> = new Set<DocumentKind>([
  'property_values',
  'property_rent_statement',
  'property_upkeep_invoices',
  'ppe_charges_statement',
  'mortgage_statement',
]);

export const KIND_LABELS: Record<DocumentKind, { en: string; fr: string; de: string; it: string }> =
  {
    salary_certificate: {
      en: 'Salary certificate',
      fr: 'Certificat de salaire',
      de: 'Lohnausweis',
      it: 'Certificato di salario',
    },
    ech0196_statement: {
      en: 'Bank e-tax statement',
      fr: 'e-relevé fiscal',
      de: 'eSteuerauszug',
      it: 'Estratto fiscale elettronico',
    },
    bank_attestation: {
      en: 'Bank statement on 31 December',
      fr: 'Relevé bancaire au 31 décembre',
      de: 'Bankauszug per 31. Dezember',
      it: 'Estratto bancario al 31 dicembre',
    },
    pillar3a_attestation: {
      en: 'Pillar 3a attestation',
      fr: 'Attestation 3e pilier A',
      de: 'Bescheinigung Säule 3a',
      it: 'Attestazione pilastro 3a',
    },
    lpp_buyin: {
      en: 'Pension fund buy-in',
      fr: 'Attestation de rachat 2e pilier',
      de: 'Bescheinigung Einkauf Pensionskasse',
      it: 'Attestazione di riscatto nella cassa pensione',
    },
    health_premiums: {
      en: 'Health insurance premiums',
      fr: 'Primes d’assurance-maladie',
      de: 'Krankenkassenprämien',
      it: 'Premi dell’assicurazione malattia',
    },
    medical_invoice: {
      en: 'Medical costs',
      fr: 'Frais médicaux',
      de: 'Krankheitskosten',
      it: 'Spese di malattia',
    },
    childcare_invoice: {
      en: 'Childcare invoice',
      fr: 'Frais de garde',
      de: 'Rechnung Kinderbetreuung',
      it: 'Fattura per la custodia dei figli',
    },
    donation_receipt: {
      en: 'Donation receipt',
      fr: 'Justificatif de don',
      de: 'Spendenbestätigung',
      it: 'Attestazione di donazione',
    },
    debt_interest: {
      en: 'Loan statement',
      fr: 'Relevé d’emprunt',
      de: 'Schuldzinsbestätigung',
      it: 'Attestazione degli interessi passivi',
    },
    prior_declaration: {
      en: 'Last year’s declaration',
      fr: 'Déclaration de l’an dernier',
      de: 'Steuererklärung des Vorjahres',
      it: 'Dichiarazione dell’anno scorso',
    },
    replacement_income_certificate: {
      en: 'Benefits attestation',
      fr: 'Attestation d’indemnités',
      de: 'Bescheinigung Taggelder',
      it: 'Attestazione di indennità',
    },
    pension_certificate: {
      en: 'Pension certificate',
      fr: 'Certificat de rente',
      de: 'Rentenbescheinigung',
      it: 'Certificato di rendita',
    },
    alimony_proof: {
      en: 'Alimony proof',
      fr: 'Justificatif de pension alimentaire',
      de: 'Belege Unterhaltsbeiträge',
      it: 'Giustificativi degli alimenti',
    },
    crypto_statement: {
      en: 'Crypto statement',
      fr: 'Relevé crypto',
      de: 'Krypto-Auszug',
      it: 'Estratto cripto',
    },
    separation_judgment: {
      en: 'Separation or divorce judgment',
      fr: 'Jugement de séparation ou de divorce',
      de: 'Trennungs- oder Scheidungsurteil',
      it: 'Sentenza di separazione o di divorzio',
    },
    broker_export: {
      en: 'Broker export (securities)',
      fr: 'Export du courtier (titres)',
      de: 'Export des Brokers (Wertschriften)',
      it: 'Esportazione del broker (titoli)',
    },
    other: { en: 'Something else', fr: 'Autre chose', de: 'Etwas anderes', it: 'Altro' },
    // ge-2025-guide-declaration-pp p. 53: the bordereaux ICC and IFD and the avis de taxation.
    tax_assessment: {
      en: 'Tax assessment',
      fr: 'Avis de taxation et bordereau',
      de: 'Veranlagungsverfügung',
      it: 'Decisione di tassazione',
    },
    // ge-2025-guide-declaration-pp p. 8: "Attestation des primes d'assurance-vie et contrat".
    life_insurance_attestation: {
      en: 'Life insurance attestation (pillar 3b)',
      fr: 'Attestation d’assurance-vie (3e pilier B)',
      de: 'Bescheinigung Lebensversicherung (Säule 3b)',
      it: 'Attestazione di assicurazione sulla vita (pilastro 3b)',
    },
    // SPEC.md 10.4: the PDF of this year's declaration, checked before the user transmits it.
    official_declaration: {
      en: 'This year’s declaration (PDF to check)',
      fr: 'Déclaration de cette année (PDF à vérifier)',
      de: 'Steuererklärung dieses Jahres (PDF zum Prüfen)',
      it: 'Dichiarazione di quest’anno (PDF da controllare)',
    },
    // ch-na-law-lifd art. 129 al. 1 let. b and al. 2 (the institution's attestation, a copy for you);
    // ge-2025-guide-declaration-pp p. 13: "Prestations en capital du 2e et 3e pilier A" (98.12).
    lpp_capital_attestation: {
      en: 'Pension capital attestation, 2nd pillar',
      fr: 'Attestation de prestation en capital du 2e pilier',
      de: 'Bescheinigung Kapitalleistung 2. Säule',
      it: 'Attestazione di prestazione in capitale, 2° pilastro',
    },
    pillar3a_capital_attestation: {
      en: 'Pension capital attestation, pillar 3a',
      fr: 'Attestation de prestation en capital du 3e pilier A',
      de: 'Bescheinigung Kapitalleistung Säule 3a',
      it: 'Attestazione di prestazione in capitale, pilastro 3a',
    },
    // ge-2025-guide-independants p. 6 and 25: the accounts or simple records of a self-employed person.
    business_accounts: {
      en: 'Business accounts or records',
      fr: 'Comptes commerciaux ou relevés',
      de: 'Geschäftsabschluss oder Aufzeichnungen',
      it: 'Conti dell’attività o registrazioni',
    },
    // ge-2025-guide-independants p. 25: "un relevé des cotisations sociales ou des acomptes".
    avs_contributions: {
      en: 'AVS contributions statement',
      fr: 'Relevé des cotisations AVS',
      de: 'AHV-Beitragsabrechnung',
      it: 'Conteggio dei contributi AVS',
    },
    // A property abroad (ge-na-valeur-fiscale-page, ge-na-revenu-immobilier-page): the country's
    // attestation of its tax value or rental value, or its tax notice (France: taxe d'habitation,
    // taxes foncières); the deed of purchase; the management account of a property let.
    foreign_property_tax_notice: {
      en: 'Property abroad: tax notice or attestation from the country',
      fr: 'Immeuble à l’étranger : avis d’impôt ou attestation du pays',
      de: 'Liegenschaft im Ausland: Steuerbescheid oder Bescheinigung des Landes',
      it: 'Immobile all’estero: avviso d’imposta o attestazione del Paese',
    },
    foreign_property_deed: {
      en: 'Property abroad: deed of purchase (acte d’acquisition)',
      fr: 'Immeuble à l’étranger : acte d’acquisition',
      de: 'Liegenschaft im Ausland: Kaufvertrag (acte d’acquisition)',
      it: 'Immobile all’estero: atto d’acquisto (acte d’acquisition)',
    },
    foreign_property_rent_statement: {
      en: 'Property abroad: management account (compte de gestion)',
      fr: 'Immeuble à l’étranger : compte de gestion',
      de: 'Liegenschaft im Ausland: Verwaltungsabrechnung (compte de gestion)',
      it: 'Immobile all’estero: conto di gestione (compte de gestion)',
    },
    // A property in Geneva (ge-na-valeur-fiscale-page, ge-na-revenu-immobilier-page,
    // ge-2025-guide-declaration-pp p. 8, 10, 32 to 37): the AFC's letter with its tax value and
    // rental value, or the avis de taxation immobilier; the management account of a property let;
    // the upkeep invoices; the PPE charges statement; the mortgage statement.
    property_values: {
      en: 'Property in Geneva: the AFC’s letter with its tax value and rental value (or avis de taxation immobilier)',
      fr: 'Immeuble à Genève : courrier de l’AFC (valeur fiscale, valeur locative) ou avis de taxation immobilier',
      de: 'Liegenschaft in Genf: Schreiben der AFC mit Steuerwert und Eigenmietwert (oder avis de taxation immobilier)',
      it: 'Immobile a Ginevra: lettera dell’AFC con valore fiscale e valore locativo (o avis de taxation immobilier)',
    },
    property_rent_statement: {
      en: 'Property let in Geneva: management account (compte de gestion)',
      fr: 'Immeuble loué à Genève : compte de gestion',
      de: 'Vermietete Liegenschaft in Genf: Verwaltungsabrechnung (compte de gestion)',
      it: 'Immobile affittato a Ginevra: conto di gestione (compte de gestion)',
    },
    property_upkeep_invoices: {
      en: 'Upkeep invoices of a property (factures d’entretien)',
      fr: 'Factures d’entretien d’un immeuble',
      de: 'Unterhaltsrechnungen einer Liegenschaft (factures d’entretien)',
      it: 'Fatture di manutenzione di un immobile (factures d’entretien)',
    },
    ppe_charges_statement: {
      en: 'PPE charges statement (décompte de charges de copropriété)',
      fr: 'Décompte de charges de copropriété (PPE)',
      de: 'Nebenkostenabrechnung der Stockwerkeigentümer (décompte de charges PPE)',
      it: 'Conteggio delle spese di comproprietà (décompte de charges PPE)',
    },
    mortgage_statement: {
      en: 'Mortgage statement (intérêts et dettes hypothécaires)',
      fr: 'Relevé hypothécaire (intérêts et dettes hypothécaires)',
      de: 'Hypothekarauszug (intérêts et dettes hypothécaires)',
      it: 'Estratto dell’ipoteca (intérêts et dettes hypothécaires)',
    },
  };
