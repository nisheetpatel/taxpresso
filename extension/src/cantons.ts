// The cantons Taxpresso prepares a return for (docs/design/cantons.md, section 2): for each, its
// rules (packages/rules-<c>), its questionnaire (data/<c>/<year>) and its communes, and the questions
// every canton shares, which are all Taxpresso asks until it knows the canton. The canton is the
// answer to the first question (profile.canton); one tax year has one canton.
import {
  filing as genevaFiling,
  type CopyLabels,
  type FormItem,
  type FormMap,
} from '@taxpresso/filing-ge';
import { filing as bernFiling } from '@taxpresso/filing-be';
import { filing as baselLandFiling } from '@taxpresso/filing-bl';
import { filing as vaudFiling } from '@taxpresso/filing-vd';
import { filing as baselFiling } from '@taxpresso/filing-bs';
import { filing as fribourgFiling } from '@taxpresso/filing-fr';
import { filing as lucerneFiling } from '@taxpresso/filing-lu';
import { filing as stGallenFiling } from '@taxpresso/filing-sg';
import { filing as zugFiling } from '@taxpresso/filing-zg';
import { filing as zurichFiling } from '@taxpresso/filing-zh';
import type { Fact, FactValue, KeyRegistry, Ledger, VaultDocument } from '@taxpresso/ledger';
import type { CantonPlan } from '@taxpresso/optimizer';
import {
  beQuestionnaire2026,
  blQuestionnaire2026,
  bsQuestionnaire2026,
  frQuestionnaire2026,
  geQuestionnaire2026,
  luQuestionnaire2026,
  sgQuestionnaire2026,
  QuestionnaireEngine,
  sharedQuestionnaire2026,
  vdQuestionnaire2026,
  zgQuestionnaire2026,
  zhQuestionnaire2026,
  type QuestionnaireFile,
} from '@taxpresso/questionnaire';
import {
  cantonInputFromFacts,
  isSupportedCanton,
  KEYS_CANTON_2026,
  KEYS_HOUSEHOLD_2026,
  SUPPORTED_CANTONS,
  type CantonAnswer,
  type CantonCode,
  type CantonFiling,
  type CantonLedgerInput,
  type CantonLedgerReading,
  type CantonRules,
  type CantonTerms,
  type HouseholdInput,
  type ResultView,
  type SupportedCanton,
  type TaxResult,
  type Text,
} from '@taxpresso/rules-ch';
import {
  COMMUNES_2026,
  computeReturn as genevaReturn,
  engineInputFromFacts,
  rules as genevaRules,
  view as genevaView,
} from '@taxpresso/rules-ge';
import {
  communeOptions,
  NOTE_VALUABLES,
  zhParamsFor,
  rules as zurichRules,
  view as zurichView,
  ZH_TERMS,
  ZURICH_READING,
  type ZhTaxResult,
  type ZurichCantonal,
} from '@taxpresso/rules-zh';
import {
  BE_TERMS,
  beParamsFor,
  BERN_READING,
  communeOptions as bernCommunes,
  rules as bernRules,
  view as bernView,
  type BernCantonal,
  type BeTaxResult,
} from '@taxpresso/rules-be';
import {
  BASEL_LAND_READING,
  BL_TERMS,
  blParamsFor,
  communeOptions as baselLandCommunes,
  NOTE_VALUABLES as BL_NOTE_VALUABLES,
  rules as baselLandRules,
  view as baselLandView,
  type BaselLandCantonal,
  type BlTaxResult,
} from '@taxpresso/rules-bl';
import {
  communeOptions as vaudCommunes,
  NOTE_VALUABLES as VAUD_VALUABLES,
  rules as vaudRules,
  VAUD_READING,
  vdParamsFor,
  view as vaudView,
  VD_TERMS,
  type VaudCantonal,
  type VdTaxResult,
} from '@taxpresso/rules-vd';
import {
  BASEL_READING,
  BS_TERMS,
  bsParamsFor,
  communeOptions as baselCommunes,
  NOTE_VALUABLES as BASEL_VALUABLES,
  rules as baselRules,
  view as baselView,
  type BaselCantonal,
  type BsTaxResult,
} from '@taxpresso/rules-bs';
import {
  communeOptions as zugCommunes,
  NOTE_VALUABLES as ZG_NOTE_VALUABLES,
  rules as zugRules,
  view as zugView,
  ZG_TERMS,
  zgParamsFor,
  ZUG_READING,
  type ZgTaxResult,
  type ZugCantonal,
} from '@taxpresso/rules-zg';
import {
  communeOptions as lucerneCommunes,
  LU_TERMS,
  LUCERNE_READING,
  luParamsFor,
  NOTE_VALUABLES as LU_NOTE_VALUABLES,
  rules as lucerneRules,
  view as lucerneView,
  type LucerneCantonal,
  type LuTaxResult,
} from '@taxpresso/rules-lu';
import {
  communeOptions as stGallenCommunes,
  NOTE_VALUABLES as SG_NOTE_VALUABLES,
  rules as stGallenRules,
  SG_TERMS,
  sgParamsFor,
  ST_GALLEN_READING,
  view as stGallenView,
  type SgTaxResult,
  type StGallenCantonal,
} from '@taxpresso/rules-sg';
import {
  communeOptions as fribourgCommunes,
  FR_TERMS,
  FRIBOURG_READING,
  frParamsFor,
  NOTE as FR_NOTE,
  NOTE_VALUABLES as FR_NOTE_VALUABLES,
  rules as fribourgRules,
  view as fribourgView,
  type FribourgCantonal,
  type FrTaxResult,
} from '@taxpresso/rules-fr';
import { movableWealth } from './wealth.js';

