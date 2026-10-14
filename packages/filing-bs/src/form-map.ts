// The Basel-Stadt return for individuals (Steuererklärung für natürliche Personen, Kantonale Steuern
// und direkte Bundessteuer) as printed, in the order the guide says to fill it in
// (bs-2025-guide-wegleitung p. 5: the auxiliary forms first, then pages 2, 3 and 4 of the main
// form): the securities list's totals (form W, page 4), the professional costs of each person (form
// B), the illness costs (form K), the donations and party payments (form Z), the childcare (form F),
// then the income page, the deductions page with the income calculation, and the wealth page. Every
// line with its code and its German label as printed; the gloss says what it is in plain words. The
// main form has one column for the income lines (100 to 299) and two from 369 down to 799, Kanton and
// Bund; forms B, K, Z, F and page 4 of form W have both too.
//
// Sources (docs/sources/bs/manifest.json):
// - bs-2025-form-hauptformular: the main form, p. 2 income, p. 3 deductions and the income
//   calculation, p. 4 wealth (p. 1 is the personal details, not mapped);
// - bs-2025-form-b-berufskosten: form B, p. 1 person 1, p. 2 person 2;
// - bs-2025-form-kzf-krankheit-zuwendung-betreuung: form K p. 1, forms Z and F p. 2;
// - bs-2025-form-w-wertschriftenverzeichnis: form W, p. 4 (the income and wealth calculation);
// - bs-2025-guide-wegleitung: the guide, which explains each line by its code.
//
// A line printed on an auxiliary form and carried to the main form has a key of its own on the
// auxiliary form ("B-519", "K-725", "W-10"), its printed code as `code`; on the main form its key is
// the code. Lines without a code of their own on the form (form Z's and F's totals) have a key only.
//
// Not mapped yet: the personal details (p. 1), the securities list itself (form W pages 1 to 3: its
// totals are), the per-child rows of form F (the total is), the debts list (form S: its total is
// 870), and what Taxpresso doesn't prepare (self-employment, property, capital payments, inheritances,
// lottery winnings, support of relatives): listed, marked unsupported.
import type {
  FormColumn,
  FormMap,
  FormPage,
  FormPart,
  FormPerson,
  FormRubric,
  Gloss,
} from '@taxpresso/filing-ge';

export const BS_PAGE_IDS = ['W', 'B1', 'B2', 'K', 'Z', 'F', 'H2', 'H3', 'H4'] as const;
export type BsPageId = (typeof BS_PAGE_IDS)[number];

const MAIN = 'bs-2025-form-hauptformular';
const FORM_B = 'bs-2025-form-b-berufskosten';
const FORM_KZF = 'bs-2025-form-kzf-krankheit-zuwendung-betreuung';
const FORM_W = 'bs-2025-form-w-wertschriftenverzeichnis';
const GUIDE = 'bs-2025-guide-wegleitung';

type Options = Partial<
  Pick<
    FormRubric<BsPageId>,
    'code' | 'person' | 'parts' | 'nature' | 'role' | 'format' | 'columns' | 'supported'
  >
> & { guide?: number };

/** French typography: a no-break space before a colon and a percent sign. */
const frTypo = (s: string) => s.replace(/ ?: /g, ' : ').replace(/ %/g, ' %');

const g = (en: string, fr: string, de?: string): Gloss => ({
  en,
  fr: frTypo(fr),
  ...(de ? { de } : {}),
});

/** A line maker for one section of one page, with that section's defaults. */
function on(page: BsPageId, doc: string, pdfPage: number, section: string, defaults: Options) {
  return (key: string, label: string, en: string, fr: string, options: Options = {}) => {
    const o = { ...defaults, ...options };
    const code = o.code ?? (/^\d{3}$/.test(key) ? key : undefined);
    const rubric: FormRubric<BsPageId> = {
      key,
      ...(code ? { code } : {}),
      page,
      section,
      person: o.person ?? 'household',
      label,
      gloss: g(en, fr),
      nature: o.nature ?? 'income',
      role: o.role ?? 'input',
      format: o.format ?? 'money',
      columns: o.columns ?? [],
      ...(o.parts ? { parts: o.parts } : {}),
      supported: o.supported ?? true,
      source: `${doc} p. ${pdfPage}${o.guide !== undefined ? `; ${GUIDE} p. ${o.guide}` : ''}`,
    };
    return rubric;
  };
}

const ONE: readonly FormColumn[] = ['amount'];
const BOTH: readonly FormColumn[] = ['icc', 'ifd'];
const KANTON: readonly FormColumn[] = ['icc'];
const BUND: readonly FormColumn[] = ['ifd'];
const WEALTH: readonly FormColumn[] = ['wealth'];
const A = { person: 'A' as FormPerson };
const B = { person: 'B' as FormPerson };
const PERSONS: readonly FormPart[] = ['A', 'B'];
const OUT = { supported: false };

// ---- Formular W, Seite 4: Berechnung Einkommen und Vermögen -------------------------------------

