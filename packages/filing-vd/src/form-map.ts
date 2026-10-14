// The Vaud return for individuals (déclaration d'impôt des personnes physiques, formule 21010,
// edition V2 07.25) as printed: the main form's pages 2 to 4, the annexes 01 to 05, then the guide's
// worksheet for the federal tax (IFD), to check what VaudTax works out.
//
// Sources (docs/sources/vd/manifest.json):
// - vd-2025-form-21010: an A3 sheet; its PDF p. 1 holds the form's pages 4 and 1 side by side, its
//   PDF p. 2 the form's pages 2 and 3 (cited as "p. 2 (form page 3)", as packages/rules-vd does).
// - vd-2025-annexe-01: the securities list, p. 1 (accounts and the totals carried to code 410) and
//   p. 2 (securities with and without withholding tax).
// - vd-2025-annexes-02-03: annex 02 (debts, life insurance) on the left half of p. 1 and the right
//   half of p. 2; annex 03 (family, salary certificates) on the right half of p. 1 and the left
//   half of p. 2.
// - vd-2025-annexes-04-05: annex 04 (professional costs) for contribuable 1 on p. 1, contribuable 2
//   on p. 2; annex 05 (medical costs on p. 1, the detail of 620 and the donations on p. 2).
// - vd-2025-guide: the guide, which explains each code ("p." is the PDF page; the guide prints the
//   same numbers), and its worksheet for the federal tax, p. 65 ("Les contribuables n'ont pas
//   l'obligation de remplir un formulaire particulier pour l'impôt fédéral direct", p. 62).
//
// Columns (VD_COPY_LABELS, ./items.ts): page 2 has one amount per taxpayer, "Contribuable 1" and
// "Contribuable 2" (no federal column, no cantonal and federal pair); a line with a box for each is
// one household line with two parts, A (Contribuable 1, p1) and B (Contribuable 2, p2), in the
// return's income column 'icc' ("Revenu", as page 3 heads it). Page 3 heads its columns "Revenu"
// ('icc') and "Fortune au 31.12.2025" ('wealth'); 410, 425, 445, 500, 610, 700 and 800 have both.
// Code 618 has a box per taxpayer and their sum (parts A and B). Two lines of page 2 have one box
// only: 235 under Contribuable 2, 300 ("total famille") under Contribuable 1; they are household
// lines without parts. The annexes' totals carried to a code, and page 4's, are in 'amount'
// ("Montant") and, for wealth, 'value'; the federal worksheet in 'ifd'. The columns differ so that
// each value lands on one place only: ./items.ts gives the annex's total as its own item.
//
// Keys: the code as printed (key === code) on every page that prints it; the IFD page reuses the
// return's codes (the worksheet prints them; 300 is printed "300/340 480") with its own uncoded
// lines keyed 'revenu-intermediaire-1', 'franchise-medicale', 'deduction-maries',
// 'deduction-enfants', 'deduction-personnes' and 'revenu-imposable'; its "Revenu intermédiaire II"
// is '730' as printed. Lines the form doesn't number have a Taxpresso key ('report-400',
// '660-loyer', 'a03-menage'...). The worksheet prints no total income, no line between the
// franchise and the social deductions and no total of those: the engine's grossIncome, netIncome
// and socialDeductions have no place.
//
// Pages in the form's order, main form first (as printed and as VaudTax's rubrics go, by code); on
// paper the guide asks you to fill the annexes first and carry their totals (vd-2025-guide p. 13).
// Not mapped: the form's page 1 (personal and professional details, signature, IBAN), annex 04's
// periods and annex 05's bills, payments and donations line by line (their totals are), annex
// 01-1 and annex 07 (property). Lines Taxpresso doesn't prepare (self-employment, property,
// successions, lottery winnings, 110, 120, 220, 260, 330, 340, 640, 680...) are listed and marked
// unsupported.
import type {
  FormColumn,
  FormMap,
  FormPage,
  FormPart,
  FormRubric,
  Gloss,
} from '@taxpresso/filing-ge';
import type { Text } from '@taxpresso/rules-ch';

export const VD_PAGE_IDS = ['P2', 'P3', 'P4', 'A01', 'A02', 'A03', 'A04', 'A05', 'IFD'] as const;
export type VdPageId = (typeof VD_PAGE_IDS)[number];

const FORM = 'vd-2025-form-21010';
const ANNEX01 = 'vd-2025-annexe-01';
const ANNEX0203 = 'vd-2025-annexes-02-03';
const ANNEX0405 = 'vd-2025-annexes-04-05';
const GUIDE = 'vd-2025-guide';

/** Where each page is printed. */
const AT = {
  P2: `${FORM} p. 2 (form page 2)`,
  P3: `${FORM} p. 2 (form page 3)`,
  P4: `${FORM} p. 1 (form page 4)`,
  A01: `${ANNEX01} p. 1`,
  A01v: `${ANNEX01} p. 2`,
  A02: `${ANNEX0203} p. 1 (annexe 02)`,
  A02v: `${ANNEX0203} p. 2 (annexe 02)`,
  A03: `${ANNEX0203} p. 1 (annexe 03)`,
  A03v: `${ANNEX0203} p. 2 (annexe 03)`,
  A04: `${ANNEX0405} p. 1 (annexe 04, contribuable 1) and p. 2 (contribuable 2)`,
  A05: `${ANNEX0405} p. 1 (annexe 05)`,
  A05v: `${ANNEX0405} p. 2 (annexe 05)`,
  IFD: `${GUIDE} p. 65`,
} as const;

/** The guide's pages that explain a line: "vd-2025-guide p. 21 and 22". */
function guide(pages: number | readonly number[]): string {
  const list = typeof pages === 'number' ? [pages] : [...pages];
  const last = list.pop()!;
  return `${GUIDE} p. ${list.length ? `${list.join(', ')} and ${last}` : last}`;
}

type Options = Partial<
  Pick<
    FormRubric<VdPageId>,
    'code' | 'parts' | 'nature' | 'role' | 'format' | 'columns' | 'supported' | 'repeats'
  >
> & {
  /** Guide pages that explain the line. */
  guide?: number | readonly number[];
  /** Where it is printed, when not where the section's other lines are. */
  at?: string;
  /** No code printed for this line. */
  uncoded?: boolean;
};

/**
 * French typography: a no-break space before a colon, a semicolon, a question mark and a percent
 * sign.
 */
const frTypo = (s: string) =>
  s
    .replace(/ ?:( |$)/g, ' :$1')
    .replace(/ ;( |$)/g, ' ;$1')
    .replace(/ \?/g, ' ?')
    .replace(/ %/g, ' %');

const g = (en: string, fr: string): Gloss => ({ en, fr: frTypo(fr) });

/**
 * A line maker for one section of one page, with that section's defaults. A key of three digits is
 * the printed code.
 */
function on(page: VdPageId, at: string, section: string, defaults: Options) {
  return (key: string, label: string, en: string, fr: string, options: Options = {}) => {
    const o = { ...defaults, ...options };
    const code = o.code ?? (!o.uncoded && /^\d{3}$/.test(key) ? key : undefined);
    const rubric: FormRubric<VdPageId> = {
      key,
      ...(code ? { code } : {}),
      page,
      section,
      person: 'household',
      label: frTypo(label),
      gloss: g(en, fr),
      nature: o.nature ?? 'income',
      role: o.role ?? 'input',
      format: o.format ?? 'money',
      columns: o.columns ?? REVENU,
      ...(o.parts ? { parts: o.parts } : {}),
      ...(o.repeats ? { repeats: o.repeats } : {}),
      supported: o.supported ?? true,
      source: [o.at ?? at, ...(o.guide === undefined ? [] : [guide(o.guide)])].join('; '),
    };
    return rubric;
  };
}

/** The return's income column ("Revenu"), its wealth column ("Fortune au 31.12."), both. */
const REVENU: readonly FormColumn[] = ['icc'];
const FORTUNE: readonly FormColumn[] = ['wealth'];
const BOTH_COLUMNS: readonly FormColumn[] = ['icc', 'wealth'];
/** An annex's or page 4's amount, and an annex's wealth column. */
const AMOUNT: readonly FormColumn[] = ['amount'];
const VALUE: readonly FormColumn[] = ['value'];
/** A box per taxpayer: Contribuable 1 (A, p1) and Contribuable 2 (B, p2). */
const PERSONS: readonly FormPart[] = ['A', 'B'];
const EACH = { parts: PERSONS };
const OUT = { supported: false };
const MINUS = { nature: 'deduction' as const };
const TOTAL = { role: 'total' as const };
const TICK = { format: 'tick' as const, nature: 'info' as const };

