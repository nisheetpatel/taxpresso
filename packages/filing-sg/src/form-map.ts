// St. Gallen's return (Steuererklärung für natürliche Personen, Kantons-, Gemeinde- und direkte
// Bundessteuer, Formular 1) and its Form 4 (Berufskosten) as printed, in the order you fill them in:
// Form 4 for Person 1 (its front) and for Person 2 (its back), whose totals go to 10.1 and 10.2 of the
// return; then the return's page 2, the income (Einkünfte im In- und Ausland), page 3, the
// deductions down to the taxable income 268 (Abzüge, Einkommensberechnung), and page 4, the wealth
// (Vermögen im In- und Ausland). Every line with its code (the Feld number printed at its right) and
// its German label as printed, led by its Ziffer; the gloss says what it is in plain words.
//
// Sources (docs/sources/sg/manifest.json): the blank 2025 forms, sg-2025-form-steuererklaerung (p. 2
// to 4) and sg-2025-form-berufskosten (p. 1 Person 1, p. 2 Person 2: the same lines, Person 2's codes
// 50 higher, 450 to 488), and the 2025 guide, sg-2025-guide-wegleitung, which explains each Ziffer
// under the same number ("Die Ziffern der Wegleitung entsprechen den Ziffern der Steuererklärung",
// p. 6; "p." is the PDF page, the guide prints the same numbers). No 2026 return is published yet
// (docs/sources/sg/NOTES.md, Gaps): tax year 2026 uses the 2025 forms, flagged provisional.
//
// Columns (SG_COPY_LABELS, ./items.ts): the return has ONE amount column; the tax office derives the
// federal tax from it (sg-2025-guide-wegleitung p. 5 and p. 49). Page 2 heads it "Einkünfte 2025 für
// die Dauer der Steuerpflicht" (here 'icc_ifd': one amount for both taxes), Form 4 and page 3 "Abzüge
// 2025 (für die Dauer der Steuerpflicht)" (here 'amount', so each page shows its own heading), page 4
// "Steuerwert am 31. Dezember 2025" ('wealth'). Page 3 prints 21.1's costs (650) and excess (238) in a
// pre-column (Vorkolonne, sg-2025-guide-wegleitung p. 29) and carries the difference to 240: they are
// in the one column here, their gloss says so.
//
// Labels: as printed, without the amounts and rates some of them print (Form 4's "Pro Arbeitstag
// Fr. 15 / im Jahr Fr. 3'200", page 3's "Fr. 7'600", "2%", page 4's "Fr. 75'000"): those are the
// engine's, each cited there (packages/rules-sg), and the 2026 amounts may differ. The form's en
// dashes ("1.1 – 1.3") are written as hyphens, as page 3 prints "23.1-23.3".
//
// Not mapped: the return's page 1 (personal details, children, the refund account), its
// supplementary capital benefits 40.1 to 40.3 (only their total 950 is listed), and the forms that
// feed a line: the securities list (Wertschriften- und Guthabenverzeichnis, Formular 2) for 146 and
// 300, Form 5 (Schulden, Zuwendungen) for 500, 555, 244 and 504, Form 6 (Versicherungsprämien,
// Krankheitskosten) for 600 and 650, Form 10 (Kinderbetreuungs- und Ausbildungskosten) for 258 and
// 256: the line gets the amount they carry. What Taxpresso doesn't prepare (self-employment,
// qualifying participations, property, inheritances, capital payments, annuities paid, other and
// disability deductions, the support deduction, shift work, weekly stays, a side job's actual costs,
// the information lines) is listed, marked unsupported.
import type {
  FormColumn,
  FormMap,
  FormPage,
  FormPerson,
  FormRubric,
  Gloss,
} from '@taxpresso/filing-ge';
import type { Text } from '@taxpresso/rules-ch';

/** Form 4 Person 1 and Person 2, then the return's pages 2, 3 and 4 ("Seite"). */
export const SG_PAGE_IDS = ['F4-1', 'F4-2', 'S2', 'S3', 'S4'] as const;
export type SgPageId = (typeof SG_PAGE_IDS)[number];

const FORM = 'sg-2025-form-steuererklaerung';
const FORM4 = 'sg-2025-form-berufskosten';
const GUIDE = 'sg-2025-guide-wegleitung';

/** Form 4's total for each person, which page 3 carries to 10.1 and 10.2. */
export const SG_FORM4_TOTAL = { p1: '438', p2: '488' } as const;

type Options = Partial<
  Pick<FormRubric<SgPageId>, 'person' | 'nature' | 'role' | 'format' | 'columns' | 'supported'>
> & {
  guide?: string;
  /** The form prints the line without its Ziffer (Form 4's subtotal 406): cited, not in the label. */
  unnumbered?: boolean;
};

/** French typography: a no-break space before a colon and a percent sign. */
const frTypo = (s: string) => s.replace(/ ?: /g, '\u00a0: ').replace(/ %/g, '\u00a0%');

const g = (en: string, fr: string): Gloss => ({ en, fr: frTypo(fr) });

/** Page 2: "Einkünfte 2025", one amount for the cantonal, communal and federal tax. */
const INCOME: readonly FormColumn[] = ['icc_ifd'];
/** Form 4 and page 3: "Abzüge 2025", the same one column. */
const DEDUCTION: readonly FormColumn[] = ['amount'];
/** Page 4: "Steuerwert am 31. Dezember 2025". */
const WEALTH: readonly FormColumn[] = ['wealth'];
const A = { person: 'A' as FormPerson };
const B = { person: 'B' as FormPerson };
const OUT = { supported: false };

/**
 * A line maker for one section of one page, with that section's defaults. `ziffer` leads the label
 * as printed and is cited with the page.
 */
