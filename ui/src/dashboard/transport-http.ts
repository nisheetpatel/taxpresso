// The browser page: talks to the extension on 127.0.0.1 only (same origin; the page's CSP allows
// nothing else). The view inside the conversation never includes this file.
import { ApiError, type Transport } from './transport';

export function httpTransport(): Transport {
  return {
    async send({ method, path, query, body, file, csrf }) {
      const search = new URLSearchParams(query).toString();
      const headers: Record<string, string> = {};
      let payload: BodyInit | undefined;
      if (method === 'POST') {
        headers['X-Taxpresso-CSRF'] = csrf ?? '';
        if (file) {
          headers['Content-Type'] = 'application/octet-stream';
          headers['X-Filename'] = encodeURIComponent(file.name);
          payload = file;
        } else {
          headers['Content-Type'] = 'application/json';
          payload = JSON.stringify(body ?? {});
        }
      }
      const res = await fetch(`/api${path}${search ? `?${search}` : ''}`, {
        method,
        cache: 'no-store',
        credentials: 'same-origin',
        headers,
        ...(payload === undefined ? {} : { body: payload }),
      });
      const out = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new ApiError(out.error ?? `HTTP ${res.status}`);
      return out;
    },
  };
}
