// The assistant's name in the dashboard (ui/src/shared/distribution.ts): with the build flag at
// 'mcpb' or 'plugin', every sentence that names the assistant is word for word what it was before
// the ChatGPT build existed; at 'chatgpt' the same sentences name ChatGPT, in the four languages,
// and no text of the dashboard names Claude, its apps or the .mcpb. Each case loads the texts anew,
// so they read the flag as their build would. (The in-chat view's own few texts are checked in the
// built package, scripts/check-chatgpt-plugin.mjs.)
import { afterEach, describe, expect, it, vi } from 'vitest';

type Lang = 'en' | 'fr' | 'de' | 'it';
type Texts = Record<string, Record<Lang, Record<string, string>>>;
const LANGS: Lang[] = ['en', 'fr', 'de', 'it'];

/** A no-break space, as French has before : and inside « » (written out, so it shows). */
const NB = String.fromCharCode(0xa0);

/**
 * Today's wording, as the .mcpb and the Claude plugin say it: a sample from every file of texts, in
 * each language, by "<file>:<key>". Never edit it to make a test pass.
 */
const CLAUDE: Record<Lang, Record<string, string>> = {
  en: {
    'i18n:lost':
      'Taxpresso is not answering. It stops when Claude Desktop closes. Ask Claude to open the dashboard again.',
    'i18n:act.claude.extract': 'Claude read {detail}',
    'pages:step.fillLead':
      'Claude fills it in with you, step by step. Or copy each value yourself.',
    'pages:doc.askRead': 'Ask Claude to read it',
    'pages:copiedAsk': 'Copied. Paste it in your chat with Claude.',
    'journey:next.start':
      'Drop what you have: last year’s declaration or tax bill, this year’s documents. Or just tell Claude about yourself.',
    'journey:line.save.ask': 'Ask Claude how to lower your tax',
    'copy:confirmFirst': 'Check it first, in “What Claude read in your documents”.',
    'docs:editFailed': 'Taxpresso is not answering. Ask Claude to open the dashboard again.',
    'planning:touWithheldLater':
      'Taxpresso shows the tax taken at source once it knows your salary, from your salary certificate or from what you tell Claude.',
    'reconcile:transmit3':
      'Press Transmettre (transmit) yourself. Neither Taxpresso nor Claude ever transmits your declaration.',
    'review:unknownYear':
      '{n} assessment in your documents has no tax year yet: tell Claude which year it is for.',
    'estimate:foot':
      'Computed on this computer by Taxpresso from the official documents. Ask Claude why any figure is what it is.',
  },
  fr: {
    'i18n:lost':
      'Taxpresso ne répond plus. Il s’arrête quand Claude Desktop se ferme. Demandez à Claude de rouvrir le tableau de bord.',
    'i18n:act.claude.extract': 'Claude a lu {detail}',
    'pages:step.fillLead':
      'Claude la remplit avec vous, étape par étape. Ou copiez chaque montant vous-même.',
    'pages:doc.askRead': 'Demander à Claude de le lire',
    'pages:copiedAsk': 'Copié. Collez-le dans votre chat avec Claude.',
    'journey:next.start': `Déposez ce que vous avez${NB}: la déclaration ou le bordereau de l’an dernier, les documents de cette année. Ou parlez simplement de vous à Claude.`,
    'journey:line.save.ask': 'Demandez à Claude comment payer moins d’impôt',
    'copy:confirmFirst': `Vérifiez-la d’abord, dans «${NB}Ce que Claude a lu dans vos documents${NB}».`,
    'docs:editFailed': 'Taxpresso ne répond plus. Demandez à Claude de rouvrir le tableau de bord.',
    'planning:touWithheldLater':
      'Taxpresso affiche l’impôt retenu à la source dès qu’il connaît votre salaire, par votre certificat de salaire ou ce que vous dites à Claude.',
    'reconcile:transmit3':
      'Appuyez vous-même sur Transmettre. Ni Taxpresso ni Claude ne transmettent jamais votre déclaration.',
    'review:unknownYear': `{n} avis de taxation dans vos documents n’a pas encore d’année fiscale${NB}: dites à Claude à quelle année il se rapporte.`,
    'estimate:foot':
      'Calculé sur cet ordinateur par Taxpresso à partir des documents officiels. Demandez à Claude pourquoi un montant est ce qu’il est.',
  },
  de: {
    'i18n:lost':
      'Taxpresso antwortet nicht mehr. Es stoppt, wenn Claude Desktop geschlossen wird. Bitte Claude, das Dashboard wieder zu öffnen.',
    'i18n:act.claude.extract': 'Claude hat {detail} gelesen',
    'pages:step.fillLead':
      'Claude füllt sie Schritt für Schritt mit dir aus. Oder kopier jeden Wert selbst.',
    'pages:doc.askRead': 'Claude bitten, es zu lesen',
    'pages:copiedAsk': 'Kopiert. Füg es in deinen Chat mit Claude ein.',
    'journey:next.start':
      'Leg hin, was du hast: die Steuererklärung oder Steuerrechnung vom letzten Jahr, die Dokumente von diesem Jahr. Oder erzähl Claude einfach von dir.',
    'journey:line.save.ask': 'Frag Claude, wie du weniger Steuern zahlst',
    'copy:confirmFirst': 'Prüfe es zuerst, unter «Was Claude in deinen Dokumenten gelesen hat».',
    'docs:editFailed': 'Taxpresso antwortet nicht. Bitte Claude, das Dashboard wieder zu öffnen.',
    'planning:touWithheldLater':
      'Taxpresso zeigt die Quellensteuer, sobald es deinen Lohn kennt: aus deinem Lohnausweis oder aus dem, was du Claude sagst.',
    'reconcile:transmit3':
      'Drück selbst auf Transmettre (übermitteln). Weder Taxpresso noch Claude übermitteln je deine Steuererklärung.',
    'review:unknownYear':
      '{n} Veranlagung in deinen Dokumenten hat noch kein Steuerjahr: Sag Claude, für welches Jahr sie ist.',
    'estimate:foot':
      'Von Taxpresso auf diesem Computer aus den offiziellen Dokumenten berechnet. Frag Claude, warum eine Zahl so ist, wie sie ist.',
  },
  it: {
    'i18n:lost':
      'Taxpresso non risponde più. Si ferma quando chiudi Claude Desktop. Chiedi a Claude di riaprire la dashboard.',
    'i18n:act.claude.extract': 'Claude ha letto {detail}',
    'pages:step.fillLead':
      'Claude la compila con te, passo per passo. Oppure copia tu ogni valore.',
    'pages:doc.askRead': 'Chiedi a Claude di leggerlo',
    'pages:copiedAsk': 'Copiato. Incollalo nella tua chat con Claude.',
    'journey:next.start':
      'Deposita quello che hai: la dichiarazione o la notifica di tassazione dell’anno scorso, i documenti di quest’anno. Oppure parla semplicemente di te a Claude.',
    'journey:line.save.ask': 'Chiedi a Claude come pagare meno imposte',
    'copy:confirmFirst': 'Controllalo prima, in “Cosa ha letto Claude nei tuoi documenti”.',
    'docs:editFailed': 'Taxpresso non risponde. Chiedi a Claude di riaprire la dashboard.',
    'planning:touWithheldLater':
      'Taxpresso mostra l’imposta trattenuta alla fonte quando conosce il tuo salario, dal tuo certificato di salario o da quello che dici a Claude.',
    'reconcile:transmit3':
      'Premi tu Transmettre (trasmetti). Né Taxpresso né Claude trasmettono mai la tua dichiarazione.',
    'review:unknownYear':
      '{n} decisione di tassazione nei tuoi documenti non ha ancora un anno fiscale: indica a Claude a quale anno si riferisce.',
    'estimate:foot':
      'Calcolato da Taxpresso su questo computer a partire dai documenti ufficiali. Chiedi a Claude perché una cifra è quella che è.',
  },
};

