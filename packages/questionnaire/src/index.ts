// Adaptive questions as data, per tax year (SPEC.md section 6): the questions every canton shares
// (data/ch/<year>/questions.yaml) and each canton's questionnaire, which takes them in its order.
// The *.yaml module type must reach every package that imports this one, hence a reference.
// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="./yaml.d.ts" />
import be2026 from '../../../data/be/2026/questionnaire.yaml';
import bl2026 from '../../../data/bl/2026/questionnaire.yaml';
import bs2026 from '../../../data/bs/2026/questionnaire.yaml';
import ch2026 from '../../../data/ch/2026/questions.yaml';
import ge2026 from '../../../data/ge/2026/questionnaire.yaml';
import lu2026 from '../../../data/lu/2026/questionnaire.yaml';
import vd2026 from '../../../data/vd/2026/questionnaire.yaml';
import zg2026 from '../../../data/zg/2026/questionnaire.yaml';
import zh2026 from '../../../data/zh/2026/questionnaire.yaml';
import { parseQuestionnaire, type QuestionnaireFile } from './schema.js';

export * from './engine.js';
export * from './schema.js';

/**
 * The questions every canton asks, tax year 2026, validated: what Taxpresso asks before it knows
 * the canton, starting with the canton itself.
 */
export function sharedQuestionnaire2026(): QuestionnaireFile {
  return parseQuestionnaire(ch2026);
}

/** The Geneva questionnaire for tax year 2026, validated. */
export function geQuestionnaire2026(): QuestionnaireFile {
  return parseQuestionnaire(ge2026, ch2026);
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
