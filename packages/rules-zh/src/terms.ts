// The official terms of the Zurich return that the generic texts need (packages/rules-ch,
// terms.ts): what was given for each line with a limit, by the rule that set it
// (LimitApplied.rule), the names of the two taxes, the tax office and asking for more time, the
// plans' words, and the official documents each rule links to. Terms as printed on the Zurich
// return (zh-2025-form-steuererklaerung-hauptformular p. 3) and in its guide
// (zh-2025-guide-natuerliche-personen p. 13 and 14). The extension builds the final check's words
// from them, with the canton's name and software from its registry.
import type { CantonTerms } from '@taxpresso/rules-ch';
import { rubric } from './rubrics.js';
import { ZH_OFFICIAL_DOCUMENTS } from './official-documents.js';
import type { Text } from './types.js';

const NB = ' ';

export const ZH_TERMS: CantonTerms = {
  label: (code) => rubric(code)?.label,
  given: {
    commute: 'Fahrkosten',
    meals: 'Mehrkosten für auswärtige Verpflegung',
    'professional.other': 'übrige Berufsauslagen',
    pillar3a: 'Beiträge an die 3. Säule a',
    training: 'Aus- und Weiterbildungskosten',
    debt_interest: 'Schuldzinsen',
    insurance: 'Versicherungsprämien, Zinsen von Sparkapitalien',
    party: 'Beiträge an politische Parteien',
    childcare: 'fremdbetreute Kinder',
    medical: 'Krankheits- und Unfallkosten',
    donations: 'Gemeinnützige Zuwendungen',
  },
  taxes: { icc: 'Staatssteuer', ifd: 'Bundessteuer', both: 'Staats- und Bundessteuer' },
  salaryCertificate: 'Lohnausweis',
  taxOffice: 'kantonales Steueramt',
  moreTime: 'Fristerstreckung',
  // Filing, deadlines and more time (docs/sources/zh/manifest.json).
  moreTimeSource: 'zh-na-efiling-steuererklaerung-privatpersonen',
  securitiesList: 'Wertschriftenverzeichnis',
  priceList: 'Kursliste',
  pillar3a: 'Säule 3a',
  pensionBuyIn: 'Einkauf in die Pensionskasse',
  pillar3aCatchUp: 'Einkauf in die Säule 3a',
  sourceTax: 'Quellensteuer',
  sourceTaxAssessment: 'NOV (nachträgliche ordentliche Veranlagung)',
  /** The official Zurich documents, for the links of each rule cited. */
  documents: ZH_OFFICIAL_DOCUMENTS,
};

/** The form's codes and terms are the 2025 form's until the 2026 one is published. */
export const ZH_FORM_NOTE: Text = {
  en: 'The line codes and German terms come from the 2025 Zurich return (zh-2025-form-steuererklaerung-hauptformular): the full-year 2026 form is not published yet. The 2026 forms published so far carry the same codes.',
  fr: `Les codes et les termes allemands viennent de la déclaration zurichoise 2025 (zh-2025-form-steuererklaerung-hauptformular)${NB}: le formulaire 2026 pour l’année entière n’est pas encore publié. Les formulaires 2026 publiés à ce jour portent les mêmes codes.`,
  de: 'Die Ziffern und Begriffe stammen aus der Zürcher Steuererklärung 2025 (zh-2025-form-steuererklaerung-hauptformular): Das Formular 2026 für das ganze Jahr ist noch nicht veröffentlicht. Die bisher veröffentlichten Formulare 2026 haben dieselben Ziffern.',
};