/** The app Taxpresso runs in, as ChatGPT's build names it in each language. */
const CHATGPT_APP: Record<Lang, string> = {
  en: 'the ChatGPT desktop app',
  fr: 'l’application de bureau ChatGPT',
  de: 'die ChatGPT-Desktop-App',
  it: 'l’app desktop di ChatGPT',
};
/** A sentence of Claude's build as ChatGPT's must say it: the names swapped, nothing else. */
const forChatgpt = (text: string, lang: Lang) =>
  text.replaceAll('Claude Desktop', CHATGPT_APP[lang]).replaceAll('Claude', 'ChatGPT');

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

/** Every text of the dashboard, by file, as a build with this flag has them. */
async function texts(flag?: 'mcpb' | 'plugin' | 'chatgpt'): Promise<Texts> {
  if (flag) vi.stubGlobal('__TAXPRESSO_DISTRIBUTION__', flag);
  else vi.unstubAllGlobals();
  vi.resetModules();
  return {
    i18n: (await import('./i18n')).messages,
    pages: (await import('./i18n-pages')).messages,
    journey: (await import('./i18n-journey')).messages,
    copy: (await import('./i18n-copy')).messages,
    docs: (await import('./i18n-docs')).messages,
    planning: (await import('./i18n-planning')).messages,
    reconcile: (await import('./i18n-reconcile')).messages,
    review: (await import('./i18n-review')).messages,
    estimate: (await import('./Estimate')).text,
  };
}
const sample = (all: Texts, lang: Lang, id: string) => {
  const [file, key] = id.split(':') as [string, string];
  return all[file]?.[lang][key];
};
/** Every text as "<file>.<lang>.<key>" and its words. */
const flat = (all: Texts) =>
  Object.entries(all).flatMap(([file, byLang]) =>
    LANGS.flatMap((lang) =>
      Object.entries(byLang[lang]).map(([key, text]) => [`${file}.${lang}.${key}`, text] as const),
    ),
  );

