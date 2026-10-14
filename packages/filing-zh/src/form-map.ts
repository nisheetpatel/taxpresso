// The Zurich return for individuals (Steuererklärung für natürliche Personen, StA Form. 300) as
// printed, in the order you fill it in: the income page, the annexes that feed the deductions
// page (Berufsauslagen for each person, Versicherungsprämien), the deductions page with the
// income calculation, then the wealth page. Every line with its code and its German label as
// printed; the gloss says what it is in plain words.
//
// Sources (docs/sources/zh/manifest.json):
// - zh-2025-form-steuererklaerung-hauptformular: the main form, p. 2 income, p. 3 deductions and
//   the income calculation, p. 4 wealth (p. 1 is the personal details, not mapped).
// - zh-2025-form-berufsauslagen and zh-2026-deductions-form-berufsauslagen (StA Form. 360): the
//   professional costs, p. 1 person 1, p. 2 person 2; the 2026 form has the same lines.
// - zh-2025-deductions-form-versicherungspraemien and zh-2026-deductions-form-versicherungspraemien
//   (StA Form. 365): insurance premiums and savings interest, p. 1; the same lines in 2026.
// - zh-2025-guide-natuerliche-personen: the guide, which explains each line by its Ziffer.
//
// Where a line has no label of its own (the meal and cost options of the Berufsauslagen form), the
// label is its heading and the option as printed, shortened.
//
// Not mapped yet: the personal details (p. 1), the securities list (Wertschriftenverzeichnis, its
// totals 150 and 400 are shown as carried from it), and the lines for what Taxpresso doesn't
// prepare (self-employment, property, capital payments, gifts and inheritances): listed, marked
// unsupported.
import type {
  FormColumn,
  FormMap,
  FormPage,
  FormPerson,
  FormRubric,
  Gloss,
} from '@taxpresso/filing-ge';

export const ZH_PAGE_IDS = ['S2', 'BA1', 'BA2', 'VP', 'S3', 'S4'] as const;
export type ZhPageId = (typeof ZH_PAGE_IDS)[number];

const MAIN = 'zh-2025-form-steuererklaerung-hauptformular';
const GUIDE = 'zh-2025-guide-natuerliche-personen';

type Options = Partial<
  Pick<FormRubric<ZhPageId>, 'person' | 'nature' | 'role' | 'format' | 'columns' | 'supported'>
> & { guide?: number };

/** French typography: a no-break space before a colon and a percent sign. */
const frTypo = (s: string) => s.replace(/ ?: /g, '\u00a0: ').replace(/ %/g, '\u00a0%');

const g = (en: string, fr: string, de?: string): Gloss => ({
  en,
  fr: frTypo(fr),
  ...(de ? { de } : {}),
});

/** A line maker for one section of one page, with that section's defaults. */
function on(page: ZhPageId, doc: string, pdfPage: number, section: string, defaults: Options) {
  return (code: string, label: string, en: string, fr: string, options: Options = {}) => {
    const o = { ...defaults, ...options };
    const rubric: FormRubric<ZhPageId> = {
      key: code,
      code,
      page,
      section,
      person: o.person ?? 'household',
      label,
      gloss: g(en, fr),
      nature: o.nature ?? 'income',
      role: o.role ?? 'input',
      format: o.format ?? 'money',
      columns: o.columns ?? [],
      supported: o.supported ?? true,
      source: `${doc} p. ${pdfPage}${o.guide !== undefined ? `; ${GUIDE} p. ${o.guide}` : ''}`,
    };
    return rubric;
  };
}

const ONE: readonly FormColumn[] = ['amount'];
const BOTH: readonly FormColumn[] = ['icc', 'ifd'];
const WEALTH: readonly FormColumn[] = ['wealth'];
const A = { person: 'A' as FormPerson };
const B = { person: 'B' as FormPerson };
const OUT = { supported: false };

// ---- Seite 2: Einkünfte ------------------------------------------------------------------------

