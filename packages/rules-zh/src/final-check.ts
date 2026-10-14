// The words the final check (SPEC.md 10.0) uses for a Zurich return: what was given for each line
// with a limit, by the rule that set it (LimitApplied.rule), the names of the two taxes, and where
// to go for what Taxpresso can't prepare. Terms as printed on the Zurich return
// (zh-2025-form-steuererklaerung-hauptformular p. 3) and in its guide
// (zh-2025-guide-natuerliche-personen p. 13 and 14). The check itself is canton-neutral
// (@taxpresso/rules-ge, finalCheck); the extension hands it these.
import { rubric } from './rubrics.js';
import { ZH_OFFICIAL_DOCUMENTS } from './official-documents.js';
import type { Text } from './types.js';

const NB = ' ';

/** The gloss in English and French with the German term, and the German term alone. */
const g = (en: string, fr: string, de: string): Text => ({
  en: `${en} (${de})`,
  fr: `${fr} (${de})`,
  de,
});

const GIVEN: Readonly<Record<string, Text>> = {
  commute: g('Travel costs', 'Frais de déplacement', 'Fahrkosten'),
  meals: g(
    'Meals away from home',
    'Repas hors du domicile',
    'Mehrkosten für auswärtige Verpflegung',
  ),
  'professional.other': g(
    'Your actual other professional costs',
    'Vos autres frais professionnels effectifs',
    'übrige Berufsauslagen',
  ),
  pillar3a: g('Paid into pillar 3a', 'Versé au 3e pilier A', 'Beiträge an die 3. Säule a'),
  training: g('Training paid', 'Frais de formation payés', 'Aus- und Weiterbildungskosten'),
  debt_interest: g('Interest on private debts', 'Intérêts de dettes privées', 'Schuldzinsen'),
  insurance: g(
    'Insurance premiums and savings interest',
    'Primes d’assurances et intérêts d’épargne',
    'Versicherungsprämien, Zinsen von Sparkapitalien',
  ),
  party: g(
    'Paid to political parties',
    'Versé aux partis politiques',
    'Beiträge an politische Parteien',
  ),
  childcare: g('Childcare paid', 'Frais de garde payés', 'fremdbetreute Kinder'),
  medical: g('Medical costs', 'Frais médicaux', 'Krankheits- und Unfallkosten'),
  donations: g('Donations', 'Dons', 'Gemeinnützige Zuwendungen'),
};

export const ZH_FINAL_CHECK = {
  label: (code: string): Text | undefined => rubric(code)?.label,
  given: (l: { rule?: string }): Text | undefined => (l.rule ? GIVEN[l.rule] : undefined),
  /** The two taxes keep their own limits unless a rule applied alike: always say which tax. */
  inBothTaxes: (): boolean => true,
  taxes: {
    icc: g('cantonal tax', 'impôt cantonal', 'Staatssteuer'),
    ifd: g('federal tax', 'impôt fédéral', 'Bundessteuer'),
    both: g('cantonal and federal tax', 'impôts cantonal et fédéral', 'Staats- und Bundessteuer'),
  },
  notSupported: {
    en: 'Taxpresso can’t prepare this part. ZHprivateTax, the canton’s free software, or a fiduciary can.',
    fr: 'Taxpresso ne peut pas préparer cette partie. ZHprivateTax, le logiciel gratuit du canton, ou une fiduciaire le peuvent.',
    de: 'Taxpresso kann diesen Teil nicht vorbereiten. ZHprivateTax, die kostenlose Software des Kantons, oder ein Treuhandbüro können das.',
  } satisfies Text,
  limitEstimate: {
    en: ' This limit is an estimate until its amount for the year is published.',
    fr: ` Cette limite est une estimation jusqu’à la publication de son montant pour l’année.`,
    de: ' Diese Grenze ist geschätzt, bis ihr Betrag für das Jahr veröffentlicht ist.',
  } satisfies Text,
  /** The official Zurich documents, for the links of each rule cited. */
  documents: ZH_OFFICIAL_DOCUMENTS,
} as const;

/** The form's codes and terms are the 2025 form's until the 2026 one is published. */
export const ZH_FORM_NOTE: Text = {
  en: 'The line codes and German terms come from the 2025 Zurich return (zh-2025-form-steuererklaerung-hauptformular): the full-year 2026 form is not published yet. The 2026 forms published so far carry the same codes.',
  fr: `Les codes et les termes allemands viennent de la déclaration zurichoise 2025 (zh-2025-form-steuererklaerung-hauptformular)${NB}: le formulaire 2026 pour l’année entière n’est pas encore publié. Les formulaires 2026 publiés à ce jour portent les mêmes codes.`,
  de: 'Die Ziffern und Begriffe stammen aus der Zürcher Steuererklärung 2025 (zh-2025-form-steuererklaerung-hauptformular): Das Formular 2026 für das ganze Jahr ist noch nicht veröffentlicht. Die bisher veröffentlichten Formulare 2026 haben dieselben Ziffern.',
};
