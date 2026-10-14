// Tax at source (impôt à la source) as facts, never asked: who is taxed at source (derived by the
// questionnaire from the permit and the income, data/ch/2026/questions.yaml), the barème the
// employer takes it at (derived from the household, packages/rules-ge source-tax/tariff.ts; a
// barème read from a payslip wins), and the tax withheld for the year, from the documents first
// (salary certificate box 12, the benefits attestation), else estimated from the official tables
// and flagged, else what Taxpresso still needs, in plain words. Geneva only: in another canton
// taxation at source is not supported yet (its questionnaire says so).
//
// The same facts feed the TOU comparison (./planning.ts), get_status, list_optimizations and the
// dashboard. Everything is derived on every read, never stored.
import type { Fact, FactValue } from '@taxpresso/ledger';
import type { Text } from '@taxpresso/rules-ch';
import {
  deriveTariffs,
  type DerivedTariff,
  SOURCE_TAX_FACTS,
  SOURCE_TAX_SOURCES,
  SOURCE_TAX_SUBJECT,
  sourceTax,
  SourceTaxError,
  type TariffAssumption,
  type TariffOpen,
} from '@taxpresso/rules-ge';
import { say, type UiLang } from './lang.js';
import type { Workspace } from './workspace.js';

type Who = 'p1' | 'p2';

/** What the documents of this year say for one person, summed over the documents. */
interface FromDocs {
  centimes: number;
  /** Some value still needs the user's OK (status "extracted"). */
  unconfirmed: boolean;
  documents: number;
}

/** The tax withheld at source for one person, and where the figure comes from. */
export interface Withheld {
  centimes: number;
  /** certificate: documents (salary certificate box 12, benefits attestation). stated: a figure
   * from an official statement. tariff: estimated with the barème on the gross salary. */
  from: 'certificate' | 'stated' | 'tariff';
  /** The barème the estimate used. */
  tariff?: string;
  /** An estimate, flagged wherever it shows. */
  estimate: boolean;
  sources: string[];
}

/** Why the tax withheld isn't known, in the order the user can fix it. */
export type WithheldMissing =
  /** No salary certificate with box 12, and no gross salary to estimate from. */
  | 'salary'
  /** The barème can't be worked out (TariffOpen), and no payslip shows it. */
  | 'tariff'
  /** Above the official tables. */
  | 'beyond_tables'
  /** Benefits paid by the insurance: only its attestation gives the tax (no table for barème G). */
  | 'benefits'
  /** A pension taxed at source (a partial disability pension): only its statement gives the tax. */
  | 'pension';

export interface SourceTaxPerson {
  person: Who;
  /** Taxed at source; undefined while the answers it follows from are missing. */
  atSource?: boolean;
  /** derived: the law settles it from the answers. answered: the user said, where it doesn't. */
  how: 'derived' | 'answered' | 'unknown';
  because?: Text;
  source?: string;
  incomeSources?: readonly string[];
  /** The barème worked out from the household (only for people taxed at source). */
  derivedTariff?: DerivedTariff;
  /** A barème read from a payslip (plan.source_tax_tariff), which wins. */
  documentTariff?: string;
  /** The barème that counts: the payslip's, else the one worked out. */
  tariff?: string;
  /** Gross salary for the year: certificates (box 8), or the user's rough figure. */
  salaryGross?: { centimes: number; from: 'certificate' | 'stated' };
  /** Benefits not paid through the employer, from the attestations. */
  benefits?: { centimes: number; sourceTax?: number; attestations: number };
  /** Has benefits and at least one benefits attestation (through the employer or not). */
  benefitsDocumented: boolean;
  /** The gross taxed at source for the year (salary and benefits), when every part is known. */
  grossCentimes?: number;
  /** The part of it known so far. */
  grossAtLeastCentimes: number;
  withheld?: Withheld;
  missing: WithheldMissing[];
  /** Some figure still needs the user's OK. */
  unconfirmed: boolean;
  /**
   * Not taxed at source for the year, yet tax was taken at source (box 12): a C permit, Swiss
   * citizenship or a marriage during the year makes the whole year ordinary, and that tax counts
   * towards it (ge-na-law-risp art. 10).
   */
  creditedCentimes?: number;
}