// ---- Form page 2: Revenu en Suisse et à l'étranger ---------------------------------------------

const p2 = (section: string, more: Options = {}) => on('P2', AT.P2, section, { ...EACH, ...more });
const salaried = p2('salariees');
const independent = p2('independantes', OUT);
const other = p2('autres');
const benefits = p2('perte-de-gain');
const pensions = p2('rentes');
const premiums = p2('primes', MINUS);
const totals = p2('total', TOTAL);
const P2 = [
  salaried(
    '100',
    'Principal (total de vos différents revenus)',
    'Main job: the net salaries of your salary certificates (box 11) added up, as you list them on annex 03',
    'Activité principale : les salaires nets de vos certificats de salaire (chiffre 11) additionnés, tels que listés sur l’annexe 03',
    { guide: 17 },
  ),
  salaried(
    '105',
    'Accessoire (total de vos différents revenus)',
    'Side job: its net salaries (box 11) added up',
    'Activité accessoire : ses salaires nets (chiffre 11) additionnés',
    { guide: 18 },
  ),
  salaried(
    '110',
    'Allocations (familiales, naissance, etc.) totales non versées par l’employeur',
    'Family and birth allowances not paid by your employer',
    'Allocations familiales et de naissance non versées par l’employeur',
    { ...OUT, guide: 18 },
  ),
  salaried(
    '120',
    'Administrateur (total de vos différents revenus)',
    'Board member fees and profit shares',
    'Honoraires et tantièmes d’administrateur',
    { ...OUT, guide: 18 },
  ),
  salaried(
    '140',
    'Transport',
    'Travel to work, from annex 04',
    'Frais de transport du domicile au lieu de travail, de l’annexe 04',
    { ...MINUS, guide: [19, 20] },
  ),
  salaried(
    '150',
    'Repas ou séjour hors du domicile',
    'Lunch away from home on working days, from annex 04',
    'Repas pris hors du domicile les jours de travail, de l’annexe 04',
    { ...MINUS, guide: [21, 22] },
  ),
  salaried(
    '160',
    'Autres frais professionnels',
    'Other professional costs: the flat share of your net salary, or your actual costs when higher, from annex 04',
    'Autres frais professionnels : le forfait sur le salaire net, ou les frais effectifs s’ils sont plus élevés, de l’annexe 04',
    { ...MINUS, guide: 22 },
  ),
  salaried(
    '165',
    'Frais pour activité salariée accessoire',
    'Side job costs: the flat share of its net salary the guide gives',
    'Frais de l’activité accessoire : le forfait sur son salaire net que donne le guide',
    { ...MINUS, guide: 23 },
  ),
  independent(
    '180',
    'Principale : chiffre d’affaires total =',
    'Self-employment, main activity',
    'Activité indépendante principale',
    { guide: 24 },
  ),
  independent(
    '185',
    'Accessoire : chiffre d’affaires total =',
    'Self-employment, side activity',
    'Activité indépendante accessoire',
    { guide: 24 },
  ),
  independent(
    '186',
    'Perte commerciale non compensée et perte sur Participations qualifiées commerciales',
    'Business losses not yet offset',
    'Pertes commerciales non compensées',
    { ...MINUS, guide: 24 },
  ),
  independent(
    '190',
    'Société en nom collectif / commandite (raison sociale) :',
    'A share in a partnership',
    'Part à une société en nom collectif ou en commandite',
    { guide: 24 },
  ),
  other(
    '195',
    'Autres revenus de toute nature (sauf revenus de fortune, code 445)',
    'Other income, not from wealth (that goes under 445): say what it is',
    'Autres revenus, sauf ceux de la fortune (code 445) : précisez lesquels',
    { guide: 25 },
  ),
  benefits(
    '200',
    'Assurance-chômage (AC) et service militaire (APG)',
    'Unemployment benefits and military service allowances paid to you directly, not on a salary certificate',
    'Indemnités de chômage et allocations pour service militaire versées directement, absentes du certificat de salaire',
    { guide: 26 },
  ),
  benefits(
    '210',
    'Maladie et accidents (total de toutes vos indemnités journalières)',
    'Sickness and accident daily allowances paid to you directly, all together',
    'Indemnités journalières maladie et accidents versées directement, toutes ensemble',
    { guide: 26 },
  ),
  benefits(
    '220',
    'Assurance-invalidité (total de toutes vos indemnités journalières)',
    'Disability insurance daily allowances',
    'Indemnités journalières de l’assurance-invalidité',
    { ...OUT, guide: 26 },
  ),
  benefits(
    '230',
    'Total des codes 100 à 220',
    'Your income from 100 to 220, added up: the form’s subtotal per taxpayer',
    'Vos revenus de 100 à 220 additionnés : le sous-total du formulaire par contribuable',
    TOTAL,
  ),
  benefits(
    '235',
    'Déduction pour double activité des conjoints/partenaires enregistrés',
    'Both spouses or partners work: a deduction from the lower income; one box, in the Contribuable 2 column',
    'Les deux conjoints ou partenaires travaillent : une déduction sur le revenu le plus bas ; une seule case, dans la colonne Contribuable 2',
    { ...MINUS, parts: undefined, guide: 26 },
  ),
  pensions(
    '240',
    '1er pilier : rentes AVS et AI (rentes LAA à déclarer sous code 270)',
    'AVS and AI pensions (old age and disability); accident (LAA) pensions go under 270',
    'Rentes AVS et AI ; les rentes LAA vont sous le code 270',
    { guide: 27 },
  ),
  pensions(
    '250',
    '2e pilier : rentes provenant d’institutions de prévoyance professionnelle (prière de compléter le chiffre 8, page 4 ci-après)',
    'Pension fund pensions (2nd pillar); answer item 8 on page 4 too',
    'Rentes de la prévoyance professionnelle (2e pilier) ; répondez aussi au chiffre 8 de la page 4',
    { guide: 28 },
  ),
  pensions(
    '260',
    '3e pilier A : rentes provenant de formes reconnues de la prévoyance individuelle liée',
    'Pensions from pillar 3a',
    'Rentes du 3e pilier A',
    { ...OUT, guide: 28 },
  ),
  pensions(
    '270',
    '3e pilier B : autres rentes et pensions',
    'Other pensions, with accident (LAA) pensions and the taxable share of a life annuity',
    'Autres rentes et pensions, avec les rentes LAA et la part imposable d’une rente viagère',
    { guide: 28 },
  ),
  pensions(
    '280',
    'Pensions alimentaires obtenues (prière de compléter le chiffre 1A, page 4 ci-après)',
    'Alimony and child support received, by the taxpayer who receives it; list them in table 1A on page 4',
    'Pensions alimentaires et contributions d’entretien reçues, par contribuable bénéficiaire ; détaillez-les au tableau 1A de la page 4',
    { guide: 28 },
  ),
  premiums(
    '300',
    'Assurances maladie et accidents, assurances sur la vie (total famille)',
    'Health, accident and life insurance premiums of the family, less the premium subsidies, at most the deduction for your family situation; one box, in the Contribuable 1 column',
    'Primes d’assurance-maladie, accidents et vie de la famille, moins les subsides, au plus la déduction selon votre situation de famille ; une seule case, dans la colonne Contribuable 1',
    { parts: undefined, guide: 29 },
  ),
  premiums(
    '310',
    'Formes reconnues de prévoyance individuelle liée (3e pilier A)',
    'Paid into pillar 3a, at most the yearly limit (attach the attestation)',
    'Versé au 3e pilier A, au plus la limite annuelle (joignez l’attestation)',
    { guide: 30 },
  ),
  premiums(
    '320',
    'Rachats d’années d’assurance (2e pilier, caisse de pension)',
    'Pension fund buy-ins you paid yourself, not on a salary certificate',
    'Rachats de caisse de pension payés vous-même, absents du certificat de salaire',
    { guide: 31 },
  ),
  premiums(
    '330',
    'Cotisations des indépendant-e-s',
    'Pension contributions of the self-employed',
    'Cotisations de prévoyance des indépendants',
    { ...OUT, guide: 31 },
  ),
  premiums(
    '340',
    'Autres cotisations contractuelles des salariés (indemnités journalières, etc.)',
    'Other contributions an employee pays under contract (daily allowance insurance)',
    'Autres cotisations contractuelles des salariés (assurance d’indemnités journalières)',
    { ...OUT, guide: 31 },
  ),
  totals(
    '398',
    'Total par contribuable (total des codes 230 à 340)',
    'Each taxpayer’s total: 230 less the deductions down to 340',
    'Total de chaque contribuable : 230 moins les déductions jusqu’au code 340',
  ),
  totals(
    '399',
    'Report du total contribuable 2',
    'Contribuable 2’s total (398), carried to the Contribuable 1 column',
    'Le total du contribuable 2 (398), reporté dans la colonne Contribuable 1',
    { parts: undefined, role: 'report' },
  ),
  totals(
    '400',
    'Cumul (398 + 399)',
    'Both totals together, carried to the top of page 3',
    'Les deux totaux ensemble, reportés en haut de la page 3',
    { parts: undefined },
  ),
  totals(
    'p2-seconde',
    'Votre conjoint-e/partenaire enregistré-e vous seconde-t-il/elle régulièrement et dans une mesure importante dans l’exercice de votre profession ou dans l’exploitation de votre entreprise ?',
    'Your spouse or partner helps regularly and substantially in your business',
    'Votre conjoint ou partenaire vous seconde régulièrement dans votre activité ou votre entreprise',
    { ...OUT, ...TICK, role: 'input', parts: undefined, columns: [], guide: 26 },
  ),
];