const wIncome = on('W', FORM_W, 4, 'einkommen', { columns: BOTH, guide: 24 });
const wWealth = on('W', FORM_W, 4, 'vermoegen', { nature: 'wealth', columns: WEALTH, guide: 40 });
const W = [
  wIncome(
    'W-1',
    'Total Bruttoertrag A + B',
    'Gross income of the accounts and securities (line 1)',
    'Rendement brut des avoirs et titres (ligne 1)',
    { code: '1', role: 'report' },
  ),
  wIncome(
    'W-3',
    'Abzüglich Lotterie- und andere Spielgewinne',
    'Lottery and other winnings (line 3)',
    'Gains de loterie et autres jeux (ligne 3)',
    { code: '3', ...OUT },
  ),
  wIncome(
    'W-6',
    'Abzüglich Vermögensverwaltungskosten',
    'Less the costs of keeping the accounts and securities (line 6)',
    'Moins les frais de gestion des avoirs et titres (ligne 6)',
    { code: '6', nature: 'deduction' },
  ),
  wIncome(
    'W-8',
    'Abzüglich 20% beim Kanton bzw. 30% beim Bund vom Bruttoertrag aus qualifizierten Beteiligungen im Privatvermögen',
    'Qualifying holdings (line 8)',
    'Participations qualifiées (ligne 8)',
    { code: '8', ...OUT },
  ),
  wIncome(
    'W-10',
    'Total Einkünfte aus Guthaben, Wertschriften und Lotterien',
    'Income from accounts and securities (line 10): carried to 369',
    'Rendement des avoirs et titres (ligne 10) : reporté au 369',
    { code: '10', role: 'total' },
  ),
  wWealth(
    'W-11',
    'Verkehrswert der Guthaben und Wertschriften',
    'Market value of the accounts and securities on 31 December (line 11)',
    'Valeur vénale des avoirs et titres au 31 décembre (ligne 11)',
    { code: '11', role: 'report' },
  ),
  wWealth(
    'W-14',
    'Ertragswert (Ziffer 4 × 345)',
    'Yield value: their gross income times the factor (line 14)',
    'Valeur de rendement : leur rendement brut multiplié par le facteur (ligne 14)',
    { code: '14', role: 'computed' },
  ),
  wWealth(
    'W-16',
    'Mittelwert der Guthaben und Wertschriften des Privatvermögens (Ziffer 15 : 2)',
    'The mean of the market value and the yield value (line 16): 800 takes the lower of 11 and 16',
    'La moyenne de la valeur vénale et de la valeur de rendement (ligne 16) : le 800 prend la plus basse des lignes 11 et 16',
    { code: '16', role: 'computed' },
  ),
];

// ---- Formular B: Berufskosten, person 1 and person 2 ---------------------------------------------

/** The lines of form B for one person; person 2's codes are person 1's plus 20. */
function berufskosten(page: 'B1' | 'B2') {
  const pdfPage = page === 'B1' ? 1 : 2;
  const who = page === 'B1' ? A : B;
  const n = page === 'B1' ? 1 : 2;
  const c = (p1: number) => String(page === 'B1' ? p1 : p1 + 20);
  const line = (section: string, guide: number) =>
    on(page, FORM_B, pdfPage, section, { ...who, nature: 'deduction', columns: BOTH, guide });
  const flat = line('pauschal', 30);
  const travel = line('fahrkosten', 30);
  const meals = line('verpflegung', 31);
  const rest = line('uebrige', 31);
  const side = line('nebenerwerb', 32);
  const total = line('total', 30);
  return [
    flat(
      c(500),
      'Pauschalabzug für Berufskosten, pauschal Kanton',
      `The canton’s flat amount for all professional costs, person ${n}`,
      `Forfait cantonal pour tous les frais professionnels, personne ${n}`,
      { columns: KANTON },
    ),
    travel(
      c(503),
      'Fahrkosten zwischen Wohn- und Arbeitsstätte, effektiv',
      `Travel between home and work, at most the limit of each tax, person ${n}`,
      `Trajets entre le domicile et le travail, au plus la limite de chaque impôt, personne ${n}`,
    ),
    meals(
      c(504),
      'Mehrkosten für auswärtige Verpflegung',
      `Meals away from home, person ${n}`,
      `Repas hors du domicile, personne ${n}`,
    ),
    meals(
      c(508),
      'Schicht- und Nachtarbeit, pauschal',
      `Meals on shift or night work, person ${n}`,
      `Repas en travail de nuit ou par équipes, personne ${n}`,
      OUT,
    ),
    rest(
      c(510),
      'Mehrkosten bei auswärtigem Wochenaufenthalt, effektiv',
      `Weekly stay away from home, person ${n}`,
      `Séjour hebdomadaire hors du domicile, personne ${n}`,
      OUT,
    ),
    rest(
      c(514),
      'Übrige für die Ausübung des Berufes erforderliche Kosten',
      `Other professional costs: the actual ones, or for the federal tax the flat 3 % of the net salary, person ${n}`,
      `Autres frais professionnels : les effectifs, ou pour l’impôt fédéral le forfait de 3 % du salaire net, personne ${n}`,
    ),
    side(
      c(516),
      'Auslagen bei Nebenerwerb, pauschal Bund',
      `Side job, the federal flat amount, person ${n}`,
      `Activité accessoire, forfait fédéral, personne ${n}`,
      { columns: BUND },
    ),
    total(
      `B-${c(519)}`,
      'Total der Berufskosten',
      `Total professional costs, person ${n}: carried to page 3, ${c(519)}`,
      `Total des frais professionnels, personne ${n} : reporté en page 3, ${c(519)}`,
      { code: c(519), role: 'total' },
    ),
  ];
}

