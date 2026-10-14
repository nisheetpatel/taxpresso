// From the ledger to Geneva's engine (SPEC.md section 7: "Inputs: the current ledger view"). The
// part every canton shares is packages/rules-ch's (core/from-ledger.ts); Geneva gives it its commune
// (a slug of its list), the lines of its form for the alimony note, and adds its own: the securities
// list and the other movable wealth by rubric (the état des titres, ../2026/etat-des-titres.ts), and
// self-employment, the simple case (annexe B, ./business.ts), and the lump sums from the 2nd pillar
// and pillar 3a, taxed apart (./capital.ts).
import {
  parseMoney,
  type DocumentKind,
  type Fact,
  type Owner,
  type VaultDocument,
} from '@taxpresso/ledger';
import {
  amountOf,
  businessYear,
  factsOfYear,
  householdFromFacts,
  officialChfOrLatest,
  type Amount,
  type BusinessInput,
  type CantonReading,
} from '@taxpresso/rules-ch';
import type { CommuneSlug } from '../2026/communes.js';
import { COMMUNES_2026 } from '../2026/communes.js';
import { etatDesTitres } from '../2026/etat-des-titres.js';
import { isTaxYear } from './params.js';
import type {
  AbroadPropertyInput,
  CapitalBenefitInput,
  CapitalInput,
  CapitalReason,
  EngineInput,
  EnginePerson,
  PersonInput,
  SwissPropertyInput,
  Text,
  WealthItemInput,
} from './types.js';

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
): { people: PersonInput[]; missing: Text[]; unsupported: Text[]; notes: Text[] } {
  const missing: Text[] = [];
  const unsupported: Text[] = [];
  const notes: Text[] = [];
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
    // Before the year's accounts are in: the profit the user gave in their own words, as an
    // estimate (the rough salary's way, packages/rules-ch core/from-ledger.ts), on 12.01.
    if (!businessYear(business).hasAccounts) {
      const rough = amountOf(
        facts.filter(
          (f) =>
            f.key === 'plan.business_profit' &&
            f.person === p.id &&
            typeof f.value === 'number' &&
            f.value > 0,
        ),
      );
      if (rough) {
        notes.push(
          whose(
            t(
              'No business accounts yet: your rough profit is used as an estimate, after your own AVS contributions and without earlier losses or business wealth.',
              `Pas encore de comptes commerciaux${NB}: votre bénéfice approximatif est utilisé comme estimation, après vos cotisations AVS et sans pertes antérieures ni fortune commerciale.`,
            ),
          ),
        );
        return { ...p, selfEmploymentProfit: { ...rough, status: 'estimate' as const } };
      }
    }
    return { ...p, business };
  });
  return { people: out, missing, unsupported, notes };
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
  notes.push(...self.notes);

  // Lump sums from the 2nd pillar and pillar 3a, taxed apart (./capital.ts).
  const capital = capitalFromFacts(taxYear, facts, documents, people, notes);
  // Capital paid by an employer (salary certificate box 4, 11.70) stays with the salary, as box 8
  // adds it in: the guide taxes it otherwise when it replaces regular payments or is a pension
  // benefit (ge-2025-guide-declaration-pp p. 17 and 18; ch-2026-ifd-instructions-personnes-
  // physiques p. 9), which Taxpresso can't tell. Said, not changed.
  const box4 = factsOfYear(taxYear, facts, documents, () => undefined).some(
    (f) => f.key === 'salary.capital' && typeof f.value === 'number' && f.value > 0,
  );
  if (box4) {
    notes.push({
      en: 'Capital paid by your employer (salary certificate box 4, 11.70) is counted with your salary, as box 8 adds it in. If it replaces regular payments or is a pension benefit, it is taxed otherwise (guide p. 17 and 18): ask the AFC.',
      fr: `Les prestations en capital versées par votre employeur (chiffre 4 du certificat de salaire, 11.70) sont comptées avec votre salaire, comme le chiffre 8 les inclut. Si elles remplacent des prestations périodiques ou relèvent de la prévoyance, elles sont imposées autrement (guide p. 17 et 18)${NB}: demandez à l’AFC.`,
    });
  }

  // A home or land abroad (./abroad.ts): the answers, then its documents or the user's figures.
  const abroad = abroadFromFacts(taxYear, facts, documents, people, notes);
  if (abroad.missing.length) {
    return { input: null, missing: [...missing, ...abroad.missing], notes };
  }

  // A property in Geneva (./property.ts): the answers, then its documents or the user's figures;
  // a mortgage known only from the user's words goes with the securities list's debts.
  const property = propertyFromFacts(taxYear, facts, documents, people, notes);
  if (property.missing.length) {
    return { input: null, missing: [...missing, ...property.missing], notes };
  }
  wealthItems.push(...property.mortgage);

  // Childcare paid for each child, asked when the invoices for the household need splitting
  // (data/ge/2026/questionnaire.yaml, ge.child_care): it takes the place of the household's total.
  const kids = input.children ?? [];
  const care = kids.map((_, i) =>
    amountOf(counted.filter((f) => f.key === 'ge.child_care' && f.person === `child${i + 1}`)),
  );
  const perChild = kids.length > 1 && care.some((a) => (a?.value ?? 0) > 0);
  const household = perChild
    ? Object.fromEntries(Object.entries(input.household ?? {}).filter(([k]) => k !== 'childcare'))
    : input.household;

  return {
    input: {
      ...input,
      ...(perChild
        ? {
            children: kids.map((ch, i) =>
              (care[i]?.value ?? 0) > 0 ? { ...ch, childcare: care[i]! } : ch,
            ),
          }
        : {}),
      ...(household ? { household } : {}),
      people: self.people,
      taxYear: input.taxYear as EngineInput['taxYear'],
      commune: input.commune as CommuneSlug,
      wealthItems,
      ...(self.unsupported.length ? { unsupported: self.unsupported } : {}),
      ...(capital ? { capital } : {}),
      ...(abroad.input ? { abroad: abroad.input } : {}),
      ...(property.input ? { property: property.input } : {}),
    },
    missing,
    notes,
  };
}