// ---- Form page 3: Revenu et fortune en Suisse et à l'étranger -----------------------------------

const p3 = (section: string, more: Options = {}) => on('P3', AT.P3, section, more);
const wealth = p3('fortune');
const property = p3('immeubles', OUT);
const debts = p3('dettes', MINUS);
const special = p3('deductions', MINUS);
const middle = p3('intermediaires', MINUS);
const taxable = p3('imposable', TOTAL);
const P3 = [
  wealth(
    'report-400',
    'Report du code 400',
    'The total of page 2 (code 400), carried here',
    'Le total de la page 2 (code 400), reporté ici',
    { role: 'report' },
  ),
  wealth(
    '410',
    'Titres et autres placements / gains de loterie (annexes 01 et 01-1)',
    'Accounts and securities: their gross income in the year (Revenu) and their tax value on 31 December (Fortune), the totals of annex 01',
    'Comptes et titres : leur rendement brut de l’année (Revenu) et leur valeur imposable au 31 décembre (Fortune), les totaux de l’annexe 01',
    { columns: BOTH_COLUMNS, guide: 32 },
  ),
  wealth(
    '420',
    'Numéraire, billets de banque, or, autres métaux précieux et crypto-monnaies',
    'Cash, gold, other precious metals and crypto-assets on 31 December',
    'Espèces, or, autres métaux précieux et crypto-monnaies au 31 décembre',
    { nature: 'wealth', columns: FORTUNE, guide: 38 },
  ),
  wealth(
    '425',
    'Successions non partagées',
    'A share in an estate not yet divided',
    'Part à une succession non partagée',
    { ...OUT, columns: BOTH_COLUMNS, guide: 38 },
  ),
  wealth(
    '430',
    'Autos, motos, chevaux de selle, collections, bijoux, bateaux, tableaux, etc.',
    'Vehicles, boats, collections, jewellery and the like, at their value on 31 December',
    'Véhicules, bateaux, collections, bijoux et autres, à leur valeur au 31 décembre',
    { nature: 'wealth', columns: FORTUNE, guide: 39 },
  ),
  wealth(
    '435',
    'Assurances sur la vie (assurances de capitaux et assurances de rentes) (annexe 02)',
    'Life and annuity insurance: their tax surrender value on 31 December, the total of annex 02',
    'Assurances sur la vie et de rentes : leur valeur de rachat fiscale au 31 décembre, le total de l’annexe 02',
    { nature: 'wealth', columns: FORTUNE, guide: 39 },
  ),
  wealth(
    '440-assurance',
    '30% valeur d’assurance',
    'Household contents: 30 % of their fire insurance value, the box before code 440',
    'Objets mobiliers : 30 % de leur valeur d’assurance incendie, la case avant le code 440',
    { code: '440', nature: 'info', columns: AMOUNT, guide: 39 },
  ),
  wealth(
    '440',
    'Objets mobiliers',
    'Household contents: 30 % of their fire insurance value less the amount the form prints (more for a couple); only what is above it is declared',
    'Objets mobiliers : 30 % de la valeur d’assurance incendie moins le montant imprimé sur le formulaire (plus élevé pour un couple) ; seul l’excédent est déclaré',
    { nature: 'wealth', columns: FORTUNE, guide: 39 },
  ),
  wealth(
    '445',
    'Autre fortune et revenus de fortune',
    'Other assets on 31 December (Fortune) and their income (Revenu)',
    'Autres éléments de fortune au 31 décembre (Fortune) et leurs revenus (Revenu)',
    { columns: BOTH_COLUMNS, guide: 39 },
  ),
  wealth(
    '450',
    'Exploitants du sol : animaux + matériel d’exploitation',
    'Farmers: livestock and equipment',
    'Exploitants agricoles : animaux et matériel',
    { ...OUT, nature: 'wealth', columns: FORTUNE, guide: 39 },
  ),
  wealth(
    '460',
    'Fortune placée dans des sociétés en nom collectif ou en commandite simple',
    'Wealth in a partnership',
    'Fortune placée dans une société de personnes',
    { ...OUT, nature: 'wealth', columns: FORTUNE, guide: 40 },
  ),
  wealth(
    '465',
    'Autres actifs d’exploitation sauf immeubles et placements commerciaux',
    'Other business assets',
    'Autres actifs commerciaux',
    { ...OUT, nature: 'wealth', columns: FORTUNE, guide: 40 },
  ),
  wealth(
    '480',
    'Déduction des intérêts de capitaux d’épargne',
    'Interest on savings (savings and current accounts, bonds, cash bonds, loans) included in 410, at most the limit for your family situation',
    'Intérêts de l’épargne (livrets, comptes courants, obligations, bons de caisse, prêts) compris dans le code 410, au plus la limite selon votre situation de famille',
    { ...MINUS, guide: 40 },
  ),
  wealth(
    '490',
    'Frais d’administration de titres',
    'Costs of keeping your securities (custody fees), not buying or selling them',
    'Frais de garde et d’administration des titres, sans les frais d’achat ou de vente',
    { ...MINUS, guide: 40 },
  ),
  wealth(
    '495',
    'Mises dans les loteries',
    'Lottery stakes, against a winning',
    'Mises dans les loteries, sur un gain',
    { ...OUT, ...MINUS, guide: [40, 41] },
  ),
  property(
    '500',
    'Immeubles privés',
    'Private property (annex 07)',
    'Immeubles privés (annexe 07)',
    { columns: BOTH_COLUMNS, guide: 41 },
  ),
  property('510', 'Immeubles commerciaux', 'Business property', 'Immeubles commerciaux', {
    nature: 'wealth',
    columns: FORTUNE,
    guide: 41,
  }),
  property(
    '530',
    'Droit d’habitation gratuit, sous-location, etc.',
    'A free right to live in a home, subletting',
    'Droit d’habitation gratuit, sous-location',
    { guide: 41 },
  ),
  property(
    '540',
    'Frais d’entretien d’immeubles privés et investissements destinés à économiser l’énergie et à ménager l’environnement',
    'Property upkeep costs',
    'Frais d’entretien d’immeubles',
    { ...MINUS, guide: 41 },
  ),
  debts(
    '610',
    'Privés',
    'Private debts: the interest paid in the year (Revenu) and the debts on 31 December (Fortune), from annex 02; no repayments, no leasing',
    'Dettes privées : les intérêts payés dans l’année (Revenu) et les dettes au 31 décembre (Fortune), de l’annexe 02 ; sans amortissement ni leasing',
    { columns: BOTH_COLUMNS, guide: [41, 42] },
  ),
  debts('615', 'Exploitation', 'Business debts', 'Dettes commerciales', {
    ...OUT,
    columns: FORTUNE,
    guide: 41,
  }),
  special(
    '618',
    'Frais de perfectionnement et de formation (annexe 04)',
    'Professional training each of you paid (contribuable 1 + contribuable 2), at most the yearly maximum per person; their sum in the Revenu column',
    'Formation et perfectionnement payés par chacun (contribuable 1 + contribuable 2), au plus le maximum annuel par personne ; leur somme dans la colonne Revenu',
    { ...EACH, guide: 42 },
  ),
  special(
    '620',
    'Rentes et charges durables et versements à des partis politiques (annexe 05)',
    'Payments to political parties, at most the yearly maximum, from annex 05',
    'Versements à des partis politiques, au plus le maximum annuel, de l’annexe 05',
    { guide: 43 },
  ),
  special(
    '630',
    'Pensions alimentaires versées (prière de compléter le chiffre 1B, page 4 ci-après)',
    'Alimony and child support you paid; list them in table 1B on page 4',
    'Pensions alimentaires et contributions d’entretien versées ; détaillez-les au tableau 1B de la page 4',
    { guide: 43 },
  ),
  special(
    '640',
    'Cotisations AVS / AI / APG / AC versées par des personnes sans activité lucrative',
    'AVS contributions paid while not working',
    'Cotisations AVS payées sans activité lucrative',
    { ...OUT, guide: 44 },
  ),
  special(
    '670-effectif',
    'Montant effectif',
    'Childcare you actually paid in the year, the box before code 670',
    'Frais de garde effectivement payés dans l’année, la case avant le code 670',
    { code: '670', nature: 'info', columns: AMOUNT, guide: 44 },
  ),
  special(
    '670',
    'Déduction pour frais de garde (se référer aux instructions)',
    'Childcare by others for each child under 14 living with you, at most the limit per child',
    'Frais de garde par des tiers pour chaque enfant de moins de 14 ans vivant avec vous, au plus la limite par enfant',
    { guide: 44 },
  ),
  special(
    '650',
    'Revenu net (total des codes 400 à 640 + 670)',
    'Net income: the total of page 2 and the income above, less the deductions down to 670',
    'Revenu net : le total de la page 2 et les revenus ci-dessus, moins les déductions jusqu’au code 670',
    { ...TOTAL, nature: 'income' },
  ),
  special(
    '660-loyer',
    'Loyer annuel net',
    'The yearly rent of your main home, without charges, the box before code 660',
    'Le loyer annuel de votre logement principal, sans les charges, la case avant le code 660',
    { code: '660', nature: 'info', columns: AMOUNT, guide: 44 },
  ),
  special(
    '660',
    'Déduction sociale pour le logement (se référer aux instructions)',
    'Housing deduction: the rent counted, at most the maximum for your family, less 20 % of the net income (650), at most the deduction’s maximum',
    'Déduction pour le logement : le loyer pris en compte, au plus le maximum selon votre famille, moins 20 % du revenu net (650), au plus le maximum de la déduction',
    { guide: 44 },
  ),
  special(
    '680',
    'Déduction pour personne(s) à charge',
    'A dependent person you support',
    'Personne à charge',
    { ...OUT, guide: 45 },
  ),
  special(
    '690',
    'Différence : Code 650 moins codes 660 et 680',
    'The net income less the housing deduction',
    'Le revenu net moins la déduction pour le logement',
    { ...TOTAL, nature: 'income' },
  ),
  special(
    '695',
    'Déduction pour contribuable modeste (se référer aux instructions)',
    'Modest income deduction, which shrinks as 690 rises above its maximum',
    'Déduction pour contribuable modeste, qui diminue quand le code 690 dépasse son maximum',
    { guide: 45 },
  ),
  middle(
    '700',
    'Revenu / fortune intermédiaires',
    'Intermediate income (690 less 695): the base of the medical costs and donations; and the net wealth',
    'Revenu intermédiaire (690 moins 695) : la base des frais médicaux et des dons ; et la fortune nette',
    { ...TOTAL, nature: 'income', columns: BOTH_COLUMNS },
  ),
  middle(
    '710',
    'Frais médicaux et dentaires - Frais liés à un handicap (annexe 05)',
    'Medical and dental costs left to pay, above 5 % of 700, from annex 05',
    'Frais médicaux et dentaires à votre charge, au-delà de 5 % du code 700, de l’annexe 05',
    { guide: 48 },
  ),
  middle(
    '720',
    'Dons à des institutions d’utilité publique (annexe 05)',
    'Donations to tax-exempt Swiss organisations, at most 20 % of 700, from annex 05',
    'Dons à des institutions suisses exonérées, au plus 20 % du code 700, de l’annexe 05',
    { guide: 49 },
  ),
  middle(
    '725',
    'Déduction pour famille (se référer aux instructions)',
    'Family deduction, for spouses and single parents, by child, less above a net income',
    'Déduction pour famille, pour les époux et les familles monoparentales, par enfant, réduite au-delà d’un revenu net',
    { guide: 49 },
  ),
  middle(
    '730',
    'Sous-total [(code 700) moins (codes 710 à 725)]',
    'Subtotal: 700 less 710 to 725',
    'Sous-total : 700 moins les codes 710 à 725',
    { ...TOTAL, nature: 'income' },
  ),
  taxable(
    '800',
    'Revenu imposable et fortune imposable',
    'Taxable income (730 in whole hundreds of francs) and taxable wealth (the net wealth in whole thousands)',
    'Revenu imposable (730 par centaines de francs entières) et fortune imposable (la fortune nette par milliers entiers)',
    { nature: 'income', columns: BOTH_COLUMNS, guide: 51 },
  ),
  taxable(
    '810',
    'Parts résultant de la situation de famille',
    'Your parts of the quotient familial (family quotient): 1 for a single person, 1.8 for a couple, 1.3 for a single parent alone with the children, and a half part per child; the form takes them with a comma (2,80)',
    'Vos parts du quotient familial : 1 pour une personne seule, 1,8 pour un couple, 1,3 pour une famille monoparentale, et une demi-part par enfant',
    { role: 'computed', nature: 'info', format: 'count', guide: 51 },
  ),
  taxable(
    '820',
    'Revenu déterminant pour le taux (quotient familial)',
    'Rate-determining income: the taxable income divided by the parts, in whole hundreds of francs, with the cap for children',
    'Revenu déterminant pour le taux : le revenu imposable divisé par les parts, par centaines de francs entières, avec le plafond pour les enfants',
    { role: 'computed', nature: 'info', guide: 52 },
  ),
];

