// The Aargau return for individuals (Steuererklärung natürliche Personen, Kantons- und
// Gemeindesteuern) as far as the official documents describe it. The main form (101.01, Hauptbogen)
// is not published: it comes on paper from the commune's tax office, and eTAX AARGAU is an online
// application (docs/sources/ag/NOTES.md, Gaps). What is published: the guide (Wegleitung 2025),
// which explains each line by a section number (1.1 to 34), and the list of the form set, with the
// sheets that feed the main form (ag-2025-other-formularbestellung: 101.02 Berufskosten / Hilfsblatt
// für weitere Abzüge, 101.04 Schuldenverzeichnis / Renten- u. Ersatzeinkünfte, 101.05 Wertschriften-
// u. Guthabenverzeichnis, 101.06 Krankheits- u. Unfallkosten, 101.07 Liegenschaftenverzeichnis).
// So each line here carries the guide's section number as its code, with the sheet it is filled
// from, in the order the guide explains them: the income (1 to 6), the deductions (10 to 18), the
// social deductions and the taxable income (19 to 25), the wealth (20 to 37).
//
// The codes must be checked against the form or eTAX AARGAU: the guide's own cross-references
// sometimes number a line differently (the child deduction, section 19.1, is "Ziffer 22.1" on p. 25;
// the vehicles of section 20.5 send to "Ziff. 30.6" on p. 39; eTAX AARGAU's list of receipts puts
// the securities at "Ziffer 30.1" and life insurance at "Zif. 30.3", ag-2025-efiling-belege-online
// p. 1 and 2). The map is flagged provisional for both years, and the gloss says so where a
// document gives another number. The return has one column: the federal tax is worked out by the
// tax office from it (ag-2025-guide-wegleitung p. 42), so nothing federal is typed.
import type {
  FormColumn,
  FormMap,
  FormPage,
  FormPerson,
  FormRubric,
  Gloss,
} from '@taxpresso/filing-ge';
import type { Text } from '@taxpresso/rules-ch';

export const AG_PAGE_IDS = ['EK', 'AB', 'SO', 'VM'] as const;
export type AgPageId = (typeof AG_PAGE_IDS)[number];

const GUIDE = 'ag-2025-guide-wegleitung';
const SHEETS = 'ag-2025-other-formularbestellung';

type Options = Partial<
  Pick<
    FormRubric<AgPageId>,
    'code' | 'person' | 'nature' | 'role' | 'format' | 'columns' | 'supported'
  >
> & {
  /** The page of the guide that explains the line. */
  guide: number;
  /** The sheet the line is filled from (101.02 to 101.07), as the list of forms names it. */
  sheet?: string;
};

/** French typography: a no-break space before a colon and a percent sign. */
const frTypo = (s: string) => s.replace(/ ?: /g, ' : ').replace(/ %/g, ' %');

const g = (en: string, fr: string, de?: string): Gloss => ({
  en,
  fr: frTypo(fr),
  ...(de ? { de } : {}),
});

const ONE: readonly FormColumn[] = ['amount'];
const WEALTH: readonly FormColumn[] = ['wealth'];
const A = { person: 'A' as FormPerson };
const B = { person: 'B' as FormPerson };
const OUT = { supported: false };

const SHEET = {
  berufskosten: '101.02 Berufskosten',
  weitere: '101.02 Hilfsblatt für weitere Abzüge',
  schulden: '101.04 Schuldenverzeichnis',
  renten: '101.04 Renten- u. Ersatzeinkünfte',
  wertschriften: '101.05 Wertschriften- u. Guthabenverzeichnis',
  krankheit: '101.06 Krankheits- u. Unfallkosten',
  liegenschaften: '101.07 Liegenschaftenverzeichnis',
} as const;

/** A line maker for one section of one page, with that section's defaults. */
function on(page: AgPageId, section: string, defaults: Partial<Options>) {
  return (key: string, label: string, en: string, fr: string, options: Partial<Options> = {}) => {
    const o = { ...defaults, ...options } as Options;
    const rubric: FormRubric<AgPageId> = {
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
      source: `${GUIDE} p. ${o.guide}${o.sheet ? `; ${SHEETS} (${o.sheet})` : ''}`,
    };
    return rubric;
  };
}