const s2 = (section: string, guide: number) => on('S2', MAIN, 2, section, { columns: ONE, guide });
const job = s2('erwerb', 10);
const self = s2('selbstaendig', 10);
const pensions = s2('renten', 11);
const securities = s2('wertschriften', 12);
const other = s2('uebrige', 12);
const S2 = [
  job(
    '100',
    'Haupterwerb, Person 1',
    'Main job salary, person 1 (salary certificate, box 11)',
    'Salaire de l’activité principale, personne 1 (certificat de salaire, case 11)',
    A,
  ),
  job(
    '101',
    'Haupterwerb, Person 2',
    'Main job salary, person 2 (salary certificate, box 11)',
    'Salaire de l’activité principale, personne 2 (certificat de salaire, case 11)',
    B,
  ),
  job('102', 'Nebenerwerb, Person 1', 'Side job, person 1', 'Activité accessoire, personne 1', A),
  job('103', 'Nebenerwerb, Person 2', 'Side job, person 2', 'Activité accessoire, personne 2', B),
  self(
    '120',
    'Haupterwerb (selbständige Erwerbstätigkeit), Person 1',
    'Self-employment, person 1',
    'Activité indépendante, personne 1',
    { ...A, ...OUT },
  ),
  self(
    '121',
    'Haupterwerb (selbständige Erwerbstätigkeit), Person 2',
    'Self-employment, person 2',
    'Activité indépendante, personne 2',
    { ...B, ...OUT },
  ),
  pensions(
    '130',
    'AHV- / IV-Renten (100%), Person 1',
    'AHV/IV pension, person 1',
    'Rente AVS/AI, personne 1',
    A,
  ),
  pensions(
    '131',
    'AHV- / IV-Renten (100%), Person 2',
    'AHV/IV pension, person 2',
    'Rente AVS/AI, personne 2',
    B,
  ),
  pensions(
    '134',
    'Renten / Pensionen, Person 1',
    'Pension fund pension, person 1',
    'Rente de caisse de pension, personne 1',
    A,
  ),
  pensions(
    '135',
    'Renten / Pensionen, Person 1',
    'Other pension, person 1',
    'Autre rente, personne 1',
    A,
  ),
  pensions(
    '136',
    'Renten / Pensionen, Person 2',
    'Pension fund pension, person 2',
    'Rente de caisse de pension, personne 2',
    B,
  ),
  pensions(
    '137',
    'Renten / Pensionen, Person 2',
    'Other pension, person 2',
    'Autre rente, personne 2',
    B,
  ),
  pensions(
    '140',
    'Erwerbsausfallentschädigungen aus Arbeitslosenversicherung, Person 1',
    'Unemployment benefits paid to you directly, person 1',
    'Indemnités de chômage versées directement, personne 1',
    { ...A, guide: 12 },
  ),
  pensions(
    '141',
    'Erwerbsausfallentschädigungen aus Arbeitslosenversicherung, Person 2',
    'Unemployment benefits paid to you directly, person 2',
    'Indemnités de chômage versées directement, personne 2',
    { ...B, guide: 12 },
  ),
  pensions(
    '142',
    'Kinder- und Familienzulagen, Mutterschaftsentschädigungen, Taggelder, Person 1',
    'Daily allowances and family allowances not paid through the employer, person 1',
    'Indemnités journalières et allocations familiales hors employeur, personne 1',
    { ...A, guide: 12 },
  ),
  pensions(
    '143',
    'Kinder- und Familienzulagen, Mutterschaftsentschädigungen, Taggelder, Person 2',
    'Daily allowances and family allowances not paid through the employer, person 2',
    'Indemnités journalières et allocations familiales hors employeur, personne 2',
    { ...B, guide: 12 },
  ),
  securities(
    '150',
    'Ertrag aus Wertschriften, Guthaben und Lotterien',
    'Income from securities and accounts, carried from the securities list (Wertschriftenverzeichnis)',
    'Rendement des titres et avoirs, reporté de l’état des titres (Wertschriftenverzeichnis)',
    { role: 'report' },
  ),
  securities(
    '151',
    'Davon aus qualifizierten Beteiligungen',
    'Of which from qualifying holdings',
    'Dont participations qualifiées',
    OUT,
  ),
  other(
    '160',
    'Unterhaltsbeiträge vom geschiedenen / getrennten Ehegatten / Partn.',
    'Alimony received from a former spouse',
    'Pension alimentaire reçue de l’ex-conjoint',
  ),
  other(
    '161',
    'Unterhaltsbeiträge für minderjährige Kinder (bis zum Monat der Volljährigkeit)',
    'Child support received, up to the month the child turns 18',
    'Contributions d’entretien reçues pour les enfants mineurs',
  ),
  other(
    '162',
    'Ertrag aus Geschäfts- und Korporationsanteilen',
    'Income from business shares',
    'Rendement de parts commerciales',
    OUT,
  ),
  other(
    '163',
    'Weitere Einkünfte, nähere Bezeichnung',
    'Other income (say what it is)',
    'Autres revenus (préciser)',
  ),
  other(
    '164',
    'Kapitalabfindungen für wiederkehrende Leistungen',
    'Lump sums for recurring payments',
    'Prestations en capital pour des prestations périodiques',
    OUT,
  ),
  other(
    '188',
    'Nettoertrag aus Liegenschaften',
    'Net income from property',
    'Rendement net des immeubles',
    OUT,
  ),
  s2('total', 19)(
    '199',
    'Total der Einkünfte',
    'Total income: carried to page 3',
    'Total des revenus : reporté en page 3',
    {
      role: 'total',
    },
  ),
];