// ---- Formular K: Krankheitskosten ------------------------------------------------------------------

const k = on('K', FORM_KZF, 1, 'berechnung', { nature: 'deduction', columns: BOTH, guide: 37 });
const K = [
  k(
    'K-709',
    'Nettoeinkommen I (Übertrag von Steuererklärung, Seite 3, Ziffer 709)',
    'Net income, carried from page 3 (709)',
    'Revenu net, reporté de la page 3 (709)',
    { code: '709', nature: 'income', role: 'report' },
  ),
  k(
    'K-710',
    'Behinderungsbedingte Kosten (Spalte 2)',
    'Costs due to a disability',
    'Frais liés à un handicap',
    { code: '710', ...OUT },
  ),
  k(
    'K-720',
    'Krankheits- und unfallbedingte Kosten (Spalte 1)',
    'Illness and accident costs left to pay (column 1)',
    'Frais de maladie et d’accident restés à votre charge (colonne 1)',
    { code: '720' },
  ),
  k(
    'K-722',
    'Abzüglich Selbstbehalt von 5% des Nettoeinkommens II (Ziffer 719), höchstens die Summe der Ziffern 720',
    'Less the share you bear yourself, 5 % of the net income',
    'Moins la part à votre charge, 5 % du revenu net',
    { code: '722', role: 'computed' },
  ),
  k(
    'K-725',
    'Total der abziehbaren Krankheits-, Unfall- und Behinderungskosten',
    'Deductible illness and accident costs: carried to page 3, 725',
    'Frais de maladie et d’accident déductibles : reportés en page 3, 725',
    { code: '725', role: 'total' },
  ),
];

// ---- Formular Z: Zuwendungen; Formular F: Kinderbetreuungskosten -----------------------------------

const z = on('Z', FORM_KZF, 2, 'parteien', { nature: 'deduction', columns: BOTH, guide: 36 });
const zGifts = on('Z', FORM_KZF, 2, 'zuwendungen', { nature: 'deduction', guide: 38 });
const Z = [
  z(
    'Z-parteien',
    'Total Beiträge',
    'Payments to political parties, at most the limit of each tax: carried to page 3, 680',
    'Versements aux partis politiques, au plus la limite de chaque impôt : reportés en page 3, 680',
    { role: 'total' },
  ),
  zGifts(
    'Z-zuwendungen',
    'Zuwendungen',
    'Donations to tax-exempt institutions in Switzerland',
    'Dons à des institutions suisses exonérées',
    { columns: ONE },
  ),
  zGifts(
    'Z-732',
    'Total der abziehbaren Zuwendungen',
    'Deductible donations, at most 20 % of the net income (709): carried to page 3, 732',
    'Dons déductibles, au plus 20 % du revenu net (709) : reportés en page 3, 732',
    { columns: BOTH, role: 'total' },
  ),
];

const f = on('F', FORM_KZF, 2, 'betreuung', { nature: 'deduction', columns: BOTH, guide: 36 });
const F = [
  f(
    'F-670',
    'Total der abziehbaren Kinderbetreuungskosten',
    'Deductible childcare, each child under 14 up to the limit of each tax: carried to page 3, 670',
    'Frais de garde déductibles, chaque enfant de moins de 14 ans jusqu’à la limite de chaque impôt : reportés en page 3, 670',
    { role: 'total' },
  ),
];

// ---- Hauptformular Seite 2: Einkünfte --------------------------------------------------------------

const s2 = (section: string, guide: number, more: Options = {}) =>
  on('H2', MAIN, 2, section, { columns: ONE, guide, ...more });
