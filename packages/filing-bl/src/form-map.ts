// The Basel-Landschaft return for individuals (Steuererklärung für natürliche Personen, Staats-,
// Gemeinde- und direkte Bundessteuer) as printed, in the order you fill it in: page 2 the income
// (Einkünfte, one column, then the subtotal 399 carried to both columns), page 3 the deductions in
// two columns (Staatssteuer, Bundessteuer) down to the taxable income 790, page 4 the wealth
// (Vermögen, Steuerwert am 31.12.). Every line with its code (Ziffer) and its German label as
// printed; the gloss says what it is in plain words.
//
// Sources (docs/sources/bl/manifest.json): bl-2025-steuererklaerung-form for tax year 2025 and
// bl-2026-steuererklaerung-form for 2026 (the edition of 20 March 2026, print code 2 2026 260320),
// p. 2 to 4; the guide of the year (bl-2025-wegleitung, bl-2026-wegleitung) explains each line by
// its code. The 2026 return has the codes and labels of 2025, but for the pensioners' deduction,
// split into 770 (AHV) and 771 (IV), and a field for a 3a catch-up next to 610/615.
//
// Page 1 (the personal details, the children, capital benefits, the totals carried from the
// securities list, 950 to 973) is not mapped: Taxpresso fills none of its amounts. Not mapped
// either: the securities list itself (Wertschriften- und Guthabenverzeichnis, its totals 300 and 800
// are) and the forms that feed lines (Berufsauslagen for 500 to 535, Krankheitskosten for 720): the
// line gets the amount they carry. What Taxpresso doesn't prepare (self-employment, property,
// capital payments, inheritances, support and care deductions) is listed, marked unsupported.
import type {
  FormColumn,
  FormMap,
  FormPage,
  FormPerson,
  FormRubric,
  Gloss,
} from '@taxpresso/filing-ge';
import type { Text } from '@taxpresso/rules-ch';

export const BL_PAGE_IDS = ['S2', 'S3', 'S4'] as const;
export type BlPageId = (typeof BL_PAGE_IDS)[number];

type Options = Partial<
  Pick<
    FormRubric<BlPageId>,
    'code' | 'person' | 'nature' | 'role' | 'format' | 'columns' | 'supported'
  >
> & { guide?: number };

/** French typography: a no-break space before a colon and a percent sign. */
const frTypo = (s: string) => s.replace(/ ?: /g, ' : ').replace(/ %/g, ' %');

const g = (en: string, fr: string, de?: string): Gloss => ({
  en,
  fr: frTypo(fr),
  ...(de ? { de } : {}),
});

const form = (y: number) => `bl-${y === 2025 ? 2025 : 2026}-steuererklaerung-form`;
const guide = (y: number) => `bl-${y === 2025 ? 2025 : 2026}-wegleitung`;

const ONE: readonly FormColumn[] = ['amount'];
const BOTH: readonly FormColumn[] = ['icc', 'ifd'];
const STATE: readonly FormColumn[] = ['icc'];
const FEDERAL: readonly FormColumn[] = ['ifd'];
const WEALTH: readonly FormColumn[] = ['wealth'];
const A = { person: 'A' as FormPerson };
const B = { person: 'B' as FormPerson };
const OUT = { supported: false };

/** A line maker for one section of one page of the year's return, with that section's defaults. */
function on(y: number, page: BlPageId, pdfPage: number, section: string, defaults: Options) {
  return (key: string, label: string, en: string, fr: string, options: Options = {}) => {
    const o = { ...defaults, ...options };
    const rubric: FormRubric<BlPageId> = {
      key,
      code: o.code ?? key,
      page,
      section,
      person: o.person ?? 'household',
      label,
      gloss: g(en, fr),
      nature: o.nature ?? 'income',
      role: o.role ?? 'input',
      format: o.format ?? 'money',
      columns: o.columns ?? ONE,
      supported: o.supported ?? true,
      source: `${form(y)} p. ${pdfPage}${o.guide !== undefined ? `; ${guide(y)} p. ${o.guide}` : ''}`,
    };
    return rubric;
  };
}

// ---- Seite 2: Einkünfte im In- und Ausland -----------------------------------------------------

