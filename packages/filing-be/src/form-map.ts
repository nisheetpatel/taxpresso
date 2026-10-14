// The Bern return for individuals (Steuererklärung, Natürliche Personen) as printed, in the order you
// fill it in: form 1 (where pillar 3a and pension fund buy-ins are declared), forms 2 to 6 with the
// lines Taxpresso fills, form 8 (not supported), then TaxMe's two summaries (Zusammenzug), the
// cantonal and communal one (ZK) and the federal one (ZB), to check what TaxMe works out.
//
// Source (docs/sources/be/manifest.json): be-2025-steuererklaerung-formulare-de, the 2025 return
// filled in for a fictional taxpayer: p. 1 to 6 and 8 the forms (DT0001 to DT0006, DT0008; p. 7 is
// the Zusatzblatt of 6.6), p. 9 and 10 TaxMe's "Zusammenzug TaxMe: Kantons- und Gemeindesteuern",
// p. 11 its "Zusammenzug TaxMe: Direkte Bundessteuer". The guide, be-2025-wegleitung-np-de, explains
// each line; its PDF page is its "Seite" plus 9.
//
// The Bern form numbers its sections (2.21, 4.2...), not its lines, so a line's key is the code of
// Bern's engine (@taxpresso/rules-be, rubrics.ts: '2.21-haupt', '4.3-schulden', 'saeule-3a'...) and
// its printed code is the section's number (or the line's number on form 3: 31, 32, 51). A line of
// the form with a column per person ("Mann", "Frau") is one household line with two parts, A and B,
// as the copy panel prints them (BE_COPY_LABELS: A is Mann, B is Frau).
//
// Where a form adds up lines Taxpresso has only as one amount (6.1 by means of travel, 4.2 premiums
// and savings interest, the lists of 3.0, 4.1, 4.3, 5.3 and 5.4), the amount goes on the form's
// total line (role 'total'): you type the lines from your documents and check the total.
//
// TaxMe's summaries: the lines and terms the specimen prints (p. 9 to 11) as printed, in its order;
// the lines it doesn't print (the specimen's taxpayer is single, with no pension, no 3a, no child)
// with the form's or the guide's term, cited there, after the printed lines of their section. Lines
// of the summaries carry TaxMe's "Steuerbar" column: role 'computed' (TaxMe works them out, you check
// they match), the totals role 'total'.
//
// Not mapped: the personal details, the children's names and the per-child rows of 2.1 (the
// amounts are given for all children together), the securities list itself (its totals 31 and 32
// are), and what Taxpresso doesn't prepare (property, self-employment, partnerships, gifts and
// inheritances, capital payments, lottery winnings, 5.2, 5.5, 6.3, withholding tax refunds): listed,
// marked unsupported.
import type {
  FormColumn,
  FormMap,
  FormPage,
  FormPart,
  FormRubric,
  Gloss,
} from '@taxpresso/filing-ge';
import type { Text } from '@taxpresso/rules-ch';

export const BE_PAGE_IDS = ['F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F8', 'ZK', 'ZB'] as const;
export type BePageId = (typeof BE_PAGE_IDS)[number];

const FORM = 'be-2025-steuererklaerung-formulare-de';
const GUIDE = 'be-2025-wegleitung-np-de';
/** The guide by its own page number ("Seite"): its PDF page is 9 more. */
const guide = (seite: number) => `${GUIDE} p. ${seite + 9} (Seite ${seite})`;
/** Where the summaries' automatic deductions are listed (rules-be, rubrics.ts). */
const DEDUCTIONS_TABLE = 'be-na-deductions-abzuege-freigrenzen sheet 2022-2027 (rows 26 to 44)';

type Options = Partial<
  Pick<
    FormRubric<BePageId>,
    'code' | 'parts' | 'nature' | 'role' | 'format' | 'columns' | 'supported'
  >
> & {
  /** Guide pages ("Seite") that explain the line. */
  guide?: number | readonly number[];
  /** Another source, after the form's page (an official table). */
  also?: string;
  /** The specimen's page, when not the section's (the summary's p. 10). */
  pdfPage?: number;
};

/** French typography: a no-break space before a colon, a semicolon and a percent sign. */
const frTypo = (s: string) =>
  s.replace(/ ?: /g, '\u00a0: ').replace(/ ; /g, '\u00a0; ').replace(/ %/g, '\u00a0%');

const g = (en: string, fr: string, de?: string): Gloss => ({
  en,
  fr: frTypo(fr),
  ...(de ? { de } : {}),
});

/** A line maker for one section of one page, with that section's defaults. */
function on(page: BePageId, pdfPage: number, section: string, defaults: Options) {
  return (key: string, label: string, en: string, fr: string, options: Options = {}) => {
    const o = { ...defaults, ...options };
    const pages = o.guide === undefined ? [] : typeof o.guide === 'number' ? [o.guide] : o.guide;
    const rubric: FormRubric<BePageId> = {
      key,
      ...(o.code ? { code: o.code } : {}),
      page,
      section,
      person: 'household',
      label,
      gloss: g(en, fr),
      nature: o.nature ?? 'income',
      role: o.role ?? 'input',
      format: o.format ?? 'money',
      columns: o.columns ?? AMOUNT,
      ...(o.parts ? { parts: o.parts } : {}),
      supported: o.supported ?? true,
      source: [
        `${FORM} p. ${o.pdfPage ?? pdfPage}`,
        ...pages.map(guide),
        ...(o.also ? [o.also] : []),
      ].join('; '),
    };
    return rubric;
  };
}

const AMOUNT: readonly FormColumn[] = ['amount'];
const WEALTH: readonly FormColumn[] = ['wealth'];
/** A line with a column per person: Mann (A, p1) and Frau (B, p2). */
const PERSONS: readonly FormPart[] = ['A', 'B'];
const BOTH = { parts: PERSONS };
const OUT = { supported: false };
const TICK = { format: 'tick' as const };

// ---- Formular 1: which forms, pillar 3a and buy-ins, your own household ------------------------

const f1 = (section: string, more: Options = {}) =>
  on('F1', 1, section, { code: section, nature: 'info', ...more });