// ---- Form page 4: Informations complémentaires --------------------------------------------------

const p4 = (section: string, more: Options = {}) =>
  on('P4', AT.P4, section, { columns: AMOUNT, ...more });
const P4 = [
  p4('1', { ...EACH, ...TOTAL, guide: 28 })(
    '280',
    'Total par bénéficiaire à reporter sous code 280',
    'Table 1A: alimony and child support received, who paid it and how much; the total for each taxpayer who receives it, carried to 280',
    'Tableau 1A : pensions alimentaires reçues, de qui et combien ; le total par contribuable bénéficiaire, reporté sous le code 280',
  ),
  p4('1', { ...MINUS, ...TOTAL, guide: 43 })(
    '630',
    'Total à reporter sous code 630',
    'Table 1B: alimony and child support you paid, to whom and how much; the total, carried to 630',
    'Tableau 1B : pensions alimentaires versées, à qui et combien ; le total, reporté sous le code 630',
  ),
  p4('2', { ...OUT, nature: 'info' })(
    'p4-capital',
    'Montant total des prestations',
    'Lump sums from a pension, pillar 3a, life insurance or a liquidation profit',
    'Prestations en capital de la prévoyance, du 3e pilier A, d’assurances ou bénéfice de liquidation',
  ),
  p4('3', { ...OUT, nature: 'info' })(
    'p4-capitaux-remplacant',
    'Montant total des prestations',
    'Lump sums replacing regular payments',
    'Versements en capital remplaçant des prestations périodiques',
  ),
  p4('6', { ...OUT, ...TICK })(
    'p4-donations',
    'Avez-vous effectué ou reçu des donations ou avances d’hoirie ? Participez-vous à des successions non partagées ? Avez-vous reçu des biens par voie d’héritage ?',
    'Gifts made or received, an estate not divided, an inheritance received',
    'Donations faites ou reçues, succession non partagée, héritage reçu',
  ),
  p4('8', { ...OUT, ...TICK, ...EACH, guide: [28, 62] })(
    'p4-affiliation',
    'Rentes provenant d’institutions de prévoyance professionnelle (2e pilier) : est-ce que votre affiliation au 2e pilier a débuté après le 31 décembre 1986 ?',
    'For a pension fund pension: whether you joined the fund after 1986, and the date of the first pension',
    'Pour une rente du 2e pilier : affiliation après 1986, et date de la première rente',
  ),
  p4('9', { ...TICK, ...EACH })(
    'p4-cotisations-2e-pilier',
    'Avez-vous versé des cotisations pour la prévoyance professionnelle (2e pilier) ?',
    'Whether you paid into a pension fund in the year (salary certificate box 10.1)',
    'Avez-vous cotisé à une caisse de pension dans l’année (certificat de salaire, chiffre 10.1)',
  ),
  p4('10', { nature: 'info', guide: 29 })(
    'p4-primes',
    'Montant des primes brutes selon police(s)',
    'The health, accident and life insurance premiums of the year, before the subsidies, as your policies show them',
    'Les primes d’assurance-maladie, accidents et vie de l’année, avant les subsides, selon vos polices',
  ),
  p4('10', { nature: 'info', guide: 29 })(
    'p4-subsides',
    'Montant des subsides',
    'The premium subsidies you received in the year',
    'Les subsides aux primes reçus dans l’année',
  ),
];