/** A canton's name in the UI languages. */
export interface CantonName extends Text {
  de: string;
}

/** What a canton's tax is computed from: the values that count, for the tax year. */
export interface LedgerContext {
  taxYear: number;
  /** The ledger's current facts, without those of documents replaced or gone. */
  facts: readonly Fact[];
  /** The documents that count. */
  documents: readonly VaultDocument[];
  /** The people of the household. */
  people: readonly ('p1' | 'p2')[];
}

/** The tax of the year from the ledger: null while answers it needs are missing. */
export interface LedgerEstimate {
  result: TaxResult | null;
  /** What must be answered before anything can be computed. */
  missing: Text[];
  /** How the ledger was read: what was left out or assumed. */
  notes: Text[];
}

/** A canton's filing side, with the shapes of the shared copy panel (@taxpresso/filing-ge). */
export type CantonFilingEntry = CantonFiling<FormMap<string>, FormItem, CopyLabels>;

export interface CantonEntry {
  code: SupportedCanton;
  name: CantonName;
  /** The canton's free official tax software, for "not supported" answers. */
  software: string;
  /** The canton's tax rules behind the canton interface (packages/rules-ch, canton.ts). */
  rules: { canton: CantonCode; taxYears: readonly number[] };
  /** The canton's questionnaire for the year, or undefined while it has none. */
  questionnaire(taxYear: number): QuestionnaireFile | undefined;
  /** Every ledger key of the year: the canton question, the shared keys and the canton's own. */
  keys(taxYear: number): KeyRegistry;
  /** The communes the questionnaire offers, by the value stored for profile.commune. */
  communes(taxYear: number): { slug: string; name: string }[];
  /** For Claude, after "Answer: the name of the commune": what else the answer needs. */
  communeHint?: string;
  /**
   * For a return started before Taxpresso asked for the canton: the answers that only this canton
   * asks, in words, when there are some (then the return is taken as this canton's).
   */
  inferFrom?(ledger: Ledger): Text[];
  /** The tax of the year: the ledger read into the canton's household input, then its engine. */
  estimate(ctx: LedgerContext): LedgerEstimate;
  /** How its result reads in the generic views (compute_tax, the estimate card, the plans). */
  view: ResultView;
  /** The official form. */
  filing: CantonFilingEntry;
  /**
   * The official terms of the canton's form for the generic texts (final check, plans, copy
   * panel). Absent for Geneva, whose texts are the defaults everywhere.
   */
  terms?: CantonTerms;
  /**
   * Every canton but Geneva (whose engine reads its own input, with the état des titres): the
   * ledger read into the shared household input, with the canton's own part (`cantonal`).
   */
  household?(ctx: LedgerContext): CantonLedgerInput<unknown>;
  /** The commune of the answer, as the canton's engine takes it (the shared reading's). */
  communeOf?(answer: FactValue | undefined, taxYear: number): string | number | undefined;
  /**
   * How the plans run on the canton's engine (packages/optimizer, CantonPlan), and the commune they
   * assume when none is answered, in words. Absent for Geneva, whose engine the plans run directly.
   */
  plan?: CantonPlan & {
    communeName: Text;
    /** With `noTax`: why the canton's tax can't be computed for those years, in words. */
    noTaxText?: Text;
  };
  /** TOU (taxation ordinaire ultérieure), Geneva's procedure for people taxed at source. */
  tou: boolean;
}

