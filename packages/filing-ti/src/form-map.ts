// Ticino's return (dichiarazione d'imposta delle persone fisiche, imposta cantonale e federale
// diretta, Modulo 1) and the forms that feed it, in the order you fill them in: Modulo 4 (spese
// professionali) for the taxpayer (its front) and for the spouse (its back), whose totals go to 9.1
// and 9.2; Modulo 6 (oneri assicurativi, cure prestate da terzi, spese per malattia e infortunio),
// behind 12, 20 and 22.1; Modulo 5 (elenco debiti, liberalità, partiti), behind 13.2, 33.1, 24 and
// 15.2; then Modulo 1's page 2, the income (redditi), page 3, the deductions down to the taxable
// income 28 (deduzioni, calcolo del reddito imponibile), and page 4, the wealth (sostanza). Every
// line with its number (the cifra, or Modulo 4's field number printed at its right) and its Italian
// label; the gloss says what it is in plain words.
//
// Sources (docs/sources/ti/manifest.json): Modulo 4, 5 and 6 as published, in Italian
// (ti-2025-form-modulo-4: the taxpayer on p. 1, the spouse on p. 2 with the field numbers 50 higher;
// ti-2025-form-modulo-5; ti-2025-form-modulo-6); Modulo 1, which the canton publishes only as a
// German translation (ti-2025-form-modulo-1-de: its cifre, subtotals and the person rows), with the
// Italian terms of the 2025 instructions, which explain each cifra under the same number
// (ti-2025-guide-istruzioni-pf-pdf; "p." is the PDF page, the instructions print the same numbers).
// No 2026 return or instructions are published yet (docs/sources/ti/NOTES.md, Gaps): tax year 2026
// uses the 2025 forms, flagged provisional.
//
// Columns (TI_COPY_LABELS, ./items.ts): the return has ONE amount column for both taxes; the
// authority derives the federal tax from it (ti-2025-guide-istruzioni-pf-pdf p. 5 and 47). Page 2
// heads it "Redditi 2025" (here 'icc_ifd': one amount for both taxes), Modulo 4 and page 3
// "Deduzioni 2025" ('amount'), page 4 "Valore fiscale al 31 dicembre 2025" ('wealth'), Modulo 6
// "Importi effettivi 2025" ('amount').
//
// Labels: without the amounts and rates some of them print (Modulo 4's "Fr. 15.-", "Fr. 3'000.-",
// page 3's "max. Fr. 10'700.-"): those are the engine's, each cited there (packages/rules-ti), and
// the 2026 amounts differ.
//
// Not mapped: page 1 (personal details, children, the refund of the withholding tax), the
// information lines of page 4 (abroad, capital benefits), and the securities list (Modulo 2) behind
// 4.1 and 29.1: the line gets the total it carries. What Taxpresso doesn't prepare (self-employment,
// board fees, property, lottery winnings, capital payments, disability costs, permanent charges and
// annuities paid, children in education, dependants, shift work, weekly stays, a side job's actual
// costs) is listed, marked unsupported.
import type {
  FormColumn,
  FormMap,
  FormPage,
  FormPerson,
  FormRubric,
  Gloss,
} from '@taxpresso/filing-ge';
import type { Text } from '@taxpresso/rules-ch';

/** Modulo 4 (taxpayer, spouse), Modulo 6, Modulo 5, then Modulo 1's pages 2, 3 and 4. */
export const TI_PAGE_IDS = ['M4-1', 'M4-2', 'M6', 'M5', 'P2', 'P3', 'P4'] as const;
export type TiPageId = (typeof TI_PAGE_IDS)[number];

const FORM = 'ti-2025-form-modulo-1-de';
const M4 = 'ti-2025-form-modulo-4';
const M5 = 'ti-2025-form-modulo-5';
const M6 = 'ti-2025-form-modulo-6';
const GUIDE = 'ti-2025-guide-istruzioni-pf-pdf';

/** Modulo 4's total for each person, which page 3 carries to 9.1 and 9.2. */
export const TI_MODULO4_TOTAL = { p1: '438', p2: '488' } as const;

/** Taxpresso's keys for the lines of Modulo 5 and 6 that carry no number. */
export const TI_FORM_KEYS = {
  premiums: 'M6-A',
  premiumsMax: 'M6-B',
  premiumsAllowed: 'M6-3',
  childcarePaid: 'M6-cure',
  childcareTotal: 'M6-cure-tot',
  medicalCosts: 'M6-malattia',
  medicalThreshold: 'M6-franchigia',
  debts: 'M5-A-debiti',
  interest: 'M5-A-interessi',
  donations: 'M5-liberalita',
  parties: 'M5-partiti',
} as const;

type Options = Partial<
  Pick<
    FormRubric<TiPageId>,
    'person' | 'nature' | 'role' | 'format' | 'columns' | 'supported' | 'repeats'
  >
> & {
  guide?: string;
  /** The line's number as printed (a Modulo 4 field number, a cifra), when it is not the key. */
  code?: string;
  /** The form prints the line without a number: cited, not in the label. */
  unnumbered?: boolean;
};

/** French typography: a no-break space before a colon and a percent sign. */
const frTypo = (s: string) => s.replace(/ ?: /g, ' : ').replace(/ %/g, ' %');

const g = (en: string, fr: string): Gloss => ({ en, fr: frTypo(fr) });

/** Page 2: "Redditi 2025", one amount for the cantonal and the federal tax. */
const INCOME: readonly FormColumn[] = ['icc_ifd'];
/** Modulo 4, 5, 6 and page 3: the same one column. */
const DEDUCTION: readonly FormColumn[] = ['amount'];
/** Page 4: "Valore fiscale al 31 dicembre 2025". */
const WEALTH: readonly FormColumn[] = ['wealth'];
const A = { person: 'A' as FormPerson };
const B = { person: 'B' as FormPerson };
const OUT = { supported: false };
const TOTAL = { role: 'total' as const };
const COMPUTED = { role: 'computed' as const };

/**
 * A line maker for one section of one page, with that section's defaults. `number` leads the label
 * as printed and is cited with the page.
 */