// ---- Annex 01: état des titres ------------------------------------------------------------------

const a01 = (section: string, more: Options = {}) =>
  on('A01', AT.A01, section, { columns: AMOUNT, nature: 'info', ...more });
const A01 = [
  a01('1', { repeats: 12, guide: 32 })(
    'a01-comptes',
    'Comptes et livrets bancaires, postaux, comptes garantie de loyer / leasing',
    'Each account on its line: its gross income in the year (1/A with withholding tax, 1/B without) and its value on 31 December, from your bank’s statements',
    'Chaque compte sur sa ligne : son rendement brut de l’année (1/A soumis à l’impôt anticipé, 1/B non soumis) et sa valeur au 31 décembre, selon les relevés de la banque',
  ),
  a01('2', { repeats: 9, at: AT.A01v, guide: 32 })(
    'a01-titres-2a',
    'Titres et rendements soumis à l’impôt anticipé',
    'Swiss securities and their income with withholding tax, one per line (2/A)',
    'Titres et rendements soumis à l’impôt anticipé, un par ligne (2/A)',
  ),
  a01('2', { repeats: 9, at: AT.A01v, guide: 32 })(
    'a01-titres-2b',
    'Titres et rendements non soumis à l’impôt anticipé',
    'Securities and income without Swiss withholding tax, one per line (2/B)',
    'Titres et rendements non soumis à l’impôt anticipé, un par ligne (2/B)',
  ),
  a01('totaux', { ...TOTAL, nature: 'income', columns: ['amount', 'value'], guide: 32 })(
    '410',
    'Totaux des rendements et fortune à reporter sous code 410 de la déclaration d’impôt',
    'The gross income of all your accounts and securities in the year (Montant) and their value on 31 December, carried to 410',
    'Le rendement brut de tous vos comptes et titres de l’année (Montant) et leur valeur au 31 décembre, reportés sous le code 410',
  ),
  a01('imputation', OUT)(
    'a01-imputation',
    'Total imputable sur prochain décompte',
    'The Swiss withholding tax to be credited or refunded',
    'L’impôt anticipé à imputer ou rembourser',
  ),
  a01('totaux', OUT)(
    'a01-participations',
    'Reports 3/A et 3/B participations qualifiées',
    'Qualified holdings (annex 01-1)',
    'Participations qualifiées (annexe 01-1)',
  ),
];

// ---- Annex 02: dettes, assurances ---------------------------------------------------------------

const a02 = (section: string, more: Options = {}) =>
  on('A02', AT.A02, section, { nature: 'deduction', ...more });
const A02 = [
  a02('A', { repeats: 10, columns: ['amount', 'value'], guide: 41 })(
    'a02-dettes',
    'Dettes privées (I. garanties par gage immobilier, II. autres dettes privées)',
    'Each private debt on its line: the creditor, the interest of the year and the debt on 31 December',
    'Chaque dette privée sur sa ligne : le créancier, les intérêts de l’année et la dette au 31 décembre',
  ),
  a02('A', { ...OUT, columns: AMOUNT, guide: 41 })(
    'a02-rendements-negatifs',
    'III. Rendements négatifs de placements de capitaux',
    'Negative yields on your investments',
    'Rendements négatifs de placements',
  ),
  a02('A', { ...TOTAL, columns: ['amount', 'value'], guide: 41 })(
    '610',
    'Total à reporter sous code 610 de la déclaration d’impôt',
    'All private debts together: the interest of the year (Montant) and the debts on 31 December, carried to 610',
    'Toutes les dettes privées ensemble : les intérêts de l’année (Montant) et les dettes au 31 décembre, reportés sous le code 610',
  ),
  a02('B', { ...OUT, ...TOTAL, columns: VALUE, at: AT.A02v, guide: 41 })(
    '615',
    'Total à reporter sous code 615 de la déclaration d’impôt',
    'Business debts',
    'Dettes commerciales',
  ),
  a02('C', { nature: 'wealth', repeats: 7, columns: VALUE, at: AT.A02v, guide: 39 })(
    'a02-assurances',
    'Assurances sur la vie (assurances de capitaux et assurances de rentes, même si elles n’ont pas encore de valeur de rachat imposable)',
    'Each life or annuity insurance on its line: the insurer, the years, the sum insured and its tax surrender value',
    'Chaque assurance sur la vie ou de rentes sur sa ligne : l’assureur, les années, la somme assurée et sa valeur de rachat fiscale',
  ),
  a02('C', { nature: 'wealth', ...TOTAL, columns: VALUE, at: AT.A02v, guide: 39 })(
    '435',
    'Total à reporter sous code 435 de la déclaration d’impôt',
    'The tax surrender value of all your life insurance together, carried to 435',
    'La valeur de rachat fiscale de toutes vos assurances sur la vie, reportée sous le code 435',
  ),
];

// ---- Annex 03: situation familiale, relevé des certificats de salaire ---------------------------

const a03 = (section: string, more: Options = {}) =>
  on('A03', AT.A03, section, { nature: 'info', format: 'text', columns: [], ...more });
const A03 = [
  a03('famille', { guide: 10 })(
    'a03-enfants-mineurs',
    'Enfants mineurs',
    'Your minor children: AVS number, name, date of birth, activity, and whether they live with you (A) or not (B)',
    'Vos enfants mineurs : numéro AVS, nom, date de naissance, activité, et s’ils font ménage commun avec vous (A) ou non (B)',
  ),
  a03('famille', { guide: 10 })(
    'a03-enfants-majeurs',
    'Enfants majeurs en apprentissage ou aux études',
    'Adult children in training or studying whom you support',
    'Enfants majeurs en apprentissage ou aux études à votre charge',
  ),
  a03('famille', { ...TICK, guide: [10, 51] })(
    'a03-menage',
    'Tenez-vous un ménage indépendant seul avec cet (ces) enfant(s) ?',
    'Asked if you are single, widowed, separated or divorced: you live alone with your children, not as a couple (the part of 1.3)',
    'Question posée à la personne célibataire, veuve, séparée ou divorcée : vous vivez seul avec vos enfants, sans concubin (la part de 1,3)',
  ),
  a03('famille', { ...OUT, guide: 45 })(
    'a03-personnes-a-charge',
    'Autres personnes incapables de subvenir seules à leurs besoins à la charge du/de la contribuable',
    'Other dependent persons you support (680)',
    'Autres personnes à charge (code 680)',
  ),
  a03('certificats', {
    ...EACH,
    nature: 'income',
    format: 'money',
    columns: AMOUNT,
    repeats: 6,
    at: AT.A03v,
    guide: 17,
  })(
    'a03-certificats',
    'Salaire net (ch.11 du certificat de salaire)',
    'One line per salary certificate: whose it is, the employer, the kind of income (100, 105, 110, 120), the net salary (box 11), the pension contributions (10.1, 10.2), and the boxes F and G ticked',
    'Une ligne par certificat de salaire : le bénéficiaire, l’employeur, le type de revenu (100, 105, 110, 120), le salaire net (chiffre 11), les cotisations de prévoyance (10.1, 10.2), et les cases F et G cochées',
  ),
];

// ---- Annex 04: frais professionnels des salariés, frais de formation ----------------------------

const a04 = (section: string, more: Options = {}) =>
  on('A04', AT.A04, section, { ...EACH, ...MINUS, columns: AMOUNT, ...more });
const A04 = [
  a04('transport', { ...TOTAL, guide: [19, 20] })(
    '140',
    'Total à reporter sous code 140 de la déclaration d’impôt',
    'Travel to work, each period on its line (days, home, workplace, km, means of transport), added up; carried to 140',
    'Frais de transport, chaque période sur sa ligne (jours, domicile, lieu de travail, km, moyen de transport), additionnés ; reportés sous le code 140',
  ),
  a04('repas', { ...TOTAL, guide: [21, 22] })(
    '150',
    'Total des frais de repas (A) et/ou résidence hors du domicile (B) à reporter sous code 150 de la déclaration d’impôt',
    'Lunch away from home (A), each period on its line, added up; carried to 150',
    'Frais de repas (A), chaque période sur sa ligne, additionnés ; reportés sous le code 150',
  ),
  a04('autres', { ...TOTAL, guide: 22 })(
    '160',
    'Total à reporter sous code 160 de la déclaration d’impôt',
    'Other professional costs: the flat 3 % of the net salary of your certificate, or your actual costs listed; carried to 160',
    'Autres frais professionnels : le forfait de 3 % du salaire net du certificat, ou vos frais effectifs listés ; reportés sous le code 160',
  ),
  a04('interruption', { ...OUT, nature: 'info', format: 'text', columns: [], guide: 17 })(
    'a04-interruption',
    'Périodes d’interruption de travail sans salaire, ni chômage ou toute autre indemnité',
    'Periods without work, salary or benefits',
    'Périodes sans travail, salaire ni indemnité',
  ),
  a04('formation', { ...TOTAL, guide: 42 })(
    '618',
    'Total à reporter sous code 618 de la déclaration d’impôt',
    'Professional training you paid in the year, each payment on its line with its date, added up; carried to 618',
    'Frais de perfectionnement et de formation payés dans l’année, chaque paiement sur sa ligne avec sa date, additionnés ; reportés sous le code 618',
  ),
];

