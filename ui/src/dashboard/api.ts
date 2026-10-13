// Every request of the dashboard, whatever carries it: HTTP on 127.0.0.1 in the browser, or the
// host's tool calls when the dashboard runs inside the conversation (./transport.ts).
import type { Language } from './i18n';
import { ApiError, type ApiRequest, type Transport } from './transport';
import type { Question, State, Value } from './types';
import type { PlanningField } from './types-planning';

export { ApiError };

let transport: Transport | undefined;
let csrf = '';

/** How this page reaches the extension: set once at start (main.tsx, or the MCP Apps view). */
/** Whether the dashboard runs inside the conversation rather than in the browser. */
export const embedded = (): boolean => transport?.embedded === true;

export function setTransport(next: Transport): void {
  transport = next;
}

async function call<T>(req: Omit<ApiRequest, 'csrf'>): Promise<T> {
  if (!transport) throw new ApiError('The dashboard has no connection to Taxpresso.');
  return (await transport.send(req.method === 'POST' ? { ...req, csrf } : req)) as T;
}

async function post(path: string, lang: Language, body: Record<string, unknown>): Promise<State> {
  return remember(await call<State>({ method: 'POST', path, query: { lang }, body }));
}

function remember(state: State): State {
  csrf = state.csrf;
  return state;
}

export const api = {
  /** Without a language, the server answers in the one set at install. */
  state: async (lang?: Language) =>
    remember(await call<State>({ method: 'GET', path: '/state', query: lang ? { lang } : {} })),
  question: (id: string, lang: Language) =>
    call<Question>({ method: 'GET', path: '/question', query: { id, lang } }),
  answer: (id: string, value: Value, lang: Language) => post('/answer', lang, { id, value }),
  skip: (id: string, lang: Language) => post('/skip', lang, { id }),
  waive: (id: string, waived: boolean, lang: Language) => post('/waive', lang, { id, waived }),
  scan: (lang: Language) => post('/scan', lang, {}),
  plan: (
    person: string,
    field: 'gross' | 'net' | 'pensionFund' | 'paid',
    value: number | boolean,
    lang: Language,
  ) => post('/plan', lang, { person, field, value }),
  // Pension fund buy-in, 3a catch-up and TOU (extension/src/planning.ts).
  planning: (
    person: string,
    field: PlanningField,
    value: number | boolean | string,
    lang: Language,
  ) => post('/planning', lang, { person, field, value }),
  decide: (choice: 'request' | 'decline', confirmed: boolean, lang: Language) =>
    post('/decide', lang, { id: 'tou', choice, confirmed }),
  setKind: (id: string, kind: string, person: string | undefined, lang: Language) =>
    post('/documents/kind', lang, { id, kind, ...(person ? { person } : {}) }),
  upload: async (
    file: File,
    lang: Language,
    preset?: { kind: string; person?: string },
    /** The document this file replaces, if any. */
    replace?: string,
  ) => {
    const query: Record<string, string> = { lang };
    if (preset) {
      query.kind = preset.kind;
      if (preset.person) query.person = preset.person;
    }
    if (replace) query.replace = replace;
    return remember(await call<State>({ method: 'POST', path: '/documents', query, file }));
  },
  // Values read from documents (SPEC.md 5.5), checks (5.8) and the "Entered" ticks (10.5).
  confirmFact: (id: string, lang: Language) => post('/facts/confirm', lang, { id }),
  editFact: (id: string, value: string | boolean, lang: Language) =>
    post('/facts/edit', lang, { id, value }),
  setEntered: (id: string, entered: boolean, lang: Language) =>
    post('/facts/entered', lang, { id, entered }),
  /** A copy panel row ticked as entered (SPEC.md 10.5); kept on this computer. */
  setFormEntered: (id: string, entered: boolean, lang: Language) =>
    post('/form/entered', lang, { id, entered }),
  confirmDocument: (id: string, lang: Language) => post('/documents/confirm', lang, { id }),
  replaceDocument: (id: string, by: string, lang: Language) =>
    post('/documents/replace', lang, { id, by }),
  resolveCheck: (id: string, note: string, lang: Language) =>
    post('/checks/resolve', lang, { id, note }),
  /** One ZIP of the tax-year folder, saved in the Taxpresso folder on this computer. */
  exportFolder: (lang: Language) => post('/export', lang, {}),
  // "Your securities and accounts": a security's official value, and whose a line is.
  holdingOfficial: (id: string, value: string, from: string, lang: Language) =>
    post('/holdings/official', lang, { id, value, from }),
  holdingOwner: (id: string, origin: string, owner: string, lang: Language) =>
    post('/holdings/owner', lang, { id, origin, owner }),
};
