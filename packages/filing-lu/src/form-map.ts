// The Lucerne return (Steuererklärung Natürliche Personen, Kantons-, Gemeinde-, direkte
// Bundessteuer) as printed, in the order the guide advises to fill it in: the helper forms first
// (form B, Berufsauslagen; the securities list, Wertschriften- und Guthabenverzeichnis), then the
// return's page 2 (Einkünfte), page 3 (Abzüge, Einkommensberechnung) and page 4 (Vermögen), each in
// its one column, "CHF ohne Rappen" (lu-2025-guide-wegleitung p. 10: "füllen Sie mit Vorteil
// zunächst die Hilfsformulare aus ... Erst jetzt beginnen Sie mit dem Ausfüllen der
// Steuererklärung"). Then the optional Ergänzungsblatt Direkte Bundessteuer, which derives the
// federal taxable income from the return (lu-2025-form-ergaenzungsblatt-dbst p. 1): the tax office
// derives it anyway, so its page is there to check. Every line with its Ziffer and its German label
// as printed; the gloss says what it is in plain words.
//
// Source (docs/sources/lu/manifest.json): the 2025 forms as the guide prints them, filled in for its
// sample family (lu-2025-guide-wegleitung p. 13 to 19, Beispiel: form B p. 16, the securities list
// p. 14, pages 2 to 4 p. 15, 17 and 19), each Ziffer explained on the guide's pages 21 to 41. The
// blank forms cannot be downloaded (they exist printed or inside eSteuern.LU) and the 2026 ones are
// not out (docs/sources/lu/NOTES.md, Gaps): tax year 2026 uses the 2025 forms, flagged provisional.
// The back of form B (person 2) is not printed in the guide: its Ziffern are the overview's
// (lu-2025-deductions-abzuege-auf-einen-blick p. 1: 202/203, 208t/209t...) and page 3's (238, 239).
//
// Not mapped: page 1 (the personal details: Taxpresso fills none of its amounts), form V
// (Versicherungsbeiträge, which gives 270), form S (Schuldenverzeichnis, 252 and 462), form K
// (Krankheitskosten, 320) and form U/F (Unterhalt and Fremdbetreuung, 360): the line gets the amount
// they carry. What Taxpresso doesn't prepare (self-employment, property, life annuities, capital
// payments, support, weekly stays) is listed, marked unsupported. The Ergänzungsblatt's labels leave
// out the amounts it prints next to some lines (they are a year's federal amounts, and two of them
// differ from the federal circular's: docs/sources/lu/NOTES.md).
import type {
  FormColumn,
  FormMap,
  FormPage,
  FormPerson,
  FormRubric,
  Gloss,
} from '@taxpresso/filing-ge';
import type { Text } from '@taxpresso/rules-ch';

export const LU_PAGE_IDS = ['B', 'WV', 'S2', 'S3', 'S4', 'EB'] as const;
export type LuPageId = (typeof LU_PAGE_IDS)[number];

type Options = Partial<
  Pick<
    FormRubric<LuPageId>,
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

const GUIDE = 'lu-2025-guide-wegleitung';
const SHEET = 'lu-2025-form-ergaenzungsblatt-dbst';

const RETURN: readonly FormColumn[] = ['icc'];
const WEALTH: readonly FormColumn[] = ['wealth'];
const FEDERAL: readonly FormColumn[] = ['ifd'];
const A = { person: 'A' as FormPerson };
const B = { person: 'B' as FormPerson };
const OUT = { supported: false };
const TOTAL = { role: 'total' as const };
const REPORT = { role: 'report' as const };
const COMPUTED = { role: 'computed' as const };

/** Where each page is printed: the guide's sample, or the Ergänzungsblatt itself. */
const PRINTED: Record<LuPageId, string> = {
  B: `${GUIDE} p. 16 (Beispiel, Formular B Berufsauslagen)`,
  WV: `${GUIDE} p. 14 (Beispiel, Wertschriften- und Guthabenverzeichnis)`,
  S2: `${GUIDE} p. 15 (Beispiel, Steuererklärung Seite 2)`,
  S3: `${GUIDE} p. 17 (Beispiel, Steuererklärung Seite 3)`,
  S4: `${GUIDE} p. 19 (Beispiel, Steuererklärung Seite 4)`,
  EB: `${SHEET} p. 1 (Ergänzungsblatt Direkte Bundessteuer)`,
};

/** A line maker for one section of one page, with that section's defaults. */
function on(page: LuPageId, section: string, defaults: Options) {
  return (key: string, label: string, en: string, fr: string, options: Options = {}) => {
    const o = { ...defaults, ...options };
    const rubric: FormRubric<LuPageId> = {
      key,
      code: o.code ?? key,
      page,
      section,
      person: o.person ?? 'household',
      label,
      gloss: g(en, fr),
      nature: o.nature ?? 'deduction',
      role: o.role ?? 'input',
      format: o.format ?? 'money',
      columns: o.columns ?? RETURN,
      supported: o.supported ?? true,
      source: `${PRINTED[page]}${o.guide !== undefined ? `; ${GUIDE} p. ${o.guide}` : ''}`,
    };
    return rubric;
  };
}

// ---- Formular B: Berufsauslagen (person 1 on the front, person 2 on the back) ----------------------

