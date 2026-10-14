// Zug's main form K (Steuererklärung für natürliche Personen, Kantons- und Gemeindesteuern, Direkte
// Bundessteuer) as printed, in the order you fill it in: page 2 the income (Einkünfte im In- und
// Ausland), page 3 the deductions down to the taxable income 490 (Abzüge), each in two columns,
// "Kanton" and "Bund", and page 4 the wealth (Vermögen im In- und Ausland, Steuerwert am 31.12.).
// Every line with its code and its German label as printed; the gloss says what it is in plain
// words.
//
// Source (docs/sources/zg/manifest.json): the 2025 form K as the guide prints it, filled in for its
// sample household (zg-2025-guide-wegleitung p. 17 to 19, Mustersteuererklärung); the guide explains
// each line by its code (p. 20 to 45). The blank 2025 forms are not published online (they are
// mailed with the access data) and the 2026 forms and guide are not out yet
// (docs/sources/zg/NOTES.md, Gaps): tax year 2026 uses the 2025 form, flagged provisional.
//
// Page 1 (the personal details, the children, the people you support) is not mapped: Taxpresso fills
// none of its amounts. Not mapped either: the forms that feed lines (Berufsauslagen BA for 201/202,
// Versicherungsprämien VZ for 230, KDBK for 253, Gemeinnützige Zuwendungen GZ for 296, the
// securities list WV for 160 and 600): the line gets the amount they carry. What Taxpresso doesn't
// prepare (self-employment, property, capital payments, the support deduction, several cantons) is
// listed, marked unsupported.
import type {
  FormColumn,
  FormMap,
  FormPage,
  FormPerson,
  FormRubric,
  Gloss,
} from '@taxpresso/filing-ge';
import type { Text } from '@taxpresso/rules-ch';

export const ZG_PAGE_IDS = ['K2', 'K3', 'K4'] as const;
export type ZgPageId = (typeof ZG_PAGE_IDS)[number];

type Options = Partial<
  Pick<
    FormRubric<ZgPageId>,
    'code' | 'person' | 'nature' | 'role' | 'format' | 'columns' | 'supported'
  >
> & { guide?: string };

/** French typography: a no-break space before a colon and a percent sign. */
const frTypo = (s: string) => s.replace(/ ?: /g, ' : ').replace(/ %/g, ' %');

const g = (en: string, fr: string, de?: string): Gloss => ({
  en,
  fr: frTypo(fr),
  ...(de ? { de } : {}),
});

const GUIDE = 'zg-2025-guide-wegleitung';

const BOTH: readonly FormColumn[] = ['icc', 'ifd'];
const CANTON: readonly FormColumn[] = ['icc'];
const FEDERAL: readonly FormColumn[] = ['ifd'];
const WEALTH: readonly FormColumn[] = ['wealth'];
const A = { person: 'A' as FormPerson };
const B = { person: 'B' as FormPerson };
const OUT = { supported: false };

/** A line maker for one section of one page of form K, with that section's defaults. */
function on(page: ZgPageId, pdfPage: number, section: string, defaults: Options) {
  return (key: string, label: string, en: string, fr: string, options: Options = {}) => {
    const o = { ...defaults, ...options };
    const rubric: FormRubric<ZgPageId> = {
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
      columns: o.columns ?? BOTH,
      supported: o.supported ?? true,
      source: `${GUIDE} p. ${pdfPage} (Mustersteuererklärung, Formular K)${o.guide !== undefined ? `, p. ${o.guide}` : ''}`,
    };
    return rubric;
  };
}

// ---- Seite 2: Einkünfte im In- und Ausland -----------------------------------------------------