/** The French name of each country asked, as the form's Situation wants it ("nom du pays"). */
const COUNTRY: Readonly<Record<string, Text>> = {
  france: t('France', 'France'),
  italy: t('Italy', 'Italie'),
  spain: t('Spain', 'Espagne'),
  portugal: t('Portugal', 'Portugal'),
  germany: t('Germany', 'Allemagne'),
  united_kingdom: t('United Kingdom', 'Royaume-Uni'),
  united_states: t('United States', 'États-Unis'),
};

/** The currency of each country asked: what its documents are printed in, unless they say. */
const CURRENCY: Readonly<Record<string, string>> = {
  france: 'EUR',
  italy: 'EUR',
  spain: 'EUR',
  portugal: 'EUR',
  germany: 'EUR',
  united_kingdom: 'GBP',
  united_states: 'USD',
};

/** "250000 EUR", "EUR 250'000", "250 000": the currency code (if any) and the amount as printed. */
function splitCurrency(printed: string): { currency?: string; amount: string } {
  const m = /^\s*([A-Za-z]{3})?\s*(.*?)\s*([A-Za-z]{3})?\s*$/.exec(printed);
  const code = (m?.[1] ?? m?.[3])?.toUpperCase();
  return { ...(code ? { currency: code } : {}), amount: m?.[2] ?? printed };
}

/** The least sure of several amounts' statuses. */
function weakest(list: readonly Amount[]): Amount['status'] {
  if (list.some((a) => a.status === 'extracted')) return 'extracted';
  if (list.some((a) => a.status === 'estimate')) return 'estimate';
  if (list.some((a) => a.status === 'stated')) return 'stated';
  return 'verified';
}

/**
 * The household's home or land abroad, from the answers (profile.special, profile.abroad_property,
 * its owner, country and age) and the values of its documents, or the user's own figures until
 * they are in (plan.abroad_value, plan.abroad_rent), flagged as estimates. Amounts are converted at
 * the official rate (the value at 31 December, the income at the year's average:
 * ge-na-valeur-fiscale-page; ge-2025-taux-donnees-fiscales); a year whose rates are not published
 * yet takes the latest year's, as an estimate. Answers still open are `missing`; what the simple
 * case doesn't cover is in the input's `unsupported` (fail closed). No input without one.
 */