function formB(): FormRubric<LuPageId>[] {
  const travel = on('B', 'fahrkosten', { guide: '27' });
  const meals = on('B', 'verpflegung', { guide: '27 and 28' });
  const other = on('B', 'uebrige', { guide: '28' });
  const week = on('B', 'wochenaufenthalt', { ...OUT, guide: '28' });
  const side = on('B', 'nebenerwerb', { guide: '29' });
  const total = on('B', 'total', { ...TOTAL, guide: '27' });
  const both = (
    make: ReturnType<typeof on>,
    [k1, k2]: readonly [string, string],
    label: string,
    en: string,
    fr: string,
    o: Options = {},
  ) => [
    make(k1, `${label}, Person 1`, `${en}, person 1`, `${fr}, personne 1`, { ...A, ...o }),
    make(k2, `${label}, Person 2`, `${en}, person 2`, `${fr}, personne 2`, { ...B, ...o }),
  ];
  return [
    ...both(
      travel,
      ['202', '203'],
      'Abonnementskosten für öffentliche Verkehrsmittel / Park and Ride',
      'Public transport passes, park and ride',
      'Abonnements de transports publics, parc relais',
    ),
    ...both(
      travel,
      ['204', '205'],
      'Fahrrad, Motorfahrrad und Motorrad mit gelbem Kontrollschild (pauschal)',
      'Bike, moped or motorbike with a yellow plate, flat amount',
      'Vélo, cyclomoteur ou moto à plaque jaune, forfait',
    ),
    travel(
      '206',
      'Kostenbeteiligung gemäss Vereinbarung mit Arbeitgeberfirma, Person 1',
      'Share of the costs agreed with the employer, person 1',
      'Participation aux frais convenue avec l’employeur, personne 1',
      { ...A, ...OUT },
    ),
    ...both(
      travel,
      ['208', '209'],
      'Privatfahrzeug (Auto, Motorrad mit weissem Kontrollschild): Berechnung',
      'Car or motorbike with a white plate: the kilometres priced',
      'Voiture ou moto à plaque blanche : les kilomètres chiffrés',
    ),
    ...both(
      travel,
      ['208t', '209t'],
      'Total Fahrkosten',
      'Travel to work, total, at most the yearly limit',
      'Frais de déplacement, total, au plus la limite annuelle',
      COMPUTED,
    ),
    ...both(
      meals,
      ['212', '213'],
      'Auswärtige Verpflegung bei täglicher Heimkehr ohne Verbilligung durch die Arbeitgeberfirma',
      'Meals away from home, not paid in part by the employer',
      'Repas hors du domicile, sans participation de l’employeur',
    ),
    ...both(
      meals,
      ['214', '215'],
      'Auswärtige Verpflegung bei täglicher Heimkehr bei Verbilligung durch die Arbeitgeberfirma',
      'Meals away from home, paid in part by the employer (canteen, meal vouchers)',
      'Repas hors du domicile, avec participation de l’employeur (cantine, bons)',
    ),
    meals(
      '216',
      'Schicht-/Nachtarbeit, Person 1',
      'Shift or night work, person 1',
      'Travail par équipes ou de nuit, personne 1',
      { ...A, ...OUT },
    ),
    ...both(
      other,
      ['220', '221'],
      'Übrige für die Ausübung des Berufes erforderlichen Kosten (3 % des Nettolohnes)',
      'Other professional costs, the 3 % flat or the actual costs',
      'Autres frais professionnels, forfait de 3 % ou frais effectifs',
    ),
    week(
      '228',
      'Mehrkosten bei auswärtigem Wochenaufenthalt: Unterkunft, Person 1',
      'Weekly stay away from home: lodging, person 1',
      'Séjour hebdomadaire hors du domicile : logement, personne 1',
      A,
    ),
    week(
      '230',
      'Mehrkosten bei auswärtigem Wochenaufenthalt: Verpflegung, Person 1',
      'Weekly stay away from home: meals, person 1',
      'Séjour hebdomadaire hors du domicile : repas, personne 1',
      A,
    ),
    ...both(
      side,
      ['236', '237'],
      'Auslagen bei Nebenerwerb (20 % der Einkünfte aus Nebenerwerb)',
      'Side job costs, the 20 % flat',
      'Frais de l’activité accessoire, forfait de 20 %',
    ),
    ...both(
      total,
      ['238', '239'],
      'Total Berufsauslagen',
      'Professional costs, total (to page 3)',
      'Frais professionnels, total (en page 3)',
    ),
  ];
}

// ---- Wertschriften- und Guthabenverzeichnis: its summary -----------------------------------------

function securities(): FormRubric<LuPageId>[] {
  const wv = on('WV', 'zusammenfassung', { guide: '38 to 41' });
  return [
    wv(
      'WV4',
      'Zwischentotal Bruttoerträge A + B',
      'Gross income of the accounts and securities (to page 2, Ziffer 150)',
      'Rendement brut des comptes et titres (en page 2, Ziffer 150)',
      { code: '4', nature: 'income', ...TOTAL },
    ),
    wv(
      'WV6',
      'Abzüglich Vermögensverwaltungskosten',
      'Costs of keeping securities: the flat (0.3 %) or the actual costs',
      'Frais de gestion des titres : forfait (0,3 %) ou frais effectifs',
      { code: '6', guide: '40' },
    ),
  ];
}