const which = f1('1.1');
const asked = f1('1.2');
const F1 = [
  which(
    'f1-liegenschaften',
    'Eigentum, Nutzniessung oder Wohnrecht an Liegenschaften oder anderen Grundstücken (Formular 7)',
    'Property you own or have the use of (form 7)',
    'Immeubles en propriété, usufruit ou droit d’habitation (formule 7)',
    { ...OUT, ...TICK, guide: 147 },
  ),
  which(
    'f1-gesellschaften',
    'Beteiligung an Kollektiv-, Kommandit-, Baugesellschaften, einfachen Gesellschaften, Erben- oder Miteigentümergemeinschaften (Formular 8)',
    'A share in a partnership, a joint inheritance or co-ownership (form 8)',
    'Participation à une société de personnes, une hoirie ou une copropriété (formule 8)',
    { ...OUT, ...TICK, guide: [101, 116] },
  ),
  which(
    'f1-schenkung',
    'Schenkung erhalten oder ausgerichtet, Vermögen aus Erbschaft erhalten (Formular 8)',
    'A gift received or made, or an inheritance received (form 8)',
    'Donation reçue ou faite, ou héritage reçu (formule 8)',
    { ...OUT, ...TICK, guide: [117, 118] },
  ),
  which(
    'einkauf-bv',
    'Beiträge an die berufliche Vorsorge (2. Säule), die nicht auf einem Lohnausweis ausgewiesen sind',
    'Pension fund buy-ins you paid yourself, not on a salary certificate: on paper, tick ja and attach the attestation (Bescheinigung); in TaxMe-Online, type the amount under Abzüge, Einkauf 2. Säule',
    'Rachats de caisse de pension payés vous-même, absents du certificat de salaire : sur papier, cochez ja et joignez l’attestation (Bescheinigung) ; dans TaxMe-Online, inscrivez le montant sous Abzüge, Einkauf 2. Säule',
    { ...BOTH, nature: 'deduction', guide: [189, 190] },
  ),
  which(
    'saeule-3a',
    'Beiträge an anerkannte Formen der gebundenen Selbstvorsorge (Säule 3a)',
    'Paid into pillar 3a: on paper, tick ja and attach the attestation (Bescheinigung); in TaxMe-Online, type the amount under Abzüge, Beiträge Säule 3a',
    'Versé au 3e pilier A : sur papier, cochez ja et joignez l’attestation (Bescheinigung) ; dans TaxMe-Online, inscrivez le montant sous Abzüge, Beiträge Säule 3a',
    { ...BOTH, nature: 'deduction', guide: [189, 192] },
  ),
  which(
    'f1-kapitalleistungen',
    'Kapitalleistungen, die bisher noch nicht besteuert wurden oder die steuerfrei sind',
    'Lump sums from a pension or insurance not taxed yet, or tax-free',
    'Prestations en capital pas encore imposées ou exonérées',
    { ...OUT, ...TICK, ...BOTH, guide: 108 },
  ),
  which(
    'f1-selbststaendig',
    'Selbstständige Erwerbstätigkeit, ohne Landwirtschaft (Formular 9)',
    'Self-employment, not farming (form 9)',
    'Activité indépendante, hors agriculture (formule 9)',
    { ...OUT, ...TICK, guide: 34 },
  ),
  which(
    'f1-landwirtschaft',
    'Landwirtschaftsbetrieb im Haupt-, Neben- oder Zuerwerb (Formular 10)',
    'A farm (form 10)',
    'Exploitation agricole (formule 10)',
    { ...OUT, ...TICK, guide: 68 },
  ),
  asked(
    'alleinstehend',
    'Führen Sie alleine einen eigenen Haushalt?',
    'You keep your own household alone (or only with your children or a person you support): tick ja; TaxMe works out the deduction',
    'Vous tenez seul votre propre ménage (ou seulement avec vos enfants ou une personne à charge) : cochez ja ; TaxMe calcule la déduction',
    { ...TICK, nature: 'deduction', guide: 10 },
  ),
];

// ---- Formular 2: Kinder, Verschiedene Einkünfte ------------------------------------------------

const f2 = (section: string, more: Options) => on('F2', 2, section, { code: section, ...more });
const children = f2('2.1', { nature: 'deduction' });
const job = f2('2.21', BOTH);
const pensions = f2('2.22', { ...BOTH, guide: 103 });
const benefits = f2('2.23', { ...BOTH, guide: 106 });
const alimony = f2('2.24', { ...BOTH, guide: 107 });
const other = f2('2.25', { ...BOTH, guide: 109 });
const pause = f2('2.3', { ...BOTH, ...OUT });
const F2 = [
  children(
    '2.1-betreuung',
    'Bezahlte Kinderdrittbetreuungskosten',
    'Childcare paid to others (crèche, day care, childminder), all children together: type each child’s on their row',
    'Frais de garde par des tiers (crèche, accueil de jour, maman de jour), tous les enfants ensemble : inscrivez ceux de chaque enfant sur sa ligne',
    { guide: 14 },
  ),
  children(
    '2.1-ausbildung',
    'Auswärtige bzw. zusätzliche Ausbildungskosten',
    'Education away from home or extra education costs, all children together, as counted: type each child’s on their row',
    'Frais de formation hors du domicile ou supplémentaires, tous les enfants ensemble, tels que comptés : inscrivez ceux de chaque enfant sur sa ligne',
    { guide: 16 },
  ),
  children(
    'f2-einkommen-kind',
    'Einkommen des Kindes aus Erwerb, Rente, Stipendien',
    'A child’s own income: salary, pension, grants',
    'Revenu propre de l’enfant : salaire, rente, bourses',
    { ...OUT, nature: 'info', guide: 18 },
  ),
  job(
    '2.21-haupt',
    'Einkünfte aus unselbstständiger Haupterwerbstätigkeit (Nettolohn)',
    'Main job, net salary (salary certificate, box 11)',
    'Activité principale, salaire net (certificat de salaire, case 11)',
    { guide: 27 },
  ),
  job(
    '2.21-neben',
    'Einkünfte aus unselbstständiger Nebenerwerbstätigkeit (Nettolohn)',
    'Side job, net salary (salary certificate, box 11)',
    'Activité accessoire, salaire net (certificat de salaire, case 11)',
    { guide: 28 },
  ),
  job(
    'f2-entschaedigungen',
    'Entschädigungen, die im Nettolohn nicht enthalten sind',
    'Compensation not in the net salary (a company car for the way to work)',
    'Indemnités non comprises dans le salaire net (voiture de service pour le trajet)',
    { ...OUT, guide: [29, 33] },
  ),
  job(
    'f2-verwaltungsrat',
    'Tag- und Sitzungsgelder, Verwaltungsratshonorare, Tantiemen usw.',
    'Attendance fees, board fees, profit shares',
    'Jetons de présence, honoraires d’administrateur, tantièmes',
    { ...OUT, guide: 30 },
  ),
  pensions(
    '2.22-ahv',
    'AHV- und IV-Renten',
    'AHV/IV pensions (old age and disability)',
    'Rentes AVS/AI (vieillesse et invalidité)',
  ),
  pensions(
    '2.22-bv',
    'Renten (Pensionen) aus beruflicher Vorsorge',
    'Pension fund pensions',
    'Rentes de la prévoyance professionnelle',
  ),
  pensions(
    '2.22-andere',
    'Renten aus gebundener Vorsorge (Säule 3a), Haftpflicht/privater Unfallvers., Militärvers.',
    'Other pensions, with accident (SUVA) pensions and the taxable share of a life annuity (Säule 3b): type each on its line of 2.22',
    'Autres rentes, avec les rentes d’accident (SUVA) et la part imposable d’une rente viagère (pilier 3b) : inscrivez chacune sur sa ligne du 2.22',
    { guide: [104, 105] },
  ),
  benefits(
    '2.23-alv',
    'Netto-Leistungen aus Arbeitslosenversicherung',
    'Unemployment benefits paid to you directly, net',
    'Indemnités de chômage versées directement, nettes',
  ),
  benefits(
    '2.23-taggelder',
    'Netto-Erwerbsausfallentschädigungen; Taggelder aus Kranken-, Invaliden-, Unfall- oder Militärversicherung',
    'Loss-of-earnings allowances and daily allowances (sickness, disability, accident, military) paid to you directly, net: type each on its line',
    'Allocations pour perte de gain et indemnités journalières (maladie, invalidité, accident, militaire) versées directement, nettes : inscrivez chacune sur sa ligne',
  ),
  alimony(
    '2.24',
    'Erhaltene Unterhaltsbeiträge inkl. Anteil für minderjährige Kinder (Alimente)',
    'Alimony and child support received',
    'Pensions alimentaires et contributions d’entretien reçues',
  ),
  other(
    '2.25',
    'Steuerbare Einkünfte',
    'Other taxable income (say what it is)',
    'Autres revenus imposables (préciser)',
  ),
  other(
    'f2-nicht-steuerbar',
    'Nicht steuerbare Einkünfte',
    'Income that is not taxed (say what it is)',
    'Revenus non imposables (préciser)',
    { ...OUT, nature: 'info', guide: 110 },
  ),
  pause(
    'f2-erwerbsunterbruch',
    'AHV/IV/EO-Beiträge als nichterwerbstätige Person',
    'AHV contributions paid while not working',
    'Cotisations AVS payées sans activité lucrative',
    { nature: 'deduction', guide: [32, 193] },
  ),
];