function page2(): FormRubric<ZgPageId>[] {
  const k2 = (section: string, more: Options = {}) => on('K2', 17, section, more);
  const job = k2('unselbstaendig', { guide: '20' });
  const self = k2('selbstaendig', { ...OUT, guide: '21' });
  const social = k2('versicherungen', { guide: '22' });
  const securities = k2('wertschriften', { guide: '23' });
  const other = k2('uebrige', { guide: '28' });
  const property = k2('liegenschaften', { ...OUT, guide: '29 and 30' });
  return [
    job(
      '100',
      'Haupterwerb (Nettolohn gemäss Lohnausweis), Person 1',
      'Main job, net salary (salary certificate, box 11), person 1',
      'Activité principale, salaire net (certificat de salaire, case 11), personne 1',
      A,
    ),
    job(
      '101',
      'Haupterwerb (Nettolohn gemäss Lohnausweis), Person 2',
      'Main job, net salary (salary certificate, box 11), person 2',
      'Activité principale, salaire net (certificat de salaire, case 11), personne 2',
      B,
    ),
    job(
      '105',
      'Nebenerwerb (Nettolohn gemäss Lohnausweis), Person 1',
      'Side job, net salary, person 1',
      'Activité accessoire, salaire net, personne 1',
      A,
    ),
    job(
      '106',
      'Nebenerwerb (Nettolohn gemäss Lohnausweis), Person 2',
      'Side job, net salary, person 2',
      'Activité accessoire, salaire net, personne 2',
      B,
    ),
    job(
      '110',
      'Privatanteile/Weitere Gehaltsnebenleistungen, Person 1',
      'Private use and other benefits not on the salary certificate, person 1',
      'Parts privées et autres prestations hors certificat de salaire, personne 1',
      { ...A, ...OUT },
    ),
    job(
      '111',
      'Privatanteile/Weitere Gehaltsnebenleistungen, Person 2',
      'Private use and other benefits not on the salary certificate, person 2',
      'Parts privées et autres prestations hors certificat de salaire, personne 2',
      { ...B, ...OUT },
    ),
    self(
      '115',
      'Selbständige Erwerbstätigkeit (GB/LB), Person 1',
      'Self-employment, person 1',
      'Activité indépendante, personne 1',
      A,
    ),
    self(
      '116',
      'Selbständige Erwerbstätigkeit (GB/LB), Person 2',
      'Self-employment, person 2',
      'Activité indépendante, personne 2',
      B,
    ),
    self(
      '125',
      'Personengesellschaft (KOLL), Person 1',
      'Partnership, person 1',
      'Société de personnes, personne 1',
      A,
    ),
    self(
      '126',
      'Personengesellschaft (KOLL), Person 2',
      'Partnership, person 2',
      'Société de personnes, personne 2',
      B,
    ),
    social(
      '130',
      'AHV-/IV-Renten, Person 1',
      'AHV/IV pension, in full, person 1',
      'Rente AVS/AI, en entier, personne 1',
      A,
    ),
    social(
      '131',
      'AHV-/IV-Renten, Person 2',
      'AHV/IV pension, in full, person 2',
      'Rente AVS/AI, en entier, personne 2',
      B,
    ),
    social(
      '135',
      'Renten/Pensionen (Waisenrenten, SUVA-Renten usw.), Person 1',
      'Pensions (pension fund, orphans’, SUVA), the taxable share, person 1',
      'Rentes et pensions (caisse de pension, orphelins, SUVA), la part imposable, personne 1',
      A,
    ),
    social(
      '136',
      'Renten/Pensionen (Waisenrenten, SUVA-Renten usw.), Person 2',
      'Pensions (pension fund, orphans’, SUVA), the taxable share, person 2',
      'Rentes et pensions (caisse de pension, orphelins, SUVA), la part imposable, personne 2',
      B,
    ),
    social(
      '140',
      'Leibrenten, Person 1',
      'Life annuities, person 1',
      'Rentes viagères, personne 1',
      {
        ...A,
        ...OUT,
      },
    ),
    social(
      '141',
      'Leibrenten, Person 2',
      'Life annuities, person 2',
      'Rentes viagères, personne 2',
      {
        ...B,
        ...OUT,
      },
    ),
    social(
      '145',
      'Erwerbsausfallentschädigungen, soweit nicht im Lohnausweis enthalten, Person 1',
      'Loss-of-earnings allowances not on a salary certificate (attestation), person 1',
      'Indemnités pour perte de gain hors certificat de salaire (attestation), personne 1',
      A,
    ),
    social(
      '146',
      'Erwerbsausfallentschädigungen, soweit nicht im Lohnausweis enthalten, Person 2',
      'Loss-of-earnings allowances not on a salary certificate (attestation), person 2',
      'Indemnités pour perte de gain hors certificat de salaire (attestation), personne 2',
      B,
    ),
    social(
      '150',
      'Taggelder aus Arbeitslosenversicherung, Person 1',
      'Unemployment benefits (attestation of the unemployment fund), person 1',
      'Indemnités de chômage (attestation de la caisse de chômage), personne 1',
      A,
    ),
    social(
      '151',
      'Taggelder aus Arbeitslosenversicherung, Person 2',
      'Unemployment benefits (attestation of the unemployment fund), person 2',
      'Indemnités de chômage (attestation de la caisse de chômage), personne 2',
      B,
    ),
    social(
      '155',
      'Von der Ausgleichskasse direkt ausbezahlte Kinder- und Familienzulagen, Person 1',
      'Child allowances paid directly by the compensation office, person 1',
      'Allocations familiales versées directement par la caisse de compensation, personne 1',
      { ...A, ...OUT },
    ),
    social(
      '156',
      'Von der Ausgleichskasse direkt ausbezahlte Kinder- und Familienzulagen, Person 2',
      'Child allowances paid directly by the compensation office, person 2',
      'Allocations familiales versées directement par la caisse de compensation, personne 2',
      { ...B, ...OUT },
    ),
    securities(
      '160',
      'Wertschriftenertrag (WV)',
      'Income from accounts and securities, carried from the securities list (Wertschriften- und Guthabenverzeichnis)',
      'Rendement des avoirs et des titres, reporté de l’état des titres (Wertschriften- und Guthabenverzeichnis)',
      { role: 'report' },
    ),
    other(
      '170',
      'Unterhaltsbeiträge vom geschieden/getrennt lebenden Eheteil/Partner',
      'Alimony received from a former spouse',
      'Pension alimentaire reçue de l’ex-conjoint',
    ),
    other(
      '171',
      'Unterhaltsbeiträge für minderjährige Kinder (bis zur Mündigkeit KI)',
      'Child support received for minor children',
      'Contributions d’entretien reçues pour des enfants mineurs',
    ),
    other('173', 'Weitere Einkünfte', 'Other income (say what it is)', 'Autres revenus (préciser)'),
    other(
      '174',
      'Kapitalabfindungen für wiederkehrende Leistungen',
      'Lump sums instead of recurring payments',
      'Prestations en capital à la place de prestations périodiques',
      OUT,
    ),
    property(
      '181',
      'Ertrag/Nutzniessung private Liegenschaften (LVZ)',
      'Income from private property',
      'Rendement des immeubles privés',
    ),
    property(
      '183',
      'Wohnrecht',
      'Right of residence (rental value)',
      'Droit d’habitation (valeur locative)',
    ),
    k2('total', { role: 'total' })(
      '190',
      'Total Einkünfte (Übertrag nach Code 285)',
      'Total income, in both columns',
      'Total des revenus, dans les deux colonnes',
    ),
  ];
}