function page2(y: number): FormRubric<BlPageId>[] {
  const s2 = (section: string, more: Options = {}) => on(y, 'S2', 2, section, more);
  const job = s2('unselbstaendig', { guide: 12 });
  const self = s2('selbstaendig', { ...OUT, guide: 13 });
  const social = s2('versicherungen', { guide: 16 });
  const securities = s2('wertschriften', { guide: 17 });
  const other = s2('weitere', { guide: 17 });
  const property = s2('liegenschaften', { ...OUT, columns: BOTH, guide: 18 });
  return [
    job(
      '100',
      'Haupterwerb, Person 1',
      'Main job, net salary (salary certificate, box 11), person 1',
      'Activité principale, salaire net (certificat de salaire, case 11), personne 1',
      A,
    ),
    job(
      '105',
      'Haupterwerb, Person 2',
      'Main job, net salary (salary certificate, box 11), person 2',
      'Activité principale, salaire net (certificat de salaire, case 11), personne 2',
      B,
    ),
    job(
      '110',
      'Nebenerwerb, Person 1',
      'Side job, net salary, person 1',
      'Activité accessoire, salaire net, personne 1',
      { ...A, guide: 13 },
    ),
    job(
      '115',
      'Nebenerwerb, Person 2',
      'Side job, net salary, person 2',
      'Activité accessoire, salaire net, personne 2',
      { ...B, guide: 13 },
    ),
    job(
      '120',
      'Weitere Vergütungen, Person 1',
      'Other payments (board fees and the like), person 1',
      'Autres rémunérations (tantièmes et autres), personne 1',
      { ...A, ...OUT, guide: 13 },
    ),
    job(
      '125',
      'Weitere Vergütungen, Person 2',
      'Other payments (board fees and the like), person 2',
      'Autres rémunérations (tantièmes et autres), personne 2',
      { ...B, ...OUT, guide: 13 },
    ),
    self(
      '150',
      'Haupterwerb (selbständige Erwerbstätigkeit), Person 1',
      'Self-employment, person 1',
      'Activité indépendante, personne 1',
      A,
    ),
    self(
      '155',
      'Haupterwerb (selbständige Erwerbstätigkeit), Person 2',
      'Self-employment, person 2',
      'Activité indépendante, personne 2',
      B,
    ),
    self(
      '160',
      'Nebenerwerb (selbständige Erwerbstätigkeit), Person 1',
      'Self-employed side job, person 1',
      'Activité indépendante accessoire, personne 1',
      A,
    ),
    self(
      '165',
      'Nebenerwerb (selbständige Erwerbstätigkeit), Person 2',
      'Self-employed side job, person 2',
      'Activité indépendante accessoire, personne 2',
      B,
    ),
    social(
      '200',
      'AHV-/IV-Renten (zu 100 %), Person 1',
      'AHV/IV pension, in full, person 1',
      'Rente AVS/AI, en entier, personne 1',
      A,
    ),
    social(
      '205',
      'AHV-/IV-Renten (zu 100 %), Person 2',
      'AHV/IV pension, in full, person 2',
      'Rente AVS/AI, en entier, personne 2',
      B,
    ),
    social(
      '220',
      'Renten aus Pensionskassen, Person 1',
      'Pension fund pension, the taxable share, person 1',
      'Rente de caisse de pension, la part imposable, personne 1',
      A,
    ),
    social(
      '225',
      'Renten aus Pensionskassen, Person 2',
      'Pension fund pension, the taxable share, person 2',
      'Rente de caisse de pension, la part imposable, personne 2',
      B,
    ),
    social(
      '230',
      'Übrige Renten, Person 1',
      'Other pensions, the taxable share, person 1',
      'Autres rentes, la part imposable, personne 1',
      A,
    ),
    social(
      '235',
      'Übrige Renten, Person 2',
      'Other pensions, the taxable share, person 2',
      'Autres rentes, la part imposable, personne 2',
      B,
    ),
    social(
      '260',
      'Erwerbsausfallentschädigungen, Person 1',
      'Unemployment and loss-of-earnings allowances not on a salary certificate (attestation), person 1',
      'Indemnités de chômage et pour perte de gain hors certificat de salaire (attestation), personne 1',
      { ...A, guide: 17 },
    ),
    social(
      '270',
      'Erwerbsausfallentschädigungen, Person 2',
      'Unemployment and loss-of-earnings allowances not on a salary certificate (attestation), person 2',
      'Indemnités de chômage et pour perte de gain hors certificat de salaire (attestation), personne 2',
      { ...B, guide: 17 },
    ),
    securities(
      '300',
      'Einkünfte aus Guthaben, Wertschriften und Lotterien',
      'Income from accounts and securities, carried from the securities list (Wertschriften- und Guthabenverzeichnis)',
      'Rendement des avoirs et des titres, reporté de l’état des titres (Wertschriften- und Guthabenverzeichnis)',
      { role: 'report' },
    ),
    other(
      '310',
      'Unterhaltsbeiträge',
      'Alimony received from a former spouse',
      'Pension alimentaire reçue de l’ex-conjoint',
    ),
    other(
      '320',
      'Unterhaltsbeiträge für minderjährige Kinder',
      'Child support received for minor children',
      'Contributions d’entretien reçues pour des enfants mineurs',
    ),
    other(
      '350',
      'Ertrag aus unverteilten Erbschaften',
      'Income from an undivided inheritance',
      'Rendement d’une succession non partagée',
      { ...OUT, guide: 18 },
    ),
    other(
      '380',
      'Übrige Einkünfte; nähere Bezeichnung',
      'Other income (say what it is)',
      'Autres revenus (préciser)',
      { guide: 18 },
    ),
    other(
      '390',
      'Kapitalabfindungen anstelle wiederkehrender Leistungen',
      'Lump sums instead of recurring payments',
      'Prestations en capital à la place de prestations périodiques',
      { ...OUT, guide: 18 },
    ),
    s2('zwischentotal', { role: 'total' })(
      '399',
      'Zwischentotal',
      'Subtotal of the income above',
      'Sous-total des revenus ci-dessus',
    ),
    s2('uebertrag', { role: 'report', columns: BOTH })(
      '399-uebertrag',
      'Übertrag',
      'The subtotal 399, carried to both columns',
      'Le sous-total 399, reporté dans les deux colonnes',
      { code: '399' },
    ),
    property(
      '400',
      'Eigenmietwert, in BL, selbst genutzt',
      'Rental value of your own home in Basel-Landschaft',
      'Valeur locative de votre logement à Bâle-Campagne',
    ),
    property(
      '405',
      'Miet- und Pachtzinsen, in BL',
      'Rents received in Basel-Landschaft',
      'Loyers encaissés à Bâle-Campagne',
    ),
    property(
      '410',
      'Mietwert, Miet- und Pachtzinsen, ausserhalb BL',
      'Rental value and rents outside Basel-Landschaft',
      'Valeur locative et loyers hors de Bâle-Campagne',
    ),
    property(
      '415',
      'abzüglich Liegenschaftsunterhalt, in BL',
      'Less property upkeep in Basel-Landschaft',
      'Moins l’entretien d’immeubles à Bâle-Campagne',
    ),
    property(
      '420',
      'abzüglich Liegenschaftsunterhalt, ausserhalb BL',
      'Less property upkeep outside Basel-Landschaft',
      'Moins l’entretien d’immeubles hors de Bâle-Campagne',
    ),
    property(
      '430',
      'Eigenmietwert (Geschäftsvermögen), in BL, selbst genutzt',
      'Business property: rental value in Basel-Landschaft',
      'Immeubles commerciaux : valeur locative à Bâle-Campagne',
    ),
    property(
      '440',
      'Miet- und Pachtzinsen (Geschäftsvermögen), in BL',
      'Business property: rents in Basel-Landschaft',
      'Immeubles commerciaux : loyers à Bâle-Campagne',
    ),
    property(
      '450',
      'Mietwert, Miet- und Pachtzinsen (Geschäftsvermögen), ausserhalb BL',
      'Business property: rental value and rents outside Basel-Landschaft',
      'Immeubles commerciaux : valeur locative et loyers hors de Bâle-Campagne',
    ),
    property(
      '460',
      'abzüglich Liegenschaftsunterhalt (Geschäftsvermögen), in BL',
      'Business property: less upkeep in Basel-Landschaft',
      'Immeubles commerciaux : moins l’entretien à Bâle-Campagne',
    ),
    property(
      '470',
      'abzüglich Liegenschaftsunterhalt (Geschäftsvermögen), ausserhalb BL',
      'Business property: less upkeep outside Basel-Landschaft',
      'Immeubles commerciaux : moins l’entretien hors de Bâle-Campagne',
    ),
    s2('total', { role: 'total', columns: BOTH })(
      '499',
      'Total der Einkünfte',
      'Total income, in both columns',
      'Total des revenus, dans les deux colonnes',
    ),
  ];
}