export interface SourceTax {
  taxYear: number;
  couple: boolean;
  people: SourceTaxPerson[];
  /** Someone in the household is taxed at source. */
  any: boolean;
  /** Someone not taxed at source had tax taken at source all the same (creditedCentimes). */
  credited: boolean;
  /** Arrived from abroad in the year: the CHF 120,000 counts the salary over a whole year. */
  partYear: boolean;
}

/** A value read from this year's documents, summed per person. */
function fromDocuments(
  ws: Workspace,
  key: string,
  person: Who,
  keep: (f: Fact) => boolean = () => true,
): FromDocs | undefined {
  const otherYear = new Set(
    ws
      .activeDocuments()
      .filter((d) => d.taxYear !== undefined && d.taxYear !== ws.engine.taxYear)
      .map((d) => d.id),
  );
  const facts = ws
    .countedFacts()
    .filter(
      (f) =>
        f.key === key &&
        f.person === person &&
        f.source.docId !== undefined &&
        !otherYear.has(f.source.docId) &&
        typeof f.value === 'number' &&
        keep(f),
    );
  if (!facts.length) return undefined;
  return {
    centimes: facts.reduce((sum, f) => sum + (f.value as number), 0),
    unconfirmed: facts.some((f) => f.status === 'extracted'),
    documents: new Set(facts.map((f) => f.source.docId)).size,
  };
}

/** A user's figure for the year: 0 means "cleared". */
function planMoney(ws: Workspace, key: string, person: Who): number | undefined {
  const v = ws.ledger.get(key, person)?.value;
  return typeof v === 'number' && v > 0 ? v : undefined;
}

const SALARY_LIKE = ['salary', 'replacement_income', 'pension'];

/**
 * The source-tax facts of the household, or undefined outside Geneva (taxation at source is not
 * supported in the other cantons yet) and where no one has a salary, benefits or a pension.
 */
