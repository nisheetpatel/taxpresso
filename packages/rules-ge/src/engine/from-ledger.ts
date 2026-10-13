// From the ledger to the engine (SPEC.md section 7: "Inputs: the current ledger view"). Pure:
// facts and documents in, engine input out, with every value's facts and status carried along, so
// the result flags what is an estimate and what still needs the user's OK. Values the user
// confirmed (stated) or that came from a barcode (verified) count as such; extracted values are
// used but flagged "Needs your OK"; estimates are flagged "Estimate".
import type { Fact, FactStatus, Owner, VaultDocument } from '@taxpresso/ledger';
import type { CommuneSlug } from '../2026/communes.js';
import { COMMUNES_2026 } from '../2026/communes.js';
import { isTaxYear } from './params.js';
import type {
  Amount,
  ChildInput,
  EmploymentInput,
  EngineInput,
  EnginePerson,
  InputStatus,
  MovableAsset,
  PersonInput,
  Text,
} from './types.js';

const NB = '\u00a0';
const t = (en: string, fr: string): Text => ({ en, fr });

export interface LedgerInput {
  input: EngineInput | null;
  /** What must be answered before anything can be computed. */
  missing: Text[];
  /** How the ledger was read: what was left out or assumed. */
  notes: Text[];
}

const statusOf = (s: FactStatus): InputStatus => (s === 'computed' ? 'verified' : s);

/** The least sure of several statuses: extracted, then estimate, then stated, then verified. */
function worst(statuses: InputStatus[]): InputStatus {
  for (const s of ['extracted', 'estimate', 'stated'] as const) if (statuses.includes(s)) return s;
  return 'verified';
}

function amountOf(facts: readonly Fact[]): Amount | undefined {
  const money = facts.filter((f) => typeof f.value === 'number');
  if (!money.length) return undefined;
  return {
    value: money.reduce((s, f) => s + (f.value as number), 0),
    status: worst(money.map((f) => statusOf(f.status))),
    facts: money.map((f) => f.id),
  };
}

export function engineInputFromFacts(
  taxYear: number,
  facts: readonly Fact[],
  documents: readonly VaultDocument[],
): LedgerInput {
  const missing: Text[] = [];
  const notes: Text[] = [];
  const note = (x: Text) => notes.some((n) => n.en === x.en) || notes.push(x);
  if (!isTaxYear(taxYear)) {
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

  // Values from documents of another tax year don't count for this one.
  const otherYear = new Set(
    documents.filter((d) => d.taxYear !== undefined && d.taxYear !== taxYear).map((d) => d.id),
  );
  const docById = new Map(documents.map((d) => [d.id, d]));
  const counted = facts.filter((f) => {
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
  const answer = (key: string) =>
    counted.find((f) => f.key === key && f.person === 'household')?.value;
  const of = (key: string, person?: Owner) =>
    counted.filter((f) => f.key === key && (person === undefined || f.person === person));

  const status = answer('profile.civil_status');
  const commune = answer('profile.commune');
  if (status === undefined) missing.push(t('your civil status', 'votre état civil'));
  if (typeof commune !== 'string' || !COMMUNES_2026.some((c) => c.slug === commune)) {
    missing.push(t('your commune on 31 December', 'votre commune au 31 décembre'));
  }
  if (missing.length) return { input: null, missing, notes };

  const couple = status === 'married' || status === 'registered_partnership';
  const civilStatus: EngineInput['civilStatus'] = couple
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

  const people: PersonInput[] = ids.map((id) => {
    // One employment per salary certificate (the instance is the document id).
    const certs = new Set(of('salary.gross', id).map((f) => f.instance ?? f.id));
    const box = (key: string, doc: string) =>
      amountOf(of(key, id).filter((f) => (f.instance ?? f.id) === doc));
    const tick = (key: string, doc: string) =>
      of(key, id).some((f) => (f.instance ?? f.id) === doc && f.value === true);
    const employments: EmploymentInput[] = [...certs].map((doc) => {
      const e: EmploymentInput = { id: doc, gross: box('salary.gross', doc)! };
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
    const replacement = amountOf(
      of('replacement.amount', id).filter((f) => !viaEmployer.has(f.instance)),
    );
    if (replacement) p.replacementIncome = replacement;

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

    const pillar3a = amountOf(of('pillar3a.paid', id));
    if (pillar3a) p.pillar3a = pillar3a;
    const buyIn = amountOf(of('lpp.buyin', id));
    if (buyIn) p.pensionBuyIn = buyIn;
    const fund = of('plan.has_pension_fund', id)[0]?.value;
    if (typeof fund === 'boolean') p.hasPensionFund = fund;
    return p;
  });

  const hh: NonNullable<EngineInput['household']> = {};
  const put = (key: string, field: keyof typeof hh) => {
    const a = amountOf(of(key, 'household'));
    if (a) hh[field] = a;
  };
  put('health.premiums', 'healthPremiums');
  put('health.subsidy', 'healthSubsidy');
  put('medical.costs', 'medicalCosts');
  put('childcare.costs', 'childcare');
  put('donation.amount', 'donations');
  put('debt.interest', 'debtInterest');
  put('debt.balance', 'debts');

  // Securities list (état des titres): one line per security; whose it is comes from its document.
  const movable: MovableAsset[] = [];
  const securities = new Set(
    counted.filter((f) => f.key.startsWith('securities.')).map((f) => f.instance),
  );
  for (const sec of securities) {
    const line = (key: string) => counted.find((f) => f.key === key && f.instance === sec);
    const value = line('securities.value_chf');
    const income = line('securities.income_gross_chf');
    const withheld = line('securities.withholding_swiss_chf');
    const doc = [value, income, withheld].find((f) => f?.source.docId)?.source.docId;
    const owner = doc ? docById.get(doc)?.person : undefined;
    const asset: MovableAsset = { owner: owner ?? 'household' };
    const a = (f: Fact | undefined) => (f ? amountOf([f]) : undefined);
    if (a(value)) asset.value = a(value)!;
    if (a(income)) asset.income = a(income)!;
    if (a(withheld)) asset.withholdingSwiss = a(withheld)!;
    if (asset.value || asset.income) movable.push(asset);
  }

  return {
    input: {
      taxYear,
      commune: commune as CommuneSlug,
      civilStatus,
      people,
      children,
      household: hh,
      movable,
    },
    missing,
    notes,
  };
}