function on(page: SgPageId, at: string, section: string, defaults: Options) {
  return (
    key: string,
    ziffer: string,
    label: string,
    en: string,
    fr: string,
    options: Options = {},
  ): FormRubric<SgPageId> => {
    const o = { ...defaults, ...options };
    return {
      key,
      code: key,
      page,
      section,
      person: o.person ?? 'household',
      label: o.unnumbered ? label : `${ziffer} ${label}`,
      gloss: g(en, fr),
      nature: o.nature ?? 'deduction',
      role: o.role ?? 'input',
      format: o.format ?? 'money',
      columns: o.columns ?? DEDUCTION,
      supported: o.supported ?? true,
      source: `${at} (Ziffer ${ziffer.replace(/\.$/, '')})${o.guide !== undefined ? `; ${GUIDE} p. ${o.guide}` : ''}`,
    };
  };
}

// ---- Formular 4: Berufskosten Person 1 (front) and Person 2 (back) ------------------------------

/** Form 4 for one person: the same lines on both sides, Person 2's codes 50 higher. */
function form4(n: 1 | 2): FormRubric<SgPageId>[] {
  const page: SgPageId = n === 1 ? 'F4-1' : 'F4-2';
  const at = `${FORM4} p. ${n}`;
  const who = n === 1 ? A : B;
  const f4 = (section: string, more: Options = {}) => on(page, at, section, { ...who, ...more });
  const code = (c: number) => String(c + (n - 1) * 50);
  const p = (en: string) => `${en}, person ${n}`;
  const pf = (fr: string) => `${fr}, personne ${n}`;
  const travel = f4('fahrkosten', { guide: '23' });
  const meals = f4('verpflegung', { guide: '24' });
  const other = f4('uebrige', { guide: '24' });
  const week = f4('wochenaufenthalt', OUT);
  const side = f4('nebenerwerb', { guide: '25' });
  return [
    travel(
      code(400),
      '1.1',
      'Öffentliche Verkehrsmittel',
      p('Public transport to work: what it cost, each route on its line'),
      pf(
        'Transports publics pour aller au travail : ce qu’ils ont coûté, chaque trajet sur sa ligne',
      ),
    ),
    travel(
      code(402),
      '1.2',
      'Fahrrad, Kleinmotorrad bis 50 cm³ (Kontrollschild mit gelbem Grund)',
      p('Bike, moped or small motorbike with a yellow plate: up to a yearly amount'),
      pf('Vélo, cyclomoteur ou petite moto à plaque jaune : jusqu’à un montant annuel'),
    ),
    travel(
      code(404),
      '1.3',
      'Motorfahrzeug',
      p(
        'Car or motorbike, only for a reason the form lists (no usable public transport, and so on): the kilometres at the guide’s rate',
      ),
      pf(
        'Voiture ou moto, seulement pour un motif que le formulaire indique (pas de transports publics utilisables, etc.) : les kilomètres au taux du guide',
      ),
    ),
    travel(
      code(406),
      '1.',
      'Zwischentotal Ziffern 1.1-1.3',
      p('Travel to work, the subtotal of 1.1 to 1.3, at most the yearly maximum'),
      pf('Frais de déplacement, sous-total de 1.1 à 1.3, au plus le maximum annuel'),
      { role: 'total', unnumbered: true },
    ),
    meals(
      code(408),
      '2.1',
      'Bei auswärtiger Verpflegung, sofern die Dauer der Arbeitspause die Heimkehr nicht ermöglicht',
      p(
        'Lunch away from home when the break is too short to go home: an amount per working day, at most a yearly amount',
      ),
      pf(
        'Repas hors du domicile quand la pause ne permet pas de rentrer : un montant par jour de travail, au plus un montant annuel',
      ),
    ),
    meals(
      code(410),
      '2.2',
      'Wenn die Verpflegung durch den Arbeitgeber verbilligt wird und dem Arbeitnehmer trotzdem Mehrkosten entstehen',
      p(
        'Lunch made cheaper by the employer (canteen or vouchers, box G of the salary certificate): half the amounts',
      ),
      pf(
        'Repas à prix réduit par l’employeur (cantine ou bons, case G du certificat de salaire) : la moitié des montants',
      ),
    ),
    meals(
      code(412),
      '2.3',
      'Bei durchgehender, mindestens achtstündiger Schicht- / Nachtarbeit',
      p('Shift or night work of at least eight hours in a row'),
      pf('Travail en équipe ou de nuit d’au moins huit heures d’affilée'),
      OUT,
    ),
    other(
      code(416),
      '3.1',
      'Pauschalabzug',
      p(
        'Other professional costs, the flat amount: a fixed amount plus a share of the net salary, up to a maximum',
      ),
      pf(
        'Autres frais professionnels, forfait : un montant fixe plus une part du salaire net, au plus un maximum',
      ),
      { role: 'computed' },
    ),
    other(
      code(418),
      '3.2',
      'Anstelle des Pauschalabzuges: tatsächliche Berufskosten',
      p('Instead of the flat amount: your actual professional costs, listed'),
      pf('À la place du forfait : vos frais professionnels effectifs, détaillés'),
    ),
    week(
      code(426),
      '4.1',
      'Unterkunft: Ortsübliche Kosten für ein Zimmer',
      p('Weekly stay away from home: a room'),
      pf('Séjour hebdomadaire hors du domicile : une chambre'),
      { guide: '24' },
    ),
    week(
      code(428),
      '4.2',
      'Verpflegung',
      p('Weekly stay away from home: meals'),
      pf('Séjour hebdomadaire hors du domicile : repas'),
      { guide: '25' },
    ),
    side(
      code(432),
      '5.1',
      'Pauschalabzug',
      p('Side job, the flat amount: a share of its net income, between a minimum and a maximum'),
      pf(
        'Activité accessoire, forfait : une part de son revenu net, entre un minimum et un maximum',
      ),
      { role: 'computed' },
    ),
    side(
      code(434),
      '5.2',
      'Anstelle des Pauschalabzuges: tatsächliche Kosten',
      p('Side job: your actual costs instead of the flat amount'),
      pf('Activité accessoire : vos frais effectifs à la place du forfait'),
      OUT,
    ),
    f4('total', { role: 'total', guide: '23' })(
      code(438),
      '6.',
      'Total der Berufskosten',
      `Total professional costs of person ${n}, carried to page 3, 10.${n}`,
      `Total des frais professionnels de la personne ${n}, reporté en page 3, 10.${n}`,
    ),
  ];
}