export function sourceTaxOf(ws: Workspace): SourceTax | undefined {
  const canton = ws.canton().canton;
  if (!canton?.tou) return undefined;
  const snap = ws.snapshot();
  const people = snap.people.filter((p): p is Who => p === 'p1' || p === 'p2');
  const answer = (key: string, owner: string): FactValue | undefined =>
    snap.answers.get(`${key}|${owner}`);
  const sourcesOf = (p: Who) => {
    const v = answer('profile.income_sources', p);
    return Array.isArray(v) ? v : undefined;
  };
  if (!people.some((p) => sourcesOf(p)?.some((s) => SALARY_LIKE.includes(s)))) return undefined;
  const taxYear = ws.engine.taxYear;
  const couple = people.length > 1;
  const children = answer('profile.children_count', 'household');
  const custody = answer('profile.children_custody', 'household');
  const together = answer('profile.lives_with_other_parent', 'household');

  const base = people.map((person) => {
    const id = `taxed_at_source:${person}`;
    const derived = snap.derived.find((s) => s.id === id)?.derived;
    const value = answer('profile.taxed_at_source', person);
    const sources = sourcesOf(person);
    // No salary, benefits or pension: nothing is taxed at source (LISP art. 2 al. 2), whatever
    // the permit; the spouse of someone taxed at source still counts for the barème and TOU.
    const nothing = sources !== undefined && !sources.some((s) => SALARY_LIKE.includes(s));
    return {
      person,
      ...(typeof value === 'boolean' ? { atSource: value } : nothing ? { atSource: false } : {}),
      how:
        derived || nothing
          ? ('derived' as const)
          : typeof value === 'boolean'
            ? ('answered' as const)
            : ('unknown' as const),
      ...(derived ? { because: derived.because, source: derived.source } : {}),
      ...(nothing && !derived
        ? { source: SOURCE_TAX_SUBJECT[taxYear as 2025 | 2026]?.benefits }
        : {}),
      ...(sources ? { incomeSources: sources } : {}),
    };
  });
  let tariffs: DerivedTariff[] = [];
  try {
    tariffs = deriveTariffs({
      taxYear,
      couple,
      ...(typeof children === 'number' ? { children } : {}),
      ...(custody === 'with_household' || custody === 'shared' || custody === 'elsewhere'
        ? { custody }
        : {}),
      ...(typeof together === 'boolean' ? { livesWithOtherParent: together } : {}),
      people: base.map((p) => ({
        person: p.person,
        atSource: p.atSource === true,
        ...(p.incomeSources ? { incomeSources: p.incomeSources } : {}),
      })),
    });
  } catch {
    // A year without directives: no barème rather than another year's.
  }
  const partYear = answer('profile.moved', 'household') === 'from_abroad';

  const out: SourceTaxPerson[] = base.map((p) => {
    const sources = p.incomeSources ?? [];
    const derivedTariff = tariffs.find((t) => t.person === p.person);
    const documentTariff = ws.ledger.get('plan.source_tax_tariff', p.person)?.value;
    const docTariff = typeof documentTariff === 'string' ? documentTariff : undefined;
    const tariff = docTariff ?? derivedTariff?.code;
    const certGross = fromDocuments(ws, 'salary.gross', p.person);
    const statedGross = planMoney(ws, 'plan.gross_salary', p.person);
    const salaryGross = certGross
      ? { centimes: certGross.centimes, from: 'certificate' as const }
      : statedGross !== undefined
        ? { centimes: statedGross, from: 'stated' as const }
        : undefined;
    // Benefits paid through the employer are in the salary already (and its box 12).
    const viaEmployer = new Set(
      ws
        .countedFacts()
        .filter(
          (f) =>
            f.key === 'replacement.paid_to_employer' &&
            f.person === p.person &&
            f.value === true &&
            f.instance !== undefined,
        )
        .map((f) => f.instance),
    );
    const direct = (f: Fact) => !viaEmployer.has(f.instance);
    const anyBenefits = fromDocuments(ws, 'replacement.amount', p.person);
    const benefitAmount = fromDocuments(ws, 'replacement.amount', p.person, direct);
    const benefitTax = fromDocuments(ws, 'replacement.source_tax', p.person, direct);
    const hasSalary = sources.includes('salary');
    const hasBenefits = sources.includes('replacement_income');
    const hasPension = sources.includes('pension');
    const certTax = fromDocuments(ws, 'salary.source_tax', p.person);
    const unconfirmed = Boolean(
      certGross?.unconfirmed ||
      certTax?.unconfirmed ||
      benefitAmount?.unconfirmed ||
      benefitTax?.unconfirmed,
    );

    // The gross taxed at source: salary and the benefits paid by the insurance itself.
    const salaryKnown = !hasSalary || salaryGross !== undefined;
    // Benefits documented only as paid through the employer are in the salary already.
    const benefitsKnown = !hasBenefits || anyBenefits !== undefined;
    const atLeast = (salaryGross?.centimes ?? 0) + (benefitAmount?.centimes ?? 0);
    const person: SourceTaxPerson = {
      ...p,
      ...(derivedTariff ? { derivedTariff } : {}),
      ...(docTariff ? { documentTariff: docTariff } : {}),
      ...(tariff ? { tariff } : {}),
      ...(salaryGross ? { salaryGross } : {}),
      ...(benefitAmount
        ? {
            benefits: {
              centimes: benefitAmount.centimes,
              ...(benefitTax ? { sourceTax: benefitTax.centimes } : {}),
              attestations: benefitAmount.documents,
            },
          }
        : {}),
      benefitsDocumented: hasBenefits && anyBenefits !== undefined,
      ...(salaryKnown && benefitsKnown && !partYear ? { grossCentimes: atLeast } : {}),
      grossAtLeastCentimes: atLeast,
      missing: [],
      unconfirmed,
    };
    if (p.atSource !== true) {
      if (p.atSource === false && certTax && certTax.centimes > 0) {
        person.creditedCentimes = certTax.centimes;
      }
      return person;
    }

    // The tax withheld: documents first, then a figure from an official statement, then the
    // official tables on the gross salary (an estimate). Benefits paid by the insurance have no
    // table (barème G): only their attestation gives that tax.
    const benefitsTax = !hasBenefits
      ? 0
      : !anyBenefits
        ? undefined
        : !benefitAmount
          ? 0 // every attestation says the employer paid them: in the salary and its box 12
          : benefitTax && benefitTax.documents >= benefitAmount.documents
            ? benefitTax.centimes
            : undefined;
    const year = SOURCE_TAX_SOURCES[taxYear as 2025 | 2026];
    const docSources = ['std-lohnausweis-wegleitung-2026-fr p. 15 (Cm 48)'];
    if (hasBenefits) docSources.push(SOURCE_TAX_FACTS.benefitsTaxedByInsurer);
    const stated = planMoney(ws, 'plan.source_tax_withheld', p.person);
    if ((!hasSalary || certTax) && benefitsTax !== undefined && !hasPension) {
      person.withheld = {
        centimes: (certTax?.centimes ?? 0) + benefitsTax,
        from: 'certificate',
        estimate: false,
        sources: docSources,
      };
      return person;
    }
    if (stated !== undefined) {
      person.withheld = { centimes: stated, from: 'stated', estimate: false, sources: [] };
      return person;
    }
    let salaryPart: number | undefined = certTax?.centimes ?? (hasSalary ? undefined : 0);
    let estimatedWith: string | undefined;
    if (salaryPart === undefined) {
      if (!salaryGross) person.missing.push('salary');
      else if (!tariff) person.missing.push('tariff');
      else {
        try {
          const t = sourceTax(taxYear, tariff, salaryGross.centimes, 'year');
          salaryPart = t.taxCentimes;
          estimatedWith = t.tariff;
        } catch (err) {
          if (!(err instanceof SourceTaxError)) throw err;
          person.missing.push('beyond_tables');
        }
      }
    }
    if (benefitsTax === undefined) person.missing.push('benefits');
    // A pension taxed at source has no table here and no box: its statement gives the tax.
    if (hasPension) person.missing.push('pension');
    if (salaryPart !== undefined && benefitsTax !== undefined && !hasPension) {
      person.withheld = {
        centimes: salaryPart + benefitsTax,
        from: estimatedWith ? 'tariff' : 'certificate',
        ...(estimatedWith ? { tariff: estimatedWith } : {}),
        estimate: estimatedWith !== undefined,
        sources: estimatedWith
          ? [year?.tables ?? '', year?.readable ?? '', year?.annualModel ?? ''].filter(Boolean)
          : docSources,
      };
    }
    return person;
  });
  return {
    taxYear,
    couple,
    people: out,
    any: out.some((p) => p.atSource === true),
    credited: out.some((p) => p.creditedCentimes !== undefined),
    partYear,
  };
}

