// The Fribourg return (déclaration d'impôt des personnes physiques) as its guide explains it, code
// by code: the codes 1.110 to 7.910 in the order of the return, grouped as the guide's chapters V to
// IX are (fr-2025-guide-instructions-generales p. 8 to 39: "Les codes indiqués ci-après se réfèrent
// aux codes de la déclaration d'impôt", p. 8), each in the return's "Revenu" column and, where the
// return takes wealth too (3.210 to 3.530, 4.210, 6.910, 7.110, 7.910), its "Fortune" column; the
// codes of a person (1.xxx to 4.xxx) for person 1 and person 2 (the guide: the income of person 2 is
// added to person 1's, p. 8; "une seule colonne du code 2.510 peut être utilisée", p. 14). Then the
// rubrics of the return's last page (A Assurances, B Frais médicaux, C Versements bénévoles, D
// Pension alimentaire, E Prestations en capital) and the six annexes (01 État des titres, 02 État des
// dettes, 03 Revenu d'activité et frais d'acquisition, 04 État des immeubles, 05 Revenus d'activité
// indépendante, 06 activité agricole). The annexes whose totals carry to the return (01 to 3.210, 02
// to 4.210) come first, as FriTax and the guide fill them before the codes they carry.
//
// Source (docs/sources/fr/manifest.json): the 2025 guide only. The return itself is not in the
// sources library (docs/sources/fr/NOTES.md, Gaps: no PDF of the 2025 return, nor of annexes 01 to
// 05): the labels are the guide's headings for each code, and the layout (columns, the order of the
// last page and of the annexes) is the guide's, not the printed form's. Both years are flagged
// provisional: 2025 for that reason, 2026 also because the 2026 guide is not published. Every value
// is typed in FriTax (the canton's program, installed on the computer) or on the paper return.
//
// Not mapped as values: annex 03's details (FriTax works the codes 2.110 to 2.140 out from them; the
// codes themselves are mapped), the last page's rubrics (Taxpresso fills none of their details),
// the federal tax (the return has no federal part: the tax office derives it, guide p. 47).
import type {
  FormColumn,
  FormMap,
  FormPage,
  FormPart,
  FormRubric,
  Gloss,
} from '@taxpresso/filing-ge';
import type { Text } from '@taxpresso/rules-ch';

export const FR_PAGE_IDS = [
  'A01',
  'A02',
  'V',
  'VI',
  'VII',
  'VIII',
  'IX',
  'DP',
  'A03',
  'A04',
  'A05',
  'A06',
] as const;
export type FrPageId = (typeof FR_PAGE_IDS)[number];

type Options = Partial<
  Pick<FormRubric<FrPageId>, 'code' | 'nature' | 'role' | 'format' | 'columns' | 'supported'>
> & { parts?: readonly FormPart[]; page?: string };

/** French typography: a no-break space before a colon and a percent sign. */
const frTypo = (s: string) => s.replace(/ ?: /g, ' : ').replace(/ %/g, ' %');

const g = (en: string, fr: string, de?: string): Gloss => ({
  en,
  fr: frTypo(fr),
  ...(de ? { de } : {}),
});

const GUIDE = 'fr-2025-guide-instructions-generales';

const INCOME: readonly FormColumn[] = ['icc'];
const WEALTH: readonly FormColumn[] = ['wealth'];
const BOTH: readonly FormColumn[] = ['icc', 'wealth'];
/** The codes of a person: an amount for person 1 and one for person 2. */
const PEOPLE = { parts: ['A', 'B'] as const satisfies readonly FormPart[] };
const OUT = { supported: false };
const TOTAL = { role: 'total' as const };
const REPORT = { role: 'report' as const };
const COMPUTED = { role: 'computed' as const };

/** Where each page is explained in the guide (the PDF's page; the guide prints one less). */
const EXPLAINED: Record<FrPageId, string> = {
  A01: `${GUIDE} p. 15 to 19 (codes 3.210 and 3.220, annexe 01)`,
  A02: `${GUIDE} p. 26 and 27 (code 4.210, annexe 02)`,
  V: `${GUIDE} p. 8 to 10 (V. Revenu de l’activité)`,
  VI: `${GUIDE} p. 11 to 14 (VI. Frais d’acquisition du revenu)`,
  VII: `${GUIDE} p. 14 to 23 (VII. Autres revenus et état de la fortune)`,
  VIII: `${GUIDE} p. 24 to 33 (VIII. Déductions sur le revenu et la fortune)`,
  IX: `${GUIDE} p. 33 to 39 (IX. Revenu net)`,
  DP: `${GUIDE} p. 15, 24, 31, 33, 34 and 40 (la dernière page de la déclaration)`,
  A03: `${GUIDE} p. 9 to 13 (annexe 03)`,
  A04: `${GUIDE} p. 19 (annexe 04)`,
  A05: `${GUIDE} p. 9 and 23 (annexe 05)`,
  A06: `${GUIDE} p. 10 (annexe 06)`,
};