// ---- Seite 2: Einkünfte im In- und Ausland ------------------------------------------------------

function page2(): FormRubric<SgPageId>[] {
  const s2 = (section: string, more: Options = {}) =>
    on('S2', `${FORM} p. 2`, section, { nature: 'income', columns: INCOME, ...more });
  const job = s2('unselbstaendig', { guide: '15' });
  const self = s2('selbstaendig', { ...OUT, guide: '15 to 18' });
  const social = s2('versicherungen');
  const securities = s2('vermoegen');
  const more = s2('weitere', { guide: '21' });
  const info = s2('ergaenzend', { ...OUT, nature: 'info', guide: '21' });
  return [
    job(
      '100',
      '1.1',
      'Aus Haupterwerbstätigkeit, Person 1',
      'Main job, net salary (salary certificate, box 11), person 1',
      'Activité principale, salaire net (certificat de salaire, chiffre 11), personne 1',
      A,
    ),
    job(
      '102',
      '1.1',
      'Aus Haupterwerbstätigkeit, Person 2',
      'Main job, net salary (salary certificate, box 11), person 2',
      'Activité principale, salaire net (certificat de salaire, chiffre 11), personne 2',
      B,
    ),
    job(
      '104',
      '1.2',
      'Aus Nebenerwerbstätigkeit, Person 1',
      'Side job, net salary (salary certificate), person 1',
      'Activité accessoire, salaire net (certificat de salaire), personne 1',
      A,
    ),
    job(
      '106',
      '1.2',
      'Aus Nebenerwerbstätigkeit, Person 2',
      'Side job, net salary (salary certificate), person 2',
      'Activité accessoire, salaire net (certificat de salaire), personne 2',
      B,
    ),
    job(
      '108',
      '1.3',
      'Sitzungsgelder, VR-Honorare usw., Person 1',
      'Attendance fees, board fees and the like, person 1',
      'Jetons de présence, honoraires d’administrateur et autres, personne 1',
      { ...A, ...OUT },
    ),
    job(
      '110',
      '1.3',
      'Sitzungsgelder, VR-Honorare usw., Person 2',
      'Attendance fees, board fees and the like, person 2',
      'Jetons de présence, honoraires d’administrateur et autres, personne 2',
      { ...B, ...OUT },
    ),
    self(
      '112',
      '2.1',
      'Einkünfte aus selbständiger Erwerbstätigkeit, Person 1',
      'Self-employment (trade, farming, liberal professions), person 1',
      'Activité indépendante (commerce, agriculture, professions libérales), personne 1',
      A,
    ),
    self(
      '114',
      '2.1',
      'Einkünfte aus selbständiger Erwerbstätigkeit, Person 2',
      'Self-employment (trade, farming, liberal professions), person 2',
      'Activité indépendante (commerce, agriculture, professions libérales), personne 2',
      B,
    ),
    self(
      '120',
      '2.2',
      'Aus Kollektiv-, Kommandit- und einfachen Gesellschaften, Person 1',
      'Partnerships, person 1',
      'Sociétés de personnes, personne 1',
      A,
    ),
    self(
      '122',
      '2.2',
      'Aus Kollektiv-, Kommandit- und einfachen Gesellschaften, Person 2',
      'Partnerships, person 2',
      'Sociétés de personnes, personne 2',
      B,
    ),
    social(
      '126',
      '3.1',
      'AHV/IV-Renten (zu 100%), Person 1',
      'AHV/IV pension, in full (attestation), person 1',
      'Rente AVS/AI, en entier (attestation), personne 1',
      { ...A, guide: '18' },
    ),
    social(
      '128',
      '3.1',
      'AHV/IV-Renten (zu 100%), Person 2',
      'AHV/IV pension, in full (attestation), person 2',
      'Rente AVS/AI, en entier (attestation), personne 2',
      { ...B, guide: '18' },
    ),
    social(
      '130',
      '3.2',
      'Renten/Pensionen, Person 1',
      'Pensions, the taxable amount (the full amount and the taxable percentage go in the pre-column), person 1',
      'Rentes et pensions, le montant imposable (le montant entier et le pourcentage imposable vont dans la colonne de gauche), personne 1',
      { ...A, guide: '18' },
    ),
    social(
      '132',
      '3.2',
      'Renten/Pensionen, Person 2',
      'Pensions, the taxable amount (the full amount and the taxable percentage go in the pre-column), person 2',
      'Rentes et pensions, le montant imposable (le montant entier et le pourcentage imposable vont dans la colonne de gauche), personne 2',
      { ...B, guide: '18' },
    ),
    social(
      '134',
      '3.3',
      'Erwerbsausfallentschädigung, Person 1',
      'Loss-of-earnings allowances not on a salary certificate (sickness, accident, IV, military service), person 1',
      'Allocations pour perte de gain hors certificat de salaire (maladie, accident, AI, service militaire), personne 1',
      { ...A, guide: '19' },
    ),
    social(
      '136',
      '3.3',
      'Erwerbsausfallentschädigung, Person 2',
      'Loss-of-earnings allowances not on a salary certificate (sickness, accident, IV, military service), person 2',
      'Allocations pour perte de gain hors certificat de salaire (maladie, accident, AI, service militaire), personne 2',
      { ...B, guide: '19' },
    ),
    social(
      '138',
      '3.4',
      'Arbeitslosen-Taggelder, Person 1',
      'Unemployment benefits not on a salary certificate (attestation of the fund), person 1',
      'Indemnités de chômage hors certificat de salaire (attestation de la caisse), personne 1',
      { ...A, guide: '19' },
    ),
    social(
      '140',
      '3.4',
      'Arbeitslosen-Taggelder, Person 2',
      'Unemployment benefits not on a salary certificate (attestation of the fund), person 2',
      'Indemnités de chômage hors certificat de salaire (attestation de la caisse), personne 2',
      { ...B, guide: '19' },
    ),
    social(
      '142',
      '3.5',
      'Von Ausgleichskassen direkt ausbezahlte Familienzulagen',
      'Family allowances paid directly by a compensation fund',
      'Allocations familiales versées directement par une caisse de compensation',
      { ...OUT, guide: '19' },
    ),
    securities(
      '146',
      '4.1',
      'aus Wertschriften und Guthaben',
      'Income from accounts and securities, carried from the securities list (Wertschriften- und Guthabenverzeichnis, Formular 2)',
      'Rendement des avoirs et des titres, reporté de l’état des titres (Wertschriften- und Guthabenverzeichnis, formulaire 2)',
      { role: 'report', guide: '19' },
    ),
    securities(
      '147',
      '4.2',
      'aus Beteiligungen an Gesellschaften ab 10 Prozent (Privatvermögen)',
      'Income from qualifying participations, private',
      'Rendement de participations qualifiées, fortune privée',
      { ...OUT, guide: '20' },
    ),
    securities(
      '149',
      '4.3',
      'aus Beteiligungen an Gesellschaften ab 10 Prozent (Geschäftsvermögen)',
      'Income from qualifying participations, business',
      'Rendement de participations qualifiées, fortune commerciale',
      { ...OUT, guide: '20' },
    ),
    securities(
      '150',
      '4.4',
      'Abzug Teilbesteuerung Beteiligungserträge',
      'Partial taxation of income from qualifying participations, the reduction',
      'Imposition partielle du rendement des participations qualifiées, la réduction',
      { ...OUT, guide: '20' },
    ),
    s2('liegenschaften', { ...OUT, guide: '20' })(
      '712',
      '5.',
      'Ertrag aus Liegenschaften',
      'Income from property (Formular 7)',
      'Rendement des immeubles (formulaire 7)',
    ),
    more(
      '154',
      '6.1',
      'Unterhaltsbeiträge für den/die Steuerpflichtige(n)',
      'Alimony received for yourself',
      'Pension alimentaire reçue pour vous-même',
    ),
    more(
      '156',
      '6.1',
      'Unterhaltsbeiträge für minderjährige Kinder',
      'Child support received for minor children',
      'Contributions d’entretien reçues pour des enfants mineurs',
    ),
    more(
      '158',
      '6.2',
      'Ertrag aus unverteilten Erbschaften',
      'Income from undivided inheritances',
      'Rendement de successions non partagées',
      OUT,
    ),
    more(
      '162',
      '6.3',
      'Übrige Einkünfte',
      'Other income (say what it is)',
      'Autres revenus (préciser)',
    ),
    more(
      '164',
      '6.4',
      'Kapitalabfindungen für wiederkehrende Leistungen',
      'Lump sums instead of recurring payments',
      'Prestations en capital à la place de prestations périodiques',
      OUT,
    ),
    s2('total', { role: 'total' })(
      '168',
      '7.',
      'Total der Einkünfte',
      'Total income',
      'Total des revenus',
    ),
    info(
      '290',
      '8.1',
      'Vereinfacht abgerechnete Einkünfte',
      'Salary settled by the simplified procedure (information only, not in the total)',
      'Salaire décompté selon la procédure simplifiée (information, hors total)',
    ),
    info(
      '291',
      '8.2',
      'Ergänzungsleistungen / Überbrückungsleistungen für ältere Arbeitslose',
      'Supplementary benefits (information only, not in the total)',
      'Prestations complémentaires (information, hors total)',
    ),
    info(
      '292',
      '8.3',
      'Hilflosenentschädigungen',
      'Helplessness allowances (information only, not in the total)',
      'Allocations pour impotent (information, hors total)',
    ),
  ];
}

