// The Geneva declaration for individuals, tax year 2025, as printed: every page in the official
// order (main form PG1 to PG4, then annexes A to G), every section, and every rubric with its code
// and its French label exactly as printed.
//
// Sources (docs/sources/ge/manifest.json):
// - ge-2025-declaration-specimen: the official 2025 form (spécimen of the handwritten declaration).
//   PDF page n is one form page: 1 PG1, 2 PG2, 3 PG3, 4 PG4, 5 A1, 6 A2, 7 to 10 B1 to B4,
//   11 to 14 C1 to C4, 15 to 18 D1 to D4, 19 E1, 20 E2, 21 to 24 F1 to F4, 25 G1, 26 G2.
// - ge-2025-guide-declaration-pp: the official guide, which explains each rubric by its code.
//   Where the form prints no label of its own (11.10, 52.11, 53.10, 54.10), the label is the
//   guide's title for that code.
// Labels keep the form's spelling ("2ème", "Etat des titres", apostrophes ’).
//
// Self-employment (annexe B): the simple case of SPEC.md section 1 (a sole proprietorship), one
// sheet per taxpayer; its lines for partnerships and the cases Taxpresso doesn't prepare are listed,
// not supported. Property (annexe D) is out of scope for now: its pages are listed, its totals on
// the main form are marked unsupported, its own rubrics come with its phase.
import type {
  FormColumn,
  FormMap,
  FormPage,
  FormPageId,
  FormPerson,
  FormRubric,
  Gloss,
  LineField,
} from '../form.js';

const SPEC = 'ge-2025-declaration-specimen';
const GUIDE = 'ge-2025-guide-declaration-pp';

/** "ge-2025-declaration-specimen p. 5; ge-2025-guide-declaration-pp p. 17" */
const cite = (pdfPage: number, guide?: number | string) =>
  `${SPEC} p. ${pdfPage}${guide !== undefined ? `; ${GUIDE} p. ${guide}` : ''}`;

type Options = Partial<
  Pick<
    FormRubric,
    | 'person'
    | 'nature'
    | 'role'
    | 'format'
    | 'columns'
    | 'parts'
    | 'repeats'
    | 'lineFields'
    | 'csBox'
    | 'supported'
  >
> & { guide?: number | string };

const CODE = /^\d{2}\.\d{2}$/;

/** French typography: a no-break space before a colon. */
const frTypo = (s: string) => s.replace(/ ?: /g, '\u00a0: ');

/** A rubric maker for one section of one page, with that section's defaults. */
function on(page: FormPageId, pdfPage: number, section: string, defaults: Options) {
  return (key: string, label: string, en: string, fr: string, options: Options = {}) => {
    const o = { ...defaults, ...options };
    const rubric: FormRubric = {
      key,
      ...(CODE.test(key) ? { code: key } : {}),
      page,
      section,
      person: o.person ?? 'household',
      label,
      gloss: { en, fr: frTypo(fr) },
      nature: o.nature ?? 'income',
      role: o.role ?? 'input',
      format: o.format ?? 'money',
      columns: o.columns ?? [],
      ...(o.parts ? { parts: o.parts } : {}),
      ...(o.repeats ? { repeats: o.repeats } : {}),
      ...(o.lineFields ? { lineFields: o.lineFields } : {}),
      ...(o.csBox ? { csBox: o.csBox } : {}),
      supported: o.supported ?? true,
      source: cite(pdfPage, o.guide),
    };
    return rubric;
  };
}

const ICC_IFD: readonly FormColumn[] = ['icc', 'ifd'];
const BOTH: readonly FormColumn[] = ['icc_ifd'];
const WEALTH: readonly FormColumn[] = ['wealth'];
const ABE = ['A', 'B', 'children'] as const;
const AB = ['A', 'B'] as const;
const TITRES: readonly FormColumn[] = [
  'ia_subject',
  'ia_free',
  'value',
  'fees',
  'savings_interest',
];

const g = (en: string, fr: string): Gloss => ({ en, fr: frTypo(fr) });

// --- Main form: PG1 to PG4 -------------------------------------------------------------------

const pg1 = on('PG1', 1, 'adresse', { nature: 'identity', format: 'text' });
const PG1 = [
  pg1(
    'PG1-COMMUNE',
    'Code commune',
    'Code of your commune on 31 December (political commune, which can differ from your postal address)',
    'Code de votre commune au 31 décembre (commune politique, qui peut différer de l’adresse postale)',
    { guide: '12 and 59' },
  ),
];

const pg2 = on('PG2', 2, 'revenu', { role: 'report', columns: ICC_IFD });
const pg2r = on('PG2', 2, 'renseignements', { nature: 'info', columns: ['amount'], guide: 13 });
const PG2 = [
  pg2(
    '11.00',
    'Revenu brut de l’activité dépendante',
    'Salaried income, taxpayer A (from A1)',
    'Revenu salarié, contribuable A (de A1)',
    { person: 'A' },
  ),
  pg2(
    '21.00',
    'Revenu brut de l’activité dépendante',
    'Salaried income, taxpayer B (from A2)',
    'Revenu salarié, contribuable B (de A2)',
    { person: 'B' },
  ),
  pg2(
    '12.00',
    'Revenu de l’activité indépendante',
    'Self-employed income (from B2)',
    'Revenu indépendant (de B2)',
  ),
  pg2(
    '13.00',
    'Revenu brut provenant de prestations Rentes, pensions',
    'Pensions and other benefits (from C1)',
    'Rentes et pensions (de C1)',
  ),
  pg2(
    '14.00',
    'Revenu brut mobilier',
    'Income from accounts and securities (from F1)',
    'Revenus des comptes et titres (de F1)',
  ),
  pg2(
    '15.00',
    'Revenu brut immobilier',
    'Income from property (from D)',
    'Revenus des immeubles (de D)',
    { supported: false },
  ),
  pg2('16.00', 'Autres revenus', 'Other income (from C2)', 'Autres revenus (de C2)'),
  pg2('17.00', 'Rentes AVS/AI', 'AVS/AI pensions (from C1)', 'Rentes AVS/AI (de C1)'),
  pg2(
    '91.00',
    'Revenu brut',
    'Gross income, all of the above',
    'Revenu brut, tout ce qui précède',
    { role: 'total' },
  ),
  pg2r(
    '98.10',
    'Versements provenant d’assurances de capitaux privées susceptibles de rachat',
    'Payouts from private life insurance with a surrender value',
    'Versements d’assurances-vie privées rachetables',
  ),
  pg2r(
    '98.12',
    'Prestations en capital du 2ème et 3ème pilier A imposées au 1/5ème du barème',
    'Lump sums from your pension fund or pillar 3a (taxed separately)',
    'Capitaux du 2e pilier ou du 3e pilier A (imposés à part)',
  ),
  pg2r(
    '98.20',
    'Bourses délivrées par le Service des bourses et prêts d’études',
    'Study grants from the cantonal grants office (SBPE)',
    'Bourses d’études du SBPE',
  ),
  pg2r(
    '98.30',
    'Pensions alimentaires perçues par l’enfant majeur',
    'Maintenance received by an adult child, after they came of age',
    'Pension alimentaire reçue par un enfant majeur',
    { guide: 25 },
  ),
  pg2r(
    '98.40',
    'Prestations complémentaires AVS/AI (SPC)',
    'AVS/AI supplementary benefits (SPC)',
    'Prestations complémentaires AVS/AI du SPC',
  ),
  pg2r(
    '98.41',
    'Autres prestations complémentaires de la ville de Genève',
    'Supplementary benefits from the City of Geneva',
    'Prestations complémentaires de la Ville de Genève',
  ),
  pg2r('98.42', 'Allocations pour impotents', 'Helplessness allowance', 'Allocation pour impotent'),
  pg2r(
    '98.43',
    'Prestations complémentaires familiales (SPC)',
    'Family supplementary benefits (SPC)',
    'Prestations complémentaires familiales du SPC',
  ),
  pg2r(
    '98.44',
    'Prestations transitoires pour chômeurs âgés',
    'Bridging benefits for older unemployed people',
    'Prestations transitoires pour chômeurs âgés',
    { guide: 14 },
  ),
  pg2r(
    '98.50',
    'Solde du service militaire et indemnité de fonction de la protection civile',
    'Military pay and civil protection allowance',
    'Solde militaire et indemnité de protection civile',
  ),
  pg2r(
    '98.60',
    'Prestations de l’assurance militaire exonérées en vertu de la loi fédérale sur l’assurance militaire',
    'Tax-free military insurance benefits',
    'Prestations exonérées de l’assurance militaire',
    { guide: 26 },
  ),
  pg2r(
    '98.70',
    'Versements à titre de réparation de tort moral',
    'Compensation for moral damage',
    'Indemnités pour tort moral',
    { guide: 26 },
  ),
  pg2r(
    '98.75',
    'Indemnités en capital imposées au 1/5ème du barème',
    'Capital indemnities taxed separately',
    'Indemnités en capital imposées à part',
  ),
  pg2r(
    '98.80',
    'Aide sociale de l’Hospice général',
    'Social assistance from the Hospice général',
    'Aide sociale de l’Hospice général',
    { guide: 14 },
  ),
  pg2r(
    '98.81',
    'Dons versés par une commune, un autre canton, un organisme public ou une institution privée',
    'Gifts received from a public or private body',
    'Dons reçus d’un organisme public ou privé',
    { guide: 14 },
  ),
  pg2r(
    '98.90',
    'Revenu provenant d’une activité lucrative d’un (des) enfant(s) mineur(s)',
    'Earnings of your children under 18',
    'Revenus du travail de vos enfants mineurs',
  ),
  pg2r(
    '98.95',
    'Revenus bruts déjà imposés selon la procédure simplifiée prévue par la Loi sur le travail au noir',
    'Income already taxed under the simplified procedure (undeclared work law)',
    'Revenus déjà imposés selon la procédure simplifiée',
  ),
  pg2r(
    '98.96',
    'Gain de loterie ou de casino exonéré au sens de la loi fédérale sur les jeux d’argent (LJAr)',
    'Tax-free lottery or casino winnings',
    'Gains de loterie ou de casino exonérés',
    { guide: 42 },
  ),
  pg2r('98.00', 'Total', 'Total of the information above', 'Total des renseignements', {
    role: 'total',
  }),
];