// ---- Seite 3: Abzüge, Kanton und Bund ----------------------------------------------------------

function page3(): FormRubric<ZgPageId>[] {
  const k3 = (section: string, more: Options = {}) =>
    on('K3', 18, section, { nature: 'deduction', ...more });
  const costs = k3('berufsauslagen', { guide: '32 to 34' });
  const interest = k3('schuldzinsen', { guide: '34 and 35' });
  const upkeep = k3('unterhalt', { guide: '35' });
  const pension = k3('vorsorge', { guide: '36' });
  const insurance = k3('versicherung', { role: 'computed', guide: '37' });
  const more = k3('weitere');
  const total = k3('total', { role: 'total' });
  const further = k3('zusaetzlich');
  const social = k3('sozialabzuege', { role: 'computed', guide: '41 and 42' });
  return [
    costs(
      '201',
      'Berufsauslagen bei unselbständiger Erwerbstätigkeit (BA), Person 1',
      'Professional costs, person 1 (Berufsauslagen form: travel, meals, the flat or actual other costs, a side job)',
      'Frais professionnels, personne 1 (formulaire Berufsauslagen : déplacements, repas, forfait ou frais effectifs, activité accessoire)',
      A,
    ),
    costs(
      '202',
      'Berufsauslagen bei unselbständiger Erwerbstätigkeit (BA), Person 2',
      'Professional costs, person 2 (Berufsauslagen form: travel, meals, the flat or actual other costs, a side job)',
      'Frais professionnels, personne 2 (formulaire Berufsauslagen : déplacements, repas, forfait ou frais effectifs, activité accessoire)',
      B,
    ),
    interest(
      '205',
      'Private Schuldzinsen, unverteilte Erbschaften und Baukreditzinsen (SV)',
      'Interest on private debts (Schuldenverzeichnis form)',
      'Intérêts de dettes privées (formulaire Schuldenverzeichnis)',
    ),
    upkeep(
      '210',
      'Unterhaltsbeiträge an geschiedenen/getrennten Ehegatten / Partner',
      'Alimony paid to a former spouse',
      'Pension alimentaire versée à l’ex-conjoint',
    ),
    upkeep(
      '211',
      'Unterhaltsbeiträge für minderjährige Kinder (KI)',
      'Child support paid for minor children',
      'Contributions d’entretien versées pour des enfants mineurs',
    ),
    pension(
      '220',
      'Beiträge gebundene Vorsorge gemäss Bescheinigungen (VO), Person 1',
      'Pillar 3a, person 1 (attestation)',
      '3e pilier A, personne 1 (attestation)',
      A,
    ),
    pension(
      '221',
      'Beiträge gebundene Vorsorge gemäss Bescheinigungen (VO), Person 2',
      'Pillar 3a, person 2 (attestation)',
      '3e pilier A, personne 2 (attestation)',
      B,
    ),
    insurance(
      '230',
      'Versicherungsprämien und Zinsen von Sparkapitalien (VZ)',
      'Insurance premiums and savings interest (Versicherungsprämien form: what you paid, at most each column’s maximum)',
      'Primes d’assurance et intérêts d’épargne (formulaire Versicherungsprämien : ce que vous avez payé, au plus le maximum de chaque colonne)',
    ),
    more(
      '240',
      'AHV-Beiträge, Prämien für NBUV, soweit nicht im Lohnausweis enthalten',
      'AHV contributions and accident premiums not on a salary certificate',
      'Cotisations AVS et primes d’accident hors certificat de salaire',
      { ...OUT, guide: '37' },
    ),
    more(
      '245',
      'Selbst getragene berufsorientierte Aus- und Weiterbildungskosten, Person 1',
      'Professional training paid yourself, person 1',
      'Formation continue à vos frais, personne 1',
      { ...A, guide: '37' },
    ),
    more(
      '246',
      'Selbst getragene berufsorientierte Aus- und Weiterbildungskosten, Person 2',
      'Professional training paid yourself, person 2',
      'Formation continue à vos frais, personne 2',
      { ...B, guide: '37' },
    ),
    more(
      '250',
      'Beiträge an die 2. Säule (inklusive Einkaufsbeiträgen), soweit nicht im Lohnausweis enthalten (VO), Person 1',
      'Pension fund buy-ins paid yourself, person 1 (attestation)',
      'Rachats de prévoyance payés vous-même, personne 1 (attestation)',
      { ...A, guide: '37' },
    ),
    more(
      '251',
      'Beiträge an die 2. Säule (inklusive Einkaufsbeiträgen), soweit nicht im Lohnausweis enthalten (VO), Person 2',
      'Pension fund buy-ins paid yourself, person 2 (attestation)',
      'Rachats de prévoyance payés vous-même, personne 2 (attestation)',
      { ...B, guide: '37' },
    ),
    more(
      '252',
      'Zuwendungen an politische Parteien (PB)',
      'Payments to political parties',
      'Versements aux partis politiques',
      { guide: '38' },
    ),
    more(
      '253',
      'Kinderdrittbetreuungskostenabzug (KDBK)',
      'Childcare by others (KDBK form)',
      'Frais de garde des enfants par des tiers (formulaire KDBK)',
      { guide: '38' },
    ),
    more(
      '255',
      'Kosten für die Vermögensverwaltung',
      'Costs of managing securities and accounts',
      'Frais d’administration de la fortune',
      { guide: '38 and 39' },
    ),
    more(
      '257',
      'Behinderungsbedingte Kosten (BK)',
      'Costs due to a disability',
      'Frais liés à un handicap',
      { ...OUT, guide: '39' },
    ),
    more('258', 'Weitere Abzüge', 'Other deductions', 'Autres déductions', {
      ...OUT,
      guide: '39',
    }),
    more(
      '260',
      'Sonderabzug bei Erwerbstätigkeit beider Eheleute / Partner',
      'Deduction when both spouses work',
      'Déduction lorsque les deux conjoints travaillent',
      { role: 'computed', guide: '40' },
    ),
    total(
      '280',
      'Total Abzüge (Übertrag nach Code 286)',
      'Total deductions',
      'Total des déductions',
    ),
    k3('zwischentotal', { role: 'report' })(
      '285',
      'Total Einkünfte (Übertrag von Code 190)',
      'Total income, carried from 190',
      'Total des revenus, reporté de 190',
    ),
    k3('zwischentotal', { role: 'report' })(
      '286',
      'Total Abzüge (Übertrag von Code 280)',
      'Total deductions, carried from 280',
      'Total des déductions, reporté de 280',
    ),
    k3('zwischentotal', { role: 'total' })(
      '287',
      'Zwischentotal (Code 285 abzüglich Code 286)',
      'Subtotal: 285 less 286',
      'Sous-total : 285 moins 286',
    ),
    further(
      '295',
      'Krankheits- und Unfallkosten (UK)',
      'Illness and accident costs, above 5 % of 287 (Krankheits- und Unfallkosten form)',
      'Frais de maladie et d’accident, au-delà de 5 % de 287 (formulaire Krankheits- und Unfallkosten)',
      { guide: '40' },
    ),
    further(
      '296',
      'Gemeinnützige Zuwendungen (GZ)',
      'Donations to tax-exempt organisations (Gemeinnützige Zuwendungen form)',
      'Dons à des institutions exonérées (formulaire Gemeinnützige Zuwendungen)',
      { guide: '41' },
    ),
    k3('zusaetzlich', { role: 'total' })(
      '299',
      'Reineinkommen (Code 287 abzüglich Codes 295 und 296)',
      'Net income: 287 less 295 and 296',
      'Revenu net : 287 moins 295 et 296',
    ),
    social(
      '400',
      'Abzug Eheleute / eingetragene Partnerschaft',
      'Personal deduction, married couples and parents living with their children (cantonal tax)',
      'Déduction personnelle, couples mariés et parents vivant avec leurs enfants (impôt cantonal)',
      { columns: CANTON },
    ),
    social(
      '401',
      'Abzug Eheleute / eingetragene Partnerschaft (Bund)',
      'Deduction for married couples (federal tax)',
      'Déduction pour couples mariés (impôt fédéral)',
      { columns: FEDERAL },
    ),
    social(
      '402',
      'Abzug für die übrigen Steuerpflichtigen',
      'Personal deduction, everyone else (cantonal tax)',
      'Déduction personnelle, autres contribuables (impôt cantonal)',
      { columns: CANTON },
    ),
    social(
      '403',
      'Kinderabzug',
      'Child deduction, in each column its own amount',
      'Déduction pour enfant, dans chaque colonne son propre montant',
    ),
    social(
      '403a',
      'Kinderabzug Zusatz',
      'Child deduction, more from the year the child turns 15 (cantonal tax)',
      'Déduction pour enfant, supplément dès l’année des 15 ans (impôt cantonal)',
      { columns: CANTON },
    ),
    social(
      '404',
      'Kindereigenbetreuungsabzug',
      'Own care of children under 15 (cantonal tax)',
      'Garde des enfants de moins de 15 ans par les parents (impôt cantonal)',
      { columns: CANTON },
    ),
    social(
      '405',
      'Unterstützungsabzug',
      'Deduction for a person you support',
      'Déduction pour personne à charge',
      OUT,
    ),
    social(
      '406',
      'Abzug für AHV- / IV-Rentner',
      'Deduction for AHV/IV pensioners (cantonal tax)',
      'Déduction pour rentiers AVS/AI (impôt cantonal)',
      { columns: CANTON },
    ),
    social(
      '407',
      'Mietzinsabzug (MZ)',
      'Renters’ deduction (cantonal tax, form MZ)',
      'Déduction pour locataires (impôt cantonal, formulaire MZ)',
      { columns: CANTON },
    ),
    social(
      '410',
      'Reduktion der wirtschaftlichen Doppelbelastung (WV)',
      'Reduction for qualifying participations',
      'Réduction de la double imposition économique',
      OUT,
    ),
    k3('steuerbar', { role: 'total' })(
      '490',
      'Steuerbares Einkommen gesamt',
      'Taxable income',
      'Revenu imposable',
    ),
    k3('steuerbar', OUT)(
      '500-1',
      'Bei Steuerpflicht in mehreren Kantonen / Ländern: Anteil Kanton Zug / CH',
      'Share of Zug or Switzerland, when taxed in several cantons or countries',
      'Part de Zoug ou de la Suisse, en cas d’assujettissement dans plusieurs cantons ou pays',
    ),
  ];
}