// ---- Seite 3: Abzüge, Einkommensberechnung ------------------------------------------------------

function page3(): FormRubric<SgPageId>[] {
  const s3 = (section: string, more: Options = {}) => on('S3', `${FORM} p. 3`, section, more);
  const costs = s3('berufskosten', { role: 'report', guide: '23' });
  const upkeep = s3('unterhalt', { guide: '26' });
  const pension = s3('vorsorge', { guide: '26' });
  const further = s3('weitere');
  const net = s3('abzuege-netto');
  const social = s3('sozialabzuege', { role: 'computed', guide: '31' });
  const sum = (section: string) => s3(section, { role: 'total', nature: 'income' });
  return [
    costs(
      '438',
      '10.1',
      'Berufskosten bei unselbständiger Erwerbstätigkeit, Person 1',
      'Professional costs, person 1: the total of Form 4 (Berufskosten), carried from its 438',
      'Frais professionnels, personne 1 : le total du formulaire 4 (Berufskosten), reporté de son 438',
      A,
    ),
    costs(
      '488',
      '10.2',
      'Berufskosten bei unselbständiger Erwerbstätigkeit, Person 2',
      'Professional costs, person 2: the total of Form 4 (Berufskosten), carried from its 488',
      'Frais professionnels, personne 2 : le total du formulaire 4 (Berufskosten), reporté de son 488',
      B,
    ),
    s3('schuldzinsen', { guide: '25' })(
      '500',
      '11.',
      'Schuldzinsen',
      'Interest on private debts (Form 5, Schulden), at most the income from wealth plus a fixed amount',
      'Intérêts de dettes privées (formulaire 5, Schulden), au plus le rendement de la fortune plus un montant fixe',
    ),
    upkeep(
      '200',
      '12.1',
      'Unterhaltsbeiträge an Geschiedene oder Getrennte',
      'Alimony paid to a former or separated spouse',
      'Pension alimentaire versée à l’ex-conjoint ou au conjoint séparé',
    ),
    upkeep(
      '202',
      '12.2',
      'Unterhaltsbeiträge für minderjährige Kinder',
      'Child support paid for minor children',
      'Contributions d’entretien versées pour des enfants mineurs',
    ),
    upkeep(
      '204',
      '12.3',
      'Rentenleistungen',
      'Annuities and permanent charges you pay',
      'Rentes et charges durables que vous versez',
      OUT,
    ),
    pension(
      '208',
      '13.1',
      'Säule 3a, Person 1',
      'Pillar 3a, person 1 (attestation)',
      'Pilier 3a, personne 1 (attestation)',
      A,
    ),
    pension(
      '210',
      '13.1',
      'Säule 3a, Person 2',
      'Pillar 3a, person 2 (attestation)',
      'Pilier 3a, personne 2 (attestation)',
      B,
    ),
    pension(
      '218',
      '13.2',
      'Säule 2 (BVG) inkl. Einkaufsbeiträge, Person 1',
      'Pension fund buy-ins paid yourself, not on the salary certificate, person 1 (attestation)',
      'Rachats de caisse de pension payés vous-même, hors certificat de salaire, personne 1 (attestation)',
      A,
    ),
    pension(
      '219',
      '13.2',
      'Säule 2 (BVG) inkl. Einkaufsbeiträge, Person 2',
      'Pension fund buy-ins paid yourself, not on the salary certificate, person 2 (attestation)',
      'Rachats de caisse de pension payés vous-même, hors certificat de salaire, personne 2 (attestation)',
      B,
    ),
    s3('versicherung', { role: 'computed', guide: '27' })(
      '600',
      '14.',
      'Versicherungsprämien und Sparzinsen',
      'Insurance premiums and savings interest (Form 6: what you paid, at most the maximum)',
      'Primes d’assurance et intérêts d’épargne (formulaire 6 : ce que vous avez payé, au plus le maximum)',
    ),
    s3('liegenschaften', { ...OUT, guide: '27' })(
      '716',
      '15.',
      'Unterhalts- und Verwaltungskosten für Liegenschaften',
      'Upkeep and management costs of property (Formular 7)',
      'Frais d’entretien et de gestion des immeubles (formulaire 7)',
    ),
    further(
      '220',
      '16.1',
      'Verwaltungskosten für Wertschriften und sonstige Kapitalanlagen',
      'Costs of having securities and other investments managed',
      'Frais de gestion des titres et autres placements',
      { guide: '27 and 28' },
    ),
    further(
      '258',
      '16.2',
      'Kinderbetreuungskosten bei Drittbetreuung',
      'Childcare by others, per child under 14 (Form 10)',
      'Frais de garde des enfants par des tiers, par enfant de moins de 14 ans (formulaire 10)',
      { guide: '28' },
    ),
    further(
      '555',
      '16.3',
      'Parteispenden',
      'Payments to political parties (Form 5)',
      'Versements aux partis politiques (formulaire 5)',
      { guide: '28' },
    ),
    further(
      '223',
      '16.4',
      'Kosten berufsorientierte Aus-/Weiterbildung, Person 1',
      'Professional training paid yourself, person 1 (list)',
      'Formation et perfectionnement professionnels payés vous-même, personne 1 (liste)',
      { ...A, guide: '28 and 29' },
    ),
    further(
      '224',
      '16.4',
      'Kosten berufsorientierte Aus-/Weiterbildung, Person 2',
      'Professional training paid yourself, person 2 (list)',
      'Formation et perfectionnement professionnels payés vous-même, personne 2 (liste)',
      { ...B, guide: '28 and 29' },
    ),
    further('222', '16.5', 'Übrige Abzüge', 'Other deductions', 'Autres déductions', {
      ...OUT,
      guide: '29',
    }),
    s3('zweiverdiener', { role: 'computed', guide: '29' })(
      '226',
      '17.',
      'Zweiverdienerabzug',
      'Deduction when both spouses work',
      'Déduction lorsque les deux conjoints travaillent',
    ),
    s3('total', { role: 'total' })(
      '230',
      '18.',
      'Total der Abzüge',
      'Total deductions, 10 to 17',
      'Total des déductions, 10 à 17',
    ),
    sum('netto')(
      '234',
      '20.',
      'Nettoeinkommen (Ziffer 7 abzüglich Ziffer 18)',
      'Net income: total income (7) less total deductions (18)',
      'Revenu net : total des revenus (7) moins total des déductions (18)',
    ),
    net(
      '650',
      '21.1',
      'Krankheits- und Unfallkosten',
      'Illness and accident costs you bore (Form 6), in the pre-column',
      'Frais de maladie et d’accident à votre charge (formulaire 6), dans la colonne de gauche',
      { guide: '29' },
    ),
    net(
      '238',
      '21.1',
      'abzüglich Selbstbehalt des Nettoeinkommens (Ziffer 20)',
      'Less the excess, a share of the net income (20), in the pre-column',
      'Moins la franchise, une part du revenu net (20), dans la colonne de gauche',
      { role: 'computed', guide: '29' },
    ),
    net(
      '240',
      '21.1',
      'Abzug',
      'Illness and accident costs, the deduction: 650 less 238',
      'Frais de maladie et d’accident, la déduction : 650 moins 238',
      { role: 'total', guide: '29' },
    ),
    net(
      '235',
      '21.2',
      'Behinderungsbedingte Kosten (ohne Selbstbehalt)',
      'Costs due to a disability (Form 6)',
      'Frais liés à un handicap (formulaire 6)',
      { ...OUT, guide: '30' },
    ),
    net(
      '244',
      '21.3',
      'Freiwillige Zuwendungen',
      'Donations to tax-exempt Swiss organisations (Form 5), at most a share of the net income (20)',
      'Dons à des institutions suisses exonérées (formulaire 5), au plus une part du revenu net (20)',
      { guide: '30' },
    ),
    sum('rein')(
      '248',
      '22.',
      'Reineinkommen (Ziffer 20 abzüglich Ziffern 21.1 bis 21.3)',
      'Income after the deductions: 20 less 21.1 to 21.3',
      'Revenu après les déductions : 20 moins 21.1 à 21.3',
    ),
    social(
      '252',
      '23.1',
      'Kinderabzug für jedes noch nicht schulpflichtige Kind',
      'Child deduction, each child not yet of school age',
      'Déduction pour enfant, chaque enfant pas encore en âge scolaire',
    ),
    social(
      '254',
      '23.2',
      'Kinderabzug für jedes Kind in Schule oder Ausbildung',
      'Child deduction, each child in school or training',
      'Déduction pour enfant, chaque enfant à l’école ou en formation',
    ),
    social(
      '256',
      '23.3',
      'Ausbildungskosten für Kinder in Schule oder Ausbildung',
      'Education costs of children in school or training (Form 10)',
      'Frais de formation des enfants à l’école ou en formation (formulaire 10)',
    ),
    social(
      '264',
      '23.4',
      'Abzug für unterstützte Personen',
      'Deduction for people you support (federal tax only)',
      'Déduction pour personnes à charge (impôt fédéral seulement)',
      OUT,
    ),
    sum('steuerbar')(
      '268',
      '24.',
      'Steuerbares Einkommen gesamt (Ziffer 22 abzüglich Ziffern 23.1-23.3)',
      'Taxable income: 22 less the social deductions 23.1 to 23.3',
      'Revenu imposable : 22 moins les déductions sociales 23.1 à 23.3',
    ),
  ];
}