// ---- Formular 3: Wertschriftenverzeichnis (its totals) -----------------------------------------

const list = (code: string, more: Options = {}) =>
  on('F3', 3, 'verzeichnis', { code, guide: 120, ...more });
const f3costs = on('F3', 3, 'abzuege', { code: '51', nature: 'deduction', guide: 144 });
const F3 = [
  list('28')(
    'f3-bargewinne-vst',
    'Bargewinne mit Verrechnungssteuerabzug',
    'Cash winnings with withholding tax deducted',
    'Gains en espèces soumis à l’impôt anticipé',
    { ...OUT, guide: 142 },
  ),
  list('29')(
    'f3-bargewinne',
    'Bargewinne ohne Verrechnungssteuerabzug (inkl. ausländische Lotteriegewinne)',
    'Cash winnings without withholding tax (foreign lotteries included)',
    'Gains en espèces sans impôt anticipé (loteries étrangères comprises)',
    { ...OUT, guide: 142 },
  ),
  list('30')(
    'f3-naturalgewinne',
    'Naturalgewinne (zum Marktwert bewertet)',
    'Winnings in kind, at market value',
    'Gains en nature, à la valeur vénale',
    { ...OUT, guide: 142 },
  ),
  list('31')(
    '3.0-ertrag',
    'Total Erträge (Total Kolonne F/G)',
    'Gross income of your accounts and securities in the year, both columns together (with and without withholding tax): the total of the list',
    'Rendement brut de vos comptes et titres de l’année, les deux colonnes ensemble (avec et sans impôt anticipé) : le total de l’état',
    { role: 'total' },
  ),
  list('32')(
    '3.0-vermoegen',
    'Total Vermögen (Kolonne I)',
    'Value of your accounts and securities on 31 December: the total of the list',
    'Valeur de vos comptes et titres au 31 décembre : le total de l’état',
    { role: 'total', nature: 'wealth', columns: WEALTH },
  ),
  list('41')(
    'f3-verrechnungssteuer',
    'Rückerstattungsantrag Verrechnungssteuer',
    'Refund of the Swiss withholding tax',
    'Remboursement de l’impôt anticipé',
    { ...OUT, nature: 'info', guide: 146 },
  ),
  f3costs(
    '3.0-kosten',
    'Nachweisbare Kosten für Wertschriftenverwaltung',
    'Costs of keeping your securities and accounts that you can prove',
    'Frais justifiés de garde des titres et avoirs',
  ),
  f3costs(
    'f3-geschaeft',
    'Geschäftsertrag und -vermögen, wenn oben enthalten',
    'Business income and assets, when in the list above',
    'Rendement et fortune commerciaux, s’ils figurent dans l’état',
    { ...OUT, code: '53', nature: 'info' },
  ),
];

// ---- Formular 4: Vermögenswerte, Versicherungen, Schulden, Parteien ----------------------------