/** One line per person: Person 1 and Person 2, as the Aargau forms name them (guide p. 8). */
function both(
  make: ReturnType<typeof on>,
  key: string,
  label: string,
  en: string,
  fr: string,
  options: Partial<Options> = {},
): FormRubric<AgPageId>[] {
  return [
    make(key, `${label}, Person 1`, `${en}, person 1`, `${fr}, personne 1`, { ...options, ...A }),
    make(key, `${label}, Person 2`, `${en}, person 2`, `${fr}, personne 2`, { ...options, ...B }),
  ];
}

// ---- Einkünfte im In- und Ausland (1 to 6) -----------------------------------------------------

function income(): FormRubric<AgPageId>[] {
  const job = on('EK', 'unselbststaendig', { guide: 13 });
  const self = on('EK', 'selbststaendig', { ...OUT, guide: 14 });
  const social = on('EK', 'versicherungen', { guide: 16, sheet: SHEET.renten });
  const securities = on('EK', 'wertschriften', { guide: 17, sheet: SHEET.wertschriften });
  const other = on('EK', 'weitere', { guide: 18 });
  const property = on('EK', 'liegenschaften', { ...OUT, guide: 19, sheet: SHEET.liegenschaften });
  const total = on('EK', 'total', { guide: 45, role: 'total' });
  return [
    ...both(
      job,
      '1.1',
      'Haupterwerb',
      'Main job, net salary (salary certificate, box 11)',
      'Activité principale, salaire net (certificat de salaire, case 11)',
    ),
    ...both(job, '1.2', 'Nebenerwerb', 'Side job, net salary', 'Activité accessoire, salaire net'),
    ...both(
      job,
      '1.3',
      'Weitere Vergütungen',
      'Other payments (board fees and the like)',
      'Autres rémunérations (tantièmes et autres)',
      OUT,
    ),
    ...both(
      self,
      '2',
      'Einkünfte aus selbstständiger Tätigkeit',
      'Self-employment',
      'Activité indépendante',
    ),
    ...both(
      social,
      '3-ahv',
      'AHV- und IV-Renten',
      'AHV/IV pension, in full',
      'Rente AVS/AI, en entier',
    ),
    ...both(
      social,
      '3-bv',
      'Renten aus der Pensionskasse (Säule 2)',
      'Pension fund pension',
      'Rente de caisse de pension',
    ),
    ...both(
      social,
      '3-andere',
      'Übrige Renten',
      'Other pensions, the taxable share',
      'Autres rentes, la part imposable',
      { guide: 17 },
    ),
    ...both(
      social,
      '3-alv',
      'Leistungen der Arbeitslosenversicherung',
      'Unemployment benefits not on a salary certificate',
      'Indemnités de chômage hors certificat de salaire',
      { guide: 17 },
    ),
    ...both(
      social,
      '3-taggelder',
      'Taggelder und Erwerbsausfallentschädigungen',
      'Daily allowances and loss-of-earnings benefits not on a salary certificate',
      'Indemnités journalières et allocations pour perte de gain hors certificat de salaire',
      { guide: 17 },
    ),
    securities(
      '4',
      'Einkünfte aus Wertschriften und Kapitalanlagen',
      'Income from accounts and securities, carried from the securities list (Wertschriften- und Guthabenverzeichnis)',
      'Rendement des avoirs et des titres, reporté de l’état des titres (Wertschriften- und Guthabenverzeichnis)',
      { role: 'report' },
    ),
    ...both(
      other,
      '5.1',
      'Unterhaltsbeiträge vom geschiedenen oder getrennt lebenden Eheteil',
      'Alimony received from a former spouse',
      'Pension alimentaire reçue de l’ex-conjoint',
    ),
    other(
      '5.2',
      'Unterhaltsbeiträge für minderjährige Kinder',
      'Child support received for minor children',
      'Contributions d’entretien reçues pour des enfants mineurs',
      { guide: 19 },
    ),
    other(
      '5.3',
      'Ertrag aus unverteilten Erbschaften',
      'Income from an undivided inheritance',
      'Rendement d’une succession non partagée',
      { ...OUT, guide: 19 },
    ),
    other(
      '5.4',
      'Kapitalabfindungen für wiederkehrende Leistungen',
      'Lump sums instead of recurring payments',
      'Prestations en capital à la place de prestations périodiques',
      { ...OUT, guide: 19 },
    ),
    other('5.5', 'Übrige Einkünfte', 'Other income (say what it is)', 'Autres revenus (préciser)', {
      guide: 19,
    }),
    property('6', 'Einkünfte aus Liegenschaften', 'Income from property', 'Revenus immobiliers'),
    total('einkuenfte', 'Total der Einkünfte', 'Total income', 'Total des revenus', { code: '' }),
  ].map((r) => (r.code === '' ? withoutCode(r) : r));
}