/**
 * A canton read through the shared ledger reading (rules-ch, cantonInputFromFacts) and computed by
 * its rules behind the canton interface: everything but its own answers is generic.
 * `valuables`: the note when the canton's form has its own lines for cash, gold and vehicles.
 */
export function sharedLedger<Cantonal extends object>(
  reading: CantonLedgerReading<Cantonal>,
  rules: CantonRules<Cantonal, TaxResult>,
  valuables?: Text,
): Pick<CantonEntry, 'estimate' | 'household' | 'communeOf'> {
  const household = (ctx: LedgerContext) =>
    cantonInputFromFacts(
      ctx.taxYear,
      ctx.facts,
      ctx.documents,
      reading,
      movableWealth(ctx.taxYear, ctx.people, ctx.facts, ctx.documents, valuables),
    );
  return {
    household,
    communeOf: (answer, taxYear) => reading.commune(answer, taxYear),
    estimate(ctx) {
      const { input, missing, notes } = household(ctx);
      return { result: input ? rules.computeReturn(input) : null, missing, notes };
    },
  };
}

/** An answer the user gave (stated), not a suggestion read from a document. */
const stated = (ledger: Ledger, key: string): FactValue | undefined => {
  const f = ledger.get(key);
  return f && f.status !== 'extracted' ? f.value : undefined;
};

const GENEVA: CantonEntry = {
  code: 'GE',
  name: { en: 'Geneva', fr: 'Genève', de: 'Genf' },
  software: 'GeTax',
  rules: genevaRules,
  questionnaire: (taxYear) => (taxYear === 2026 ? geQuestionnaire2026() : undefined),
  keys: (taxYear) => ({ ...KEYS_CANTON_2026, ...genevaRules.keys(taxYear) }),
  communes: () => COMMUNES_2026.map((c) => ({ slug: c.slug, name: c.name })),
  inferFrom(ledger) {
    const why: Text[] = [];
    const commune = stated(ledger, 'profile.commune');
    if (typeof commune === 'string' && COMMUNES_2026.some((c) => c.slug === commune)) {
      why.push({ en: 'your commune is in Geneva', fr: 'votre commune est genevoise' });
    }
    if (stated(ledger, 'profile.moved') === 'within_geneva') {
      why.push({ en: 'you moved within Geneva', fr: 'vous avez déménagé dans le canton' });
    }
    if (['p1', 'p2'].some((p) => ledger.get('profile.tou', p as 'p1')?.status === 'stated')) {
      why.push({ en: 'you answered about TOU', fr: 'vous avez répondu sur la TOU' });
    }
    return why;
  },
  // Geneva's engine reads its own input, with the état des titres (@taxpresso/rules-ge).
  estimate(ctx) {
    const { input, missing, notes } = engineInputFromFacts(ctx.taxYear, ctx.facts, ctx.documents);
    return { result: input ? genevaReturn(input) : null, missing, notes };
  },
  view: genevaView,
  filing: genevaFiling,
  tou: true,
};

const ZURICH: CantonEntry = {
  code: 'ZH',
  name: { en: 'Zurich', fr: 'Zurich', de: 'Zürich' },
  software: 'ZHprivateTax',
  rules: zurichRules,
  questionnaire: (taxYear) => (taxYear === 2026 ? zhQuestionnaire2026() : undefined),
  keys: (taxYear) => ({ ...KEYS_CANTON_2026, ...zurichRules.keys(taxYear) }),
  communes: (taxYear) => communeOptions(taxYear),
  communeHint: ' (Uster and Turbenthal: the part too, as listed in the dashboard)',
  ...sharedLedger(ZURICH_READING, zurichRules, NOTE_VALUABLES),
  view: zurichView,
  filing: zurichFiling,
  terms: ZH_TERMS,
  plan: {
    computeReturn: (input) => zurichRules.computeReturn(input as HouseholdInput<ZurichCantonal>),
    incomeTax: (r) => zurichView.incomeTax(r as ZhTaxResult),
    // The City of Zurich, by its BFS number.
    defaultCommune: 261,
    communeName: { en: 'City of Zurich', fr: 'Ville de Zurich', de: 'Stadt Zürich' },
    sources(taxYear) {
      // The documents a Zurich household's income tax rests on, for the year.
      const P = zhParamsFor(taxYear);
      return [
        P.incomeTariff.married.source,
        P.cantonalRate.source,
        P.communes.source,
        'ch-2026-ifd-progression-deductions p. 2, p. 4',
      ];
    },
    assumptions: { preview: 'zh_preview', communeDefault: 'zh_commune_default' },
    // No Zurich document gives the cantonal rule of a 3a catch-up yet: no saving (fail closed).
    catchUp: { field: 'pillar3a', unknownRule: 'zh_catchup_rule' },
  },
  tou: false,
};