function on(page: TiPageId, at: string, section: string, defaults: Options) {
  return (
    key: string,
    number: string,
    label: string,
    en: string,
    fr: string,
    options: Options = {},
  ): FormRubric<TiPageId> => {
    const o = { ...defaults, ...options };
    const code = o.unnumbered ? undefined : (o.code ?? key);
    return {
      key,
      ...(code !== undefined ? { code } : {}),
      page,
      section,
      person: o.person ?? 'household',
      label: o.unnumbered ? label : `${number} ${label}`,
      gloss: g(en, fr),
      nature: o.nature ?? 'deduction',
      role: o.role ?? 'input',
      format: o.format ?? 'money',
      columns: o.columns ?? DEDUCTION,
      ...(o.repeats ? { repeats: o.repeats } : {}),
      supported: o.supported ?? true,
      source: `${at} (${o.unnumbered ? label : `cifra ${number.replace(/\.$/, '')}`})${o.guide !== undefined ? `; ${GUIDE} p. ${o.guide}` : ''}`,
    };
  };
}

// ---- Modulo 4: Spese professionali, the taxpayer (front) and the spouse (back) ------------------

/** Modulo 4 for one person: the same lines on both sides, the spouse's numbers 50 higher. */
function modulo4(n: 1 | 2): FormRubric<TiPageId>[] {
  const page: TiPageId = n === 1 ? 'M4-1' : 'M4-2';
  const at = `${M4} p. ${n}`;
  const who = n === 1 ? A : B;
  const m4 = (section: string, more: Options = {}) => on(page, at, section, { ...who, ...more });
  const code = (c: number) => String(c + (n - 1) * 50);
  const p = (en: string) => `${en}, ${n === 1 ? 'taxpayer' : 'spouse'}`;
  const pf = (fr: string) => `${fr}, ${n === 1 ? 'contribuable' : 'conjoint'}`;
  const travel = m4('trasporto', { guide: '23' });
  const meals = m4('doppia', { guide: '24' });
  const week = m4('rientro', { ...OUT, guide: '24' });
  const other = m4('altre', { guide: '24' });
  const side = m4('accessoria', { guide: '25' });
  const total = m4('totale', { ...TOTAL, guide: '23' });
  return [
    travel(
      code(400),
      '2.1',
      'Abbonamento del mezzo pubblico di trasporto',
      p('Public transport to work: what it cost'),
      pf('Transports publics pour aller au travail : ce qu’ils ont coûté'),
    ),
    travel(
      code(402),
      '2.2',
      'Veicolo privato (automobile, motocicletta oltre 50 cmc)',
      p('Car or motorbike, when public transport can’t be used: km driven x the rate per km'),
      pf(
        'Voiture ou moto, quand les transports publics ne sont pas utilisables : km parcourus x le tarif par km',
      ),
    ),
    travel(
      code(404),
      '2.3',
      'Bicicletta, ciclomotore o motoleggera',
      p('Bike, moped or small motorbike (yellow plate): what it cost, up to a yearly maximum'),
      pf(
        'Vélo, cyclomoteur ou petite moto (plaque jaune) : ce qu’ils ont coûté, jusqu’à un maximum annuel',
      ),
    ),
    meals(
      code(408),
      '3.1',
      'Per ogni pasto principale fuori casa',
      p('Main meals away from home: the working days times the day rate, up to a yearly maximum'),
      pf(
        'Repas principaux hors du domicile : les jours de travail fois le forfait journalier, jusqu’à un maximum annuel',
      ),
    ),
    meals(
      code(410),
      '3.2',
      'Per lavoro a turni o notturno',
      p('Shift or night work'),
      pf('Travail en équipes ou de nuit'),
      OUT,
    ),
    week(
      code(414),
      '4.1',
      'Alloggio senza cucina',
      p('Weekly stay away from home: lodging without a kitchen'),
      pf('Séjour hebdomadaire : logement sans cuisine'),
    ),
    week(
      code(416),
      '4.2',
      'Vitto',
      p('Weekly stay away from home: meals'),
      pf('Séjour hebdomadaire : repas'),
    ),
    week(
      code(418),
      '4.3',
      'Alloggio con cucina',
      p('Weekly stay away from home: lodging with a kitchen'),
      pf('Séjour hebdomadaire : logement avec cuisine'),
    ),
    week(
      code(419),
      '4.4',
      'Vitto',
      p('Weekly stay away from home with a kitchen: meals'),
      pf('Séjour hebdomadaire avec cuisine : repas'),
    ),
    other(
      code(420),
      '5.1',
      'Altre spese professionali, forfait',
      p('Other professional costs: the flat amount (halved for a work rate under 50 %)'),
      pf(
        'Autres frais professionnels : le forfait (réduit de moitié sous un taux d’activité de 50 %)',
      ),
    ),
    other(
      code(422),
      '5.2',
      'In sostituzione del forfait: le spese effettive',
      p('Other professional costs: the actual costs, instead of the flat amount (with a list)'),
      pf(
        'Autres frais professionnels : les frais effectifs, à la place du forfait (avec une liste)',
      ),
    ),
    side(
      code(432),
      '6.1',
      'Spese per attività accessoria dipendente, forfait',
      p('Side job: the flat amount'),
      pf('Activité accessoire : le forfait'),
    ),
    side(
      code(434),
      '6.2',
      'In sostituzione del forfait: le spese effettive',
      p('Side job: the actual costs, instead of the flat amount'),
      pf('Activité accessoire : les frais effectifs, à la place du forfait'),
      OUT,
    ),
    total(
      code(438),
      '7.',
      'Totale delle spese professionali',
      p(`Total professional costs, carried to page 3, 9.${n}`),
      pf(`Total des frais professionnels, reporté en page 3, 9.${n}`),
    ),
  ];
}

// ---- Modulo 6: oneri assicurativi, cure prestate da terzi, spese per malattia e infortunio -------

