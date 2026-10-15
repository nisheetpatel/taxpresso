// The three pages (docs/design/three-pages.md, section 7), rendered without a DOM: each screen is a
// plain function of the state, expanded here into its element tree; the parts that keep their own
// state (a question being answered, an amount being typed, the reused cards) stay as they are,
// with their props. Synthetic households only.
import { isValidElement, type VNode } from 'preact';
import { afterEach, describe, expect, it } from 'vitest';
import { setTransport } from './api';
import { AskOne } from './Ask';
import { Assessment } from './Assessment';
import {
  BasicsCard,
  confirmAll,
  filingWrite,
  incomeWrites,
  KIND_FIELD,
  KIND_SOURCE,
  type Write,
} from './Basics';
import { CheckItem } from './Checks';
import { CopyPanel } from './CopyPanel';
import { ValueCheck } from './DocumentCards';
import { Estimate } from './Estimate';
import { FilePage, stillToDo } from './File';
import { FinalCheckItems, FinalCheckStep } from './FinalCheck';
import { Holdings } from './Holdings';
import { LastYear } from './LastYear';
import type { Act, PageProps } from './page-props';
import { costRowsOf, PayLess, saveCards } from './PayLess';
import { CatchUpCard, LppCard, TouCard } from './Planning';
import { Reconcile } from './Reconcile';
import { Review } from './Review';
import { DropZone, Start } from './Start';
import {
  confidenceOf,
  followPage,
  pageOf,
  pagesOf,
  type Confidence,
  type GroupQuestion,
  type Groups,
  type RoughKind,
} from './state-adapter';
import { TaxCard } from './TaxCard';
import type { ApiRequest } from './transport';
import type { State } from './types';
import type { FinalCheckState } from './types-final-check';
import { AmountInput, AskClaude } from './ui';
import { chipsOf, MakeItExact, Special } from './YourTax';

interface El {
  type: string;
  props: Record<string, unknown>;
  children: Tree[];
}
type Tree = El | string;

/** Kept as they are, with their props: they hold their own state, or are covered elsewhere. */
const OPAQUE = new Set<unknown>([
  AskOne,
  AmountInput,
  AskClaude,
  ValueCheck,
  CheckItem,
  Holdings,
  LppCard,
  CatchUpCard,
  TouCard,
  CopyPanel,
  Reconcile,
  FinalCheckStep,
  Estimate,
  LastYear,
  Review,
  DropZone,
  Assessment,
]);