// ---- Annex 05: frais médicaux, détail du code 620, dons -----------------------------------------

function annex05(year: number) {
  const a05 = (section: string, more: Options = {}) =>
    on('A05', AT.A05, section, { ...MINUS, columns: AMOUNT, ...more });
  const medical = a05('710', { guide: 48 });
  const detail = a05('620', { at: AT.A05v, guide: 43 });
  const gifts = a05('720', { at: AT.A05v, guide: 49 });
  return [
    medical(
      'a05-frais-medicaux',
      `Total des frais médicaux / frais liés au handicap ${year} à la charge du contribuable`,
      'Your medical and dental bills of the year, one per line, less what insurers and others paid, added up',
      'Vos factures médicales et dentaires de l’année, une par ligne, moins la participation des assurances et des tiers, additionnées',
      TOTAL,
    ),
    medical(
      'a05-vingtieme',
      'Déduire le vingtième du revenu mentionné sous code 700 de la déclaration d’impôt',
      'Less one twentieth (5 %) of code 700',
      'Moins le vingtième (5 %) du code 700',
      { role: 'computed' },
    ),
    medical(
      'a05-handicap',
      'Ajouter les frais liés au handicap',
      'Disability costs, deducted in full',
      'Frais liés à un handicap, déduits en entier',
      OUT,
    ),
    medical(
      '710',
      'Montant déductible, à reporter sous code 710 de la déclaration d’impôt',
      'The medical costs above one twentieth of 700: carried to 710',
      'Les frais médicaux au-delà du vingtième du code 700 : reportés sous le code 710',
      TOTAL,
    ),
    detail(
      'a05-rentes',
      'Total des rentes et charges durables',
      'Life annuities and permanent charges you pay',
      'Rentes et charges durables versées',
      OUT,
    ),
    detail(
      'a05-partis',
      'Total des versements à des partis politiques',
      'Your payments to political parties, each on its line, added up',
      'Vos versements à des partis politiques, chacun sur sa ligne, additionnés',
      TOTAL,
    ),
    detail(
      '620',
      'Montant déductible sous code 620 de la déclaration d’impôt',
      'The payments to political parties, at most the yearly maximum: carried to 620',
      'Les versements aux partis politiques, au plus le maximum annuel : reportés sous le code 620',
      TOTAL,
    ),
    gifts(
      'a05-dons',
      `Total des dons faits en ${year}`,
      'Your donations to tax-exempt organisations with their seat in Switzerland, each on its line with its date, added up',
      'Vos dons à des personnes morales exonérées ayant leur siège en Suisse, chacun sur sa ligne avec sa date, additionnés',
      TOTAL,
    ),
    gifts(
      'a05-cinquieme',
      'Cinquième du revenu mentionné sous code 700 de la déclaration d’impôt',
      'One fifth (20 %) of code 700',
      'Le cinquième (20 %) du code 700',
      { role: 'computed' },
    ),
    gifts(
      '720',
      'Montant le plus bas à reporter sous code 720 de la déclaration d’impôt',
      'The lower of the two: carried to 720',
      'Le plus bas des deux : reporté sous le code 720',
      TOTAL,
    ),
  ];
}

// ---- The guide's worksheet for the federal tax (IFD) --------------------------------------------

/**
 * The worksheet's lines in its order (vd-2025-guide p. 65), each with the guide's page on the
 * federal difference where there is one (p. 62 to 64): one amount column, a sign printed for each
 * line, no column per taxpayer. VaudTax works the federal tax out: you only check these.
 */
const ifd = on('IFD', AT.IFD, 'determination', { columns: ['ifd'], role: 'computed' });
const ifdOut = (key: string, label: string, en: string, fr: string, more: Options = {}) =>
  ifd(key, label, en, fr, { ...OUT, ...more });