function modulo6(): FormRubric<TiPageId>[] {
  const ins = on('M6', `${M6} p. 1`, 'oneri', { guide: '26' });
  const care = on('M6', `${M6} p. 1`, 'cure', { guide: '29' });
  const ill = on('M6', `${M6} p. 2`, 'malattia', { guide: '30' });
  const K = TI_FORM_KEYS;
  return [
    ins(
      'M6-1a',
      '1.a',
      'Assicurazione malattia privata (al netto dell’eventuale sussidio)',
      'Health insurance premiums, less any subsidy: from your insurer’s attestation',
      'Primes d’assurance-maladie, moins un éventuel subside : selon l’attestation de votre assureur',
      { code: '1.a' },
    ),
    ins(
      'M6-1b',
      '1.b',
      'Assicurazione infortuni privata',
      'Private accident insurance (not the compulsory one)',
      'Assurance accidents privée (pas l’assurance obligatoire)',
      { code: '1.b' },
    ),
    ins(
      'M6-1c',
      '1.c',
      'Assicurazioni private sulla vita e di rendita vitalizia',
      'Life and annuity insurance premiums',
      'Primes d’assurance-vie et de rente viagère',
      { code: '1.c' },
    ),
    ins(
      'M6-1d',
      '1.d',
      'Interessi su capitali a risparmio (riporto da Modulo 2)',
      'Interest on savings, from the securities list',
      'Intérêts de capitaux d’épargne, selon l’état des titres',
      { code: '1.d' },
    ),
    ins(
      'M6-1e',
      '1.e',
      'Assicurazione perdita di guadagno in caso di malattia',
      'Loss of earnings insurance in case of illness',
      'Assurance perte de gain en cas de maladie',
      { code: '1.e', ...OUT },
    ),
    ins(
      K.premiums,
      '(A)',
      'Totale oneri assicurativi e interessi su capitali a risparmio',
      'Total premiums and savings interest (A): what you paid',
      'Total des primes et intérêts d’épargne (A) : ce que vous avez payé',
      { ...TOTAL, code: '(A)' },
    ),
    ins(
      K.premiumsMax,
      '(B)',
      'Totale deduzione massima per oneri assicurativi e interessi su capitali a risparmio',
      'The most that can be deducted (B), for spouses or other taxpayers, per child, and without pension contributions',
      'Le maximum déductible (B), pour les époux ou les autres contribuables, par enfant, et sans cotisations de prévoyance',
      { ...COMPUTED, code: '(B)' },
    ),
    ins(
      K.premiumsAllowed,
      '3.',
      'Deduzione ammessa: l’importo minore tra (A) e (B)',
      'The deduction: the lower of (A) and (B), carried to page 3, 12',
      'La déduction : le plus petit de (A) et (B), reporté en page 3, 12',
      { ...COMPUTED, code: '3' },
    ),
    care(
      K.childcarePaid,
      '',
      'Cura prestata da terzi a figli/ie di età inferiore ai 14 anni: importo pagato',
      'Childcare by others for a child under 14: what you paid for this child',
      'Garde par des tiers d’un enfant de moins de 14 ans : ce que vous avez payé pour cet enfant',
      { unnumbered: true, repeats: 4 },
    ),
    care(
      K.childcareTotal,
      '',
      'Cura prestata da terzi: totale',
      'Childcare by others: the deduction, carried to page 3, 20 (at most the limit per child)',
      'Garde par des tiers : la déduction, reportée en page 3, 20 (au plus la limite par enfant)',
      { unnumbered: true, ...COMPUTED },
    ),
    ill(
      K.medicalCosts,
      '',
      'Totale delle spese di malattia e/o infortunio a carico del/della contribuente',
      'Illness and accident costs you bore yourself, after what the insurers paid: carried to page 3, 22.1 a',
      'Frais de maladie et d’accident restés à votre charge, après les remboursements : reportés en page 3, 22.1 a',
      { unnumbered: true },
    ),
    ill(
      K.medicalThreshold,
      '',
      'Franchigia fiscale: 5% del reddito netto intermedio II (cifra 21)',
      'The threshold: 5 % of the net income II (21), carried to page 3, 22.1 b',
      'La franchise : 5 % du revenu net II (21), reportée en page 3, 22.1 b',
      { unnumbered: true, ...COMPUTED },
    ),
  ];
}

// ---- Modulo 5: elenco debiti, liberalità e versamenti a partiti politici ------------------------

function modulo5(): FormRubric<TiPageId>[] {
  const debts = on('M5', `${M5} p. 1`, 'debiti', { guide: '27' });
  const gifts = on('M5', `${M5} p. 2`, 'liberalita', { guide: '29 and 30' });
  const K = TI_FORM_KEYS;
  return [
    debts(
      K.debts,
      '',
      'Totale dei debiti privati al 31.12',
      'Private debts on 31 December, carried to page 4, 33.1',
      'Dettes privées au 31 décembre, reportées en page 4, 33.1',
      { unnumbered: true, columns: WEALTH, nature: 'wealth' },
    ),
    debts(
      K.interest,
      '',
      'Totale degli interessi passivi privati',
      'Private debt interest paid in the year, carried to page 3, 13.2',
      'Intérêts de dettes privées payés dans l’année, reportés en page 3, 13.2',
      { unnumbered: true },
    ),
    gifts(
      K.donations,
      '',
      'Totale delle liberalità',
      'Donations to tax-exempt bodies, up to 20 % of 23: carried to page 3, 24',
      'Dons aux institutions d’utilité publique, jusqu’à 20 % du 23 : reportés en page 3, 24',
      { unnumbered: true },
    ),
    gifts(
      K.parties,
      '',
      'Totale dei versamenti ai partiti politici',
      'Payments to political parties, up to the yearly maximum: carried to page 3, 15.2',
      'Versements aux partis politiques, jusqu’au maximum annuel : reportés en page 3, 15.2',
      { unnumbered: true },
    ),
  ];
}

// ---- Modulo 1, page 2: redditi -------------------------------------------------------------------