const job = s2('unselbststaendig', 19);
const self = s2('selbststaendig', 20, OUT);
const insurance = s2('versicherungen', 22);
const other = s2('weitere', 23);
const assets = s2('vermoegen', 24, { columns: BOTH });
const H2 = [
  job(
    '100',
    'Haupterwerb Person 1',
    'Main job, net salary (salary certificate, box 11), person 1',
    'Activité principale, salaire net (certificat de salaire, case 11), personne 1',
    A,
  ),
  job(
    '105',
    'Haupterwerb Person 2',
    'Main job, net salary (salary certificate, box 11), person 2',
    'Activité principale, salaire net (certificat de salaire, case 11), personne 2',
    B,
  ),
  job(
    '110',
    'Nebenerwerb Person 1',
    'Side job, net salary, person 1',
    'Activité accessoire, salaire net, personne 1',
    { ...A, guide: 20 },
  ),
  job(
    '115',
    'Nebenerwerb Person 2',
    'Side job, net salary, person 2',
    'Activité accessoire, salaire net, personne 2',
    { ...B, guide: 20 },
  ),
  job(
    '120',
    'Andere Entschädigungen Person 1',
    'Other payments for work, person 1',
    'Autres indemnités, personne 1',
    { ...A, ...OUT, guide: 20 },
  ),
  job(
    '125',
    'Andere Entschädigungen Person 2',
    'Other payments for work, person 2',
    'Autres indemnités, personne 2',
    { ...B, ...OUT, guide: 20 },
  ),
  self(
    '150',
    'Haupterwerb Person 1',
    'Self-employment, person 1',
    'Activité indépendante, personne 1',
    A,
  ),
  self(
    '155',
    'Haupterwerb Person 2',
    'Self-employment, person 2',
    'Activité indépendante, personne 2',
    B,
  ),
  self(
    '160',
    'Nebenerwerb Person 1',
    'Self-employed side activity, person 1',
    'Activité indépendante accessoire, personne 1',
    A,
  ),
  self(
    '165',
    'Nebenerwerb Person 2',
    'Self-employed side activity, person 2',
    'Activité indépendante accessoire, personne 2',
    B,
  ),
  self(
    '170',
    'Personengesellschaft Person 1',
    'Partnership, person 1',
    'Société de personnes, personne 1',
    A,
  ),
  self(
    '175',
    'Personengesellschaft Person 2',
    'Partnership, person 2',
    'Société de personnes, personne 2',
    B,
  ),
  insurance(
    '200',
    'AHV-/IV-Renten Person 1',
    'AHV/IV pension, person 1',
    'Rente AVS/AI, personne 1',
    A,
  ),
  insurance(
    '205',
    'AHV-/IV-Renten Person 2',
    'AHV/IV pension, person 2',
    'Rente AVS/AI, personne 2',
    B,
  ),
  insurance(
    '220',
    'Pensionen / Renten Person 1',
    'Pension fund pension, person 1',
    'Rente de la prévoyance professionnelle, personne 1',
    A,
  ),
  insurance(
    '225',
    'Pensionen / Renten Person 2',
    'Pension fund pension, person 2',
    'Rente de la prévoyance professionnelle, personne 2',
    B,
  ),
  insurance('230', 'Leibrenten Person 1', 'Life annuity, person 1', 'Rente viagère, personne 1', {
    ...A,
    ...OUT,
  }),
  insurance('235', 'Leibrenten Person 2', 'Life annuity, person 2', 'Rente viagère, personne 2', {
    ...B,
    ...OUT,
  }),
  insurance(
    '240',
    'Übrige Renten Person 1',
    'Other pension, person 1',
    'Autre rente, personne 1',
    A,
  ),
  insurance(
    '245',
    'Übrige Renten Person 2',
    'Other pension, person 2',
    'Autre rente, personne 2',
    B,
  ),
  insurance(
    '260',
    'Erwerbsausfallentschädigungen, Taggelder von Versicherungen (KV, UV, IV, MV, ALV und EO) Person 1',
    'Daily allowances and unemployment benefits not paid through the employer, person 1',
    'Indemnités journalières et de chômage hors employeur, personne 1',
    { ...A, guide: 23 },
  ),
  insurance(
    '265',
    'Erwerbsausfallentschädigungen, Taggelder von Versicherungen (KV, UV, IV, MV, ALV und EO) Person 2',
    'Daily allowances and unemployment benefits not paid through the employer, person 2',
    'Indemnités journalières et de chômage hors employeur, personne 2',
    { ...B, guide: 23 },
  ),
  other(
    '270',
    'Unterhaltsbeiträge von geschiedenen / getrennt lebenden Ehegatten',
    'Alimony received from a former spouse',
    'Pension alimentaire reçue de l’ex-conjoint',
    { parts: PERSONS },
  ),
  other(
    '271',
    'Unterhaltsbeiträge für minderjährige Kinder',
    'Child support received for minor children',
    'Contributions d’entretien reçues pour les enfants mineurs',
  ),
  other(
    '280',
    'Übrige Einkünfte',
    'Other income (Person 1: 280, Person 2: 285)',
    'Autres revenus (personne 1 : 280, personne 2 : 285)',
    { parts: PERSONS },
  ),
  other(
    '290',
    'Kapitalabfindungen für wiederkehrende Leistungen',
    'Lump sums for recurring payments',
    'Prestations en capital pour des prestations périodiques',
    OUT,
  ),
  other('299', 'Zwischentotal', 'Subtotal of the income lines', 'Sous-total des revenus', {
    role: 'total',
  }),
  assets(
    '369',
    'Guthaben, Wertschriften und Lotterien',
    'Income from accounts and securities, carried from form W (line 10)',
    'Rendement des avoirs et titres, reporté du formulaire W (ligne 10)',
    { role: 'report' },
  ),
  assets('479', 'Liegenschaften', 'Income from property', 'Revenu des immeubles', {
    ...OUT,
    guide: 28,
  }),
  assets(
    '489',
    'Unverteilte Erbschaften',
    'Share of an undivided inheritance',
    'Part d’une succession non partagée',
    OUT,
  ),
  assets(
    '499',
    'Total der Einkünfte',
    'Total income: carried to page 3, 700',
    'Total des revenus : reporté en page 3, 700',
    { role: 'total' },
  ),
];