/** A line maker for one section of one page, with that section's defaults. */
function on(page: FrPageId, section: string, defaults: Options) {
  return (key: string, label: string, en: string, fr: string, options: Options = {}) => {
    const o = { ...defaults, ...options };
    const rubric: FormRubric<FrPageId> = {
      key,
      code: o.code ?? key,
      page,
      section,
      person: 'household',
      label,
      gloss: g(en, fr),
      nature: o.nature ?? 'deduction',
      role: o.role ?? 'input',
      format: o.format ?? 'money',
      columns: o.columns ?? INCOME,
      ...(o.parts ? { parts: o.parts } : {}),
      supported: o.supported ?? true,
      source: `${GUIDE} p. ${o.page ?? '?'}${/^\d\.\d{3}$/.test(o.code ?? key) ? ` (code ${o.code ?? key})` : ''}`,
    };
    return rubric;
  };
}

// ---- Annexe 01: État des titres; annexe 02: État des dettes ---------------------------------------

function annexes(): FormRubric<FrPageId>[] {
  const titres = on('A01', 'totaux', { nature: 'income', ...TOTAL, page: '15' });
  const dettes = on('A02', 'totaux', { ...TOTAL, page: '26 and 27' });
  return [
    titres(
      'A01-R',
      'Total des rendements bruts (report au code 3.210)',
      'Gross income of the accounts and securities, total (to code 3.210)',
      'Rendement brut des titres et placements, total (au code 3.210)',
      { code: '01' },
    ),
    titres(
      'A01-F',
      'Total de la valeur imposable au 31 décembre (report au code 3.210)',
      'Value on 31 December of the accounts and securities, total (to code 3.210)',
      'Valeur au 31 décembre des titres et placements, total (au code 3.210)',
      { code: '01', nature: 'wealth', columns: WEALTH },
    ),
    dettes(
      'A02-I',
      'Total des intérêts passifs privés (report au code 4.210)',
      'Interest on private debts, total (to code 4.210)',
      'Intérêts des dettes privées, total (au code 4.210)',
      { code: '02' },
    ),
    dettes(
      'A02-D',
      'Total des dettes privées au 31 décembre (report au code 4.210)',
      'Private debts on 31 December, total (to code 4.210)',
      'Dettes privées au 31 décembre, total (au code 4.210)',
      { code: '02', nature: 'wealth', columns: WEALTH },
    ),
  ];
}

// ---- V. Revenu de l'activité ------------------------------------------------------------------------

function income(): FormRubric<FrPageId>[] {
  const job = on('V', 'salariee', { nature: 'income', ...PEOPLE });
  const self = on('V', 'independante', { nature: 'income', ...PEOPLE, ...OUT });
  const other = on('V', 'autres', { nature: 'income', ...PEOPLE });
  const lost = on('V', 'perte', { nature: 'income', ...PEOPLE, page: '10' });
  return [
    job(
      '1.110',
      'Activité salariée principale',
      'Main employment: the net salary (salary certificate, box 11)',
      'Activité salariée principale : le salaire net (certificat de salaire, chiffre 11)',
      { page: '8' },
    ),
    job(
      '1.120',
      'Activité salariée accessoire',
      'Side job: its net salary',
      'Activité accessoire : son salaire net',
      { page: '9' },
    ),
    job(
      '1.130',
      'Allocations non versées par l’employeur-euse (familiales, naissance, etc.)',
      'Allowances not paid by the employer (family, birth)',
      'Allocations non versées par l’employeur (familiales, de naissance)',
      { ...OUT, page: '9' },
    ),
    self(
      '1.210',
      'Activité indépendante principale',
      'Self-employment, main',
      'Activité indépendante principale',
      { page: '9' },
    ),
    self(
      '1.220',
      'Activité indépendante accessoire',
      'Self-employment, side',
      'Activité indépendante accessoire',
      { page: '10' },
    ),
    self('1.310', 'Activité agricole principale et/ou accessoire', 'Farming', 'Activité agricole', {
      page: '10',
    }),
    other(
      '1.410',
      'Administrateurs-trices de personnes morales',
      'Board member fees',
      'Tantièmes d’administrateur',
      { ...OUT, page: '10' },
    ),
    other(
      '1.420',
      'Sociétés en nom collectif ou en commandite',
      'A share in a general or limited partnership',
      'Part à une société en nom collectif ou en commandite',
      { ...OUT, page: '10' },
    ),
    lost(
      '1.510',
      'Indemnités pour perte de gain (codes 1.510 à 1.530)',
      'Unemployment, sickness, accident and loss-of-earnings allowances not on a salary certificate (the return splits them over 1.510 to 1.530)',
      'Indemnités de chômage, maladie, accident et perte de gain hors certificat de salaire (la déclaration les répartit sur 1.510 à 1.530)',
    ),
  ];
}