// ---- Seite 4: Vermögen im In- und Ausland ------------------------------------------------------

function page4(): FormRubric<ZgPageId>[] {
  const k4 = (section: string, more: Options = {}) =>
    on('K4', 19, section, { nature: 'wealth', columns: WEALTH, ...more });
  const movable = k4('beweglich', { guide: '42 and 43' });
  const property = k4('liegenschaften', { ...OUT, guide: '43' });
  const business = k4('geschaeft', OUT);
  const debts = k4('schulden', { guide: '45' });
  const free = k4('steuerfrei', { role: 'computed', guide: '45' });
  return [
    movable(
      '600',
      'Wertschriften und Guthaben, Anteile an unverteilten Erbschaften (WV)',
      'Accounts and securities, carried from the securities list (Wertschriften- und Guthabenverzeichnis)',
      'Titres et avoirs, reportés de l’état des titres (Wertschriften- und Guthabenverzeichnis)',
      { role: 'report' },
    ),
    movable(
      '601',
      'Bargeld, Gold und andere Edelmetalle',
      'Cash, gold and other precious metals',
      'Numéraire, or et autres métaux précieux',
    ),
    movable(
      '603',
      'Lebensversicherungen',
      'Life insurance, surrender value (attestation)',
      'Assurances-vie, valeur de rachat (attestation)',
    ),
    movable(
      '604',
      'Motorfahrzeuge usw.',
      'Vehicles, at the guide’s share of their purchase price',
      'Véhicules, à la part de leur prix d’achat du guide',
    ),
    movable(
      '606',
      'Übrige Vermögenswerte',
      'Other assets (collections, works of art, jewellery)',
      'Autres éléments de fortune (collections, œuvres d’art, bijoux)',
    ),
    property(
      '610',
      'Steuerwert private Liegenschaften (LVZ)',
      'Private property, tax value',
      'Immeubles privés, valeur fiscale',
    ),
    business(
      '620',
      'Aktiven zu Steuerwerten (GB / LB), Person 1',
      'Business assets, person 1',
      'Actifs commerciaux, personne 1',
      A,
    ),
    business(
      '621',
      'Aktiven zu Steuerwerten (GB / LB), Person 2',
      'Business assets, person 2',
      'Actifs commerciaux, personne 2',
      B,
    ),
    business(
      '622',
      'Vermögensanteile an Personengesellschaften (KOLL), Person 1',
      'Shares in partnerships, person 1',
      'Parts de sociétés de personnes, personne 1',
      A,
    ),
    business(
      '623',
      'Vermögensanteile an Personengesellschaften (KOLL), Person 2',
      'Shares in partnerships, person 2',
      'Parts de sociétés de personnes, personne 2',
      B,
    ),
    k4('total', { role: 'total' })(
      '630',
      'Total der Vermögenswerte',
      'Total assets',
      'Total des éléments de fortune',
    ),
    debts(
      '640',
      'Privatschulden und Schulden aus unverteilten Erbschaften (SV)',
      'Private debts (Schuldenverzeichnis form)',
      'Dettes privées (formulaire Schuldenverzeichnis)',
    ),
    debts(
      '642',
      'Geschäftsschulden (GB / LB), Person 1',
      'Business debts, person 1',
      'Dettes commerciales, personne 1',
      { ...A, ...OUT },
    ),
    debts(
      '643',
      'Geschäftsschulden (GB / LB), Person 2',
      'Business debts, person 2',
      'Dettes commerciales, personne 2',
      { ...B, ...OUT },
    ),
    k4('schulden', { role: 'total' })('650', 'Total Schulden', 'Total debts', 'Total des dettes'),
    k4('reinvermoegen', { role: 'total' })(
      '660',
      'Reinvermögen (Code 630 abzüglich Code 650)',
      'Net wealth: 630 less 650',
      'Fortune nette : 630 moins 650',
    ),
    free(
      '671',
      'Abzug für Eheleute / eingetragene Partnerschaft',
      'Tax-free amount, married couples',
      'Montant exonéré, couples mariés',
    ),
    free(
      '672',
      'Abzug für die übrigen Steuerpflichtigen',
      'Tax-free amount, everyone else',
      'Montant exonéré, autres contribuables',
    ),
    free(
      '673',
      'Abzug für jedes minderjährige Kind',
      'Tax-free amount, each minor child',
      'Montant exonéré, chaque enfant mineur',
    ),
    k4('steuerbar', { role: 'total' })(
      '690',
      'Steuerbares Gesamtvermögen',
      'Taxable wealth',
      'Fortune imposable',
    ),
    k4('steuerbar', OUT)(
      '700',
      'Bei Steuerpflicht in mehreren Kantonen / Ländern: Anteil Kanton Zug / CH',
      'Share of Zug or Switzerland, when taxed in several cantons or countries',
      'Part de Zoug ou de la Suisse, en cas d’assujettissement dans plusieurs cantons ou pays',
    ),
  ];
}