const pg3 = on('PG3', 3, 'deductions', { nature: 'deduction', role: 'report', columns: ICC_IFD });
const PG3 = [
  pg3('91.00', 'Revenu brut', 'Gross income (from PG2)', 'Revenu brut (de PG2)', {
    nature: 'income',
  }),
  pg3(
    '31.00',
    'Déductions liées à l’activité dépendante',
    'Deductions for salaried work, taxpayer A (from A1)',
    'Déductions du travail salarié, contribuable A (de A1)',
    { person: 'A' },
  ),
  pg3(
    '41.00',
    'Déductions liées à l’activité dépendante',
    'Deductions for salaried work, taxpayer B (from A2)',
    'Déductions du travail salarié, contribuable B (de A2)',
    { person: 'B' },
  ),
  pg3(
    '32.00',
    'Déductions liées à l’activité indépendante',
    'Deductions for self-employment (from B4)',
    'Déductions du travail indépendant (de B4)',
  ),
  pg3(
    '56.20',
    'Déductions liées aux revenus mobiliers',
    'Bank and custody fees (from F1)',
    'Frais bancaires et de garde (de F1)',
  ),
  pg3(
    '58.00',
    'Charges et frais d’entretien d’immeuble(s)',
    'Property costs (from D)',
    'Frais d’immeubles (de D)',
    { supported: false },
  ),
  pg3(
    '58.01',
    'Frais immobiliers reportés',
    'Property costs carried over (from D4)',
    'Frais d’immeubles reportés (de D4)',
    { supported: false },
  ),
  pg3(
    '33.00',
    'Déductions liées aux rentes de la prévoyance professionnelle',
    'Deduction on pension fund pensions (from C4)',
    'Déduction sur les rentes du 2e pilier (de C4)',
  ),
  pg3('59.00', 'Autres déductions', 'Other deductions (from C4)', 'Autres déductions (de C4)'),
  pg3(
    '52.00',
    'Primes d’assurances',
    'Insurance premiums (from C3)',
    'Primes d’assurances (de C3)',
  ),
  pg3(
    '53.00',
    'Pensions, contributions d’entretien versées',
    'Maintenance you paid (from C4)',
    'Pensions alimentaires versées (de C4)',
  ),
  pg3(
    '54.00',
    'Rentes viagères payées',
    'Life annuities you paid (from C3)',
    'Rentes viagères payées (de C3)',
  ),
  pg3(
    '55.00',
    'Intérêts chirographaires et hypothécaires',
    'Interest on your debts (from E1)',
    'Intérêts de vos dettes (de E1)',
  ),
  pg3(
    '57.00',
    'Pertes commerciales et/ou pertes non compensées',
    'Business losses (from B2)',
    'Pertes commerciales (de B2)',
  ),
  pg3(
    '92.20',
    'Sous-total ICC + IFD pour la déduction des frais médicaux',
    'Subtotal used for the medical costs threshold',
    'Sous-total servant au seuil des frais médicaux',
    { role: 'total', guide: 14 },
  ),
  pg3(
    '71.00',
    'Frais médicaux',
    'Medical costs you paid yourself, after your health insurer’s share',
    'Frais médicaux restés à votre charge, après la part de la caisse maladie',
    { role: 'input', parts: ABE, guide: 14 },
  ),
  pg3(
    '92.40',
    'Sous-total ICC + IFD pour la déduction des dons et du calcul de la déduction pour bénéficiaires de rentes AVS/AI',
    'Subtotal used for the donations limit and the AVS/AI pensioners deduction',
    'Sous-total servant à la limite des dons et à la déduction des rentiers AVS/AI',
    { role: 'total', guide: 15 },
  ),
  pg3('73.00', 'Versements bénévoles et dons', 'Donations', 'Dons', {
    role: 'input',
    parts: ABE,
    guide: 15,
  }),
  pg3(
    '74.00',
    'Versements aux partis politiques',
    'Payments to political parties',
    'Versements aux partis politiques',
    { role: 'input', parts: AB, guide: 15 },
  ),
  pg3(
    '61.20',
    'Charges de famille IFD',
    'Family deduction, federal tax',
    'Déduction pour charges de famille, impôt fédéral',
    { role: 'computed', columns: ['ifd'], guide: 15 },
  ),
  pg3(
    '61.25',
    'Charges de famille ICC',
    'Family deduction, Geneva tax',
    'Déduction pour charges de famille, impôt cantonal',
    { role: 'computed', columns: ['icc'], guide: 15 },
  ),
  pg3(
    '61.30',
    'Déduction pour bénéficiaires de rentes AVS/AI',
    'Deduction for AVS/AI pensioners',
    'Déduction pour rentiers AVS/AI',
    { role: 'computed', columns: ['icc'], guide: 16 },
  ),
  pg3('95.00', 'Revenu net total', 'Total net income', 'Revenu net total', {
    role: 'computed',
    nature: 'income',
  }),
  pg3(
    '97.00',
    'Part proportionnelle du revenu non imposable',
    'Share of income not taxable in Geneva',
    'Part du revenu non imposable à Genève',
    { role: 'computed', nature: 'income' },
  ),
  pg3('99.00', 'Revenu imposable', 'Taxable income', 'Revenu imposable', {
    role: 'computed',
    nature: 'income',
  }),
];

const pg4 = on('PG4', 4, 'fortune', { nature: 'wealth', role: 'report', columns: WEALTH });
const pg4d = on('PG4', 4, 'deductions-fortune', {
  nature: 'wealth',
  role: 'report',
  columns: WEALTH,
});
const PG4 = [
  pg4(
    '12.00',
    'Actifs commerciaux bruts et/ou fonds propres',
    'Business assets (from B2)',
    'Actifs commerciaux (de B2)',
  ),
  pg4(
    '14.00',
    'Fortune brute mobilière',
    'Accounts and securities on 31 December (from F1)',
    'Comptes et titres au 31 décembre (de F1)',
  ),
  pg4('15.00', 'Fortune brute immobilière', 'Property (from D)', 'Immeubles (de D)', {
    supported: false,
  }),
  pg4(
    '16.70',
    'Valeur de rachat des assurances-vie',
    'Surrender value of life insurance (from C3)',
    'Valeur de rachat des assurances-vie (de C3)',
  ),
  pg4('16.00', 'Autres éléments de fortune', 'Other assets (from C2)', 'Autres biens (de C2)'),
  pg4(
    '91.00',
    'Fortune brute',
    'Gross wealth, all of the above',
    'Fortune brute, tout ce qui précède',
    { role: 'total' },
  ),
  pg4d(
    '55.00',
    'Dettes chirographaires et hypothécaires',
    'Your debts on 31 December (from E1)',
    'Vos dettes au 31 décembre (de E1)',
  ),
  pg4d(
    '57.00',
    'Passifs commerciaux et/ou découvert commercial',
    'Business debts (from B2)',
    'Dettes commerciales (de B2)',
  ),
  pg4d(
    '51.60',
    'Déduction sur la fortune commerciale investie',
    'Deduction on business assets, taxpayer A',
    'Déduction sur la fortune commerciale, contribuable A',
    { person: 'A', role: 'computed', guide: 16 },
  ),
  pg4d(
    '51.60',
    'Déduction sur la fortune commerciale investie',
    'Deduction on business assets, taxpayer B',
    'Déduction sur la fortune commerciale, contribuable B',
    { person: 'B', role: 'computed', guide: 16 },
  ),
  pg4d(
    '51.62',
    'Déduction sur la fortune (brevets et droits comparables)',
    'Deduction for patents and similar rights',
    'Déduction pour brevets et droits comparables',
    { role: 'computed', supported: false, guide: 16 },
  ),
  pg4d(
    '51.50',
    'Déduction sociale sur la fortune',
    'Personal wealth allowance',
    'Déduction sociale sur la fortune',
    { role: 'computed', guide: 16 },
  ),
  pg4d('95.00', 'Fortune nette totale', 'Total net wealth', 'Fortune nette totale', {
    role: 'computed',
  }),
  pg4d(
    '97.00',
    'Part proportionnelle de la fortune non-imposable',
    'Share of wealth not taxable in Geneva',
    'Part de la fortune non imposable à Genève',
    { role: 'computed' },
  ),
  pg4d('99.00', 'Fortune imposable', 'Taxable wealth', 'Fortune imposable', { role: 'computed' }),
];