function page2(): FormRubric<TiPageId>[] {
  const p2 = (section: string, more: Options = {}) =>
    on('P2', `${FORM} p. 2`, section, { nature: 'income', columns: INCOME, ...more });
  const job = p2('dipendente', { guide: '13' });
  const self = p2('indipendente', { ...OUT, guide: '14' });
  const pensions = p2('pensioni', { guide: '16' });
  const wealth = p2('mobiliare', { guide: '17' });
  const property = p2('immobiliare', { ...OUT, guide: '18 and 19' });
  const other = p2('altri', { guide: '21' });
  const capital = p2('capitale', { ...OUT, guide: '22' });
  return [
    job(
      '1.1',
      '1.1',
      'Attività dipendente principale, contribuente',
      'Main job, net salary (salary certificate, box 8 less boxes 9 and 10.1), taxpayer',
      'Activité principale, salaire net (certificat de salaire, chiffre 8 moins chiffres 9 et 10.1), contribuable',
      A,
    ),
    job(
      '1.1',
      '1.1',
      'Attività dipendente principale, coniuge',
      'Main job, net salary (salary certificate, box 8 less boxes 9 and 10.1), spouse',
      'Activité principale, salaire net (certificat de salaire, chiffre 8 moins chiffres 9 et 10.1), conjoint',
      B,
    ),
    job(
      '1.2',
      '1.2',
      'Attività dipendente accessoria, contribuente',
      'Side job, net salary, taxpayer',
      'Activité accessoire, salaire net, contribuable',
      A,
    ),
    job(
      '1.2',
      '1.2',
      'Attività dipendente accessoria, coniuge',
      'Side job, net salary, spouse',
      'Activité accessoire, salaire net, conjoint',
      B,
    ),
    job(
      '1.3',
      '1.3',
      'Indennità quale amministratore/trice di persone giuridiche',
      'Fees as a board member of a company',
      'Indemnités d’administrateur d’une personne morale',
      { ...OUT, guide: '14' },
    ),
    self(
      '2.1',
      '2.1',
      'Attività indipendente principale',
      'Self-employment, main activity',
      'Activité indépendante principale',
    ),
    self(
      '2.2',
      '2.2',
      'Attività indipendente accessoria',
      'Self-employment, side activity',
      'Activité indépendante accessoire',
    ),
    self(
      '2.3',
      '2.3',
      'Partecipazioni a società in nome collettivo, in accomandita e semplici',
      'Share in a partnership',
      'Part à une société de personnes',
    ),
    self(
      '2.4',
      '2.4',
      'Comunioni ereditarie e altre indivisioni',
      'Business of an estate or other undivided property',
      'Activité d’une hoirie ou d’une autre indivision',
    ),
    ...(
      [
        [
          '3.1',
          'Pensioni della previdenza professionale e individuale vincolata',
          'Pension fund and pillar 3a pensions',
          'Rentes du 2e pilier et du pilier 3a',
        ],
        ['3.2', 'Rendite AVS e AI', 'AVS and AI pensions', 'Rentes AVS et AI'],
        [
          '3.3',
          'Rendite vitalizie e altre rendite',
          'Life annuities (their taxable part) and other pensions',
          'Rentes viagères (leur part imposable) et autres rentes',
        ],
        [
          '3.4',
          'Indennità per perdita di guadagno',
          'Unemployment and other loss-of-earnings allowances, when not on a salary certificate',
          'Indemnités de chômage et autres pertes de gain, hors certificat de salaire',
        ],
        [
          '3.5',
          'Indennità giornaliere dell’assicurazione malattia e infortuni',
          'Sickness and accident daily allowances, when not on a salary certificate',
          'Indemnités journalières maladie et accident, hors certificat de salaire',
        ],
      ] as const
    ).flatMap(([c, it, en, fr]) => [
      pensions(c, c, `${it}, contribuente`, `${en}, taxpayer`, `${fr}, contribuable`, A),
      pensions(c, c, `${it}, coniuge`, `${en}, spouse`, `${fr}, conjoint`, B),
    ]),
    pensions(
      '3.6',
      '3.6',
      'Alimenti',
      'Alimony received for yourself and child support for minor children',
      'Pensions alimentaires reçues pour vous et pour les enfants mineurs',
    ),
    wealth(
      '4.1',
      '4.1',
      'Redditi da titoli e capitali (Modulo 2)',
      'Income from accounts and securities: the total of the securities list',
      'Rendement des avoirs et titres : le total de l’état des titres',
    ),
    wealth(
      '4.2',
      '4.2',
      'Altri redditi della sostanza mobiliare',
      'Other income from movable wealth',
      'Autres rendements de la fortune mobilière',
      OUT,
    ),
    property(
      '5.4',
      '5.4',
      'Reddito immobiliare lordo (Modulo 7)',
      'Income from property, gross',
      'Rendement immobilier brut',
    ),
    property(
      '5.5',
      '5.5',
      'Spese di gestione e manutenzione di immobili (Modulo 7)',
      'Property costs',
      'Frais d’entretien des immeubles',
      { nature: 'deduction' },
    ),
    property(
      '5.7',
      '5.7',
      'Altri redditi immobiliari',
      'Other income from property',
      'Autres revenus immobiliers',
    ),
    other(
      '6.1',
      '6.1',
      'Redditi da brevetti, licenze e diritti d’autore',
      'Income from patents, licences and copyright',
      'Revenus de brevets, licences et droits d’auteur',
      OUT,
    ),
    other(
      '6.2',
      '6.2',
      'Vincite a giochi in denaro',
      'Lottery and gambling winnings',
      'Gains de loterie et de jeux',
      OUT,
    ),
    other(
      '6.3',
      '6.3',
      'Ogni altro reddito imponibile',
      'Other taxable income',
      'Autres revenus imposables',
    ),
    capital(
      '7',
      '7.',
      'Liquidazioni in capitale per prestazioni ricorrenti',
      'Lump sums paid for recurring benefits',
      'Versements en capital pour des prestations périodiques',
    ),
    p2('totale', TOTAL)(
      '8',
      '8.',
      'Totale dei redditi',
      'Total income, carried to page 3, 17',
      'Total des revenus, reporté en page 3, 17',
    ),
  ];
}

// ---- Modulo 1, page 3: deduzioni e calcolo del reddito imponibile -------------------------------