// ---- Berufsauslagen (StA Form. 360), person 1 and person 2 ------------------------------------

/** The Berufsauslagen lines of one person; person 2's codes are person 1's plus 20. */
function berufsauslagen(page: 'BA1' | 'BA2', taxYear: number) {
  const doc =
    taxYear === 2025 ? 'zh-2025-form-berufsauslagen' : 'zh-2026-deductions-form-berufsauslagen';
  const pdfPage = page === 'BA1' ? 1 : 2;
  const who = page === 'BA1' ? A : B;
  const n = page === 'BA1' ? 1 : 2;
  const c = (p1: number) => String(page === 'BA1' ? p1 : p1 + 20);
  const travel = on(page, doc, pdfPage, 'fahrkosten', {
    ...who,
    nature: 'deduction',
    columns: BOTH,
    guide: 13,
  });
  const meals = on(page, doc, pdfPage, 'verpflegung', {
    ...who,
    nature: 'deduction',
    columns: BOTH,
    guide: 13,
  });
  const rest = on(page, doc, pdfPage, 'uebrige', {
    ...who,
    nature: 'deduction',
    columns: BOTH,
    guide: 14,
  });
  const side = on(page, doc, pdfPage, 'nebenerwerb', {
    ...who,
    nature: 'deduction',
    columns: BOTH,
    guide: 14,
  });
  const total = on(page, doc, pdfPage, 'total', {
    ...who,
    nature: 'deduction',
    columns: BOTH,
    role: 'total',
    guide: 13,
  });
  return [
    travel(
      c(201),
      'Abonnementkosten für öffentliche Verkehrsmittel',
      `Public transport pass, person ${n}`,
      `Abonnement de transports publics, personne ${n}`,
    ),
    travel(
      c(202),
      'Fahrrad, Kleinmotorrad (gelbes Kontrollschild) pauschal',
      `Bike or moped (yellow plate), flat amount, person ${n}`,
      `Vélo ou cyclomoteur (plaque jaune), forfait, personne ${n}`,
    ),
    travel(
      c(204),
      'Auto, Motorrad (weisses Kontrollschild)',
      `Car or motorbike (white plate), person ${n}`,
      `Voiture ou moto (plaque blanche), personne ${n}`,
    ),
    travel(
      c(205),
      'Zwischentotal',
      `Travel costs, at most the limit, person ${n}`,
      `Frais de déplacement, au plus la limite, personne ${n}`,
      { role: 'total' },
    ),
    meals(
      c(206),
      'Mehrkosten der Verpflegung, wenn die Verpflegung durch den Arbeitgeber verbilligt wird',
      `Meals away from home, made cheaper by the employer, person ${n}`,
      `Repas hors du domicile, à prix réduit par l’employeur, personne ${n}`,
    ),
    meals(
      c(208),
      'Mehrkosten der Verpflegung, wenn die Verpflegung voll zu Lasten des Arbeitnehmers geht',
      `Meals away from home, paid in full by you, person ${n}`,
      `Repas hors du domicile, entièrement à votre charge, personne ${n}`,
    ),
    meals(
      c(210),
      'Mehrkosten der Verpflegung bei Schicht- / Nachtarbeit',
      `Meals on shift or night work, person ${n}`,
      `Repas en travail de nuit ou par équipes, personne ${n}`,
      OUT,
    ),
    rest(
      c(212),
      'Übrige Berufskosten, pauschal 3% des Nettolohnes',
      `Other professional costs, the 3 % flat amount, person ${n}`,
      `Autres frais professionnels, forfait de 3 %, personne ${n}`,
    ),
    rest(
      c(213),
      'Übrige Berufskosten, effektiv gemäss Aufstellung',
      `Other professional costs, actual (list them), person ${n}`,
      `Autres frais professionnels, effectifs (liste), personne ${n}`,
    ),
    side(
      c(216),
      'Auslagen bei Nebenerwerb, pauschal 20% der Einkünfte aus Nebenerwerb',
      `Side job costs, the 20 % flat amount, person ${n}`,
      `Frais de l’activité accessoire, forfait de 20 %, personne ${n}`,
    ),
    side(
      c(217),
      'Auslagen bei Nebenerwerb, effektiv gemäss Aufstellung',
      `Side job costs, actual, person ${n}`,
      `Frais de l’activité accessoire, effectifs, personne ${n}`,
      OUT,
    ),
    total(
      c(220),
      'Total der Berufsauslagen',
      `Total professional costs, person ${n}: carried to page 3`,
      `Total des frais professionnels, personne ${n}${' '}: reporté en page 3`,
    ),
  ];
}

