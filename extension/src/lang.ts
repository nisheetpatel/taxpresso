// The dashboard's languages (config.ts, UI_LANGUAGES): English, French and German. The questions,
// the canton names, the document kinds and Zurich's estimate have German texts; the other views
// have English and French content only for now, so a German page shows them in English
// (contentLang). The page's own words are German throughout (ui/src/dashboard/i18n*.ts).
import { say, type Lang as UiLang } from '@taxpresso/questionnaire';

export { say, type UiLang };

/** The languages most views' content is written in. */
export type ContentLang = 'en' | 'fr';

/** The content language for a page language: German pages read English content for now. */
export const contentLang = (lang: UiLang): ContentLang => (lang === 'de' ? 'en' : lang);
