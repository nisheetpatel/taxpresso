// From the ledger to Geneva's engine (SPEC.md section 7: "Inputs: the current ledger view"). The
// part every canton shares is packages/rules-ch's (core/from-ledger.ts); Geneva gives it its commune
// (a slug of its list), the lines of its form for the alimony note, and adds its own: the securities
// list and the other movable wealth by rubric (the état des titres, ../2026/etat-des-titres.ts), and
// self-employment, the simple case (annexe B, ./business.ts).
import type { Fact, Owner, VaultDocument } from '@taxpresso/ledger';
import {
  amountOf,
  factsOfYear,
  householdFromFacts,
  type BusinessInput,
  type CantonReading,
} from '@taxpresso/rules-ch';
import type { CommuneSlug } from '../2026/communes.js';
import { COMMUNES_2026 } from '../2026/communes.js';
import { etatDesTitres } from '../2026/etat-des-titres.js';
import { isTaxYear } from './params.js';
import type { EngineInput, PersonInput, Text, WealthItemInput } from './types.js';

export interface LedgerInput {
  input: EngineInput | null;
  /** What must be answered before anything can be computed. */
  missing: Text[];
  /** How the ledger was read: what was left out or assumed. */
  notes: Text[];
}

/** How Geneva reads the shared answers: its communes by slug, its form's lines. */
export const GENEVA_READING: CantonReading = {
  isTaxYear,
  commune: (answer) =>
    typeof answer === 'string' && COMMUNES_2026.some((c) => c.slug === answer) ? answer : undefined,
  alimonyLines: { received: { en: '13.10', fr: '13.10' }, paid: { en: '53.10', fr: '53.10' } },
};

const t = (en: string, fr: string): Text => ({ en, fr });
const NB = ' ';

/** The values of the business's accounts and AVS statements, by the field of the engine input. */
const BUSINESS_VALUES: Readonly<Record<string, keyof BusinessInput>> = {
  'business.turnover': 'turnover',
  'business.benefits': 'benefits',
  'business.financial_income': 'financialIncome',
  'business.other_income': 'otherIncome',
  'business.costs_goods': 'costsGoods',
  'business.costs_staff': 'costsStaff',
  'business.depreciation': 'depreciation',
  'business.provisions': 'provisions',
  'business.interest': 'interest',
  'business.costs_other': 'costsOther',
  'business.current_assets': 'currentAssets',
  'business.fixed_assets': 'fixedAssets',
  'business.liabilities': 'liabilities',
  'avs.contributions_year': 'avsYear',
  'avs.contributions_earlier': 'avsEarlier',
};

/** Why an answer puts a business outside the simple case Taxpresso prepares (SPEC.md section 1). */
const UNSUPPORTED: Readonly<Record<string, Readonly<Record<string, Text>>>> = {
  'profile.business_form': {
    partnership: t('a partnership (société de personnes)', 'une société de personnes'),
  },
  'profile.business_year': {
    no_closing: t(
      'a first business year that closes next year',
      'un premier exercice clôturé l’année suivante',
    ),
    two_closings: t(
      'two business years closing in the same year',
      'deux exercices clôturés la même année',
    ),
    stopped: t(
      'stopping a business (cessation, liquidation gains)',
      'la cessation d’une activité (bénéfice de liquidation)',
    ),
  },
  'profile.business_place': {
    other_commune: t(
      'a business in another commune than your home (répartition intercommunale)',
      'une activité dans une autre commune que celle du domicile (répartition intercommunale)',
    ),
    outside_geneva: t('a business outside Geneva', 'une activité hors du canton de Genève'),
  },
  'profile.business_special': {
    real_estate: t('business real estate', 'un immeuble commercial'),
    vat: t('VAT (TVA)', 'la TVA'),
    transfer: t(
      'a transfer between business and private wealth',
      'un transfert entre fortune commerciale et fortune privée',
    ),
    reserves: t(
      'capital gains and hidden reserves (réserves latentes)',
      'des bénéfices en capital et des réserves latentes',
    ),
    method_change: t('a change of accounting method', 'un changement de méthode comptable'),
    own_pension: t(
      'a pension fund of the self-employed (32.12, 32.30)',
      'la prévoyance professionnelle de l’exploitant (32.12, 32.30)',
    ),
    spouse_works: t('a spouse working in the business', 'un conjoint qui collabore à l’activité'),
    private_costs: t(
      'private shares and withdrawals in the accounts',
      'des parts privées et prélèvements dans les comptes',
    ),
    avs_provision: t(
      'an AVS provision or refund (12.13, 12.14)',
      'une provision ou un remboursement AVS (12.13, 12.14)',
    ),
    participations: t(
      'qualified participations, patent box or research deductions (12.18, 12.28, 12.29)',
      'des participations qualifiées, la patent box ou la déduction de recherche (12.18, 12.28, 12.29)',
    ),
    several: t('more than one business', 'plusieurs activités indépendantes'),
  },
};

const WHO: Record<'p1' | 'p2', Text> = {
  p1: t('you', 'vous'),
  p2: t('your spouse or partner', 'votre conjoint ou partenaire'),
};