// ---- Versicherungsprämien (StA Form. 365) ------------------------------------------------------

function versicherung(taxYear: number) {
  const doc =
    taxYear === 2025
      ? 'zh-2025-deductions-form-versicherungspraemien'
      : 'zh-2026-deductions-form-versicherungspraemien';
  const paid = on('VP', doc, 1, 'bezahlt', { nature: 'deduction', columns: ONE, guide: 15 });
  const max = on('VP', doc, 1, 'maximum', {
    nature: 'deduction',
    columns: BOTH,
    role: 'computed',
    guide: 15,
  });
  return [
    paid(
      '601',
      'Private Krankenversicherungsprämien',
      'Health insurance premiums, after any premium subsidy already deducted',
      'Primes d’assurance-maladie, après le subside déjà déduit',
    ),
    paid(
      '602',
      'Private Unfallversicherungsprämien',
      'Private accident insurance premiums',
      'Primes d’assurance-accidents privée',
    ),
    paid(
      '603',
      'Private Lebens- und Rentenversicherungsprämien',
      'Life and annuity insurance premiums',
      'Primes d’assurance-vie et de rente',
    ),
    paid('604', 'Zinsen von Sparkapitalien', 'Interest on savings', 'Intérêts de l’épargne'),
    paid('607', 'Zwischentotal', 'Subtotal', 'Sous-total', { role: 'total' }),
    paid(
      '605',
      'Abzüglich erhaltene Prämienverbilligungen',
      'Less the premium subsidy received',
      'Moins le subside reçu',
    ),
    paid(
      '606',
      'Total bezahlte Versicherungsprämien und Zinsen von Sparkapitalien (A)',
      'Total paid (A)',
      'Total payé (A)',
      { role: 'total' },
    ),
    max(
      '616',
      'Total der Abzüge für Versicherungsprämien und Zinsen von Sparkapitalien (B)',
      'The most you can deduct (B)',
      'Le maximum déductible (B)',
    ),
    max(
      '270',
      'Der niedrigere Betrag: (A) oder (B)',
      'The lower of (A) and (B): carried to page 3',
      'Le plus bas de (A) et (B) : reporté en page 3',
      { role: 'total' },
    ),
  ];
}

// ---- Seite 3: Abzüge und Einkommensberechnung --------------------------------------------------

const s3 = (section: string, guide: number, more: Options = {}) =>
  on('S3', MAIN, 3, section, { nature: 'deduction', columns: BOTH, guide, ...more });
