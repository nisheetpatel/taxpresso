// Talks to the extension on 127.0.0.1 only (same origin; the page's CSP allows nothing else).
import type { Language } from './i18n';
import type { Question, State, Value } from './types';

export class ApiError extends Error {}

let csrf = '';

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(path, {
    ...init,
    cache: 'no-store',
    credentials: 'same-origin',
    headers: { ...(init.method === 'POST' ? { 'X-Taxpresso-CSRF': csrf } : {}), ...init.headers },
  });
  const body = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new ApiError(body.error ?? `HTTP ${res.status}`);
  return body;
}

async function post(path: string, lang: Language, body: unknown): Promise<State> {
  return remember(
    await call<State>(`/api${path}?lang=${lang}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );
}

function remember(state: State): State {
  csrf = state.csrf;
  return state;
}

export const api = {
  /** Without a language, the server answers in the one set at install. */
  state: async (lang?: Language) =>
    remember(await call<State>(`/api/state${lang ? `?lang=${lang}` : ''}`)),
  question: (id: string, lang: Language) =>
    call<Question>(`/api/question?id=${encodeURIComponent(id)}&lang=${lang}`),
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
  setKind: (id: string, kind: string, person: string | undefined, lang: Language) =>
    post('/documents/kind', lang, { id, kind, ...(person ? { person } : {}) }),
  upload: async (
    file: File,
    lang: Language,
    preset?: { kind: string; person?: string },
    /** The document this file replaces, if any. */
    replace?: string,
  ) => {
    const query = new URLSearchParams({ lang });
    if (preset) {
      query.set('kind', preset.kind);
      if (preset.person) query.set('person', preset.person);
    }
    if (replace) query.set('replace', replace);
    return remember(
      await call<State>(`/api/documents?${query.toString()}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/octet-stream',
          'X-Filename': encodeURIComponent(file.name),
        },
        body: file,
      }),
    );
  },
  // Values read from documents (SPEC.md 5.5), checks (5.8) and the "Entered" ticks (10.5).
  confirmFact: (id: string, lang: Language) => post('/facts/confirm', lang, { id }),
  editFact: (id: string, value: string | boolean, lang: Language) =>
    post('/facts/edit', lang, { id, value }),
  setEntered: (id: string, entered: boolean, lang: Language) =>
    post('/facts/entered', lang, { id, entered }),
  confirmDocument: (id: string, lang: Language) => post('/documents/confirm', lang, { id }),
  replaceDocument: (id: string, by: string, lang: Language) =>
    post('/documents/replace', lang, { id, by }),
  resolveCheck: (id: string, note: string, lang: Language) =>
    post('/checks/resolve', lang, { id, note }),
  // "Your securities and accounts": a security's official value, and whose a line is.
  holdingOfficial: (id: string, value: string, from: string, lang: Language) =>
    post('/holdings/official', lang, { id, value, from }),
  holdingOwner: (id: string, origin: string, owner: string, lang: Language) =>
    post('/holdings/owner', lang, { id, origin, owner }),
};