// ---- Hauptformular Seite 3: Abzüge und Einkommensberechnung -----------------------------------------

const s3 = (section: string, guide: number, more: Options = {}) =>
  on('H3', MAIN, 3, section, { nature: 'deduction', columns: BOTH, guide, ...more });
const costs = s3('berufskosten', 30);
const pension = s3('vorsorge', 33);
const further = s3('weitere', 35);
const calc = s3('berechnung', 37, { nature: 'income', role: 'total' });
const social = s3('sozialabzuege', 38, { role: 'computed' });
const H3 = [
  costs(
    '519',
    'Berufskosten bei unselbstständiger Erwerbstätigkeit Person 1',
    'Professional costs, person 1, carried from form B',
    'Frais professionnels, personne 1, reportés du formulaire B',
    { ...A, role: 'report' },
  ),
  costs(
    '539',
    'Berufskosten bei unselbstständiger Erwerbstätigkeit Person 2',
    'Professional costs, person 2, carried from form B',
    'Frais professionnels, personne 2, reportés du formulaire B',
    { ...B, role: 'report' },
  ),
  costs(
    '550',
    'Schuldzinsen',
    'Private debt interest, at most the income from wealth plus a fixed amount',
    'Intérêts de dettes privées, au plus le rendement de la fortune plus un montant fixe',
    { guide: 32 },
  ),
  costs(
    '560',
    'Unterhaltsbeiträge an geschiedene / getrennt lebende Ehegatten / P1 / P2',
    'Alimony paid to a former spouse',
    'Pension alimentaire versée à l’ex-conjoint',
    { guide: 32 },
  ),
  costs(
    '561',
    'Unterhaltsbeiträge an minderjährige Kinder',
    'Child support paid for minor children',
    'Contributions d’entretien versées pour les enfants mineurs',
    { guide: 32 },
  ),
  costs(
    '570',
    'Rentenzahlungen und dauernde Lasten',
    'Annuities and permanent charges paid',
    'Rentes et charges durables versées',
    { ...OUT, guide: 32 },
  ),
  pension(
    '600',
    'Staatliche Vorsorge (AHV/IV/EO)',
    'AHV/IV/EO contributions of the self-employed',
    'Cotisations AVS/AI/APG des indépendants',
    OUT,
  ),
  pension(
    '610',
    'Berufliche Vorsorge (Pensionskasse) Person 1',
    'Pension fund buy-ins paid directly, person 1',
    'Rachats de prévoyance payés directement, personne 1',
    A,
  ),
  pension(
    '615',
    'Berufliche Vorsorge (Pensionskasse) Person 2',
    'Pension fund buy-ins paid directly, person 2',
    'Rachats de prévoyance payés directement, personne 2',
    B,
  ),
  pension(
    '620',
    'Gebundene Selbstvorsorge (Säule 3a) Person 1',
    'Pillar 3a, person 1',
    'Pilier 3a, personne 1',
    A,
  ),
  pension(
    '625',
    'Gebundene Selbstvorsorge (Säule 3a) Person 2',
    'Pillar 3a, person 2',
    'Pilier 3a, personne 2',
    B,
  ),
  pension(
    '630',
    'Abzug für Versicherungen Ehegatten',
    'Insurance premiums and savings interest, spouses: the canton’s flat amount, and for the federal tax what was paid up to a limit',
    'Primes d’assurance et intérêts d’épargne, époux : le forfait cantonal, et pour l’impôt fédéral ce qui a été payé jusqu’à une limite',
    { guide: 35 },
  ),
  pension(
    '631',
    'Abzug für Versicherungen Alle übrigen Personen',
    'Insurance premiums and savings interest, everyone else: the canton’s flat amount, and for the federal tax what was paid up to a limit',
    'Primes d’assurance et intérêts d’épargne, autres personnes : le forfait cantonal, et pour l’impôt fédéral ce qui a été payé jusqu’à une limite',
    { guide: 35 },
  ),
  pension(
    '632',
    'Zuschlag für Kinder und unterstützte Personen',
    'Federal tax only: the supplement of the insurance deduction for children',
    'Impôt fédéral seulement : le supplément de la déduction pour assurances pour les enfants',
    { columns: BUND, guide: 35 },
  ),
  further(
    '640',
    'Grundstückgewinnsteuerpflichtiger Gewinnanteil am Geschäftsvermögen',
    'Business property gains',
    'Gains immobiliers commerciaux',
    OUT,
  ),
  further(
    '650',
    'Verrechenbare Geschäftsverluste der Vorjahre',
    'Business losses of earlier years',
    'Pertes commerciales des années précédentes',
    OUT,
  ),
  further(
    '652',
    'Selbstgetragene Aus- und Weiterbildungskosten Person 1',
    'Professional training you paid, person 1',
    'Formation continue payée par vous, personne 1',
    A,
  ),
  further(
    '657',
    'Selbstgetragene Aus- und Weiterbildungskosten Person 2',
    'Professional training you paid, person 2',
    'Formation continue payée par vous, personne 2',
    B,
  ),
  further(
    '660',
    'Abzug bei Erwerbstätigkeit beider Ehegatten',
    'Both spouses work',
    'Activité lucrative des deux époux',
    { role: 'computed' },
  ),
  further(
    '670',
    'Abzug für fremdbetreute Kinder',
    'Childcare, carried from form F',
    'Frais de garde, reportés du formulaire F',
    { role: 'report', guide: 36 },
  ),
  further(
    '680',
    'Beiträge an politische Parteien',
    'Payments to political parties, carried from form Z',
    'Versements aux partis politiques, reportés du formulaire Z',
    { role: 'report', guide: 36 },
  ),
  further('699', 'Total der Abzüge', 'Total deductions', 'Total des déductions', {
    role: 'total',
  }),
  calc(
    '700',
    'Total der Einkünfte',
    'Total income, carried from 499',
    'Total des revenus, reporté du 499',
    {
      role: 'report',
    },
  ),
  calc(
    '701',
    'Total der Abzüge',
    'Total deductions, carried from 699',
    'Total des déductions, reporté du 699',
    {
      nature: 'deduction',
      role: 'report',
    },
  ),
  calc('709', 'Nettoeinkommen', 'Net income', 'Revenu net'),
  calc(
    '725',
    'Krankheits-, Unfall- und Behinderungskosten',
    'Illness and accident costs, carried from form K',
    'Frais de maladie et d’accident, reportés du formulaire K',
    { nature: 'deduction', role: 'report' },
  ),
  calc('732', 'Zuwendungen', 'Donations, carried from form Z', 'Dons, reportés du formulaire Z', {
    nature: 'deduction',
    role: 'report',
    guide: 38,
  }),
  calc(
    '739',
    'Reineinkommen',
    'Income after illness costs and donations',
    'Revenu après frais de maladie et dons',
  ),
  social('750', 'Abzug für Kinder', 'Child deduction', 'Déduction pour enfants'),
  social(
    '755',
    'Abzug für unterstützte Personen',
    'Deduction for people you support',
    'Déduction pour personnes à charge',
    OUT,
  ),
  social(
    '757',
    'Abzug für unterstützten Konkubinatspartner mit Kindern',
    'Deduction for a cohabiting partner you support (cantonal tax)',
    'Déduction pour le concubin à charge (impôt cantonal)',
    { columns: KANTON, ...OUT, guide: 39 },
  ),
  social('760', 'Abzug für Ehegatten', 'Deduction for spouses', 'Déduction pour époux', {
    guide: 39,
  }),
  social(
    '765',
    'Abzug für alleinerziehende Personen (nicht für Konkubinatspaare)',
    'Deduction for single parents (cantonal tax)',
    'Déduction pour familles monoparentales (impôt cantonal)',
    { columns: KANTON, guide: 39 },
  ),
  social(
    '767',
    'Abzug für alle übrigen Personen',
    'Deduction for everyone else (cantonal tax)',
    'Déduction pour les autres personnes (impôt cantonal)',
    { columns: KANTON, guide: 39 },
  ),
  social(
    '770',
    'Abzug für alleinstehende Rentner/innen (zusätzlich zu Ziffer 767)',
    'Deduction for single retirees, on top of 767 (cantonal tax)',
    'Déduction pour retraités seuls, en plus du 767 (impôt cantonal)',
    { columns: KANTON, guide: 39 },
  ),
  calc(
    '799',
    'Steuerbares Einkommen (bzw. satzbestimmendes Einkommen)',
    'Taxable income',
    'Revenu imposable',
    { guide: 39 },
  ),
];