// ---- Seite 2: Einkünfte im In- und Ausland -------------------------------------------------------

function page2(): FormRubric<LuPageId>[] {
  const job = on('S2', 'unselbstaendig', { nature: 'income', guide: '21' });
  const self = on('S2', 'selbstaendig', { nature: 'income', ...OUT, guide: '21' });
  const social = on('S2', 'versicherungen', { nature: 'income', guide: '22' });
  const wv = on('S2', 'wertschriften', { nature: 'income', guide: '23' });
  const other = on('S2', 'uebrige', { nature: 'income', guide: '23' });
  const property = on('S2', 'liegenschaften', { nature: 'income', ...OUT, guide: '24' });
  const total = on('S2', 'total', { nature: 'income', ...TOTAL, guide: '21' });
  const pair = (
    make: ReturnType<typeof on>,
    [k1, k2]: readonly [string, string],
    label: string,
    en: string,
    fr: string,
    o: Options = {},
  ) => [
    make(k1, `${label}, Person 1`, `${en}, person 1`, `${fr}, personne 1`, { ...A, ...o }),
    make(k2, `${label}, Person 2`, `${en}, person 2`, `${fr}, personne 2`, { ...B, ...o }),
  ];
  return [
    ...pair(
      job,
      ['100', '101'],
      'Haupterwerb (Nettolohn gemäss Lohnausweis)',
      'Main job, net salary (salary certificate, box 11)',
      'Activité principale, salaire net (certificat de salaire, case 11)',
    ),
    ...pair(
      job,
      ['104', '105'],
      'Nebenerwerb (Nettolohn gemäss Lohnausweis)',
      'Side job, net salary',
      'Activité accessoire, salaire net',
    ),
    ...pair(
      job,
      ['106', '107'],
      'Privatanteile/Lohnnebenleistungen',
      'Private use and benefits not on the salary certificate',
      'Parts privées et prestations hors certificat de salaire',
      OUT,
    ),
    ...pair(
      self,
      ['110', '111'],
      'Selbständige Erwerbstätigkeit, Haupterwerb',
      'Self-employment',
      'Activité indépendante',
    ),
    ...pair(
      self,
      ['114', '115'],
      'Selbständige Erwerbstätigkeit, Nebenerwerb',
      'Self-employment, side activity',
      'Activité indépendante accessoire',
    ),
    ...pair(self, ['118', '119'], 'Personengesellschaft', 'Partnership', 'Société de personnes'),
    ...pair(social, ['130', '131'], 'AHV-/IV-Renten', 'AHV/IV pension', 'Rente AVS/AI'),
    ...pair(
      social,
      ['132', '133'],
      'Renten/Pensionen',
      'Pension fund pension',
      'Rente de prévoyance professionnelle',
    ),
    ...pair(social, ['134', '135'], 'Leibrenten', 'Life annuity', 'Rente viagère', OUT),
    ...pair(social, ['136', '137'], 'übrige Renten', 'Other pensions', 'Autres rentes'),
    ...pair(
      social,
      ['140', '141'],
      'Erwerbsausfallentschädigungen',
      'Daily allowances and unemployment benefits not paid with the salary',
      'Indemnités journalières et de chômage hors salaire',
    ),
    social(
      '145',
      'Von Ausgleichskassen direkt ausbezahlte Zulagen',
      'Family allowances paid directly by a compensation office',
      'Allocations familiales versées directement par une caisse',
      OUT,
    ),
    wv(
      '150',
      'Wertschriftenertrag und Ertrag aus Guthaben, Lotterien und anderen Geldspielen (Wertschriftenverzeichnis)',
      'Income from accounts and securities, less their costs (the securities list)',
      'Rendement des comptes et titres, moins leurs frais (état des titres)',
      REPORT,
    ),
    other(
      '160',
      'Unterhaltsbeiträge für den/die Steuerpflichtige(n)',
      'Alimony received',
      'Pension alimentaire reçue',
    ),
    other(
      '161',
      'Unterhaltsbeiträge/Alimente für Kinder',
      'Child support received',
      'Contributions d’entretien reçues pour les enfants',
    ),
    other(
      '164',
      'Ertrag Erbengemeinschaften und einfache Gesellschaften',
      'Undivided inheritances and simple partnerships',
      'Hoiries et sociétés simples',
      OUT,
    ),
    other('166', 'Weitere Einkünfte', 'Other income', 'Autres revenus'),
    other(
      '170',
      'Kapitalabfindungen für wiederkehrende Leistungen',
      'Lump sums for recurring payments',
      'Prestations en capital remplaçant des prestations périodiques',
      OUT,
    ),
    other('178', 'Wohnrecht', 'Right of residence', 'Droit d’habitation', OUT),
    property(
      '190',
      'Nettoeinkünfte aus Liegenschaften',
      'Net income from property',
      'Revenu net des immeubles',
    ),
    total(
      '199',
      'Total der Einkünfte',
      'Total income (to page 3, Ziffer 301)',
      'Total des revenus (en page 3, Ziffer 301)',
    ),
  ];
}

// ---- Seite 3: Abzüge, Einkommensberechnung ----------------------------------------------------------