export function abroadFromFacts(
  taxYear: number,
  allFacts: readonly Fact[],
  documents: readonly VaultDocument[],
  people: readonly EnginePerson[],
  notes: Text[] = [],
): { input?: AbroadPropertyInput; missing: Text[] } {
  const note = (x: Text) => notes.some((n) => n.en === x.en) || notes.push(x);
  const facts = factsOfYear(taxYear, allFacts, documents, () => undefined);
  const answer = (key: string, person: Fact['person'] = 'household') =>
    facts.find((f) => f.key === key && f.person === person && f.status !== 'extracted')?.value;
  const special = answer('profile.special');
  if (!Array.isArray(special) || !special.includes('property_abroad')) return { missing: [] };
  const use = answer('profile.abroad_property');
  const owner = answer('profile.abroad_property_owner');
  const country = answer('profile.abroad_property_country');
  const old = answer('profile.abroad_property_old');
  // Several properties, something else, or owned with people outside the household: the
  // questionnaire says it isn't supported yet, and the property is left out.
  if (use === 'several' || use === 'other' || owner === 'others') return { missing: [] };
  const open =
    use === undefined ||
    owner === undefined ||
    country === undefined ||
    (use !== 'land' && typeof old !== 'boolean');
  if (open) {
    return {
      missing: [
        t(
          'the questions about your property abroad',
          'les questions sur votre immeuble à l’étranger',
        ),
      ],
    };
  }
  const couple = people.length > 1;
  const whose: AbroadPropertyInput['owner'] =
    owner === 'p2' && couple ? 'p2' : owner === 'both' && couple ? 'household' : 'p1';

  // Outside the simple case, from the other answers (fail closed).
  const unsupported: Text[] = [];
  if (people.some((p) => answer('profile.taxed_at_source', p) === true)) {
    unsupported.push(
      t(
        'A property abroad of someone taxed at source: the source-tax directives don’t say how it counts (for TOU and the rate), so Taxpresso can’t prepare it yet and no tax is computed.',
        `Un immeuble à l’étranger d’une personne imposée à la source${NB}: les directives de l’impôt à la source ne disent pas comment il compte (pour la TOU et le taux)${NB}; Taxpresso ne peut pas encore le préparer, aucun impôt n’est donc calculé.`,
      ),
    );
  }
  const selfEmployed = people.some((p) => {
    const v = answer('profile.income_sources', p);
    return Array.isArray(v) && v.includes('self_employment');
  });
  if (selfEmployed) {
    unsupported.push(
      t(
        'Self-employment together with a property abroad: the business’s assets and debts would enter the split, which Taxpresso can’t prepare yet, so no tax is computed.',
        `Une activité indépendante avec un immeuble à l’étranger${NB}: les actifs et dettes de l’activité entreraient dans la répartition, que Taxpresso ne sait pas encore préparer${NB}; aucun impôt n’est donc calculé.`,
      ),
    );
  }
  const moved = answer('profile.moved');
  if (moved === 'from_abroad' || moved === 'leaving_switzerland') {
    unsupported.push(
      t(
        'A property abroad in the year you arrived from abroad or left Switzerland: Taxpresso can’t prepare it yet, so no tax is computed.',
        `Un immeuble à l’étranger l’année d’une arrivée de l’étranger ou d’un départ de Suisse${NB}: Taxpresso ne peut pas encore le préparer, aucun impôt n’est donc calculé.`,
      ),
    );
  }

  // The values of its documents, one per document, as printed in the property's currency.
  const kinds = new Map(documents.map((d) => [d.id, d.kind]));
  const fallback = typeof country === 'string' ? CURRENCY[country] : undefined;
  let rateYear: number | undefined;
  /** A printed amount in francs at the official rate, with its fact's status and id. */
  const convert = (
    f: Fact,
    currency: string | undefined,
    use: 'income' | 'wealth',
  ): Amount | undefined => {
    if (typeof f.value !== 'string') return undefined;
    const split = splitCurrency(f.value);
    const code = split.currency ?? currency;
    const parsed = parseMoney(split.amount);
    if (!parsed.ok) {
      note(
        t(
          `Your property abroad: "${f.value}" is not an amount Taxpresso can read, so it is left out. Correct it.`,
          `Votre immeuble à l’étranger${NB}: «${NB}${f.value}${NB}» n’est pas un montant lisible, il est laissé de côté. Corrigez-le.`,
        ),
      );
      return undefined;
    }
    if (!code) {
      note(
        t(
          `Your property abroad: the currency of "${f.value}" is not known, so it is left out. Say which it is.`,
          `Votre immeuble à l’étranger${NB}: la monnaie de «${NB}${f.value}${NB}» n’est pas connue, il est laissé de côté. Indiquez-la.`,
        ),
      );
      return undefined;
    }
    const c = officialChfOrLatest(parsed.value, code, taxYear, use);
    if (!c.ok) {
      note(
        t(
          `Your property abroad: Taxpresso has no official ${taxYear} rate for ${code}, so "${f.value}" is left out. Give the amount in francs at the official rate (ESTV, ICTax).`,
          `Votre immeuble à l’étranger${NB}: Taxpresso n’a pas de cours officiel ${taxYear} pour ${code}, «${NB}${f.value}${NB}» est donc laissé de côté. Indiquez le montant en francs au cours officiel (AFC, ICTax).`,
        ),
      );
      return undefined;
    }
    if (c.estimate) rateYear = c.estimate.year;
    const status: Amount['status'] =
      f.status === 'extracted'
        ? 'extracted'
        : f.status === 'estimate' || c.estimate
          ? 'estimate'
          : f.status === 'stated'
            ? 'stated'
            : 'verified';
    return { value: c.centimes, status, facts: [f.id] };
  };
  /** The values of `key` on documents of `kind`, each in francs. */
  const fromDocuments = (key: string, kind: DocumentKind, use: 'income' | 'wealth'): Amount[] => {
    const out: Amount[] = [];
    for (const f of facts) {
      if (f.key !== key || !f.instance || kinds.get(f.instance) !== kind) continue;
      const printed = facts.find(
        (x) => x.key === 'abroad.currency' && x.instance === f.instance,
      )?.value;
      const currency = typeof printed === 'string' ? printed.trim().toUpperCase() : fallback;
      const a = convert(f, currency || fallback, use);
      if (a) out.push(a);
    }
    return out;
  };
  /** Several amounts of one kind, added up (two management accounts of one year). */
  const sum = (list: Amount[]): Amount | undefined =>
    list.length
      ? {
          value: list.reduce((s, a) => s + a.value, 0),
          status: weakest(list),
          facts: list.flatMap((a) => a.facts ?? []),
        }
      : undefined;
  /** The user's own figure, in the property's currency, as an estimate. */
  const plan = (key: string, use: 'income' | 'wealth'): Amount | undefined => {
    const f = facts.find((x) => x.key === key && x.person === 'household');
    const a = f ? convert(f, fallback, use) : undefined;
    return a ? { ...a, status: a.status === 'extracted' ? 'extracted' : 'estimate' } : undefined;
  };

  const taxValue = fromDocuments('abroad.tax_value', 'foreign_property_tax_notice', 'wealth')[0];
  const price = fromDocuments('abroad.purchase_price', 'foreign_property_deed', 'wealth')[0];
  const rough = taxValue || price ? undefined : plan('plan.abroad_value', 'wealth');
  const value = taxValue ?? price ?? rough;
  const out: AbroadPropertyInput = {
    owner: whose,
    use: use === 'let' ? 'let' : use === 'land' ? 'land' : 'own_use',
    ...(typeof country === 'string' && COUNTRY[country] ? { country: COUNTRY[country] } : {}),
    ...(country === 'france' ? { france: true } : {}),
    ...(typeof old === 'boolean' ? { old } : {}),
    ...(unsupported.length ? { unsupported } : {}),
  };
  if (value) {
    out.value = value;
    out.valueBasis = taxValue ? 'tax_value' : price ? 'purchase_price' : 'estimate';
  }
  if (use === 'own_use') {
    const rental = fromDocuments('abroad.rental_value', 'foreign_property_tax_notice', 'income')[0];
    const base = rental
      ? undefined
      : fromDocuments('abroad.land_tax_base', 'foreign_property_tax_notice', 'income')[0];
    if (rental) {
      out.rentalValue = rental;
      out.rentalBasis = country === 'france' ? 'france_habitation' : 'country';
    } else if (base && country === 'france') {
      out.rentalValue = base;
      out.rentalBasis = 'france_land_tax';
    }
  }
  if (use === 'let') {
    const rents =
      sum(fromDocuments('abroad.rents', 'foreign_property_rent_statement', 'income')) ??
      plan('plan.abroad_rent', 'income');
    const costs = sum(fromDocuments('abroad.costs', 'foreign_property_rent_statement', 'income'));
    if (rents) out.rents = rents;
    if (costs) out.costs = costs;
  }
  if (rateYear !== undefined) {
    note(
      t(
        `Your property abroad: its amounts are converted at the official ${rateYear} rates, as estimates, until the ${taxYear} rates are published (after 31 December).`,
        `Votre immeuble à l’étranger${NB}: ses montants sont convertis aux cours officiels ${rateYear}, comme estimations, jusqu’à la publication des cours ${taxYear} (après le 31 décembre).`,
      ),
    );
  }
  return { input: out, missing: [] };
}