// ---- VI. Frais d'acquisition du revenu --------------------------------------------------------------

function costs(): FormRubric<FrPageId>[] {
  const c = on('VI', 'frais', { ...PEOPLE });
  return [
    c(
      '2.110',
      'Frais de transport',
      'Travel to work (annex 03 gives the details), at most the yearly limit',
      'Frais de déplacement (l’annexe 03 en donne le détail), au plus la limite annuelle',
      { page: '11 and 12' },
    ),
    c(
      '2.120',
      'Repas ou séjour hors du domicile / Travail par équipes ou de nuit à horaire continu',
      'Lunch away from home (or shift work)',
      'Repas hors du domicile (ou travail par équipes)',
      { page: '12 and 13' },
    ),
    c(
      '2.130',
      'Autres frais professionnels',
      'Other professional costs: the 3 % flat or the actual costs',
      'Autres frais professionnels : forfait de 3 % ou frais effectifs',
      { page: '13' },
    ),
    c(
      '2.140',
      'Frais pour activité accessoire salariée',
      'Side job costs: the 20 % flat',
      'Frais de l’activité accessoire : forfait de 20 %',
      { page: '13' },
    ),
    on('VI', 'conjoints', { page: '14' })(
      '2.510',
      'Déduction pour activité lucrative des deux conjoints',
      'Both spouses work (one column only)',
      'Les deux conjoints travaillent (une seule colonne)',
    ),
  ];
}

// ---- VII. Autres revenus et état de la fortune -------------------------------------------------------

function otherIncome(): FormRubric<FrPageId>[] {
  const pension = on('VII', 'rentes', { nature: 'income', ...PEOPLE, page: '14' });
  const capital = on('VII', 'capitaux', { nature: 'income', columns: BOTH });
  const property = on('VII', 'immeubles', { nature: 'income', columns: BOTH, ...OUT });
  const rest = on('VII', 'autres', { nature: 'income', page: '22' });
  const assets = on('VII', 'fortune', { nature: 'wealth', columns: WEALTH });
  return [
    pension('3.110', '1er pilier : rentes AVS et AI', 'AVS/AI pensions', 'Rentes AVS et AI'),
    pension(
      '3.120',
      '2e pilier : rentes provenant d’institutions de prévoyance professionnelle',
      'Pension fund pensions',
      'Rentes de la caisse de pension',
    ),
    pension(
      '3.130',
      '3e pilier a : rentes provenant de formes reconnues de la prévoyance individuelle liée',
      'Pillar 3a pensions',
      'Rentes du pilier 3a',
    ),
    pension(
      '3.140',
      '3e pilier b : autres rentes et pensions',
      'Other pensions (for a life annuity, its taxable share)',
      'Autres rentes (pour une rente viagère, sa part imposable)',
      { page: '14 and 15' },
    ),
    pension(
      '3.150',
      'Pension alimentaire obtenue par le/la contribuable et / ou pour les enfants mineurs',
      'Alimony and child support received (rubric D of the last page too)',
      'Pension alimentaire reçue (rubrique D de la dernière page aussi)',
      { page: '15' },
    ),
    capital(
      '3.210',
      'Titres et autres placements de capitaux',
      'Accounts and securities: their gross income and their value on 31 December, from annex 01',
      'Titres et placements : rendement brut et valeur au 31 décembre, de l’annexe 01',
      { ...REPORT, page: '15 to 19' },
    ),
    assets(
      '3.230',
      'Numéraire, billets de banque, or et autres métaux précieux',
      'Cash, gold and other precious metals',
      'Espèces, or et autres métaux précieux',
      { page: '19' },
    ),
    capital(
      '3.240',
      'Successions non partagées',
      'A share of an undivided estate',
      'Part à une succession non partagée',
      { ...OUT, page: '19' },
    ),
    capital(
      '3.250',
      'Titres privés non cotés',
      'Unlisted private securities (reduced wealth tax rate)',
      'Titres privés non cotés (taux réduit de l’impôt sur la fortune)',
      { ...OUT, page: '15' },
    ),
    property('3.310', 'Immeubles privés', 'Private property', 'Immeubles privés', { page: '19' }),
    property('3.320', 'Immeubles commerciaux', 'Business property', 'Immeubles commerciaux', {
      page: '20',
    }),
    property('3.330', 'Immeubles agricoles', 'Farm property', 'Immeubles agricoles', {
      page: '20',
    }),
    property('3.340', 'Loyers', 'Rents received', 'Loyers encaissés', { page: '21' }),
    property('3.343', 'Fermages', 'Farm rents received', 'Fermages', { page: '21' }),
    property('3.345', 'Droit d’habitation', 'Right of residence', 'Droit d’habitation', {
      page: '21',
    }),
    property(
      '3.350',
      'Autres rendements immobiliers',
      'Other income from property',
      'Autres rendements immobiliers',
      { page: '21' },
    ),
    rest(
      '3.410',
      'Autres revenus',
      'Other income, its kind stated',
      'Autres revenus, nature précisée',
    ),
    assets('3.510', 'Autos, bateaux, etc.', 'Cars, boats and the like', 'Voitures, bateaux, etc.', {
      page: '22',
    }),
    assets(
      '3.520',
      'Assurances sur la vie et assurances de rentes',
      'Life and annuity insurance: the surrender value',
      'Assurances-vie et de rentes : la valeur de rachat',
      { page: '23' },
    ),
    assets(
      '3.530',
      'Collections, œuvres d’art, bijoux, etc.',
      'Collections, works of art, jewellery and other assets',
      'Collections, œuvres d’art, bijoux et autres biens',
      { page: '23' },
    ),
    assets(
      '3.570',
      'Fortune mobilière placée dans l’exploitation',
      'Business assets',
      'Fortune commerciale',
      { ...OUT, page: '23' },
    ),
  ];
}