// --- Annexe A: salaried work, one page per taxpayer -----------------------------------------

const EMPLOYER_LINE: readonly LineField[] = [
  { id: 'employer', label: 'Nom de l’employeur – Adresse du lieu de travail', format: 'text' },
  { id: 'rate', label: 'Taux d’activité %', format: 'percent' },
  {
    id: 'commune',
    label: 'Code commune',
    format: 'text',
    hint: g(
      'Code of the commune where you work; if you work in another canton, your home commune',
      'Code de la commune où vous travaillez; si vous travaillez dans un autre canton, celui de votre commune de domicile',
    ),
    source: `${GUIDE} p. 17`,
  },
];

/**
 * Annexe A for one taxpayer. A2 repeats A1 for contribuable B with codes 21.xx and 41.xx
 * (ge-2025-declaration-specimen p. 5 and p. 6).
 */
function annexA(page: 'A1' | 'A2', pdfPage: number, person: FormPerson): FormRubric[] {
  const c = (code: string) =>
    person === 'B' ? `${Number(code.slice(0, 1)) + 1}${code.slice(1)}` : code;
  const who =
    person === 'A' ? g('taxpayer A', 'contribuable A') : g('taxpayer B', 'contribuable B');
  const rev = on(page, pdfPage, 'revenu', { person, columns: BOTH, guide: 17 });
  const info = on(page, pdfPage, 'autres-renseignements', {
    person,
    nature: 'info',
    columns: ['amount'],
    guide: 18,
  });
  const ded = on(page, pdfPage, 'deductions', { person, nature: 'deduction', columns: ICC_IFD });
  return [
    rev(
      c('11.10'),
      'Salaires bruts',
      'Salary (box 1 of your salary certificate), one line per employer',
      'Salaire (chiffre 1 du certificat de salaire), une ligne par employeur',
      { csBox: '1', repeats: 2, lineFields: EMPLOYER_LINE },
    ),
    rev(
      c('11.12'),
      'Prestations salariales accessoires',
      'Benefits in kind (box 2: board and lodging, company car, other)',
      'Prestations accessoires (chiffre 2: pension, voiture de service, autres)',
      { csBox: '2', guide: undefined },
    ),
    rev(
      c('11.15'),
      'Bonus, gratification',
      'Bonus and one-off payments (box 3)',
      'Bonus et prestations non périodiques (chiffre 3)',
      { csBox: '3' },
    ),
    rev(
      c('11.30'),
      'Tantièmes, jetons de présence, etc.',
      'Board fees (box 6)',
      'Indemnités de conseil d’administration (chiffre 6)',
      { csBox: '6' },
    ),
    rev(
      c('11.40'),
      'Actions et/ou options de collaborateur',
      'Employee shares or options (box 5)',
      'Actions ou options de collaborateur (chiffre 5)',
      { csBox: '5' },
    ),
    rev(
      c('11.50'),
      'Perte de salaire, chômage, maladie, accident, militaire',
      'Benefits paid to you directly: unemployment, sickness, accident, military service',
      'Indemnités reçues directement: chômage, maladie, accident, service militaire',
    ),
    rev(
      c('11.60'),
      'Vacances, ponts, jours fériés, intempéries, prestations en nature',
      'Other payments from your employer (box 7)',
      'Autres prestations de l’employeur (chiffre 7)',
      { csBox: '7' },
    ),
    rev(
      c('11.70'),
      'Prestations en capital',
      'Capital payments, such as a severance payment (box 4)',
      'Prestations en capital, par exemple une indemnité de départ (chiffre 4)',
      { csBox: '4', guide: '17 and 18' },
    ),
    rev(
      c('11.00'),
      'Total',
      `Total salaried income, ${who.en}`,
      `Total du revenu salarié, ${who.fr}`,
      { role: 'total', guide: undefined },
    ),
    info(
      c('11.90'),
      'Frais de représentation',
      'Flat allowance for representation (box 13.2.1)',
      'Forfait pour frais de représentation (chiffre 13.2.1)',
      { csBox: '13.2.1' },
    ),
    info(
      c('11.91'),
      'Frais de voiture',
      'Flat allowance for your car (box 13.2.2)',
      'Forfait pour frais de voiture (chiffre 13.2.2)',
      { csBox: '13.2.2' },
    ),
    info(
      c('11.92'),
      'Autres frais',
      'Other flat allowances (box 13.2.3)',
      'Autres forfaits pour frais (chiffre 13.2.3)',
      { csBox: '13.2.3' },
    ),
    info(
      'CS-G',
      'Contribution aux frais de repas',
      'Your employer pays part of your meals: tick box G (box G is ticked on your certificate)',
      'Votre employeur paie une partie de vos repas: cochez la case G (case G cochée sur le certificat)',
      { csBox: 'G', format: 'tick', columns: [] },
    ),
    info(
      'CS-F',
      'Transports gratuits',
      'Free transport to work: tick box F (box F is ticked on your certificate)',
      'Transport gratuit pour aller au travail: cochez la case F (case F cochée sur le certificat)',
      { csBox: 'F', format: 'tick', columns: [] },
    ),
    ded(
      c('31.10'),
      'Cotisations AVS/AI, APG, Chômage, AANP, Amat',
      'Social insurance contributions (box 9)',
      'Cotisations aux assurances sociales (chiffre 9)',
      { csBox: '9', guide: 18 },
    ),
    ded(
      c('31.12'),
      'Prévoyance 2ème pilier Cotisations',
      'Pension fund contributions (box 10.1)',
      'Cotisations au 2e pilier (chiffre 10.1)',
      { csBox: '10.1', guide: 18 },
    ),
    ded(
      c('31.20'),
      'Déduction forfaitaire pour frais professionnels IFD',
      'Flat deduction for work expenses, federal tax',
      'Déduction forfaitaire des frais professionnels, impôt fédéral',
      { role: 'computed', columns: ['ifd'], guide: 19 },
    ),
    ded(
      c('31.50'),
      'Déduction forfaitaire pour frais professionnels ICC',
      'Flat deduction for work expenses, Geneva tax',
      'Déduction forfaitaire des frais professionnels, impôt cantonal',
      { role: 'computed', columns: ['icc'], guide: 19 },
    ),
    ded(
      c('31.30'),
      'Rachat(s) de la prévoyance professionnelle',
      'Pension fund buy-ins (box 10.2, or the fund’s attestation)',
      'Rachats au 2e pilier (chiffre 10.2, ou attestation de la caisse)',
      { csBox: '10.2', guide: 18 },
    ),
    ded(
      c('31.40'),
      'Cotisations au 3ème pilier A',
      'Payments into pillar 3a',
      'Versements au 3e pilier A',
      { guide: 18 },
    ),
    ded(
      c('31.60'),
      'Déduction pour frais professionnels effectifs Frais de repas',
      'Actual work expenses: meals',
      'Frais professionnels effectifs: repas',
      { guide: 19 },
    ),
    ded(
      c('31.70'),
      'Déduction pour frais professionnels effectifs Frais de déplacements ICC',
      'Actual work expenses: travel, Geneva tax',
      'Frais professionnels effectifs: déplacements, impôt cantonal',
      { columns: ['icc'], guide: 19 },
    ),
    ded(
      c('31.71'),
      'Déduction pour frais professionnels effectifs Frais de déplacements IFD',
      'Actual work expenses: travel, federal tax',
      'Frais professionnels effectifs: déplacements, impôt fédéral',
      { columns: ['ifd'], guide: 20 },
    ),
    ded(
      c('31.63'),
      'Déduction pour frais professionnels – Autres frais',
      'Actual work expenses: other (say what, e.g. union fees)',
      'Frais professionnels effectifs: autres (précisez, p. ex. cotisations syndicales)',
      { guide: 20 },
    ),
    ded(
      c('31.90'),
      'Déduction sur le gain de l’un des époux/partenaires',
      'Two-earner couple deduction, federal tax (lower income only)',
      'Déduction pour couple à deux revenus, impôt fédéral (revenu le plus bas)',
      { role: 'computed', columns: ['ifd'], guide: 21 },
    ),
    ded(
      c('31.95'),
      'Déduction sur le gain de l’un des époux / partenaire enregistré',
      'Two-earner couple deduction, Geneva tax (lower income only)',
      'Déduction pour couple à deux revenus, impôt cantonal (revenu le plus bas)',
      { role: 'computed', columns: ['icc'], guide: 21 },
    ),
    ded(
      c('31.00'),
      'Total',
      `Total deductions for salaried work, ${who.en}`,
      `Total des déductions du travail salarié, ${who.fr}`,
      { role: 'total' },
    ),
  ];
}

// --- Annexe B: self-employment, one sheet per taxpayer and business ----------------------------

const INDEP = 'ge-2025-guide-independants';

