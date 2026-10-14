// Geneva's cited constants as the engine reads them: the shared Param (packages/rules-ch,
// core/cited.ts) with the reasons a Geneva value can be an estimate (SPEC.md section 9).
import { estimated as flag, type Cited, type Param as CitedParam } from '@taxpresso/rules-ch';

/** Why a constant is an estimate. Each reason has its plain-words text in ./explain.ts. */
export type EstimateReason = 'ge-2026-unpublished';

export type Param<T> = CitedParam<T, EstimateReason>;

/** The same cited value, flagged as an estimate for a later year. */
export function estimated<T>(param: Cited<T>, reason: EstimateReason): Param<T> {
  return flag(param, reason);
}

export type { BracketScale, FederalStep } from '@taxpresso/rules-ch';
