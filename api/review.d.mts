// Types for api/review.mjs (the website's review form), for its tests.
export declare const LANGS: readonly string[];
export declare const MAX_TEXT: number;
export declare const MAX_NAME: number;
export declare const PER_MINUTE: number;
export declare const LIST: string;

export interface Review {
  text: string;
  name: string;
  quote: boolean;
  lang: string;
}

export type Parsed =
  | { ok: false; lang: string }
  | { ok: true; bot: true; lang: string; review?: undefined }
  | { ok: true; bot: false; lang: string; review: Review };

export interface Store {
  url: string;
  token: string;
}

export declare function parseReview(body: unknown): Parsed;
export declare function recordFor(
  review: Review,
  now?: Date,
): { text: string; name: string; quote: boolean; lang: string; date: string };
export declare function storeFrom(env: Record<string, string | undefined>): Store | null;
export declare function saveReview(
  review: Review,
  store: Store,
  options?: { fetchImpl?: unknown; now?: Date },
): Promise<boolean>;

interface Req {
  method?: string;
  body?: unknown;
}
interface Res {
  statusCode: number;
  setHeader(name: string, value: string): void;
  end(): void;
}
export default function handler(
  req: Req,
  res: Res,
  env?: Record<string, string | undefined>,
  fetchImpl?: unknown,
): Promise<void>;