// ---- Seite 4: Vermögen im In- und Ausland -------------------------------------------------------

function page4(): FormRubric<SgPageId>[] {
  const s4 = (section: string, more: Options = {}) =>
    on('S4', `${FORM} p. 4`, section, { nature: 'wealth', columns: WEALTH, ...more });
  const movable = s4('beweglich');
  const business = s4('betrieb', { ...OUT, guide: '33 and 34' });
  const debts = s4('schulden', { guide: '34' });
  const free = s4('sozialabzuege', { role: 'computed', guide: '34' });
  return [
    movable(
      '300',
      '30.1',
      'Wertschriften und Guthaben',
      'Accounts and securities, carried from the securities list (Wertschriften- und Guthabenverzeichnis, Formular 2)',
      'Titres et avoirs, reportés de l’état des titres (Wertschriften- und Guthabenverzeichnis, formulaire 2)',
      { role: 'report', guide: '32' },
    ),
    movable(
      '302',
      '30.2',
      'Bargeld, Gold und andere Edelmetalle',
      'Cash, gold and other precious metals, at market value',
      'Numéraire, or et autres métaux précieux, à la valeur vénale',
      { guide: '32' },
    ),
    movable(
      '304',
      '30.3',
      'Lebens- und Rentenversicherungen',
      'Life and annuity insurance, surrender value (attestation)',
      'Assurances vie et de rente, valeur de rachat (attestation)',
      { guide: '32' },
    ),
    movable(
      '306',
      '30.4',
      'Motorfahrzeuge',
      'Vehicles, the purchase price less a share for each year since',
      'Véhicules, le prix d’achat moins une part par année depuis',
      { guide: '33' },
    ),
    movable(
      '308',
      '30.5',
      'Anteile an unverteilten Erbschaften',
      'Shares in undivided inheritances',
      'Parts de successions non partagées',
      { ...OUT, guide: '33' },
    ),
    movable(
      '310',
      '30.6',
      'Übrige Vermögenswerte',
      'Other assets (boats, horses, collections), without household contents',
      'Autres éléments de fortune (bateaux, chevaux, collections), sans le mobilier de ménage',
      { guide: '33' },
    ),
    s4('liegenschaften', { ...OUT, guide: '33' })(
      '710',
      '31.',
      'Liegenschaften',
      'Property (Formular 7)',
      'Immeubles (formulaire 7)',
    ),
    business(
      '314',
      '32.1',
      'Geschäftskapital in Kollektiv-, Kommandit- und einfachen Gesellschaften',
      'Capital in partnerships',
      'Capital dans des sociétés de personnes',
    ),
    business(
      '316',
      '32.2',
      'Aktiven gemäss Schlussbilanz',
      'Business assets, from the closing balance sheet',
      'Actifs commerciaux, selon le bilan de clôture',
    ),
    business(
      '318',
      '32.3',
      'Vermögen im landwirtschaftlichen Betrieb',
      'Farm assets',
      'Fortune de l’exploitation agricole',
    ),
    s4('total', { role: 'total' })(
      '322',
      '33.',
      'Total der Vermögenswerte',
      'Total assets',
      'Total des éléments de fortune',
    ),
    debts(
      '504',
      '34.1',
      'Privatschulden',
      'Private debts on 31 December (Form 5)',
      'Dettes privées au 31 décembre (formulaire 5)',
    ),
    debts(
      '506',
      '34.2',
      'Geschäftsschulden',
      'Business debts (Form 5)',
      'Dettes commerciales (formulaire 5)',
      OUT,
    ),
    s4('rein', { role: 'total' })(
      '326',
      '35.',
      'Reinvermögen (Ziffer 33 abzüglich 34)',
      'Net wealth: 33 less the debts 34',
      'Fortune nette : 33 moins les dettes 34',
    ),
    free(
      '330',
      '36.1',
      'Abzug für alleinstehende Steuerpflichtige',
      'Tax-free amount, single taxpayer',
      'Montant exonéré, personne seule',
    ),
    free(
      '332',
      '36.2',
      'Abzug für gemeinsam steuerpflichtige Ehegatten',
      'Tax-free amount, married couple',
      'Montant exonéré, couple marié',
    ),
    free(
      '334',
      '36.3',
      'Abzug für jedes minderjährige Kind',
      'Tax-free amount, each minor child',
      'Montant exonéré, chaque enfant mineur',
    ),
    s4('steuerbar', { role: 'total' })(
      '338',
      '37.',
      'Steuerbares Vermögen gesamt (Ziffer 35 abzüglich Ziffern 36.1 bis 36.3)',
      'Taxable wealth: 35 less the tax-free amounts 36.1 to 36.3',
      'Fortune imposable : 35 moins les montants exonérés 36.1 à 36.3',
    ),
    s4('kapital', { ...OUT, nature: 'info', guide: '35' })(
      '950',
      '41.',
      'Total Kapitalleistungen aus Vorsorge',
      'Capital benefits from pension schemes received in the year (information only, taxed apart)',
      'Prestations en capital de prévoyance reçues dans l’année (information, imposées à part)',
    ),
  ];
}

