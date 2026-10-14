// A tax constant with the official document it comes from: manifest id plus page, paragraph (§)
// or sheet (SPEC.md section 7). The same shape as Cited<T> in packages/rules-ge; both move to
// packages/rules-ch when the federal tax is split out (docs/design/cantons.md, section 1).
export interface Cited<T> {
  value: T;
  source: string;
}