// ---- VIII. Déductions sur le revenu et la fortune ----------------------------------------------------

function deductions(): FormRubric<FrPageId>[] {
  const ins = on('VIII', 'assurances', {});
  const debts = on('VIII', 'dettes', { columns: BOTH });
  const other = on('VIII', 'autres', {});
  const property = on('VIII', 'autres', { ...OUT, page: '28' });
  return [
    ins(
      '4.110',
      'Caisse-maladie et accidents',
      'Health and accident insurance: the flat amount per insured person, less the premium subsidy',
      'Caisse-maladie et accidents : le forfait par personne assurée, moins les subsides',
      { ...COMPUTED, page: '24' },
    ),
    ins(
      '4.120',
      'Autres primes et cotisations (3e pilier b)',
      'Life, pure-risk and daily-allowance insurance premiums (rubric A of the last page)',
      'Primes d’assurance-vie, risque pur et indemnités journalières (rubrique A de la dernière page)',
      { page: '24' },
    ),
    ins(
      '4.130',
      'Formes reconnues de prévoyance individuelle liée (3e pilier a)',
      'Pillar 3a (attach the attestation)',
      'Pilier 3a (joindre l’attestation)',
      { ...PEOPLE, page: '25' },
    ),
    ins(
      '4.140',
      'Rachats d’années d’assurance (2e pilier, caisse de pension)',
      'Pension fund buy-ins paid directly (not those of box 10.2)',
      'Rachats de caisse de pension payés directement (pas ceux du chiffre 10.2)',
      { ...PEOPLE, page: '25 and 26' },
    ),
    ins(
      '4.150',
      'Déduction des intérêts de capitaux d’épargne',
      'Interest on savings, at most the limit and the income of annex 01',
      'Intérêts de capitaux d’épargne, au plus la limite et le rendement de l’annexe 01',
      { ...COMPUTED, page: '26' },
    ),
    ins(
      '4.160',
      'Déduction du 30 % des rendements de participations qualifiées',
      'Qualified participations: 30 % of their income',
      'Participations qualifiées : 30 % de leur rendement',
      { ...OUT, page: '26' },
    ),
    debts(
      '4.210',
      'Intérêts passifs privés et dettes privées',
      'Private debt interest and private debts, from annex 02',
      'Intérêts et dettes privés, de l’annexe 02',
      { ...REPORT, page: '26 and 27' },
    ),
    debts(
      '4.220',
      'Intérêts et dettes commerciaux',
      'Business debts and their interest',
      'Dettes commerciales et leurs intérêts',
      { ...OUT, page: '27' },
    ),
    property(
      '4.310',
      'Frais d’entretien d’immeubles privés',
      'Upkeep of private property',
      'Entretien d’immeubles privés',
    ),
    property(
      '4.311',
      'Frais d’économie d’énergie et frais de démolition',
      'Energy saving and demolition costs',
      'Économies d’énergie et démolition',
    ),
    property(
      '4.313',
      'Frais d’entretien d’immeubles commerciaux',
      'Upkeep of business property',
      'Entretien d’immeubles commerciaux',
    ),
    property(
      '4.315',
      'Frais d’entretien d’immeubles agricoles',
      'Upkeep of farm property',
      'Entretien d’immeubles agricoles',
    ),
    other(
      '4.320',
      'Frais d’administration de titres et mises dans les loteries en cas de gain',
      'Costs of keeping securities',
      'Frais de garde des titres',
      { page: '30' },
    ),
    other(
      '4.330',
      'Rentes et charges durables',
      'Annuities and permanent charges paid',
      'Rentes et charges durables versées',
      { ...OUT, page: '31' },
    ),
    other(
      '4.335',
      'Droit d’habitation',
      'Right of residence granted',
      'Droit d’habitation accordé',
      {
        ...OUT,
        page: '31',
      },
    ),
    other(
      '4.340',
      'Pension alimentaire versée au/à la conjoint-e divorcé-e ou séparé-e et/ou pour enfants',
      'Alimony and child support paid (rubric D of the last page too)',
      'Pension alimentaire versée (rubrique D de la dernière page aussi)',
      { page: '31' },
    ),
    other(
      '4.350',
      'Cotisations AVS/AI/APG/AC versées par des assurés sans activité',
      'AVS/AI contributions paid without gainful activity',
      'Cotisations AVS/AI sans activité lucrative',
      { ...OUT, page: '31' },
    ),
    other(
      '4.370',
      'Frais liés à un handicap (y compris frais de séjour dans un home)',
      'Disability costs',
      'Frais liés à un handicap',
      { ...OUT, page: '31' },
    ),
    other(
      '4.380',
      'Frais de garde des enfants',
      'Childcare, per child under 14 up to the limit',
      'Frais de garde, par enfant de moins de 14 ans jusqu’à la limite',
      { ...COMPUTED, page: '32' },
    ),
    other(
      '4.410',
      'Versements aux partis politiques',
      'Payments to political parties, at most the limit',
      'Versements aux partis politiques, au plus la limite',
      { page: '33' },
    ),
    other(
      '4.420',
      'Frais de formation et de perfectionnement',
      'Professional training, at most the limit',
      'Formation et perfectionnement, au plus la limite',
      { ...PEOPLE, page: '33' },
    ),
  ];
}