const BERN: CantonEntry = {
  code: 'BE',
  name: { en: 'Bern', fr: 'Berne', de: 'Bern' },
  software: 'TaxMe-Online',
  rules: bernRules,
  questionnaire: (taxYear) => (taxYear === 2026 ? beQuestionnaire2026() : undefined),
  keys: (taxYear) => ({ ...KEYS_CANTON_2026, ...bernRules.keys(taxYear) }),
  communes: (taxYear) => bernCommunes(taxYear),
  // Form 4.1 takes cash, gold, vehicles and other valuables together: no note needed.
  ...sharedLedger(BERN_READING, bernRules),
  view: bernView,
  filing: bernFiling,
  terms: BE_TERMS,
  plan: {
    computeReturn: (input) => bernRules.computeReturn(input as HouseholdInput<BernCantonal>),
    incomeTax: (r) => bernView.incomeTax(r as BeTaxResult),
    // The City of Bern, by its BFS number.
    defaultCommune: 351,
    communeName: { en: 'City of Bern', fr: 'Ville de Berne', de: 'Stadt Bern' },
    sources(taxYear) {
      // The documents a Bern household's income tax rests on, for the year.
      const P = beParamsFor(taxYear);
      return [
        P.incomeTariff.married.source,
        P.cantonalRate.source,
        P.communes.source,
        'ch-2026-ifd-progression-deductions p. 2, p. 4',
      ];
    },
    assumptions: { preview: 'be_preview', communeDefault: 'be_commune_default' },
    // Bern's rule for a 3a catch-up from 2026 (be-na-deductions-taxinfo-saeule-3a, chapter 3).
    catchUp: { field: 'pillar3aCatchUp' },
  },
  tou: false,
};

const BASEL_LAND: CantonEntry = {
  code: 'BL',
  name: { en: 'Basel-Landschaft', fr: 'Bâle-Campagne', de: 'Basel-Landschaft' },
  software: 'E-Tax BL',
  rules: baselLandRules,
  questionnaire: (taxYear) => (taxYear === 2026 ? blQuestionnaire2026() : undefined),
  keys: (taxYear) => ({ ...KEYS_CANTON_2026, ...baselLandRules.keys(taxYear) }),
  communes: (taxYear) => baselLandCommunes(taxYear),
  // Page 4 has lines of its own for cash and gold (805) and vehicles (815): say they are together.
  ...sharedLedger(BASEL_LAND_READING, baselLandRules, BL_NOTE_VALUABLES),
  view: baselLandView,
  filing: baselLandFiling,
  terms: BL_TERMS,
  plan: {
    computeReturn: (input) =>
      baselLandRules.computeReturn(input as HouseholdInput<BaselLandCantonal>),
    incomeTax: (r) => baselLandView.incomeTax(r as BlTaxResult),
    // Liestal, the capital, by its name (the canton's table has no BFS numbers).
    defaultCommune: 'Liestal',
    communeName: { en: 'Liestal', fr: 'Liestal', de: 'Liestal' },
    sources(taxYear) {
      // The documents a Basel-Landschaft household's income tax rests on, for the year.
      const P = blParamsFor(taxYear);
      return [
        P.income.source,
        P.multiplier.source,
        P.communes.source,
        'ch-2026-ifd-progression-deductions p. 2, p. 4',
      ];
    },
    assumptions: { preview: 'bl_preview', communeDefault: 'bl_commune_default' },
    // Basel-Landschaft's rule for a 3a catch-up from 2026 (bl-2026-wegleitung p. 31).
    catchUp: { field: 'pillar3aCatchUp' },
  },
  tou: false,
};