/** A line the form doesn't number: no code. */
function withoutCode(r: FormRubric<AgPageId>): FormRubric<AgPageId> {
  return Object.fromEntries(
    Object.entries(r).filter(([k]) => k !== 'code'),
  ) as unknown as FormRubric<AgPageId>;
}

// ---- Abzüge (10 to 18) -------------------------------------------------------------------------

function deductions(): FormRubric<AgPageId>[] {
  const D = { nature: 'deduction' as const };
  const costs = on('AB', 'berufskosten', { ...D, guide: 22, sheet: SHEET.berufskosten });
  const debts = on('AB', 'schuldzinsen', { ...D, guide: 25, sheet: SHEET.schulden });
  const upkeep = on('AB', 'unterhalt', { ...D, guide: 25 });
  const pension = on('AB', 'vorsorge', { ...D, guide: 25 });
  const insurance = on('AB', 'versicherung', { ...D, guide: 27 });
  const other = on('AB', 'weitere', { ...D, guide: 27, sheet: SHEET.weitere });
  const second = on('AB', 'zweitverdiener', { ...D, guide: 30 });
  const medical = on('AB', 'krankheit', { ...D, guide: 30, sheet: SHEET.krankheit });
  const total = on('AB', 'total', { ...D, guide: 31, role: 'total' });
  return [
    ...both(
      costs,
      '10.1',
      'Fahrtkosten zwischen Wohn- und Arbeitsstätte',
      'Travel to work',
      'Frais de déplacement',
    ),
    ...both(
      costs,
      '10.2',
      'Mehrkosten der auswärtigen Verpflegung',
      'Meals away from home',
      'Repas pris à l’extérieur',
      { guide: 23 },
    ),
    ...both(
      costs,
      '10.3',
      'Pauschalabzug',
      'Other professional costs: the flat 3 % of the net salary, or the actual costs',
      'Autres frais professionnels : le forfait de 3 % du salaire net, ou les frais effectifs',
      { guide: 23 },
    ),
    ...both(
      costs,
      '10.4',
      'Auswärtiger Wochenaufenthalt',
      'Weekly stay away from home',
      'Séjour hebdomadaire hors du domicile',
      { ...OUT, guide: 24 },
    ),
    ...both(
      costs,
      '10.5',
      'Mitgliederbeiträge an Berufsverbände',
      'Membership fees to professional associations',
      'Cotisations à des associations professionnelles',
      { ...OUT, guide: 24 },
    ),
    ...both(
      costs,
      '10.6',
      'Auslagen bei Nebenerwerb',
      'Side job costs: the flat 20 % of its income',
      'Frais de l’activité accessoire : le forfait de 20 % de son revenu',
      { guide: 24 },
    ),
    debts(
      '11',
      'Schuldzinsen',
      'Private debt interest, from the list of debts (Schuldenverzeichnis)',
      'Intérêts des dettes privées, de l’état des dettes (Schuldenverzeichnis)',
    ),
    upkeep(
      '12.1',
      'Unterhaltsbeiträge an den geschiedenen oder getrennt lebenden Eheteil',
      'Alimony paid to a former spouse',
      'Pension alimentaire versée à l’ex-conjoint',
    ),
    upkeep(
      '12.2',
      'Unterhaltsbeiträge für minderjährige Kinder',
      'Child support paid for minor children',
      'Contributions d’entretien versées pour des enfants mineurs',
    ),
    upkeep(
      '12.3',
      'Rentenleistungen und dauernde Lasten',
      'Annuities and permanent charges paid',
      'Rentes et charges durables versées',
      OUT,
    ),
    ...both(pension, '13.1', 'Einkäufe Säule 2', 'Pension fund buy-ins', 'Rachats au 2e pilier'),
    ...both(pension, '13.2', 'Beiträge Säule 3a', 'Pillar 3a', 'Pilier 3a', { guide: 26 }),
    insurance(
      '14',
      'Versicherungsprämien und Zinsen von Sparkapitalien',
      'Insurance premiums and savings interest: a flat amount, whatever was paid',
      'Primes d’assurance et intérêts d’épargne : un forfait, quel que soit le montant payé',
      { role: 'computed' },
    ),
    other(
      '15.0',
      'Kinderbetreuungskosten',
      'Childcare, with a list and copies of the invoices',
      'Frais de garde des enfants, avec une liste et les copies des factures',
    ),
    other(
      '15.1',
      'Persönliche Beiträge nicht erwerbstätiger Personen an die AHV, IV und EO',
      'AHV/IV contributions of a person without a job',
      'Cotisations AVS/AI d’une personne sans activité lucrative',
      OUT,
    ),
    other(
      '15.2',
      'Zuwendungen an steuerbefreite politische Parteien',
      'Payments to political parties',
      'Versements aux partis politiques',
    ),
    other('15.3', 'Freiwillige Leistungen (Spenden)', 'Donations', 'Dons', { guide: 28 }),
    other(
      '15.4',
      'Vermögensverwaltungskosten',
      'Costs of managing securities, from the securities list',
      'Frais de gestion de fortune, de l’état des titres',
      { guide: 28, sheet: SHEET.wertschriften },
    ),
    ...both(
      other,
      '15.5',
      'Berufsorientierte Aus-, Weiterbildungs- und Umschulungskosten',
      'Professional training',
      'Formation professionnelle',
      { guide: 29 },
    ),
    other('15.6', 'Weitere Abzüge', 'Other deductions', 'Autres déductions', {
      ...OUT,
      guide: 30,
    }),
    second(
      '16',
      'Sonderabzug für zweitverdienenden Eheteil bzw. Partner/in',
      'Both spouses earn',
      'Double revenu',
    ),
    medical(
      '17.1',
      'Krankheits- und Unfallkosten',
      'Medical and accident costs left to pay, in full',
      'Frais de maladie et d’accident restés à charge, en entier',
    ),
    medical(
      '17.2',
      'Behinderungsbedingte Kosten',
      'Disability costs',
      'Frais liés à un handicap',
      OUT,
    ),
    medical(
      '18',
      'Selbstbehalt Krankheits- und Unfallkosten',
      'Medical costs, own share added back: the net income x 5 : 95',
      'Frais médicaux, part à charge réintégrée : le revenu net x 5 : 95',
      { guide: 31, role: 'computed', nature: 'income' },
    ),
    total(
      'reineinkommen',
      'Reineinkommen',
      'Net income, after the deductions 10 to 18',
      'Revenu net, après les déductions 10 à 18',
      { code: '', nature: 'income' },
    ),
  ].map((r) => (r.code === '' ? withoutCode(r) : r));
}