// ---- IX. Revenu net, social deductions, taxable income and wealth ----------------------------------

function net(): FormRubric<FrPageId>[] {
  const n = on('IX', 'net', { ...TOTAL, nature: 'income', page: '33 and 35' });
  const add = on('IX', 'supplementaires', { ...COMPUTED });
  const social = on('IX', 'sociales', { ...COMPUTED });
  const taxable = on('IX', 'imposable', { columns: BOTH });
  return [
    n(
      '4.910',
      'Revenu net',
      'Net income: the income less the costs and general deductions',
      'Revenu net : les revenus moins les frais et déductions générales',
    ),
    add(
      '5.110',
      'Frais médicaux (frais médicaux, pharmaceutiques, dentaires)',
      'Medical costs above 5 % of the net income (rubric B of the last page)',
      'Frais médicaux au-delà de 5 % du revenu net (rubrique B de la dernière page)',
      { page: '33 and 34' },
    ),
    add(
      '5.120',
      'Versements bénévoles',
      'Donations, at most 20 % of the net income (rubric C of the last page)',
      'Dons, au plus 20 % du revenu net (rubrique C de la dernière page)',
      { page: '34' },
    ),
    social(
      '6.110',
      'Déductions sociales pour enfants',
      'Child deduction (it shrinks with the net income)',
      'Déduction pour enfants (elle diminue avec le revenu net)',
      { page: '34 and 35' },
    ),
    social(
      '6.120',
      'Autres personnes à charge',
      'Another person you support',
      'Autre personne à charge',
      { ...OUT, page: '36' },
    ),
    social(
      '6.130',
      'Contribuable aux études ou en apprentissage',
      'A taxpayer in training',
      'Contribuable en formation',
      { ...OUT, page: '36' },
    ),
    social(
      '6.140',
      'Activité en fauteuil roulant / Orphelin-e de père et mère',
      'Wheelchair user or orphan',
      'En fauteuil roulant ou orphelin',
      { ...OUT, page: '36' },
    ),
    social(
      '6.145',
      'Déduction sociale pour les soins à domicile',
      'Home care',
      'Soins à domicile',
      { ...OUT, page: '36' },
    ),
    taxable(
      '6.910',
      'Revenu après les déductions sociales / Fortune nette',
      'Income after the social deductions; net wealth (assets less debts)',
      'Revenu après les déductions sociales ; fortune nette (actifs moins dettes)',
      { ...TOTAL, nature: 'income', page: '37 to 39' },
    ),
    taxable(
      '7.110',
      'Déduction pour contribuables à revenu modeste et déduction sociale sur la fortune',
      'Modest income deduction; social deduction on wealth (both shrink)',
      'Déduction pour revenu modeste ; déduction sociale sur la fortune (elles diminuent)',
      { ...COMPUTED, page: '37 to 39' },
    ),
    taxable(
      '7.910',
      'Revenu imposable / Fortune imposable',
      'Taxable income (in whole CHF 100); taxable wealth (in whole CHF 1,000)',
      'Revenu imposable (par CHF 100 entiers) ; fortune imposable (par CHF 1’000 entiers)',
      { ...TOTAL, nature: 'income', page: '39' },
    ),
  ];
}