/** Why an answer puts a property in Geneva outside the simple case (the questions say so too). */
const PROPERTY_SPECIAL: Readonly<Record<string, Text>> = {
  moved: t(
    'a property bought or sold during the year, or moved into or out of',
    'un immeuble acheté ou vendu dans l’année, ou dans lequel vous avez emménagé ou duquel vous êtes parti',
  ),
  part_let: t(
    'a home partly let or let for holidays',
    'un logement loué en partie ou en location de vacances',
  ),
  business: t('a property used for a business', 'un immeuble utilisé pour une activité'),
  works: t(
    'works that add value, demolition or works on a listed building',
    'des travaux à plus-value, une démolition ou des travaux sur un monument historique',
  ),
  subsidy: t(
    'a subsidy for works or a subsidised home (HLM, HBM, HM, épargne logement)',
    'une subvention pour travaux ou un logement subventionné (HLM, HBM, HM, épargne logement)',
  ),
  carried: t(
    'costs carried over from earlier years (frais immobiliers reportés)',
    'des frais immobiliers reportés des années précédentes',
  ),
  usufruct: t(
    'a usufruct or a right of residence (usufruit, droit d’habitation)',
    'un usufruit ou un droit d’habitation',
  ),
};

/**
 * The household's property in Geneva, from the answers (profile.special, profile.swiss_property,
 * its owner, since when, its age, what is special about it, whether it is in the commune of a
 * property let) and the values of its documents (the AFC's letter or avis de taxation immobilier,
 * the management account, the upkeep invoices and PPE charges, the mortgage statement), or the
 * user's own figures until they are in (plan.property_*, plan.mortgage_*), flagged as estimates.
 * Answers still open are `missing`; what the simple case doesn't cover is in the input's
 * `unsupported` (fail closed), or the questionnaire already says it isn't supported. No input
 * without one.
 */