function page3(): FormRubric<TiPageId>[] {
  const p3 = (section: string, more: Options = {}) => on('P3', `${FORM} p. 3`, section, more);
  const prof = p3('professionali', { guide: '23' });
  const legal = p3('legge', { guide: '25' });
  const pillar = p3('vincolata', { guide: '25' });
  const ins = p3('assicurativi', { guide: '26' });
  const interest = p3('interessi', { guide: '26 and 27' });
  const alimony = p3('alimenti', { guide: '28' });
  const more = p3('altre', { guide: '29' });
  const calc = p3('calcolo', { ...TOTAL, guide: '29 to 32' });
  const extra = p3('supplementari', { guide: '30' });
  const social = p3('sociali', { guide: '30' });
  return [
    prof(
      '9.1',
      '9.1',
      'Spese professionali dei dipendenti, contribuente (Modulo 4)',
      'Professional costs, taxpayer: the total of Modulo 4 (438)',
      'Frais professionnels, contribuable : le total du Modulo 4 (438)',
      { ...A, role: 'report' },
    ),
    prof(
      '9.2',
      '9.2',
      'Spese professionali dei dipendenti, coniuge (Modulo 4)',
      'Professional costs, spouse: the total of Modulo 4 (488)',
      'Frais professionnels, conjoint : le total du Modulo 4 (488)',
      { ...B, role: 'report' },
    ),
    legal(
      '10.1',
      '10.1',
      'Contributi AVS/AI/IPG/AD, se non già dedotti alla cifra 1',
      'AVS contributions not already taken off the salary on 1.1',
      'Cotisations AVS non déjà déduites du salaire au 1.1',
      OUT,
    ),
    legal(
      '10.2',
      '10.2',
      'Assicurazione obbligatoria infortuni non professionali, se non già dedotta',
      'Compulsory non-occupational accident insurance not already taken off the salary',
      'Assurance obligatoire accidents non professionnels non déjà déduite',
      OUT,
    ),
    legal(
      '10.3',
      '10.3',
      'Previdenza professionale, riscatti di anni di assicurazione (2° pilastro e 3° pilastro A)',
      'Pension fund buy-ins (salary certificate box 10.2, or paid directly) and, from 2026, a pillar 3a catch-up',
      'Rachats dans la caisse de pension (certificat de salaire chiffre 10.2, ou versés directement) et, dès 2026, un rachat 3a',
    ),
    pillar(
      '11.1',
      '11.1',
      'Previdenza individuale vincolata (3° pilastro A), contribuente',
      'Paid into pillar 3a, taxpayer, up to the limit (attestation)',
      'Versé au pilier 3a, contribuable, jusqu’à la limite (attestation)',
      A,
    ),
    pillar(
      '11.2',
      '11.2',
      'Previdenza individuale vincolata (3° pilastro A), coniuge',
      'Paid into pillar 3a, spouse, up to the limit (attestation)',
      'Versé au pilier 3a, conjoint, jusqu’à la limite (attestation)',
      B,
    ),
    ins(
      '12',
      '12.',
      'Oneri assicurativi e interessi di capitali a risparmio (Modulo 6)',
      'Insurance premiums and savings interest: the deduction of Modulo 6 (3.)',
      'Primes d’assurance et intérêts d’épargne : la déduction du Modulo 6 (3.)',
      { role: 'report' },
    ),
    interest(
      '13.1',
      '13.1',
      'Spese di amministrazione dei titoli',
      'Costs of keeping securities: the actual costs',
      'Frais de gestion des titres : les frais effectifs',
    ),
    interest(
      '13.2',
      '13.2',
      'Interessi passivi privati (Modulo 5)',
      'Private debt interest, up to the income from wealth plus a fixed amount',
      'Intérêts de dettes privées, jusqu’au rendement de la fortune plus un montant fixe',
    ),
    interest(
      '13.3',
      '13.3',
      'Interessi passivi aziendali (Modulo 5)',
      'Business debt interest',
      'Intérêts de dettes commerciales',
      OUT,
    ),
    alimony(
      '14.1',
      '14.1',
      'Alimenti versati al coniuge divorziato o separato',
      'Alimony paid to a former spouse',
      'Pension alimentaire versée à l’ex-conjoint',
    ),
    alimony(
      '14.2',
      '14.2',
      'Alimenti per i figli minorenni',
      'Child support paid for minor children',
      'Contributions d’entretien versées pour les enfants mineurs',
    ),
    alimony('14.3', '14.3', 'Oneri permanenti', 'Permanent charges', 'Charges durables', OUT),
    alimony(
      '14.4',
      '14.4',
      'Rendite vitalizie pagate',
      'Life annuities paid',
      'Rentes viagères versées',
      OUT,
    ),
    more(
      '15.1',
      '15.1',
      'Spese per disabilità (Modulo 6.1)',
      'Disability costs',
      'Frais liés à un handicap',
      OUT,
    ),
    more(
      '15.2',
      '15.2',
      'Versamenti a partiti politici (Modulo 5)',
      'Payments to political parties, up to the yearly maximum',
      'Versements aux partis politiques, jusqu’au maximum annuel',
    ),
    more(
      '15.3',
      '15.3',
      'Spese di formazione e formazione continua professionali, contribuente',
      'Professional training, taxpayer, up to the yearly maximum',
      'Formation continue, contribuable, jusqu’au maximum annuel',
      A,
    ),
    more(
      '15.4',
      '15.4',
      'Spese di formazione e formazione continua professionali, coniuge',
      'Professional training, spouse, up to the yearly maximum',
      'Formation continue, conjoint, jusqu’au maximum annuel',
      B,
    ),
    more(
      '15.5',
      '15.5',
      'Deduzione per attività lucrativa di entrambi i coniugi',
      'Both spouses work: up to the yearly amount, never more than the lower income',
      'Activité des deux conjoints : jusqu’au montant annuel, jamais plus que le revenu le plus bas',
      COMPUTED,
    ),
    calc(
      '16',
      '16.',
      'Totale delle deduzioni',
      'Total deductions, carried to 18',
      'Total des déductions, reporté au 18',
    ),
    calc(
      '17',
      '17.',
      'Totale dei redditi (cifra 8)',
      'Total income, from page 2, 8',
      'Total des revenus, de la page 2, 8',
      { role: 'report' },
    ),
    calc(
      '18',
      '18.',
      'Totale delle deduzioni (cifra 16)',
      'Total deductions, from 16',
      'Total des déductions, du 16',
      { role: 'report' },
    ),
    calc(
      '19',
      '19.',
      'Reddito netto I (cifra 17 dedotta la cifra 18)',
      'Net income I: 17 less 18',
      'Revenu net I : 17 moins 18',
    ),
    p3('cure', { guide: '29' })(
      '20',
      '20.',
      'Deduzione cure prestate da terzi a figli/ie di età inferiore ai 14 anni (Modulo 6)',
      'Childcare by others for children under 14, at most the limit per child',
      'Garde des enfants de moins de 14 ans par des tiers, au plus la limite par enfant',
      { role: 'report' },
    ),
    calc(
      '21',
      '21.',
      'Reddito netto intermedio II',
      'Net income II: 19 less 20',
      'Revenu net II : 19 moins 20',
    ),
    extra(
      '22.1a',
      '22.1 a)',
      'Spese per malattia e infortunio (Modulo 6)',
      'Illness and accident costs you bore, from Modulo 6',
      'Frais de maladie et d’accident à votre charge, selon le Modulo 6',
      { code: '22.1 a', role: 'report' },
    ),
    extra(
      '22.1b',
      '22.1 b)',
      'Franchigia del 5% del reddito netto intermedio II (cifra 21)',
      'The threshold: 5 % of 21',
      'La franchise : 5 % du 21',
      { code: '22.1 b', ...COMPUTED },
    ),
    extra(
      '22.1',
      '22.1 c)',
      'Deduzione',
      'Illness and accident costs deducted: a less b',
      'Frais de maladie et d’accident déduits : a moins b',
      { code: '22.1 c', ...COMPUTED },
    ),
    calc(
      '23',
      '23.',
      'Reddito netto intermedio III',
      'Net income III: 21 less 22.1',
      'Revenu net III : 21 moins 22.1',
    ),
    p3('liberalita', { guide: '30' })(
      '24',
      '24.',
      'Liberalità a enti di pubblica utilità (Modulo 5)',
      'Donations to tax-exempt bodies, at most 20 % of 23',
      'Dons aux institutions d’utilité publique, au plus 20 % du 23',
      { role: 'report' },
    ),
    social(
      '25.1',
      '25.1',
      'Deduzione per ogni figlio a carico',
      'The child deduction, for each child you provide for (half in shared custody without child support)',
      'La déduction pour enfant, par enfant à votre charge (moitié en garde partagée sans contribution d’entretien)',
      COMPUTED,
    ),
    social(
      '25.2',
      '25.2',
      'Deduzione per ogni figlio agli studi',
      'Children in education',
      'Enfants aux études',
      OUT,
    ),
    social(
      '25.3',
      '25.3',
      'Deduzione per persone bisognose a carico',
      'Dependants you support',
      'Personnes à charge',
      OUT,
    ),
    calc(
      '26',
      '26.',
      'Reddito netto',
      'Net income IV: 23 less 24 and 25',
      'Revenu net IV : 23 moins 24 et 25',
    ),
    p3('esente', { guide: '32' })(
      '27',
      '27.',
      'Quota esente per beneficiari AVS-AI',
      'The exemption for AVS and AI pensioners, by the table (cantonal tax)',
      'Le montant exonéré des bénéficiaires AVS et AI, selon le tableau (impôt cantonal)',
      COMPUTED,
    ),
    calc(
      '28',
      '28.',
      'Reddito imponibile complessivo (cifra 26 dedotta la cifra 27)',
      'Taxable income: 26 less 27',
      'Revenu imposable : 26 moins 27',
    ),
  ];
}