const prof = s3('berufsauslagen', 13, { role: 'report' });
const debts = s3('schuldzinsen', 14);
const alimony = s3('unterhalt', 14);
const pillar = s3('saeule3a', 15);
const insurance = s3('versicherung', 15, { role: 'report' });
const more = s3('weitere', 16);
const calc = s3('berechnung', 19, { role: 'total' });
const extra = s3('zusaetzlich', 19);
const social = s3('sozialabzuege', 20);
const taxable = s3('steuerbar', 20, { role: 'total' });
const S3 = [
  prof(
    '220',
    'Berufsauslagen, Person 1',
    'Professional costs, person 1, from the Berufsauslagen form',
    'Frais professionnels, personne 1, du formulaire Berufsauslagen',
    A,
  ),
  prof(
    '240',
    'Berufsauslagen, Person 2',
    'Professional costs, person 2, from the Berufsauslagen form',
    'Frais professionnels, personne 2, du formulaire Berufsauslagen',
    B,
  ),
  debts(
    '250',
    'Schuldzinsen (soweit nicht schon unter Ziff. 2 abgezogen)',
    'Interest on private debts',
    'Intérêts de dettes privées',
  ),
  alimony(
    '254',
    'Unterhaltsbeiträge an den geschiedenen oder getrennt lebenden Ehegatten / Partn.',
    'Alimony paid to a former spouse',
    'Pension alimentaire versée à l’ex-conjoint',
    { guide: 15 },
  ),
  alimony(
    '255',
    'Unterhaltsbeiträge für minderjährige Kinder (bis zum Monat der Volljährigkeit)',
    'Child support paid, up to the month the child turns 18',
    'Contributions d’entretien versées pour les enfants mineurs',
    { guide: 15 },
  ),
  alimony('256', 'Rentenleistungen', 'Annuities paid', 'Rentes versées', { ...OUT, guide: 15 }),
  pillar(
    '260',
    'Beiträge an anerkannte Formen der geb. Selbstvorsorge (3. Säule a), Person 1',
    'Paid into pillar 3a, person 1 (attestation)',
    'Versé au 3e pilier A, personne 1 (attestation)',
    A,
  ),
  pillar(
    '261',
    'Beiträge an anerkannte Formen der geb. Selbstvorsorge (3. Säule a), Person 2',
    'Paid into pillar 3a, person 2 (attestation)',
    'Versé au 3e pilier A, personne 2 (attestation)',
    B,
  ),
  insurance(
    '270',
    'Versicherungsprämien, Zinsen von Sparkapitalien',
    'Insurance premiums and savings interest, from the Versicherungsprämien form',
    'Primes d’assurance et intérêts d’épargne, du formulaire Versicherungsprämien',
  ),
  more(
    '280',
    'Beiträge an die AHV, IV und 2. Säule, sofern nicht unter Ziff. 1 und 2 abgezogen',
    'Pension fund buy-ins and contributions paid yourself (attestation)',
    'Rachats et cotisations de prévoyance payés vous-même (attestation)',
  ),
  more(
    '292',
    'Berufsorientierte Aus- und Weiterbildungskosten',
    'Professional training costs',
    'Frais de formation professionnelle',
  ),
  more(
    '283',
    'Kosten für die Verwaltung des beweglichen Privatvermögens',
    'Costs of having your securities managed',
    'Frais de gestion de la fortune mobilière',
  ),
  more(
    '3160',
    'Behinderungsbedingte Kosten',
    'Costs due to a disability',
    'Frais liés à un handicap',
    { ...OUT, guide: 17 },
  ),
  more(
    '284',
    'Weitere Abzüge (z.B. Beiträge an politische Parteien)',
    'Other deductions, such as payments to political parties',
    'Autres déductions, par exemple versements aux partis politiques',
    { guide: 17 },
  ),
  more(
    '376',
    'Abzug für fremdbetreute Kinder',
    'Childcare by others (crèche, day care, nanny)',
    'Frais de garde des enfants par des tiers',
    { guide: 18 },
  ),
  more(
    '290',
    'Sonderabzug bei Erwerbstätigkeit beider Ehegatten/Partn.',
    'Deduction when both spouses work',
    'Déduction lorsque les deux conjoints travaillent',
    { guide: 18, role: 'computed' },
  ),
  calc('299', 'Total der Abzüge', 'Total deductions', 'Total des déductions', { guide: 18 }),
  calc(
    '310',
    'Nettoeinkommen',
    'Net income: the base for medical costs and donations',
    'Revenu net : la base des frais médicaux et des dons',
  ),
  extra(
    '320',
    'Krankheits- und Unfallkosten',
    'Medical costs above the threshold',
    'Frais médicaux au-delà du seuil',
    { role: 'computed' },
  ),
  extra(
    '324',
    'Gemeinnützige Zuwendungen',
    'Donations to tax-exempt organisations',
    'Dons à des organisations d’utilité publique',
  ),
  calc(
    '350',
    'Reineinkommen',
    'Income after deductions, before the social deductions',
    'Revenu après déductions, avant les déductions sociales',
  ),
  social(
    '370',
    'Abzug für Kinder in Ihrem Haushalt',
    'Deduction for children living with you',
    'Déduction pour les enfants qui vivent avec vous',
    { role: 'computed' },
  ),
  social(
    '372',
    'Abzug für Kinder ausserhalb Ihres Haushaltes',
    'Deduction for children not living with you',
    'Déduction pour les enfants qui ne vivent pas avec vous',
    { role: 'computed' },
  ),
  social(
    '374',
    'Abzug für unterstützte Personen',
    'Deduction for people you support',
    'Déduction pour personnes à charge',
    OUT,
  ),
  social(
    '365',
    'Abzug für Ehegatten / Partn.',
    'Deduction for a married couple (federal tax only)',
    'Déduction pour couple marié (impôt fédéral seulement)',
    { columns: ['ifd'], role: 'computed' },
  ),
  taxable('390', 'Steuerbares Einkommen gesamt', 'Taxable income', 'Revenu imposable'),
  taxable(
    '394',
    'Auf steuerbare Einkünfte in anderen Kantonen',
    'Of which taxable in other cantons',
    'Dont imposable dans d’autres cantons',
    OUT,
  ),
  taxable(
    '396',
    'Auf steuerbare Einkünfte im Ausland',
    'Of which taxable abroad',
    'Dont imposable à l’étranger',
    OUT,
  ),
  taxable(
    '398',
    'Steuerbares Einkommen im Kanton Zürich bzw. in der Schweiz',
    'Taxable income in the canton of Zurich, or in Switzerland',
    'Revenu imposable dans le canton de Zurich ou en Suisse',
  ),
];