// ---- Seite 3: Abzüge, Staatssteuer und Bundessteuer --------------------------------------------

function page3(y: number): FormRubric<BlPageId>[] {
  const s3 = (section: string, more: Options = {}) =>
    on(y, 'S3', 3, section, { nature: 'deduction', columns: BOTH, ...more });
  const costs = s3('berufsauslagen', { guide: 25 });
  const interest = s3('schuldzinsen', { guide: 29 });
  const pension = s3('vorsorge', { guide: 30 });
  const insurance = s3('versicherung', { guide: 31 });
  const more = s3('weitere');
  const social = s3('sozialabzuege');
  const total = s3('total', { role: 'total' });
  const pensioners =
    y === 2025
      ? [
          social(
            '770',
            'für AHV-/IV-Rentnerinnen/Rentner',
            'Deduction for AHV and IV pensioners (state tax)',
            'Déduction pour bénéficiaires de rentes AVS et AI (impôt cantonal)',
            { columns: STATE, role: 'computed', guide: 38 },
          ),
        ]
      : [
          social(
            '770',
            'für AHV-Rentnerinnen/Rentner',
            'Deduction for AHV pensioners (state tax)',
            'Déduction pour bénéficiaires de rentes AVS (impôt cantonal)',
            { columns: STATE, role: 'computed', guide: 39 },
          ),
          social(
            '771',
            'für IV-Rentnerinnen/Rentner',
            'Deduction for IV pensioners (state tax)',
            'Déduction pour bénéficiaires de rentes AI (impôt cantonal)',
            { columns: STATE, role: 'computed', guide: 40 },
          ),
        ];
  return [
    costs(
      '500',
      'Fahrtkosten zwischen Wohn- und Arbeitsstätte, Person 1',
      'Travel to work, person 1 (Berufsauslagen form)',
      'Frais de déplacement, personne 1 (formulaire Berufsauslagen)',
      A,
    ),
    costs(
      '505',
      'Fahrtkosten zwischen Wohn- und Arbeitsstätte, Person 2',
      'Travel to work, person 2 (Berufsauslagen form)',
      'Frais de déplacement, personne 2 (formulaire Berufsauslagen)',
      B,
    ),
    costs(
      '510',
      'Mehrkosten für auswärtige Verpflegung, Person 1',
      'Lunch away from home, person 1',
      'Repas hors du domicile, personne 1',
      { ...A, guide: 27 },
    ),
    costs(
      '515',
      'Mehrkosten für auswärtige Verpflegung, Person 2',
      'Lunch away from home, person 2',
      'Repas hors du domicile, personne 2',
      { ...B, guide: 27 },
    ),
    costs(
      '520',
      'Übrige berufsnotwendige Kosten, Person 1',
      'Other professional costs, person 1 (state: CHF 500 flat plus proven costs; federal: 3 % flat or actual costs)',
      'Autres frais professionnels, personne 1 (canton : forfait de CHF 500 plus frais prouvés ; fédéral : forfait de 3 % ou frais effectifs)',
      { ...A, guide: 28 },
    ),
    costs(
      '525',
      'Übrige berufsnotwendige Kosten, Person 2',
      'Other professional costs, person 2 (state: CHF 500 flat plus proven costs; federal: 3 % flat or actual costs)',
      'Autres frais professionnels, personne 2 (canton : forfait de CHF 500 plus frais prouvés ; fédéral : forfait de 3 % ou frais effectifs)',
      { ...B, guide: 28 },
    ),
    costs(
      '530',
      'Auslagen bei Nebenerwerb, Person 1',
      'Costs of a side job, person 1',
      'Frais de l’activité accessoire, personne 1',
      { ...A, guide: 28 },
    ),
    costs(
      '535',
      'Auslagen bei Nebenerwerb, Person 2',
      'Costs of a side job, person 2',
      'Frais de l’activité accessoire, personne 2',
      { ...B, guide: 28 },
    ),
    interest(
      '550',
      'Private Schuldzinsen: Hypothekarzinsen',
      'Mortgage interest',
      'Intérêts hypothécaires',
      OUT,
    ),
    interest(
      '555',
      'Private Schuldzinsen: übrige Schuldzinsen',
      'Interest on other private debts (receipts)',
      'Intérêts d’autres dettes privées (justificatifs)',
    ),
    interest(
      '560',
      'Geschäftliche Schuldzinsen',
      'Business debt interest',
      'Intérêts de dettes commerciales',
      OUT,
    ),
    interest(
      '570',
      'Unterhaltsbeiträge',
      'Alimony paid to a former spouse',
      'Pension alimentaire versée à l’ex-conjoint',
    ),
    interest(
      '575',
      'Unterhaltsbeiträge an minderjährige Kinder',
      'Child support paid for minor children',
      'Contributions d’entretien versées pour des enfants mineurs',
    ),
    interest(
      '580',
      'Rentenzahlungen und dauernde Lasten',
      'Annuities and permanent charges paid',
      'Rentes et charges durables versées',
      { ...OUT, guide: 30 },
    ),
    pension(
      '600',
      'Einkäufe 2. Säule / Beiträge, Person 1',
      'Pension fund buy-ins and contributions paid yourself, person 1 (attestation)',
      'Rachats et cotisations de prévoyance payés vous-même, personne 1 (attestation)',
      A,
    ),
    pension(
      '605',
      'Einkäufe 2. Säule / Beiträge, Person 2',
      'Pension fund buy-ins and contributions paid yourself, person 2 (attestation)',
      'Rachats et cotisations de prévoyance payés vous-même, personne 2 (attestation)',
      B,
    ),
    pension(
      '610',
      'Beiträge 3. Säule, Person 1',
      'Pillar 3a, person 1 (attestation)',
      '3e pilier A, personne 1 (attestation)',
      A,
    ),
    pension(
      '615',
      'Beiträge 3. Säule, Person 2',
      'Pillar 3a, person 2 (attestation)',
      '3e pilier A, personne 2 (attestation)',
      B,
    ),
    insurance(
      '620',
      'Versicherungsprämien und Zinsen von Sparkapitalien: Ehepaare / eingetragene Partnerschaften',
      'Insurance premiums and savings interest, married couple (state: the flat maximum; federal: what you paid, at most the maximum)',
      'Primes d’assurance et intérêts d’épargne, couple marié (canton : le maximum forfaitaire ; fédéral : ce que vous avez payé, au plus le maximum)',
      { role: 'computed' },
    ),
    insurance(
      '625',
      'Versicherungsprämien und Zinsen von Sparkapitalien: Übrige steuerpflichtige Personen',
      'Insurance premiums and savings interest, everyone else (state: the flat maximum; federal: what you paid, at most the maximum)',
      'Primes d’assurance et intérêts d’épargne, autres contribuables (canton : le maximum forfaitaire ; fédéral : ce que vous avez payé, au plus le maximum)',
      { role: 'computed' },
    ),
    insurance(
      '630',
      'Versicherungsprämien: Kinder',
      'Insurance premiums, children',
      'Primes d’assurance, enfants',
      { role: 'computed', guide: 32 },
    ),
    more(
      '640',
      'Kinderbetreuung durch Dritte',
      'Childcare by others (receipts)',
      'Frais de garde des enfants par des tiers (justificatifs)',
      { guide: 32 },
    ),
    more(
      '645',
      'AHV-, IV- und EO-Beiträge nicht erwerbstätiger Personen',
      'AHV contributions of people without work',
      'Cotisations AVS des personnes sans activité lucrative',
      { ...OUT, guide: 33 },
    ),
    more(
      '650',
      'Aus- und Weiterbildungskosten',
      'Professional training costs (P1 + P2)',
      'Frais de formation et de perfectionnement (P1 + P2)',
      { guide: 33 },
    ),
    more(
      '655',
      'Kosten für Vermögensverwaltung',
      'Costs of keeping securities and accounts',
      'Frais d’administration de la fortune',
      { guide: 33 },
    ),
    more('670', 'Übrige Abzüge', 'Other deductions', 'Autres déductions', { ...OUT, guide: 34 }),
    more(
      '680',
      'Abzug bei Erwerbstätigkeit beider Personen (P1+P2)',
      'Deduction when both spouses work',
      'Déduction lorsque les deux conjoints travaillent',
      { role: 'computed', guide: 34 },
    ),
    more(
      '720',
      'Krankheits- und Unfallkosten',
      'Illness and accident costs (Krankheitskosten form; federal: above the threshold)',
      'Frais de maladie et d’accident (formulaire Krankheitskosten ; fédéral : au-delà de la franchise)',
      { guide: 35 },
    ),
    more(
      '730',
      'Behinderungsbedingte Kosten',
      'Costs due to a disability',
      'Frais liés à un handicap',
      { ...OUT, guide: 35 },
    ),
    more(
      '735',
      'Zuwendungen an politische Parteien',
      'Payments to political parties',
      'Versements aux partis politiques',
      { guide: 36 },
    ),
    more(
      '738',
      'Freiwillige Zuwendungen',
      'Donations to tax-exempt organisations (list)',
      'Dons à des institutions exonérées (liste)',
      { guide: 36 },
    ),
    social(
      '750',
      'Sozialabzüge: für Kinder',
      'Deduction for children (federal tax; the state tax takes the child reduction off the tax itself)',
      'Déduction pour enfants (impôt fédéral ; l’impôt cantonal déduit la réduction pour enfant de l’impôt lui-même)',
      { columns: FEDERAL, role: 'computed', guide: y === 2025 ? 36 : 37 },
    ),
    social(
      '760',
      'Sozialabzüge: für unterstützungsbedürftige Personen',
      'Deduction for a person you support',
      'Déduction pour personne à charge',
      { ...OUT, guide: 37 },
    ),
    social(
      '765',
      'Sozialabzüge: für pflegebedürftige Personen',
      'Deduction for a person you care for (state tax)',
      'Déduction pour personne nécessitant des soins (impôt cantonal)',
      { ...OUT, columns: STATE, guide: 37 },
    ),
    ...pensioners,
    social(
      '775',
      'Sozialabzüge: für Ehepaare / eingetragene Partnerschaften',
      'Deduction for married couples (federal tax)',
      'Déduction pour couples mariés (impôt fédéral)',
      { columns: FEDERAL, role: 'computed', guide: y === 2025 ? 39 : 41 },
    ),
    total('789', 'Total der Abzüge', 'Total deductions', 'Total des déductions'),
    total(
      '790',
      'Steuerbares Einkommen (Ziffer 499 abzüglich Ziffer 789)',
      'Taxable income: 499 less 789',
      'Revenu imposable : 499 moins 789',
    ),
  ];
}