const f4 = (section: string, more: Options) => on('F4', 4, section, { code: section, ...more });
const assets = f4('4.1', { nature: 'wealth', columns: WEALTH, guide: [169, 170] });
const insurance = f4('4.2', { nature: 'deduction' });
const debts = f4('4.3', { nature: 'deduction', role: 'total', guide: [172, 173, 174] });
const parties = f4('4.4', { nature: 'deduction', guide: 198 });
const surplus = f4('4.5', { nature: 'deduction', ...OUT });
const F4 = [
  assets(
    '4.1',
    'Total weiterer Vermögenswerte',
    'Other assets (cash, gold, vehicles, valuables) at their tax value on 31 December: the total of the list',
    'Autres éléments de fortune (espèces, or, véhicules, objets de valeur) à leur valeur fiscale au 31 décembre : le total de la liste',
    { role: 'total' },
  ),
  insurance(
    '4.2-wert',
    'Kapital- und Rentenversicherungen: Total Steuerwert',
    'Life and annuity insurance (Säule 3b), their tax value on 31 December (insurer’s statement), all policies together',
    'Assurances de capitaux et de rentes (pilier 3b), leur valeur fiscale au 31 décembre (attestation de l’assureur), toutes ensemble',
    { role: 'total', nature: 'wealth', columns: WEALTH, guide: 171 },
  ),
  insurance(
    '4.2-praemien',
    'Bezahlte Prämien für private Kranken- und Unfallversicherungen (nach Abzug allfälliger Prämienverbilligung)',
    'Health and accident insurance premiums you paid, less any premium subsidy',
    'Primes d’assurance-maladie et accidents payées, moins le subside éventuel',
    { guide: 195 },
  ),
  insurance(
    '4.2-zinsen',
    'Zinsen auf Sparkapitalien',
    'Interest on your savings: TaxMe takes it from your securities list (form 3)',
    'Intérêts de l’épargne : TaxMe les reprend de l’état des titres (formule 3)',
    { role: 'report', guide: 197 },
  ),
  insurance(
    '4.2',
    'Total Versicherungsprämien und Zinsen auf Sparkapitalien',
    'Insurance premiums (health, accident, life insurance) and savings interest together, as you declare them: TaxMe cuts the sum to the deduction allowed',
    'Primes d’assurance (maladie, accidents, assurance-vie) et intérêts de l’épargne ensemble, tels que déclarés : TaxMe ramène la somme à la déduction admise',
    { role: 'total', guide: [194, 196] },
  ),
  debts(
    '4.3',
    'Total Schuldzinsen und Schulden: Zinsen ohne Amortisation und ohne Leasingraten',
    'Interest on your private debts paid in the year, without repayments or leasing, all creditors together',
    'Intérêts de vos dettes privées payés dans l’année, sans amortissement ni leasing, tous les créanciers ensemble',
  ),
  debts(
    '4.3-schulden',
    'Total Schuldzinsen und Schulden: Schuldbetrag am 31.12.',
    'Your private debts on 31 December, all creditors together',
    'Vos dettes privées au 31 décembre, tous les créanciers ensemble',
    { nature: 'wealth', columns: WEALTH },
  ),
  parties(
    '4.4',
    'Mitgliederbeiträge und Zuwendungen an politische Parteien',
    'Payments to political parties, both of you together: type each party on its line',
    'Versements aux partis politiques, vous deux ensemble : inscrivez chaque parti sur sa ligne',
  ),
  surplus(
    'f4-kostenueberschuesse',
    'Nicht verrechnete Kostenüberschüsse aus vorangegangenen Steuerjahren',
    'Property cost surpluses from earlier years',
    'Excédents de frais immobiliers des années précédentes',
    { guide: 167 },
  ),
];

// ---- Formular 5: Unterhaltsbeiträge, Vergabungen, Krankheitskosten ----------------------------

const f5 = (section: string, more: Options) =>
  on('F5', 5, section, { code: section, nature: 'deduction', ...more });
const F5 = [
  f5('5.1', { guide: 200 })(
    '5.1',
    'Bezahlte Unterhaltsbeiträge inkl. Anteil für minderjährige Kinder (Alimente)',
    'Alimony and child support you paid: type each person on their line',
    'Pensions alimentaires et contributions d’entretien versées : inscrivez chaque bénéficiaire sur sa ligne',
  ),
  f5('5.2', { ...OUT, guide: 203 })(
    'f5-unterstuetzung',
    'Leistungen an unterstützungsbedürftige erwerbsunfähige Personen',
    'Support for a person in need who cannot work',
    'Aide à une personne dans le besoin incapable de travailler',
  ),
  f5('5.3', { role: 'total', guide: 199 })(
    '5.3',
    'Total Vergabungen',
    'Donations to tax-exempt organisations, all together',
    'Dons à des institutions exonérées, tous ensemble',
  ),
  f5('5.4', { role: 'total', guide: 204 })(
    '5.4',
    'Total selbst getragene Krankheits- und Unfallkosten',
    'Medical and accident costs you paid yourself, after what insurers paid, all invoices together',
    'Frais de maladie et d’accident à votre charge, après les remboursements, toutes les factures ensemble',
  ),
  f5('5.5', { ...OUT, guide: 205 })(
    'f5-behinderung',
    'Behinderungsbedingte Kosten',
    'Costs due to a disability',
    'Frais liés à un handicap',
  ),
];

// ---- Formular 6: Berufskosten, per person (Mann, Frau) -----------------------------------------

const f6 = (section: string, more: Options) =>
  on('F6', 6, section, { code: section, nature: 'deduction', ...BOTH, ...more });
const F6 = [
  f6('6.1', { role: 'total', guide: [176, 177, 178, 179] })(
    '6.1',
    'Total Fahrkosten',
    'Travel to work: what you type on the lines above (bike flat amount, public transport, car), together',
    'Trajets domicile-travail : ce que vous inscrivez sur les lignes au-dessus (forfait vélo, transports publics, voiture), ensemble',
  ),
  f6('6.2', { guide: 180 })(
    '6.2',
    'Auswärtige Verpflegung',
    'Meals away from home: your working days with a meal away times the rate per day, at most the yearly maximum',
    'Repas hors du domicile : vos jours de travail avec un repas à l’extérieur fois le taux par jour, au plus le maximum annuel',
  ),
  f6('6.3', { ...OUT, guide: 181 })(
    'f6-wochenaufenthalt',
    'Total Kosten Wochenaufenthalt',
    'Costs of staying away from home during the week',
    'Frais de séjour hebdomadaire hors du domicile',
  ),
  f6('6.4', { role: 'total', guide: [182, 183, 184] })(
    '6.4',
    'Total übrige Berufskosten',
    'Other professional costs: the flat amount (tick ja for the Pauschalabzug, TaxMe works it out) or your actual costs listed above',
    'Autres frais professionnels : le forfait (cochez ja pour le Pauschalabzug, TaxMe le calcule) ou vos frais effectifs listés au-dessus',
  ),
  f6('6.5', { ...TICK, guide: 187 })(
    '6.5',
    'Pauschalabzug für die Berufskosten des Nebenerwerbs',
    'Side job costs: tick ja for the flat amount; TaxMe works it out (ZK shows it)',
    'Frais de l’activité accessoire : cochez ja pour le forfait ; TaxMe le calcule (ZK l’affiche)',
  ),
  f6('6.6', { role: 'total', guide: 188 })(
    '6.6',
    'Netto Aus- und Weiterbildungskosten',
    'Professional training you paid (fees, books), less what your employer or others paid',
    'Formation professionnelle payée (écolage, livres), moins ce que l’employeur ou des tiers ont payé',
  ),
];

// ---- Formular 8: Beteiligungen, Erbschaften, Schenkungen (not supported) -----------------------

const f8 = (section: string, seite: number) =>
  on('F8', 8, section, { code: section, nature: 'info', ...OUT, guide: seite });