// ---- Words -----------------------------------------------------------------------------------

const T = (en: string, fr: string, de: string, it: string): Text => ({ en, fr, de, it });

const WHO_IS: Record<Who, { yes: Text; no: Text; open: Text }> = {
  p1: {
    yes: T(
      'You are taxed at source',
      'Vous êtes imposé à la source',
      'Du wirst an der Quelle besteuert',
      'Paghi l’imposta alla fonte',
    ),
    no: T(
      'You are not taxed at source',
      'Vous n’êtes pas imposé à la source',
      'Du wirst nicht an der Quelle besteuert',
      'Non paghi l’imposta alla fonte',
    ),
    open: T(
      'Whether you are taxed at source isn’t known yet',
      'On ne sait pas encore si vous êtes imposé à la source',
      'Ob du an der Quelle besteuert wirst, ist noch offen',
      'Non si sa ancora se paghi l’imposta alla fonte',
    ),
  },
  p2: {
    yes: T(
      'Your spouse or partner is taxed at source',
      'Votre conjoint ou partenaire est imposé à la source',
      'Dein Partner oder deine Partnerin wird an der Quelle besteuert',
      'Il tuo coniuge o partner paga l’imposta alla fonte',
    ),
    no: T(
      'Your spouse or partner is not taxed at source',
      'Votre conjoint ou partenaire n’est pas imposé à la source',
      'Dein Partner oder deine Partnerin wird nicht an der Quelle besteuert',
      'Il tuo coniuge o partner non paga l’imposta alla fonte',
    ),
    open: T(
      'Whether your spouse or partner is taxed at source isn’t known yet',
      'On ne sait pas encore si votre conjoint ou partenaire est imposé à la source',
      'Ob dein Partner oder deine Partnerin an der Quelle besteuert wird, ist noch offen',
      'Non si sa ancora se il tuo coniuge o partner paga l’imposta alla fonte',
    ),
  },
};

