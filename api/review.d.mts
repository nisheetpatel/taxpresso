// Types for api/review.mjs (the website's review form), for its tests.
export declare const LANGS: readonly string[];
export declare const MAX_TEXT: number;
export declare const MAX_NAME: number;

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

export declare function parseReview(body: unknown): Parsed;
export declare function issueFor(
  review: Review,
  now?: Date,
): { title: string; body: string; labels: string[] };
export declare function fileReview(
  review: Review,
  options: { repo: string; token: string; fetchImpl?: typeof fetch },
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