const F8 = [
  f8('8.1', 101)(
    'f8-gesellschaften',
    'Kollektiv-, Kommandit- und einfache Gesellschaften (selbstständige Erwerbstätigkeit)',
    'Partnerships (self-employment)',
    'Sociétés de personnes (activité indépendante)',
  ),
  f8('8.2', 102)(
    'f8-baugesellschaften',
    'Baugesellschaften und Konsortien',
    'Building companies and consortia',
    'Sociétés de construction et consortiums',
  ),
  f8('8.3', 116)(
    'f8-gemeinschaften',
    'Erben- und Miteigentümergemeinschaften',
    'Joint inheritances and co-ownership',
    'Hoiries et copropriétés',
  ),
  f8('8.4', 117)('f8-erbschaften', 'Erbschaften', 'Inheritances', 'Successions'),
  f8('8.5', 118)(
    'f8-schenkungen',
    'Schenkungen/Vorempfänge',
    'Gifts and advances on an inheritance',
    'Donations et avancements d’hoirie',
  ),
];

// ---- TaxMe's summaries: Zusammenzug Kantons- und Gemeindesteuern (ZK), Direkte Bundessteuer (ZB)

/** The lines both summaries share, in their order: income, then expenses and general deductions. */
function summaryLines(page: 'ZK' | 'ZB') {
  const pdfPage = page === 'ZK' ? 9 : 11;
  const columns: readonly FormColumn[] = [page === 'ZK' ? 'icc' : 'ifd'];
  const line = (section: string, nature: FormRubric['nature']) =>
    on(page, pdfPage, section, { nature, role: 'computed', columns });
  const income = line('einkuenfte', 'income');
  const expenses = line('aufwendungen', 'deduction');
  const total = (section: string, nature: FormRubric['nature']) =>
    on(page, pdfPage, section, { nature, role: 'total', columns });
  return {
    income: [
      income(
        '2.21-haupt',
        'Haupterwerb',
        'Main job, net salary',
        'Activité principale, salaire net',
        { ...BOTH, code: '2.21' },
      ),
      income(
        '2.21-neben',
        'Nebenerwerb',
        'Side job, net salary',
        'Activité accessoire, salaire net',
        {
          ...BOTH,
          code: '2.21',
        },
      ),
      income('2.22-ahv', 'AHV- und IV-Renten', 'AHV/IV pensions', 'Rentes AVS/AI', {
        ...BOTH,
        code: '2.22',
        pdfPage: 2,
        guide: 103,
      }),
      income(
        '2.22-bv',
        'Renten (Pensionen) aus beruflicher Vorsorge',
        'Pension fund pensions',
        'Rentes de la prévoyance professionnelle',
        { ...BOTH, code: '2.22', pdfPage: 2, guide: 103 },
      ),
      income(
        '2.22-andere',
        'Renten aus gebundener Vorsorge (Säule 3a), Haftpflicht/privater Unfallvers., Militärvers.',
        'Other pensions, and the taxable share of a life annuity',
        'Autres rentes, et la part imposable d’une rente viagère',
        { ...BOTH, code: '2.22', pdfPage: 2, guide: [104, 105] },
      ),
      income(
        '2.23-alv',
        'Netto-Leistungen aus Arbeitslosenversicherung',
        'Unemployment benefits, net',
        'Indemnités de chômage, nettes',
        { ...BOTH, code: '2.23', pdfPage: 2, guide: 106 },
      ),
      income(
        '2.23-taggelder',
        'Netto-Erwerbsausfallentschädigungen, Taggelder',
        'Loss-of-earnings allowances and daily allowances, net',
        'Allocations pour perte de gain et indemnités journalières, nettes',
        { ...BOTH, code: '2.23', pdfPage: 2, guide: 106 },
      ),
      income(
        '2.24',
        'Erhaltene Unterhaltsbeiträge/Alimente',
        'Alimony and child support received',
        'Pensions alimentaires et contributions d’entretien reçues',
        { ...BOTH, code: '2.24', pdfPage: 2, guide: 107 },
      ),
      income(
        '2.25',
        'Weitere, steuerbare Einkünfte',
        'Other taxable income',
        'Autres revenus imposables',
        { code: '2.25', pdfPage: 2, guide: 109 },
      ),
      income(
        '3.0-ertrag',
        'Wertschriftenertrag',
        'Income from securities and accounts: TaxMe prints it on two lines, subject to the withholding tax (VST unterliegend) or not (VST nicht unterliegend); this is both together',
        'Rendement des titres et avoirs : TaxMe l’imprime sur deux lignes, soumis à l’impôt anticipé (VST unterliegend) ou non (VST nicht unterliegend) ; voici les deux ensemble',
        { code: '3.0' },
      ),
      income(
        '3.0-kosten',
        'Nachweisbare Kosten für Wertschriftenverwaltung',
        'Costs of keeping securities and accounts, taken off the income',
        'Frais de garde des titres et avoirs, déduits du rendement',
        { code: '3.0' },
      ),
      total('einkuenfte', 'income')(
        '3.0-nettoertrag',
        'Total Nettoertrag Wertschriften',
        'Net income from securities and accounts: the income less the costs',
        'Rendement net des titres et avoirs : le rendement moins les frais',
        { code: '3.0' },
      ),
      total('einkuenfte', 'income')(
        'total-einkuenfte',
        'Total Einkünfte',
        'Total income',
        'Total des revenus',
      ),
    ],
    expenses: [
      expenses(
        '4.2',
        'Total Versicherungsprämien und Zinsen Sparkapitalien',
        'Insurance premiums and savings interest, as deducted',
        'Primes d’assurance et intérêts de l’épargne, tels que déduits',
        { code: '4.2' },
      ),
      expenses('6.1', 'Fahrkosten', 'Travel to work', 'Trajets domicile-travail', {
        ...BOTH,
        code: '6.1',
      }),
      expenses('6.2', 'auswärtige Verpflegung', 'Meals away from home', 'Repas hors du domicile', {
        ...BOTH,
        code: '6.2',
      }),
      expenses(
        '6.4',
        'Total übrige Berufskosten',
        'Other professional costs',
        'Autres frais professionnels',
        { ...BOTH, code: '6.4' },
      ),
      expenses(
        '6.5',
        'Berufskosten Nebenerwerb: Pauschalabzug',
        'Side job costs, the flat amount',
        'Frais de l’activité accessoire, le forfait',
        { ...BOTH, code: '6.5' },
      ),
      expenses(
        '6.6',
        'Berufsorientierte Aus- und Weiterbildungskosten',
        'Professional training',
        'Formation professionnelle',
        { ...BOTH, code: '6.6' },
      ),
      expenses('saeule-3a', 'Beiträge Säule 3a', 'Pillar 3a', '3e pilier A', {
        ...BOTH,
        pdfPage: 1,
        guide: [189, 192],
      }),
      expenses(
        'einkauf-bv',
        'Einkauf 2. Säule (Pensionskasse)',
        'Pension fund buy-ins paid yourself',
        'Rachats de caisse de pension payés vous-même',
        { ...BOTH, pdfPage: 1, guide: [189, 190] },
      ),
      expenses('4.3', 'Schuldzinsen', 'Interest on private debts', 'Intérêts des dettes privées', {
        code: '4.3',
        pdfPage: 4,
        guide: 174,
      }),
      expenses(
        '4.4',
        'Mitgliederbeiträge und Zuwendungen an politische Parteien',
        'Payments to political parties',
        'Versements aux partis politiques',
        { code: '4.4', pdfPage: 4, guide: 198 },
      ),
      expenses(
        '5.1',
        'Bezahlte Unterhaltsbeiträge',
        'Alimony and child support paid',
        'Pensions alimentaires et contributions d’entretien versées',
        { code: '5.1', pdfPage: 5, guide: 200 },
      ),
      expenses(
        '2.1-betreuung',
        'Bezahlte Kinderdrittbetreuungskosten',
        'Childcare by others',
        'Frais de garde par des tiers',
        { code: '2.1', pdfPage: 2, guide: 14 },
      ),
      expenses(
        'zweiverdiener',
        'Zweiverdienerabzug',
        'Deduction when both spouses earn',
        'Déduction pour double activité des conjoints',
        { guide: 13, also: DEDUCTIONS_TABLE },
      ),
      total('aufwendungen', 'deduction')(
        'total-aufwendungen',
        'Total Aufwendungen und allgemeine Abzüge',
        'Total expenses and general deductions',
        'Total des frais et déductions générales',
      ),
      total('aufwendungen', 'income')(
        'reineinkommen',
        'Reineinkommen',
        'Net income: the base of the donations and medical costs',
        'Revenu net : la base des dons et des frais médicaux',
      ),
    ],
  };
}