// ---- Modulo 1, page 4: sostanza -----------------------------------------------------------------

function page4(): FormRubric<TiPageId>[] {
  const p4 = (section: string, more: Options = {}) =>
    on('P4', `${FORM} p. 4`, section, { nature: 'wealth', columns: WEALTH, ...more });
  const movable = p4('mobiliare', { guide: '33 and 34' });
  const property = p4('immobiliare', { ...OUT, guide: '35' });
  const business = p4('aziendale', { ...OUT, guide: '35' });
  const debts = p4('debiti', { guide: '36' });
  const social = p4('sociali', { ...COMPUTED, guide: '36' });
  const total = p4('totale', { ...TOTAL, guide: '33 to 36' });
  return [
    movable(
      '29.1',
      '29.1',
      'Titoli e crediti (Modulo 2)',
      'Accounts and securities: the total of the securities list',
      'Avoirs et titres : le total de l’état des titres',
    ),
    movable(
      '29.2',
      '29.2',
      'Denaro contante, oro e altri metalli preziosi',
      'Cash, gold and other precious metals',
      'Numéraire, or et autres métaux précieux',
    ),
    movable(
      '29.3',
      '29.3',
      'Assicurazioni sulla vita e di rendita vitalizia, valore di riscatto',
      'Life and annuity insurance, surrender value',
      'Assurances sur la vie et de rente, valeur de rachat',
    ),
    movable(
      '29.4',
      '29.4',
      'Veicoli a motore',
      'Motor vehicles, market value',
      'Véhicules à moteur, valeur vénale',
    ),
    movable(
      '29.5',
      '29.5',
      'Altri elementi della sostanza mobiliare',
      'Other movable assets (boats, collections...), without household goods',
      'Autres éléments de fortune mobilière (bateaux, collections...), sans le mobilier de ménage',
    ),
    property('30.1', '30.1', 'Sostanza immobiliare (Modulo 7)', 'Property', 'Immeubles'),
    business(
      '31.1',
      '31.1',
      'Capitale investito in società in nome collettivo, in accomandita e semplici',
      'Capital in partnerships',
      'Capital investi dans des sociétés de personnes',
    ),
    business(
      '31.2',
      '31.2',
      'Sostanza aziendale dell’attività indipendente',
      'Business assets of a self-employment',
      'Fortune commerciale d’une activité indépendante',
    ),
    total('32', '32.', 'Totale della sostanza', 'Total assets', 'Total de la fortune'),
    debts(
      '33.1',
      '33.1',
      'Debiti privati (Modulo 5)',
      'Private debts on 31 December',
      'Dettes privées au 31 décembre',
    ),
    debts(
      '33.2',
      '33.2',
      'Debiti aziendali (Modulo 5)',
      'Business debts',
      'Dettes commerciales',
      OUT,
    ),
    total(
      '34',
      '34.',
      'Sostanza netta (cifra 32 dedotte le cifre 33.1 e 33.2)',
      'Net wealth: 32 less the debts',
      'Fortune nette : 32 moins les dettes',
    ),
    social(
      '35.1',
      '35.1',
      'Deduzione sociale per i coniugi',
      'Tax-free amount for spouses living together',
      'Montant exonéré des époux faisant ménage commun',
    ),
    social(
      '35.2',
      '35.2',
      'Deduzione sociale per ogni figlio minorenne',
      'Tax-free amount for each minor child',
      'Montant exonéré par enfant mineur',
    ),
    total(
      '36',
      '36.',
      'Sostanza imponibile complessiva (cifra 34 dedotte le cifre 35.1 e 35.2)',
      'Taxable wealth: 34 less 35',
      'Fortune imposable : 34 moins 35',
    ),
  ];
}

