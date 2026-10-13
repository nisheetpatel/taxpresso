// Adaptive questions as data, per tax year (SPEC.md section 6).
// The *.yaml module type must reach every package that imports this one, hence a reference.
// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="./yaml.d.ts" />
import ge2026 from '../../../data/ge/2026/questionnaire.yaml';
import { parseQuestionnaire, type QuestionnaireFile } from './schema.js';

export * from './engine.js';
export * from './schema.js';

/** The Geneva questionnaire for tax year 2026, validated. */
export function geQuestionnaire2026(): QuestionnaireFile {
  return parseQuestionnaire(ge2026);
}