const IFD = [
  ifd('100', 'Activité principale salariée', 'Main job', 'Activité principale salariée'),
  ifd('105', 'Activité accessoire salariée', 'Side job', 'Activité accessoire salariée'),
  ifdOut(
    '110',
    'Allocations non versées par l’employeur',
    'Allowances not paid by the employer',
    'Allocations non versées par l’employeur',
  ),
  ifdOut(
    '120',
    'Administrateur : honoraires, tantièmes et autres',
    'Board member fees',
    'Honoraires d’administrateur',
  ),
  ifd(
    '140',
    'Frais de transport',
    'Travel to work, at most the federal maximum per employee',
    'Frais de transport, au plus le maximum fédéral par salarié',
    { ...MINUS, guide: 62 },
  ),
  ifd(
    '150',
    'Repas ou séjour hors du domicile',
    'Lunch away from home',
    'Repas hors du domicile',
    MINUS,
  ),
  ifd(
    '160',
    'Autres frais professionnels',
    'Other professional costs, the federal flat amount or actual costs',
    'Autres frais professionnels, forfait fédéral ou frais effectifs',
    MINUS,
  ),
  ifd(
    '165',
    'Frais pour activité salariée accessoire',
    'Side job costs, the federal flat amount',
    'Frais de l’activité accessoire, forfait fédéral',
    { ...MINUS, guide: 62 },
  ),
  ifdOut('180', 'Activité indépendante principale', 'Self-employment', 'Activité indépendante'),
  ifdOut(
    '185',
    'Activité indépendante accessoire',
    'Self-employment, side',
    'Activité indépendante accessoire',
  ),
  ifdOut(
    '186',
    'Perte commerciale non compensée / perte sur participations qualifiées commerciales',
    'Business losses',
    'Pertes commerciales',
    MINUS,
  ),
  ifdOut(
    '190',
    'Société en nom collectif / commandite',
    'A share in a partnership',
    'Part à une société de personnes',
  ),
  ifd('195', 'Autres revenus de toute nature', 'Other income', 'Autres revenus'),
  ifd(
    '200',
    'Assurance chômage (AC) et service militaire (APG)',
    'Unemployment and military service allowances',
    'Chômage et allocations pour service militaire',
  ),
  ifd(
    '210',
    'Indemnités maladie et accidents',
    'Sickness and accident daily allowances',
    'Indemnités journalières maladie et accidents',
  ),
  ifdOut(
    '220',
    'Indemnités assurance-invalidité',
    'Disability insurance daily allowances',
    'Indemnités de l’assurance-invalidité',
  ),
  ifd(
    '235',
    'Déduction pour double activité des conjoints',
    'Both spouses work: the federal deduction, a share of the lower earned income between a minimum and a maximum',
    'Double activité des conjoints : la déduction fédérale, une part du revenu le plus bas entre un minimum et un maximum',
    { ...MINUS, guide: 62 },
  ),
  ifd('240', '1er pilier Rentes AVS et AI', 'AVS and AI pensions', 'Rentes AVS et AI'),
  ifd(
    '250',
    '2e pilier Rentes provenant d’institutions de prévoyance professionnelle',
    'Pension fund pensions',
    'Rentes de la prévoyance professionnelle',
    { guide: 62 },
  ),
  ifdOut(
    '260',
    '3e pilier A Rentes provenant de la prévoyance individuelle liée',
    'Pillar 3a pensions',
    'Rentes du 3e pilier A',
  ),
  ifd(
    '270',
    '3e pilier B Autres rentes et pensions',
    'Other pensions',
    'Autres rentes et pensions',
  ),
  ifd(
    '280',
    'Pensions alimentaires obtenues',
    'Alimony and child support received',
    'Pensions alimentaires reçues',
  ),
  ifd(
    '300',
    'Primes et cotisations d’assurances et intérêts de capitaux d’épargne',
    'Insurance premiums, other contributions and savings interest together (the return’s 300, 340 and 480), at most the federal maximum for your family',
    'Primes d’assurances, autres cotisations et intérêts de l’épargne ensemble (codes 300, 340 et 480 de la déclaration), au plus le maximum fédéral selon votre famille',
    { ...MINUS, code: '300/340/480', guide: [62, 63] },
  ),
  ifd(
    '310',
    'Cotisations à des formes reconnues de prévoyance individuelle liée (pilier 3a)',
    'Pillar 3a',
    '3e pilier A',
    MINUS,
  ),
  ifd(
    '320',
    'Rachats d’années d’assurance (2e pilier)',
    'Pension fund buy-ins paid yourself',
    'Rachats de caisse de pension payés vous-même',
    MINUS,
  ),
  ifdOut(
    '330',
    'Cotisations des indépendants',
    'Contributions of the self-employed',
    'Cotisations des indépendants',
    MINUS,
  ),
  ifd(
    '410',
    'Titres et autres placements de capitaux',
    'Income from accounts and securities',
    'Rendement des comptes et titres',
    { guide: 63 },
  ),
  ifdOut(
    '445',
    'Autres revenus de fortune',
    'Other income from wealth',
    'Autres revenus de fortune',
  ),
  ifd(
    '490',
    'Frais d’administration des titres',
    'Costs of keeping securities',
    'Frais d’administration des titres',
    MINUS,
  ),
  ifdOut('495', 'Mises dans les loteries', 'Lottery stakes', 'Mises dans les loteries', {
    ...MINUS,
    guide: 63,
  }),
  ifdOut('500', 'Immeubles privés', 'Private property', 'Immeubles privés', { guide: 63 }),
  ifdOut(
    '530',
    'Droit d’habitation gratuit, sous-location',
    'A free right to live in a home, subletting',
    'Droit d’habitation gratuit, sous-location',
  ),
  ifdOut(
    '540',
    'Frais d’entretien d’immeubles privés',
    'Property upkeep costs',
    'Frais d’entretien d’immeubles',
    { ...MINUS, guide: 63 },
  ),
  ifd(
    '610',
    'Intérêts des dettes privées',
    'Interest on private debts, at most the federal limit',
    'Intérêts des dettes privées, au plus la limite fédérale',
    MINUS,
  ),
  ifd(
    '618',
    'Frais de perfectionnement et de formation',
    'Professional training, at most the federal maximum per person',
    'Formation et perfectionnement, au plus le maximum fédéral par personne',
    { ...MINUS, guide: 63 },
  ),
  ifd(
    '620',
    'Rentes et charges durables et versements à des partis politiques',
    'Payments to political parties, at most the federal maximum',
    'Versements aux partis politiques, au plus le maximum fédéral',
    { ...MINUS, guide: 63 },
  ),
  ifd(
    '630',
    'Pensions alimentaires versées',
    'Alimony and child support paid',
    'Pensions alimentaires versées',
    MINUS,
  ),
  ifdOut(
    '640',
    'Cotisations AVS, AI, APG ou AC versées par des personnes sans activité',
    'AVS contributions paid while not working',
    'Cotisations AVS sans activité lucrative',
    MINUS,
  ),
  ifd(
    '670',
    'Déduction pour frais de garde',
    'Childcare, at most the federal maximum per child',
    'Frais de garde, au plus le maximum fédéral par enfant',
    { ...MINUS, guide: 63 },
  ),
  ifd(
    '710',
    'Frais médicaux et dentaires - Frais liés à un handicap (montant à charge de l’annexe 05)',
    'Medical costs left to pay, in full (annex 05): the franchise is added back below',
    'Frais médicaux à votre charge, en entier (annexe 05) : la franchise est ajoutée plus bas',
    MINUS,
  ),
  ifd(
    'revenu-intermediaire-1',
    'Revenu intermédiaire I',
    'Intermediate income I: the income less the deductions down to 710',
    'Revenu intermédiaire I : les revenus moins les déductions jusqu’au code 710',
    TOTAL,
  ),
  ifd(
    '720',
    'Dons à des institutions d’utilité publique (maximum 20% du revenu intermédiaire I)',
    'Donations, at most 20 % of intermediate income I',
    'Dons, au plus 20 % du revenu intermédiaire I',
    MINUS,
  ),
  ifd(
    '730',
    'Revenu intermédiaire II',
    'Intermediate income II: intermediate income I less the donations',
    'Revenu intermédiaire II : le revenu intermédiaire I moins les dons',
    TOTAL,
  ),
  ifd(
    'franchise-medicale',
    'Franchise frais médicaux (revenu intermédiaire II x 5/95)',
    'Medical costs threshold, added back: intermediate income II x 5/95, at most the medical costs deducted under 710',
    'Franchise des frais médicaux, ajoutée : revenu intermédiaire II x 5/95, au plus les frais médicaux déduits au code 710',
    { guide: 62 },
  ),
  ifd(
    'deduction-maries',
    'Déductions sociales : pour les personnes mariées/personnes liées par un partenariat enregistré vivant en ménage commun',
    'Married couple deduction (federal)',
    'Déduction pour les personnes mariées (fédérale)',
    { ...MINUS, guide: 64 },
  ),
  ifd(
    'deduction-enfants',
    'Déductions sociales : par enfant à charge',
    'Child deduction, for each child you support (federal)',
    'Déduction par enfant à charge (fédérale)',
    { ...MINUS, guide: 64 },
  ),
  ifdOut(
    'deduction-personnes',
    'Déductions sociales : par personne nécessiteuse à charge',
    'A person in need you support',
    'Personne nécessiteuse à charge',
    { ...MINUS, guide: 64 },
  ),
  ifd(
    'revenu-imposable',
    'Revenu imposable',
    'Taxable income, federal tax',
    'Revenu imposable, impôt fédéral direct',
    TOTAL,
  ),
];

// ---- Pages --------------------------------------------------------------------------------------

const section = (id: string, title: string, en: string, fr: string) => ({
  id,
  title: frTypo(title),
  gloss: g(en, fr),
});