// ---- Seite 4: Vermögen im In- und Ausland ------------------------------------------------------

function page4(y: number): FormRubric<BlPageId>[] {
  const s4 = (section: string, more: Options = {}) =>
    on(y, 'S4', 4, section, { nature: 'wealth', columns: WEALTH, ...more });
  const movable = s4('beweglich', { guide: y === 2025 ? 39 : 42 });
  const property = s4('liegenschaften', { ...OUT, guide: y === 2025 ? 41 : 44 });
  const debts = s4('schulden', { guide: y === 2025 ? 42 : 45 });
  const free = s4('steuerfrei', { role: 'computed', guide: y === 2025 ? 42 : 45 });
  return [
    movable(
      '800',
      'Wertschriften und Guthaben',
      'Accounts and securities, carried from the securities list (Wertschriften- und Guthabenverzeichnis)',
      'Titres et avoirs, reportés de l’état des titres (Wertschriften- und Guthabenverzeichnis)',
      { role: 'report' },
    ),
    movable(
      '805',
      'Bargeld, Gold und andere Edelmetalle',
      'Cash, gold and other precious metals',
      'Numéraire, or et autres métaux précieux',
    ),
    movable(
      '810',
      'Lebens- und Rentenversicherungen',
      'Life and annuity insurance, surrender value (attestation)',
      'Assurances sur la vie et de rentes, valeur de rachat (attestation)',
    ),
    movable(
      '815',
      'Motorfahrzeuge',
      'Vehicles, at the guide’s share of their new value',
      'Véhicules, à la part de leur valeur à neuf du guide',
    ),
    movable(
      '820',
      'Anteile an unverteilten Erbschaften',
      'Shares in an undivided inheritance',
      'Parts de successions non partagées',
      OUT,
    ),
    movable(
      '825',
      'Übrige Vermögenswerte',
      'Other assets (collections, works of art, jewellery)',
      'Autres éléments de fortune (collections, œuvres d’art, bijoux)',
    ),
    property(
      '831',
      'Liegenschaften in BL: Bodenwert',
      'Property in Basel-Landschaft: land value',
      'Immeubles à Bâle-Campagne : valeur du terrain',
    ),
    property(
      '841',
      'Liegenschaften in BL: Gebäudewert',
      'Property in Basel-Landschaft: building value',
      'Immeubles à Bâle-Campagne : valeur du bâtiment',
    ),
    property(
      '851',
      'Liegenschaften ausserhalb BL',
      'Property outside Basel-Landschaft',
      'Immeubles hors de Bâle-Campagne',
    ),
    property(
      '869',
      'Geschäftsaktiven Selbständigerwerbender',
      'Business assets of the self-employed',
      'Actifs commerciaux des indépendants',
    ),
    property(
      '879',
      'Anteile an Personengesellschaften',
      'Shares in partnerships',
      'Parts de sociétés de personnes',
    ),
    s4('total', { role: 'total' })(
      '885',
      'Total der Vermögenswerte',
      'Total assets',
      'Total des éléments de fortune',
    ),
    debts('890', 'Private Schulden: Hypothek(en)', 'Mortgages', 'Hypothèques', OUT),
    debts(
      '891',
      'Private Schulden: übrige Schulden',
      'Other private debts (receipts)',
      'Autres dettes privées (justificatifs)',
    ),
    debts('892', 'Geschäftliche Schulden', 'Business debts', 'Dettes commerciales', OUT),
    s4('reinvermoegen', { role: 'total' })('899', 'Reinvermögen', 'Net wealth', 'Fortune nette'),
    free(
      '900',
      'In ungetrennter Ehe oder eingetragener Partnerschaft lebende Steuerpflichtige und Einelternfamilien',
      'Tax-free amount, married couples and single parents',
      'Montant exonéré, couples mariés et familles monoparentales',
    ),
    free(
      '905',
      'Alle anderen steuerpflichtigen Personen',
      'Tax-free amount, everyone else',
      'Montant exonéré, autres contribuables',
    ),
    s4('steuerbar', { role: 'total' })(
      '910',
      'Steuerbares Vermögen',
      'Taxable wealth',
      'Fortune imposable',
    ),
  ];
}