// ---- Seite 4: Vermögen -------------------------------------------------------------------------

const s4 = (section: string, more: Options = {}) =>
  on('S4', MAIN, 4, section, { nature: 'wealth', columns: WEALTH, guide: 22, ...more });
const movable = s4('beweglich');
const property = s4('liegenschaften', OUT);
const wealth = s4('total', { role: 'total' });
const S4 = [
  movable(
    '400',
    'Wertschriften und Guthaben',
    'Securities and accounts, carried from the securities list (Wertschriftenverzeichnis)',
    'Titres et avoirs, reportés de l’état des titres (Wertschriftenverzeichnis)',
    { role: 'report' },
  ),
  movable(
    '404',
    'Bargeld, Gold und andere Edelmetalle',
    'Cash, gold and other precious metals',
    'Espèces, or et autres métaux précieux',
  ),
  movable(
    '406',
    'Lebens- und Rentenversicherungen (Steuerwert gem. Bescheinigung der Versicherungsges.)',
    'Life and annuity insurance, surrender value (insurer’s statement)',
    'Assurances-vie et de rente, valeur de rachat (attestation de l’assureur)',
  ),
  movable('412', 'Motorfahrzeuge', 'Vehicles', 'Véhicules'),
  movable('414', 'Geschäfts-/Korporationsanteile', 'Business shares', 'Parts commerciales', OUT),
  movable(
    '416',
    'Übrige Vermögenswerte; nähere Bezeichnung',
    'Other assets (say what they are)',
    'Autres éléments de fortune (préciser)',
  ),
  property(
    '421',
    'Liegenschaften, zum Verkehrswert besteuert',
    'Property, at market value',
    'Immeubles, à la valeur vénale',
  ),
  property(
    '422',
    'Liegenschaften, zum Ertragswert besteuert (Land- oder Forstwirtschaft)',
    'Farm or forest property',
    'Immeubles agricoles ou forestiers',
  ),
  property(
    '430',
    'Eigenkapital Selbständigerwerbender ohne Geschäftswertschriften',
    'Business equity of the self-employed',
    'Capital propre des indépendants',
  ),
  wealth('460', 'Total der Vermögenswerte', 'Total assets', 'Total de la fortune'),
  movable('470', 'Schulden', 'Debts on 31 December', 'Dettes au 31 décembre'),
  wealth('490', 'Steuerbares Vermögen gesamt', 'Taxable wealth', 'Fortune imposable'),
  wealth(
    '494',
    'Auf steuerbare Vermögenswerte in anderen Kantonen',
    'Of which in other cantons',
    'Dont dans d’autres cantons',
    OUT,
  ),
  wealth(
    '496',
    'Auf steuerbare Vermögenswerte im Ausland',
    'Of which abroad',
    'Dont à l’étranger',
    OUT,
  ),
  wealth(
    '498',
    'Steuerbares Vermögen im Kanton Zürich',
    'Taxable wealth in the canton of Zurich',
    'Fortune imposable dans le canton de Zurich',
  ),
];