// ---- Pages -------------------------------------------------------------------------------------

const section = (id: string, title: string, en: string, fr: string) => ({
  id,
  title,
  gloss: g(en, fr),
});

function form4Page(n: 1 | 2, y: number): FormPage<SgPageId> {
  return {
    id: n === 1 ? 'F4-1' : 'F4-2',
    title: `Berufskosten Person ${n}, Formular 4 ${y}`,
    gloss: g(
      `Professional costs of person ${n} (Form 4, ${n === 1 ? 'front' : 'back'}): the total goes to page 3, 10.${n}`,
      `Frais professionnels de la personne ${n} (formulaire 4, ${n === 1 ? 'recto' : 'verso'}) : le total va en page 3, 10.${n}`,
    ),
    person: n === 1 ? 'A' : 'B',
    pdfPage: n,
    supported: true,
    sections: [
      section(
        'fahrkosten',
        '1. Fahrkosten zwischen Wohn- und Arbeitsstätte',
        'Travel to work',
        'Frais de déplacement',
      ),
      section('verpflegung', '2. Mehrkosten für Verpflegung', 'Meals', 'Repas'),
      section(
        'uebrige',
        '3. Übrige für die Berufsausübung erforderliche Kosten',
        'Other professional costs',
        'Autres frais professionnels',
      ),
      section(
        'wochenaufenthalt',
        '4. Mehrkosten bei auswärtigem Wochenaufenthalt',
        'Weekly stay away from home',
        'Séjour hebdomadaire hors du domicile',
      ),
      section(
        'nebenerwerb',
        '5. Kosten bei unselbständiger Nebenerwerbstätigkeit',
        'Side job',
        'Activité accessoire',
      ),
      section(
        'total',
        '6. Total der Berufskosten',
        'Total professional costs',
        'Total des frais professionnels',
      ),
    ],
    source: `${FORM4} p. ${n} (Formular 4, Berufskosten Person ${n})`,
  };
}

