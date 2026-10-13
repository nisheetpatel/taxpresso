// A small, strict XML reader for broker exports (elements, attributes, text), so no XML parser
// dependency ships in the extension. It never resolves anything: no DTD, no external entities,
// only the five predefined entities and character references. Anything else is an error.

export interface XmlElement {
  name: string;
  attrs: Record<string, string>;
  children: XmlElement[];
  text: string;
  /** 1-based line of the start tag. */
  line: number;
}

export class XmlError extends Error {}

const ENTITIES: Record<string, string> = { lt: '<', gt: '>', amp: '&', quot: '"', apos: "'" };
const NAME = /^[A-Za-z_][\w.:-]*$/;
const ATTR = /\s*([A-Za-z_][\w.:-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/y;

export function decodeEntities(s: string): string {
  if (!s.includes('&')) return s;
  return s.replace(/&(#x[0-9a-fA-F]+|#\d+|\w+);|&/g, (match, ref: string | undefined) => {
    if (!ref) throw new XmlError('A bare & in the text');
    if (ref.startsWith('#')) {
      const code = ref[1] === 'x' ? parseInt(ref.slice(2), 16) : parseInt(ref.slice(1), 10);
      if (!Number.isFinite(code) || code < 1 || code > 0x10ffff) {
        throw new XmlError(`Bad character reference ${match}`);
      }
      return String.fromCodePoint(code);
    }
    const value = ENTITIES[ref];
    if (value === undefined) throw new XmlError(`Unknown entity ${match}`);
    return value;
  });
}

export interface XmlLimits {
  maxElements: number;
  maxDepth: number;
}

export function parseXml(
  text: string,
  limits: XmlLimits = { maxElements: 2_000_000, maxDepth: 64 },
): XmlElement {
  let pos = 0;
  let line = 1;
  let count = 0;
  const stack: XmlElement[] = [];
  let root: XmlElement | undefined;
  const advance = (to: number) => {
    for (let i = pos; i < to; i++) if (text.charCodeAt(i) === 10) line++;
    pos = to;
  };
  const skipPast = (marker: string, what: string) => {
    const end = text.indexOf(marker, pos);
    if (end < 0) throw new XmlError(`Unclosed ${what}`);
    advance(end + marker.length);
  };

  while (pos < text.length) {
    const lt = text.indexOf('<', pos);
    const chunk = text.slice(pos, lt < 0 ? text.length : lt);
    if (chunk.trim()) {
      const top = stack.at(-1);
      if (!top) throw new XmlError('Text outside the root element');
      top.text += decodeEntities(chunk);
    }
    if (lt < 0) {
      advance(text.length);
      break;
    }
    advance(lt);
    if (text.startsWith('<?', pos)) {
      skipPast('?>', 'processing instruction');
    } else if (text.startsWith('<!--', pos)) {
      skipPast('-->', 'comment');
    } else if (text.startsWith('<![CDATA[', pos)) {
      const end = text.indexOf(']]>', pos);
      if (end < 0) throw new XmlError('Unclosed CDATA');
      const top = stack.at(-1);
      if (!top) throw new XmlError('CDATA outside the root element');
      top.text += text.slice(pos + 9, end);
      advance(end + 3);
    } else if (text.startsWith('<!', pos)) {
      // DOCTYPE and declarations: never needed by the exports we read, and a door to entity tricks.
      throw new XmlError('Document type declarations are not accepted');
    } else if (text.startsWith('</', pos)) {
      const end = text.indexOf('>', pos);
      if (end < 0) throw new XmlError('Unclosed end tag');
      const name = text.slice(pos + 2, end).trim();
      const top = stack.pop();
      if (!top || top.name !== name) throw new XmlError(`Unexpected </${name}> on line ${line}`);
      advance(end + 1);
    } else {
      // Start tag: find its end outside quoted attribute values.
      let end = pos + 1;
      let quote = '';
      for (; end < text.length; end++) {
        const ch = text[end]!;
        if (quote) {
          if (ch === quote) quote = '';
        } else if (ch === '"' || ch === "'") quote = ch;
        else if (ch === '>') break;
        else if (ch === '<') throw new XmlError(`Malformed tag on line ${line}`);
      }
      if (end >= text.length) throw new XmlError('Unclosed start tag');
      let inner = text.slice(pos + 1, end);
      const selfClosing = inner.endsWith('/');
      if (selfClosing) inner = inner.slice(0, -1);
      const nameEnd = inner.search(/[\s]/);
      const name = nameEnd < 0 ? inner : inner.slice(0, nameEnd);
      if (!NAME.test(name)) throw new XmlError(`Bad element name on line ${line}`);
      const attrs: Record<string, string> = {};
      const rest = nameEnd < 0 ? '' : inner.slice(nameEnd);
      ATTR.lastIndex = 0;
      let at = 0;
      for (;;) {
        ATTR.lastIndex = at;
        const m = ATTR.exec(rest);
        if (!m) break;
        const key = m[1]!;
        if (key in attrs) throw new XmlError(`Duplicate attribute ${key} on line ${line}`);
        attrs[key] = decodeEntities(m[2] ?? m[3] ?? '');
        at = ATTR.lastIndex;
      }
      if (rest.slice(at).trim()) throw new XmlError(`Malformed attributes on line ${line}`);
      const element: XmlElement = { name, attrs, children: [], text: '', line };
      if (++count > limits.maxElements) throw new XmlError('Too many elements');
      const parent = stack.at(-1);
      if (parent) parent.children.push(element);
      else if (root) throw new XmlError('More than one root element');
      else root = element;
      if (!selfClosing) {
        stack.push(element);
        if (stack.length > limits.maxDepth) throw new XmlError('Elements nested too deeply');
      }
      advance(end + 1);
    }
  }
  if (stack.length) throw new XmlError(`Unclosed <${stack.at(-1)!.name}>`);
  if (!root) throw new XmlError('No root element');
  return root;
}

/** Every element named `name` below `el`, depth first, in document order. */
export function descendants(el: XmlElement, name: string): XmlElement[] {
  const out: XmlElement[] = [];
  const walk = (e: XmlElement) => {
    for (const c of e.children) {
      if (c.name === name) out.push(c);
      walk(c);
    }
  };
  walk(el);
  return out;
}