// ---- Pages -------------------------------------------------------------------------------------

const section = (id: string, title: string, en: string, fr: string) => ({
  id,
  title,
  gloss: g(en, fr),
});

function pages(taxYear: number): FormPage<ZhPageId>[] {
  const year = taxYear;
  const ba =
    taxYear === 2025 ? 'zh-2025-form-berufsauslagen' : 'zh-2026-deductions-form-berufsauslagen';
  const vp =
    taxYear === 2025
      ? 'zh-2025-deductions-form-versicherungspraemien'
      : 'zh-2026-deductions-form-versicherungspraemien';
  const baSections = [
    section(
      'fahrkosten',
      'Fahrkosten zwischen Wohn- und Arbeitsstätte',
      'Travel between home and work',
      'Trajets entre le domicile et le travail',
    ),
    section(
      'verpflegung',
      'Mehrkosten der Verpflegung',
      'Meals away from home',
      'Repas hors du domicile',
    ),
    section(
      'uebrige',
      'Übrige für die Ausübung des Berufes erforderliche Kosten',
      'Other costs of your job',
      'Autres frais nécessaires à l’exercice de la profession',
    ),
    section(
      'nebenerwerb',
      'Auslagen bei Nebenerwerb',
      'Side job costs',
      'Frais de l’activité accessoire',
    ),
    section('total', 'Total der Berufsauslagen', 'Total', 'Total'),
  ];
  return [
    {
      id: 'S2',
      title: `Einkünfte ${year}`,
      gloss: g('Income', 'Revenus'),
      pdfPage: 2,
      supported: true,
      sections: [
        section(
          'erwerb',
          'Einkünfte aus unselbständiger Erwerbstätigkeit',
          'Salaried work',
          'Activité salariée',
        ),
        section(
          'selbstaendig',
          'Einkünfte aus selbständiger Erwerbstätigkeit',
          'Self-employment',
          'Activité indépendante',
        ),
        section(
          'renten',
          'Einkünfte aus Sozial- und anderen Versicherungen, Leibrenten',
          'Pensions and insurance benefits',
          'Rentes et prestations d’assurances',
        ),
        section(
          'wertschriften',
          'Wertschriftenertrag',
          'Income from securities',
          'Rendement des titres',
        ),
        section('uebrige', 'Übrige Einkünfte und Gewinne', 'Other income', 'Autres revenus'),
        section('total', 'Total der Einkünfte', 'Total income', 'Total des revenus'),
      ],
      source: `${MAIN} p. 2`,
    },
    {
      id: 'BA1',
      title: `Berufsauslagen ${year}, Person 1`,
      gloss: g('Professional costs, person 1', 'Frais professionnels, personne 1'),
      person: 'A',
      pdfPage: 1,
      supported: true,
      sections: baSections,
      source: `${ba} p. 1`,
    },
    {
      id: 'BA2',
      title: `Berufsauslagen ${year}, Person 2`,
      gloss: g('Professional costs, person 2', 'Frais professionnels, personne 2'),
      person: 'B',
      pdfPage: 2,
      supported: true,
      sections: baSections,
      source: `${ba} p. 2`,
    },
    {
      id: 'VP',
      title: `Versicherungsprämien ${year}`,
      gloss: g(
        'Insurance premiums and savings interest',
        'Primes d’assurance et intérêts d’épargne',
      ),
      pdfPage: 1,
      supported: true,
      sections: [
        section(
          'bezahlt',
          'Bezahlte Versicherungsprämien und Zinsen von Sparkapitalien',
          'What you paid',
          'Ce que vous avez payé',
        ),
        section(
          'maximum',
          'Maximaler Abzug für Versicherungsprämien und Zinsen von Sparkapitalien',
          'The most you can deduct',
          'Le maximum déductible',
        ),
      ],
      source: `${vp} p. 1`,
    },
    {
      id: 'S3',
      title: `Abzüge ${year}`,
      gloss: g('Deductions and income calculation', 'Déductions et calcul du revenu'),
      pdfPage: 3,
      supported: true,
      sections: [
        section(
          'berufsauslagen',
          'Berufsauslagen bei unselbständiger Erwerbstätigkeit',
          'Professional costs',
          'Frais professionnels',
        ),
        section('schuldzinsen', 'Schuldzinsen', 'Debt interest', 'Intérêts passifs'),
        section(
          'unterhalt',
          'Unterhaltsbeiträge und Rentenleistungen',
          'Alimony and child support paid',
          'Pensions alimentaires versées',
        ),
        section(
          'saeule3a',
          'Beiträge an anerkannte Formen der geb. Selbstvorsorge (3. Säule a)',
          'Pillar 3a',
          '3e pilier A',
        ),
        section(
          'versicherung',
          'Versicherungsprämien, Zinsen von Sparkapitalien',
          'Insurance premiums and savings interest',
          'Primes d’assurance et intérêts d’épargne',
        ),
        section('weitere', 'Weitere Abzüge', 'Other deductions', 'Autres déductions'),
        section('berechnung', 'Einkommensberechnung', 'Income calculation', 'Calcul du revenu'),
        section(
          'zusaetzlich',
          'Zusätzliche Abzüge',
          'Further deductions',
          'Déductions supplémentaires',
        ),
        section(
          'sozialabzuege',
          'Steuerfreie Beträge (Sozialabzüge)',
          'Social deductions',
          'Déductions sociales',
        ),
        section('steuerbar', 'Steuerbares Einkommen', 'Taxable income', 'Revenu imposable'),
      ],
      source: `${MAIN} p. 3`,
    },
    {
      id: 'S4',
      title: `Vermögen im In- und Ausland, Steuerwert am 31. Dezember ${year}`,
      gloss: g('Wealth on 31 December', 'Fortune au 31 décembre'),
      pdfPage: 4,
      supported: true,
      sections: [
        section('beweglich', 'Bewegliches Vermögen', 'Movable wealth', 'Fortune mobilière'),
        section('liegenschaften', 'Liegenschaften', 'Property', 'Immeubles'),
        section('total', 'Vermögensberechnung', 'Wealth calculation', 'Calcul de la fortune'),
      ],
      source: `${MAIN} p. 4`,
    },
  ];
}