function zk(): FormRubric<BePageId>[] {
  const { income, expenses } = summaryLines('ZK');
  const columns: readonly FormColumn[] = ['icc'];
  const social = on('ZK', 9, 'sozialabzuege', { nature: 'deduction', role: 'computed', columns });
  const socialTotal = on('ZK', 9, 'sozialabzuege', { nature: 'income', role: 'total', columns });
  const wealth = on('ZK', 9, 'vermoegen', { nature: 'wealth', role: 'computed', columns });
  const wealthTotal = on('ZK', 9, 'vermoegen', { nature: 'wealth', role: 'total', columns });
  const less = on('ZK', 9, 'vermoegen-abzuege', { nature: 'wealth', role: 'computed', columns });
  const lessTotal = on('ZK', 9, 'vermoegen-abzuege', { nature: 'wealth', role: 'total', columns });
  const vst = on('ZK', 10, 'verrechnungssteuer', {
    code: '3.0',
    nature: 'info',
    role: 'computed',
    columns,
    ...OUT,
    guide: 146,
  });
  return [
    ...income,
    ...expenses,
    social(
      'allgemein',
      'Allgemeiner Abzug',
      'General deduction, for each taxpayer',
      'Déduction générale, par contribuable',
      { also: DEDUCTIONS_TABLE },
    ),
    social('5.3', 'Vergabungen', 'Donations', 'Dons', { code: '5.3' }),
    social(
      '5.4',
      'Selbstgetragene Krankheitskosten',
      'Medical costs above the threshold',
      'Frais médicaux au-delà du seuil',
      { code: '5.4' },
    ),
    social(
      'alleinstehend',
      'Abzug für Alleinstehende mit eigenem Haushalt',
      'Living alone in your own household',
      'Personne seule avec son propre ménage',
      { pdfPage: 1, guide: 10, also: DEDUCTIONS_TABLE },
    ),
    social('2.1-kinder', 'Kinderabzug', 'Child deduction', 'Déduction pour enfants', {
      pdfPage: 2,
      guide: 21,
      also: DEDUCTIONS_TABLE,
    }),
    social(
      '2.1-ausbildung',
      'Auswärtige bzw. zusätzliche Ausbildungskosten',
      'Education away from home or extra education costs',
      'Frais de formation hors du domicile ou supplémentaires',
      { code: '2.1', pdfPage: 2, guide: 16 },
    ),
    social(
      'bescheiden',
      'Abzug für bescheidene Einkommen',
      'Modest income deduction',
      'Déduction pour revenus modestes',
      { also: DEDUCTIONS_TABLE },
    ),
    socialTotal(
      'total-sozialabzuege',
      'Total persönliche Abzüge / Sozialabzüge',
      'Total personal and social deductions',
      'Total des déductions personnelles et sociales',
      { nature: 'deduction' },
    ),
    socialTotal(
      'steuerbares-einkommen',
      'Steuerbares Einkommen',
      'Taxable income',
      'Revenu imposable',
    ),
    wealth(
      '3.0-vermoegen',
      'Wertschriftenvermögen',
      'Securities and accounts',
      'Titres et avoirs',
      { code: '3.0' },
    ),
    wealthTotal(
      '3.0-wertschriften-netto',
      'Total Wertschriften netto',
      'Securities and accounts, net',
      'Titres et avoirs, nets',
      { code: '3.0' },
    ),
    wealth('4.1', 'Weitere Vermögenswerte', 'Other assets', 'Autres éléments de fortune', {
      code: '4.1',
    }),
    wealthTotal(
      '4.1-total',
      'Total weitere Vermögenswerte',
      'Other assets, total',
      'Autres éléments de fortune, total',
      { code: '4.1' },
    ),
    wealth(
      '4.2-wert',
      'Kapital- und Rentenversicherungen',
      'Life and annuity insurance, tax value',
      'Assurances de capitaux et de rentes, valeur fiscale',
      { code: '4.2', pdfPage: 4, guide: 171 },
    ),
    wealthTotal('total-vermoegen', 'Total Vermögen', 'Total wealth', 'Total de la fortune'),
    less('4.3-schulden', 'Schulden', 'Debts', 'Dettes', { code: '4.3', pdfPage: 4, guide: 173 }),
    less(
      'vermoegen-verheiratet',
      'Abzug für Verheiratete',
      'Wealth deduction for spouses',
      'Déduction de fortune pour époux',
      { also: DEDUCTIONS_TABLE },
    ),
    less(
      'vermoegen-kinder',
      'Kinderabzug',
      'Wealth deduction per child',
      'Déduction de fortune par enfant',
      { also: DEDUCTIONS_TABLE },
    ),
    lessTotal(
      'total-vermoegen-abzuege',
      'Total Abzüge',
      'Total wealth deductions, debts included',
      'Total des déductions sur la fortune, dettes comprises',
    ),
    lessTotal(
      'steuerbares-vermoegen',
      'Steuerbares Vermögen',
      'Taxable wealth',
      'Fortune imposable',
    ),
    vst(
      'vst-ertraege',
      'STE-NP: Total Erträge der VST unterliegend',
      'Income subject to the Swiss withholding tax',
      'Revenus soumis à l’impôt anticipé',
    ),
    vst(
      'vst-anspruch',
      'Total Rückerstattungsanspruch',
      'Withholding tax to be refunded',
      'Impôt anticipé à rembourser',
    ),
  ];
}