// ---- Pages -------------------------------------------------------------------------------------

const section = (id: string, title: string, en: string, fr: string) => ({
  id,
  title,
  gloss: g(en, fr),
});

function pages(y: number): FormPage<BlPageId>[] {
  return [
    {
      id: 'S2',
      title: `Einkünfte ${y}`,
      gloss: g('Income in Switzerland and abroad', 'Revenus en Suisse et à l’étranger'),
      pdfPage: 2,
      supported: true,
      sections: [
        section(
          'unselbstaendig',
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
          'versicherungen',
          'Einkünfte aus Sozial- und anderen Versicherungen',
          'Pensions and insurance benefits',
          'Rentes et prestations d’assurances',
        ),
        section(
          'wertschriften',
          'Einkünfte aus Guthaben, Wertschriften und Lotterien',
          'Income from accounts and securities',
          'Rendement des avoirs et des titres',
        ),
        section('weitere', 'Weitere Einkünfte', 'Other income', 'Autres revenus'),
        section('zwischentotal', 'Zwischentotal', 'Subtotal', 'Sous-total'),
        section(
          'uebertrag',
          'Übertrag (Staatssteuer, Bundessteuer)',
          'Carried to both columns',
          'Report dans les deux colonnes',
        ),
        section(
          'liegenschaften',
          'Einkünfte aus Liegenschaften',
          'Income from property',
          'Revenus immobiliers',
        ),
        section('total', 'Total der Einkünfte', 'Total income', 'Total des revenus'),
      ],
      source: `${form(y)} p. 2`,
    },
    {
      id: 'S3',
      title: `Abzüge ${y}`,
      gloss: g(
        'Deductions, state and federal tax, and the taxable income',
        'Déductions, impôt cantonal et fédéral, et revenu imposable',
      ),
      pdfPage: 3,
      supported: true,
      sections: [
        section(
          'berufsauslagen',
          'Berufsauslagen bei unselbständiger Erwerbstätigkeit',
          'Professional costs',
          'Frais professionnels',
        ),
        section(
          'schuldzinsen',
          'Schuldzinsen / Unterhaltsbeiträge / Rentenleistungen',
          'Debt interest, alimony and annuities paid',
          'Intérêts passifs, pensions et rentes versées',
        ),
        section(
          'vorsorge',
          'Beiträge an Vorsorgeeinrichtungen',
          'Pension fund and pillar 3a',
          'Prévoyance professionnelle et 3e pilier A',
        ),
        section(
          'versicherung',
          'Versicherungsprämien und Zinsen von Sparkapitalien',
          'Insurance premiums and savings interest',
          'Primes d’assurance et intérêts d’épargne',
        ),
        section('weitere', 'Weitere Abzüge', 'Other deductions', 'Autres déductions'),
        section('sozialabzuege', 'Sozialabzüge', 'Social deductions', 'Déductions sociales'),
        section('total', 'Steuerbares Einkommen', 'Taxable income', 'Revenu imposable'),
      ],
      source: `${form(y)} p. 3`,
    },
    {
      id: 'S4',
      title: `Vermögen im In- und Ausland, Steuerwert am 31.12.${y}`,
      gloss: g('Wealth on 31 December', 'Fortune au 31 décembre'),
      pdfPage: 4,
      supported: true,
      sections: [
        section('beweglich', 'Bewegliches Vermögen', 'Movable wealth', 'Fortune mobilière'),
        section(
          'liegenschaften',
          'Liegenschaften, Geschäftsvermögen',
          'Property and business assets',
          'Immeubles et fortune commerciale',
        ),
        section(
          'total',
          'Total der Vermögenswerte',
          'Total assets',
          'Total des éléments de fortune',
        ),
        section('schulden', 'Schulden', 'Debts', 'Dettes'),
        section('reinvermoegen', 'Reinvermögen', 'Net wealth', 'Fortune nette'),
        section('steuerfrei', 'Steuerfreie Beträge', 'Tax-free amounts', 'Montants exonérés'),
        section('steuerbar', 'Steuerbares Vermögen', 'Taxable wealth', 'Fortune imposable'),
      ],
      source: `${form(y)} p. 4`,
    },
  ];
}