/**
 * Annexe B for one taxpayer: the same codes for A and B, one sheet per person and per business,
 * ticked "Contribuable A" or "Contribuable B" (ge-2025-declaration-specimen p. 7 to 10). Explained
 * in the guide for the self-employed (ge-2025-guide-independants p. 10 to 24). Taxpresso prepares the
 * simple case (a sole proprietorship): the lines of partnerships (12.70, 57.51), qualified
 * participations, the patent box and research (12.18, 12.28, 12.29), the AVS provision (12.13,
 * 12.14) and the owner's own pension fund (32.12, 32.30) are listed, not supported.
 */
function annexB(person: 'A' | 'B'): FormRubric[] {
  const who =
    person === 'A' ? g('taxpayer A', 'contribuable A') : g('taxpayer B', 'contribuable B');
  /** A rubric maker for one section of annexe B, cited to the guide for the self-employed. */
  const onB = (page: FormPageId, pdfPage: number, section: string, defaults: Options) => {
    const make = on(page, pdfPage, `${section}-${person}`, { person, ...defaults });
    return (key: string, label: string, en: string, fr: string, options: Options = {}) => {
      const { guide, ...rest } = { ...defaults, ...options };
      return {
        ...make(key, label, en, fr, rest),
        source: `${SPEC} p. ${pdfPage}${guide !== undefined ? `; ${INDEP} p. ${guide}` : ''}`,
      };
    };
  };
  const b1 = onB('B1', 7, 'renseignements', {
    nature: 'identity',
    format: 'text',
    columns: [],
    guide: 10,
  });
  const res = onB('B2', 8, 'resultat', { columns: ICC_IFD, guide: 12 });
  const bil = onB('B2', 8, 'bilan', { nature: 'wealth', columns: WEALTH, guide: 17 });
  const ded = onB('B4', 10, 'deductions', { nature: 'deduction', columns: ICC_IFD, guide: 22 });
  return [
    b1(
      `B1-${person}`,
      `Contribuable ${person}`,
      `Tick: this sheet is for ${who.en}`,
      `Cochez : cette feuille est celle du ${who.fr}`,
      { format: 'tick' },
    ),
    b1(
      'B1-NOM',
      'Nom et /ou raison sociale de l’activité professionnelle',
      'The name of your business',
      'Le nom de votre activité',
    ),
    b1(
      'B1-COMMUNE',
      'Code commune',
      'Code of the commune of the business: here your home commune',
      'Code de la commune de l’activité : ici votre commune de domicile',
      { guide: 11 },
    ),
    b1(
      'B1-RI',
      'Raison individuelle',
      'Tick: you run the business in your own name (nature juridique)',
      'Cochez : vous exploitez l’activité en votre nom (nature juridique)',
      { format: 'tick', guide: 11 },
    ),
    b1(
      'B1-DU',
      'Exercice comptable du',
      'First day of the business year',
      'Premier jour de l’exercice comptable',
      { format: 'date', guide: 11 },
    ),
    b1('B1-AU', 'au', 'Last day of the business year', 'Dernier jour de l’exercice comptable', {
      format: 'date',
      guide: 11,
    }),
    b1(
      'B1-FACT',
      'Méthode à la facturation',
      'Tick: you count income and costs when invoiced',
      'Cochez : recettes et charges comptent à la facturation',
      { format: 'tick', guide: 11 },
    ),
    b1(
      'B1-ENC',
      'Méthode de l’encaissement-décaissement',
      'Tick: you count income and costs when paid',
      'Cochez : recettes et charges comptent à l’encaissement et au décaissement',
      { format: 'tick', guide: 11 },
    ),
    b1(
      'B1-DEBUT',
      'L’activité indépendante débute-t-elle durant cette période fiscale ?',
      'Did the business start this year? Oui (yes) or Non (no)',
      'L’activité a-t-elle débuté cette année ? Oui ou Non',
      { guide: 11 },
    ),
    b1(
      'B1-FIN',
      'L’activité indépendante cesse-t-elle durant cette période fiscale ?',
      'Does the business stop this year? Oui (yes) or Non (no)',
      'L’activité cesse-t-elle cette année ? Oui ou Non',
      { guide: 11 },
    ),
    res(
      '12.08',
      'Chiffre d’affaires brut',
      'Turnover: fees, operating income, sales',
      'Chiffre d’affaires : honoraires, produits d’exploitation, ventes',
    ),
    res(
      '12.09',
      'Indemnités pour pertes de gains reçues',
      'Benefits received for lost earnings',
      'Indemnités reçues pour pertes de gains',
    ),
    res(
      '12.15',
      'Produits financiers',
      'Financial income of the business’s assets',
      'Rendement des actifs de l’activité',
    ),
    res(
      '12.16',
      'Autres produits',
      'Other income of the business, not above',
      'Autres produits de l’activité, non déclarés ci-dessus',
      { guide: 13 },
    ),
    res('12.17', 'Total des recettes', 'Total revenue', 'Total des recettes', {
      role: 'computed',
      guide: 13,
    }),
    res(
      '12.21',
      'Charges de matières premières, de marchandises et de services',
      'Materials, goods and services bought',
      'Achats de matières, de marchandises et de services',
      { nature: 'deduction', guide: 13 },
    ),
    res(
      '12.22',
      'Charges du personnel',
      'Staff costs, your own pay excluded',
      'Charges de personnel, sans votre propre salaire',
      { nature: 'deduction', guide: 13 },
    ),
    res('12.23', 'Amortissements', 'Depreciation (from B3)', 'Amortissements (de B3)', {
      nature: 'deduction',
      guide: 14,
    }),
    res('12.24', 'Provisions', 'Provisions', 'Provisions', { nature: 'deduction', guide: 14 }),
    res(
      '12.41',
      'Intérêts de dettes',
      'Interest on business debts',
      'Intérêts des dettes commerciales',
      {
        nature: 'deduction',
        guide: 14,
      },
    ),
    res(
      '12.42',
      'Frais généraux et autres charges d’exploitation',
      'Overheads and other operating costs, not above',
      'Frais généraux et autres charges, non déclarés ci-dessus',
      { nature: 'deduction', guide: 15 },
    ),
    res(
      '12.45',
      'Total des charges commerciales',
      'Total business charges',
      'Total des charges commerciales',
      { nature: 'deduction', role: 'computed', guide: 15 },
    ),
    res('12.46', 'Bénéfice/(Perte)', 'Result: profit, or a loss', 'Résultat : bénéfice ou perte', {
      role: 'computed',
      guide: 15,
    }),
    res(
      '12.18',
      'Déduction pour participations qualifiées',
      'Deduction for qualified participations',
      'Déduction pour participations qualifiées',
      { nature: 'deduction', supported: false, guide: 15 },
    ),
    res(
      '12.28',
      'Réduction liée aux brevets et droits comparables',
      'Patent box reduction, Geneva tax',
      'Réduction pour brevets, impôt cantonal',
      { nature: 'deduction', columns: ['icc'], supported: false, guide: 16 },
    ),
    res(
      '12.29',
      'Réduction liée aux dépenses de recherche et de développement',
      'Research and development reduction, Geneva tax',
      'Réduction pour recherche et développement, impôt cantonal',
      { nature: 'deduction', columns: ['icc'], supported: false, guide: 16 },
    ),
    res(
      '12.01',
      'Bénéfice net',
      'Net profit, to PG2 12.00',
      'Bénéfice net, à reporter en PG2 12.00',
      {
        role: 'computed',
        guide: 16,
      },
    ),
    res('57.10', 'Perte commerciale', 'Business loss of the year', 'Perte commerciale de l’année', {
      nature: 'deduction',
      role: 'computed',
      guide: 16,
    }),
    res(
      '57.20',
      'Pertes non compensées',
      'Losses of the seven previous years not deducted yet',
      'Pertes des sept exercices précédents pas encore déduites',
      { nature: 'deduction', guide: 16 },
    ),
    res('57.00', 'Perte nette', 'Net loss, to PG3 57.00', 'Perte nette, à reporter en PG3 57.00', {
      nature: 'deduction',
      role: 'computed',
      guide: 16,
    }),
    bil('12.48', 'Actifs circulants', 'Current assets', 'Actifs circulants'),
    bil('12.49', 'Actifs immobilisés', 'Fixed assets', 'Actifs immobilisés'),
    bil(
      '12.50',
      'Actifs commerciaux bruts',
      'Gross business assets, to PG4 12.00',
      'Actifs commerciaux bruts, à reporter en PG4 12.00',
      { role: 'computed' },
    ),
    bil(
      '57.50',
      'Passifs commerciaux (dettes)',
      'Business debts, to PG4 57.00',
      'Dettes commerciales, à reporter en PG4 57.00',
    ),
    bil(
      '12.52',
      // As printed, the form's own spelling ("inviduelle").
      'Capital propre/(Découvert) de la société simple ou la raison inviduelle',
      'Equity of your business: assets less debts',
      'Fonds propres de l’activité : actifs moins dettes',
      { role: 'computed' },
    ),
    bil(
      '12.70',
      'Fonds propres d’une société en nom collectif ou en commandite simple',
      'Equity in a partnership',
      'Fonds propres dans une société de personnes',
      { supported: false },
    ),
    bil(
      '57.51',
      'Découvert commercial d’une société en nom collectif ou en commandite simple',
      'Deficit in a partnership',
      'Découvert dans une société de personnes',
      { supported: false },
    ),
    ded(
      '32.10',
      'Acompte(s) AVS/AI, APG, AF, AMat de l’exploitant versés',
      'Your own AVS/AI/APG contributions for the business year',
      'Vos cotisations AVS/AI, APG pour l’exercice',
    ),
    ded(
      '32.11',
      'Cotisations complémentaires AVS/AI, APG, AF, AMat de l’exploitant',
      'Further contributions after final decisions for earlier years',
      'Cotisations complémentaires selon les décisions pour des années antérieures',
    ),
    ded(
      '12.13',
      'Montant de la provision AVS constituée',
      'AVS provision made for the business year',
      'Provision AVS constituée pour l’exercice',
      { nature: 'info', columns: ['amount'], supported: false },
    ),
    ded(
      '12.14',
      'Montant de la provision AVS dissoute',
      'AVS provision released',
      'Provision AVS dissoute',
      { nature: 'info', columns: ['amount'], supported: false },
    ),
    ded(
      '32.12',
      'Prévoyance 2ème pilier de l’exploitant (cotisations)',
      'Your own pension fund contributions',
      'Vos cotisations au 2e pilier',
      { supported: false, guide: 23 },
    ),
    ded(
      '32.30',
      'Rachat(s) de la prévoyance professionnelle',
      'Your own pension fund buy-ins',
      'Vos rachats au 2e pilier',
      { supported: false, guide: 23 },
    ),
    ded(
      '32.40',
      'Cotisations au 3ème pilier A',
      'Payments into pillar 3a',
      'Versements au 3e pilier A',
      {
        guide: 23,
      },
    ),
    ded(
      '32.90',
      'Déduction sur le gain de l’un des époux/partenaires',
      'Two-earner couple deduction, federal tax (lower income only)',
      'Déduction pour couple à deux revenus, impôt fédéral (revenu le plus bas)',
      { role: 'computed', columns: ['ifd'], guide: 23 },
    ),
    ded(
      '32.95',
      'Déduction sur le gain de l’un des époux/partenaires',
      'Two-earner couple deduction, Geneva tax (lower income only)',
      'Déduction pour couple à deux revenus, impôt cantonal (revenu le plus bas)',
      { role: 'computed', columns: ['icc'], guide: 24 },
    ),
    ded(
      '32.00',
      'Total',
      `Total deductions for self-employment, ${who.en}, to PG3 32.00`,
      `Total des déductions de l’activité indépendante, ${who.fr}, à reporter en PG3 32.00`,
      { role: 'computed' },
    ),
  ];
}