const ANSWERED = T(
  'That is what you said.',
  'C’est votre réponse.',
  'Das hast du so angegeben.',
  'È quanto hai indicato.',
);
const NO_SALARY = T(
  'There is no salary or benefits to tax at source.',
  'Il n’y a ni salaire ni indemnités à imposer à la source.',
  'Es gibt keinen Lohn und keine Taggelder, die an der Quelle besteuert würden.',
  'Non ci sono né salario né indennità da tassare alla fonte.',
);

const WHY: Record<string, Text> = {
  single: T(
    'single, no child in the household',
    'personne seule, sans enfant dans le ménage',
    'alleinstehend, ohne Kind im Haushalt',
    'persona sola, senza figli nell’economia domestica',
  ),
  shared_custody: T(
    'single, the children in alternating custody',
    'personne seule, enfants en garde alternée',
    'alleinstehend, Kinder in alternierender Obhut',
    'persona sola, figli in custodia alternata',
  ),
  cohabiting_parents: T(
    'living with the children’s other parent, unmarried',
    'en couple avec l’autre parent des enfants, sans être mariés',
    'unverheiratet mit dem anderen Elternteil der Kinder zusammenlebend',
    'in coppia con l’altro genitore dei figli, senza essere sposati',
  ),
  single_parent: T(
    'single parent, the children living with you',
    'famille monoparentale, les enfants vivant avec vous',
    'alleinerziehend, die Kinder leben bei dir',
    'famiglia monoparentale, i figli vivono con te',
  ),
  spouse_no_income: T(
    'married, your spouse without income',
    'marié, votre conjoint sans revenu',
    'verheiratet, dein Partner oder deine Partnerin ohne Einkommen',
    'sposato, il tuo coniuge senza reddito',
  ),
  spouse_income: T(
    'married, both of you with income (salary or benefits)',
    'marié, vous avez tous deux un revenu (salaire ou indemnités)',
    'verheiratet, ihr habt beide ein Einkommen (Lohn oder Taggelder)',
    'sposati, avete entrambi un reddito (salario o indennità)',
  ),
};

const OPEN: Record<TariffOpen, Text> = {
  answers_missing: T(
    'Taxpresso needs your answers about your income, your children and your household first',
    'Taxpresso a d’abord besoin de vos réponses sur vos revenus, vos enfants et votre ménage',
    'Taxpresso braucht zuerst deine Antworten zu Einkommen, Kindern und Haushalt',
    'Taxpresso ha prima bisogno delle tue risposte su redditi, figli ed economia domestica',
  ),
  spouse_pension: T(
    'your spouse’s only income is a pension: a partial disability pension counts as income for the barème, an old-age pension doesn’t',
    'le seul revenu de votre conjoint est une rente : une rente AI partielle compte comme revenu pour le barème, une rente AVS non',
    'das einzige Einkommen deines Partners oder deiner Partnerin ist eine Rente: Eine IV-Teilrente zählt für den Tarif als Einkommen, eine AHV-Rente nicht',
    'l’unico reddito del tuo coniuge è una rendita: una rendita AI parziale conta come reddito per la tariffa, una rendita AVS no',
  ),
  couple_shared_custody: T(
    'the directives give no barème for a couple whose children live in alternating custody',
    'les directives ne donnent pas de barème pour un couple dont les enfants sont en garde alternée',
    'die Weisungen nennen keinen Tarif für ein Paar, dessen Kinder in alternierender Obhut leben',
    'le direttive non danno una tariffa per una coppia con figli in custodia alternata',
  ),
};