function zb(): FormRubric<BePageId>[] {
  const { income, expenses } = summaryLines('ZB');
  const columns: readonly FormColumn[] = ['ifd'];
  const social = on('ZB', 11, 'sozialabzuege', { nature: 'deduction', role: 'computed', columns });
  const total = on('ZB', 11, 'sozialabzuege', { nature: 'income', role: 'total', columns });
  return [
    ...income,
    ...expenses,
    social(
      'verheiratet',
      'Abzug für Verheiratete',
      'Married couple deduction',
      'Déduction pour couples mariés',
    ),
    social('5.3', 'Vergabungen', 'Donations', 'Dons', { code: '5.3' }),
    social(
      '5.4',
      'Selbstgetragene Krankheitskosten',
      'Medical costs above the threshold',
      'Frais médicaux au-delà du seuil',
      { code: '5.4' },
    ),
    social('2.1-kinder', 'Kinderabzug', 'Child deduction', 'Déduction pour enfants', {
      pdfPage: 2,
      guide: 21,
    }),
    total(
      'total-sozialabzuege',
      'Total persönliche Abzüge / Sozialabzüge',
      'Total personal and social deductions',
      'Total des déductions personnelles et sociales',
      { nature: 'deduction' },
    ),
    total('steuerbares-einkommen', 'Steuerbares Einkommen', 'Taxable income', 'Revenu imposable'),
  ];
}

// ---- Pages -------------------------------------------------------------------------------------

const section = (id: string, title: string, en: string, fr: string) => ({
  id,
  title,
  gloss: g(en, fr),
});

/** The sections both summaries share. */
const SUMMARY_SECTIONS = [
  section('einkuenfte', 'Einkünfte', 'Income', 'Revenus'),
  section(
    'aufwendungen',
    'Aufwendungen und allgemeine Abzüge',
    'Expenses and general deductions',
    'Frais et déductions générales',
  ),
  section(
    'sozialabzuege',
    'Persönliche Abzüge / Sozialabzüge',
    'Personal and social deductions',
    'Déductions personnelles et sociales',
  ),
];