// --- Annexe C: pensions, other income and assets, other deductions ----------------------------

const c1s = on('C1', 11, 'prestations-sociales', { columns: BOTH, parts: ABE, guide: 25 });
const c1r = on('C1', 11, 'rentes', { columns: BOTH, parts: ABE, guide: 25 });
const C1 = [
  c1s(
    '17.10',
    'Rentes AVS/AI',
    'AVS/AI pensions (old age, survivors, disability)',
    'Rentes AVS/AI (vieillesse, survivants, invalidité)',
  ),
  c1s(
    '17.20',
    'Autres prestations et indemnités',
    'Other benefits, such as foreign pensions like AVS/AI (say what)',
    'Autres prestations, par exemple des rentes étrangères semblables à l’AVS/AI (précisez)',
  ),
  c1s(
    '17.00',
    'Total',
    'Total AVS/AI and similar pensions',
    'Total des rentes AVS/AI et semblables',
    { role: 'total', parts: undefined, guide: undefined },
  ),
  c1r(
    '13.10',
    'Pensions alimentaires, contributions d’entretien',
    'Maintenance you received, for you or your children',
    'Pension alimentaire reçue, pour vous ou vos enfants',
  ),
  c1r(
    '13.15',
    'Avances sur pension alimentaire du SCARPA',
    'Maintenance advances from SCARPA',
    'Avances de pension alimentaire du SCARPA',
  ),
  c1r(
    '13.20',
    'Rentes de la prévoyance professionnelle',
    'Pension fund pensions (2nd pillar)',
    'Rentes du 2e pilier',
    { guide: 26 },
  ),
  c1r(
    '13.30',
    'Prestations de l’assurance militaire',
    'Military insurance benefits (other than those in 98.60)',
    'Prestations de l’assurance militaire (autres que 98.60)',
    { guide: 26 },
  ),
  c1r(
    '13.40',
    'Autres rentes',
    'Other pensions: SUVA, life insurance after death or disability, foreign pensions (say what)',
    'Autres rentes: SUVA, assurance-vie après décès ou invalidité, rentes étrangères (précisez)',
    { guide: 26 },
  ),
  c1r(
    '13.50',
    'Rentes viagères, rentes viagères temporaires et rentes certaines reçues',
    'Life annuities you received, with their surrender value',
    'Rentes viagères reçues, avec leur valeur de rachat',
    { columns: ['wealth', 'icc_ifd'], guide: 26 },
  ),
  c1r('13.00', 'Total', 'Total pensions and benefits', 'Total des rentes et prestations', {
    role: 'total',
    parts: undefined,
    columns: ['icc_ifd', 'wealth'],
    guide: undefined,
  }),
];

const c2 = on('C2', 12, 'autres-revenus', { columns: BOTH, guide: 27 });
const c2f = on('C2', 12, 'autres-elements-fortune', {
  nature: 'wealth',
  columns: WEALTH,
  parts: ABE,
  guide: 27,
});
const c2s = on('C2', 12, 'succession', {
  columns: ['wealth', 'icc_ifd'],
  guide: 27,
  supported: false,
});
const C2 = [
  c2(
    '16.10',
    'Produits de sous-location',
    'Net income from subletting',
    'Revenu net de sous-location',
    { parts: AB, guide: 26 },
  ),
  c2('16.20', 'Gains accessoires', 'Side income', 'Gains accessoires', { parts: AB }),
  c2(
    '16.30',
    'Subsides d’assurance-maladie',
    'Health insurance subsidies (SAM)',
    'Subsides d’assurance-maladie du SAM',
    { parts: ABE },
  ),
  c2('16.35', 'Allocation de logement', 'Housing allowance', 'Allocation de logement', {
    parts: AB,
  }),
  c2('16.63', 'Allocations familiales', 'Family allowances', 'Allocations familiales'),
  c2('16.64', 'Autres revenus', 'Other income (say what)', 'Autres revenus (précisez)', {
    guide: 18,
  }),
  c2f(
    '16.40',
    'Numéraires, métaux précieux, autos, bateaux, etc.',
    'Cash, gold, vehicles, boats and other valuables',
    'Espèces, or, véhicules, bateaux et autres biens de valeur',
  ),
  c2f('16.62', 'Autres éléments de fortune', 'Other assets (say what)', 'Autres biens (précisez)', {
    guide: undefined,
  }),
  c2s(
    '16.50',
    'Succession non partagée, solde imposable',
    'Your share of an undivided estate',
    'Votre part d’une succession non partagée',
    { repeats: 2 },
  ),
  c2('16.00', 'Total', 'Total other income and assets', 'Total des autres revenus et biens', {
    role: 'total',
    columns: ['wealth', 'icc_ifd'],
    guide: undefined,
  }),
  c2(
    '16.80',
    'Successions',
    'What you inherited in the year (information)',
    'Ce que vous avez hérité dans l’année (information)',
    { nature: 'info', columns: ['amount'], supported: false },
  ),
];

const c3v = on('C3', 13, 'assurances-vie', { nature: 'deduction', columns: BOTH, guide: 28 });
const c3m = on('C3', 13, 'assurances-maladie', { nature: 'deduction', columns: BOTH, guide: 29 });
const c3r = on('C3', 13, 'rentes-viageres', { nature: 'deduction', columns: BOTH, guide: 29 });
const C3 = [
  c3v(
    '52.11',
    'Assurance-vie',
    'Life insurance: premiums paid, and its surrender value',
    'Assurance-vie: primes payées, et valeur de rachat',
    {
      columns: ['wealth', 'icc_ifd'],
      repeats: 2,
      lineFields: [
        { id: 'insurer', label: 'Nom de la société d’assurance', format: 'text' },
        { id: 'from', label: 'Année de conclusion', format: 'count' },
        { id: 'to', label: 'Année d’échéance', format: 'count' },
        { id: 'sum', label: 'Somme assurée', format: 'money' },
      ],
    },
  ),
  c3v('16.70', 'Total', 'Total surrender value of life insurance', 'Total des valeurs de rachat', {
    nature: 'wealth',
    role: 'total',
    columns: WEALTH,
    guide: undefined,
  }),
  c3v(
    '56.30',
    'Intérêts échus de capitaux d’épargne',
    'Interest on savings (from F1)',
    'Intérêts d’épargne (de F1)',
    { role: 'report' },
  ),
  c3v(
    '52.10',
    'Sous-total IFD',
    'Life insurance and savings interest, federal tax',
    'Assurance-vie et intérêts d’épargne, impôt fédéral',
    { role: 'computed' },
  ),
  c3v(
    '52.15',
    'Sous-total ICC',
    'Life insurance and savings interest, Geneva tax (within its limit)',
    'Assurance-vie et intérêts d’épargne, impôt cantonal (dans sa limite)',
    { role: 'computed' },
  ),
  c3m(
    '52.21',
    'Assurance-maladie, cotisations limitées au maximum admis',
    'Health insurance premiums you paid (basic and supplementary)',
    'Primes d’assurance-maladie payées (de base et complémentaires)',
    { parts: ABE },
  ),
  c3m(
    '52.22',
    'Assurance-accidents',
    'Private accident and loss of earnings insurance premiums',
    'Primes d’assurance-accidents et perte de gain privées',
    { parts: ABE },
  ),
  c3m(
    '52.00',
    'Total',
    'Insurance premiums, within the limits',
    'Primes d’assurances, dans les limites',
    { role: 'computed', columns: ICC_IFD },
  ),
  c3r(
    '54.10',
    'Rentes viagères payées',
    'Life annuities you pay (the taxable return part)',
    'Rentes viagères que vous versez (part de rendement)',
    {
      lineFields: [
        { id: 'beneficiary', label: 'Nom, prénom du bénéficiaire', format: 'text' },
        { id: 'birth', label: 'Date de naissance', format: 'date' },
        { id: 'taxpayer', label: 'Nº de contribuable', format: 'text' },
        { id: 'domicile', label: 'Domicile', format: 'text' },
      ],
    },
  ),
  c3r('54.00', 'Total', 'Total life annuities paid', 'Total des rentes viagères payées', {
    role: 'total',
    guide: undefined,
  }),
];