// ---- The last page's rubrics and the annexes Taxpresso doesn't prepare --------------------------------

function lastPage(): FormRubric<FrPageId>[] {
  const dp = on('DP', 'rubriques', { nature: 'info', ...OUT });
  const unsupported = (page: 'A03' | 'A04' | 'A05' | 'A06', where: string) =>
    on(page, 'annexe', { nature: 'info', ...OUT, page: where });
  return [
    dp('DP-A', '- A - Assurances', 'Insurance details (code 4.120)', 'Assurances (code 4.120)', {
      code: 'A',
      page: '24',
    }),
    dp(
      'DP-B',
      '- B - Frais médicaux',
      'Medical costs, item by item (code 5.110)',
      'Frais médicaux, en détail (code 5.110)',
      { code: 'B', page: '33' },
    ),
    dp(
      'DP-C',
      '- C - Versements bénévoles',
      'Donations, item by item (code 5.120)',
      'Dons, en détail (code 5.120)',
      { code: 'C', page: '34' },
    ),
    dp(
      'DP-D',
      '- D - Pension alimentaire',
      'Alimony and child support, the spouse’s and the children’s shares',
      'Pension alimentaire, la part du conjoint et celle des enfants',
      { code: 'D', page: '15 and 31' },
    ),
    dp(
      'DP-E',
      '- E - Prestations en capital',
      'Capital payments from pension schemes, taxed apart',
      'Prestations en capital de la prévoyance, imposées séparément',
      { code: 'E', page: '40' },
    ),
    unsupported('A03', '9 to 13')(
      'A03',
      'Annexe 03 «Revenu d’activité-Frais d’acquisition»',
      'The details of the salaried work and of its costs (travel, meals, telework days): FriTax works the codes 2.110 to 2.140 out from them',
      'Le détail de l’activité salariée et de ses frais (transport, repas, jours de télétravail) : FriTax en tire les codes 2.110 à 2.140',
      { code: '03' },
    ),
    unsupported('A04', '19')('A04', 'Annexe 04 «Etat des immeubles»', 'Property', 'Immeubles', {
      code: '04',
    }),
    unsupported('A05', '9 and 23')(
      'A05',
      'Annexe 05 «Revenus d’activité indépendante»',
      'Self-employment',
      'Activité indépendante',
      { code: '05' },
    ),
    unsupported('A06', '10')(
      'A06',
      'Annexe 06 (activité agricole)',
      'Farming',
      'Activité agricole',
      { code: '06' },
    ),
  ];
}

// ---- Pages -------------------------------------------------------------------------------------

const section = (id: string, title: string, en: string, fr: string) => ({
  id,
  title,
  gloss: g(en, fr),
});