// ---- Sozialabzüge und steuerbares Einkommen (19 to 25) ----------------------------------------

function social(): FormRubric<AgPageId>[] {
  const D = { nature: 'deduction' as const };
  const children = on('SO', 'sozialabzuege', { ...D, guide: 31 });
  const totals = on('SO', 'total', { role: 'total', guide: 32 });
  const low = on('SO', 'tiefe', { ...D, guide: 32 });
  return [
    children(
      '19.1',
      'Kinderabzug',
      'Child deduction, by each child’s age (the guide also calls it Ziffer 22.1, p. 25)',
      'Déduction pour enfants, selon l’âge de chaque enfant (le guide l’appelle aussi Ziffer 22.1, p. 25)',
      { guide: 32 },
    ),
    children(
      '19.2',
      'Unterstützungsabzug',
      'Support of a person in need',
      'Déduction pour personne à charge',
      { ...OUT, guide: 32 },
    ),
    children('19.3', 'Invalidenabzug', 'Disability deduction', 'Déduction pour invalidité', {
      ...OUT,
      guide: 32,
    }),
    children('19.4', 'Betreuungsabzug', 'Care deduction', 'Déduction pour soins', {
      ...OUT,
      guide: 32,
    }),
    totals(
      '23',
      'Reineinkommen nach Sozialabzügen',
      'Net income after the social deductions (the guide’s Ziffer 23)',
      'Revenu net après les déductions sociales (Ziffer 23 du guide)',
    ),
    low(
      '24',
      'Zusätzlicher Sozialabzug für tiefe Einkommen',
      'Low-income deduction, by step',
      'Déduction supplémentaire pour revenus modestes, par palier',
      { role: 'computed' },
    ),
    totals(
      '25',
      'Steuerbares Einkommen',
      'Taxable income (the guide’s Ziffer 25)',
      'Revenu imposable (Ziffer 25 du guide)',
      { guide: 45 },
    ),
  ];
}