function page3(): FormRubric<LuPageId>[] {
  const prof = on('S3', 'berufsauslagen', { ...REPORT, guide: '27' });
  const training = on('S3', 'weiterbildung', { guide: '29' });
  const debt = on('S3', 'schuldzinsen', { ...REPORT, guide: '29' });
  const alimony = on('S3', 'unterhalt', { guide: '30' });
  const p3a = on('S3', 'vorsorge', { guide: '30' });
  const insurance = on('S3', 'versicherung', { ...REPORT, guide: '31' });
  const more = on('S3', 'weitere', { guide: '31' });
  const total = on('S3', 'total', { ...TOTAL, guide: '31' });
  const income = on('S3', 'einkommen', { ...TOTAL, guide: '32' });
  const extra = on('S3', 'zusaetzlich', { guide: '32 and 33' });
  const social = on('S3', 'sozialabzuege', { ...COMPUTED, guide: '33 and 34' });
  const taxable = on('S3', 'steuerbar', { ...TOTAL, guide: '34' });
  return [
    prof(
      '238',
      'Total Berufsauslagen Person 1 (Formular B)',
      'Professional costs, person 1 (form B)',
      'Frais professionnels, personne 1 (formulaire B)',
      A,
    ),
    prof(
      '239',
      'Total Berufsauslagen Person 2 (Formular B)',
      'Professional costs, person 2 (form B)',
      'Frais professionnels, personne 2 (formulaire B)',
      B,
    ),
    training(
      '248',
      'Berufsorientierte Aus- und Weiterbildung, Person 1',
      'Professional training, person 1',
      'Formation professionnelle, personne 1',
      A,
    ),
    training(
      '249',
      'Berufsorientierte Aus- und Weiterbildung, Person 2',
      'Professional training, person 2',
      'Formation professionnelle, personne 2',
      B,
    ),
    training(
      '250',
      'Berufsorientierte Aus- und Weiterbildung (Aufstellung)',
      'Professional training, together',
      'Formation professionnelle, ensemble',
      TOTAL,
    ),
    debt(
      '252',
      'Schuldzinsen (Schuldenverzeichnis)',
      'Private debt interest (form S)',
      'Intérêts des dettes privées (formulaire S)',
    ),
    alimony(
      '254',
      'Unterhaltsbeiträge an geschiedene/getrennt lebende Ehegatten/Partn.',
      'Alimony paid',
      'Pension alimentaire versée',
    ),
    alimony(
      '255',
      'Unterhaltsbeiträge / Alimente an minderjährige Kinder',
      'Child support paid',
      'Contributions d’entretien versées pour les enfants',
    ),
    alimony(
      '256',
      'Rentenleistungen / dauernde Lasten',
      'Annuities and permanent charges paid',
      'Rentes et charges durables versées',
      OUT,
    ),
    alimony('258', 'Wohnrecht', 'Right of residence granted', 'Droit d’habitation accordé', OUT),
    p3a(
      '260',
      'Beiträge an anerkannte Formen der gebundenen Selbstvorsorge (Säule 3a), Person 1',
      'Pillar 3a, person 1',
      'Pilier 3a, personne 1',
      A,
    ),
    p3a(
      '261',
      'Beiträge an anerkannte Formen der gebundenen Selbstvorsorge (Säule 3a), Person 2',
      'Pillar 3a, person 2',
      'Pilier 3a, personne 2',
      B,
    ),
    insurance(
      '270',
      'Versicherungsprämien und Zinsen von Sparkapitalien (Formular V)',
      'Insurance premiums and savings interest, at most the limit (form V)',
      'Primes d’assurance et intérêts d’épargne, au plus la limite (formulaire V)',
    ),
    more(
      '280',
      'Beiträge an 2. Säule, davon Einkauf, Person 1',
      'Pension fund buy-ins paid directly, person 1',
      'Rachats de prévoyance versés directement, personne 1',
      A,
    ),
    more(
      '282',
      'Beiträge an 2. Säule, davon Einkauf, Person 2',
      'Pension fund buy-ins paid directly, person 2',
      'Rachats de prévoyance versés directement, personne 2',
      B,
    ),
    more(
      '284',
      'AHV/IV/EO-Beiträge, Person 1',
      'AHV contributions paid directly, person 1',
      'Cotisations AVS versées directement, personne 1',
      { ...A, ...OUT },
    ),
    more(
      '285',
      'AHV/IV/EO-Beiträge, Person 2',
      'AHV contributions paid directly, person 2',
      'Cotisations AVS versées directement, personne 2',
      { ...B, ...OUT },
    ),
    more(
      '286',
      'AHV/IV/EO-Beiträge',
      'AHV contributions paid directly',
      'Cotisations AVS versées directement',
      OUT,
    ),
    more(
      '290',
      'Verrechenbare Geschäftsverluste',
      'Business losses of earlier years',
      'Pertes commerciales des années précédentes',
      OUT,
    ),
    total('299', 'Total Abzüge', 'Total deductions', 'Total des déductions'),
    income(
      '301',
      'Total der Einkünfte (Übertrag von Seite 2, Ziffer 199)',
      'Total income, from page 2',
      'Total des revenus, de la page 2',
      REPORT,
    ),
    income(
      '302',
      'Total der Abzüge (Übertrag von Ziffer 299)',
      'Total deductions, from 299',
      'Total des déductions, de 299',
      REPORT,
    ),
    income(
      '310',
      'Nettoeinkommen (Ziffer 301 abzüglich Ziffer 302)',
      'Net income: the base of the medical costs and donations',
      'Revenu net : base des frais médicaux et des dons',
    ),
    extra(
      '320',
      'Krankheits-, Unfall- und behinderungsbedingte Kosten',
      'Medical costs above 5 % of the net income',
      'Frais médicaux au-delà de 5 % du revenu net',
    ),
    extra('324', 'Freiwillige Zuwendungen', 'Donations', 'Dons'),
    extra(
      '325',
      'Zuwendungen und Beiträge an politische Parteien',
      'Political parties',
      'Partis politiques',
    ),
    extra(
      '326',
      'Sonderabzug bei Erwerbstätigkeit beider Ehegatten/Partn.',
      'Both spouses earn',
      'Les deux époux travaillent',
      COMPUTED,
    ),
    extra(
      '330',
      'Reineinkommen (Ziffer 310 abzüglich Ziffern 320 bis 326)',
      'Net income after the additional deductions',
      'Revenu net après les déductions supplémentaires',
      TOTAL,
    ),
    social(
      '340',
      'Persönlicher degressiver Sozialabzug',
      'Degressive social deduction',
      'Déduction sociale dégressive',
    ),
    social(
      '350',
      'Abzug für Kinder, minderjährig oder älter in schulischer oder beruflicher Ausbildung',
      'Child deduction',
      'Déduction pour enfants',
    ),
    social(
      '352',
      'Abzug für Kinder mit ständigem Aufenthalt am auswärtigen Ausbildungsort',
      'Child deduction, education away from home',
      'Déduction pour enfants en formation hors du domicile',
    ),
    social(
      '353',
      'Abzug für Eigenbetreuung',
      'Own care of children under 14',
      'Garde des enfants de moins de 14 ans par les parents',
    ),
    social(
      '360',
      'Fremdbetreuungskosten (Formular U/F)',
      'Childcare by others, per child under 14 (form U/F)',
      'Frais de garde par des tiers, par enfant de moins de 14 ans (formulaire U/F)',
      { role: 'input' },
    ),
    social(
      '370',
      'Abzug für Unterstützung von Personen',
      'People you support',
      'Personnes à charge',
      OUT,
    ),
    taxable(
      '380',
      'Steuerbares Einkommen (Ziffer 310 abzüglich Ziffern 320 bis 370)',
      'Taxable income',
      'Revenu imposable',
    ),
  ];
}