const VAUD: CantonEntry = {
  code: 'VD',
  name: { en: 'Vaud', fr: 'Vaud', de: 'Waadt' },
  software: 'VaudTax',
  rules: vaudRules,
  questionnaire: (taxYear) => (taxYear === 2026 ? vdQuestionnaire2026() : undefined),
  keys: (taxYear) => ({ ...KEYS_CANTON_2026, ...vaudRules.keys(taxYear) }),
  communes: (taxYear) => vaudCommunes(taxYear),
  // The return has its own lines for cash and gold (420) and vehicles (430): the note says so.
  ...sharedLedger(VAUD_READING, vaudRules, VAUD_VALUABLES),
  view: vaudView,
  filing: vaudFiling,
  terms: VD_TERMS,
  plan: {
    computeReturn: (input) => vaudRules.computeReturn(input as HouseholdInput<VaudCantonal>),
    incomeTax: (r) => vaudView.incomeTax(r as VdTaxResult),
    // Lausanne, by its slug (the official tables carry no federal number).
    defaultCommune: 'lausanne',
    communeName: { en: 'Lausanne', fr: 'Lausanne', de: 'Lausanne' },
    sources(taxYear) {
      // The documents a Vaud household's income tax rests on, for the year.
      const P = vdParamsFor(taxYear);
      return [
        P.incomeScale.source,
        P.cantonalCoefficient.source,
        P.lrippReductionBp.source,
        P.communes.source,
        'ch-2026-ifd-progression-deductions p. 2, p. 4',
      ];
    },
    assumptions: { preview: 'vd_preview', communeDefault: 'vd_commune_default' },
    // The 3a limits of the federal law, the cantonal law's own (vd-2026-law-li art. 37 al. 1
    // lit. e: "dans les limites autorisées par la loi fédérale"), the catch-up included.
    catchUp: { field: 'pillar3aCatchUp' },
  },
  tou: false,
};

const BASEL: CantonEntry = {
  code: 'BS',
  name: { en: 'Basel-Stadt', fr: 'Bâle-Ville', de: 'Basel-Stadt' },
  // The canton's official software, in the eSteuern.BS portal (bs-2025-efiling-baltax-tipps p. 1).
  software: 'BalTax Online',
  rules: baselRules,
  questionnaire: (taxYear) => (taxYear === 2026 ? bsQuestionnaire2026() : undefined),
  keys: (taxYear) => ({ ...KEYS_CANTON_2026, ...baselRules.keys(taxYear) }),
  communes: (taxYear) => baselCommunes(taxYear),
  // Line 835 takes cash, precious metals and other assets together; a vehicle of daily use is
  // tax-free there, which the shared reading can't tell: the note says so.
  ...sharedLedger(BASEL_READING, baselRules, BASEL_VALUABLES),
  view: baselView,
  filing: baselFiling,
  terms: BS_TERMS,
  plan: {
    computeReturn: (input) => baselRules.computeReturn(input as HouseholdInput<BaselCantonal>),
    incomeTax: (r) => baselView.incomeTax(r as BsTaxResult),
    // The city of Basel, by its name (no document gives Basel-Stadt's federal commune numbers).
    defaultCommune: 'Basel',
    communeName: { en: 'City of Basel', fr: 'Ville de Bâle', de: 'Stadt Basel' },
    sources(taxYear) {
      // The documents a Basel-Stadt household's income tax rests on, for the year.
      const P = bsParamsFor(taxYear);
      return [
        P.income.B.source,
        P.communes.source,
        'ch-2026-ifd-progression-deductions p. 2, p. 4',
      ];
    },
    assumptions: { preview: 'bs_preview', communeDefault: 'bs_commune_default' },
    // Basel-Stadt's rule for a 3a catch-up from 2026 (bs-2026-guide-wegleitung-b p. 34).
    catchUp: { field: 'pillar3aCatchUp' },
  },
  tou: false,
};

const ZUG: CantonEntry = {
  code: 'ZG',
  name: { en: 'Zug', fr: 'Zoug', de: 'Zug' },
  // eTax.zug, the canton's online return, in the browser with an AGOV login (zg-na-efiling-etax-zug).
  software: 'eTax.zug',
  rules: zugRules,
  questionnaire: (taxYear) => (taxYear === 2026 ? zgQuestionnaire2026() : undefined),
  keys: (taxYear) => ({ ...KEYS_CANTON_2026, ...zugRules.keys(taxYear) }),
  communes: (taxYear) => zugCommunes(taxYear),
  // Form K has lines of its own for cash and gold (601) and vehicles (604): say they are together.
  ...sharedLedger(ZUG_READING, zugRules, ZG_NOTE_VALUABLES),
  view: zugView,
  filing: zugFiling,
  terms: ZG_TERMS,
  plan: {
    computeReturn: (input) => zugRules.computeReturn(input as HouseholdInput<ZugCantonal>),
    incomeTax: (r) => zugView.incomeTax(r as ZgTaxResult),
    // The town of Zug, the capital, by its name (the canton's table has no BFS numbers).
    defaultCommune: 'Zug',
    communeName: { en: 'Zug', fr: 'Zoug', de: 'Zug' },
    sources(taxYear) {
      // The documents a Zug household's income tax rests on, for the year.
      const P = zgParamsFor(taxYear);
      return [
        P.income.source,
        P.canton.source,
        P.communes.source,
        'ch-2026-ifd-progression-deductions p. 2, p. 4',
      ];
    },
    assumptions: { preview: 'zg_preview', communeDefault: 'zg_commune_default' },
    // Zug follows the federal rules for pillar 3a (StG § 30 Abs. 1 Bst. e), so the 3a catch-up from
    // 2026 too (zg-2025-guide-wegleitung p. 36, Hinweis: nachträglicher Einkauf in die Säule 3a).
    catchUp: { field: 'pillar3aCatchUp' },
  },
  tou: false,
};