export function propertyFromFacts(
  taxYear: number,
  allFacts: readonly Fact[],
  documents: readonly VaultDocument[],
  people: readonly EnginePerson[],
  notes: Text[] = [],
): { input?: SwissPropertyInput; missing: Text[]; mortgage: WealthItemInput[] } {
  const note = (x: Text) => notes.some((n) => n.en === x.en) || notes.push(x);
  const facts = factsOfYear(taxYear, allFacts, documents, () => undefined);
  const answer = (key: string, person: Fact['person'] = 'household') =>
    facts.find((f) => f.key === key && f.person === person && f.status !== 'extracted')?.value;
  const none = { missing: [], mortgage: [] };
  const special = answer('profile.special');
  if (!Array.isArray(special) || !special.includes('real_estate')) return none;
  const what = answer('profile.swiss_property');
  const owner = answer('profile.swiss_property_owner');
  // Another canton, several properties, something else, shared with someone outside the
  // household: the questionnaire says it isn't supported yet, and the property is left out.
  if (what === 'other_canton' || what === 'several' || what === 'other' || owner === 'others') {
    return none;
  }
  const own = what === 'own_house' || what === 'own_flat';
  const since = answer('profile.swiss_property_since');
  const old = answer('profile.swiss_property_old');
  const specials = answer('profile.swiss_property_special');
  const loan = answer('profile.swiss_property_loan');
  const otherCommune = answer('profile.swiss_property_other_commune');
  const open =
    what === undefined ||
    owner === undefined ||
    typeof old !== 'boolean' ||
    !Array.isArray(specials) ||
    typeof loan !== 'boolean' ||
    (own && typeof since !== 'number') ||
    (!own && typeof otherCommune !== 'boolean');
  if (open) {
    return {
      missing: [
        t(
          'the questions about your property in Geneva',
          'les questions sur votre immeuble à Genève',
        ),
      ],
      mortgage: [],
    };
  }
  if (specials.some((v) => PROPERTY_SPECIAL[String(v)]) || (!own && otherCommune === true)) {
    return none;
  }
  const couple = people.length > 1;
  const whose: SwissPropertyInput['owner'] =
    owner === 'p2' && couple ? 'p2' : owner === 'both' && couple ? 'household' : 'p1';

  // Outside the simple case, from the other answers (fail closed).
  const unsupported: Text[] = [];
  if (people.some((p) => answer('profile.taxed_at_source', p) === true)) {
    unsupported.push(
      t(
        'A property in Geneva of someone taxed at source: the source-tax directives make the ordinary taxation afterwards (TOU) compulsory for an owner (ge-2026-source-directives p. 6 and 51), which Taxpresso doesn’t prepare yet with a property, so no tax is computed.',
        `Un immeuble à Genève d’une personne imposée à la source${NB}: les directives de l’impôt à la source rendent la taxation ordinaire ultérieure (TOU) obligatoire pour un propriétaire (ge-2026-source-directives p. 6 et 51), ce que Taxpresso ne prépare pas encore avec un immeuble${NB}; aucun impôt n’est donc calculé.`,
      ),
    );
  }
  const moved = answer('profile.moved');
  if (moved === 'from_abroad' || moved === 'leaving_switzerland') {
    unsupported.push(
      t(
        'A property in Geneva in the year you arrived from another country or left Switzerland: Taxpresso can’t prepare it yet, so no tax is computed.',
        `Un immeuble à Genève l’année d’une arrivée d’un autre pays ou d’un départ de Suisse${NB}: Taxpresso ne peut pas encore le préparer, aucun impôt n’est donc calculé.`,
      ),
    );
  }
  if (own && typeof since === 'number' && since >= taxYear) {
    unsupported.push(
      t(
        `Your home in Geneva: you started living in it in ${since}, so ${taxYear} is not a whole year in it (the rental value counts from the move). Taxpresso can’t prepare that yet, so no tax is computed.`,
        `Votre logement à Genève${NB}: vous l’occupez depuis ${since}, ${taxYear} n’y est donc pas une année entière (la valeur locative compte dès l’emménagement). Taxpresso ne peut pas encore le préparer, aucun impôt n’est donc calculé.`,
      ),
    );
  }

  // The values of its documents (in francs), each document once.
  const kinds = new Map(documents.map((d) => [d.id, d.kind]));
  const fromDocuments = (key: string, kind: DocumentKind[]): Amount | undefined =>
    amountOf(
      facts.filter(
        (f) =>
          f.key === key &&
          f.instance !== undefined &&
          kind.includes(kinds.get(f.instance) as DocumentKind),
      ),
    );
  /** A value the AFC sets for the year: one document's (the latest added), never added up. */
  const single = (key: string, kind: DocumentKind[]): Amount | undefined => {
    const order = documents.map((d) => d.id);
    const own = facts.filter(
      (f) =>
        f.key === key &&
        f.instance !== undefined &&
        kind.includes(kinds.get(f.instance) as DocumentKind),
    );
    const last = own.reduce<string | undefined>(
      (best, f) =>
        best === undefined || order.indexOf(f.instance!) > order.indexOf(best) ? f.instance : best,
      undefined,
    );
    return amountOf(own.filter((f) => f.instance === last));
  };
  /** The user's own figure, in francs, as an estimate. */
  const plan = (key: string): Amount | undefined => {
    const a = amountOf(
      facts.filter((x) => x.key === key && x.person === 'household' && typeof x.value === 'number'),
    );
    return a && a.value > 0 ? { ...a, status: 'estimate' as const } : undefined;
  };
  const value = single('property.tax_value', ['property_values']) ?? plan('plan.property_value');
  const out: SwissPropertyInput = {
    owner: whose,
    use: own ? 'own_home' : 'let',
    ...(what === 'own_house' ? { kind: 'house' as const } : {}),
    ...(what === 'own_flat' ? { kind: 'flat' as const } : {}),
    ...(own && typeof since === 'number' ? { since } : {}),
    old,
    ...(value ? { value } : {}),
    ...(unsupported.length ? { unsupported } : {}),
  };
  if (own) {
    const rv =
      single('property.rental_value', ['property_values']) ?? plan('plan.property_rental_value');
    if (rv) out.rentalValue = rv;
    const upkeep = fromDocuments('property.upkeep', [
      'property_upkeep_invoices',
      'ppe_charges_statement',
    ]);
    if (upkeep) out.upkeep = upkeep;
  } else {
    const rents =
      fromDocuments('property.rents', ['property_rent_statement']) ?? plan('plan.property_rent');
    if (rents) out.rents = rents;
    // The management account's costs and any upkeep invoices of the year, added up.
    const costs = [
      fromDocuments('property.costs', ['property_rent_statement']),
      fromDocuments('property.upkeep', ['property_upkeep_invoices', 'ppe_charges_statement']),
    ].filter((a): a is Amount => !!a);
    if (costs.length) {
      out.upkeep = {
        value: costs.reduce((s, a) => s + a.value, 0),
        status: weakest(costs),
        facts: costs.flatMap((a) => a.facts ?? []),
      };
    }
  }
  // The mortgage: its statement (E1 55.20, read with the état des titres), or until it is in, the
  // user's rough figures as estimates. Its interest is the financing the taux d'effort looks at.
  const mortgage: WealthItemInput[] = [];
  if (loan === true) {
    const statement = documents.some(
      (d) =>
        d.kind === 'mortgage_statement' &&
        !d.replacedBy &&
        facts.some((f) => f.instance === d.id && f.key === 'debt.interest'),
    );
    const interest = statement
      ? fromDocuments('debt.interest', ['mortgage_statement'])
      : plan('plan.mortgage_interest');
    if (interest) out.mortgageInterest = interest;
    if (!statement) {
      const label = (en: string, fr: string) => ({ en, fr });
      const balance = plan('plan.mortgage_balance');
      const source = `ge-2025-declaration-specimen p. 3, 4 and 19 (E1, 55.20); ge-2025-guide-declaration-pp p. 37`;
      if (balance) {
        mortgage.push({
          code: '55.20',
          part: 'wealth_deduction',
          person: 'household',
          centimes: balance.value,
          taxes: ['icc'],
          estimate: true,
          complete: true,
          label: label('Mortgage, your rough figure', 'Dettes hypothécaires, votre estimation'),
          source,
        });
      }
      if (interest) {
        mortgage.push({
          code: '55.20',
          part: 'deduction',
          person: 'household',
          centimes: interest.value,
          taxes: ['icc', 'ifd'],
          estimate: true,
          complete: true,
          label: label(
            'Mortgage interest, your rough figure',
            'Intérêts hypothécaires, votre estimation',
          ),
          source,
        });
      }
      if (!balance && !interest) {
        note(
          t(
            'Your mortgage: no statement and no rough figure yet, so neither the debt nor its interest is counted. The taxes are higher than they will be.',
            `Votre hypothèque${NB}: ni relevé ni montant approximatif pour l’instant, ni la dette ni ses intérêts ne sont donc comptés. Les impôts sont plus élevés qu’ils ne le seront.`,
          ),
        );
      }
    }
  }
  return { input: out, missing: [], mortgage };
}

