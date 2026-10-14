// The dashboard's languages (config.ts, UI_LANGUAGES): English, French, German and Italian. The
// questions, the canton names and the document kinds have German and Italian texts; the estimate of
// a canton with a German form (Zurich, Bern, Basel-Landschaft, Basel-Stadt, Zug, Lucerne, St.
// Gallen, and bilingual Fribourg: its result view's `german`) has German texts, Ticino's (`italian`)
// Italian ones. The other views have English and French content only for now, so a German or
// Italian page shows them in English (contentLang).
// The page's own words are German and Italian throughout (ui/src/dashboard/i18n*.ts).
import { say, type Lang as UiLang } from '@taxpresso/questionnaire';

export { say, type UiLang };

/** The languages most views' content is written in. */
export type ContentLang = 'en' | 'fr';

/** The content language for a page language: German and Italian pages read English content for now. */
export const contentLang = (lang: UiLang): ContentLang =>
  lang === 'de' || lang === 'it' ? 'en' : lang;