// ---- Vermögen im In- und Ausland (20 to 37) ----------------------------------------------------

function wealth(): FormRubric<AgPageId>[] {
  const W = { nature: 'wealth' as const, columns: WEALTH };
  const movable = on('VM', 'beweglich', { ...W, guide: 34 });
  const property = on('VM', 'liegenschaften', { ...W, ...OUT, guide: 40 });
  const total = on('VM', 'total', { ...W, role: 'total', guide: 34 });
  const debts = on('VM', 'schulden', { ...W, guide: 41, sheet: SHEET.schulden });
  const free = on('VM', 'steuerfrei', { ...W, role: 'computed', guide: 45 });
  const taxable = on('VM', 'steuerbar', { ...W, role: 'total', guide: 45 });
  return [
    movable(
      '20.1',
      'Wertschriften und Guthaben',
      'Securities and accounts on 31 December, carried from the securities list (eTAX AARGAU’s list of receipts calls it Ziffer 30.1)',
      'Titres et avoirs au 31 décembre, reportés de l’état des titres (la liste des pièces d’eTAX AARGAU l’appelle Ziffer 30.1)',
      { role: 'report', sheet: SHEET.wertschriften },
    ),
    movable(
      '20.2',
      'Bargeld, Gold und andere Edelmetalle',
      'Cash, gold and precious metals',
      'Espèces, or et métaux précieux',
      { guide: 39 },
    ),
    movable(
      '20.3',
      'Lebens- und Rentenversicherungen',
      'Life and annuity insurance, surrender value (eTAX AARGAU’s list of receipts calls it Zif. 30.3)',
      'Assurances vie et de rente, valeur de rachat (la liste des pièces d’eTAX AARGAU l’appelle Zif. 30.3)',
      { guide: 39 },
    ),
    movable(
      '20.4',
      'Anteile an unverteilten Erbschaften',
      'Share of an undivided inheritance',
      'Part d’une succession non partagée',
      { ...OUT, guide: 39 },
    ),
    movable(
      '20.5',
      'Private Fahrzeuge',
      'Private vehicles, at a share of the list price',
      'Véhicules privés, à une part du prix catalogue',
      { guide: 39 },
    ),
    movable(
      '20.6',
      'Übrige Vermögenswerte',
      'Other assets at market value (the guide also calls it Ziff. 30.6, p. 39)',
      'Autres éléments de fortune à la valeur vénale (le guide l’appelle aussi Ziff. 30.6, p. 39)',
      { guide: 39 },
    ),
    property('21', 'Liegenschaften', 'Property', 'Immeubles'),
    property(
      '22',
      'Betriebsvermögen selbstständig Erwerbende',
      'Business assets',
      'Fortune commerciale',
    ),
    total(
      'vermoegen',
      'Total der Vermögenswerte',
      'Total assets',
      'Total des éléments de fortune',
      { code: '' },
    ),
    debts(
      '34',
      'Total der Schulden',
      'Debts on 31 December, from the list of debts (Schuldenverzeichnis)',
      'Dettes au 31 décembre, de l’état des dettes (Schuldenverzeichnis)',
      { nature: 'wealth' },
    ),
    free(
      'steuerfrei',
      'Steuerfreier Betrag',
      'Tax-free amount (married couples, or others)',
      'Montant exonéré (couples mariés, ou autres)',
      { code: '' },
    ),
    free(
      'steuerfrei-kinder',
      'Steuerfreier Betrag für Kinder',
      'Tax-free amount per child with the child deduction',
      'Montant exonéré par enfant donnant droit à la déduction pour enfants',
      { code: '' },
    ),
    taxable(
      '37',
      'Steuerbares Vermögen',
      'Taxable wealth (the guide’s Ziffer 37)',
      'Fortune imposable (Ziffer 37 du guide)',
    ),
  ].map((r) => (r.code === '' ? withoutCode(r) : r));
}