// ---- Pages -------------------------------------------------------------------------------------

const section = (id: string, title: string, en: string, fr: string) => ({
  id,
  title,
  gloss: g(en, fr),
});

function modulo4Page(n: 1 | 2, y: number): FormPage<TiPageId> {
  return {
    id: n === 1 ? 'M4-1' : 'M4-2',
    title: `Spese professionali ${n === 1 ? 'del/della contribuente' : 'del coniuge/partner registrato'}, Modulo 4 ${y}`,
    gloss: g(
      `Professional costs of the ${n === 1 ? 'taxpayer' : 'spouse'} (Modulo 4, ${n === 1 ? 'front' : 'back'}): the total goes to page 3, 9.${n}`,
      `Frais professionnels du ${n === 1 ? 'contribuable' : 'conjoint'} (Modulo 4, ${n === 1 ? 'recto' : 'verso'}) : le total va en page 3, 9.${n}`,
    ),
    person: n === 1 ? 'A' : 'B',
    pdfPage: n,
    supported: true,
    sections: [
      section(
        'trasporto',
        '2. Spese di trasporto dal domicilio al luogo di lavoro',
        'Travel to work',
        'Frais de déplacement',
      ),
      section(
        'doppia',
        '3. Spese supplementari per doppia economia domestica',
        'Meals away from home',
        'Repas hors du domicile',
      ),
      section(
        'rientro',
        '4. Spese supplementari in caso di rientro settimanale al domicilio',
        'Weekly stay away from home',
        'Séjour hebdomadaire hors du domicile',
      ),
      section(
        'altre',
        '5. Altre spese professionali',
        'Other professional costs',
        'Autres frais professionnels',
      ),
      section(
        'accessoria',
        '6. Spese per attività accessoria dipendente',
        'Side job',
        'Activité accessoire',
      ),
      section(
        'totale',
        '7. Totale delle spese professionali',
        'Total professional costs',
        'Total des frais professionnels',
      ),
    ],
    source: `${M4} p. ${n} (Modulo 4)`,
  };
}