const c4p = on('C4', 14, 'pensions', { nature: 'deduction', columns: BOTH, guide: 29 });
const c4l = on('C4', 14, 'prevoyance', {
  nature: 'deduction',
  columns: ICC_IFD,
  guide: '29 and 30',
});
const c4a = on('C4', 14, 'autres', { nature: 'deduction', columns: ICC_IFD });
const C4 = [
  c4p(
    '53.10',
    'Pensions, contributions d’entretien versées',
    'Maintenance you paid to a former partner or for your children',
    'Pension alimentaire versée à un ex-conjoint ou pour vos enfants',
    {
      repeats: 2,
      lineFields: [
        { id: 'beneficiary', label: 'Nom, prénom du bénéficiaire', format: 'text' },
        { id: 'birth', label: 'Date de naiss.', format: 'date' },
        { id: 'taxpayer', label: 'Nº de contrib.', format: 'text' },
        { id: 'domicile', label: 'Domicile', format: 'text' },
        { id: 'since', label: 'Date de l’obligation', format: 'date' },
      ],
    },
  ),
  c4p('53.00', 'Total', 'Total maintenance paid', 'Total des pensions versées', {
    role: 'total',
    guide: undefined,
  }),
  c4l(
    '33.20',
    'Déductions liées aux rentes de la prévoyance professionnelle',
    'Deduction on old pension fund pensions (started before 2002)',
    'Déduction sur d’anciennes rentes du 2e pilier (avant 2002)',
    { role: 'computed', parts: ABE },
  ),
  c4l(
    '33.00',
    'Total',
    'Total deduction on pension fund pensions',
    'Total de la déduction sur les rentes du 2e pilier',
    { role: 'total', guide: undefined },
  ),
  c4a(
    '59.40',
    'Frais liés au handicap',
    'Disability costs you paid (say what)',
    'Frais liés à un handicap (précisez)',
    { parts: ABE, guide: 30 },
  ),
  c4a(
    '59.10',
    'Frais de garde effectifs ICC',
    'Childcare costs, Geneva tax',
    'Frais de garde des enfants, impôt cantonal',
    { columns: ['icc'], guide: 30 },
  ),
  c4a(
    '59.12',
    'Frais de garde effectifs IFD',
    'Childcare costs, federal tax',
    'Frais de garde des enfants, impôt fédéral',
    { columns: ['ifd'], guide: 30 },
  ),
  c4a(
    '59.20',
    'Déduction pour couples/partenaires',
    'Married couple deduction, federal tax',
    'Déduction pour couple marié, impôt fédéral',
    { role: 'computed', columns: ['ifd'], guide: 31 },
  ),
  c4a(
    '59.60',
    'Cotisations AVS des personnes sans activité lucrative',
    'AVS contributions as a non-earner',
    'Cotisations AVS des personnes sans activité lucrative',
    { parts: AB },
  ),
  c4a(
    '59.65',
    'Maintien de la prévoyance 2ème pilier Cotisations',
    'Pension fund contributions after leaving your job (insurance kept)',
    'Cotisations au 2e pilier après la fin de l’emploi (assurance maintenue)',
    { parts: AB, guide: 31 },
  ),
  c4a(
    '59.66',
    'Maintien de la prévoyance 2ème pilier Rachat(s)',
    'Pension fund buy-ins after leaving your job (insurance kept)',
    'Rachats au 2e pilier après la fin de l’emploi (assurance maintenue)',
    { parts: AB, guide: 31 },
  ),
  c4a(
    '59.70',
    'Déductions sur les gains accessoires ICC',
    'Costs of your side income, Geneva tax',
    'Frais liés aux gains accessoires, impôt cantonal',
    { parts: AB, columns: ['icc'], guide: 27 },
  ),
  c4a(
    '59.75',
    'Déductions sur les gains accessoires IFD',
    'Costs of your side income, federal tax',
    'Frais liés aux gains accessoires, impôt fédéral',
    { parts: AB, columns: ['ifd'], guide: 27 },
  ),
  c4a(
    '59.30',
    'Autres déductions sur le revenu',
    'Other deductions (say what)',
    'Autres déductions (précisez)',
    { parts: AB },
  ),
  c4a(
    '59.50',
    'Déductions pour frais de formation, de perfectionnement ou de reconversion',
    'Training and retraining costs',
    'Frais de formation, de perfectionnement ou de reconversion',
    { parts: AB, guide: 31 },
  ),
  c4a('59.00', 'Total', 'Total other deductions', 'Total des autres déductions', { role: 'total' }),
];

// --- Annexe E: debts and interest --------------------------------------------------------------

const CREDITOR_LINE: readonly LineField[] = [
  { id: 'creditor', label: 'Nom, prénom du créancier/Raison sociale', format: 'text' },
  { id: 'domicile', label: 'Domicile', format: 'text' },
  { id: 'since', label: 'Date de constitution', format: 'date' },
  { id: 'shareA', label: 'Quote part contr. A', format: 'percent' },
  { id: 'shareB', label: 'Quote part contr. B', format: 'percent' },
  { id: 'shareChildren', label: 'Quote part enfant(s)', format: 'percent' },
];
const DEBT: readonly FormColumn[] = ['icc_ifd', 'wealth'];
const e1 = on('E1', 19, 'chirographaires', { nature: 'deduction', columns: DEBT, guide: 37 });
const e1h = on('E1', 19, 'hypothecaires', {
  nature: 'deduction',
  columns: DEBT,
  guide: 37,
  supported: false,
});
const e2 = on('E2', 20, 'exoneres', { nature: 'deduction', columns: DEBT, supported: false });
const e2t = on('E2', 20, 'totaux', { nature: 'deduction', columns: DEBT, role: 'total' });
const E = [
  e1(
    '55.10',
    'Intérêts et dettes chirographaires',
    'Private loans: interest paid in the year, and what you owed on 31 December',
    'Emprunts privés: intérêts payés dans l’année, et dette au 31 décembre',
    { repeats: 3, lineFields: CREDITOR_LINE },
  ),
  e1h(
    '55.20',
    'Intérêts et dettes hypothécaires',
    'Mortgages: interest and debt',
    'Hypothèques: intérêts et dette',
    { repeats: 3, lineFields: CREDITOR_LINE },
  ),
  e1(
    '55.80',
    'Total des intérêts et dettes chirographaires et hypothécaires',
    'Total private loans and mortgages',
    'Total des emprunts et hypothèques',
    { role: 'total', guide: undefined },
  ),
  e2(
    '55.30',
    'Intérêts et dettes épargne logement PPE',
    'Debts on subsidised home-savings property',
    'Dettes sur un logement en épargne logement PPE',
    { repeats: 3, lineFields: CREDITOR_LINE },
  ),
  e2(
    '55.40',
    'Intérêts et dettes HLM',
    'Debts on subsidised HLM property',
    'Dettes sur un immeuble HLM',
    { repeats: 3, lineFields: CREDITOR_LINE },
  ),
  e2(
    '55.90',
    'Total des intérêts et dettes sur immeubles exonérés',
    'Total debts on tax-exempt property',
    'Total des dettes sur immeubles exonérés',
    { role: 'total' },
  ),
  e2t(
    '55.00',
    'Total de tous les intérêts et dettes',
    'Total interest and debts',
    'Total des intérêts et dettes',
  ),
];

// --- Annexe F: securities and accounts (état des titres). Its lines carry no codes. ------------