function pages(y: number): FormPage<FrPageId>[] {
  const page = (
    id: FrPageId,
    title: string,
    gloss: Gloss,
    pdfPage: number,
    sections: ReturnType<typeof section>[],
    supported = true,
  ): FormPage<FrPageId> => ({
    id,
    title,
    gloss,
    pdfPage,
    supported,
    sections,
    source: EXPLAINED[id],
  });
  return [
    page(
      'A01',
      `Annexe 01 «Etat des titres et autres placements de capitaux» ${y}`,
      g(
        'The securities list: the accounts and securities, their income and value (to code 3.210)',
        'L’état des titres : comptes et titres, rendement et valeur (au code 3.210)',
      ),
      15,
      [section('totaux', 'Totaux', 'Totals', 'Totaux')],
    ),
    page(
      'A02',
      `Annexe 02 «Etat des dettes» ${y}`,
      g(
        'The debts and their interest (to code 4.210)',
        'Les dettes et leurs intérêts (au code 4.210)',
      ),
      26,
      [section('totaux', 'Totaux', 'Totals', 'Totaux')],
    ),
    page(
      'V',
      `Revenu de l’activité ${y}`,
      g('Income from work (codes 1.110 to 1.530)', 'Revenu de l’activité (codes 1.110 à 1.530)'),
      8,
      [
        section('salariee', 'Revenu d’une activité salariée', 'Salaried work', 'Activité salariée'),
        section(
          'independante',
          'Revenu d’une activité indépendante et de l’activité agricole',
          'Self-employment and farming',
          'Activité indépendante et agricole',
        ),
        section('autres', 'Autres revenus d’activité', 'Other income from work', 'Autres revenus'),
        section(
          'perte',
          'Indemnités pour perte de gain',
          'Loss-of-earnings allowances',
          'Indemnités pour perte de gain',
        ),
      ],
    ),
    page(
      'VI',
      `Frais d’acquisition du revenu ${y}`,
      g('Professional costs (codes 2.110 to 2.510)', 'Frais professionnels (codes 2.110 à 2.510)'),
      11,
      [
        section('frais', 'Frais d’acquisition', 'Professional costs', 'Frais professionnels'),
        section(
          'conjoints',
          'Activité lucrative des deux conjoints',
          'Both spouses work',
          'Les deux conjoints travaillent',
        ),
      ],
    ),
    page(
      'VII',
      `Autres revenus et état de la fortune ${y}`,
      g(
        'Pensions, investment income and wealth (codes 3.110 to 3.570)',
        'Rentes, revenus de capitaux et fortune (codes 3.110 à 3.570)',
      ),
      14,
      [
        section('rentes', 'Rentes et pensions', 'Pensions', 'Rentes et pensions'),
        section(
          'capitaux',
          'Revenu et fortune provenant de titres et autres placements de capitaux',
          'Accounts and securities',
          'Titres et placements',
        ),
        section('immeubles', 'Revenu et fortune provenant d’immeubles', 'Property', 'Immeubles'),
        section('autres', 'Autres revenus', 'Other income', 'Autres revenus'),
        section(
          'fortune',
          'Autres éléments de la fortune',
          'Other assets',
          'Autres éléments de la fortune',
        ),
      ],
    ),
    page(
      'VIII',
      `Déductions sur le revenu et la fortune ${y}`,
      g('Deductions (codes 4.110 to 4.420)', 'Déductions (codes 4.110 à 4.420)'),
      24,
      [
        section(
          'assurances',
          'Primes, cotisations d’assurances et intérêts de capitaux d’épargne',
          'Insurance, pension savings and savings interest',
          'Assurances, prévoyance et intérêts d’épargne',
        ),
        section('dettes', 'Intérêts et dettes', 'Debts and their interest', 'Intérêts et dettes'),
        section('autres', 'Autres déductions', 'Other deductions', 'Autres déductions'),
      ],
    ),
    page(
      'IX',
      `Revenu net et revenu imposable ${y}`,
      g(
        'Net income, the other deductions, taxable income and wealth (codes 4.910 to 7.910)',
        'Revenu net, autres déductions, revenu et fortune imposables (codes 4.910 à 7.910)',
      ),
      33,
      [
        section('net', 'Revenu net', 'Net income', 'Revenu net'),
        section(
          'supplementaires',
          'Frais médicaux et versements bénévoles',
          'Medical costs and donations',
          'Frais médicaux et dons',
        ),
        section('sociales', 'Déductions sociales', 'Social deductions', 'Déductions sociales'),
        section(
          'imposable',
          'Revenu et fortune imposables',
          'Taxable income and wealth',
          'Revenu et fortune imposables',
        ),
      ],
    ),
    page(
      'DP',
      `Dernière page de la déclaration ${y}`,
      g(
        'The last page: insurance, medical costs, donations, alimony, capital payments',
        'La dernière page : assurances, frais médicaux, dons, pension alimentaire, prestations en capital',
      ),
      24,
      [section('rubriques', 'Rubriques A à E', 'Rubrics A to E', 'Rubriques A à E')],
      false,
    ),
    page(
      'A03',
      `Annexe 03 «Revenu d’activité-Frais d’acquisition» ${y}`,
      g('Salaried work and its costs, in detail', 'Activité salariée et frais, en détail'),
      9,
      [section('annexe', 'Annexe 03', 'Annex 03', 'Annexe 03')],
      false,
    ),
    page(
      'A04',
      `Annexe 04 «Etat des immeubles» ${y}`,
      g('Property', 'Immeubles'),
      19,
      [section('annexe', 'Annexe 04', 'Annex 04', 'Annexe 04')],
      false,
    ),
    page(
      'A05',
      `Annexe 05 «Revenus d’activité indépendante» ${y}`,
      g('Self-employment', 'Activité indépendante'),
      9,
      [section('annexe', 'Annexe 05', 'Annex 05', 'Annexe 05')],
      false,
    ),
    page(
      'A06',
      `Annexe 06 ${y}`,
      g('Farming', 'Activité agricole'),
      10,
      [section('annexe', 'Annexe 06', 'Annex 06', 'Annexe 06')],
      false,
    ),
  ];
}