/** The pillar of each kind of attestation of a lump sum. */
const CAPITAL_KINDS: Partial<Record<DocumentKind, CapitalBenefitInput['pillar']>> = {
  lpp_capital_attestation: 'pillar2',
  pillar3a_capital_attestation: 'pillar3a',
};

const REASONS: readonly CapitalReason[] = [
  'retirement',
  'home',
  'self_employment',
  'leaving',
  'other',
];

/**
 * The household's lump sums of the year, one per attestation (capital.amount, capital.date,
 * capital.reason), with the answers that decide whether Taxpresso can tax them: a salary taxed at
 * source, an arrival from abroad. Undefined when there is none.
 */
export function capitalFromFacts(
  taxYear: number,
  facts: readonly Fact[],
  documents: readonly VaultDocument[],
  people: readonly EnginePerson[],
  notes: Text[] = [],
): CapitalInput | undefined {
  const note = (x: Text) => notes.some((n) => n.en === x.en) || notes.push(x);
  const year = factsOfYear(taxYear, facts, documents, () => undefined);
  const docs = new Map(documents.map((d) => [d.id, d]));
  const owner = (p: Fact['person']): EnginePerson | undefined =>
    p === 'p1' || p === 'p2' ? p : people.length === 1 ? 'p1' : undefined;
  const benefits: CapitalBenefitInput[] = [];
  const instances = [
    ...new Set(year.filter((f) => f.key === 'capital.amount').map((f) => f.instance)),
  ];
  for (const instance of instances) {
    const doc = instance ? docs.get(instance) : undefined;
    const pillar = doc?.kind ? CAPITAL_KINDS[doc.kind] : undefined;
    const own = year.filter((f) => f.key === 'capital.amount' && f.instance === instance);
    for (const person of new Set(own.map((f) => owner(f.person)))) {
      if (!pillar || !person) continue;
      const amount = amountOf(own.filter((f) => owner(f.person) === person));
      if (!amount) continue;
      const read = (key: string) =>
        year.find((f) => f.key === key && f.instance === instance && owner(f.person) === person)
          ?.value;
      const date = read('capital.date');
      const reason = read('capital.reason');
      benefits.push({
        ...(instance ? { id: instance } : {}),
        person,
        pillar,
        amount,
        ...(typeof date === 'string' ? { date } : {}),
        ...(typeof reason === 'string' && REASONS.includes(reason as CapitalReason)
          ? { reason: reason as CapitalReason }
          : {}),
      });
    }
  }
  // An answer the user gave, not a suggestion read from a document.
  const answer = (key: string, person: Fact['person']) =>
    year.find((f) => f.key === key && f.person === person && f.status !== 'extracted')?.value;
  const said = people.filter((p) => {
    const v = answer('profile.pension_capital', p);
    return Array.isArray(v) && v.length > 0;
  });
  if (said.some((p) => !benefits.some((b) => b.person === p))) {
    note({
      en: 'Pension capital: no attestation read yet for a lump sum you said you received, so its separate tax is not computed for it.',
      fr: `Prestations en capital${NB}: aucune attestation lue pour un capital que vous avez dit avoir reçu, son impôt séparé n’est donc pas calculé.`,
    });
  }
  if (!benefits.length) return undefined;
  const atSource = people.filter((p) => answer('profile.taxed_at_source', p) === true);
  return {
    benefits,
    ...(atSource.length ? { atSource } : {}),
    ...(answer('profile.moved', 'household') === 'from_abroad' ? { arrivedFromAbroad: true } : {}),
  };
}