const WHOSE: LineField = {
  id: 'civilite',
  label: 'Civilité',
  format: 'text',
  hint: g(
    'A for taxpayer A, B for taxpayer B, E for children, A and B for a joint account',
    'A pour le contribuable A, B pour le contribuable B, E pour les enfants, A et B pour un compte joint',
  ),
  source: `${SPEC} p. 22`,
};
const FC: LineField = { id: 'fc', label: 'FC', format: 'tick' };
const f1 = on('F1', 21, 'report', { nature: 'wealth', columns: TITRES, role: 'total', guide: 38 });
const f1i = on('F1', 21, 'imputations', {
  nature: 'info',
  columns: ['amount'],
  format: 'money_cents',
  guide: 39,
});
const F = [
  f1(
    'F1-TOTAUX',
    'Totaux',
    'Totals of the securities list (F2, F3, F4 and qualified holdings)',
    'Totaux de l’état des titres (F2, F3, F4 et participations qualifiées)',
  ),
  f1i(
    'F1-IA',
    'Impôt anticipé',
    'Swiss withholding tax to reclaim (35% of the income subject to it)',
    'Impôt anticipé à récupérer (35% des rendements qui y sont soumis)',
    { role: 'computed' },
  ),
  f1i(
    'F1-RSI',
    'Retenue supplémentaire d’impôt (RSI)',
    'Additional US withholding tax (form R-US 164)',
    'Retenue supplémentaire d’impôt américain (formule R-US 164)',
  ),
  f1i(
    'F1-IES',
    'Imputation d’impôts étrangers (IES)',
    'Foreign tax withheld at source (forms DA-1 or DA-3)',
    'Impôts étrangers retenus à la source (formules DA-1 ou DA-3)',
  ),
  on('F2', 22, 'comptes', { nature: 'wealth', columns: TITRES, guide: 40 })(
    'F2',
    'Comptes bancaires et postaux',
    'Bank and postal accounts, crypto included: one line per account',
    'Comptes bancaires et postaux, crypto-monnaies comprises: une ligne par compte',
    {
      repeats: 6,
      lineFields: [
        {
          id: 'account',
          label: 'Numéro de compte (8 dernières positions du code IBAN)',
          format: 'text',
          hint: g(
            'The last 8 characters of the IBAN, no spaces',
            'Les 8 derniers caractères de l’IBAN, sans espaces',
          ),
          source: `${GUIDE} p. 40`,
        },
        { id: 'bank', label: 'Nom de l’établissement', format: 'text' },
        {
          id: 'opened',
          label: 'Compte ouvert ou fermé en 2025',
          format: 'text',
          hint: g(
            'O (opened) or F (closed), then day and month: opened on 23 January = O2301',
            'O (ouvert) ou F (fermé), puis jour et mois: ouvert le 23 janvier = O2301',
          ),
          source: `${SPEC} p. 22`,
        },
        WHOSE,
        FC,
      ],
    },
  ),
  on('F3', 23, 'titres', { nature: 'wealth', columns: TITRES, guide: 41 })(
    'F3',
    'Titres suisses et étrangers',
    'Securities: shares, bonds, funds, employee shares and options: one line per security',
    'Titres: actions, obligations, fonds, actions et options de collaborateur: une ligne par titre',
    {
      repeats: 6,
      lineFields: [
        { id: 'valor', label: 'Numéro de valeur', format: 'text' },
        { id: 'name', label: 'Désignation des valeurs', format: 'text' },
        { id: 'quantity', label: 'Nombre de parts ou valeur nominale', format: 'text' },
        {
          id: 'traded',
          label: 'Titre acheté ou vendu en 2025',
          format: 'text',
          hint: g(
            'A (bought) or V (sold), then day and month: bought on 23 January = A2301',
            'A (achat) ou V (vente), puis jour et mois: achat le 23 janvier = A2301',
          ),
          source: `${SPEC} p. 23`,
        },
        WHOSE,
        FC,
      ],
    },
  ),
  on('F4', 24, 'releves', { nature: 'wealth', columns: TITRES, guide: 43 })(
    'F4',
    'Relevés fiscaux',
    'Tax statements from your bank, one line per custody account',
    'Relevés fiscaux de votre banque, une ligne par dépôt',
    {
      repeats: 6,
      lineFields: [
        {
          id: 'depot',
          label: 'Numéro du dépôt 7 dernières positions',
          format: 'text',
          source: `${GUIDE} p. 43`,
        },
        { id: 'bank', label: 'Nom de l’établissement', format: 'text' },
        WHOSE,
        FC,
      ],
    },
  ),
];

// --- Annexe G: family ---------------------------------------------------------------------------

const G = [
  on('G1', 25, 'enfants', { nature: 'info', format: 'text', guide: 46 })(
    'G1',
    'Enfant(s) à charge, étudiant-e-s ou apprenti-e-s durant l’année 2025',
    'Your dependent children, students or apprentices: one line per child',
    'Vos enfants à charge, étudiants ou apprentis: une ligne par enfant',
    {
      repeats: 5,
      lineFields: [
        { id: 'name', label: 'Nom et prénom', format: 'text' },
        { id: 'birth', label: 'Date de naissance', format: 'date' },
        { id: 'activity', label: 'Activité au 31.12.2025', format: 'text' },
        {
          id: 'taxpayer',
          label: 'Nº de contribuable pour les enfants majeurs domiciliés à Genève',
          format: 'text',
        },
        { id: 'income', label: 'Revenus bruts', format: 'money' },
        { id: 'wealth', label: 'Fortune nette', format: 'money' },
      ],
    },
  ),
  on('G2', 26, 'autres-personnes', { nature: 'info', format: 'text', guide: 46 })(
    'G2',
    'Autres personnes à charge',
    'Other relatives you support: one line per person',
    'Autres proches que vous entretenez: une ligne par personne',
    {
      repeats: 6,
      lineFields: [
        { id: 'name', label: 'Nom et prénom', format: 'text' },
        { id: 'birth', label: 'Date de naissance', format: 'date' },
        { id: 'relation', label: 'Lien de parenté', format: 'text' },
        { id: 'domicile', label: 'Domicile au 31.12.2025', format: 'text' },
        { id: 'paid', label: 'Prestation versée en 2025', format: 'money' },
        { id: 'income', label: 'Revenus bruts', format: 'money' },
        { id: 'wealth', label: 'Fortune nette', format: 'money' },
      ],
    },
  ),
];

// --- Pages, in the official order ----------------------------------------------------------------

const page = (
  id: FormPageId,
  pdfPage: number,
  title: string,
  gloss: Gloss,
  sections: [string, string, Gloss][],
  extra: Partial<Pick<FormPage, 'person' | 'supported'>> & { guide?: number | string } = {},
): FormPage => ({
  id,
  title,
  gloss,
  ...(extra.person ? { person: extra.person } : {}),
  pdfPage,
  supported: extra.supported ?? true,
  sections: sections.map(([sid, stitle, sgloss]) => ({ id: sid, title: stitle, gloss: sgloss })),
  source: cite(pdfPage, extra.guide),
});

const SELF = g('Self-employment', 'Travail indépendant');

/**
 * The sections of an annexe B page, once for taxpayer A and once for B: one sheet per person
 * ("Contribuable A", "Contribuable B", specimen p. 7). The title as printed, the gloss says whose.
 */
const perTaxpayer = (sections: [string, string, Gloss][]): [string, string, Gloss][] =>
  (['A', 'B'] as const).flatMap((p) =>
    sections.map(([id, title, gloss]): [string, string, Gloss] => [
      `${id}-${p}`,
      title,
      g(`${gloss.en}, taxpayer ${p}`, `${gloss.fr}, contribuable ${p}`),
    ]),
  );
const PROPERTY = g('Property', 'Immeubles');