const ASSUME: Record<TariffAssumption, Text> = {
  children_under_25: T(
    'it counts each child as under 25 and supported by you; a child of 25 or more who studies counts only through a correction or TOU',
    'chaque enfant y compte comme ayant moins de 25 ans et à votre charge ; un enfant de 25 ans ou plus en formation ne compte que par une rectification ou une TOU',
    'jedes Kind zählt darin als unter 25 und von dir unterhalten; ein Kind ab 25 in Ausbildung zählt nur über eine Berichtigung oder die TOU',
    'ogni figlio vi conta come minore di 25 anni e a tuo carico; un figlio di 25 anni o più in formazione conta solo con una rettifica o la TOU',
  ),
  five_children_most: T(
    'the barème counts 5 children at most',
    'le barème compte 5 enfants au plus',
    'der Tarif zählt höchstens 5 Kinder',
    'la tariffa conta al massimo 5 figli',
  ),
};

const MISSING: Record<WithheldMissing, Text> = {
  salary: T(
    'your salary certificate shows it (box 12); without it, your gross salary for the year lets Taxpresso estimate it',
    'votre certificat de salaire l’indique (chiffre 12) ; sans lui, votre salaire brut de l’année permet à Taxpresso de l’estimer',
    'dein Lohnausweis zeigt sie (Ziffer 12); ohne ihn kann Taxpresso sie aus deinem Bruttolohn des Jahres schätzen',
    'il tuo certificato di salario la indica (cifra 12); senza, Taxpresso la stima dal tuo salario lordo dell’anno',
  ),
  tariff: T(
    'your salary certificate shows it (box 12); Taxpresso can’t estimate it without the barème, which a payslip shows',
    'votre certificat de salaire l’indique (chiffre 12) ; sans le barème, qui figure sur une fiche de salaire, Taxpresso ne peut pas l’estimer',
    'dein Lohnausweis zeigt sie (Ziffer 12); ohne den Tarif, der auf einer Lohnabrechnung steht, kann Taxpresso sie nicht schätzen',
    'il tuo certificato di salario la indica (cifra 12); senza la tariffa, che figura su una busta paga, Taxpresso non può stimarla',
  ),
  beyond_tables: T(
    'your salary certificate shows it (box 12); the official tables stop below your salary',
    'votre certificat de salaire l’indique (chiffre 12) ; les barèmes officiels s’arrêtent en dessous de votre salaire',
    'dein Lohnausweis zeigt sie (Ziffer 12); die offiziellen Tarife enden unter deinem Lohn',
    'il tuo certificato di salario la indica (cifra 12); le tariffe ufficiali si fermano sotto il tuo salario',
  ),
  pension: T(
    'the statement of the pension fund or the AI shows the tax taken at source from your pension',
    'l’attestation de la caisse de pension ou de l’AI indique l’impôt retenu à la source sur votre rente',
    'die Bescheinigung der Pensionskasse oder der IV zeigt die von deiner Rente abgezogene Quellensteuer',
    'l’attestazione della cassa pensione o dell’AI indica l’imposta trattenuta alla fonte sulla tua rendita',
  ),
  benefits: T(
    'the attestation of the fund that paid your benefits (unemployment, sickness, accident, maternity) shows the tax it took at source',
    'l’attestation de la caisse qui vous a versé les indemnités (chômage, maladie, accident, maternité) indique l’impôt retenu à la source',
    'die Bescheinigung der Kasse, die dir die Taggelder bezahlt hat (Arbeitslosigkeit, Krankheit, Unfall, Mutterschaft), zeigt die abgezogene Quellensteuer',
    'l’attestazione della cassa che ti ha versato le indennità (disoccupazione, malattia, infortunio, maternità) indica l’imposta trattenuta alla fonte',
  ),
};

