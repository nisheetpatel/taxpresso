// "About you" (docs/design/simple.md): each fact one short sentence; why it holds behind "Why?",
// closed; its official sources behind "Sources", closed, inside "Why?" (or alone when there is
// nothing more to say), by title and place, each linked. The component is expanded without a DOM:
// it and its parts are plain functions of the state. Synthetic state only.
import { isValidElement, type VNode } from 'preact';
import { describe, expect, it } from 'vitest';
import type { Language } from './i18n';
import { Facts } from './Simple';
import type { State } from './types';

interface El {
  type: string;
  props: Record<string, unknown>;
  children: Tree[];
}
type Tree = El | string;

/** The element tree a component renders, its function components called in turn. */
function expand(node: unknown): Tree[] {
  if (Array.isArray(node)) return node.flatMap(expand);
  if (node === null || node === undefined || typeof node === 'boolean') return [];
  if (typeof node === 'string' || typeof node === 'number') return [String(node)];
  if (!isValidElement(node)) return [];
  const v = node as VNode<Record<string, unknown>>;
  if (typeof v.type === 'function') {
    return expand((v.type as (props: Record<string, unknown>) => unknown)(v.props));
  }
  const { children, ...props } = v.props;
  return [{ type: v.type, props, children: expand(children) }];
}

const textOf = (t: Tree | Tree[]): string =>
  Array.isArray(t) ? t.map(textOf).join('') : typeof t === 'string' ? t : textOf(t.children);
const all = (t: Tree[], match: (e: El) => boolean): El[] =>
  t.flatMap((x) =>
    typeof x === 'string' ? [] : [...(match(x) ? [x] : []), ...all(x.children, match)],
  );
const kids = (e: El, type: string) =>
  e.children.filter((c): c is El => typeof c !== 'string' && c.type === type);

const LISP = {
  id: 'ge-na-law-lisp',
  where: 'art. 1 al. 1',
  title: "Loi sur l'imposition à la source des personnes physiques et morales (LISP), rsGE D 3 20",
  url: 'https://silgeneve.ch/legis/data/rsg_d3_20.htm',
};
const DIRECTIVES = (where: string, page: number) => ({
  id: 'ge-2026-source-directives',
  where,
  title: "Directives concernant l'impôt à la source 2026",
  url: `https://www.ge.ch/document/42009/annexe/file/580297#page=${page}`,
});

/** A made-up couple taxed at source and already in TOU, as journey.ts words it. */
const state = {
  canton: { code: 'GE' },
  planning: null,
  journey: {
    about: [
      {
        id: 'source_tax',
        who: 'both',
        vars: {},
        text: {
          en: 'You’re both taxed at source (no C permit).',
          fr: 'Vous êtes tous les deux imposés à la source (sans permis C).',
        },
        why: {
          en: 'Without a C permit, tax is taken at source from a salary and from the benefits that replace it.',
          fr: 'Sans permis C, l’impôt est retenu à la source sur le salaire et sur les indemnités qui le remplacent.',
        },
        source: 'ge-na-law-lisp art. 1 al. 1',
        sources: [LISP],
      },
      {
        id: 'source_tax',
        who: 'both',
        vars: {},
        text: { en: 'Your barème is C1N.', fr: 'Votre barème est C1N.' },
        why: {
          en: 'Married, both of you with income.',
          fr: 'Marié, vous avez tous deux un revenu.',
        },
        source:
          'ge-2026-source-directives p. 25 and 26 (ch. 5.2.1.3); ge-2026-source-directives p. 42 (ch. 6.10)',
        sources: [DIRECTIVES('p. 25 and 26 (ch. 5.2.1.3)', 25), DIRECTIVES('p. 42 (ch. 6.10)', 42)],
      },
      {
        id: 'source_tax',
        who: 'p1',
        vars: {},
        text: { en: 'Your tax taken at source for 2026: not known yet.', fr: 'Pas encore connu.' },
        why: { en: 'Your salary certificate shows it (box 12).', fr: 'Chiffre 12.' },
      },
      {
        id: 'tou_mixed',
        vars: {},
        source: 'ge-2026-source-directives p. 25 and 26 (ch. 5.2.1.2, 5.2.1.3)',
        sources: [DIRECTIVES('p. 25 and 26 (ch. 5.2.1.2, 5.2.1.3)', 25)],
      },
      { id: 'tou_already', who: 'both', vars: {} },
    ],
  },
} as unknown as State;