function pages(y: number): FormPage<TiPageId>[] {
  return [
    modulo4Page(1, y),
    modulo4Page(2, y),
    {
      id: 'M6',
      title: `Oneri assicurativi, cura prestata da terzi, spese per malattia e infortunio, Modulo 6 ${y}`,
      gloss: g(
        'Insurance premiums and savings interest, childcare, illness costs (Modulo 6): behind 12, 20 and 22.1',
        'Primes d’assurance et intérêts d’épargne, garde des enfants, frais de maladie (Modulo 6) : derrière 12, 20 et 22.1',
      ),
      pdfPage: 1,
      supported: true,
      sections: [
        section(
          'oneri',
          '1. Oneri assicurativi e interessi su capitali a risparmio',
          'Insurance premiums and savings interest',
          'Primes d’assurance et intérêts d’épargne',
        ),
        section(
          'cure',
          'Cura prestata da terzi a figli/ie di età inferiore ai 14 anni',
          'Childcare by others',
          'Garde par des tiers',
        ),
        section(
          'malattia',
          'Spese per malattia e infortunio',
          'Illness and accident costs',
          'Frais de maladie et d’accident',
        ),
      ],
      source: `${M6} p. 1 and 2 (Modulo 6)`,
    },
    {
      id: 'M5',
      title: `Elenco debiti, liberalità e versamenti a partiti politici, Modulo 5 ${y}`,
      gloss: g(
        'Debts, donations and payments to parties (Modulo 5): behind 13.2, 33.1, 24 and 15.2',
        'Dettes, dons et versements aux partis (Modulo 5) : derrière 13.2, 33.1, 24 et 15.2',
      ),
      pdfPage: 1,
      supported: true,
      sections: [
        section(
          'debiti',
          'A. Debiti e interessi passivi privati',
          'Private debts',
          'Dettes privées',
        ),
        section(
          'liberalita',
          'Liberalità a enti di pubblica utilità e versamenti a partiti politici',
          'Donations and parties',
          'Dons et partis',
        ),
      ],
      source: `${M5} p. 1 and 2 (Modulo 5)`,
    },
    {
      id: 'P2',
      title: `Redditi in Svizzera e all’estero ${y}`,
      gloss: g(
        'Income in Switzerland and abroad (Modulo 1, page 2)',
        'Revenus en Suisse et à l’étranger (Modulo 1, page 2)',
      ),
      pdfPage: 2,
      supported: true,
      sections: [
        section(
          'dipendente',
          '1. Reddito da attività dipendente',
          'Salaried work',
          'Activité salariée',
        ),
        section(
          'indipendente',
          '2. Reddito da attività indipendente',
          'Self-employment',
          'Activité indépendante',
        ),
        section(
          'pensioni',
          '3. Redditi da pensioni, rendite e indennità',
          'Pensions and allowances',
          'Rentes et indemnités',
        ),
        section(
          'mobiliare',
          '4. Reddito della sostanza mobiliare',
          'Income from accounts and securities',
          'Rendement des avoirs et des titres',
        ),
        section(
          'immobiliare',
          '5. Reddito della sostanza immobiliare',
          'Income from property',
          'Rendement des immeubles',
        ),
        section('altri', '6. Altri redditi', 'Other income', 'Autres revenus'),
        section(
          'capitale',
          '7. Liquidazioni in capitale per prestazioni ricorrenti',
          'Lump sums',
          'Versements en capital',
        ),
        section('totale', '8. Totale dei redditi', 'Total income', 'Total des revenus'),
      ],
      source: `${FORM} p. 2 (Modulo 1, page 2)`,
    },
    {
      id: 'P3',
      title: `Deduzioni ${y}`,
      gloss: g(
        'Deductions and the taxable income (Modulo 1, page 3)',
        'Déductions et revenu imposable (Modulo 1, page 3)',
      ),
      pdfPage: 3,
      supported: true,
      sections: [
        section(
          'professionali',
          '9. Spese professionali dei dipendenti',
          'Professional costs',
          'Frais professionnels',
        ),
        section(
          'legge',
          '10. Contributi di legge',
          'Social and pension contributions',
          'Cotisations',
        ),
        section(
          'vincolata',
          '11. Contributi alla previdenza individuale vincolata (3° pilastro A)',
          'Pillar 3a',
          'Pilier 3a',
        ),
        section(
          'assicurativi',
          '12. Oneri assicurativi e interessi di capitali a risparmio',
          'Insurance premiums and savings interest',
          'Primes d’assurance et intérêts d’épargne',
        ),
        section(
          'interessi',
          '13. Spese titoli e interessi passivi',
          'Costs of securities and debt interest',
          'Frais de titres et intérêts passifs',
        ),
        section(
          'alimenti',
          '14. Alimenti, oneri permanenti e rendite vitalizie',
          'Alimony and annuities paid',
          'Pensions et rentes versées',
        ),
        section('altre', '15. Altre deduzioni', 'Other deductions', 'Autres déductions'),
        section(
          'calcolo',
          '16. a 28. Calcolo del reddito imponibile',
          'From the totals to the taxable income',
          'Des totaux au revenu imposable',
        ),
        section('cure', '20. Deduzione cure prestate da terzi', 'Childcare', 'Frais de garde'),
        section(
          'supplementari',
          '22. Deduzioni supplementari',
          'Illness and accident costs',
          'Frais de maladie et d’accident',
        ),
        section('liberalita', '24. Liberalità a enti di pubblica utilità', 'Donations', 'Dons'),
        section(
          'sociali',
          `25. Deduzioni sociali, situazione al 31.12.${y}`,
          'Social deductions',
          'Déductions sociales',
        ),
        section(
          'esente',
          '27. Quota esente per beneficiari AVS-AI',
          'AVS and AI pensioners',
          'Bénéficiaires AVS et AI',
        ),
      ],
      source: `${FORM} p. 3 (Modulo 1, page 3)`,
    },
    {
      id: 'P4',
      title: `Sostanza in Svizzera e all’estero, valore fiscale al 31 dicembre ${y}`,
      gloss: g(
        'Wealth on 31 December (Modulo 1, page 4)',
        'Fortune au 31 décembre (Modulo 1, page 4)',
      ),
      pdfPage: 4,
      supported: true,
      sections: [
        section('mobiliare', '29. Sostanza mobiliare', 'Movable wealth', 'Fortune mobilière'),
        section('immobiliare', '30. Sostanza immobiliare', 'Property', 'Immeubles'),
        section('aziendale', '31. Sostanza aziendale', 'Business assets', 'Fortune commerciale'),
        section('totale', '32. 34. 36. Totali', 'Totals', 'Totaux'),
        section('debiti', '33. Debiti', 'Debts', 'Dettes'),
        section('sociali', '35. Deduzioni sociali', 'Tax-free amounts', 'Montants exonérés'),
      ],
      source: `${FORM} p. 4 (Modulo 1, page 4)`,
    },
  ];
}

const rubrics = (): FormRubric<TiPageId>[] => [
  ...modulo4(1),
  ...modulo4(2),
  ...modulo6(),
  ...modulo5(),
  ...page2(),
  ...page3(),
  ...page4(),
];

/** Shown with tax year 2026: its codes come from the 2025 forms. */
export const TI_FORM_NOTE: Text = {
  en: 'The line numbers and Italian terms come from Ticino’s 2025 forms, Modulo 1 (its German translation, ti-2025-form-modulo-1-de) and Moduli 4, 5 and 6: no 2026 return is published yet, so check each line in eTax PF 2026 or on the forms you get in 2027.',
  fr: 'Les numéros de ligne et les termes italiens viennent des formulaires tessinois 2025, Modulo 1 (sa traduction allemande, ti-2025-form-modulo-1-de) et Moduli 4, 5 et 6 : aucune déclaration 2026 n’est encore publiée, vérifiez donc chaque ligne dans eTax PF 2026 ou sur les formulaires que vous recevrez en 2027.',
  de: 'Die Ziffern und italienischen Begriffe stammen aus den Tessiner Formularen 2025, Modulo 1 (seine deutsche Übersetzung, ti-2025-form-modulo-1-de) und Moduli 4, 5 und 6: Eine Steuererklärung 2026 ist noch nicht veröffentlicht, prüfe also jede Zeile in eTax PF 2026 oder auf den Formularen, die du 2027 erhältst.',
  it: 'I numeri delle cifre e i termini vengono dai moduli ticinesi 2025, Modulo 1 (la sua traduzione tedesca, ti-2025-form-modulo-1-de) e Moduli 4, 5 e 6: la dichiarazione 2026 non è ancora pubblicata, quindi controlla ogni cifra in eTax PF 2026 o sui moduli che riceverai nel 2027.',
};

export const FORM_TI_2025: FormMap<TiPageId> = {
  taxYear: 2025,
  formYear: 2025,
  provisional: false,
  pages: pages(2025),
  rubrics: rubrics(),
};

/** Tax year 2026: the 2025 forms, until the 2026 return is published; flagged provisional. */
export const FORM_TI_2026: FormMap<TiPageId> = {
  taxYear: 2026,
  formYear: 2025,
  provisional: true,
  note: TI_FORM_NOTE,
  pages: pages(2026),
  rubrics: rubrics(),
};

export function ticinoFormMap(taxYear: number): FormMap<TiPageId> {
  if (taxYear === 2025) return FORM_TI_2025;
  if (taxYear === 2026) return FORM_TI_2026;
  throw new Error(`No Ticino form map for ${taxYear}.`);
}
