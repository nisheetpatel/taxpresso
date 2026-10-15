// What every page of the dashboard gets (three-pages.md): the state, its three-pages view, the
// language, and how to change things. Pages are plain functions of these props; what is open on
// the page (a disclosure that isn't native, a question opened by a chip) is kept by the App as
// flags, so a page renders the same for the same props, in a test as on screen.
import type { Language } from './i18n';
import type { PageId, PagesFields } from './state-adapter';
import type { State } from './types';

/** Runs a change, shows its error if any, takes the fresh state it returns. */
export type Act = (fn: () => Promise<State>, label?: string) => Promise<boolean>;

export interface PageProps {
  state: State;
  pages: PagesFields;
  lang: Language;
  /** A change is under way. */
  busy: boolean;
  /** Inside Claude Desktop (the MCP Apps view): documents go to the folder, never through here. */
  embedded: boolean;
  act: Act;
  /** What is open on the page. */
  flags: ReadonlySet<string>;
  setFlag: (flag: string, on: boolean) => void;
  /** Opens a page (the tabs, a link such as "See how to pay less"). */
  go: (page: PageId) => void;
  /** Opens the basics card. */
  openBasics: () => void;
  /** Adds documents: the folder in Finder or Explorer inside Claude Desktop, else a file picker. */
  add: (preset?: { kind: string; person?: string }) => void;
  /** The rough tax this year's figures replaced, when they did (centimes), for "CHF 660 less". */
  roughBefore: number | null;
}