function rubrics(taxYear: number): FormRubric<ZhPageId>[] {
  return [
    ...S2,
    ...berufsauslagen('BA1', taxYear),
    ...berufsauslagen('BA2', taxYear),
    ...versicherung(taxYear),
    ...S3,
    ...S4,
  ];
}

export const FORM_ZH_2025: FormMap<ZhPageId> = {
  taxYear: 2025,
  formYear: 2025,
  provisional: false,
  pages: pages(2025),
  rubrics: rubrics(2025),
};

/**
 * Tax year 2026: the main form for the whole year is not published yet, so its pages are the
 * 2025 form's, flagged provisional; the Berufsauslagen and Versicherungsprämien forms are 2026's.
 */
export const FORM_ZH_2026: FormMap<ZhPageId> = {
  taxYear: 2026,
  formYear: 2025,
  provisional: true,
  note: {
    en: 'Codes and labels from the 2025 Zurich return; the 2026 main form is not published yet, so check each code on yours. The Berufsauslagen and Versicherungsprämien forms are 2026’s.',
    fr: 'Codes et libellés de la déclaration zurichoise 2025 ; le formulaire principal 2026 n’est pas encore publié, vérifiez donc chaque code sur le vôtre. Les formulaires Berufsauslagen et Versicherungsprämien sont ceux de 2026.',
    de: 'Ziffern und Bezeichnungen aus der Zürcher Steuererklärung 2025; das Hauptformular 2026 ist noch nicht veröffentlicht, prüfe also jede Ziffer auf deinem. Die Formulare Berufsauslagen und Versicherungsprämien sind die von 2026.',
  },
  pages: pages(2026),
  rubrics: rubrics(2026),
};

export function zurichFormMap(taxYear: number): FormMap<ZhPageId> {
  if (taxYear === 2025) return FORM_ZH_2025;
  if (taxYear === 2026) return FORM_ZH_2026;
  throw new Error(`No Zurich form map for ${taxYear}.`);
}