const LUCERNE: CantonEntry = {
  code: 'LU',
  name: { en: 'Lucerne', fr: 'Lucerne', de: 'Luzern' },
  // eSteuern.LU, the canton's online return, in the browser with your own eSteuern account and the
  // PersID and Zugangscode eFiling printed on your return (lu-2025-efiling-merkblatt-esteuern).
  software: 'eSteuern.LU',
  rules: lucerneRules,
  questionnaire: (taxYear) => (taxYear === 2026 ? luQuestionnaire2026() : undefined),
  keys: (taxYear) => ({ ...KEYS_CANTON_2026, ...lucerneRules.keys(taxYear) }),
  communes: (taxYear) => lucerneCommunes(taxYear),
  // Page 4 has lines of its own for cash and gold (404) and vehicles (412): say they are together.
  ...sharedLedger(LUCERNE_READING, lucerneRules, LU_NOTE_VALUABLES),
  view: lucerneView,
  filing: lucerneFiling,
  terms: LU_TERMS,
  plan: {
    computeReturn: (input) => lucerneRules.computeReturn(input as HouseholdInput<LucerneCantonal>),
    incomeTax: (r) => lucerneView.incomeTax(r as LuTaxResult),
    // The city of Lucerne, the capital, by its name (the canton's table has no BFS numbers).
    defaultCommune: 'Luzern',
    communeName: { en: 'City of Lucerne', fr: 'Ville de Lucerne', de: 'Stadt Luzern' },
    sources(taxYear) {
      // The documents a Lucerne household's income tax rests on, for the year.
      const P = luParamsFor(taxYear);
      return [
        ...new Set([P.incomeTariff.single.source, P.incomeTariff.family.source]),
        P.stateUnits.source,
        P.communes.source,
        'ch-2026-ifd-progression-deductions p. 2, p. 4',
      ];
    },
    assumptions: { preview: 'lu_preview', communeDefault: 'lu_commune_default' },
    // No Lucerne document Taxpresso has gives the cantonal rule of a 3a catch-up (rules-lu fails
    // closed, NOTE.catchUp): no saving is shown.
    catchUp: { field: 'pillar3a', unknownRule: 'lu_catchup_rule' },
  },
  tou: false,
};

const ST_GALLEN: CantonEntry = {
  code: 'SG',
  name: { en: 'St. Gallen', fr: 'Saint-Gall', de: 'St. Gallen' },
  // E-Tax SG, the canton's online return, in the browser with the cantonal E-Login on AGOV
  // (sg-na-efiling-etax-sg; sg-2025-efiling-faltblatt-etax).
  software: 'E-Tax SG',
  rules: stGallenRules,
  questionnaire: (taxYear) => (taxYear === 2026 ? sgQuestionnaire2026() : undefined),
  keys: (taxYear) => ({ ...KEYS_CANTON_2026, ...stGallenRules.keys(taxYear) }),
  communes: (taxYear) => stGallenCommunes(taxYear),
  // The return has lines of its own for cash and gold (30.2) and vehicles (30.4): say they are
  // together.
  ...sharedLedger(ST_GALLEN_READING, stGallenRules, SG_NOTE_VALUABLES),
  view: stGallenView,
  filing: stGallenFiling,
  terms: SG_TERMS,
  plan: {
    computeReturn: (input) =>
      stGallenRules.computeReturn(input as HouseholdInput<StGallenCantonal>),
    incomeTax: (r) => stGallenView.incomeTax(r as SgTaxResult),
    // The city of St. Gallen, the capital, by its name (the canton's table has no BFS numbers).
    defaultCommune: 'St. Gallen',
    communeName: { en: 'City of St. Gallen', fr: 'Ville de Saint-Gall', de: 'Stadt St. Gallen' },
    sources(taxYear) {
      // The documents a St. Gallen household's income tax rests on, for the year.
      const P = sgParamsFor(taxYear);
      return [
        P.income.source,
        P.multiplier.source,
        P.communes.source,
        'ch-2026-ifd-progression-deductions p. 2, p. 4',
      ];
    },
    assumptions: { preview: 'sg_preview', communeDefault: 'sg_commune_default' },
    // St. Gallen follows the federal limits for pillar 3a (StG Art. 45 Abs. 1 lit. e), and its
    // catch-up is deductible from the 2026 return (sg-2026-guide-merkblatt-unterjaehrig p. 4, 13.1
    // Nachträgliche Einkäufe Säule 3a).
    catchUp: { field: 'pillar3aCatchUp' },
  },
  tou: false,
};