/** The element tree a component renders, its plain function components called in turn. */
function expand(node: unknown): Tree[] {
  if (Array.isArray(node)) return node.flatMap(expand);
  if (node === null || node === undefined || typeof node === 'boolean') return [];
  if (typeof node === 'string' || typeof node === 'number') return [String(node)];
  if (!isValidElement(node)) return [];
  const v = node as VNode<Record<string, unknown>>;
  if (typeof v.type === 'function') {
    const fn = v.type as (props: Record<string, unknown>) => unknown;
    if (OPAQUE.has(fn)) return [{ type: fn.name, props: v.props, children: [] }];
    return expand(fn(v.props));
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
const ofType = (t: Tree[], type: string) => all(t, (e) => e.type === type);
const button = (t: Tree[], text: string | RegExp) =>
  all(
    t,
    (e) =>
      e.type === 'button' && (typeof text === 'string' ? textOf(e) === text : text.test(textOf(e))),
  )[0];
const click = (e: El | undefined) => (e!.props.onClick as () => void)();
/** Text with the narrow and normal spaces Intl puts in amounts made plain. */
const plain = (s: string) => s.replace(/[\u00a0\u202f’]/g, (c) => (c === '’' ? "'" : ' '));

const q = (id: string, extra: Partial<GroupQuestion> = {}): GroupQuestion => {
  const [questionId = id, person = 'household'] = id.split(':');
  return { id, questionId, person, type: 'choice', text: id, answered: false, ...extra };
};
const opts = (...values: (string | [string, boolean])[]) =>
  values.map((v) => {
    const [value, notSupported] = typeof v === 'string' ? [v, false] : v;
    return { value, label: value, notSupported };
  });

function groups(change: Partial<Groups> = {}): Groups {
  return {
    basics: [
      q('canton', { answered: true, value: 'GE', options: opts('GE', 'ZH', ['other', true]) }),
      q('civil_status', {
        answered: true,
        value: 'single',
        options: opts('single', 'married', 'registered_partnership', 'divorced'),
      }),
      q('children', { type: 'number', answered: true, value: 0, min: 0, max: 12 }),
      q('commune', {
        type: 'commune',
        answered: true,
        value: 'carouge',
        options: [{ value: 'carouge', label: 'Carouge', notSupported: false }],
      }),
      q('income_sources:p1', {
        type: 'multi',
        answered: true,
        value: ['salary'],
        options: opts('salary', 'replacement_income', 'pension', 'alimony', 'self_employment'),
      }),
      q('residence:p1', {
        answered: true,
        value: 'swiss',
        options: opts('swiss', 'permit_c', 'permit_other', 'other'),
      }),
    ],
    special: [
      q('special', {
        type: 'multi',
        options: opts(
          'real_estate',
          'property_abroad',
          ['inheritance_or_gift', true],
          ['foreign_income', true],
          'pension_capital',
        ),
      }),
      q('moved', { options: opts('no', 'within_geneva', 'from_abroad') }),
    ],
    deduction: [
      q('commute:p1', { options: opts('public_transport', 'car', 'mostly_home') }),
      q('payments', {
        type: 'multi',
        options: opts('medical_costs', 'donations', 'loan_interest', 'alimony_paid'),
      }),
    ],
    plan: [q('pillar3a:p1', { type: 'yesno' })],
    detail: [q('employers:p1', { type: 'number', min: 1, max: 9 })],
    ...change,
  };
}

/** A made-up single person in Carouge with a rough salary of CHF 95,000. */
function household(change: Record<string, unknown> = {}): State {
  return {
    version: '0.0.0-test',
    taxYear: 2026,
    years: [{ year: 2026, open: true, over: false, cantons: [{ code: 'GE', name: 'Geneva' }] }],
    yearOver: null,
    canton: { code: 'GE', name: 'Geneva', from: 'answer', because: [] },
    lang: 'en',
    csrf: 'token',
    vault: { path: '/tmp/Taxpresso/2026', exists: true },
    people: [{ id: 'p1', label: 'You' }],
    progress: { answered: 6, total: 12 },
    question: null,
    chips: [],
    answers: [],
    documents: [],
    kinds: [
      { value: 'salary_certificate', label: 'Salary certificate' },
      { value: 'health_premiums', label: 'Health insurance premiums' },
      { value: 'prior_declaration', label: 'Last year’s declaration' },
    ],
    requirements: [],
    cards: [],
    replaced: [],
    checks: [],
    assessments: [],
    toConfirm: 0,
    journey: {
      next: { id: 'questions', stage: 'about', vars: { n: 6 } },
      stage: 'about',
      stages: [{ id: 'tax', status: 'estimate', vars: { amount: 890_000 } }],
      about: [],
      hasFigures: true,
      savings: {
        totalCentimes: 182_000,
        cantonalCentimes: 120_000,
        federalCentimes: 62_000,
        parts: ['pillar3a'],
        onlyWithTou: false,
        assumptions: [],
        sources: [],
      },
      touChoice: false,
      documentsIn: false,
      yearEnded: false,
    },
    estimate: {
      computed: true,
      taxYear: 2026,
      total: 890_000,
      estimate: true,
      rows: [],
      parts: [],
      taxable: { icc: null, ifd: null, wealth: null },
      items: [],
      estimates: [],
      needsOk: 0,
      notes: [],
      complete: true,
      lastYear: [],
    },
    plan: {
      inputs: [{ person: 'p1', gross: 9_500_000, net: null, hasPensionFund: true, paid: 0 }],
      result: {
        people: [
          {
            person: 'p1',
            capCentimes: 725_800,
            capIsMaximum: false,
            paidCentimes: 0,
            roomCentimes: 725_800,
          },
        ],
        roomCentimes: 725_800,
        saving: { totalCentimes: 182_000, cantonalCentimes: 120_000, federalCentimes: 62_000 },
        assumptions: [],
        sources: ['ch-na-law-opp3'],
      },
    },
    planning: {
      inputs: [
        {
          person: 'p1',
          lppCapacity: null,
          lppAmount: null,
          paid2025: null,
          withheld: null,
          tariff: null,
          taxedAtSource: false,
        },
      ],
      otherIncome: null,
      taxableWealth: null,
      tariffs: [],
      lpp: {
        people: [],
        amountCentimes: 0,
        capacityUnknown: true,
        assumptions: [],
        facts: {},
        sources: [],
      },
      catchUp: {
        people: [{ person: 'p1', status: 'no_gap', isMaximum: false, catchUpCentimes: 0 }],
        catchUpCentimes: 0,
        capInYearCentimes: 725_800,
        assumptions: [],
        facts: {},
        sources: [],
      },
      tou: {
        applies: false,
        compulsory: 'no',
        reasons: [],
        missingWithheld: [],
        deadline: '2027-03-31',
        deadlinePassed: false,
        thresholds: {
          grossCentimes: 0,
          otherIncomeCentimes: 0,
          wealthFree: { single: 0, coupleOrSingleParent: 0, perDependant: 0 },
        },
        assumptions: [],
        facts: {},
        sources: [],
      },
      needsTou: false,
    },
    notSupported: [],
    notSupportedMessage: 'Taxpresso can’t prepare this part yet.',
    copyPanel: {
      taxYear: 2026,
      formYear: 2026,
      provisional: false,
      sections: [],
      entered: 0,
      total: 0,
      pending: 0,
      unplaced: [],
      couple: false,
      waiting: [],
    },
    activity: [],
    page: { current: 'tax', tabs: true },
    confidence: 'rough',
    groups: groups(),
    rough: [{ person: 'p1', amount: 9_500_000, kind: 'salary' }],
    ...change,
  } as unknown as State;
}

const noAct: Act = async (fn) => (await fn(), true);

function props(state: State, change: Partial<PageProps> = {}): PageProps {
  return {
    state,
    pages: pagesOf(state),
    lang: 'en',
    busy: false,
    embedded: false,
    act: noAct,
    flags: new Set(),
    setFlag: () => undefined,
    go: () => undefined,
    openBasics: () => undefined,
    add: () => undefined,
    roughBefore: null,
    ...change,
  };
}

/** Records what the page asks the extension, through a stand-in transport. */
function recorder(state: State): ApiRequest[] {
  const seen: ApiRequest[] = [];
  setTransport({
    send: (req) => {
      seen.push(req);
      return Promise.resolve(state);
    },
  });
  return seen;
}

afterEach(() => {
  setTransport({ send: () => Promise.reject(new Error('no transport in this test')) });
});

describe('Start', () => {
  it('shows only while nothing is known (or the folder can’t be used)', () => {
    const at = (id: string, stage: string | null) =>
      pageOf(
        household({
          page: undefined,
          journey: { ...household().journey, next: { id, stage, vars: {} } },
        }),
      );
    expect(at('start', 'about')).toEqual({ current: 'start', tabs: false });
    expect(at('folder', null)).toEqual({ current: 'start', tabs: false });
    expect(at('canton', 'about')).toEqual({ current: 'tax', tabs: true });
    // The extension's own page wins once it gives one.
    expect(pageOf(household({ page: { current: 'file', tabs: true } }))).toEqual({
      current: 'file',
      tabs: true,
    });
  });

  it('has two doors: in Claude Desktop the folder opens, in the browser a drop zone', () => {
    let opened = 0;
    let basics = 0;
    const render = (embedded: boolean) =>
      expand(
        Start({
          ...props(household(), {
            embedded,
            add: () => void opened++,
            openBasics: () => void basics++,
          }),
          onFiles: () => undefined,
          onChoose: () => undefined,
        }),
      );
    const inside = render(true);
    expect(ofType(inside, 'DropZone')).toHaveLength(0);
    click(button(inside, 'Open my Taxpresso folder'));
    expect(opened).toBe(1);
    const browser = render(false);
    expect(ofType(browser, 'DropZone')).toHaveLength(1);
    expect(button(browser, 'Open my Taxpresso folder')).toBeUndefined();
    click(button(browser, 'Start with rough numbers'));
    expect(basics).toBe(1);
    expect(textOf(browser)).toContain('Let’s do your 2026 taxes.');
  });

  it('suggests only the documents the canton has', () => {
    const tree = expand(
      Start({ ...props(household()), onFiles: () => undefined, onChoose: () => undefined }),
    );
    const tags = all(tree, (e) => e.props.class === 'tag').map(textOf);
    expect(tags).toEqual(['Salary certificate', 'Health insurance premiums', 'Last year’s return']);
  });
});

describe('the basics card', () => {
  const sources = (value?: string[]) =>
    q('income_sources:p1', {
      type: 'multi',
      answered: value !== undefined,
      ...(value ? { value } : {}),
      options: opts('salary', 'replacement_income', 'pension', 'self_employment'),
    });

  it.each([
    ['salary', 'salary', 'gross'],
    ['benefits', 'replacement_income', 'replacementIncome'],
    ['pension', 'pension', 'pensionIncome'],
    ['business', 'self_employment', 'businessProfit'],
  ] as const)('writes %s as the source %s and the rough key %s', (kind, source, field) => {
    expect(KIND_SOURCE[kind]).toBe(source);
    expect(KIND_FIELD[kind]).toBe(field);
    const writes = incomeWrites({
      person: 'p1',
      kind,
      francs: 60_000,
      rough: undefined,
      sources: sources(),
    });
    expect(writes).toEqual([
      { answer: { id: 'income_sources:p1', value: [source] } },
      { plan: { person: 'p1', field, value: 60_000 } },
    ]);
  });

  it('moves a rough figure to the new kind and takes the old source out', () => {
    const writes = incomeWrites({
      person: 'p1',
      kind: 'pension',
      francs: null,
      rough: { person: 'p1', amount: 4_000_000, kind: 'salary' },
      sources: sources(['salary', 'alimony']),
    });
    expect(writes).toEqual([
      { answer: { id: 'income_sources:p1', value: ['alimony', 'pension'] } },
      { plan: { person: 'p1', field: 'gross', value: 0 } },
      { plan: { person: 'p1', field: 'pensionIncome', value: 40_000 } },
    ]);
    // Only the kind, with no amount yet: the source alone.
    expect(
      incomeWrites({
        person: 'p1',
        kind: 'benefits',
        francs: null,
        rough: undefined,
        sources: sources(),
      }),
    ).toEqual([{ answer: { id: 'income_sources:p1', value: ['replacement_income'] } }]);
  });

  it('says "Just me" or "Me and my partner", keeping a status that already fits', () => {
    const civil = (value?: string) =>
      q('civil_status', { answered: value !== undefined, ...(value ? { value } : {}) });
    expect(filingWrite(civil(), 'couple')).toEqual({
      answer: { id: 'civil_status', value: 'married' },
    });
    expect(filingWrite(civil(), 'single')).toEqual({
      answer: { id: 'civil_status', value: 'single' },
    });
    expect(filingWrite(civil('divorced'), 'single')).toBeNull();
    expect(filingWrite(civil('registered_partnership'), 'couple')).toBeNull();
    expect(filingWrite(civil('divorced'), 'couple')).toEqual({
      answer: { id: 'civil_status', value: 'married' },
    });
  });

  const card = (state: State) => {
    const writes: Write[][] = [];
    const tree = expand(
      BasicsCard({
        state,
        pages: pagesOf(state),
        lang: 'en',
        busy: false,
        actions: { write: (w) => void writes.push(w), close: () => undefined },
      }),
    );
    return { tree, writes };
  };
  const segmented = (tree: Tree[], label: string) => {
    const group = all(
      tree,
      (e) => e.props.role === 'group' && e.props['aria-labelledby'] === label,
    )[0];
    return group ? ofType([group], 'button') : [];
  };

  it('answers with each tap: who is filing, the children, the permit', () => {
    const { tree, writes } = card(household());
    const who = segmented(tree, 'b-who');
    expect(who.map(textOf)).toEqual(['Just me', 'Me and my partner']);
    expect(who[0]!.props['aria-pressed']).toBe(true);
    click(who[1]);
    const children = all(tree, (e) => e.props['aria-label'] === 'One more child')[0];
    click(children);
    const permit = segmented(tree, 'b-res');
    expect(permit.map(textOf)).toEqual(['Swiss', 'C permit', 'Other permit']);
    click(permit[2]);
    expect(writes).toEqual([
      [{ answer: { id: 'civil_status', value: 'married' } }],
      [{ answer: { id: 'children', value: 1 } }],
      [{ answer: { id: 'residence:p1', value: 'permit_other' } }],
    ]);
    // The amount is typed into its own field, which saves through the same writes.
    const amount = ofType(tree, 'AmountInput')[0]!;
    (amount.props.onSave as (f: number) => void)(80_000);
    expect(writes.at(-1)).toEqual([{ plan: { person: 'p1', field: 'gross', value: 80_000 } }]);
  });

  it('shows a field only when its question applies; the partner’s rows only for a couple', () => {
    const before = household({
      groups: groups({ basics: [q('canton', { options: opts('GE', 'ZH') }), q('civil_status')] }),
      people: [{ id: 'p1', label: 'You' }],
    });
    const first = card(before).tree;
    expect(ofType(first, 'select')).toHaveLength(1); // the canton, no commune yet
    expect(segmented(first, 'b-res')).toHaveLength(0);
    const couple = household({
      people: [
        { id: 'p1', label: 'You' },
        { id: 'p2', label: 'Your spouse or partner' },
      ],
      rough: [
        { person: 'p1', amount: 9_500_000, kind: 'salary' },
        { person: 'p2', amount: null, kind: null },
      ],
    });
    const two = card(couple).tree;
    expect(ofType(two, 'select')).toHaveLength(2); // the canton, then the commune
    expect(ofType(two, 'AmountInput').map((a) => a.props.label)).toEqual([
      'Yearly income of You, in CHF',
      'Yearly income of Your partner, in CHF',
    ]);
  });

  it('asks no rough income for a year that is over: the documents give it', () => {
    const { tree } = card(household({ yearOver: { year: 2025, plansIn: 2026, paidInYear: 'x' } }));
    expect(ofType(tree, 'AmountInput')).toHaveLength(0);
    expect(textOf(tree)).toContain('Add your documents: they give the exact figures.');
  });

  it('opens with last year’s answers to confirm, all at once', () => {
    const basics = [
      q('civil_status', { suggested: 'married', options: opts('single', 'married') }),
      q('children', { type: 'number', suggested: 2 }),
    ];
    const { tree, writes } = card(household({ groups: groups({ basics }) }));
    expect(confirmAll(basics)).toEqual([
      { answer: { id: 'civil_status', value: 'married' } },
      { answer: { id: 'children', value: 2 } },
    ]);
    click(button(tree, 'Yes, all still right'));
    expect(writes).toEqual([confirmAll(basics)]);
  });
});

describe('tabs and the page opened', () => {
  it('opens the page of the next step: Your tax, Pay less or File', () => {
    const at = (stage: string) =>
      pageOf(
        household({
          page: undefined,
          journey: { ...household().journey, next: { id: 'x', stage, vars: {} } },
        }),
      ).current;
    expect(['about', 'documents', 'tax', 'save', 'file'].map(at)).toEqual([
      'tax',
      'tax',
      'tax',
      'save',
      'file',
    ]);
  });

  it('follows the next step only while you are on its page', () => {
    expect(followPage(null, null, 'tax')).toBe('tax');
    expect(followPage('tax', 'tax', 'save')).toBe('save');
    expect(followPage('file', 'tax', 'save')).toBe('file');
  });
});

describe('the number', () => {
  const card = (confidence: Confidence | null, change: Record<string, unknown> = {}) =>
    expand(TaxCard(props(household({ confidence, ...change }))));

  it.each([
    ['rough', 'Rough estimate', 'about CHF 8,900'],
    ['close', 'Getting close', 'about CHF 8,900'],
    ['exact', 'Exact', 'CHF 8,900'],
  ] as const)('says how sure in words: %s', (confidence, word, amount) => {
    const tree = card(confidence);
    const meter = all(tree, (e) => e.props.class === 'meter')[0]!;
    expect(meter.props['data-sure']).toBe(confidence);
    expect(textOf(all([meter], (e) => e.props.class === 'meter-word'))).toBe(word);
    const shown = plain(textOf(all(tree, (e) => e.props.class === 'hero-amount')));
    expect(shown.replace(/'/g, ',')).toBe(amount);
  });

  it('asks for a rough income instead of showing CHF 0', () => {
    let opened = 0;
    const tree = expand(
      TaxCard(
        props(
          household({ confidence: null, journey: { ...household().journey, hasFigures: false } }),
          { openBasics: () => void opened++ },
        ),
      ),
    );
    expect(textOf(tree)).toContain('Add a rough income to see your tax.');
    expect(all(tree, (e) => e.props.class === 'meter')).toHaveLength(0);
    click(button(tree, 'Add a rough income'));
    expect(opened).toBe(1);
  });

  it('says what it rests on, and how much the documents moved it', () => {
    const rough = plain(textOf(card('rough')));
    expect(rough).toMatch(/From what you told us: about CHF 95.000 in salary, just you, Carouge\./);
    const tree = expand(
      TaxCard(
        props(
          household({
            confidence: 'close',
            estimate: { ...household().estimate, total: 824_000 },
            documents: [
              { id: 'd1', filename: 'c.pdf', bytes: 1, addedAt: '', kind: 'salary_certificate' },
            ],
          }),
          { roughBefore: 890_000 },
        ),
      ),
    );
    const said = plain(textOf(tree));
    expect(said).toContain('From your documents and what you told us.');
    expect(said).toMatch(/CHF 660 less than your rough numbers said\./);
  });

  it('works out how sure from today’s state until the extension says it', () => {
    const without = (change: Record<string, unknown>) =>
      confidenceOf(household({ confidence: undefined, ...change }));
    expect(without({})).toBe('rough');
    const certificate = [
      {
        id: 'd1',
        filename: 'c.pdf',
        bytes: 1,
        addedAt: '',
        kind: 'salary_certificate',
        person: 'p1',
      },
    ];
    expect(without({ documents: certificate })).toBe('close');
    expect(
      without({
        documents: certificate,
        estimate: { ...household().estimate, estimate: false },
      }),
    ).toBe('exact');
    expect(without({ journey: { ...household().journey, hasFigures: false } })).toBeNull();
  });
});

describe('only what applies', () => {
  const req = (group: string, status: string, change: Record<string, unknown> = {}) => ({
    id: group,
    label: group,
    reason: `${group} reason`,
    group,
    status,
    have: 0,
    need: 1,
    optional: false,
    person: 'household',
    kind: group,
    ...change,
  });

  it('Make it exact lists only the documents still useful, five at a time', () => {
    const requirements = [
      req('salary_certificate', 'estimated'),
      req('health_premiums', 'missing'),
      req('pillar3a', 'satisfied'),
      req('banks', 'waived'),
      ...['a', 'b', 'c', 'd', 'e'].map((g) => req(g, 'missing', { optional: true })),
    ];
    const tree = expand(MakeItExact(props(household({ requirements }))));
    const shown = all(tree, (e) => e.props.class === 'row-title').map(textOf);
    expect(shown).toEqual(['salary_certificate', 'health_premiums', 'a', 'b', 'c', 'd', 'e']);
    expect(textOf(ofType(tree, 'summary'))).toBe('Show 2 more');
    expect(textOf(tree)).toContain('No document yet? Type a rough amount instead.');
  });

  it('says what each file turned out to be', () => {
    const documents = [
      {
        id: 'b',
        filename: 'b.pdf',
        bytes: 1,
        addedAt: '',
        kind: 'salary_certificate',
        kindLabel: 'Salary certificate',
        barcode: 'read',
      },
      { id: 'u', filename: 'IMG_0412.jpg', bytes: 1, addedAt: '' },
      {
        id: 'c',
        filename: 'c.pdf',
        bytes: 1,
        addedAt: '',
        kind: 'health_premiums',
        kindLabel: 'Health insurance premiums',
      },
    ];
    const cards = [
      {
        docId: 'c',
        filename: 'c.pdf',
        read: true,
        enterable: true,
        toConfirm: 1,
        entered: 0,
        total: 1,
        values: [
          {
            factId: 'f',
            key: 'health.premiums',
            person: 'p1',
            label: 'Premiums',
            type: 'money',
            centimes: 984_000,
            copy: '9840',
            status: 'extracted',
            entered: false,
          },
        ],
      },
    ];
    const tree = expand(MakeItExact(props(household({ documents, cards }))));
    expect(textOf(ofType(tree, 'h2'))).toBe('Taxpresso sorted 3 documents');
    const rows = all(
      tree,
      (e) =>
        typeof e.props.class === 'string' && e.props.class.startsWith('row') && e.type === 'li',
    );
    // Something to OK first, then what isn't known, then what is done.
    expect(rows.map((r) => textOf(all([r], (e) => e.props.class === 'row-title')))).toEqual([
      'Health insurance premiums',
      'IMG_0412.jpg',
      'Salary certificate',
    ]);
    expect(ofType([rows[0]!], 'ValueCheck')).toHaveLength(1);
    expect(textOf(rows[1]!)).toContain('Not sure what this is. Claude will take a look.');
    expect(textOf(rows[2]!)).toContain('Read on its own, nothing to check');
  });

  it('asks whose a barcode certificate is, with one button per person', () => {
    const state = household({
      people: [
        { id: 'p1', label: 'You' },
        { id: 'p2', label: 'Your spouse or partner' },
      ],
      documents: [
        {
          id: 'w',
          filename: 'w.pdf',
          bytes: 1,
          addedAt: '',
          kind: 'salary_certificate',
          kindLabel: 'Salary certificate',
          barcode: 'pending',
        },
      ],
    });
    const seen = recorder(state);
    const tree = expand(MakeItExact(props(state)));
    const people = all(
      tree,
      (e) => e.props.role === 'group' && e.props['aria-labelledby'] === 'whose-w',
    )[0]!;
    expect(ofType([people], 'button').map(textOf)).toEqual(['You', 'Your spouse or partner']);
    click(ofType([people], 'button')[1]);
    expect(seen[0]).toMatchObject({
      path: '/documents/kind',
      body: { id: 'w', kind: 'salary_certificate', person: 'p2' },
    });
  });

  it('shows only the chips the canton asks about, and says plainly what isn’t supported', () => {
    expect(chipsOf(pagesOf(household())).map((c) => c.id)).toEqual([
      'home',
      'abroad',
      'self',
      'moved',
      'capital',
    ]);
    const zurich = household({
      groups: groups({
        special: [
          q('special', { type: 'multi', options: opts(['real_estate', true], 'pension_capital') }),
        ],
        basics: groups().basics.filter((x) => x.questionId !== 'income_sources'),
      }),
    });
    const chips = chipsOf(pagesOf(zurich));
    expect(chips.map((c) => [c.id, c.unsupported])).toEqual([
      ['home', true],
      ['capital', false],
    ]);
    const flags = new Set<string>();
    const tree = expand(
      Special(props(zurich, { setFlag: (f, on) => void (on ? flags.add(f) : flags.delete(f)) })),
    );
    click(button(tree, 'I own my home'));
    expect([...flags]).toEqual(['unsupported:home']);
    const told = expand(Special(props(zurich, { flags })));
    expect(textOf(told)).toContain('Taxpresso can’t prepare this part yet.');
    expect(Special(props(household({ groups: groups({ special: [] }) })))).not.toBeNull();
    expect(
      Special(
        props(
          household({
            groups: groups({
              special: [],
              basics: groups().basics.filter((x) => x.questionId !== 'income_sources'),
            }),
          }),
        ),
      ),
    ).toBeNull();
  });

  it('a chip answers its question', () => {
    const state = household();
    const seen = recorder(state);
    const tree = expand(Special(props(state)));
    click(button(tree, 'Pension payout'));
    click(button(tree, 'Nothing special'));
    expect(seen.map((r) => r.body)).toEqual([
      { id: 'special', value: ['pension_capital'] },
      { id: 'special', value: [] },
      { id: 'moved', value: 'no' },
    ]);
  });

  it('Pay less lists the costs that apply, one tap each', () => {
    const rows = costRowsOf(pagesOf(household()));
    expect(rows.map((r) => r.id)).toEqual([
      'commute',
      'medical_costs',
      'donations',
      'loan_interest',
      'alimony_paid',
    ]);
    const none = costRowsOf(pagesOf(household({ groups: groups({ deduction: [] }) })));
    expect(none).toEqual([]);
    const state = household();
    const seen = recorder(state);
    const tree = expand(PayLess(props(state)));
    click(button(tree, /^Donations/));
    expect(seen[0]).toMatchObject({
      path: '/answer',
      body: { id: 'payments', value: ['donations'] },
    });
  });

  it('Pay less shows TOU only when it is a real choice, and the catch-up only with a gap', () => {
    const ids = (state: State) => saveCards(props(state) as never).map((c) => c.id);
    expect(ids(household())).toEqual(['pillar3a', 'lpp']);
    const choice = household({
      journey: { ...household().journey, touChoice: true },
      planning: {
        ...household().planning,
        tou: {
          ...household().planning!.tou,
          applies: true,
          mode: 'choice',
          differenceCentimes: 300_000,
        },
        catchUp: {
          ...household().planning!.catchUp,
          people: [{ person: 'p1', status: 'possible', isMaximum: false, catchUpCentimes: 50_000 }],
        },
      },
    });
    // Biggest saving first: TOU's 3,000 before the 3a's 1,820.
    expect(ids(choice)).toEqual(['tou', 'pillar3a', 'lpp', 'catchup']);
  });

  it('Pay less, for a year that is over, points to the year whose plans apply', () => {
    const over = household({
      yearOver: { year: 2025, plansIn: 2026, paidInYear: 'x' },
      plan: null,
      planning: null,
    });
    const tree = expand(PayLess(props(over)));
    expect(textOf(tree)).toContain('Plans before 31 December are for 2026.');
    expect(all(tree, (e) => e.props.class?.toString().includes('save-card') ?? false)).toHaveLength(
      0,
    );
  });
});

describe('File', () => {
  it('before the documents are in: one line, and what is still to do', () => {
    const state = household({
      toConfirm: 2,
      requirements: [
        {
          id: 'h',
          label: 'Health insurance premiums',
          reason: '',
          group: 'h',
          status: 'missing',
          have: 0,
          need: 1,
          optional: false,
          person: 'p1',
        },
        {
          id: 'p',
          label: 'Last year’s declaration',
          reason: '',
          group: 'p',
          status: 'missing',
          have: 0,
          need: 1,
          optional: true,
          person: 'household',
        },
      ],
    });
    const tree = expand(FilePage(props(state)));
    expect(textOf(tree)).toContain('Filing opens when your documents are in.');
    expect(ofType(tree, 'li').map(textOf)).toEqual(stillToDo(state, pagesOf(state), 'en'));
    expect(stillToDo(state, pagesOf(state), 'en')).toEqual([
      'Answer one more question',
      'Say whether anything is special this year, on Your tax',
      'Tap the costs you can deduct, on Pay less',
      'Say whether you paid into pillar 3a or a pension fund, on Pay less',
      'Check 2 values read from your documents',
      'Add: Health insurance premiums',
    ]);
    expect(ofType(tree, 'FinalCheckStep')).toHaveLength(0);
  });

  const check: FinalCheckState = {
    taxYear: 2026,
    verdict: 'not_ready',
    fix: [
      { id: 'a', kind: 'needs_ok', title: 'A value to OK', detail: 'Premiums', sources: [] },
      { id: 'b', kind: 'official_pdf', title: 'The PDF', detail: 'Check it', sources: [] },
    ],
    know: [],
    margin: { shareBp: 0, min: 0 },
  };

  it('once in: check, fill in, send it yourself; Taxpresso never sends', () => {
    const done = household({
      journey: { ...household().journey, documentsIn: true },
      finalCheck: check,
    });
    const tree = expand(FilePage(props(done)));
    expect(
      all(tree, (e) => e.props.class?.toString().startsWith('step-head') ?? false).map(textOf),
    ).toEqual(['1Check 2 things', '2Fill in your declaration', '3Send it yourself']);
    expect(ofType(tree, 'FinalCheckStep')[0]!.props.view).toBe(check);
    const copy = all(
      tree,
      (e) => e.type === 'details' && textOf(ofType([e], 'summary')) === 'Copy values',
    )[0]!;
    expect(ofType([copy], 'CopyPanel')).toHaveLength(1);
    expect(ofType(tree, 'Reconcile')).toHaveLength(1);
    expect(textOf(tree)).toContain('You press Transmettre. Taxpresso never sends anything.');
    const zurich = household({
      canton: { code: 'ZH', name: 'Zurich', from: 'answer', because: [] },
      journey: { ...household().journey, documentsIn: true },
      finalCheck: { ...check, verdict: 'ready', fix: [] },
    });
    const zh = expand(FilePage(props(zurich)));
    expect(textOf(zh)).toContain('You send it from your canton’s tax software.');
    // Nothing to fix: step 1 is ticked, in words too ("Check", then the final check's verdict).
    const first = all(zh, (e) => e.props.class === 'step-num step-done');
    expect(first).toHaveLength(1);
    expect(ofType(first, 'svg')).toHaveLength(1);
  });

  it('step 1 shows the final check one item at a time', () => {
    let at = -1;
    let went = 0;
    const render = (index: number) =>
      expand(
        FinalCheckItems({
          view: check,
          index,
          lang: 'en',
          canton: 'GE',
          onIndex: (i) => void (at = i),
          onGo: () => void went++,
        }),
      );
    const first = render(0);
    expect(textOf(first)).toContain('1 of 2');
    expect(textOf(first)).toContain('A value to OK');
    expect(textOf(first)).not.toContain('The PDF');
    click(button(first, 'Next'));
    expect(at).toBe(1);
    click(button(first, 'Go to Your tax'));
    expect(went).toBe(1);
    const second = render(1);
    expect(textOf(second)).toContain('The PDF');
    expect(button(second, 'Go to Your tax')).toBeUndefined();
    const ready = expand(
      FinalCheckItems({
        view: { ...check, verdict: 'ready', fix: [] },
        index: 0,
        lang: 'en',
        canton: 'GE',
        onIndex: () => undefined,
        onGo: () => undefined,
      }),
    );
    expect(textOf(ready)).toContain('Nothing to fix. Good to go.');
  });
});

describe('the questions by group, until the extension gives them', () => {
  it('places the next question and the answers in their group', () => {
    const state = household({
      groups: undefined,
      question: {
        id: 'commute:p1',
        questionId: 'commute',
        person: 'p1',
        type: 'choice',
        text: 'How?',
      },
      answers: [
        { id: 'canton', question: 'Canton?', answer: 'Geneva' },
        { id: 'pillar3a:p1', question: '3a?', answer: 'Yes' },
        { id: 'moved', question: 'Moved?', answer: 'No' },
        { id: 'banks', question: 'Banks?', answer: '1' },
      ],
    });
    const g = pagesOf(state).groups;
    expect(g.deduction.map((x) => [x.id, x.answered])).toEqual([['commute:p1', false]]);
    expect(g.basics.map((x) => x.id)).toEqual(['canton']);
    expect(g.plan.map((x) => x.id)).toEqual(['pillar3a:p1']);
    expect(g.special.map((x) => x.id)).toEqual(['moved']);
    expect(g.detail.map((x) => x.id)).toEqual(['banks']);
  });

  it.each(['salary', 'benefits', 'pension', 'business'] as RoughKind[])(
    'reads a rough %s income from the plan until the extension says its kind',
    (kind) => {
      const state = household({ rough: undefined });
      expect(pagesOf(state).rough).toEqual([{ person: 'p1', amount: 9_500_000, kind: 'salary' }]);
      const given = household({ rough: [{ person: 'p1', amount: 100, kind }] });
      expect(pagesOf(given).rough[0]!.kind).toBe(kind);
    },
  );
});