// ---- Hauptformular Seite 4: Vermögen ---------------------------------------------------------------

const s4 = (section: string, more: Options = {}) =>
  on('H4', MAIN, 4, section, { nature: 'wealth', columns: WEALTH, guide: 40, ...more });
const priv = s4('privat');
const business = s4('geschaeft', OUT);
const debts = s4('schulden', { guide: 42 });
const free = s4('steuerfrei', { role: 'computed', guide: 43 });
const totals = s4('total', { role: 'total' });
const H4 = [
  priv(
    '800',
    'Guthaben und Wertschriften',
    'Accounts and securities, carried from form W (the lower of lines 11 and 16)',
    'Avoirs et titres, reportés du formulaire W (la plus basse des lignes 11 et 16)',
    { role: 'report' },
  ),
  priv(
    '810',
    'Zinslose Forderungen',
    'Interest-free loans you made',
    'Créances sans intérêts',
    OUT,
  ),
  priv(
    '815',
    'Lebensversicherungen (Steuerwerte gemäss Bescheinigung der Versicherungsgesellschaft)',
    'Life insurance, surrender value (insurer’s statement)',
    'Assurances sur la vie, valeur de rachat (attestation de l’assureur)',
    { guide: 41 },
  ),
  priv('821', 'Liegenschaften', 'Property', 'Immeubles', { ...OUT, guide: 41 }),
  priv(
    '830',
    'Anteile an unverteilten Erbschaften',
    'Shares of undivided inheritances',
    'Parts de successions non partagées',
    OUT,
  ),
  priv(
    '835',
    'Bargeld, Edelmetalle und übrige Vermögenswerte',
    'Cash, precious metals and other assets',
    'Numéraire, métaux précieux et autres biens',
    { guide: 41 },
  ),
  business('840', 'Aktiven gemäss Bilanz', 'Business assets', 'Actifs commerciaux'),
  business(
    '860',
    'Anteile an Personengesellschaften',
    'Shares of partnerships',
    'Parts de sociétés de personnes',
  ),
  totals('869', 'Total der Vermögenswerte', 'Total assets', 'Total de la fortune'),
  debts(
    '870',
    'Privatschulden',
    'Private debts on 31 December (form S)',
    'Dettes privées au 31 décembre (formulaire S)',
  ),
  debts('872', 'Geschäftsschulden', 'Business debts', 'Dettes commerciales', OUT),
  totals('889', 'Reinvermögen', 'Net wealth', 'Fortune nette'),
  free(
    '890',
    'Freibetrag für Ehegatten / P1+P2 und für alleinerziehende Personen (nicht für Konkubinatspaare)',
    'Wealth allowance for spouses and single parents',
    'Montant exonéré pour époux et familles monoparentales',
  ),
  free(
    '891',
    'Freibetrag für alle übrigen steuerpflichtigen Personen',
    'Wealth allowance for everyone else',
    'Montant exonéré pour les autres personnes',
  ),
  free(
    '892',
    'Freibetrag für minderjährige Kinder',
    'Wealth allowance for minor children',
    'Montant exonéré pour enfants mineurs',
  ),
  totals(
    '899',
    'Steuerbares Vermögen (bzw. satzbestimmendes Vermögen)',
    'Taxable wealth',
    'Fortune imposable',
    { guide: 43 },
  ),
];

