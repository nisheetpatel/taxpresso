// The assistant's name on the server (extension/src/config.ts): with the build flag at 'mcpb' or
// 'plugin', every sentence that names the assistant is word for word what it was before the ChatGPT
// build existed; at 'chatgpt' the same sentences name ChatGPT, and nothing the server says names
// Claude, its apps or the .mcpb. The libraries and the questionnaire data write {assistant}
// (packages/, data/), which the server fills before anything reads it. Synthetic households on
// temporary folders; each case loads the server anew, so it reads the flag as its build would.
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { Client } from '@modelcontextprotocol/client';
import { InMemoryTransport } from '@modelcontextprotocol/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

const fixtures = path.resolve(import.meta.dirname, '..', '..', 'test', 'fixtures');

type Result = Awaited<ReturnType<Client['callTool']>>;
const texts = (res: Result) =>
  (res.content as { type: string; text?: string }[]).map((c) => c.text ?? '').join('\n');

const open: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const close of open.splice(0)) await close();
  vi.unstubAllGlobals();
  vi.resetModules();
});

/** What the server says to a household with one unread document, built with the given flag. */
async function said(flag: 'mcpb' | 'plugin' | 'chatgpt' | undefined) {
  if (flag) vi.stubGlobal('__TAXPRESSO_DISTRIBUTION__', flag);
  vi.resetModules();
  const config = await import('../src/config.js');
  const { createApi } = await import('../src/api.js');
  const { Dashboard } = await import('../src/dashboard.js');
  const { finalCheckView } = await import('../src/final-check.js');
  const { holdings } = await import('../src/holdings.js');
  const { createTaxpressoServer } = await import('../src/server.js');
  const { makeUiDir, makeWorkspace } = await import('./helpers.js');

  const uiDir = await makeUiDir();
  const ws = await makeWorkspace(uiDir);
  const dashboard = new Dashboard({ dir: path.join(uiDir, 'dashboard'), api: createApi(ws) });
  const server = createTaxpressoServer({ workspace: ws, dashboard });
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  await server.connect(serverSide);
  const client = new Client({ name: 'test', version: '0' });
  await client.connect(clientSide);
  open.push(async () => {
    await client.close();
    await dashboard.stop();
  });
  await ws.ready();
  const call = (name: string, args: Record<string, unknown> = {}) =>
    client.callTool({ name, arguments: args });

  const empty = await call('get_status', { detail: true });
  const opened = await call('open_dashboard');
  const { tools } = await client.listTools();
  // The question every canton asks about children, as the questionnaire data words its help.
  const children = ws.snapshot().all.find((s) => s.question.id === 'children')?.question.explain;

  // One document nobody has read, said to be a bank attestation: the next step, the final check
  // (packages/rules-ge, final-check.ts) and the securities list (etat-des-titres.ts) all name the
  // assistant.
  const pdf = await readFile(path.join(fixtures, 'keller-avis-taxation-2025.pdf'));
  const { document } = await ws.addDocument(pdf, 'bank.pdf', 'dashboard');
  await ws.setDocumentKind(document.id, 'bank_attestation');
  const withDocument = await call('get_status');
  const check = { en: finalCheckView(ws, 'en'), fr: finalCheckView(ws, 'fr') };
  const unread = (lang: 'en' | 'fr') =>
    check[lang].fix.find((i) => i.kind === 'documents_unread')?.todo;
  const transmit = (lang: 'en' | 'fr') =>
    check[lang].know.find((i) => i.kind === 'official_pdf')?.todo;
  const notRead = holdings(ws).issues.find((i) => i.code === 'not_read')?.text;
  const finalCheck = await call('final_check');

  const everything = JSON.stringify([
    client.getInstructions(),
    tools,
    [empty, opened, withDocument, finalCheck].map((r) => [texts(r), r.structuredContent]),
    check,
    holdings(ws).issues,
    children,
  ]);
  return {
    config,
    start: (empty.structuredContent as { next: { text: string } }).next.text,
    read: (withDocument.structuredContent as { next: { text: string } }).next.text,
    runtime: (empty.structuredContent as { runtime: { distribution?: string } }).runtime,
    runtimeLine: texts(empty)
      .split('\n')
      .find((l) => l.startsWith('Runtime: ')),
    dashboard: texts(opened).split('\n')[1],
    schema: JSON.stringify(tools.find((t) => t.name === 'get_status')?.outputSchema),
    children,
    unread: { en: unread('en'), fr: unread('fr') },
    transmit: { en: transmit('en'), fr: transmit('fr') },
    notRead,
    everything,
  };
}

/** A no-break space, as French has before ? and ; (written out, so it shows). */
const NB = String.fromCharCode(0xa0);