const rubrics = (y: number): FormRubric<BlPageId>[] => [...page2(y), ...page3(y), ...page4(y)];

/** Shown with the 2026 return: its codes come from an early edition of the 2026 form. */
export const BL_FORM_NOTE: Text = {
  en: 'The codes and German terms come from the 2026 Basel-Landschaft return as published on 20 March 2026 (bl-2026-steuererklaerung-form); the return you get in 2027 may differ, so check each line on yours.',
  fr: 'Les codes et les termes allemands viennent de la déclaration 2026 de Bâle-Campagne publiée le 20 mars 2026 (bl-2026-steuererklaerung-form) : celle que vous recevrez en 2027 peut différer, vérifiez donc chaque ligne sur la vôtre.',
  de: 'Die Ziffern und Begriffe stammen aus der Steuererklärung 2026 von Basel-Landschaft, wie sie am 20. März 2026 veröffentlicht wurde (bl-2026-steuererklaerung-form): Die Steuererklärung, die du 2027 erhältst, kann abweichen, prüfe also jede Zeile auf deiner.',
};

export const FORM_BL_2025: FormMap<BlPageId> = {
  taxYear: 2025,
  formYear: 2025,
  provisional: false,
  pages: pages(2025),
  rubrics: rubrics(2025),
};

/**
 * Tax year 2026: the 2026 return of 20 March 2026, the edition published before the year ends; the
 * one mailed in 2027 may differ, so the map is flagged provisional.
 */
export const FORM_BL_2026: FormMap<BlPageId> = {
  taxYear: 2026,
  formYear: 2026,
  provisional: true,
  note: BL_FORM_NOTE,
  pages: pages(2026),
  rubrics: rubrics(2026),
};

export function baselLandFormMap(taxYear: number): FormMap<BlPageId> {
  if (taxYear === 2025) return FORM_BL_2025;
  if (taxYear === 2026) return FORM_BL_2026;
  throw new Error(`No Basel-Landschaft form map for ${taxYear}.`);
}