const FRIBOURG: CantonEntry = {
  code: 'FR',
  name: { en: 'Fribourg', fr: 'Fribourg', de: 'Freiburg' },
  // FriTax, the SCC's free program installed on the computer, the only one that files
  // electronically (fr-2025-fritax-accueil; fr-na-efiling-ordonnance-631-15 art. 2 al. 2). A desktop
  // program: no browser filling, the copy panel is the way (@taxpresso/filing-fr).
  software: 'FriTax',
  rules: fribourgRules,
  questionnaire: (taxYear) => (taxYear === 2026 ? frQuestionnaire2026() : undefined),
  keys: (taxYear) => ({ ...KEYS_CANTON_2026, ...fribourgRules.keys(taxYear) }),
  communes: (taxYear) => fribourgCommunes(taxYear),
  // The return has codes of its own for cash and gold (3.230) and vehicles (3.510): say they are
  // together.
  ...sharedLedger(FRIBOURG_READING, fribourgRules, FR_NOTE_VALUABLES),
  view: fribourgView,
  filing: fribourgFiling,
  terms: FR_TERMS,
  plan: {
    computeReturn: (input) =>
      fribourgRules.computeReturn(input as HouseholdInput<FribourgCantonal>),
    incomeTax: (r) => fribourgView.incomeTax(r as FrTaxResult),
    // The city of Fribourg, the capital, by its BFS number.
    defaultCommune: 2196,
    communeName: { en: 'City of Fribourg', fr: 'Ville de Fribourg', de: 'Stadt Freiburg' },
    sources(taxYear) {
      // The documents a Fribourg household's income tax rests on, for the year.
      const P = frParamsFor(taxYear);
      return [
        P.incomeScale.source,
        P.coefficients.source,
        P.communes.source,
        'ch-2026-ifd-progression-deductions p. 2, p. 4',
      ];
    },
    assumptions: { preview: 'fr_preview', communeDefault: 'fr_commune_default' },
    // The LICD adopts the federal 3a limits (art. 34 al. 1 let. e), the catch-up included
    // (packages/rules-fr computes it from 2026).
    catchUp: { field: 'pillar3aCatchUp' },
    // Tax year 2026: no communal coefficients published yet, so no tax and no saving (fail closed).
    noTax: { years: [2026], assumption: 'fr_no_tax' },
    noTaxText: FR_NOTE.communes2026,
  },
  tou: false,
};

export const CANTONS: Readonly<Record<SupportedCanton, CantonEntry>> = {
  GE: GENEVA,
  ZH: ZURICH,
  BE: BERN,
  BL: BASEL_LAND,
  VD: VAUD,
  BS: BASEL,
  ZG: ZUG,
  LU: LUCERNE,
  SG: ST_GALLEN,
  FR: FRIBOURG,
};

/**
 * Canton names in words, the last one joined by "and" or "or", in the registry's order: "Zurich,
 * Bern and Basel-Landschaft". For the texts that list the cantons, so a new canton needs no text.
 */
export function cantonNames(
  codes: readonly SupportedCanton[],
  join: 'and' | 'or',
  lang: 'en' | 'fr' | 'de' = 'en',
): string {
  const names = codes.map((c) => CANTONS[c].name[lang]);
  const word = {
    and: { en: 'and', fr: 'et', de: 'und' },
    or: { en: 'or', fr: 'ou', de: 'oder' },
  }[join][lang];
  return names.length > 1
    ? `${names.slice(0, -1).join(', ')} ${word} ${names.at(-1)}`
    : names.join('');
}

