// The declaration for tax year 2026, filed from January 2027. Its official form and guide are
// published in January 2027 (SPEC.md section 7); until then this is the 2025 form, flagged
// provisional everywhere it is shown. When the 2026 specimen and guide are in docs/sources, write
// the 2026 map from them, cite them, and set provisional to false: every code and label re-opens.
import { FORM_PAGES_2025, FORM_RUBRICS_2025 } from '../2025/form-map.js';
import type { FormMap } from '../form.js';

export const FORM_2026: FormMap = {
  taxYear: 2026,
  formYear: 2025,
  provisional: true,
  note: {
    en: 'Codes and labels from the 2025 form. The 2026 form is published in January 2027; check each code on it.',
    fr: 'Codes et libellés du formulaire 2025. Celui de 2026 paraît en janvier 2027 : vérifiez chaque code sur le vôtre.',
  },
  pages: FORM_PAGES_2025,
  rubrics: FORM_RUBRICS_2025,
};