function pages(taxYear: number): FormPage<BePageId>[] {
  const year = taxYear;
  const form = (n: number) => `Steuererklärung ${year}, Formular ${n}`;
  return [
    {
      id: 'F1',
      title: form(1),
      gloss: g(
        'Which forms, pillar 3a and buy-ins, your household',
        'Quelles formules, 3e pilier A et rachats, votre ménage',
      ),
      pdfPage: 1,
      supported: true,
      sections: [
        section(
          '1.1',
          'Prüfen Sie anhand der folgenden Fragen, welche Formulare Sie ausfüllen und einreichen müssen',
          'Which forms you fill in and send',
          'Quelles formules remplir et envoyer',
        ),
        section(
          '1.2',
          'Verschiedene Angaben und Unterschrift(en)',
          'Other details and signatures',
          'Autres indications et signatures',
        ),
      ],
      source: `${FORM} p. 1`,
    },
    {
      id: 'F2',
      title: form(2),
      gloss: g('Children and income', 'Enfants et revenus'),
      pdfPage: 2,
      supported: true,
      sections: [
        section('2.1', 'Kinder', 'Children', 'Enfants'),
        section(
          '2.21',
          'Einkünfte aus unselbstständiger Erwerbstätigkeit',
          'Salaried work',
          'Activité salariée',
        ),
        section('2.22', 'Einkünfte aus Renten und Pensionen', 'Pensions', 'Rentes et pensions'),
        section(
          '2.23',
          'Einkünfte aus Erwerbsausfallentschädigungen',
          'Benefits replacing a salary',
          'Indemnités pour perte de gain',
        ),
        section(
          '2.24',
          'Erhaltene Unterhaltsbeiträge/Alimente',
          'Alimony received',
          'Pensions alimentaires reçues',
        ),
        section(
          '2.25',
          'Weitere, nicht anderweitig deklarierte Einkünfte',
          'Other income',
          'Autres revenus',
        ),
        section(
          '2.3',
          'Erwerbsunterbruch, Nichterwerbstätige',
          'A break from work, not working',
          'Interruption d’activité, sans activité lucrative',
        ),
      ],
      source: `${FORM} p. 2`,
    },
    {
      id: 'F3',
      title: form(3),
      gloss: g('Securities list: its totals', 'État des titres : ses totaux'),
      pdfPage: 3,
      supported: true,
      sections: [
        section(
          'verzeichnis',
          'Wertschriftenverzeichnis und Rückerstattungsantrag Verrechnungssteuer',
          'Securities list and withholding tax refund',
          'État des titres et remboursement de l’impôt anticipé',
        ),
        section('abzuege', 'Abzüge', 'Deductions', 'Déductions'),
      ],
      source: `${FORM} p. 3`,
    },
    {
      id: 'F4',
      title: form(4),
      gloss: g(
        'Other assets, insurance, debts, political parties',
        'Autres éléments de fortune, assurances, dettes, partis politiques',
      ),
      pdfPage: 4,
      supported: true,
      sections: [
        section(
          '4.1',
          'Weitere Vermögenswerte (Barschaft, Fahrzeuge, Wertgegenstände, Sammlungen usw.)',
          'Other assets',
          'Autres éléments de fortune',
        ),
        section(
          '4.2',
          'Versicherungen und Zinsen auf Sparkapitalien',
          'Insurance and savings interest',
          'Assurances et intérêts de l’épargne',
        ),
        section('4.3', 'Schulden und Schuldzinsen', 'Debts and interest', 'Dettes et intérêts'),
        section(
          '4.4',
          'Mitgliederbeiträge und Zuwendungen an politische Parteien',
          'Political parties',
          'Partis politiques',
        ),
        section(
          '4.5',
          'Nicht verrechnete Kostenüberschüsse aus vorangegangenen Steuerjahren',
          'Cost surpluses of earlier years',
          'Excédents de frais des années précédentes',
        ),
      ],
      source: `${FORM} p. 4`,
    },
    {
      id: 'F5',
      title: form(5),
      gloss: g('Alimony paid, donations, medical costs', 'Pensions versées, dons, frais médicaux'),
      pdfPage: 5,
      supported: true,
      sections: [
        section(
          '5.1',
          'Bezahlte Unterhaltsbeiträge inkl. Anteil für minderjährige Kinder (Alimente) und bezahlte Renten und dauernde Lasten',
          'Alimony and child support paid',
          'Pensions alimentaires versées',
        ),
        section(
          '5.2',
          'Leistungen an unterstützungsbedürftige erwerbsunfähige Personen',
          'Support for a person in need',
          'Aide à une personne dans le besoin',
        ),
        section('5.3', 'Vergabungen', 'Donations', 'Dons'),
        section(
          '5.4',
          'Krankheits- und Unfallkosten',
          'Medical and accident costs',
          'Frais de maladie et d’accident',
        ),
        section(
          '5.5',
          'Behinderungsbedingte Kosten',
          'Disability costs',
          'Frais liés à un handicap',
        ),
      ],
      source: `${FORM} p. 5`,
    },
    {
      id: 'F6',
      title: form(6),
      gloss: g('Professional costs, per person', 'Frais professionnels, par personne'),
      pdfPage: 6,
      supported: true,
      sections: [
        section('6.1', 'Fahrkosten', 'Travel to work', 'Trajets domicile-travail'),
        section('6.2', 'Auswärtige Verpflegung', 'Meals away from home', 'Repas hors du domicile'),
        section(
          '6.3',
          'Auswärtiger Wochenaufenthalt',
          'Staying away during the week',
          'Séjour hebdomadaire hors du domicile',
        ),
        section(
          '6.4',
          'Übrige Berufskosten',
          'Other professional costs',
          'Autres frais professionnels',
        ),
        section(
          '6.5',
          'Berufskosten Nebenerwerb',
          'Side job costs',
          'Frais de l’activité accessoire',
        ),
        section(
          '6.6',
          'Berufsorientierte Aus- und Weiterbildungskosten',
          'Professional training',
          'Formation professionnelle',
        ),
      ],
      source: `${FORM} p. 6`,
    },
    {
      id: 'F8',
      title: form(8),
      gloss: g(
        'Partnerships, inheritances and gifts (not supported)',
        'Sociétés, successions et donations (non pris en charge)',
      ),
      pdfPage: 8,
      supported: false,
      sections: [
        section(
          '8.1',
          'Kollektiv-, Kommandit- und einfache Gesellschaften',
          'Partnerships',
          'Sociétés de personnes',
        ),
        section(
          '8.2',
          'Baugesellschaften und Konsortien',
          'Building companies',
          'Sociétés de construction',
        ),
        section(
          '8.3',
          'Erben- und Miteigentümergemeinschaften',
          'Joint inheritances and co-ownership',
          'Hoiries et copropriétés',
        ),
        section('8.4', 'Erbschaften', 'Inheritances', 'Successions'),
        section('8.5', 'Schenkungen/Vorempfänge', 'Gifts', 'Donations'),
      ],
      source: `${FORM} p. 8`,
    },
    {
      id: 'ZK',
      title: `Zusammenzug TaxMe: Kantons- und Gemeindesteuern ${year}`,
      gloss: g(
        'TaxMe’s summary of the cantonal and communal tax: check its Steuerbar column',
        'Récapitulatif TaxMe des impôts cantonal et communal : vérifiez sa colonne Steuerbar',
      ),
      pdfPage: 9,
      supported: true,
      sections: [
        ...SUMMARY_SECTIONS,
        section('vermoegen', 'Vermögen', 'Wealth', 'Fortune'),
        section(
          'vermoegen-abzuege',
          'Vermögen: Abzüge',
          'Wealth: deductions',
          'Fortune : déductions',
        ),
        section(
          'verrechnungssteuer',
          'Verrechnungssteuerguthaben',
          'Withholding tax to be refunded',
          'Impôt anticipé à récupérer',
        ),
      ],
      source: `${FORM} p. 9`,
    },
    {
      id: 'ZB',
      title: `Zusammenzug TaxMe: Direkte Bundessteuer ${year}`,
      gloss: g(
        'TaxMe’s summary of the federal tax: check its Steuerbar column',
        'Récapitulatif TaxMe de l’impôt fédéral direct : vérifiez sa colonne Steuerbar',
      ),
      pdfPage: 11,
      supported: true,
      sections: SUMMARY_SECTIONS,
      source: `${FORM} p. 11`,
    },
  ];
}

function rubrics(): FormRubric<BePageId>[] {
  return [...F1, ...F2, ...F3, ...F4, ...F5, ...F6, ...F8, ...zk(), ...zb()];
}

/**
 * The form's section numbers and terms are the 2025 return's until the 2026 forms are published
 * (docs/sources/be/NOTES.md, Gaps): shown with every Bern return, as for Zurich.
 */
export const BE_FORM_NOTE: Text = {
  en: 'The section numbers and German terms come from the 2025 Bern return (be-2025-steuererklaerung-formulare-de): the 2026 forms are not published yet, so check each line on yours.',
  fr: 'Les numéros de section et les termes allemands viennent de la déclaration bernoise 2025 (be-2025-steuererklaerung-formulare-de)\u00a0: les formules 2026 ne sont pas encore publiées, vérifiez donc chaque ligne sur les vôtres.',
  de: 'Die Ziffern und Begriffe stammen aus der Berner Steuererklärung 2025 (be-2025-steuererklaerung-formulare-de): Die Formulare 2026 sind noch nicht veröffentlicht, prüfe also jede Zeile auf deinen.',
};

export const FORM_BE_2025: FormMap<BePageId> = {
  taxYear: 2025,
  formYear: 2025,
  provisional: false,
  pages: pages(2025),
  rubrics: rubrics(),
};

/** Tax year 2026: the 2026 forms are not published yet, so its pages are 2025's, provisional. */
export const FORM_BE_2026: FormMap<BePageId> = {
  taxYear: 2026,
  formYear: 2025,
  provisional: true,
  note: BE_FORM_NOTE,
  pages: pages(2026),
  rubrics: rubrics(),
};

export function bernFormMap(taxYear: number): FormMap<BePageId> {
  if (taxYear === 2025) return FORM_BE_2025;
  if (taxYear === 2026) return FORM_BE_2026;
  throw new Error(`No Bern form map for ${taxYear}.`);
}
