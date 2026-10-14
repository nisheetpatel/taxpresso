// From the ledger to the household input (SPEC.md section 7: "Inputs: the current ledger view"),
// the part every canton shares (docs/design/cantons.md, section 1): the answers to the shared
// questions and the values of the documents every canton asks for. Pure: facts and documents in,
// the household input out, with every value's facts and status carried along, so the result flags
// what is an estimate and what still needs the user's OK. Values the user confirmed (stated) or
// that came from a barcode (verified) count as such; extracted values are used but flagged "Needs
// your OK"; estimates are flagged "Estimate". Each canton reads its own answers (the commune and
// what only it asks) and its form's wealth, and words what it can't take on its own lines.
import type { Fact, FactStatus, FactValue, Owner, VaultDocument } from '@taxpresso/ledger';
import type {
  Amount,
  ChildInput,
  EmploymentInput,
  EnginePerson,
  HouseholdAmounts,
  HouseholdInput,
  InputStatus,
  PersonInput,
  Text,
} from './types.js';

const NB = ' ';
const t = (en: string, fr: string): Text => ({ en, fr });

/** What a canton's reading of the ledger gives. */
export interface HouseholdReading {
  /** The household without the canton's own part (`cantonal`), or null when answers are missing. */
  input: Omit<HouseholdInput, 'cantonal'> | null;
  /** What must be answered before anything can be computed. */
  missing: Text[];
  /** How the ledger was read: what was left out or assumed. */
  notes: Text[];
}

export interface CantonReading {
  /** Whether the canton has official values for the tax year. */
  isTaxYear(taxYear: number): boolean;
  /** The commune of the answer, as the canton's engine takes it; undefined when not one of its own. */
  commune(answer: FactValue | undefined, taxYear: number): string | number | undefined;
  /** The canton's lines for alimony and child support, received and paid, for the note on them. */
  alimonyLines: { received: Text; paid: Text };
  /**
   * Unemployment benefits on their own line (Zurich, 140/141) rather than with the other benefits
   * replacing a salary (Geneva, 11.50).
   */
  unemploymentApart?: boolean;
}

const statusOf = (s: FactStatus): InputStatus => (s === 'computed' ? 'verified' : s);

/** The least sure of several statuses: extracted, then estimate, then stated, then verified. */
function worst(statuses: InputStatus[]): InputStatus {
  for (const s of ['extracted', 'estimate', 'stated'] as const) if (statuses.includes(s)) return s;
  return 'verified';
}

/** Salary certificate boxes 1 to 7, whose sum is box 8 (ge-2025-declaration-specimen p. 5). */
const BOXES_1_TO_7 = [
  'salary.base',
  'salary.board_lodging',
  'salary.company_car',
  'salary.other_fringe',
  'salary.non_periodic',
  'salary.capital',
  'salary.participations',
  'salary.board_fees',
  'salary.other_benefits',
] as const;

/** The sum of the money facts, with their least sure status and their ids. */
export function amountOf(facts: readonly Fact[]): Amount | undefined {
  const money = facts.filter((f) => typeof f.value === 'number');
  if (!money.length) return undefined;
  return {
    value: money.reduce((s, f) => s + (f.value as number), 0),
    status: worst(money.map((f) => statusOf(f.status))),
    facts: money.map((f) => f.id),
  };
}

/** The ledger facts that count for the tax year: values from documents of another year are left out. */
export function factsOfYear(
  taxYear: number,
  facts: readonly Fact[],
  documents: readonly VaultDocument[],
  note: (x: Text) => void,
): Fact[] {
  const otherYear = new Set(
    documents.filter((d) => d.taxYear !== undefined && d.taxYear !== taxYear).map((d) => d.id),
  );
  return facts.filter((f) => {
    if (f.source.docId && otherYear.has(f.source.docId)) {
      note(
        t(
          'Values from documents of another tax year are left out.',
          `Les montants de documents d’une autre année fiscale sont laissés de côté.`,
        ),
      );
      return false;
    }
    return true;
  });
}