// ---- Pages -------------------------------------------------------------------------------------

const section = (id: string, title: string, en: string, fr: string) => ({
  id,
  title,
  gloss: g(en, fr),
});

function pages(y: number): FormPage<ZgPageId>[] {
  return [
    {
      id: 'K2',
      title: `Einkünfte im In- und Ausland ${y}`,
      gloss: g(
        'Income in Switzerland and abroad (form K, page 2)',
        'Revenus en Suisse et à l’étranger (formulaire K, page 2)',
      ),
      pdfPage: 17,
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
          'Wertschriftenertrag (WV)',
          'Income from accounts and securities',
          'Rendement des avoirs et des titres',
        ),
        section('uebrige', 'Übrige Einkünfte und Gewinne', 'Other income', 'Autres revenus'),
        section(
          'liegenschaften',
          'Nettoeinkünfte von Liegenschaften des Privatvermögens',
          'Income from property',
          'Revenus immobiliers',
        ),
        section('total', 'Total Einkünfte', 'Total income', 'Total des revenus'),
      ],
      source: `${GUIDE} p. 17 (Mustersteuererklärung, Formular K, Seite 2)`,
    },
    {
      id: 'K3',
      title: `Abzüge ${y}`,
      gloss: g(
        'Deductions, cantonal and federal tax, and the taxable income (form K, page 3)',
        'Déductions, impôt cantonal et fédéral, et revenu imposable (formulaire K, page 3)',
      ),
      pdfPage: 18,
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
          'Schuldzinsen (nur Schulden des Privatvermögens)',
          'Debt interest',
          'Intérêts passifs',
        ),
        section('unterhalt', 'Unterhaltsbeiträge', 'Alimony paid', 'Pensions versées'),
        section(
          'vorsorge',
          'Beiträge an anerkannte Formen der gebundenen Selbstvorsorge (Säule 3a)',
          'Pillar 3a',
          '3e pilier A',
        ),
        section(
          'versicherung',
          'Versicherungsprämien und Zinsen von Sparkapitalien',
          'Insurance premiums and savings interest',
          'Primes d’assurance et intérêts d’épargne',
        ),
        section('weitere', 'Weitere Abzüge', 'Other deductions', 'Autres déductions'),
        section('total', 'Total Abzüge', 'Total deductions', 'Total des déductions'),
        section('zwischentotal', 'Zwischentotal', 'Subtotal', 'Sous-total'),
        section(
          'zusaetzlich',
          'Zusätzliche Abzüge',
          'Illness costs and donations',
          'Frais de maladie et dons',
        ),
        section('sozialabzuege', 'Sozialabzüge', 'Social deductions', 'Déductions sociales'),
        section('steuerbar', 'Steuerbares Einkommen', 'Taxable income', 'Revenu imposable'),
      ],
      source: `${GUIDE} p. 18 (Mustersteuererklärung, Formular K, Seite 3)`,
    },
    {
      id: 'K4',
      title: `Vermögen im In- und Ausland am 31.12.${y}`,
      gloss: g(
        'Wealth on 31 December (form K, page 4)',
        'Fortune au 31 décembre (formulaire K, page 4)',
      ),
      pdfPage: 19,
      supported: true,
      sections: [
        section('beweglich', 'Bewegliches Privatvermögen', 'Movable wealth', 'Fortune mobilière'),
        section('liegenschaften', 'Private Liegenschaften', 'Private property', 'Immeubles privés'),
        section('geschaeft', 'Geschäftsvermögen', 'Business assets', 'Fortune commerciale'),
        section(
          'total',
          'Total der Vermögenswerte',
          'Total assets',
          'Total des éléments de fortune',
        ),
        section('schulden', 'Schulden', 'Debts', 'Dettes'),
        section('reinvermoegen', 'Reinvermögen', 'Net wealth', 'Fortune nette'),
        section(
          'steuerfrei',
          'Steuerfreie Beträge (Sozialabzüge)',
          'Tax-free amounts',
          'Montants exonérés',
        ),
        section('steuerbar', 'Steuerbares Gesamtvermögen', 'Taxable wealth', 'Fortune imposable'),
      ],
      source: `${GUIDE} p. 19 (Mustersteuererklärung, Formular K, Seite 4)`,
    },
  ];
}