const section = (id: string, title: string, en: string, fr: string) => ({
  id,
  title,
  gloss: g(en, fr),
});

function pages(y: number): FormPage<AgPageId>[] {
  return [
    {
      id: 'EK',
      title: `Einkünfte im In- und Ausland ${y}`,
      gloss: g('Income in Switzerland and abroad', 'Revenus en Suisse et à l’étranger'),
      pdfPage: 13,
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
          'Einkünfte aus selbstständiger Tätigkeit',
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
          'Einkünfte aus Wertschriften und Kapitalanlagen',
          'Income from accounts and securities',
          'Rendement des avoirs et des titres',
        ),
        section('weitere', 'Weitere Einkünfte und Gewinne', 'Other income', 'Autres revenus'),
        section(
          'liegenschaften',
          'Einkünfte aus Liegenschaften',
          'Income from property',
          'Revenus immobiliers',
        ),
        section('total', 'Total der Einkünfte', 'Total income', 'Total des revenus'),
      ],
      source: `${GUIDE} p. 13`,
    },
    {
      id: 'AB',
      title: `Abzüge ${y}`,
      gloss: g('Deductions', 'Déductions'),
      pdfPage: 22,
      supported: true,
      sections: [
        section(
          'berufskosten',
          'Berufskosten bei unselbstständiger Tätigkeit',
          'Professional costs',
          'Frais professionnels',
        ),
        section('schuldzinsen', 'Schuldzinsen', 'Debt interest', 'Intérêts passifs'),
        section(
          'unterhalt',
          'Unterhaltsbeiträge und Rentenleistungen',
          'Alimony and annuities paid',
          'Pensions et rentes versées',
        ),
        section(
          'vorsorge',
          'Einkaufsbeiträge an Säule 2 und Beiträge Säule 3a',
          'Pension fund and pillar 3a',
          'Prévoyance professionnelle et pilier 3a',
        ),
        section(
          'versicherung',
          'Versicherungsprämien und Zinsen von Sparkapitalien',
          'Insurance premiums and savings interest',
          'Primes d’assurance et intérêts d’épargne',
        ),
        section('weitere', 'Weitere Abzüge', 'Other deductions', 'Autres déductions'),
        section(
          'zweitverdiener',
          'Sonderabzug für zweitverdienenden Eheteil',
          'Both spouses earn',
          'Double revenu',
        ),
        section(
          'krankheit',
          'Krankheits-, Unfall- und behinderungsbedingte Kosten',
          'Medical, accident and disability costs',
          'Frais de maladie, d’accident et liés à un handicap',
        ),
        section('total', 'Reineinkommen', 'Net income', 'Revenu net'),
      ],
      source: `${GUIDE} p. 22`,
    },
    {
      id: 'SO',
      title: `Steuerfreibeträge (Sozialabzüge) ${y}`,
      gloss: g(
        'Social deductions and the taxable income',
        'Déductions sociales et revenu imposable',
      ),
      pdfPage: 31,
      supported: true,
      sections: [
        section(
          'sozialabzuege',
          'Steuerfreibeträge (Sozialabzüge)',
          'Social deductions',
          'Déductions sociales',
        ),
        section(
          'tiefe',
          'Zusätzlicher Sozialabzug für tiefe Einkommen',
          'Low-income deduction',
          'Déduction pour revenus modestes',
        ),
        section('total', 'Steuerbares Einkommen', 'Taxable income', 'Revenu imposable'),
      ],
      source: `${GUIDE} p. 31`,
    },
    {
      id: 'VM',
      title: `Vermögen im In- und Ausland, 31.12.${y}`,
      gloss: g('Wealth on 31 December', 'Fortune au 31 décembre'),
      pdfPage: 34,
      supported: true,
      sections: [
        section('beweglich', 'Bewegliches Vermögen', 'Movable wealth', 'Fortune mobilière'),
        section(
          'liegenschaften',
          'Liegenschaften, Betriebsvermögen',
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
        section('steuerfrei', 'Steuerfreie Beträge', 'Tax-free amounts', 'Montants exonérés'),
        section('steuerbar', 'Steuerbares Vermögen', 'Taxable wealth', 'Fortune imposable'),
      ],
      source: `${GUIDE} p. 34`,
    },
  ];
}