function pages(y: number): FormPage<SgPageId>[] {
  return [
    form4Page(1, y),
    form4Page(2, y),
    {
      id: 'S2',
      title: `Einkünfte im In- und Ausland ${y}`,
      gloss: g(
        'Income in Switzerland and abroad (Formular 1, page 2)',
        'Revenus en Suisse et à l’étranger (formulaire 1, page 2)',
      ),
      pdfPage: 2,
      supported: true,
      sections: [
        section(
          'unselbstaendig',
          '1. Einkünfte aus unselbständiger Erwerbstätigkeit',
          'Salaried work',
          'Activité salariée',
        ),
        section(
          'selbstaendig',
          '2. Einkünfte aus selbständiger Erwerbstätigkeit',
          'Self-employment',
          'Activité indépendante',
        ),
        section(
          'versicherungen',
          '3. Einkünfte aus Sozial- und anderen Versicherungen',
          'Pensions and insurance benefits',
          'Rentes et prestations d’assurances',
        ),
        section(
          'vermoegen',
          '4. Einkünfte aus beweglichem Vermögen',
          'Income from accounts and securities',
          'Rendement des avoirs et des titres',
        ),
        section(
          'liegenschaften',
          '5. Ertrag aus Liegenschaften',
          'Income from property',
          'Rendement des immeubles',
        ),
        section('weitere', '6. Weitere Einkünfte', 'Other income', 'Autres revenus'),
        section('total', '7. Total der Einkünfte', 'Total income', 'Total des revenus'),
        section(
          'ergaenzend',
          '8. Ergänzende Angaben',
          'Information only, not in the total',
          'Informations, hors du total',
        ),
      ],
      source: `${FORM} p. 2 (Formular 1, Seite 2)`,
    },
    {
      id: 'S3',
      title: `Abzüge ${y}`,
      gloss: g(
        'Deductions and the taxable income (Formular 1, page 3)',
        'Déductions et revenu imposable (formulaire 1, page 3)',
      ),
      pdfPage: 3,
      supported: true,
      sections: [
        section(
          'berufskosten',
          '10. Berufskosten bei unselbständiger Erwerbstätigkeit',
          'Professional costs',
          'Frais professionnels',
        ),
        section('schuldzinsen', '11. Schuldzinsen', 'Debt interest', 'Intérêts passifs'),
        section(
          'unterhalt',
          '12. Unterhaltsbeiträge und Rentenleistungen',
          'Alimony and annuities paid',
          'Pensions et rentes versées',
        ),
        section('vorsorge', '13. Vorsorgebeiträge', 'Pension contributions', 'Prévoyance'),
        section(
          'versicherung',
          '14. Versicherungsprämien und Sparzinsen',
          'Insurance premiums and savings interest',
          'Primes d’assurance et intérêts d’épargne',
        ),
        section(
          'liegenschaften',
          '15. Unterhalts- und Verwaltungskosten für Liegenschaften',
          'Property costs',
          'Frais immobiliers',
        ),
        section('weitere', '16. Weitere Abzüge', 'Other deductions', 'Autres déductions'),
        section('zweiverdiener', '17. Zweiverdienerabzug', 'Both spouses work', 'Double activité'),
        section('total', '18. Total der Abzüge', 'Total deductions', 'Total des déductions'),
        section('netto', '20. Nettoeinkommen', 'Net income', 'Revenu net'),
        section(
          'abzuege-netto',
          '21. Abzüge vom Nettoeinkommen',
          'Illness costs and donations',
          'Frais de maladie et dons',
        ),
        section(
          'rein',
          '22. Reineinkommen',
          'Income after the deductions',
          'Revenu après les déductions',
        ),
        section(
          'sozialabzuege',
          `23. Sozialabzüge, Stichtag 31. Dezember ${y} bzw. Ende der Steuerpflicht`,
          'Social deductions',
          'Déductions sociales',
        ),
        section(
          'steuerbar',
          '24. Steuerbares Einkommen gesamt',
          'Taxable income',
          'Revenu imposable',
        ),
      ],
      source: `${FORM} p. 3 (Formular 1, Seite 3)`,
    },
    {
      id: 'S4',
      title: `Vermögen im In- und Ausland, Steuerwert am 31. Dezember ${y}`,
      gloss: g(
        'Wealth on 31 December (Formular 1, page 4)',
        'Fortune au 31 décembre (formulaire 1, page 4)',
      ),
      pdfPage: 4,
      supported: true,
      sections: [
        section('beweglich', '30. Bewegliches Vermögen', 'Movable wealth', 'Fortune mobilière'),
        section('liegenschaften', '31. Liegenschaften', 'Property', 'Immeubles'),
        section(
          'betrieb',
          '32. Betriebsvermögen aus selbständiger Erwerbstätigkeit',
          'Business assets',
          'Fortune commerciale',
        ),
        section(
          'total',
          '33. Total der Vermögenswerte',
          'Total assets',
          'Total des éléments de fortune',
        ),
        section('schulden', '34. Schulden', 'Debts', 'Dettes'),
        section('rein', '35. Reinvermögen', 'Net wealth', 'Fortune nette'),
        section('sozialabzuege', '36. Sozialabzüge', 'Tax-free amounts', 'Montants exonérés'),
        section(
          'steuerbar',
          '37. Steuerbares Vermögen gesamt',
          'Taxable wealth',
          'Fortune imposable',
        ),
        section(
          'kapital',
          '40. Kapitalleistungen aus Vorsorge',
          'Capital benefits, information only',
          'Prestations en capital, information',
        ),
      ],
      source: `${FORM} p. 4 (Formular 1, Seite 4)`,
    },
  ];
}

