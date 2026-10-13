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
  upload: async (file: File, lang: Language, preset?: { kind: string; person?: string }) => {
    const query = new URLSearchParams({ lang });
    if (preset) {
      query.set('kind', preset.kind);
      if (preset.person) query.set('person', preset.person);
    }
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
};
