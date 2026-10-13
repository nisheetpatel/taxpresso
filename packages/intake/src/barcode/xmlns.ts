// Namespace resolution on top of the strict XML reader (broker/xml.ts): which namespace each
// element is in, from its prefix and the xmlns declarations in scope. Nothing is fetched.
import { XmlError, type XmlElement } from '../broker/xml.js';

export interface NsElement {
  ns: string;
  local: string;
  attrs: Record<string, string>;
  /** Attributes in another namespace (extensions), by "{ns}local". */
  foreignAttrs: string[];
  children: NsElement[];
  text: string;
  line: number;
}

export function resolveNamespaces(
  el: XmlElement,
  scope: Readonly<Record<string, string>> = { '': '', xml: 'http://www.w3.org/XML/1998/namespace' },
): NsElement {
  const inScope: Record<string, string> = { ...scope };
  for (const [name, value] of Object.entries(el.attrs)) {
    if (name === 'xmlns') inScope[''] = value;
    else if (name.startsWith('xmlns:')) inScope[name.slice(6)] = value;
  }
  const split = (qname: string): [string, string] => {
    const i = qname.indexOf(':');
    return i < 0 ? ['', qname] : [qname.slice(0, i), qname.slice(i + 1)];
  };
  const [prefix, local] = split(el.name);
  const ns = inScope[prefix];
  if (ns === undefined) throw new XmlError(`Unknown namespace prefix ${prefix} on line ${el.line}`);
  const attrs: Record<string, string> = {};
  const foreignAttrs: string[] = [];
  for (const [name, value] of Object.entries(el.attrs)) {
    if (name === 'xmlns' || name.startsWith('xmlns:')) continue;
    const [p, l] = split(name);
    if (p === '') attrs[l] = value;
    else {
      const ans = inScope[p];
      if (ans === undefined) throw new XmlError(`Unknown namespace prefix ${p} on line ${el.line}`);
      foreignAttrs.push(`{${ans}}${l}`);
    }
  }
  return {
    ns,
    local,
    attrs,
    foreignAttrs,
    children: el.children.map((c) => resolveNamespaces(c, inScope)),
    text: el.text,
    line: el.line,
  };
}

/** The XML text of a payload: UTF-8 unless the declaration says Latin-1 / Windows-1252. */
export function decodeXmlText(bytes: Uint8Array): string {
  const head = new TextDecoder('latin1').decode(bytes.subarray(0, 200));
  const declared = head.match(/^\s*<\?xml[^>]*encoding\s*=\s*["']([\w.-]+)["']/i)?.[1];
  const latin = declared && /^(iso-8859-1|latin-?1|windows-1252|cp1252)$/i.test(declared);
  return new TextDecoder(latin ? 'windows-1252' : 'utf-8', { fatal: true }).decode(bytes);
}

export interface Problems {
  list: string[];
  add(where: NsElement | undefined, what: string): void;
}

export function problems(): Problems {
  const list: string[] = [];
  return {
    list,
    add: (where, what) => {
      if (list.length < 50) list.push(where ? `${what} (line ${where.line})` : what);
    },
  };
}

/** One step of an xs:sequence: the element's local name, how often, and a check of its content. */
export interface Step {
  name: string;
  min?: 0 | 1;
  max?: number;
  check?: (el: NsElement) => void;
}

/**
 * Checks that `el`'s children in namespace `ns` follow the xs:sequence `steps` (order, required
 * and repeated elements), and runs each step's check. Children in another namespace are
 * extensions: `foreignOk` says whether the schema allows them there (xs:any ##other).
 */
export function sequence(
  el: NsElement,
  ns: string,
  steps: readonly Step[],
  p: Problems,
  foreignOk = false,
): void {
  const children = el.children.filter((c) => {
    if (c.ns === ns) return true;
    if (!foreignOk) p.add(c, `Unexpected element ${c.local} in ${el.local}`);
    return false;
  });
  let i = 0;
  for (const step of steps) {
    let count = 0;
    while (i < children.length && children[i]!.local === step.name) {
      count++;
      if (count <= (step.max ?? 1)) step.check?.(children[i]!);
      i++;
    }
    if (count < (step.min ?? 1)) p.add(el, `Missing ${step.name} in ${el.local}`);
    if (count > (step.max ?? 1)) p.add(el, `Too many ${step.name} in ${el.local}`);
  }
  for (; i < children.length; i++) {
    p.add(children[i], `Unexpected element ${children[i]!.local} in ${el.local}`);
  }
}

export const child = (el: NsElement, name: string): NsElement | undefined =>
  el.children.find((c) => c.local === name && c.ns === el.ns);

export const textOf = (el: NsElement | undefined): string | undefined =>
  el === undefined ? undefined : el.text.trim();

/** xs:date "YYYY-MM-DD", with an optional time zone; returns the date part when it is a real day. */
export function xsDate(value: string | undefined): string | undefined {
  const m = value?.trim().match(/^(\d{4})-(\d{2})-(\d{2})(?:Z|[+-]\d{2}:\d{2})?$/);
  if (!m) return undefined;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (mo < 1 || mo > 12 || d < 1 || d > new Date(Date.UTC(y, mo, 0)).getUTCDate()) {
    return undefined;
  }
  return `${m[1]}-${m[2]}-${m[3]}`;
}

/** xs:dateTime, loosely: a valid date, "T", a time. */
export const isXsDateTime = (value: string | undefined): boolean =>
  !!value &&
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})?$/.test(value.trim()) &&
  xsDate(value.trim().slice(0, 10)) !== undefined;

/** xs:decimal: optional sign, digits, optional fraction; no exponent, no grouping. */
export const isXsDecimal = (value: string | undefined): boolean =>
  !!value && /^[+-]?(\d+(\.\d*)?|\.\d+)$/.test(value.trim());

export const isXsBoolean = (value: string | undefined): boolean =>
  value === 'true' || value === 'false' || value === '1' || value === '0';