// ---- Seite 4: Vermögen im In- und Ausland --------------------------------------------------------

function page4(): FormRubric<LuPageId>[] {
  const w = { nature: 'wealth' as const, columns: WEALTH };
  const movable = on('S4', 'beweglich', { ...w, guide: '35' });
  const property = on('S4', 'liegenschaften', { ...w, ...OUT, guide: '36' });
  const business = on('S4', 'geschaeft', { ...w, ...OUT, guide: '36' });
  const total = on('S4', 'total', { ...w, ...TOTAL, guide: '36' });
  const debts = on('S4', 'schulden', { ...w, ...REPORT, guide: '36' });
  const net = on('S4', 'reinvermoegen', { ...w, ...TOTAL, guide: '36' });
  const free = on('S4', 'steuerfrei', { ...w, ...COMPUTED, guide: '36' });
  const taxable = on('S4', 'steuerbar', { ...w, ...TOTAL, guide: '36' });
  return [
    movable(
      '400',
      'Wertschriften und Guthaben (Wertschriftenverzeichnis)',
      'Accounts and securities, value on 31 December (the securities list)',
      'Comptes et titres, valeur au 31 décembre (état des titres)',
      REPORT,
    ),
    movable(
      '404',
      'Bargeld, Gold und andere Edelmetalle',
      'Cash, gold and precious metals',
      'Argent liquide, or et métaux précieux',
    ),
    movable(
      '410',
      'Lebensversicherungen',
      'Life insurance, surrender value',
      'Assurances-vie, valeur de rachat',
    ),
    movable('412', 'Motorfahrzeuge', 'Vehicles', 'Véhicules'),
    movable(
      '414',
      'Anteil Erbengemeinschaften und einfache Gesellschaften',
      'Undivided inheritances and simple partnerships',
      'Hoiries et sociétés simples',
      OUT,
    ),
    movable('416', 'Übrige Vermögenswerte', 'Other assets', 'Autres éléments de fortune'),
    property('420', 'Liegenschaften', 'Property', 'Immeubles'),
    business(
      '430',
      'Bewegliches Betriebsvermögen, Person 1',
      'Business assets, person 1',
      'Fortune commerciale, personne 1',
      A,
    ),
    business(
      '431',
      'Bewegliches Betriebsvermögen, Person 2',
      'Business assets, person 2',
      'Fortune commerciale, personne 2',
      B,
    ),
    business(
      '434',
      'Vermögensanteile an Personengesellschaften, Person 1',
      'Shares in partnerships, person 1',
      'Parts de sociétés de personnes, personne 1',
      A,
    ),
    business(
      '435',
      'Vermögensanteile an Personengesellschaften, Person 2',
      'Shares in partnerships, person 2',
      'Parts de sociétés de personnes, personne 2',
      B,
    ),
    total('450', 'Total der Vermögenswerte', 'Total assets', 'Total des éléments de fortune'),
    debts('462', 'Schulden (Schuldenverzeichnis)', 'Debts (form S)', 'Dettes (formulaire S)'),
    net('470', 'Reinvermögen (Ziffer 450 abzüglich Ziffer 462)', 'Net wealth', 'Fortune nette'),
    free(
      '472',
      'Steuerfreie Beträge für Verheiratete/eingetragene Partn.',
      'Tax-free wealth, spouses',
      'Fortune exonérée, époux',
    ),
    free(
      '473',
      'Steuerfreie Beträge für alle übrigen Steuerpflichtigen',
      'Tax-free wealth',
      'Fortune exonérée',
    ),
    free(
      '474',
      'Steuerfreie Beträge für jedes Kind',
      'Tax-free wealth per child',
      'Fortune exonérée par enfant',
    ),
    taxable(
      '480',
      'Steuerbares Vermögen (Ziffer 470 abzüglich Ziffern 472 bis 474)',
      'Taxable wealth',
      'Fortune imposable',
    ),
  ];
}