const rubrics = (): FormRubric<FrPageId>[] => [
  ...annexes(),
  ...income(),
  ...costs(),
  ...otherIncome(),
  ...deductions(),
  ...net(),
  ...lastPage(),
];

/** Shown with every year: the codes and labels are the guide's, not the printed return's. */
export const FR_FORM_NOTE_2025: Text = {
  en: 'The codes and labels come from the 2025 Fribourg guide, which explains the return code by code (fr-2025-guide-instructions-generales): Taxpresso doesn’t have the return itself, so check each code in FriTax or on your paper return.',
  fr: 'Les codes et libellés viennent des instructions fribourgeoises 2025, qui expliquent la déclaration code par code (fr-2025-guide-instructions-generales) : Taxpresso n’a pas la déclaration elle-même, vérifiez donc chaque code dans FriTax ou sur votre déclaration papier.',
  de: 'Die Codes und Bezeichnungen stammen aus der Freiburger Wegleitung 2025, die die Steuererklärung Code für Code erklärt (fr-2025-guide-instructions-generales): Taxpresso hat die Steuererklärung selbst nicht, prüfe also jeden Code in FriTax oder auf deiner Papiersteuererklärung.',
};

/** Shown with tax year 2026: its codes come from the 2025 guide. */
export const FR_FORM_NOTE: Text = {
  en: 'The codes and labels come from the 2025 Fribourg guide (fr-2025-guide-instructions-generales): the 2026 guide and FriTax 2026 are not published yet, and Taxpresso doesn’t have the return itself, so check each code in FriTax 2026 or on the return you get in 2027.',
  fr: 'Les codes et libellés viennent des instructions fribourgeoises 2025 (fr-2025-guide-instructions-generales) : les instructions et FriTax 2026 ne sont pas encore publiés, et Taxpresso n’a pas la déclaration elle-même, vérifiez donc chaque code dans FriTax 2026 ou sur la déclaration que vous recevrez en 2027.',
  de: 'Die Codes und Bezeichnungen stammen aus der Freiburger Wegleitung 2025 (fr-2025-guide-instructions-generales): Die Wegleitung und FriTax 2026 sind noch nicht veröffentlicht, und Taxpresso hat die Steuererklärung selbst nicht, prüfe also jeden Code in FriTax 2026 oder auf der Steuererklärung, die du 2027 erhältst.',
};

export const FORM_FR_2025: FormMap<FrPageId> = {
  taxYear: 2025,
  formYear: 2025,
  provisional: true,
  note: FR_FORM_NOTE_2025,
  pages: pages(2025),
  rubrics: rubrics(),
};

/** Tax year 2026: the 2025 guide's codes, until the 2026 ones are published; flagged provisional. */
export const FORM_FR_2026: FormMap<FrPageId> = {
  taxYear: 2026,
  formYear: 2025,
  provisional: true,
  note: FR_FORM_NOTE,
  pages: pages(2026),
  rubrics: rubrics(),
};

export function fribourgFormMap(taxYear: number): FormMap<FrPageId> {
  if (taxYear === 2025) return FORM_FR_2025;
  if (taxYear === 2026) return FORM_FR_2026;
  throw new Error(`No Fribourg form map for ${taxYear}.`);
}