export const FORM_PAGES_2025: readonly FormPage[] = [
  page(
    'PG1',
    1,
    'Déclaration fiscale 2025',
    g('Cover page: about you', 'Page de garde: vos données'),
    [['adresse', 'Adresse', g('Address', 'Adresse')]],
    { guide: 12 },
  ),
  page(
    'PG2',
    2,
    'Récapitulation 2025',
    g('Summary: income', 'Récapitulation des revenus'),
    [
      ['revenu', 'Revenu', g('Income', 'Revenu')],
      [
        'renseignements',
        'Renseignements',
        g(
          'Information: not taxed, used for family and social benefits',
          'Renseignements: non imposés, utiles pour les charges de famille et les prestations sociales',
        ),
      ],
    ],
    { guide: 13 },
  ),
  page(
    'PG3',
    3,
    'Récapitulation 2025',
    g('Summary: deductions', 'Récapitulation des déductions'),
    [['deductions', 'Déductions', g('Deductions', 'Déductions')]],
    { guide: 13 },
  ),
  page(
    'PG4',
    4,
    'Récapitulation 2025',
    g('Summary: wealth', 'Récapitulation de la fortune'),
    [
      ['fortune', 'Fortune', g('Wealth', 'Fortune')],
      [
        'deductions-fortune',
        'Déductions liées à la fortune ci-dessus',
        g('Deductions from wealth', 'Déductions sur la fortune'),
      ],
    ],
    { guide: 13 },
  ),
  page(
    'A1',
    5,
    'Activité dépendante 2025',
    g('Salaried work, taxpayer A', 'Travail salarié, contribuable A'),
    [
      ['revenu', 'Revenu', g('Income', 'Revenu')],
      [
        'autres-renseignements',
        'Autres renseignements figurant sur le certificat de salaire',
        g(
          'Other information from your salary certificate',
          'Autres informations du certificat de salaire',
        ),
      ],
      ['deductions', 'Déductions liées aux revenus ci-dessus', g('Deductions', 'Déductions')],
    ],
    { person: 'A', guide: 17 },
  ),
  page(
    'A2',
    6,
    'Activité dépendante 2025',
    g('Salaried work, taxpayer B', 'Travail salarié, contribuable B'),
    [
      ['revenu', 'Revenu', g('Income', 'Revenu')],
      [
        'autres-renseignements',
        'Autres renseignements figurant sur le certificat de salaire',
        g(
          'Other information from your salary certificate',
          'Autres informations du certificat de salaire',
        ),
      ],
      ['deductions', 'Déductions liées aux revenus ci-dessus', g('Deductions', 'Déductions')],
    ],
    { person: 'B', guide: 17 },
  ),
  // Annexe B: one sheet per taxpayer and business, so each section once per taxpayer (A, B).
  page(
    'B1',
    7,
    'Activité indépendante 2025',
    SELF,
    perTaxpayer([
      [
        'renseignements',
        'Renseignements généraux',
        g('General information', 'Renseignements généraux'),
      ],
    ]),
    { guide: 24 },
  ),
  page(
    'B2',
    8,
    'Activité indépendante 2025',
    SELF,
    perTaxpayer([
      ['resultat', 'Compte de pertes et profits', g('Profit and loss', 'Compte de résultat')],
      ['bilan', 'Bilan comptable', g('Balance sheet', 'Bilan')],
    ]),
    { guide: 24 },
  ),
  page(
    'B3',
    9,
    'Activité indépendante 2025',
    SELF,
    [
      [
        'stocks',
        'Estimation du stock des marchandises',
        g('Stock, depreciation and provisions', 'Stocks, amortissements et provisions'),
      ],
    ],
    { supported: false, guide: 24 },
  ),
  page(
    'B4',
    10,
    'Activité indépendante 2025',
    SELF,
    perTaxpayer([
      [
        'deductions',
        'Déductions liées aux revenus de la feuille B2',
        g('Deductions', 'Déductions'),
      ],
    ]),
    { guide: 24 },
  ),
  page(
    'C1',
    11,
    'Autres revenus et fortune 2025',
    g('Pensions and benefits', 'Rentes et prestations'),
    [
      [
        'prestations-sociales',
        'Prestations sociales',
        g('AVS/AI and similar pensions', 'Rentes AVS/AI et semblables'),
      ],
      [
        'rentes',
        'Rentes, pensions et autres prestations',
        g('Other pensions and maintenance received', 'Autres rentes et pensions reçues'),
      ],
    ],
    { guide: 25 },
  ),
  page(
    'C2',
    12,
    'Autres revenus et fortune 2025',
    g('Other income and assets', 'Autres revenus et biens'),
    [
      ['autres-revenus', 'Autres revenus', g('Other income', 'Autres revenus')],
      ['autres-elements-fortune', 'Autres éléments de fortune', g('Other assets', 'Autres biens')],
      [
        'succession',
        'Succession non partagée, solde imposable',
        g('Undivided estate', 'Succession non partagée'),
      ],
    ],
    { guide: 26 },
  ),
  page(
    'C3',
    13,
    'Autres déductions 2025',
    g('Insurance', 'Assurances'),
    [
      ['assurances-vie', 'Assurances-vie et vieillesse', g('Life insurance', 'Assurances-vie')],
      [
        'assurances-maladie',
        'Assurances maladie et accidents',
        g('Health and accident insurance', 'Assurances maladie et accidents'),
      ],
      [
        'rentes-viageres',
        'Rentes viagères payées',
        g('Life annuities you pay', 'Rentes viagères versées'),
      ],
    ],
    { guide: 28 },
  ),
  page(
    'C4',
    14,
    'Autres déductions 2025',
    g('Other deductions', 'Autres déductions'),
    [
      [
        'pensions',
        'Pensions, contributions d’entretien versées',
        g('Maintenance you paid', 'Pensions versées'),
      ],
      [
        'prevoyance',
        'Déductions liées aux rentes de la prévoyance professionnelle',
        g('Pension fund pensions', 'Rentes du 2e pilier'),
      ],
      ['autres', 'Autres déductions', g('Other deductions', 'Autres déductions')],
    ],
    { guide: 29 },
  ),
  page(
    'D1',
    15,
    'Immeubles 2025',
    PROPERTY,
    [
      [
        'occupes',
        'Immeubles occupés par le propriétaire',
        g('Homes you live in', 'Logements que vous occupez'),
      ],
    ],
    { supported: false, guide: 32 },
  ),
  page(
    'D2',
    16,
    'Immeubles 2025',
    PROPERTY,
    [
      ['loues', 'Immeubles locatifs ou loués', g('Property you rent out', 'Immeubles loués')],
      [
        'commerciaux',
        'Immeubles commerciaux, industriels',
        g('Commercial property', 'Immeubles commerciaux'),
      ],
    ],
    { supported: false, guide: 34 },
  ),
  page(
    'D3',
    17,
    'Immeubles 2025',
    PROPERTY,
    [
      [
        'epargne-logement',
        'Immeubles épargne logement, PPE-HLM',
        g('Home-savings property', 'Épargne logement'),
      ],
      ['hlm', 'Immeubles HLM', g('HLM property', 'Immeubles HLM')],
    ],
    { supported: false, guide: 35 },
  ),
  page(
    'D4',
    18,
    'Déductions sur immeubles',
    PROPERTY,
    [['entretien', 'Frais d’entretien des immeubles', g('Upkeep costs', 'Frais d’entretien')]],
    { supported: false, guide: 36 },
  ),
  page(
    'E1',
    19,
    'Intérêts et dettes 2025',
    g('Debts and interest', 'Dettes et intérêts'),
    [
      [
        'chirographaires',
        'Intérêts et dettes chirographaires',
        g('Private loans', 'Emprunts privés'),
      ],
      ['hypothecaires', 'Intérêts et dettes hypothécaires', g('Mortgages', 'Hypothèques')],
    ],
    { guide: 37 },
  ),
  page(
    'E2',
    20,
    'Intérêts et dettes 2025',
    g('Debts and interest', 'Dettes et intérêts'),
    [
      [
        'exoneres',
        'Intérêts et dettes épargne logement PPE',
        g('Debts on tax-exempt property', 'Dettes sur immeubles exonérés'),
      ],
      ['totaux', 'Total de tous les intérêts et dettes', g('Total', 'Total')],
    ],
    { guide: 37 },
  ),
  page(
    'F1',
    21,
    'Etat des titres 2025 et demande d’imputations',
    g(
      'Accounts and securities: summary and tax credits',
      'Comptes et titres: récapitulation et imputations',
    ),
    [
      ['report', 'Report des feuilles F2, F3, F4, F5, F6', g('Totals', 'Totaux')],
      ['imputations', 'Imputations', g('Taxes withheld to reclaim', 'Impôts retenus à récupérer')],
    ],
    { guide: 38 },
  ),
  page(
    'F2',
    22,
    'Etat des titres 2025',
    g('Bank and postal accounts', 'Comptes bancaires et postaux'),
    [['comptes', 'Comptes bancaires et postaux', g('Accounts', 'Comptes')]],
    { guide: 40 },
  ),
  page(
    'F3',
    23,
    'Etat des titres 2025',
    g('Securities', 'Titres'),
    [['titres', 'Titres suisses et étrangers', g('Securities', 'Titres')]],
    { guide: 41 },
  ),
  page(
    'F4',
    24,
    'Etat des titres 2025',
    g('Tax statements from your bank', 'Relevés fiscaux'),
    [['releves', 'Relevés fiscaux', g('Tax statements', 'Relevés fiscaux')]],
    { guide: 43 },
  ),
  page(
    'G1',
    25,
    'Charge(s) de famille 2025',
    g('Dependent children', 'Enfants à charge'),
    [
      [
        'enfants',
        'Enfant(s) à charge, étudiant-e-s ou apprenti-e-s durant l’année 2025',
        g('Children', 'Enfants'),
      ],
    ],
    { guide: 46 },
  ),
  page(
    'G2',
    26,
    'Charge(s) de famille 2025',
    g('Other dependants', 'Autres personnes à charge'),
    [
      [
        'autres-personnes',
        'Autres personnes à charge',
        g('Other dependants', 'Autres personnes à charge'),
      ],
    ],
    { guide: 46 },
  ),
];

export const FORM_RUBRICS_2025: readonly FormRubric[] = [
  ...PG1,
  ...PG2,
  ...PG3,
  ...PG4,
  ...annexA('A1', 5, 'A'),
  ...annexA('A2', 6, 'B'),
  ...annexB('A'),
  ...annexB('B'),
  ...C1,
  ...C2,
  ...C3,
  ...C4,
  ...E,
  ...F,
  ...G,
];

export const FORM_2025: FormMap = {
  taxYear: 2025,
  formYear: 2025,
  provisional: false,
  pages: FORM_PAGES_2025,
  rubrics: FORM_RUBRICS_2025,
};