// ---- Ergänzungsblatt Direkte Bundessteuer --------------------------------------------------------

function sheet(): FormRubric<LuPageId>[] {
  const f = { columns: FEDERAL, guide: '54 and 55' };
  const add = on('EB', 'zurechnungen', { ...f, ...REPORT });
  const sub = on('EB', 'abrechnungen', { ...f, ...COMPUTED });
  const ded = on('EB', 'abzuege', { ...f, ...COMPUTED });
  const soc = on('EB', 'sozialabzuege', { ...f, ...COMPUTED });
  const n = (k: string) => ({ code: k.slice(1) });
  return [
    add(
      'E1',
      'Nettoeinkommen gemäss Ziffer 310 der Steuererklärung',
      'Net income of the return, Ziffer 310',
      'Revenu net de la déclaration, Ziffer 310',
      { ...n('E1'), nature: 'income' },
    ),
    add(
      'E2',
      'Abzug für Fahrkosten zwischen Wohn- und Arbeitsstätte (Ziff. 208t von Formular B Berufsauslagen)',
      'The cantonal travel costs of person 1, added back',
      'Les frais de déplacement cantonaux de la personne 1, rajoutés',
      { ...n('E2'), nature: 'income' },
    ),
    add(
      'E3',
      'Abzug für Fahrkosten zwischen Wohn- und Arbeitsstätte (Ziff. 209t von Formular B Berufsauslagen)',
      'The cantonal travel costs of person 2, added back',
      'Les frais de déplacement cantonaux de la personne 2, rajoutés',
      { ...n('E3'), nature: 'income' },
    ),
    add('E4', 'Mietwertreduktion', 'Rental value reduction', 'Réduction de la valeur locative', {
      ...n('E4'),
      nature: 'income',
      ...OUT,
    }),
    add(
      'E5',
      'Abzug für Versicherungsprämien und Zinsen von Sparkapitalien',
      'The cantonal insurance deduction, added back',
      'La déduction d’assurance cantonale, rajoutée',
      { ...n('E5'), nature: 'income' },
    ),
    add(
      'E6',
      'Steuerfreier Anteil Erträge aus qualifizierten Beteiligungen',
      'Tax-free share of qualifying participations, cantonal',
      'Part exonérée des participations qualifiées, cantonale',
      { ...n('E6'), nature: 'income', ...OUT },
    ),
    add('E7', 'Zwischentotal (Ziffern 1 bis 6)', 'Subtotal', 'Sous-total', {
      ...n('E7'),
      nature: 'income',
      ...TOTAL,
    }),
    sub(
      'E8',
      'Abzug für Fahrkosten zwischen Wohn- und Arbeitsstätte; Ziffer 2',
      'Federal travel costs of person 1, at most the federal limit',
      'Frais de déplacement fédéraux de la personne 1, au plus la limite fédérale',
      n('E8'),
    ),
    sub(
      'E9',
      'Abzug für Fahrkosten zwischen Wohn- und Arbeitsstätte; Ziffer 3',
      'Federal travel costs of person 2, at most the federal limit',
      'Frais de déplacement fédéraux de la personne 2, au plus la limite fédérale',
      n('E9'),
    ),
    sub(
      'E10',
      'Abzug für Versicherungsprämien und Zinsen von Sparkapitalien',
      'Federal insurance deduction',
      'Déduction d’assurance fédérale',
      n('E10'),
    ),
    sub(
      'E11',
      '30 % steuerfreier Anteil Erträge aus qualifizierten Beteiligungen',
      'Tax-free share of qualifying participations, federal',
      'Part exonérée des participations qualifiées, fédérale',
      { ...n('E11'), ...OUT },
    ),
    sub(
      'E12',
      'Nettoeinkommen (Ziffer 7 abzüglich Ziffern 8 bis 11)',
      'Net income, federal tax',
      'Revenu net, impôt fédéral',
      {
        ...n('E12'),
        nature: 'income',
        ...TOTAL,
      },
    ),
    ded(
      'E13',
      'Abzug der Krankheits- und Unfallkosten (Selbstbehalt 5 % des Nettoeinkommens gemäss Ziffer 12)',
      'Medical costs above 5 % of Ziffer 12',
      'Frais médicaux au-delà de 5 % de la Ziffer 12',
      n('E13'),
    ),
    ded(
      'E14',
      'Abzug für behinderungsbedingte Kosten',
      'Disability costs',
      'Frais liés à un handicap',
      { ...n('E14'), ...OUT },
    ),
    ded(
      'E15',
      'Abzug der Zuwendungen (max. 20 % des Nettoeinkommens gemäss Ziffer 12)',
      'Donations, at most 20 % of Ziffer 12',
      'Dons, au plus 20 % de la Ziffer 12',
      n('E15'),
    ),
    ded(
      'E16',
      'Abzug der Zuwendungen an politische Parteien',
      'Political parties, at most the federal limit',
      'Partis politiques, au plus la limite fédérale',
      n('E16'),
    ),
    ded(
      'E17',
      'Abzug vom Erwerbseinkommen des zweitverdienenden Ehegatten/Partn.',
      'Both spouses earn: half the lower income, between the federal minimum and maximum',
      'Double activité : la moitié du revenu le plus bas, entre le minimum et le maximum fédéraux',
      n('E17'),
    ),
    ded(
      'E18',
      'Abzug Fremdbetreuungskosten',
      'Childcare by others, at most the federal limit per child',
      'Frais de garde par des tiers, au plus la limite fédérale par enfant',
      n('E18'),
    ),
    ded(
      'E19',
      'Reineinkommen (Ziffer 12 abzüglich Ziffern 13 bis 18)',
      'Net income after deductions, federal tax',
      'Revenu net après déductions, impôt fédéral',
      {
        ...n('E19'),
        nature: 'income',
        ...TOTAL,
      },
    ),
    soc(
      'E20',
      'Abzug für minderjährige oder in der beruflichen Ausbildung stehende Kinder',
      'Federal child deduction',
      'Déduction fédérale pour enfants',
      n('E20'),
    ),
    soc(
      'E21',
      'Abzug für unterstützungsbedürftige Personen',
      'People you support',
      'Personnes à charge',
      { ...n('E21'), ...OUT },
    ),
    soc(
      'E22',
      'Abzug für Ehegatten/Partn., die in rechtlich und tatsächlich ungetrennter Ehe/Partnerschaft leben (Verheirateten-Abzug)',
      'Married couples, federal tax',
      'Couples mariés, impôt fédéral',
      n('E22'),
    ),
    soc(
      'E23',
      'Steuerbares Einkommen direkte Bundessteuer (Ziffer 19 abzüglich Ziffern 20 bis 22)',
      'Taxable income, federal tax',
      'Revenu imposable, impôt fédéral',
      { ...n('E23'), nature: 'income', ...TOTAL },
    ),
  ];
}