const render = (lang: Language = 'en') =>
  all(expand(Facts({ state, lang, onOpen: () => undefined })), (e) => e.type === 'li').filter(
    (li) => li.props.class === 'fact',
  );

describe('the facts of "About you"', () => {
  it('are one short sentence each, with no source in sight', () => {
    const facts = render();
    expect(facts.map((li) => textOf(kids(li, 'p'))).slice(0, 3)).toEqual([
      'You’re both taxed at source (no C permit).',
      'Your barème is C1N.',
      'Your tax taken at source for 2026: not known yet.',
    ]);
    // No manifest id anywhere on the page: the sources show by their titles.
    expect(textOf(facts.map((li) => li.children).flat())).not.toMatch(/ge-na-law|ge-2026-/);
  });

  it('keep why behind "Why?" and the sources behind "Sources" inside it, both closed', () => {
    const [who] = render();
    const [why] = kids(who!, 'details');
    expect(why!.props.open).toBeUndefined();
    expect(textOf(kids(why!, 'summary'))).toBe('Why?');
    const body = kids(why!, 'div')[0]!;
    expect(textOf(kids(body, 'p'))).toMatch(/^Without a C permit/);
    const [sources] = kids(body, 'details');
    expect(sources!.props.open).toBeUndefined();
    expect(textOf(kids(sources!, 'summary'))).toBe('Sources');
    // The document by its title, the place cited linked to it.
    expect(textOf(all([sources!], (e) => e.type === 'li'))).toBe(`${LISP.title}, art. 1 al. 1`);
    const links = all([sources!], (e) => e.type === 'a');
    expect(links.map((a) => [a.props.href, textOf(a)])).toEqual([[LISP.url, 'art. 1 al. 1']]);
  });

  it('give each source document once, each place cited in it linked to its page', () => {
    const barème = render()[1]!;
    const list = all(
      [barème],
      (e) => e.type === 'ul' && e.props.class === 'source-list small-text',
    );
    const items = all(list, (e) => e.type === 'li');
    expect(items).toHaveLength(1);
    expect(textOf(items[0]!)).toBe(
      "Directives concernant l'impôt à la source 2026, p. 25 and 26 (ch. 5.2.1.3); p. 42 (ch. 6.10)",
    );
    expect(all(items, (e) => e.type === 'a').map((a) => a.props.href)).toEqual([
      'https://www.ge.ch/document/42009/annexe/file/580297#page=25',
      'https://www.ge.ch/document/42009/annexe/file/580297#page=42',
    ]);
  });

  it('show "Sources" alone when there is nothing more to say, and nothing without either', () => {
    const facts = render();
    const mixed = facts[3]!;
    const [only] = kids(mixed, 'details');
    expect(textOf(kids(only!, 'summary'))).toBe('Sources');
    expect(only!.props.open).toBeUndefined();
    expect(kids(facts[4]!, 'details')).toEqual([]);
  });

  it('say "Why?" and "Sources" in the page’s language', () => {
    const [who] = render('fr');
    const [why] = kids(who!, 'details');
    expect(textOf(kids(why!, 'summary'))).toBe('Pourquoi ?');
    expect(textOf(kids(who!, 'p'))).toBe(
      'Vous êtes tous les deux imposés à la source (sans permis C).',
    );
    const de = render('de')[0]!;
    // German falls back to English where a fact has no German words.
    expect(textOf(kids(kids(de, 'details')[0]!, 'summary'))).toBe('Warum?');
  });
});