const FROM: Record<Withheld['from'], Text> = {
  certificate: T(
    'from your documents',
    'selon vos documents',
    'aus deinen Unterlagen',
    'dai tuoi documenti',
  ),
  stated: T(
    'from your statement',
    'selon votre attestation',
    'aus deiner Bescheinigung',
    'dalla tua attestazione',
  ),
  tariff: T(
    'estimated with barème {tariff} on the gross salary',
    'estimé avec le barème {tariff} sur le salaire brut',
    'geschätzt mit Tarif {tariff} auf dem Bruttolohn',
    'stimata con la tariffa {tariff} sul salario lordo',
  ),
};

const chf = (centimes: number, lang: UiLang) =>
  `CHF ${new Intl.NumberFormat({ en: 'en-US', fr: 'fr-CH', de: 'de-CH', it: 'it-CH' }[lang], {
    maximumFractionDigits: 0,
  }).format(Math.round(centimes / 100))}`;
const colon = (lang: UiLang) => (lang === 'fr' ? ' : ' : ': ');

/** One fact in plain words, with where it comes from; an estimate is flagged. */
export interface SourceTaxLine {
  person?: Who;
  text: string;
  source?: string;
  estimate?: true;
}

/** Words used in the lines below, by language. */
const W = {
  bareme: T('Barème', 'Barème', 'Tarif', 'Tariffa'),
  fromPayslip: T(
    'from a payslip',
    'selon une fiche de salaire',
    'laut einer Lohnabrechnung',
    'secondo una busta paga',
  ),
  wins: T(
    'it wins over the one Taxpresso works out,',
    'il l’emporte sur celui que Taxpresso déduit,',
    'er geht dem von Taxpresso abgeleiteten vor,',
    'prevale su quella che Taxpresso deduce,',
  ),
  cantWork: T(
    'Taxpresso can’t work out the barème',
    'Taxpresso ne peut pas déduire le barème',
    'Taxpresso kann den Tarif nicht ableiten',
    'Taxpresso non può dedurre la tariffa',
  ),
  payslipShows: T(
    'A payslip shows it.',
    'Une fiche de salaire l’indique.',
    'Eine Lohnabrechnung zeigt ihn.',
    'Una busta paga la indica.',
  ),
  taken: T(
    'Tax taken at source for {year}',
    'Impôt retenu à la source pour {year}',
    'An der Quelle abgezogene Steuer {year}',
    'Imposta trattenuta alla fonte per il {year}',
  ),
  about: T('about', 'environ', 'etwa', 'circa'),
  credited: T(
    'Tax taken at source in {year} all the same, salary certificate box 12',
    'Impôt retenu à la source en {year} tout de même, certificat de salaire chiffre 12',
    'Trotzdem {year} an der Quelle abgezogene Steuer, Lohnausweis Ziffer 12',
    'Imposta trattenuta comunque alla fonte nel {year}, certificato di salario cifra 12',
  ),
  creditedWhy: T(
    'The whole year is taxed ordinarily (a C permit, Swiss citizenship or a marriage during the year, for example), and this tax counts towards it.',
    'Toute l’année est taxée de façon ordinaire (un permis C, la nationalité suisse ou un mariage en cours d’année, par exemple), et cet impôt est imputé.',
    'Das ganze Jahr wird ordentlich veranlagt (zum Beispiel wegen eines Ausweises C, des Schweizer Bürgerrechts oder einer Heirat im Lauf des Jahres), und diese Steuer wird angerechnet.',
    'Tutto l’anno è tassato in via ordinaria (per esempio con un permesso C, la cittadinanza svizzera o un matrimonio durante l’anno), e questa imposta viene computata.',
  ),
  notKnown: T('not known yet.', 'pas encore connu.', 'noch nicht bekannt.', 'non ancora nota.'),
};