const rubrics = (): FormRubric<SgPageId>[] => [
  ...form4(1),
  ...form4(2),
  ...page2(),
  ...page3(),
  ...page4(),
];

/** Shown with tax year 2026: its codes come from the 2025 return. */
export const SG_FORM_NOTE: Text = {
  en: 'The codes and German terms come from St. Gallen’s 2025 return, Formular 1 and Form 4 (sg-2025-form-steuererklaerung, sg-2025-form-berufskosten): no 2026 return is published yet, so check each line on the form you get in 2027.',
  fr: 'Les codes et les termes allemands viennent de la déclaration 2025 de Saint-Gall, formulaire 1 et formulaire 4 (sg-2025-form-steuererklaerung, sg-2025-form-berufskosten)\u00a0: aucune déclaration 2026 n’est encore publiée, vérifiez donc chaque ligne sur celle que vous recevrez en 2027.',
  de: 'Die Ziffern und Begriffe stammen aus der St. Galler Steuererklärung 2025, Formular 1 und Formular 4 (sg-2025-form-steuererklaerung, sg-2025-form-berufskosten): Eine Steuererklärung 2026 ist noch nicht veröffentlicht, prüfe also jede Zeile auf dem Formular, das du 2027 erhältst.',
};

export const FORM_SG_2025: FormMap<SgPageId> = {
  taxYear: 2025,
  formYear: 2025,
  provisional: false,
  pages: pages(2025),
  rubrics: rubrics(),
};

/** Tax year 2026: the 2025 forms, until the 2026 return is published; flagged provisional. */
export const FORM_SG_2026: FormMap<SgPageId> = {
  taxYear: 2026,
  formYear: 2025,
  provisional: true,
  note: SG_FORM_NOTE,
  pages: pages(2026),
  rubrics: rubrics(),
};

export function stGallenFormMap(taxYear: number): FormMap<SgPageId> {
  if (taxYear === 2025) return FORM_SG_2025;
  if (taxYear === 2026) return FORM_SG_2026;
  throw new Error(`No St. Gallen form map for ${taxYear}.`);
}