const rubrics = (): FormRubric<ZgPageId>[] => [...page2(), ...page3(), ...page4()];

/** Shown with tax year 2026: its codes come from the 2025 form K. */
export const ZG_FORM_NOTE: Text = {
  en: 'The codes and German terms come from Zug’s 2025 form K, as the 2025 guide prints it (zg-2025-guide-wegleitung p. 17 to 19): the 2026 forms are not published yet, so check each line on the form you get in 2027.',
  fr: 'Les codes et les termes allemands viennent du formulaire K 2025 de Zoug, tel que l’imprime le guide 2025 (zg-2025-guide-wegleitung p. 17 à 19) : les formulaires 2026 ne sont pas encore publiés, vérifiez donc chaque ligne sur celui que vous recevrez en 2027.',
  de: 'Die Codes und Begriffe stammen aus dem Formular K 2025 von Zug, wie es die Wegleitung 2025 abdruckt (zg-2025-guide-wegleitung S. 17 bis 19): Die Formulare 2026 sind noch nicht veröffentlicht, prüfe also jede Zeile auf dem Formular, das du 2027 erhältst.',
};

export const FORM_ZG_2025: FormMap<ZgPageId> = {
  taxYear: 2025,
  formYear: 2025,
  provisional: false,
  pages: pages(2025),
  rubrics: rubrics(),
};

/** Tax year 2026: the 2025 form K, until the 2026 forms are published; flagged provisional. */
export const FORM_ZG_2026: FormMap<ZgPageId> = {
  taxYear: 2026,
  formYear: 2025,
  provisional: true,
  note: ZG_FORM_NOTE,
  pages: pages(2026),
  rubrics: rubrics(),
};

export function zugFormMap(taxYear: number): FormMap<ZgPageId> {
  if (taxYear === 2025) return FORM_ZG_2025;
  if (taxYear === 2026) return FORM_ZG_2026;
  throw new Error(`No Zug form map for ${taxYear}.`);
}