/** The cantons Taxpresso prepares in full (Geneva) and those it prepares as a preview. */
export const fullCantons = (): SupportedCanton[] =>
  SUPPORTED_CANTONS.filter((c) => !CANTONS[c].view.preview);
export const previewCantons = (): SupportedCanton[] =>
  SUPPORTED_CANTONS.filter((c) => CANTONS[c].view.preview);
/** The cantons whose official form is in German (the questions and the estimate in German too). */
export const germanCantons = (): SupportedCanton[] =>
  SUPPORTED_CANTONS.filter((c) => CANTONS[c].view.german);

/** The canton of the year being prepared, and how Taxpresso knows it. */
export interface CantonState {
  /** undefined: not answered yet. 'other': a canton Taxpresso doesn't cover yet. */
  answer: CantonAnswer | undefined;
  /** The canton whose return this is, when Taxpresso covers it. */
  canton: CantonEntry | undefined;
  /** answer: the user said so. earlier_answers: taken from answers only this canton asks. */
  from: 'answer' | 'earlier_answers' | 'none';
  /** With earlier_answers: which answers, in words. */
  because: Text[];
}

/** The questionnaire engines, one per canton and one for the questions every canton shares. */
export class CantonRegistry {
  readonly taxYear: number;
  readonly #engines = new Map<string, QuestionnaireEngine>();
  /** Every key any canton of the year knows: what the ledger accepts (one year, one ledger). */
  readonly ledgerKeys: KeyRegistry;

  constructor(taxYear: number) {
    this.taxYear = taxYear;
    this.ledgerKeys = mergeKeys([
      KEYS_CANTON_2026,
      ...SUPPORTED_CANTONS.map((c) => CANTONS[c].keys(taxYear)),
    ]);
  }

  /** What the canton of the ledger's year is, from the answer or, before it, the other answers. */
  state(ledger: Ledger): CantonState {
    const answer = stated(ledger, 'profile.canton');
    if (isSupportedCanton(answer)) {
      return { answer, canton: CANTONS[answer], from: 'answer', because: [] };
    }
    if (answer === 'other') return { answer, canton: undefined, from: 'answer', because: [] };
    for (const code of SUPPORTED_CANTONS) {
      const because = CANTONS[code].inferFrom?.(ledger) ?? [];
      if (because.length) {
        return { answer: code, canton: CANTONS[code], from: 'earlier_answers', because };
      }
    }
    return { answer: undefined, canton: undefined, from: 'none', because: [] };
  }

  /** The keys of a canton's return; before the canton is known, the shared ones. */
  keys(canton: CantonEntry | undefined): KeyRegistry {
    return canton ? canton.keys(this.taxYear) : this.ledgerKeys;
  }

  /** The questionnaire of a canton; its own once it has one, else the questions every canton shares. */
  engine(canton: CantonEntry | undefined): QuestionnaireEngine {
    const file = canton?.questionnaire(this.taxYear);
    const id = file && canton ? canton.code : 'shared';
    let engine = this.#engines.get(id);
    if (!engine) {
      engine =
        file && canton
          ? new QuestionnaireEngine(file, canton.keys(this.taxYear), canton.communes(this.taxYear))
          : // The shared questions read the shared keys: a canton may offer more values (Bern's
            // payments to political parties), which the shared question doesn't ask about.
            new QuestionnaireEngine(
              sharedQuestionnaire2026(),
              { ...this.ledgerKeys, ...KEYS_HOUSEHOLD_2026 },
              [],
            );
      this.#engines.set(id, engine);
    }
    return engine;
  }
}

/**
 * The keys of several registries together. A key two cantons both define must be the same key,
 * except for the values of a choice (each canton's communes), which are joined.
 */
export function mergeKeys(registries: readonly KeyRegistry[]): KeyRegistry {
  const out: Record<string, KeyRegistry[string]> = {};
  for (const reg of registries) {
    for (const [key, def] of Object.entries(reg)) {
      const had = out[key];
      if (!had) {
        out[key] = def;
        continue;
      }
      if (had === def) continue;
      if (
        had.type !== def.type ||
        had.perPerson !== def.perPerson ||
        Boolean(had.multiple) !== Boolean(def.multiple)
      ) {
        throw new Error(`Key ${key} differs between cantons: ${had.type} and ${def.type}`);
      }
      if (had.values || def.values) {
        out[key] = { ...had, values: [...new Set([...(had.values ?? []), ...(def.values ?? [])])] };
      }
    }
  }
  return out;
}