const sep = (lang: UiLang) => (lang === 'fr' ? ' ; ' : '; ');
const capital = (s: string) => (s ? s[0]!.toUpperCase() + s.slice(1) : s);

/** The facts in plain words, in the page's language (and English for Claude). */
export function sourceTaxLines(st: SourceTax, lang: UiLang): SourceTaxLine[] {
  const lines: SourceTaxLine[] = [];
  const w = (t: Text) => say(t, lang);
  const subject = SOURCE_TAX_SUBJECT[st.taxYear as 2025 | 2026];
  for (const p of st.people) {
    const who = WHO_IS[p.person];
    if (p.atSource === undefined) {
      if (p.incomeSources?.some((s) => SALARY_LIKE.includes(s))) {
        lines.push({ person: p.person, text: `${w(who.open)}.` });
      }
      continue;
    }
    const why = p.because ? w(p.because) : p.how === 'answered' ? w(ANSWERED) : w(NO_SALARY);
    const reason = p.source ?? (p.atSource ? subject?.who : undefined);
    lines.push({
      person: p.person,
      text: `${w(p.atSource ? who.yes : who.no)}. ${why}`,
      ...(reason ? { source: reason } : {}),
    });
    if (!p.atSource) {
      if (p.creditedCentimes !== undefined) {
        lines.push({
          person: p.person,
          text: `${w(W.credited).replace('{year}', String(st.taxYear))}${colon(lang)}${chf(p.creditedCentimes, lang)}. ${w(W.creditedWhy)}`,
          ...(subject ? { source: subject.toOrdinary } : {}),
        });
      }
      continue;
    }
    const t = p.derivedTariff;
    if (p.documentTariff) {
      const differs = t?.code !== undefined && t.code !== p.documentTariff;
      lines.push({
        person: p.person,
        text: `${w(W.bareme)} ${p.documentTariff}, ${w(W.fromPayslip)}${differs ? `${sep(lang)}${w(W.wins)} ${t.code}` : ''}.`,
        ...(t?.sources.length ? { source: t.sources.join('; ') } : {}),
      });
    } else if (t?.code && t.why) {
      const assume = t.assumptions.map((a) => w(ASSUME[a])).join(sep(lang));
      lines.push({
        person: p.person,
        text: `${w(W.bareme)} ${t.code}${colon(lang)}${w(WHY[t.why]!)}${assume ? `${sep(lang)}${assume}` : ''}.`,
        source: t.sources.join('; '),
      });
    } else if (t?.open) {
      lines.push({
        person: p.person,
        text: `${w(W.cantWork)}${colon(lang)}${w(OPEN[t.open])}. ${w(W.payslipShows)}`,
        ...(t.sources.length ? { source: t.sources.join('; ') } : {}),
      });
    }
    const taken = w(W.taken).replace('{year}', String(st.taxYear));
    const held = p.withheld;
    if (held) {
      const from = w(FROM[held.from]).replace('{tariff}', held.tariff ?? '');
      lines.push({
        person: p.person,
        text: `${taken}${colon(lang)}${held.estimate ? `${w(W.about)} ` : ''}${chf(held.centimes, lang)}, ${from}.`,
        ...(held.sources.length ? { source: held.sources.join('; ') } : {}),
        ...(held.estimate ? { estimate: true as const } : {}),
      });
    } else if (p.missing.length) {
      lines.push({
        person: p.person,
        text: `${taken}${colon(lang)}${w(W.notKnown)} ${capital(p.missing.map((m) => w(MISSING[m])).join(sep(lang)))}.`,
        ...(p.missing.includes('benefits')
          ? { source: SOURCE_TAX_FACTS.benefitsTaxedByInsurer }
          : {}),
      });
    }
  }
  return lines;
}