describe.each([undefined, 'mcpb', 'plugin'] as const)(
  'the assistant’s name in the dashboard, build flag %s',
  (flag) => {
    it.each(LANGS)('says every sampled sentence as before, word for word (%s)', async (lang) => {
      const all = await texts(flag);
      for (const [id, text] of Object.entries(CLAUDE[lang]))
        expect(sample(all, lang, id), id).toBe(text);
    });

    it('never names ChatGPT', async () => {
      const naming = flat(await texts(flag)).filter(([, text]) => /ChatGPT/.test(text));
      expect(naming).toEqual([]);
    });
  },
);

describe('the assistant’s name in the dashboard, build flag chatgpt', () => {
  it('is its own build: ChatGPT by name, and no donation menu, as in the Claude plugin', async () => {
    vi.stubGlobal('__TAXPRESSO_DISTRIBUTION__', 'chatgpt');
    vi.resetModules();
    const d = await import('../shared/distribution');
    expect(d.DISTRIBUTION).toBe('chatgpt');
    expect(d.ASSISTANT).toBe('ChatGPT');
    expect(d.ASSISTANT_APP).toEqual(CHATGPT_APP);
    expect(d.showsDonationMenu()).toBe(false);
    expect(d.showsDonationMenu('chatgpt')).toBe(false);
  });

  it.each(LANGS)('says the sampled sentences with ChatGPT’s name (%s)', async (lang) => {
    const all = await texts('chatgpt');
    for (const [id, text] of Object.entries(CLAUDE[lang]))
      expect(sample(all, lang, id), id).toBe(forChatgpt(text, lang));
    expect(sample(all, lang, 'i18n:lost')).toContain(CHATGPT_APP[lang]);
  });

  it('differs from Claude’s build by the names alone, in every text, and never names Claude', async () => {
    const claude = new Map(flat(await texts()));
    const chatgpt = flat(await texts('chatgpt'));
    expect(chatgpt).toHaveLength(claude.size);
    let renamed = 0;
    for (const [id, text] of chatgpt) {
      const lang = id.split('.')[1] as Lang;
      const before = claude.get(id);
      expect(before, id).toBeDefined();
      expect(text, id).toBe(forChatgpt(before!, lang));
      expect(text, id).not.toMatch(/\bClaude\b|\bCowork\b|\.mcpb\b/);
      if (text !== before) renamed += 1;
    }
    // The same number of sentences in each language name the assistant.
    expect(renamed).toBeGreaterThan(0);
    expect(renamed % LANGS.length).toBe(0);
  });
});