/**
 * Shown with every Aargau return: the main form isn't published, so the codes are the guide's
 * section numbers, to be checked against the form or eTAX AARGAU.
 */
export const AG_FORM_NOTE: Text = {
  en: 'Aargau doesn’t publish its main form (101.01): these codes are the section numbers of the 2025 guide (Wegleitung), and the guide’s own references sometimes number a line differently (the child deduction is Ziffer 22.1 there, the securities Ziffer 30.1 in eTAX AARGAU’s list of receipts). Check each code against your form or eTAX AARGAU before you type.',
  fr: 'Argovie ne publie pas son formulaire principal (101.01) : ces codes sont les numéros de section du guide 2025 (Wegleitung), et les renvois du guide numérotent parfois une ligne autrement (la déduction pour enfants y est la Ziffer 22.1, les titres la Ziffer 30.1 dans la liste des pièces d’eTAX AARGAU). Vérifiez chaque code sur votre formulaire ou dans eTAX AARGAU avant de saisir.',
  de: 'Aargau veröffentlicht den Hauptbogen (101.01) nicht: Diese Ziffern sind die Abschnitte der Wegleitung 2025, und die Verweise der Wegleitung nummerieren eine Zeile manchmal anders (der Kinderabzug ist dort Ziffer 22.1, die Wertschriften Ziffer 30.1 in der Belegliste von eTAX AARGAU). Prüfe jede Ziffer auf deinem Formular oder in eTAX AARGAU, bevor du etwas einträgst.',
};

const rubrics = (): FormRubric<AgPageId>[] => [
  ...income(),
  ...deductions(),
  ...social(),
  ...wealth(),
];

/**
 * Tax year 2025: the lines of the 2025 guide. Provisional: the main form isn't published, so the
 * codes are the guide's sections (AG_FORM_NOTE).
 */
export const FORM_AG_2025: FormMap<AgPageId> = {
  taxYear: 2025,
  formYear: 2025,
  provisional: true,
  note: AG_FORM_NOTE,
  pages: pages(2025),
  rubrics: rubrics(),
};

/**
 * Tax year 2026: the 2025 guide's lines, the 2026 guide not being published yet (expected in
 * January 2027); provisional as for 2025.
 */
export const FORM_AG_2026: FormMap<AgPageId> = {
  taxYear: 2026,
  formYear: 2025,
  provisional: true,
  note: AG_FORM_NOTE,
  pages: pages(2026),
  rubrics: rubrics(),
};

export function aargauFormMap(taxYear: number): FormMap<AgPageId> {
  if (taxYear === 2025) return FORM_AG_2025;
  if (taxYear === 2026) return FORM_AG_2026;
  throw new Error(`No Aargau form map for ${taxYear}.`);
}