// ---- Pages -------------------------------------------------------------------------------------

const section = (id: string, title: string, en: string, fr: string) => ({
  id,
  title,
  gloss: g(en, fr),
});

function pages(y: number): FormPage<LuPageId>[] {
  return [
    {
      id: 'B',
      title: `Berufsauslagen ${y} (Formular B)`,
      gloss: g(
        'Professional costs, person 1 on the front, person 2 on the back (form B)',
        'Frais professionnels, personne 1 au recto, personne 2 au verso (formulaire B)',
      ),
      pdfPage: 16,
      supported: true,
      sections: [
        section(
          'fahrkosten',
          'Fahrkosten zwischen Wohn- und Arbeitsstätte',
          'Travel to work',
          'Frais de déplacement',
        ),
        section('verpflegung', 'Mehrkosten der Verpflegung', 'Meals away from home', 'Repas'),
        section(
          'uebrige',
          'Übrige für die Ausübung des Berufes erforderlichen Kosten',
          'Other professional costs',
          'Autres frais professionnels',
        ),
        section(
          'wochenaufenthalt',
          'Mehrkosten bei auswärtigem Wochenaufenthalt',
          'Weekly stay away from home',
          'Séjour hebdomadaire hors du domicile',
        ),
        section('nebenerwerb', 'Auslagen bei Nebenerwerb', 'Side job', 'Activité accessoire'),
        section('total', 'Total Berufsauslagen', 'Total', 'Total'),
      ],
      source: PRINTED.B,
    },
    {
      id: 'WV',
      title: `Wertschriften- und Guthabenverzeichnis ${y}`,
      gloss: g(
        'The securities list: its summary (Zusammenfassung)',
        'L’état des titres : son récapitulatif (Zusammenfassung)',
      ),
      pdfPage: 14,
      supported: true,
      sections: [section('zusammenfassung', 'Zusammenfassung', 'Summary', 'Récapitulatif')],
      source: PRINTED.WV,
    },
    {
      id: 'S2',
      title: `Einkünfte im In- und Ausland ${y}`,
      gloss: g(
        'Income in Switzerland and abroad (page 2 of the return)',
        'Revenus en Suisse et à l’étranger (page 2 de la déclaration)',
      ),
      pdfPage: 15,
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
          'Wertschriftenertrag und Ertrag aus Guthaben',
          'Income from accounts and securities',
          'Rendement des comptes et titres',
        ),
        section('uebrige', 'Übrige Einkünfte und Gewinne', 'Other income', 'Autres revenus'),
        section(
          'liegenschaften',
          'Nettoeinkünfte aus Liegenschaften',
          'Income from property',
          'Revenus immobiliers',
        ),
        section('total', 'Total der Einkünfte', 'Total income', 'Total des revenus'),
      ],
      source: PRINTED.S2,
    },
    {
      id: 'S3',
      title: `Abzüge ${y}`,
      gloss: g(
        'Deductions and the taxable income (page 3 of the return)',
        'Déductions et revenu imposable (page 3 de la déclaration)',
      ),
      pdfPage: 17,
      supported: true,
      sections: [
        section(
          'berufsauslagen',
          'Berufsauslagen bei unselbständiger Erwerbstätigkeit',
          'Professional costs',
          'Frais professionnels',
        ),
        section(
          'weiterbildung',
          'Berufsorientierte Aus- und Weiterbildung',
          'Professional training',
          'Formation professionnelle',
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
        section('einkommen', 'Einkommensberechnung', 'Net income', 'Revenu net'),
        section(
          'zusaetzlich',
          'Zusätzliche Abzüge',
          'Additional deductions',
          'Déductions supplémentaires',
        ),
        section('sozialabzuege', 'Sozialabzüge', 'Social deductions', 'Déductions sociales'),
        section('steuerbar', 'Steuerbares Einkommen', 'Taxable income', 'Revenu imposable'),
      ],
      source: PRINTED.S3,
    },
    {
      id: 'S4',
      title: `Vermögen im In- und Ausland am 31.12.${y}`,
      gloss: g(
        'Wealth on 31 December (page 4 of the return)',
        'Fortune au 31 décembre (page 4 de la déclaration)',
      ),
      pdfPage: 19,
      supported: true,
      sections: [
        section('beweglich', 'Bewegliches Vermögen', 'Movable wealth', 'Fortune mobilière'),
        section('liegenschaften', 'Liegenschaften', 'Property', 'Immeubles'),
        section(
          'geschaeft',
          'Bewegliches Betriebsvermögen Selbständigerwerbender',
          'Business assets',
          'Fortune commerciale',
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
      source: PRINTED.S4,
    },
    {
      id: 'EB',
      title: `Ergänzungsblatt Direkte Bundessteuer ${y}`,
      gloss: g(
        'The federal tax, derived from the return (optional sheet: the tax office derives it anyway, check it)',
        'L’impôt fédéral, dérivé de la déclaration (feuille facultative : l’administration le dérive de toute façon, à vérifier)',
      ),
      pdfPage: 1,
      supported: true,
      sections: [
        section('zurechnungen', 'Zurechnungen', 'Added back', 'Montants rajoutés'),
        section('abrechnungen', 'Abrechnungen', 'Taken off', 'Montants déduits'),
        section('abzuege', 'Abzüge', 'Deductions', 'Déductions'),
        section('sozialabzuege', 'Sozialabzüge', 'Social deductions', 'Déductions sociales'),
      ],
      source: PRINTED.EB,
    },
  ];
}

const rubrics = (): FormRubric<LuPageId>[] => [
  ...formB(),
  ...securities(),
  ...page2(),
  ...page3(),
  ...page4(),
  ...sheet(),
];

/** Shown with tax year 2026: its Ziffern come from the 2025 forms. */
export const LU_FORM_NOTE: Text = {
  en: 'The Ziffern and German terms come from the 2025 Lucerne forms, as the 2025 guide prints them (lu-2025-guide-wegleitung p. 13 to 19), and the 2025 Ergänzungsblatt: the 2026 forms are not published yet, so check each line on the form you get in 2027.',
  fr: 'Les Ziffern et les termes allemands viennent des formulaires lucernois 2025, tels que les imprime le guide 2025 (lu-2025-guide-wegleitung p. 13 à 19), et de l’Ergänzungsblatt 2025 : les formulaires 2026 ne sont pas encore publiés, vérifiez donc chaque ligne sur celui que vous recevrez en 2027.',
  de: 'Die Ziffern und Begriffe stammen aus den Luzerner Formularen 2025, wie sie die Wegleitung 2025 abdruckt (lu-2025-guide-wegleitung S. 13 bis 19), und aus dem Ergänzungsblatt 2025: Die Formulare 2026 sind noch nicht veröffentlicht, prüfe also jede Zeile auf dem Formular, das du 2027 erhältst.',
};

export const FORM_LU_2025: FormMap<LuPageId> = {
  taxYear: 2025,
  formYear: 2025,
  provisional: false,
  pages: pages(2025),
  rubrics: rubrics(),
};

/** Tax year 2026: the 2025 forms, until the 2026 ones are published; flagged provisional. */
export const FORM_LU_2026: FormMap<LuPageId> = {
  taxYear: 2026,
  formYear: 2025,
  provisional: true,
  note: LU_FORM_NOTE,
  pages: pages(2026),
  rubrics: rubrics(),
};

export function lucerneFormMap(taxYear: number): FormMap<LuPageId> {
  if (taxYear === 2025) return FORM_LU_2025;
  if (taxYear === 2026) return FORM_LU_2026;
  throw new Error(`No Lucerne form map for ${taxYear}.`);
}