/**
 * Self-employment of each person who said so (profile.income_sources), read from their answers and
 * the values of their business's documents. Answers still open are `missing`; an answer outside the
 * simple case is `unsupported`, and then no tax is computed (fail closed).
 */
function selfEmployment(
  people: readonly PersonInput[],
  facts: readonly Fact[],
): { people: PersonInput[]; missing: Text[]; unsupported: Text[] } {
  const missing: Text[] = [];
  const unsupported: Text[] = [];
  const couple = people.length > 1;
  const answer = (key: string, person: Owner) =>
    facts.find((f) => f.key === key && f.person === person && f.status !== 'extracted')?.value;
  const out = people.map((p) => {
    const sources = answer('profile.income_sources', p.id);
    if (!Array.isArray(sources) || !sources.includes('self_employment')) return p;
    const who = couple ? WHO[p.id] : undefined;
    const whose = (x: Text) => (who ? t(`${x.en} (${who.en})`, `${x.fr} (${who.fr})`) : x);
    const reasons: Text[] = [];
    let open = false;
    for (const key of [
      'profile.business_form',
      'profile.business_year',
      'profile.business_place',
      'profile.business_special',
    ]) {
      const v = answer(key, p.id);
      if (v === undefined) open = true;
      for (const value of Array.isArray(v) ? v : [v]) {
        const why = UNSUPPORTED[key]?.[String(value)];
        if (why) reasons.push(why);
      }
    }
    if (answer('profile.taxed_at_source', p.id) === true) {
      reasons.push(
        t(
          'self-employment of a person taxed at source',
          'l’activité indépendante d’une personne imposée à la source',
        ),
      );
    }
    const losses = answer('profile.business_losses', p.id);
    if (losses === undefined) open = true;
    const lossIcc =
      losses === true
        ? amountOf(facts.filter((f) => f.key === 'business.losses_icc' && f.person === p.id))
        : undefined;
    const lossIfd =
      losses === true
        ? amountOf(facts.filter((f) => f.key === 'business.losses_ifd' && f.person === p.id))
        : undefined;
    if (losses === true && (!lossIcc || !lossIfd)) open = true;
    if (open) {
      missing.push(
        whose(
          t(
            'the questions about your self-employment',
            'les questions sur votre activité indépendante',
          ),
        ),
      );
    }
    // One business, one set of accounts: a second one is a second business (or a duplicate).
    const accounts = new Set(
      facts
        .filter((f) => f.person === p.id && f.key.startsWith('business.') && f.instance)
        .map((f) => f.instance),
    );
    if (accounts.size > 1)
      reasons.push(t('more than one business', 'plusieurs activités indépendantes'));
    for (const r of reasons) {
      unsupported.push(
        t(
          `Self-employment${who ? ` of ${who.en}` : ''}: Taxpresso can’t prepare ${r.en} yet, so no tax is computed.`,
          `Activité indépendante${who ? ` (${who.fr})` : ''}${NB}: Taxpresso ne peut pas encore préparer ${r.fr}, aucun impôt n’est donc calculé.`,
        ),
      );
    }
    const business: BusinessInput = {};
    for (const [key, field] of Object.entries(BUSINESS_VALUES)) {
      const a = amountOf(facts.filter((f) => f.key === key && f.person === p.id));
      if (a) (business as Record<string, unknown>)[field] = a;
    }
    if (lossIcc || lossIfd) {
      business.priorLosses = {
        ...(lossIcc ? { cantonal: lossIcc } : {}),
        ...(lossIfd ? { federal: lossIfd } : {}),
      };
    }
    return { ...p, business };
  });
  return { people: out, missing, unsupported };
}

export function engineInputFromFacts(
  taxYear: number,
  facts: readonly Fact[],
  documents: readonly VaultDocument[],
): LedgerInput {
  const { input, missing, notes } = householdFromFacts(taxYear, facts, documents, GENEVA_READING);
  if (!input) return { input: null, missing, notes };

  // Accounts, securities, other movable wealth, life insurance and private debts: the état des
  // titres as the securities rules compute it (../2026/etat-des-titres.ts), by rubric and person.
  // It is the only source of these amounts, so none of their facts is read here.
  const people = input.people.map((p) => p.id);
  const wealthItems: WealthItemInput[] = etatDesTitres({
    taxYear,
    people,
    facts,
    documents,
  }).items;

  // Self-employment (annexe B): only the values of this year's documents count.
  const counted = factsOfYear(taxYear, facts, documents, () => undefined);
  const self = selfEmployment(input.people as PersonInput[], counted);
  if (self.missing.length) return { input: null, missing: [...missing, ...self.missing], notes };

  return {
    input: {
      ...input,
      people: self.people,
      taxYear: input.taxYear as EngineInput['taxYear'],
      commune: input.commune as CommuneSlug,
      wealthItems,
      ...(self.unsupported.length ? { unsupported: self.unsupported } : {}),
    },
    missing,
    notes,
  };
}
