// Adaptive questions as data, per tax year (SPEC.md section 6): the questions every canton shares
// (data/ch/<year>/questions.yaml) and each canton's questionnaire, which takes them in its order.
// The *.yaml module type must reach every package that imports this one, hence a reference.
// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="./yaml.d.ts" />
import ag2026 from '../../../data/ag/2026/questionnaire.yaml';
import be2026 from '../../../data/be/2026/questionnaire.yaml';
import bl2026 from '../../../data/bl/2026/questionnaire.yaml';
import bs2026 from '../../../data/bs/2026/questionnaire.yaml';
import ch2026 from '../../../data/ch/2026/questions.yaml';
import fr2026 from '../../../data/fr/2026/questionnaire.yaml';
import ge2026 from '../../../data/ge/2026/questionnaire.yaml';
import lu2026 from '../../../data/lu/2026/questionnaire.yaml';
import sg2026 from '../../../data/sg/2026/questionnaire.yaml';
import ti2026 from '../../../data/ti/2026/questionnaire.yaml';
import vd2026 from '../../../data/vd/2026/questionnaire.yaml';
import zg2026 from '../../../data/zg/2026/questionnaire.yaml';
import zh2026 from '../../../data/zh/2026/questionnaire.yaml';
import { parseQuestionnaire, servedYears, type QuestionnaireFile } from './schema.js';

export * from './engine.js';
export * from './schema.js';

/**
 * The questions every canton asks, validated for one tax year: what Taxpresso asks before it knows
 * the canton, starting with the canton itself. `offered`: the cantons Taxpresso prepares for that
 * year; the canton question says the others aren't available for it.
 */
export function sharedQuestionnaire(
  taxYear: number,
  offered?: readonly string[],
): QuestionnaireFile {
  return parseQuestionnaire(ch2026, undefined, { taxYear, ...(offered ? { offered } : {}) });
}

/** The tax years the shared questions serve (data/ch/2026/questions.yaml, taxYears). */
export const SHARED_QUESTIONNAIRE_YEARS: readonly number[] = servedYears(ch2026);

/** The questions every canton asks, tax year 2026, validated. */
export function sharedQuestionnaire2026(): QuestionnaireFile {
  return sharedQuestionnaire(2026);
}

/**
 * The Geneva questionnaire for one tax year, validated: one file for every year it serves
 * (data/ge/2026/questionnaire.yaml, taxYears), its texts naming the year and citing its documents.
 */
export function geQuestionnaire(taxYear: number): QuestionnaireFile {
  return parseQuestionnaire(ge2026, ch2026, { taxYear });
}

/** The tax years the Geneva questionnaire serves. */
export const GE_QUESTIONNAIRE_YEARS: readonly number[] = servedYears(ge2026, ch2026);

/** The Geneva questionnaire for tax year 2026, validated. */
export function geQuestionnaire2026(): QuestionnaireFile {
  return geQuestionnaire(2026);
}

/** The Zurich questionnaire for tax year 2026, validated. */
export function zhQuestionnaire2026(): QuestionnaireFile {
  return parseQuestionnaire(zh2026, ch2026);
}

/** The Bern questionnaire for tax year 2026, validated. */
export function beQuestionnaire2026(): QuestionnaireFile {
  return parseQuestionnaire(be2026, ch2026);
}

/** The Basel-Landschaft questionnaire for tax year 2026, validated. */
export function blQuestionnaire2026(): QuestionnaireFile {
  return parseQuestionnaire(bl2026, ch2026);
}

/**
 * The Vaud questionnaire for tax year 2026, validated. Its wording follows the 2025 guide: the 2026
 * guide and form are not published yet (data/vd/2026/questionnaire.yaml).
 */
export function vdQuestionnaire2026(): QuestionnaireFile {
  return parseQuestionnaire(vd2026, ch2026);
}

/** The Basel-Stadt questionnaire for tax year 2026, validated. */
export function bsQuestionnaire2026(): QuestionnaireFile {
  return parseQuestionnaire(bs2026, ch2026);
}

/** The Zug questionnaire for tax year 2026, validated. */
export function zgQuestionnaire2026(): QuestionnaireFile {
  return parseQuestionnaire(zg2026, ch2026);
}

/**
 * The Lucerne questionnaire for tax year 2026, validated. Its wording follows the 2025 guide: the
 * regular 2026 guide is not published yet (data/lu/2026/questionnaire.yaml).
 */
export function luQuestionnaire2026(): QuestionnaireFile {
  return parseQuestionnaire(lu2026, ch2026);
}

/**
 * The St. Gallen questionnaire for tax year 2026, validated. Its wording follows the 2025 guide: the
 * 2026 guide and forms are not published yet (data/sg/2026/questionnaire.yaml).
 */
export function sgQuestionnaire2026(): QuestionnaireFile {
  return parseQuestionnaire(sg2026, ch2026);
}

/**
 * The Fribourg questionnaire for tax year 2026, validated. Its wording follows the 2025 guide: the
 * 2026 guide is not published yet (data/fr/2026/questionnaire.yaml).
 */
export function frQuestionnaire2026(): QuestionnaireFile {
  return parseQuestionnaire(fr2026, ch2026);
}

/**
 * The Ticino questionnaire for tax year 2026, validated. Its wording follows the 2025 instructions:
 * the 2026 instructions and forms are not published yet (data/ti/2026/questionnaire.yaml).
 */
export function tiQuestionnaire2026(): QuestionnaireFile {
  return parseQuestionnaire(ti2026, ch2026);
}

/**
 * The Aargau questionnaire for tax year 2026, validated. Its wording follows the 2025 guide: the
 * 2026 guide is not published yet (data/ag/2026/questionnaire.yaml).
 */
export function agQuestionnaire2026(): QuestionnaireFile {
  return parseQuestionnaire(ag2026, ch2026);
}