function pages(year: number): FormPage<VdPageId>[] {
  const page = (
    id: VdPageId,
    title: string,
    en: string,
    fr: string,
    pdfPage: number,
    source: string,
    sections: FormPage<VdPageId>['sections'],
  ): FormPage<VdPageId> => ({
    id,
    title: frTypo(title),
    gloss: g(en, fr),
    pdfPage,
    supported: true,
    sections,
    source,
  });
  return [
    page(
      'P2',
      `Revenu en Suisse et à l’étranger ${year}`,
      'Page 2: income, a column per taxpayer',
      'Page 2 : revenus, une colonne par contribuable',
      2,
      AT.P2,
      [
        section(
          'salariees',
          'Activités salariées - annexes 03 et 04',
          'Salaried work',
          'Activités salariées',
        ),
        section(
          'independantes',
          'Activités indépendantes',
          'Self-employment',
          'Activités indépendantes',
        ),
        section('autres', 'Autres revenus de toute nature', 'Other income', 'Autres revenus'),
        section(
          'perte-de-gain',
          'Indemnités pour perte de gain',
          'Benefits replacing a salary',
          'Indemnités pour perte de gain',
        ),
        section('rentes', 'Rentes et pensions', 'Pensions', 'Rentes et pensions'),
        section(
          'primes',
          'Primes et cotisations d’assurances',
          'Insurance premiums and pension contributions',
          'Primes d’assurances et cotisations de prévoyance',
        ),
        section('total', 'Total par contribuable', 'Totals', 'Totaux'),
      ],
    ),
    page(
      'P3',
      `Revenu et fortune en Suisse et à l’étranger ${year}`,
      'Page 3: income from wealth, wealth, deductions and the taxable income and wealth',
      'Page 3 : revenus de la fortune, fortune, déductions, revenu et fortune imposables',
      2,
      AT.P3,
      [
        section(
          'fortune',
          'Titres et autres éléments de la fortune',
          'Securities and other assets',
          'Titres et autres éléments de fortune',
        ),
        section(
          'immeubles',
          'Immeubles, terrains et forêts (annexe 07)',
          'Property (not supported)',
          'Immeubles (non pris en charge)',
        ),
        section(
          'dettes',
          'Intérêts et dettes (annexe 02)',
          'Debts and interest',
          'Dettes et intérêts',
        ),
        section(
          'deductions',
          'Déductions spéciales sur le revenu',
          'Other deductions, down to the intermediate income',
          'Autres déductions, jusqu’au revenu intermédiaire',
        ),
        section(
          'intermediaires',
          'Revenu / fortune intermédiaires',
          'Intermediate income, medical costs, donations, family',
          'Revenu intermédiaire, frais médicaux, dons, famille',
        ),
        section(
          'imposable',
          'Revenu imposable et fortune imposable',
          'Taxable income and wealth, parts and rate',
          'Revenu et fortune imposables, parts et taux',
        ),
      ],
    ),
    page(
      'P4',
      `Informations complémentaires ${year}`,
      'Page 4: alimony in detail, premiums and subsidies, other questions',
      'Page 4 : détail des pensions alimentaires, primes et subsides, autres questions',
      1,
      AT.P4,
      [
        section(
          '1',
          'Détail des pensions alimentaires reçues et / ou versées',
          'Alimony received (1A) and paid (1B)',
          'Pensions alimentaires reçues (1A) et versées (1B)',
        ),
        section(
          '2',
          'Détail des prestations en capital provenant de la prévoyance et autres assurances privées / bénéfice de liquidation',
          'Lump sums (not supported)',
          'Prestations en capital (non prises en charge)',
        ),
        section(
          '3',
          'Versements de capitaux remplaçant des prestations périodiques et autres prestations',
          'Lump sums replacing regular payments (not supported)',
          'Capitaux remplaçant des prestations périodiques (non pris en charge)',
        ),
        section(
          '6',
          'Donations, avances d’hoirie, successions et héritages',
          'Gifts and inheritances (not supported)',
          'Donations et successions (non prises en charge)',
        ),
        section(
          '8',
          'Rentes provenant d’institutions de prévoyance professionnelle (2e pilier)',
          'Pension fund pensions: when you joined',
          'Rentes du 2e pilier : date d’affiliation',
        ),
        section(
          '9',
          'Cotisations pour la prévoyance professionnelle (2e pilier)',
          'Pension fund contributions',
          'Cotisations au 2e pilier',
        ),
        section(
          '10',
          'Primes, cotisations d’assurances et subsides',
          'Insurance premiums and subsidies',
          'Primes d’assurances et subsides',
        ),
      ],
    ),
    page(
      'A01',
      `Annexe 01 ${year}, état des titres et autres placements de capitaux`,
      'Annex 01: your accounts and securities, their income and value',
      'Annexe 01 : vos comptes et titres, leur rendement et leur valeur',
      1,
      AT.A01,
      [
        section(
          '1',
          'Comptes et livrets bancaires, postaux, comptes garantie de loyer / leasing',
          'Bank and postal accounts',
          'Comptes bancaires et postaux',
        ),
        section(
          '2',
          'Titres et rendements soumis (2/A) et non soumis (2/B) à l’impôt anticipé',
          'Securities',
          'Titres',
        ),
        section('totaux', 'Totaux', 'Totals carried to 410', 'Totaux reportés sous le code 410'),
        section(
          'imputation',
          'Décompte de l’impôt anticipé, de la retenue supplémentaire d’impôt USA et de l’imputation forfaitaire',
          'Withholding tax refund (not supported)',
          'Remboursement de l’impôt anticipé (non pris en charge)',
        ),
      ],
    ),
    page(
      'A02',
      `Annexe 02 ${year}, dettes, rendements négatifs de placements de capitaux, assurances`,
      'Annex 02: your debts and life insurance',
      'Annexe 02 : vos dettes et assurances sur la vie',
      1,
      AT.A02,
      [
        section(
          'A',
          'A. Dettes privées et rendements négatifs de placements des capitaux privés',
          'Private debts',
          'Dettes privées',
        ),
        section(
          'B',
          'B. Dettes d’exploitation et rendements négatifs de placements de capitaux d’exploitation',
          'Business debts (not supported)',
          'Dettes commerciales (non prises en charge)',
        ),
        section('C', 'C. Assurances sur la vie', 'Life insurance', 'Assurances sur la vie'),
      ],
    ),
    page(
      'A03',
      `Annexe 03 ${year}, situation familiale, relevé des certificats de salaire`,
      'Annex 03: your children, your household and your salary certificates',
      'Annexe 03 : vos enfants, votre ménage et vos certificats de salaire',
      1,
      AT.A03,
      [
        section(
          'famille',
          `Situation de famille au 31 décembre ${year} ou à la fin de l’assujettissement`,
          'Family on 31 December',
          'Famille au 31 décembre',
        ),
        section(
          'certificats',
          `Relevé des certificats de salaire ${year} (à l’exclusion des attestations de rentes)`,
          'Your salary certificates, one per line',
          'Vos certificats de salaire, un par ligne',
        ),
      ],
    ),
    page(
      'A04',
      `Annexe 04 ${year}, frais professionnels des salariés-es, frais de formation`,
      'Annex 04: professional costs and training, contribuable 1 on the front, contribuable 2 on the back',
      'Annexe 04 : frais professionnels et formation, contribuable 1 au recto, contribuable 2 au verso',
      1,
      AT.A04,
      [
        section('transport', 'Frais de transport', 'Travel to work', 'Frais de transport'),
        section(
          'repas',
          'Frais de repas (A) et de résidence hors du domicile (B)',
          'Meals away from home',
          'Repas hors du domicile',
        ),
        section(
          'autres',
          'Autres frais professionnels',
          'Other professional costs',
          'Autres frais professionnels',
        ),
        section(
          'interruption',
          'Périodes d’interruption de travail',
          'Breaks in work (not supported)',
          'Interruptions de travail (non prises en charge)',
        ),
        section(
          'formation',
          'Frais de perfectionnement et de formation',
          'Professional training',
          'Formation et perfectionnement',
        ),
      ],
    ),
    page(
      'A05',
      `Annexe 05 ${year}, frais médicaux et dentaires, frais liés à un handicap, dons`,
      'Annex 05: medical costs, political parties and donations',
      'Annexe 05 : frais médicaux, partis politiques et dons',
      1,
      AT.A05,
      [
        section(
          '710',
          'Frais médicaux et dentaires - frais liés à un handicap',
          'Medical and dental costs',
          'Frais médicaux et dentaires',
        ),
        section(
          '620',
          'Déductions spéciales sur le revenu - Détail du code 620',
          'Political parties',
          'Partis politiques',
        ),
        section('720', 'Dons à des institutions d’utilité publique', 'Donations', 'Dons'),
      ],
    ),
    page(
      'IFD',
      `Impôt fédéral direct ${year}, détermination du revenu imposable`,
      'The guide’s worksheet for the federal tax: no form to file, VaudTax works it out; check its lines',
      'La feuille de calcul du guide pour l’impôt fédéral direct : aucune formule à remplir, VaudTax le calcule ; vérifiez ses lignes',
      65,
      AT.IFD,
      [
        section(
          'determination',
          'Impôt fédéral direct - Détermination du revenu imposable',
          'Federal taxable income',
          'Revenu imposable fédéral',
        ),
      ],
    ),
  ];
}

function rubrics(year: number): FormRubric<VdPageId>[] {
  return [...P2, ...P3, ...P4, ...A01, ...A02, ...A03, ...A04, ...annex05(year), ...IFD];
}

/**
 * The form's codes and terms are the 2025 return's until the 2026 return is published
 * (docs/sources/vd/NOTES.md, Gaps): shown with a Vaud return for 2026.
 */
export const VD_FORM_NOTE: Text = {
  en: 'The codes and French terms come from the 2025 Vaud return (vd-2025-form-21010) and its guide (vd-2025-guide): the 2026 return is not published yet, so check each line on yours.',
  fr: 'Les codes et les termes viennent de la déclaration vaudoise 2025 (vd-2025-form-21010) et de son guide (vd-2025-guide) : la déclaration 2026 n’est pas encore publiée, vérifiez donc chaque ligne sur la vôtre.',
  de: 'Die Codes und französischen Begriffe stammen aus der Waadtländer Steuererklärung 2025 (vd-2025-form-21010) und ihrer Wegleitung (vd-2025-guide): Die Erklärung 2026 ist noch nicht veröffentlicht, prüfe also jede Zeile auf deiner.',
};

export const FORM_VD_2025: FormMap<VdPageId> = {
  taxYear: 2025,
  formYear: 2025,
  provisional: false,
  pages: pages(2025),
  rubrics: rubrics(2025),
};

/** Tax year 2026: the 2026 return is not published yet, so its pages are 2025's, provisional. */
export const FORM_VD_2026: FormMap<VdPageId> = {
  taxYear: 2026,
  formYear: 2025,
  provisional: true,
  note: VD_FORM_NOTE,
  pages: pages(2026),
  rubrics: rubrics(2026),
};

export function vaudFormMap(taxYear: number): FormMap<VdPageId> {
  if (taxYear === 2025) return FORM_VD_2025;
  if (taxYear === 2026) return FORM_VD_2026;
  throw new Error(`No Vaud form map for ${taxYear}.`);
}