export function householdFromFacts(
  taxYear: number,
  facts: readonly Fact[],
  documents: readonly VaultDocument[],
  canton: CantonReading,
): HouseholdReading {
  const missing: Text[] = [];
  const notes: Text[] = [];
  const note = (x: Text) => notes.some((n) => n.en === x.en) || notes.push(x);
  if (!canton.isTaxYear(taxYear)) {
    return {
      input: null,
      missing: [
        t(
          `Tax year ${taxYear} is not supported.`,
          `L’année fiscale ${taxYear} n’est pas prise en charge.`,
        ),
      ],
      notes,
    };
  }

  const counted = factsOfYear(taxYear, facts, documents, note);
  const answer = (key: string) =>
    counted.find((f) => f.key === key && f.person === 'household')?.value;
  const of = (key: string, person?: Owner) =>
    counted.filter((f) => f.key === key && (person === undefined || f.person === person));

  const status = answer('profile.civil_status');
  const commune = canton.commune(answer('profile.commune'), taxYear);
  if (status === undefined) missing.push(t('your civil status', 'votre état civil'));
  if (commune === undefined) {
    missing.push(t('your commune on 31 December', 'votre commune au 31 décembre'));
  }
  if (missing.length || commune === undefined) return { input: null, missing, notes };

  const couple = status === 'married' || status === 'registered_partnership';
  const civilStatus: HouseholdInput['civilStatus'] = couple
    ? 'married'
    : (status as 'single' | 'separated' | 'divorced' | 'widowed');
  const ids: EnginePerson[] = couple ? ['p1', 'p2'] : ['p1'];

  // Children.
  const count = Number(answer('profile.children_count') ?? 0);
  const custody = answer('profile.children_custody');
  const children: ChildInput[] = [];
  if (count > 0 && custody === 'elsewhere') {
    note(
      t(
        'Your children live elsewhere: they are not counted as family charges here.',
        `Vos enfants vivent ailleurs${NB}: ils ne sont pas comptés comme charges de famille ici.`,
      ),
    );
  } else {
    for (let i = 0; i < count; i++)
      children.push({ custody: custody === 'shared' ? 'shared' : 'full' });
  }
  // Shared custody without a partner: child support, and without it who earns more, decide who
  // gets the parental scale and the child deductions (ch-na-circulaire-30-epoux-famille p. 24).
  const support =
    count > 0 && custody === 'shared' && !couple ? answer('profile.child_support') : undefined;
  const sharing: Pick<HouseholdInput, 'childSupport' | 'ifdParentalScale'> =
    support === 'i_receive'
      ? { childSupport: 'receives' }
      : support === 'i_pay'
        ? { childSupport: 'pays' }
        : support === 'none_i_earn_more'
          ? { childSupport: 'none', ifdParentalScale: true }
          : support === 'none_other_earns_more'
            ? { childSupport: 'none', ifdParentalScale: false }
            : support === 'none_unsure'
              ? { childSupport: 'none' }
              : {};
  // Alimony and child support amounts have no key yet: they are not in the calculation.
  const paysAlimony = answer('profile.payments');
  const receivesAlimony = counted.some(
    (f) =>
      f.key === 'profile.income_sources' && Array.isArray(f.value) && f.value.includes('alimony'),
  );
  if (
    support === 'i_receive' ||
    support === 'i_pay' ||
    receivesAlimony ||
    (Array.isArray(paysAlimony) && paysAlimony.includes('alimony_paid'))
  ) {
    const { received, paid } = canton.alimonyLines;
    note(
      t(
        `Alimony and child support (contribution d’entretien): Taxpresso can’t take their amounts yet, so they are not in the calculation (received: income, ${received.en}; paid: deduction, ${paid.en}).`,
        `Pensions et contributions d’entretien${NB}: Taxpresso ne peut pas encore en reprendre les montants, ils ne sont donc pas dans le calcul (reçues${NB}: revenu, ${received.fr}${NB}; versées${NB}: déduction, ${paid.fr}).`,
      ),
    );
  }

  const people: PersonInput[] = ids.map((id) => {
    // One employment per salary certificate (the instance is the document id): any certificate
    // with its total (box 8) or one of the boxes it adds up.
    const certs = new Set(
      [...of('salary.gross', id), ...BOXES_1_TO_7.flatMap((k) => of(k, id))].map(
        (f) => f.instance ?? f.id,
      ),
    );
    const box = (key: string, doc: string) =>
      amountOf(of(key, id).filter((f) => (f.instance ?? f.id) === doc));
    const tick = (key: string, doc: string) =>
      of(key, id).some((f) => (f.instance ?? f.id) === doc && f.value === true);
    const employments: EmploymentInput[] = [...certs].map((doc) => {
      let gross = box('salary.gross', doc);
      if (!gross) {
        // Box 8 not read: it is the sum of boxes 1 to 7 (ge-2025-declaration-specimen p. 5).
        gross = amountOf(
          BOXES_1_TO_7.flatMap((k) => of(k, id).filter((f) => (f.instance ?? f.id) === doc)),
        )!;
        note(
          t(
            'A salary certificate’s total (box 8) isn’t read: Taxpresso adds up boxes 1 to 7, as box 8 does. Check the total on the certificate.',
            `Le total d’un certificat de salaire (chiffre 8) n’est pas lu${NB}: Taxpresso additionne les chiffres 1 à 7, comme le chiffre 8. Vérifiez le total sur le certificat.`,
          ),
        );
      }
      const e: EmploymentInput = { id: doc, gross };
      const social = box('salary.social_contributions', doc);
      const lpp = box('salary.lpp_ordinary', doc);
      const buy = box('salary.lpp_buyin', doc);
      if (social) e.socialContributions = social;
      if (lpp) e.pensionFund = lpp;
      if (buy) e.pensionBuyIn = buy;
      if (tick('salary.canteen', doc)) e.canteen = true;
      if (tick('salary.free_transport', doc)) e.freeTransport = true;
      return e;
    });
    // Before the salary certificate is in: the user's rough figure, as an estimate.
    if (!employments.length) {
      const plan = of('plan.gross_salary', id).filter(
        (f) => typeof f.value === 'number' && f.value > 0,
      );
      const gross = amountOf(plan);
      if (gross) {
        employments.push({ gross: { ...gross, status: 'estimate' } });
        note(
          t(
            'No salary certificate yet: your rough salary is used as an estimate, without social or pension fund contributions, so the tax shown is higher than it will be.',
            `Pas encore de certificat de salaire${NB}: votre salaire approximatif est utilisé comme estimation, sans cotisations sociales ni 2e pilier, l’impôt affiché est donc plus élevé qu’il ne sera.`,
          ),
        );
      }
    }
    const p: PersonInput = { id, employments };

    // Benefits not already paid with the salary (replacement.paid_to_employer).
    const viaEmployer = new Set(
      of('replacement.paid_to_employer', id)
        .filter((f) => f.value === true)
        .map((f) => f.instance),
    );
    const benefits = of('replacement.amount', id).filter((f) => !viaEmployer.has(f.instance));
    if (canton.unemploymentApart) {
      // Unemployment benefits paid directly have their own line; the other benefits theirs.
      const unemployment = new Set(
        of('replacement.type', id)
          .filter((f) => f.value === 'unemployment')
          .map((f) => f.instance),
      );
      const fromFund = amountOf(benefits.filter((f) => unemployment.has(f.instance)));
      const other = amountOf(benefits.filter((f) => !unemployment.has(f.instance)));
      if (fromFund) p.unemploymentBenefits = fromFund;
      if (other) p.replacementIncome = other;
    } else {
      const replacement = amountOf(benefits);
      if (replacement) p.replacementIncome = replacement;
    }

    // Pensions by type.
    const typeOf = (doc: string | undefined) =>
      of('pension.type', id).find((f) => f.instance === doc)?.value;
    const pensions = of('pension.amount', id);
    const byType = (ty: string) => amountOf(pensions.filter((f) => typeOf(f.instance) === ty));
    const avs = byType('avs_ai');
    const occupational = byType('occupational');
    const other = amountOf(
      pensions.filter((f) => !['avs_ai', 'occupational'].includes(String(typeOf(f.instance)))),
    );
    if (pensions.some((f) => typeOf(f.instance) === undefined)) {
      note(
        t(
          'A pension of unknown kind is counted as an other pension (autres rentes).',
          `Une rente de type inconnu est comptée parmi les autres rentes.`,
        ),
      );
    }
    if (avs) p.pensionAvs = avs;
    if (occupational) p.pensionOccupational = occupational;
    if (other) p.pensionOther = other;

    // The way to work and lunches away from home: the answers, read only along the questions that
    // apply to them (an amount left from an earlier answer doesn't count).
    const one = (key: string) => of(key, id)[0];
    const way = one('profile.commute');
    const by = way?.value;
    const usable = one('commute.transit_usable');
    if (by === 'public_transport' || by === 'public_transport_long') {
      p.commuteMode = { by: 'public_transport', facts: [way!.id] };
      const paid = amountOf(of('commute.transit_cost', id));
      if (paid) p.commuteCost = paid;
    } else if (by === 'car' || by === 'motorbike') {
      const facts = [way!.id, ...(usable ? [usable.id] : [])];
      if (usable?.value === 'yes' || usable?.value === 'yes_long') {
        p.commuteMode = { by, transitUsable: true, facts };
        const price = amountOf(of('commute.transit_equivalent', id));
        if (price) p.commuteCost = price;
      } else if (usable?.value === 'no') {
        const km = one('commute.distance_km');
        const days = one('commute.drive_days');
        p.commuteMode = {
          by,
          transitUsable: false,
          ...(typeof km?.value === 'number' ? { kmOneWay: km.value } : {}),
          ...(typeof days?.value === 'number' ? { days: days.value } : {}),
          status: worst([km, days].flatMap((f) => (f ? [statusOf(f.status)] : []))),
          facts: [...facts, ...[km, days].flatMap((f) => (f ? [f.id] : []))],
        };
      } else {
        p.commuteMode = { by, facts };
      }
    } else if (by === 'bike' || by === 'walk') {
      p.commuteMode = { by, facts: [way!.id] };
    } else if (by === 'mostly_home') {
      p.commuteMode = { by: 'home', facts: [way!.id] };
    }
    const mealDays = one('meals.days');
    if (by !== undefined && by !== 'mostly_home' && typeof mealDays?.value === 'number') {
      p.mealDays = mealDays.value;
      p.mealFacts = [mealDays.id];
      // Geneva counts meals only when the trip by public transport takes over 2 hours a day
      // (ge-2025-guide-declaration-pp p. 19); the other cantons leave this aside.
      p.mealsIccAllowed =
        by === 'public_transport_long' ||
        ((by === 'car' || by === 'motorbike') && usable?.value === 'yes_long');
    }

    const pillar3a = amountOf(of('pillar3a.paid', id));
    if (pillar3a) p.pillar3a = pillar3a;
    const buyIn = amountOf(of('lpp.buyin', id));
    if (buyIn) p.pensionBuyIn = buyIn;
    const fund = of('plan.has_pension_fund', id)[0]?.value;
    if (typeof fund === 'boolean') p.hasPensionFund = fund;
    return p;
  });

  const hh: HouseholdAmounts = {};
  const put = (key: string, field: keyof HouseholdAmounts) => {
    const a = amountOf(of(key, 'household'));
    if (a) hh[field] = a;
  };
  put('health.premiums', 'healthPremiums');
  put('health.subsidy', 'healthSubsidy');
  put('medical.costs', 'medicalCosts');
  put('childcare.costs', 'childcare');
  put('donation.amount', 'donations');

  return {
    input: {
      taxYear,
      commune,
      civilStatus,
      people,
      children,
      ...sharing,
      household: hh,
    },
    missing,
    notes,
  };
}