// ---- Pages -----------------------------------------------------------------------------------------

const section = (id: string, title: string, en: string, fr: string) => ({
  id,
  title,
  gloss: g(en, fr),
});

function pages(taxYear: number): FormPage<BsPageId>[] {
  const year = taxYear;
  const bSections = [
    section(
      'pauschal',
      'Pauschalabzug für Berufskosten',
      'The canton’s flat amount',
      'Forfait cantonal',
    ),
    section(
      'fahrkosten',
      'Fahrkosten zwischen Wohn- und Arbeitsstätte',
      'Travel between home and work',
      'Trajets entre le domicile et le travail',
    ),
    section(
      'verpflegung',
      'Mehrkosten für auswärtige Verpflegung',
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
    section('total', 'Total der Berufskosten', 'Total', 'Total'),
  ];
  return [
    {
      id: 'W',
      title: `Wertschriftenverzeichnis ${year}, Seite 4`,
      gloss: g(
        'Securities list (form W): the income and wealth calculation',
        'État des titres (formulaire W) : calcul du revenu et de la fortune',
      ),
      pdfPage: 4,
      supported: true,
      sections: [
        section('einkommen', 'Berechnung Einkommen', 'Income calculation', 'Calcul du revenu'),
        section('vermoegen', 'Berechnung Vermögen', 'Wealth calculation', 'Calcul de la fortune'),
      ],
      source: `${FORM_W} p. 4`,
    },
    {
      id: 'B1',
      title: `Berufskosten ${year}, Person 1`,
      gloss: g(
        'Professional costs (form B), person 1',
        'Frais professionnels (formulaire B), personne 1',
      ),
      person: 'A',
      pdfPage: 1,
      supported: true,
      sections: bSections,
      source: `${FORM_B} p. 1`,
    },
    {
      id: 'B2',
      title: `Berufskosten ${year}, Person 2`,
      gloss: g(
        'Professional costs (form B), person 2',
        'Frais professionnels (formulaire B), personne 2',
      ),
      person: 'B',
      pdfPage: 2,
      supported: true,
      sections: bSections,
      source: `${FORM_B} p. 2`,
    },
    {
      id: 'K',
      title: `Krankheitskosten ${year}`,
      gloss: g(
        'Illness and accident costs (form K)',
        'Frais de maladie et d’accident (formulaire K)',
      ),
      pdfPage: 1,
      supported: true,
      sections: [section('berechnung', 'Berechnung', 'Calculation', 'Calcul')],
      source: `${FORM_KZF} p. 1`,
    },
    {
      id: 'Z',
      title: `Zuwendungen ${year}`,
      gloss: g(
        'Donations and payments to political parties (form Z)',
        'Dons et versements aux partis politiques (formulaire Z)',
      ),
      pdfPage: 2,
      supported: true,
      sections: [
        section(
          'parteien',
          'Beiträge an politische Parteien',
          'Payments to political parties',
          'Versements aux partis politiques',
        ),
        section(
          'zuwendungen',
          'Zuwendungen an gemeinnützige Institutionen',
          'Donations to charities',
          'Dons aux œuvres d’utilité publique',
        ),
      ],
      source: `${FORM_KZF} p. 2`,
    },
    {
      id: 'F',
      title: `Kinderbetreuungskosten ${year}`,
      gloss: g('Childcare (form F)', 'Frais de garde (formulaire F)'),
      pdfPage: 2,
      supported: true,
      sections: [section('betreuung', 'Kinderbetreuungskosten', 'Childcare', 'Frais de garde')],
      source: `${FORM_KZF} p. 2`,
    },
    {
      id: 'H2',
      title: `Einkünfte ${year}`,
      gloss: g('Income (main form, page 2)', 'Revenus (formulaire principal, page 2)'),
      pdfPage: 2,
      supported: true,
      sections: [
        section(
          'unselbststaendig',
          'Einkünfte aus unselbstständiger Erwerbstätigkeit',
          'Salaried work',
          'Activité salariée',
        ),
        section(
          'selbststaendig',
          'Einkünfte aus selbstständiger Erwerbstätigkeit',
          'Self-employment',
          'Activité indépendante',
        ),
        section(
          'versicherungen',
          'Einkünfte aus Sozial- und anderen Versicherungen',
          'Pensions and insurance benefits',
          'Rentes et prestations d’assurances',
        ),
        section('weitere', 'Weitere Einkünfte', 'Other income', 'Autres revenus'),
        section(
          'vermoegen',
          'Einkünfte aus Vermögen',
          'Income from wealth',
          'Revenu de la fortune',
        ),
      ],
      source: `${MAIN} p. 2`,
    },
    {
      id: 'H3',
      title: `Abzüge ${year}`,
      gloss: g(
        'Deductions and income calculation (main form, page 3)',
        'Déductions et calcul du revenu (formulaire principal, page 3)',
      ),
      pdfPage: 3,
      supported: true,
      sections: [
        section(
          'berufskosten',
          'Berufskosten / Schuldzinsen / Unterhaltsbeiträge / Rentenleistungen',
          'Professional costs, debt interest, alimony',
          'Frais professionnels, intérêts de dettes, pensions',
        ),
        section(
          'vorsorge',
          'Beiträge an Vorsorgeeinrichtungen und Versicherungen',
          'Pension contributions and insurance',
          'Prévoyance et assurances',
        ),
        section('weitere', 'Weitere Abzüge', 'Other deductions', 'Autres déductions'),
        section('berechnung', 'Einkommensberechnung', 'Income calculation', 'Calcul du revenu'),
        section('sozialabzuege', 'Sozialabzüge', 'Social deductions', 'Déductions sociales'),
      ],
      source: `${MAIN} p. 3`,
    },
    {
      id: 'H4',
      title: `Vermögen im In- und Ausland, Steuerwert am 31.12.${year}`,
      gloss: g(
        'Wealth on 31 December (main form, page 4)',
        'Fortune au 31 décembre (formulaire principal, page 4)',
      ),
      pdfPage: 4,
      supported: true,
      sections: [
        section('privat', 'Privatvermögen', 'Private wealth', 'Fortune privée'),
        section('geschaeft', 'Geschäftsvermögen', 'Business wealth', 'Fortune commerciale'),
        section('total', 'Vermögensberechnung', 'Wealth calculation', 'Calcul de la fortune'),
        section('schulden', 'Schulden', 'Debts', 'Dettes'),
        section('steuerfrei', 'Steuerfreie Beträge', 'Wealth allowances', 'Montants exonérés'),
      ],
      source: `${MAIN} p. 4`,
    },
  ];
}

function rubrics(): FormRubric<BsPageId>[] {
  return [
    ...W,
    ...berufskosten('B1'),
    ...berufskosten('B2'),
    ...K,
    ...Z,
    ...F,
    ...H2,
    ...H3,
    ...H4,
  ];
}

export const FORM_BS_2025: FormMap<BsPageId> = {
  taxYear: 2025,
  formYear: 2025,
  provisional: false,
  pages: pages(2025),
  rubrics: rubrics(),
};

/** Shown with the 2026 values: the codes and terms are the 2025 forms'. */
export const BS_FORM_NOTE = {
  en: 'Codes and labels from the 2025 Basel-Stadt return; the 2026 forms are not published yet, so check each code on yours.',
  fr: 'Codes et libellés de la déclaration bâloise 2025 ; les formulaires 2026 ne sont pas encore publiés, vérifiez donc chaque code sur les vôtres.',
  de: 'Ziffern und Bezeichnungen aus der Basler Steuererklärung 2025; die Formulare 2026 sind noch nicht veröffentlicht, prüfe also jede Ziffer auf deinen.',
};

/** Tax year 2026: the forms for the whole year are not published yet, so they are 2025's, provisional. */
export const FORM_BS_2026: FormMap<BsPageId> = {
  taxYear: 2026,
  formYear: 2025,
  provisional: true,
  note: BS_FORM_NOTE,
  pages: pages(2026),
  rubrics: rubrics(),
};

export function baselFormMap(taxYear: number): FormMap<BsPageId> {
  if (taxYear === 2025) return FORM_BS_2025;
  if (taxYear === 2026) return FORM_BS_2026;
  throw new Error(`No Basel-Stadt form map for ${taxYear}.`);
}