/** Today's wording, as the .mcpb and the Claude plugin say it. Never edit it to make a test pass. */
const CLAUDE = {
  start:
    'Drop what you have: last year’s declaration or tax bill, this year’s documents. Or just tell Claude about yourself.',
  read: 'Taxpresso has a document to read. Ask Claude to read it, or say what it is.',
  dashboard:
    "It only works on this computer while Claude Desktop is running. Keep it beside the chat: in the chat it floats next to the conversation where the app allows it; in Cowork or the Code tab, open this link in the built-in browser pane next to the chat. Then guide the user from the chat: the dashboard follows by itself, so don't open it again in this conversation. Its buttons are only shortcuts for what is easier by hand: adding documents, a one-tap confirm, the year switch.",
  children: {
    en: 'Count the children who live with you or whom you support financially. Unsure about an adult child? Ask Claude.',
    fr: `Comptez les enfants qui vivent avec vous ou que vous entretenez. Un doute pour un enfant majeur${NB}? Demandez à Claude.`,
    de: 'Zähl die Kinder, die bei dir leben oder für deren Unterhalt du aufkommst. Unsicher bei einem volljährigen Kind? Frag Claude.',
    it: 'Conta i figli che vivono con te o che mantieni. Hai un dubbio su un figlio maggiorenne? Chiedi a Claude.',
  },
  unread: {
    en: 'Say what each one is and whose it is in the dashboard, or ask Claude to read it.',
    fr: 'Indiquez ce qu’est chacun et à qui il est dans le tableau de bord, ou demandez à Claude de le lire.',
  },
  transmit: {
    en: 'You transmit the declaration yourself; Taxpresso and Claude never do.',
    fr: `Vous transmettez la déclaration vous-même${NB}; ni Taxpresso ni Claude ne le font.`,
  },
  notRead: {
    en: 'bank.pdf: not read yet. Ask Claude to read it, or enter its figures.',
    fr: 'bank.pdf : pas encore lu. Demandez à Claude de le lire, ou saisissez ses montants.',
  },
  schema: [
    '"description":"Documents Claude has not read yet."',
    '"description":"Documents read from their barcode: verified values, nothing for Claude to read."',
    '"description":"What Claude does next."',
    '"description":"Set when this is the Claude plugin (Claude Code, Cowork), not the desktop extension."',
  ],
};

/** The same sentences with the name swapped: what the ChatGPT build must say, no more. */
const swapped = <T>(value: T): T =>
  JSON.parse(JSON.stringify(value).replaceAll('Claude', 'ChatGPT')) as T;

describe.each([undefined, 'mcpb', 'plugin'] as const)(
  'the assistant’s name on the server, build flag %s',
  (flag) => {
    it('says every sentence as before, word for word', async () => {
      const s = await said(flag);
      expect(s.config.ASSISTANT).toBe('Claude');
      expect(s.config.DISTRIBUTION).toBe(flag ?? 'mcpb');
      expect(s.start).toBe(CLAUDE.start);
      expect(s.read).toBe(CLAUDE.read);
      expect(s.dashboard).toBe(CLAUDE.dashboard);
      expect(s.children).toMatchObject(CLAUDE.children);
      expect(s.unread).toEqual(CLAUDE.unread);
      expect(s.transmit).toEqual(CLAUDE.transmit);
      expect(s.notRead).toEqual(CLAUDE.notRead);
      for (const description of CLAUDE.schema) expect(s.schema).toContain(description);
      // The plugin says which build it is, as before; the .mcpb says nothing.
      expect(s.schema).toContain('"distribution":{"description":"Set when');
      expect(s.schema).toContain('"const":"plugin"');
      expect(s.runtime.distribution).toBe(flag === 'plugin' ? 'plugin' : undefined);
      if (flag === 'plugin') expect(s.runtimeLine).toMatch(/, Claude plugin$/);
      else expect(s.runtimeLine).not.toMatch(/plugin$/);
      // Nothing is left unfilled, and nothing names the other assistant.
      expect(s.everything).not.toMatch(/\{assistant\}|ChatGPT/);
    });
  },
);

describe('the assistant’s name on the server, build flag chatgpt', () => {
  it('says the same sentences with ChatGPT’s name, and its own where Claude’s apps were named', async () => {
    const s = await said('chatgpt');
    expect(s.config.ASSISTANT).toBe('ChatGPT');
    expect(s.config.DISTRIBUTION).toBe('chatgpt');
    expect(s.start).toBe(swapped(CLAUDE.start));
    expect(s.read).toBe(swapped(CLAUDE.read));
    expect(s.children).toMatchObject(swapped(CLAUDE.children));
    expect(s.unread).toEqual(swapped(CLAUDE.unread));
    expect(s.transmit).toEqual(swapped(CLAUDE.transmit));
    expect(s.notRead).toEqual(swapped(CLAUDE.notRead));
    for (const description of CLAUDE.schema.slice(0, 3))
      expect(s.schema).toContain(swapped(description));
    // Written by hand for ChatGPT: the app by the name OpenAI gives it, and only what its
    // documentation establishes about where a view shows (docs/spikes/S6.md).
    expect(s.dashboard).toBe(
      "It only works on this computer while the ChatGPT desktop app is running. Keep it beside the chat: it shows in the conversation where the app allows it; if it does not show there, give the user this link to open in a browser on this computer. Then guide the user from the chat: the dashboard follows by itself, so don't open it again in this conversation. Its buttons are only shortcuts for what is easier by hand: adding documents, a one-tap confirm, the year switch.",
    );
    expect(s.schema).toContain(
      '"description":"Set when this is the ChatGPT plugin (the ChatGPT desktop app)."',
    );
    expect(s.schema).toContain('"const":"chatgpt"');
    expect(s.runtime.distribution).toBe('chatgpt');
    expect(s.runtimeLine).toMatch(/, ChatGPT plugin$/);
    expect(s.everything).not.toMatch(/\{assistant\}|\bClaude\b|\bCowork\b|\.mcpb\b/);
  });
});

describe('named', () => {
  it('fills the name into every text of a library’s result, and leaves the rest as it is', async () => {
    const { named } = await import('../src/config.js');
    const when = new Date(0);
    expect(
      named({
        text: { en: 'Ask {assistant}.', fr: 'Demandez à {assistant}.' },
        list: ['{assistant} and {assistant}', 3, null, undefined],
        amount: 12_345,
        ok: true,
        when,
      }),
    ).toEqual({
      text: { en: 'Ask Claude.', fr: 'Demandez à Claude.' },
      list: ['Claude and Claude', 3, null, undefined],
      amount: 12_345,
      ok: true,
      when,
    });
    expect(named(undefined)).toBeUndefined();
  });
});
