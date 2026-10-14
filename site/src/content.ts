// Website copy: the home page and the Get started page (the guides are in guides.ts). French
// first (Geneva), then English,
// German, Italian, Spanish and Portuguese; a native speaker reviews each before launch (SPEC.md
// section 1). Second person, plain words, no en or em dashes, official French terms next to their
// gloss. French says vous; German, Italian, Spanish and Portuguese use the informal you (du, tu,
// tú, tu), with Swiss spelling in German (ss, never ß). No tax amounts or rules here: those live
// in the product, each with its source. Links use [text](https://...) and are rendered by
// render.ts. Canton names come from cantons.ts, never typed here: Geneva is named only where a
// sentence is about Geneva (the example receipt, Geneva's PDF check, where Taxpresso is built).

import { type CantonStatus, type CantonWhen, cantonNames, listOf } from './cantons.ts';

const NB = String.fromCharCode(0xa0); // French spacing before : ? ! ; and inside « »

export type Lang = 'fr' | 'en' | 'de' | 'it' | 'es' | 'pt';
export type Tone = 'ok' | 'confirm' | 'plain';
/** Latte art drawn in each principle's cup (render.ts). */
export type Art = 'heart' | 'tulip' | 'dot' | 'rosetta' | 'check' | 'swirl';

/** Where the site lives: canonical links, hreflang links, the sitemap and structured data. */
export const BASE_URL = 'https://www.taxpresso.ch';

/** The public repository, where releases, issues and the contributing guide live. */
export const SOURCE_URL = 'https://github.com/nisheetpatel/taxpresso';
export const DOWNLOAD_URL = `${SOURCE_URL}/releases/latest`;
export const CONTACT_EMAIL = 'hello@taxpresso.ch';
export const ISSUE_URL = {
  bug: `${SOURCE_URL}/issues/new?template=bug.yml`,
  idea: `${SOURCE_URL}/issues/new?template=idea.yml`,
  /** The pinned votes: one comment per canton or language, a 👍 is a vote. */
  canton: `${SOURCE_URL}/issues/1`,
  language: `${SOURCE_URL}/issues/2`,
  code: `${SOURCE_URL}/blob/main/CONTRIBUTING.md`,
  contact: `mailto:${CONTACT_EMAIL}`,
};

/** Tips go straight to Precious Plastic Bugoma; Taxpresso never handles money (SPEC.md section 12). */
export const DONATE_URL = 'https://www.preciousplasticbugoma.com/';
/** A review on GitHub: an issue form for a few words, which we may quote with permission. */
export const REVIEW_URL = `${SOURCE_URL}/issues/new?template=review.yml`;
/** The association's entry in the Swiss business register (UID). */
const PPB_REGISTER = 'https://www.uid.admin.ch/Detail.aspx?uid_id=CHE-185.673.320';

/**
 * The answer to "Which cantons work?", written from cantons.ts: the most complete canton, the
 * previews, the ones coming next, then the vote. A canton added there shows up here in every
 * language.
 */
function cantonsAnswer(lang: Lang): string {
  const names = (group: CantonStatus | CantonWhen) => cantonNames(lang, group);
  const list = (items: string[]) => listOf(lang, items);
  const one = (items: string[]) => items.length === 1;
  const complete = names('complete');
  const preview = names('preview');
  // If nothing is "next", the "then" cantons are next.
  const soon = names('next');
  const [next, then] = soon.length ? [soon, names('then')] : [names('then'), []];
  const after = (word: string) => (then.length ? `, ${word} ${list(then)}` : '');
  const vote = (text: string) => `[${text}](${ISSUE_URL.canton}).`;
  const sentences: Record<Lang, (string | false)[]> = {
    en: [
      `${list(complete)} ${one(complete) ? 'is' : 'are'} the most complete.`,
      preview.length > 0 &&
        `${list(preview)} ${one(preview) ? 'works' : 'work'} too, as a preview.`,
      next.length > 0 && `Coming next: ${list(next)}${after('then')}.`,
      vote('Vote for your canton'),
    ],
    fr: [
      `${list(complete)} ${one(complete) ? 'est le canton le plus complet' : 'sont les cantons les plus complets'}.`,
      preview.length > 0 &&
        `${list(preview)} ${one(preview) ? 'fonctionne' : 'fonctionnent'} aussi, en avant-première.`,
      next.length > 0 && `À venir${NB}: ${list(next)}${after('puis')}.`,
      vote('Votez pour votre canton'),
    ],
    de: [
      `${list(complete)} ${one(complete) ? 'ist' : 'sind'} am vollständigsten.`,
      preview.length > 0 &&
        `${list(preview)} ${one(preview) ? 'funktioniert' : 'funktionieren'} auch, als Vorschau.`,
      next.length > 0 && `Als Nächstes: ${list(next)}${after('danach')}.`,
      vote('Stimm für deinen Kanton ab'),
    ],
    it: [
      `${list(complete)} ${one(complete) ? 'è il cantone più completo' : 'sono i cantoni più completi'}.`,
      preview.length > 0 &&
        `Anche ${list(preview)} ${one(preview) ? 'funziona' : 'funzionano'}, in anteprima.`,
      next.length > 0 && `In arrivo: ${list(next)}${after('poi')}.`,
      vote('Vota il tuo cantone'),
    ],
    es: [
      `${list(complete)} ${one(complete) ? 'es el cantón más completo' : 'son los cantones más completos'}.`,
      preview.length > 0 &&
        `${list(preview)} también ${one(preview) ? 'funciona' : 'funcionan'}, como versión preliminar.`,
      next.length > 0 && `Próximamente: ${list(next)}${after('luego')}.`,
      vote('Vota por tu cantón'),
    ],
    pt: [
      `${list(complete)} ${one(complete) ? 'é o cantão mais completo' : 'são os cantões mais completos'}.`,
      preview.length > 0 &&
        `${list(preview)} também ${one(preview) ? 'funciona' : 'funcionam'}, em pré-visualização.`,
      next.length > 0 && `Em breve: ${list(next)}${after('depois')}.`,
      vote('Vota no teu cantão'),
    ],
  };
  return sentences[lang].filter(Boolean).join(' ');
}

const fr = {
  htmlTitle: `Taxpresso${NB}: vos impôts, le temps d’un espresso`,
  metaDescription:
    'Taxpresso prépare votre déclaration d’impôt suisse avec Claude, sur votre ordinateur. Gratuit et open source.',
  skip: 'Aller au contenu',
  navLabel: 'Sections',
  langLabel: 'Langue',
  suggestLanguage: 'Proposer une langue',
  nav: {
    how: 'Comment ça marche',
    principles: 'Principes',
    faq: 'Questions',
    guides: 'Guides',
    start: 'Commencer',
  },

  tagline: 'Vos impôts, le temps d’un espresso.',
  lead: 'Répondez à quelques questions. Taxpresso s’occupe du reste.',
  available: 'Disponible pour les déclarations 2026.',
  getStarted: 'Commencer',
  seeHow: 'Voir comment ça marche',
  badges: { swiss: 'Swiss made', open: 'Gratuit et open source' },

  ticket: {
    caption: 'Exemple de ticket pour une déclaration préparée avec Taxpresso',
    sub: 'Déclaration 2026, Genève',
    lines: [
      ['Certificat de salaire', 'vérifié', 'ok'],
      ['e-relevé fiscal (banque)', 'vérifié', 'ok'],
      ['Attestation 3e pilier A', 'vérifiée', 'ok'],
      ['Frais de garde', 'à confirmer', 'confirm'],
      ['Déductions', 'toutes, en CHF', 'plain'],
      ['Déclaration en ligne', 'remplie', 'plain'],
      ['Transmission', 'par vous', 'plain'],
    ] as [string, string, Tone][],
    totalLabel: 'Temps total',
    totalValue: '1 espresso',
    footer: 'Rien ne quitte votre ordinateur.',
  },

  how: {
    title: 'Comment ça marche',
    steps: [
      [
        'Répondez à quelques questions',
        'Dans Claude Desktop, Claude vous pose quelques questions simples, une à la fois, dans votre langue. Ajoutez vos documents quand vous les avez : certificats de salaire, relevés bancaires, attestations.',
      ],
      [
        'Voyez ce que vous économisez',
        'Taxpresso calcule votre déclaration avec et sans chaque déduction, et vous montre ce que chacune vous fait gagner en francs. Vous choisissez.',
      ],
      [
        'Vérifiez, transmettez',
        'Claude remplit pour vous la déclaration en ligne officielle de votre canton, dans Claude in Chrome ou son navigateur intégré. Vous vous connectez, vous vérifiez et vous la transmettez vous-même. À Genève, Taxpresso compare aussi le PDF officiel à vos chiffres.',
      ],
    ] as [string, string][],
  },

  principles: {
    title: 'Nos principes',
    lead: 'Rien ne quitte votre ordinateur, sauf ce que vous partagez avec l’IA que vous utilisez.',
    items: [
      [
        'Personne n’a accès à vos données',
        'Ni nous, ni personne. Pas de serveur, pas de compte, rien n’est envoyé sur internet. Vos documents restent dans un dossier sur votre ordinateur.',
        'heart',
      ],
      [
        'Sauf l’IA que vous utilisez',
        'Aujourd’hui, c’est Claude, avec votre propre compte : il voit ce que vous partagez dans la conversation. ChatGPT n’est pas encore disponible.',
        'tulip',
      ],
      [
        'Vos réglages, pas les nôtres',
        'Dans les paramètres de confidentialité de Claude, vous décidez si vos conversations peuvent servir à l’améliorer, et vous les supprimez quand vous voulez.',
        'dot',
      ],
      [
        'Les règles officielles',
        'Chaque montant suit les guides fiscaux de votre canton et de la Confédération, et cite sa page. Claude explique, il ne calcule pas.',
        'rosetta',
      ],
      [
        'C’est vous qui transmettez',
        'Claude remplit la déclaration en ligne pour vous. Vous vous connectez, vous relisez et vous la transmettez vous-même. Claude ne tape jamais vos mots de passe.',
        'check',
      ],
      [
        'Gratuit et open source',
        'Taxpresso appartient à sa communauté, sous licence GNU AGPL. Chacun peut vérifier ce qu’il fait et aider à l’améliorer.',
        'swirl',
      ],
    ] as [string, string, Art][],
    swiss: [
      'Swiss made',
      'Conçu à Genève, pour les personnes imposées en Suisse. Indépendant de toute administration fiscale et d’Anthropic.',
    ] as [string, string],
  },

  support: {
    title: 'Gratuit et open source',
    text: 'Taxpresso est gratuit et open source. S’il vous a fait gagner un après-midi, le plus beau merci ne coûte rien : un avis, pour que d’autres le trouvent aussi.',
    voices: {
      title: 'Ce qu’on en dit',
      more: `Le vôtre est le bienvenu${NB}: c’est l’article gratuit du menu.`,
      first: `Soyez le premier ou la première${NB}: laissez un avis, c’est l’article gratuit du menu.`,
    },
    tip: {
      title: 'Le menu des pourboires',
      note: 'Chaque pourboire va à Precious Plastic Bugoma, une association genevoise à but non lucratif active autour de la forêt de Bugoma, en Ouganda. Taxpresso ne garde rien.',
      button: 'Laisser un pourboire',
      review: {
        label: 'Laisser un avis',
        amount: 'gratuit',
        star: 'Une étoile sur GitHub',
        github: 'Un avis sur GitHub',
        words: 'Quelques mots',
        name: 'Prénom à afficher (facultatif)',
        quote: 'Vous pouvez citer cet avis sur taxpresso.ch',
        send: 'Envoyer',
        thanks: `Merci${NB}! Nous lisons chaque avis.`,
        error: 'L’envoi n’a pas abouti. Réessayez dans un moment.',
      },
      menu: [
        ['Espresso', 'CHF 2.50'],
        ['Cappuccino', 'CHF 5'],
        ['Dirty chai latte', 'CHF 7.50'],
        ['Affogato', 'CHF 10'],
        ['Café et gâteau pour deux', 'CHF 25'],
        ['Une tournée pour la table', 'CHF 50'],
        ['À votre goût', 'le montant de votre choix'],
      ] as [string, string][],
    },
    ppb: `Precious Plastic Bugoma est une association à but non lucratif basée à Vernier, Genève ([inscrite sous CHE-185.673.320](${PPB_REGISTER})), qui recycle les déchets plastiques autour de la forêt de Bugoma, en Ouganda. Taxpresso est conçu par des membres de son équipe.`,
  },

  contribute: {
    title: 'Améliorez-le avec nous',
    lead: 'Taxpresso se construit au grand jour, sur GitHub (un compte gratuit suffit).',
    items: [
      [
        'Signaler un bug',
        `Quelque chose cloche ou n’est pas clair${NB}? Dites-nous ce que vous attendiez. N’y mettez jamais de vraies données fiscales.`,
        'bug',
      ],
      [
        'Proposer une idée',
        'Une fonction, un canton, un mot plus clair\u00a0: nous lisons tout.',
        'idea',
      ],
      [
        'Demander votre canton',
        'Votez sur GitHub pour le prochain canton que vous voulez.',
        'canton',
      ],
      [
        'Votez pour votre langue',
        'Votez pour la prochaine langue, ou proposez de traduire.',
        'language',
      ],
      [
        'Écrire du code',
        'Lisez le guide de contribution, choisissez un ticket et proposez vos changements.',
        'code',
      ],
      [
        'Écrivez-nous',
        `Une question, une idée ou un petit mot${NB}: hello@taxpresso.ch`,
        'contact',
      ],
    ] as [string, string, keyof typeof ISSUE_URL][],
  },

  faq: {
    title: 'Questions',
    more: `Une autre question${NB}? [Lisez nos guides](/fr/guides/), avec les liens vers les pages officielles.`,
    items: [
      [
        `Faut-il Claude${NB}?`,
        'Oui, pour l’instant. Taxpresso s’installe dans [Claude Desktop](https://claude.com/download) (Linux, macOS ou Windows) et fonctionne avec votre propre compte Claude. ChatGPT n’est pas encore disponible.',
      ],
      [`Quels cantons sont disponibles${NB}?`, cantonsAnswer('fr')],
      [
        `Taxpresso transmet-il ma déclaration${NB}?`,
        'Presque. Claude remplit pour vous la déclaration en ligne officielle de votre canton, dans Claude in Chrome ou dans son navigateur intégré. Vous vous connectez, vous la vérifiez et vous la transmettez vous-même. Claude ne tape jamais vos mots de passe.',
      ],
      [
        `Est-ce un service officiel${NB}?`,
        'Non. Taxpresso est indépendant : il n’est lié ni à une administration fiscale cantonale, ni à l’Administration fédérale des contributions, ni à Anthropic.',
      ],
      [
        `Pourquoi est-ce gratuit${NB}?`,
        'Parce que les impôts devraient être simples et gratuits. Taxpresso est open source (licence GNU AGPL) : chacun peut vérifier ce qu’il fait, et aider à l’améliorer, à le traduire ou à ajouter un canton. Personne ne peut en faire une version fermée.',
      ],
      [
        `Et si un document manque${NB}?`,
        'Vous pouvez avancer avec une estimation. Taxpresso la signale partout, et votre déclaration n’est prête qu’une fois chaque estimation remplacée par un document ou confirmée par vous.',
      ],
      [
        `Dans quelles langues${NB}?`,
        'Claude vous répond dans la langue où vous écrivez. L’application est en français, en anglais, en allemand et en italien, puis viendront l’espagnol et le portugais. Les termes officiels restent dans la langue du formulaire de votre canton.',
      ],
    ] as [string, string][],
  },

  finePrint: {
    title: 'Les petites lignes, en clair',
    text: 'Taxpresso est un outil gratuit, fourni tel quel, sans aucune garantie. Nous ne sommes pas conseillers fiscaux : nous l’avons construit justement pour ne plus nous soucier de nos propres impôts. Taxpresso vous aide à préparer votre déclaration, mais c’est vous qui décidez de son contenu, et la déclaration que vous transmettez relève de votre responsabilité. En cas de doute, demandez à l’administration fiscale de votre canton ou à une fiduciaire.',
  },

  start: {
    htmlTitle: 'Commencer avec Taxpresso',
    metaDescription:
      'Installez Taxpresso dans Claude Desktop et préparez votre déclaration d’impôt suisse, pas à pas.',
    title: 'Commencer',
    lead: 'Taxpresso est une extension pour Claude Desktop. Elle s’installe en une minute, et tout reste sur votre ordinateur.',
    download: 'Télécharger Taxpresso',
    downloadNote: 'Gratuit. Un seul fichier, pour Claude Desktop.',
    platforms: ['Linux (bêta)', 'macOS', 'Windows'],
    needsTitle: 'Ce qu’il vous faut',
    guides: `Quels documents rassembler, le 3e pilier A, la TOU, l’avis de taxation${NB}: [nos guides](/fr/guides/) expliquent l’essentiel pour Genève, avec les liens officiels.`,
    needs: [
      [
        'Claude Desktop',
        'Sur Linux, macOS ou Windows, connecté à votre compte Claude. [Télécharger Claude Desktop](https://claude.com/download)',
      ],
      ['Vos documents', 'En PDF ou en photo, dès que vous les avez. Vous pouvez commencer sans.'],
      [
        'Un navigateur pour Claude',
        'Pour remplir la déclaration officielle : Claude in Chrome, ou le navigateur intégré de Claude.',
      ],
    ] as [string, string][],
    stepsTitle: 'En six étapes',
    steps: [
      [
        'Téléchargez Taxpresso',
        'Un seul fichier gratuit, taxpresso-version.mcpb, sur la page des versions du projet.',
      ],
      [
        'Installez-le',
        'Ouvrez Claude Desktop, puis double-cliquez sur le fichier. Claude Desktop vous montre Taxpresso et ses outils : cliquez sur Installer. Si rien ne se passe, ouvrez Paramètres, puis Extensions, et glissez le fichier sur cette page.',
      ],
      [
        'Gardez votre dossier',
        'Claude Desktop propose un dossier pour vos documents fiscaux, Documents/Taxpresso. Gardez-le : vos réponses et vos documents y restent, sur votre ordinateur. Vérifiez que Taxpresso est activé.',
      ],
      [
        'Dites bonjour',
        'Ouvrez une nouvelle conversation et écrivez la phrase ci-dessous. La première fois, Claude vous demande la permission d’utiliser Taxpresso : acceptez.',
      ],
      [
        'Répondez et ajoutez vos documents',
        'Claude vous pose quelques questions simples, une à la fois, à commencer par votre canton. Pour répondre en cliquant ou déposer vos documents, demandez à Claude d’ouvrir votre tableau de bord.',
      ],
      [
        'Transmettez',
        'Quand tout est prêt, Claude remplit la déclaration en ligne officielle de votre canton dans Claude in Chrome ou son navigateur intégré. Vous vous connectez, vous vérifiez et vous la transmettez vous-même.',
      ],
    ] as [string, string][],
    prompt: 'Aide-moi à faire mes impôts avec Taxpresso.',
    promptLabel: 'À écrire dans Claude',
    mockInstall: 'Installer',
    mockExtension: 'Votre déclaration d’impôt, sur votre ordinateur.',
    notes: [
      [
        'Vos réglages',
        'Rien ne quitte votre ordinateur, sauf ce que vous partagez avec Claude. Dans les paramètres de Claude, rubrique Confidentialité, vous décidez si vos conversations peuvent servir à l’améliorer. Supprimez-les une fois votre déclaration faite.',
      ],
      [
        'Avant le 31 décembre',
        'Demandez à Claude ce qu’un versement au 3e pilier A vous ferait économiser cette année. Un salaire approximatif suffit.',
      ],
      [
        'Mettre à jour',
        'Pour installer une nouvelle version, retirez Taxpresso dans Paramètres, Extensions, puis installez le nouveau fichier. Votre dossier reste tel quel.',
      ],
      [
        'Un souci ?',
        `Quelque chose ne marche pas comme prévu${NB}? [Dites-le-nous](${ISSUE_URL.bug}), sans jamais y mettre de vraies données fiscales.`,
      ],
    ] as [string, string][],
    back: 'Retour à l’accueil',
  },

  footer: {
    independent:
      'Taxpresso est un projet logiciel indépendant, gratuit et open source. Il n’est ni affilié à une fiduciaire, un cabinet comptable ou une société de services fiscaux, en Suisse ou ailleurs, ni sponsorisé par l’une d’elles, et il n’est lié ni à une administration fiscale cantonale, ni à l’Administration fédérale des contributions, ni à Anthropic. Claude est une marque d’Anthropic.',
    noTracking: 'Ce site n’utilise ni cookies, ni traceurs, ni polices externes.',
    source: 'Code source',
  },
};

export type Copy = typeof fr;

const en: Copy = {
  htmlTitle: 'Taxpresso: your taxes, done over an espresso',
  metaDescription:
    'Taxpresso prepares your Swiss tax return with Claude, on your own computer. Free and open source.',
  skip: 'Skip to content',
  navLabel: 'Sections',
  langLabel: 'Language',
  suggestLanguage: 'Suggest a language',
  nav: {
    how: 'How it works',
    principles: 'Principles',
    faq: 'Questions',
    guides: 'Guides',
    start: 'Get started',
  },

  tagline: 'Your taxes, done over an espresso.',
  lead: 'Answer a few questions. Taxpresso does the rest.',
  available: 'Available for 2026 tax returns.',
  getStarted: 'Get started',
  seeHow: 'See how it works',
  badges: { swiss: 'Swiss made', open: 'Free and open source' },

  ticket: {
    caption: 'Example receipt for a tax return prepared with Taxpresso',
    sub: '2026 return, Geneva',
    lines: [
      ['Salary certificate', 'verified', 'ok'],
      ['Bank e-tax statement', 'verified', 'ok'],
      ['Pillar 3a certificate', 'verified', 'ok'],
      ['Childcare costs', 'to confirm', 'confirm'],
      ['Deductions', 'all, in CHF', 'plain'],
      ['Online declaration', 'filled in', 'plain'],
      ['Transmit', 'by you', 'plain'],
    ],
    totalLabel: 'Total time',
    totalValue: '1 espresso',
    footer: 'Nothing leaves your computer.',
  },

  how: {
    title: 'How it works',
    steps: [
      [
        'Answer a few questions',
        'In Claude Desktop, Claude asks you a few simple questions, one at a time, in your language. Add your documents whenever you have them: salary certificates, bank statements, attestations.',
      ],
      [
        'See what you can save',
        'Taxpresso works out your return with and without each deduction, and shows what each one saves you in francs. You choose.',
      ],
      [
        'Check and file',
        'Claude fills in your canton’s official online declaration for you, in Claude in Chrome or its built-in browser. You sign in, check it and submit it yourself. In Geneva, Taxpresso also checks the official PDF against your numbers.',
      ],
    ],
  },

  principles: {
    title: 'Our principles',
    lead: 'Nothing leaves your computer, except what you share with the AI you use.',
    items: [
      [
        'Nobody has access to your data',
        'Not us, not anyone. No server, no account, nothing sent over the internet. Your documents stay in a folder on your computer.',
        'heart',
      ],
      [
        'Except the AI you use',
        'Today that’s Claude, under your own account: it sees what you share in the conversation. ChatGPT isn’t available yet.',
        'tulip',
      ],
      [
        'Your settings, not ours',
        'In Claude’s privacy settings, you decide whether your chats may help improve it, and you delete them whenever you like.',
        'dot',
      ],
      [
        'Official rules only',
        'Every amount follows your canton’s and the federal tax guides, and cites its page. Claude explains; it doesn’t do the math.',
        'rosetta',
      ],
      [
        'You file it yourself',
        'Claude fills in the online declaration for you. You sign in, review it and submit it yourself. Claude never types your passwords.',
        'check',
      ],
      [
        'Free and open source',
        'Taxpresso belongs to its community, under the GNU AGPL. Anyone can check what it does and help improve it.',
        'swirl',
      ],
    ],
    swiss: [
      'Swiss made',
      'Built in Geneva, for people taxed in Switzerland. Independent of any tax administration and of Anthropic.',
    ],
  },

  support: {
    title: 'Free and open source',
    text: 'Taxpresso is free and open source. If it saved you an afternoon, the nicest thanks costs nothing: a review, so others find it too.',
    voices: {
      title: 'What people say',
      more: 'Yours is welcome too: it’s the free item on the menu.',
      first: 'Be the first: leave a review, it’s the free item on the menu.',
    },
    tip: {
      title: 'The tip menu',
      note: 'Every tip goes to Precious Plastic Bugoma, a Geneva-based non-profit working around Bugoma forest in Uganda. Taxpresso keeps nothing.',
      button: 'Leave a tip',
      review: {
        label: 'Leave a review',
        amount: 'free',
        star: 'A star on GitHub',
        github: 'A review on GitHub',
        words: 'A few words',
        name: 'Name to show (optional)',
        quote: 'You may quote this on taxpresso.ch',
        send: 'Send',
        thanks: 'Thank you! We read every review.',
        error: 'That didn’t go through. Try again in a moment.',
      },
      menu: [
        ['Espresso', 'CHF 2.50'],
        ['Cappuccino', 'CHF 5'],
        ['Dirty chai latte', 'CHF 7.50'],
        ['Affogato', 'CHF 10'],
        ['Coffee and cake for two', 'CHF 25'],
        ['A round for the table', 'CHF 50'],
        ['Your own order', 'any amount'],
      ],
    },
    ppb: `Precious Plastic Bugoma is a non-profit association based in Vernier, Geneva ([registered as CHE-185.673.320](${PPB_REGISTER})), that recycles plastic waste around Bugoma forest in Uganda. Taxpresso is built by members of its team.`,
  },

  contribute: {
    title: 'Make it better with us',
    lead: 'Taxpresso is built in the open, on GitHub (a free account is all you need).',
    items: [
      [
        'Report a bug',
        'Something wrong or confusing? Tell us what you expected. Never include real tax data.',
        'bug',
      ],
      ['Suggest an idea', 'A feature, a canton, a clearer word: we read everything.', 'idea'],
      ['Ask for your canton', 'Vote on GitHub for the canton you want next.', 'canton'],
      ['Vote for your language', 'Vote for the next language, or offer to translate.', 'language'],
      ['Write code', 'Read the contributing guide, pick an issue and send your changes.', 'code'],
      ['Write to us', 'A question, an idea or a kind word: hello@taxpresso.ch', 'contact'],
    ],
  },

  faq: {
    title: 'Questions',
    more: 'Another question? [Read our guides](/en/guides/), with links to the official pages.',
    items: [
      [
        'Do I need Claude?',
        'Yes, for now. Taxpresso installs in [Claude Desktop](https://claude.com/download) (Linux, macOS or Windows) and works with your own Claude account. ChatGPT isn’t available yet.',
      ],
      ['Which cantons work?', cantonsAnswer('en')],
      [
        'Does Taxpresso file my return?',
        'Almost. Claude fills in your canton’s official online declaration for you, in Claude in Chrome or its built-in browser. You sign in, check it and submit it yourself. Claude never types your passwords.',
      ],
      [
        'Is this an official service?',
        'No. Taxpresso is independent: it isn’t affiliated with any cantonal tax administration, the Federal Tax Administration or Anthropic.',
      ],
      [
        'Why is it free?',
        'Because taxes should be simple and free. Taxpresso is open source (GNU AGPL license): anyone can check what it does, and help improve it, translate it or add a canton. Nobody can take the code and close it.',
      ],
      [
        'What if a document is missing?',
        'You can carry on with an estimate. Taxpresso flags it everywhere, and your return is only ready once each estimate is replaced by a document or confirmed by you.',
      ],
      [
        'Which languages?',
        'Claude answers in the language you write in. The app is in English, French, German and Italian, with Spanish and Portuguese to come. Official terms stay in the language of your canton’s form.',
      ],
    ],
  },

  finePrint: {
    title: 'The fine print, in plain words',
    text: 'Taxpresso is a free tool, provided as is, with no warranty. We’re not tax advisers: we built it precisely so we’d stop worrying about our own taxes. Taxpresso helps you prepare your return, but you decide what goes in it, and the return you transmit is your responsibility. When in doubt, ask your canton’s tax office or a fiduciary.',
  },

  start: {
    htmlTitle: 'Get started with Taxpresso',
    metaDescription:
      'Install Taxpresso in Claude Desktop and prepare your Swiss tax return, step by step.',
    title: 'Get started',
    lead: 'Taxpresso is an extension for Claude Desktop. It installs in a minute, and everything stays on your computer.',
    download: 'Download Taxpresso',
    downloadNote: 'Free. One file, for Claude Desktop.',
    platforms: ['Linux (beta)', 'macOS', 'Windows'],
    needsTitle: 'What you need',
    guides:
      'Which documents to gather, pillar 3a, TOU, your assessment: [our guides](/en/guides/) explain the basics for Geneva, with the official links.',
    needs: [
      [
        'Claude Desktop',
        'On Linux, macOS or Windows, signed in to your Claude account. [Get Claude Desktop](https://claude.com/download)',
      ],
      ['Your documents', 'As PDFs or photos, whenever you have them. You can start without them.'],
      [
        'A browser for Claude',
        'To fill in the official declaration: Claude in Chrome, or Claude’s built-in browser.',
      ],
    ],
    stepsTitle: 'Six steps',
    steps: [
      [
        'Download Taxpresso',
        'One free file, taxpresso-version.mcpb, from the project’s releases page.',
      ],
      [
        'Install it',
        'Open Claude Desktop, then double-click the file. Claude Desktop shows Taxpresso and its tools: click Install. If nothing happens, open Settings, then Extensions, and drag the file onto that page.',
      ],
      [
        'Keep your folder',
        'Claude Desktop suggests a folder for your tax documents, Documents/Taxpresso. Keep it: your answers and documents stay there, on your computer. Make sure Taxpresso is switched on.',
      ],
      [
        'Say hello',
        'Open a new chat and write the sentence below. The first time, Claude asks for your permission to use Taxpresso: allow it.',
      ],
      [
        'Answer and add your documents',
        'Claude asks a few simple questions, one at a time, starting with your canton. To answer by clicking or to drop in your documents, ask Claude to open your dashboard.',
      ],
      [
        'File',
        'When everything is ready, Claude fills in your canton’s official online declaration in Claude in Chrome or its built-in browser. You sign in, check it and submit it yourself.',
      ],
    ],
    prompt: 'Help me with my taxes using Taxpresso.',
    promptLabel: 'Write this in Claude',
    mockInstall: 'Install',
    mockExtension: 'Your tax return, on your computer.',
    notes: [
      [
        'Your settings',
        'Nothing leaves your computer except what you share with Claude. In Claude’s settings, under Privacy, you decide whether your chats may help improve Claude. Delete them once your return is done.',
      ],
      [
        'Before 31 December',
        'Ask Claude what a pillar 3a payment would save you this year. A rough salary is enough.',
      ],
      [
        'Updating',
        'To install a new version, remove Taxpresso under Settings, Extensions, then install the new file. Your folder stays as it is.',
      ],
      [
        'Something wrong?',
        `Something not working as it should? [Tell us](${ISSUE_URL.bug}), and never include real tax data.`,
      ],
    ],
    back: 'Back to the home page',
  },

  footer: {
    independent:
      'Taxpresso is an independent, free and open-source software project. It is not affiliated with, sponsored by or associated with any accounting firm, fiduciary or tax-services company, in Switzerland or elsewhere, nor with any cantonal tax administration, the Federal Tax Administration or Anthropic. Claude is a trademark of Anthropic.',
    noTracking: 'This site uses no cookies, no trackers and no external fonts.',
    source: 'Source code',
  },
};

const de: Copy = {
  htmlTitle: 'Taxpresso: deine Steuern, erledigt bei einem Espresso',
  metaDescription:
    'Taxpresso erstellt deine Schweizer Steuererklärung mit Claude, auf deinem eigenen Computer. Kostenlos und Open Source.',
  skip: 'Zum Inhalt',
  navLabel: 'Abschnitte',
  langLabel: 'Sprache',
  suggestLanguage: 'Sprache vorschlagen',
  nav: {
    how: 'So funktioniert’s',
    principles: 'Grundsätze',
    faq: 'Fragen',
    guides: 'Ratgeber',
    start: 'Loslegen',
  },

  tagline: 'Deine Steuern, erledigt bei einem Espresso.',
  lead: 'Beantworte ein paar Fragen. Taxpresso macht den Rest.',
  available: 'Verfügbar für die Steuererklärung 2026.',
  getStarted: 'Loslegen',
  seeHow: 'So funktioniert’s',
  badges: { swiss: 'Swiss made', open: 'Kostenlos und Open Source' },

  ticket: {
    caption: 'Beispielbeleg für eine Steuererklärung mit Taxpresso',
    sub: 'Steuererklärung 2026, Genf',
    lines: [
      ['Lohnausweis', 'geprüft', 'ok'],
      ['E-Steuerauszug (Bank)', 'geprüft', 'ok'],
      ['Bescheinigung Säule 3a', 'geprüft', 'ok'],
      ['Kinderbetreuung', 'zu bestätigen', 'confirm'],
      ['Abzüge', 'alle, in CHF', 'plain'],
      ['Online-Erklärung', 'ausgefüllt', 'plain'],
      ['Übermittlung', 'von dir', 'plain'],
    ],
    totalLabel: 'Gesamtzeit',
    totalValue: '1 Espresso',
    footer: 'Nichts verlässt deinen Computer.',
  },

  how: {
    title: 'So funktioniert’s',
    steps: [
      [
        'Beantworte ein paar Fragen',
        'In Claude Desktop stellt dir Claude ein paar einfache Fragen, eine nach der anderen, in deiner Sprache. Leg deine Dokumente dazu, sobald du sie hast: Lohnausweise, Bankauszüge, Bescheinigungen.',
      ],
      [
        'Schau, was du sparst',
        'Taxpresso rechnet deine Erklärung mit und ohne jeden Abzug durch. So siehst du, wie viele Franken dir jeder Abzug bringt. Du entscheidest.',
      ],
      [
        'Prüfe und übermittle',
        'Claude füllt die offizielle Online-Erklärung deines Kantons für dich aus, in Claude in Chrome oder im integrierten Browser. Du meldest dich an, prüfst alles und reichst sie selbst ein. In Genf vergleicht Taxpresso zudem das offizielle PDF mit deinen Zahlen.',
      ],
    ],
  },

  principles: {
    title: 'Unsere Grundsätze',
    lead: 'Nichts verlässt deinen Computer, ausser was du mit deiner KI teilst.',
    items: [
      [
        'Niemand hat Zugriff auf deine Daten',
        'Weder wir noch sonst jemand. Kein Server, kein Konto, nichts geht ins Internet. Deine Dokumente bleiben in einem Ordner auf deinem Computer.',
        'heart',
      ],
      [
        'Ausser der KI, die du nutzt',
        'Heute ist das Claude, mit deinem eigenen Konto: Claude sieht, was du im Chat teilst. ChatGPT ist noch nicht verfügbar.',
        'tulip',
      ],
      [
        'Deine Einstellungen, nicht unsere',
        'In den Datenschutzeinstellungen von Claude entscheidest du, ob deine Chats helfen dürfen, Claude zu verbessern. Und du löschst sie, wann du willst.',
        'dot',
      ],
      [
        'Nur offizielle Regeln',
        'Jeder Betrag folgt den Steuerleitfäden deines Kantons und des Bundes und nennt die Seite. Claude erklärt, rechnet aber nicht.',
        'rosetta',
      ],
      [
        'Du übermittelst selbst',
        'Claude füllt die Online-Erklärung für dich aus. Du meldest dich an, prüfst alles und reichst sie selbst ein. Claude tippt nie deine Passwörter ein.',
        'check',
      ],
      [
        'Kostenlos und Open Source',
        'Taxpresso gehört seiner Community, unter der GNU AGPL. Alle können prüfen, was es tut, und helfen, es besser zu machen.',
        'swirl',
      ],
    ],
    swiss: [
      'Swiss made',
      'In Genf entwickelt, für Menschen, die in der Schweiz Steuern zahlen. Unabhängig von jeder Steuerverwaltung und von Anthropic.',
    ],
  },

  support: {
    title: 'Kostenlos und Open Source',
    text: 'Taxpresso ist kostenlos und Open Source. Hat es dir einen Nachmittag gespart? Das schönste Dankeschön kostet nichts: eine Bewertung, damit auch andere es finden.',
    voices: {
      title: 'Was andere sagen',
      more: 'Auch deine Bewertung ist willkommen: Sie steht gratis auf der Karte.',
      first: 'Sei die oder der Erste: Gib eine Bewertung ab, sie steht gratis auf der Karte.',
    },
    tip: {
      title: 'Die Trinkgeld-Karte',
      note: 'Jedes Trinkgeld geht an Precious Plastic Bugoma, einen gemeinnützigen Verein aus Genf, der rund um den Bugoma-Wald in Uganda arbeitet. Taxpresso behält nichts.',
      button: 'Trinkgeld geben',
      review: {
        label: 'Eine Bewertung abgeben',
        amount: 'gratis',
        star: 'Ein Stern auf GitHub',
        github: 'Eine Bewertung auf GitHub',
        words: 'Ein paar Worte',
        name: 'Name zum Anzeigen (freiwillig)',
        quote: 'Ihr dürft das auf taxpresso.ch zitieren',
        send: 'Senden',
        thanks: 'Danke! Wir lesen jede Bewertung.',
        error: 'Das hat nicht geklappt. Versuch es gleich noch einmal.',
      },
      menu: [
        ['Espresso', 'CHF 2.50'],
        ['Cappuccino', 'CHF 5'],
        ['Dirty chai latte', 'CHF 7.50'],
        ['Affogato', 'CHF 10'],
        ['Kaffee und Kuchen für zwei', 'CHF 25'],
        ['Eine Runde für den Tisch', 'CHF 50'],
        ['Nach deinem Geschmack', 'Betrag nach Wahl'],
      ],
    },
    ppb: `Precious Plastic Bugoma ist ein Verein ohne Gewinnzweck mit Sitz in Vernier, Genf ([eingetragen unter CHE-185.673.320](${PPB_REGISTER})). Er recycelt Plastikabfall rund um den Bugoma-Wald in Uganda. Taxpresso wird von Mitgliedern seines Teams entwickelt.`,
  },

  contribute: {
    title: 'Mach es mit uns besser',
    lead: 'Taxpresso entsteht offen, auf GitHub (ein kostenloses Konto genügt).',
    items: [
      [
        'Fehler melden',
        'Stimmt etwas nicht oder ist unklar? Sag uns, was du erwartet hast. Bitte gib nie echte Steuerdaten an.',
        'bug',
      ],
      [
        'Idee vorschlagen',
        'Eine Funktion, ein Kanton, ein klareres Wort: Wir lesen alles.',
        'idea',
      ],
      [
        'Deinen Kanton wünschen',
        'Stimm auf GitHub für den Kanton ab, den du als Nächstes willst.',
        'canton',
      ],
      [
        'Für deine Sprache stimmen',
        'Stimm für die nächste Sprache ab oder hilf beim Übersetzen.',
        'language',
      ],
      [
        'Code beitragen',
        'Lies die Anleitung für Beiträge, such dir eine Aufgabe aus und schick deine Änderungen.',
        'code',
      ],
      ['Schreib uns', 'Eine Frage, eine Idee oder ein nettes Wort: hello@taxpresso.ch', 'contact'],
    ],
  },

  faq: {
    title: 'Fragen',
    more: 'Noch eine Frage? [Lies unsere Ratgeber](/de/guides/), mit Links zu den offiziellen Seiten.',
    items: [
      [
        'Brauche ich Claude?',
        'Ja, vorerst. Taxpresso wird in [Claude Desktop](https://claude.com/download) (Linux, macOS oder Windows) installiert und läuft mit deinem eigenen Claude-Konto. ChatGPT ist noch nicht verfügbar.',
      ],
      ['Welche Kantone funktionieren?', cantonsAnswer('de')],
      [
        'Übermittelt Taxpresso meine Erklärung?',
        'Fast. Claude füllt die offizielle Online-Erklärung deines Kantons für dich aus, in Claude in Chrome oder im integrierten Browser. Du meldest dich an, prüfst sie und reichst sie selbst ein. Claude tippt nie deine Passwörter ein.',
      ],
      [
        'Ist das ein offizieller Dienst?',
        'Nein. Taxpresso ist unabhängig. Es gehört weder zu einer kantonalen Steuerverwaltung noch zur Eidgenössischen Steuerverwaltung noch zu Anthropic.',
      ],
      [
        'Warum ist es kostenlos?',
        'Weil Steuern einfach und kostenlos sein sollten. Taxpresso ist Open Source (Lizenz GNU AGPL): Alle können prüfen, was es tut, und helfen, es zu verbessern, zu übersetzen oder einen Kanton hinzuzufügen. Niemand kann daraus eine geschlossene Version machen.',
      ],
      [
        'Und wenn ein Dokument fehlt?',
        'Dann kannst du mit einer Schätzung weitermachen. Taxpresso markiert sie überall. Deine Erklärung ist erst bereit, wenn jede Schätzung durch ein Dokument ersetzt oder von dir bestätigt ist.',
      ],
      [
        'In welchen Sprachen?',
        'Claude antwortet in der Sprache, in der du schreibst. Die App gibt es auf Deutsch, Französisch, Englisch und Italienisch. Spanisch und Portugiesisch kommen noch. Offizielle Begriffe bleiben in der Sprache des Formulars deines Kantons.',
      ],
    ],
  },

  finePrint: {
    title: 'Das Kleingedruckte, in klaren Worten',
    text: 'Taxpresso ist ein kostenloses Werkzeug. Du bekommst es so, wie es ist, ohne jede Gewähr. Wir sind keine Steuerberater: Wir haben Taxpresso genau dafür gebaut, damit wir uns um unsere eigenen Steuern keine Sorgen mehr machen müssen. Taxpresso hilft dir, deine Erklärung vorzubereiten. Was hineinkommt, entscheidest aber du, und für die Erklärung, die du übermittelst, bist du verantwortlich. Im Zweifel frag die Steuerverwaltung deines Kantons oder ein Treuhandbüro.',
  },

  start: {
    htmlTitle: 'Loslegen mit Taxpresso',
    metaDescription:
      'Installiere Taxpresso in Claude Desktop und erstelle deine Schweizer Steuererklärung, Schritt für Schritt.',
    title: 'Loslegen',
    lead: 'Taxpresso ist eine Erweiterung für Claude Desktop. Sie ist in einer Minute installiert, und alles bleibt auf deinem Computer.',
    download: 'Taxpresso herunterladen',
    downloadNote: 'Kostenlos. Eine Datei, für Claude Desktop.',
    platforms: ['Linux (Beta)', 'macOS', 'Windows'],
    needsTitle: 'Was du brauchst',
    guides:
      'Welche Dokumente du sammelst, Säule 3a, TOU, deine Veranlagung: [Unsere Ratgeber](/de/guides/) erklären das Wichtigste für Genf, mit den offiziellen Links.',
    needs: [
      [
        'Claude Desktop',
        'Auf Linux, macOS oder Windows, angemeldet mit deinem Claude-Konto. [Claude Desktop herunterladen](https://claude.com/download)',
      ],
      ['Deine Dokumente', 'Als PDF oder Foto, sobald du sie hast. Du kannst auch ohne anfangen.'],
      [
        'Einen Browser für Claude',
        'Zum Ausfüllen der offiziellen Erklärung: Claude in Chrome oder der integrierte Browser von Claude.',
      ],
    ],
    stepsTitle: 'In sechs Schritten',
    steps: [
      [
        'Lade Taxpresso herunter',
        'Eine einzige kostenlose Datei, taxpresso-version.mcpb, von der Versionsseite des Projekts.',
      ],
      [
        'Installiere es',
        'Öffne Claude Desktop und doppelklicke auf die Datei. Claude Desktop zeigt dir Taxpresso und seine Werkzeuge: Klick auf Installieren. Passiert nichts? Öffne Einstellungen, dann Erweiterungen, und zieh die Datei auf diese Seite.',
      ],
      [
        'Behalte deinen Ordner',
        'Claude Desktop schlägt dir einen Ordner für deine Steuerdokumente vor: Dokumente/Taxpresso. Behalte ihn. Deine Antworten und Dokumente bleiben dort, auf deinem Computer. Prüf kurz, ob Taxpresso eingeschaltet ist.',
      ],
      [
        'Sag Hallo',
        'Öffne einen neuen Chat und schreib den Satz unten. Beim ersten Mal fragt Claude, ob es Taxpresso nutzen darf: Erlaube es.',
      ],
      [
        'Antworte und füg deine Dokumente hinzu',
        'Claude stellt dir ein paar einfache Fragen, eine nach der anderen, angefangen mit deinem Kanton. Willst du per Klick antworten oder Dokumente ablegen? Bitte Claude, dein Dashboard zu öffnen.',
      ],
      [
        'Reich deine Erklärung ein',
        'Wenn alles bereit ist, füllt Claude die offizielle Online-Erklärung deines Kantons in Claude in Chrome oder im integrierten Browser aus. Du meldest dich an, prüfst alles und reichst sie selbst ein.',
      ],
    ],
    prompt: 'Hilf mir mit Taxpresso bei meinen Steuern.',
    promptLabel: 'Schreib das in Claude',
    mockInstall: 'Installieren',
    mockExtension: 'Deine Steuererklärung, auf deinem Computer.',
    notes: [
      [
        'Deine Einstellungen',
        'Nichts verlässt deinen Computer, ausser was du mit Claude teilst. In den Einstellungen von Claude, unter Datenschutz, entscheidest du, ob deine Chats helfen dürfen, Claude zu verbessern. Lösch sie, wenn deine Erklärung fertig ist.',
      ],
      [
        'Vor dem 31. Dezember',
        'Frag Claude, wie viel du dieses Jahr mit einer Einzahlung in die Säule 3a sparen würdest. Ein ungefährer Lohn genügt.',
      ],
      [
        'Aktualisieren',
        'Für eine neue Version entfernst du Taxpresso unter Einstellungen, Erweiterungen und installierst dann die neue Datei. Dein Ordner bleibt, wie er ist.',
      ],
      [
        'Etwas klappt nicht?',
        `Funktioniert etwas nicht wie erwartet? [Sag es uns](${ISSUE_URL.bug}), aber bitte nie mit echten Steuerdaten.`,
      ],
    ],
    back: 'Zurück zur Startseite',
  },

  footer: {
    independent:
      'Taxpresso ist ein unabhängiges, kostenloses Open-Source-Softwareprojekt. Es ist mit keinem Treuhand- oder Buchhaltungsbüro und keiner Steuerberatungsfirma verbunden und wird von keiner gesponsert, weder in der Schweiz noch anderswo. Es ist auch weder mit einer kantonalen Steuerverwaltung noch mit der Eidgenössischen Steuerverwaltung noch mit Anthropic verbunden. Claude ist eine Marke von Anthropic.',
    noTracking:
      'Diese Website verwendet keine Cookies, keine Tracker und keine externen Schriften.',
    source: 'Quellcode',
  },
};

const it: Copy = {
  htmlTitle: 'Taxpresso: le tue tasse, il tempo di un espresso',
  metaDescription:
    'Taxpresso prepara la tua dichiarazione d’imposta svizzera con Claude, sul tuo computer. Gratuito e open source.',
  skip: 'Vai al contenuto',
  navLabel: 'Sezioni',
  langLabel: 'Lingua',
  suggestLanguage: 'Proponi una lingua',
  nav: {
    how: 'Come funziona',
    principles: 'Principi',
    faq: 'Domande',
    guides: 'Guide',
    start: 'Inizia',
  },

  tagline: 'Le tue tasse, il tempo di un espresso.',
  lead: 'Rispondi a qualche domanda. Al resto ci pensa Taxpresso.',
  available: 'Disponibile per le dichiarazioni 2026.',
  getStarted: 'Inizia',
  seeHow: 'Scopri come funziona',
  badges: { swiss: 'Swiss made', open: 'Gratuito e open source' },

  ticket: {
    caption: 'Esempio di scontrino per una dichiarazione preparata con Taxpresso',
    sub: 'Dichiarazione 2026, Ginevra',
    lines: [
      ['Certificato di salario', 'verificato', 'ok'],
      ['Estratto fiscale (banca)', 'verificato', 'ok'],
      ['Attestazione pilastro 3a', 'verificata', 'ok'],
      ['Custodia dei figli', 'da confermare', 'confirm'],
      ['Deduzioni', 'tutte, in CHF', 'plain'],
      ['Dichiarazione online', 'compilata', 'plain'],
      ['Trasmissione', 'tocca a te', 'plain'],
    ],
    totalLabel: 'Tempo totale',
    totalValue: '1 espresso',
    footer: 'Niente esce dal tuo computer.',
  },

  how: {
    title: 'Come funziona',
    steps: [
      [
        'Rispondi a qualche domanda',
        'In Claude Desktop, Claude ti fa qualche domanda semplice, una alla volta, nella tua lingua. Aggiungi i tuoi documenti quando li hai: certificati di salario, estratti conto, attestazioni.',
      ],
      [
        'Guarda quanto risparmi',
        'Taxpresso calcola la tua dichiarazione con e senza ogni deduzione, e ti mostra quanti franchi ti fa risparmiare ciascuna. Scegli tu.',
      ],
      [
        'Controlla e trasmetti',
        'Claude compila per te la dichiarazione online ufficiale del tuo cantone, in Claude in Chrome o nel suo browser integrato. Tu accedi, controlli e la invii tu. A Ginevra, Taxpresso confronta anche il PDF ufficiale con i tuoi numeri.',
      ],
    ],
  },

  principles: {
    title: 'I nostri principi',
    lead: 'Niente esce dal tuo computer, tranne quello che condividi con l’IA che usi.',
    items: [
      [
        'Nessuno ha accesso ai tuoi dati',
        'Né noi, né nessun altro. Nessun server, nessun account, niente viene inviato su internet. I tuoi documenti restano in una cartella sul tuo computer.',
        'heart',
      ],
      [
        'Tranne l’IA che usi',
        'Oggi è Claude, con il tuo account: vede quello che condividi nella conversazione. ChatGPT non è ancora disponibile.',
        'tulip',
      ],
      [
        'Le tue impostazioni, non le nostre',
        'Nelle impostazioni sulla privacy di Claude decidi tu se le tue conversazioni possono aiutare a migliorarlo. E le cancelli quando vuoi.',
        'dot',
      ],
      [
        'Solo regole ufficiali',
        'Ogni importo segue le guide fiscali del tuo cantone e della Confederazione, e ne cita la pagina. Claude spiega, ma non fa i calcoli.',
        'rosetta',
      ],
      [
        'Sei tu a trasmettere',
        'Claude compila per te la dichiarazione online. Tu accedi, la ricontrolli e la invii tu. Claude non digita mai le tue password.',
        'check',
      ],
      [
        'Gratuito e open source',
        'Taxpresso appartiene alla sua comunità, con licenza GNU AGPL. Chiunque può verificare cosa fa e aiutare a migliorarlo.',
        'swirl',
      ],
    ],
    swiss: [
      'Swiss made',
      'Creato a Ginevra, per chi paga le tasse in Svizzera. Indipendente da qualsiasi amministrazione fiscale e da Anthropic.',
    ],
  },

  support: {
    title: 'Gratis e open source',
    text: 'Taxpresso è gratuito e open source. Ti ha fatto risparmiare un pomeriggio? Il grazie più bello non costa niente: una recensione, così anche altri lo trovano.',
    voices: {
      title: 'Cosa ne dicono',
      more: 'Anche la tua recensione è benvenuta: è la voce gratuita del menu.',
      first: 'Sii il primo o la prima: lascia una recensione, è la voce gratuita del menu.',
    },
    tip: {
      title: 'Il menu delle mance',
      note: 'Ogni mancia va a Precious Plastic Bugoma, un’associazione senza scopo di lucro di Ginevra attiva intorno alla foresta di Bugoma, in Uganda. Taxpresso non tiene niente per sé.',
      button: 'Lascia una mancia',
      review: {
        label: 'Lascia una recensione',
        amount: 'gratis',
        star: 'Una stella su GitHub',
        github: 'Una recensione su GitHub',
        words: 'Due parole',
        name: 'Nome da mostrare (facoltativo)',
        quote: 'Potete citarla su taxpresso.ch',
        send: 'Invia',
        thanks: 'Grazie! Leggiamo ogni recensione.',
        error: 'Non è andata a buon fine. Riprova tra un momento.',
      },
      menu: [
        ['Espresso', 'CHF 2.50'],
        ['Cappuccino', 'CHF 5'],
        ['Dirty chai latte', 'CHF 7.50'],
        ['Affogato', 'CHF 10'],
        ['Caffè e torta per due', 'CHF 25'],
        ['Un giro per tutta la tavolata', 'CHF 50'],
        ['A piacere', 'l’importo che vuoi'],
      ],
    },
    ppb: `Precious Plastic Bugoma è un’associazione senza scopo di lucro con sede a Vernier, Ginevra ([iscritta con il numero CHE-185.673.320](${PPB_REGISTER})). Ricicla i rifiuti di plastica intorno alla foresta di Bugoma, in Uganda. Taxpresso è realizzato da membri del suo team.`,
  },

  contribute: {
    title: 'Aiutaci a migliorarlo',
    lead: 'Taxpresso si sviluppa alla luce del sole, su GitHub (basta un account gratuito).',
    items: [
      [
        'Segnala un bug',
        'Qualcosa non va o non è chiaro? Dicci cosa ti aspettavi. Non inserire mai dati fiscali reali.',
        'bug',
      ],
      [
        'Proponi un’idea',
        'Una funzione, un cantone, una parola più chiara: leggiamo tutto.',
        'idea',
      ],
      ['Chiedi il tuo cantone', 'Vota su GitHub il prossimo cantone che vuoi.', 'canton'],
      ['Vota la tua lingua', 'Vota la prossima lingua, o aiutaci a tradurre.', 'language'],
      [
        'Scrivi codice',
        'Leggi la guida per contribuire, scegli un ticket e proponi le tue modifiche.',
        'code',
      ],
      ['Scrivici', 'Una domanda, un’idea o un saluto: hello@taxpresso.ch', 'contact'],
    ],
  },

  faq: {
    title: 'Domande',
    more: 'Un’altra domanda? [Leggi le nostre guide](/it/guides/), con i link alle pagine ufficiali.',
    items: [
      [
        'Mi serve Claude?',
        'Sì, per ora. Taxpresso si installa in [Claude Desktop](https://claude.com/download) (Linux, macOS o Windows) e funziona con il tuo account Claude. ChatGPT non è ancora disponibile.',
      ],
      ['Quali cantoni funzionano?', cantonsAnswer('it')],
      [
        'Taxpresso trasmette la mia dichiarazione?',
        'Quasi. Claude compila per te la dichiarazione online ufficiale del tuo cantone, in Claude in Chrome o nel suo browser integrato. Tu accedi, la controlli e la invii tu. Claude non digita mai le tue password.',
      ],
      [
        'È un servizio ufficiale?',
        'No. Taxpresso è indipendente: non ha legami né con le amministrazioni fiscali cantonali, né con l’Amministrazione federale delle contribuzioni, né con Anthropic.',
      ],
      [
        'Perché è gratuito?',
        'Perché fare la dichiarazione dovrebbe essere semplice e gratis. Taxpresso è open source (licenza GNU AGPL): chiunque può verificare cosa fa, e aiutare a migliorarlo, tradurlo o aggiungere un cantone. Nessuno può farne una versione chiusa.',
      ],
      [
        'E se manca un documento?',
        'Puoi andare avanti con una stima. Taxpresso la segnala ovunque, e la tua dichiarazione è pronta solo quando ogni stima è sostituita da un documento o confermata da te.',
      ],
      [
        'In quali lingue?',
        'Claude ti risponde nella lingua in cui scrivi. L’app è in italiano, francese, inglese e tedesco, poi arriveranno spagnolo e portoghese. I termini ufficiali restano nella lingua del modulo del tuo cantone.',
      ],
    ],
  },

  finePrint: {
    title: 'Le scritte in piccolo, in parole semplici',
    text: 'Taxpresso è uno strumento gratuito, fornito così com’è, senza alcuna garanzia. Non siamo consulenti fiscali: l’abbiamo creato proprio per non doverci più preoccupare delle nostre tasse. Taxpresso ti aiuta a preparare la tua dichiarazione, ma sei tu a decidere cosa contiene, e la dichiarazione che trasmetti è sotto la tua responsabilità. Se hai dubbi, chiedi all’amministrazione fiscale del tuo cantone o a una fiduciaria.',
  },

  start: {
    htmlTitle: 'Inizia con Taxpresso',
    metaDescription:
      'Installa Taxpresso in Claude Desktop e prepara la tua dichiarazione d’imposta svizzera, passo dopo passo.',
    title: 'Inizia',
    lead: 'Taxpresso è un’estensione per Claude Desktop. Si installa in un minuto, e tutto resta sul tuo computer.',
    download: 'Scarica Taxpresso',
    downloadNote: 'Gratis. Un solo file, per Claude Desktop.',
    platforms: ['Linux (beta)', 'macOS', 'Windows'],
    needsTitle: 'Cosa ti serve',
    guides:
      'Quali documenti raccogliere, il pilastro 3a, la TOU, la tua tassazione: [le nostre guide](/it/guides/) spiegano l’essenziale per Ginevra, con i link ufficiali.',
    needs: [
      [
        'Claude Desktop',
        'Su Linux, macOS o Windows, collegato al tuo account Claude. [Scarica Claude Desktop](https://claude.com/download)',
      ],
      ['I tuoi documenti', 'In PDF o in foto, appena li hai. Puoi anche iniziare senza.'],
      [
        'Un browser per Claude',
        'Per compilare la dichiarazione ufficiale: Claude in Chrome, o il browser integrato di Claude.',
      ],
    ],
    stepsTitle: 'In sei passi',
    steps: [
      [
        'Scarica Taxpresso',
        'Un solo file gratuito, taxpresso-version.mcpb, dalla pagina delle versioni del progetto.',
      ],
      [
        'Installalo',
        'Apri Claude Desktop, poi fai doppio clic sul file. Claude Desktop ti mostra Taxpresso e i suoi strumenti: clicca su Installa. Se non succede niente, apri Impostazioni, poi Estensioni, e trascina il file su quella pagina.',
      ],
      [
        'Tieni la tua cartella',
        'Claude Desktop ti propone una cartella per i tuoi documenti fiscali, Documenti/Taxpresso. Tienila: le tue risposte e i tuoi documenti restano lì, sul tuo computer. Controlla che Taxpresso sia attivo.',
      ],
      [
        'Saluta Claude',
        'Apri una nuova conversazione e scrivi la frase qui sotto. La prima volta, Claude ti chiede il permesso di usare Taxpresso: accetta.',
      ],
      [
        'Rispondi e aggiungi i tuoi documenti',
        'Claude ti fa qualche domanda semplice, una alla volta, a cominciare dal tuo cantone. Per rispondere con un clic o aggiungere i tuoi documenti, chiedi a Claude di aprire la tua dashboard.',
      ],
      [
        'Trasmetti',
        'Quando è tutto pronto, Claude compila la dichiarazione online ufficiale del tuo cantone in Claude in Chrome o nel suo browser integrato. Tu accedi, controlli e la invii tu.',
      ],
    ],
    prompt: 'Aiutami con le mie tasse usando Taxpresso.',
    promptLabel: 'Scrivi questo in Claude',
    mockInstall: 'Installa',
    mockExtension: 'La tua dichiarazione d’imposta, sul tuo computer.',
    notes: [
      [
        'Le tue impostazioni',
        'Niente esce dal tuo computer, tranne quello che condividi con Claude. Nelle impostazioni di Claude, alla voce Privacy, decidi tu se le tue conversazioni possono aiutare a migliorare Claude. Cancellale quando hai finito la dichiarazione.',
      ],
      [
        'Prima del 31 dicembre',
        'Chiedi a Claude quanto ti farebbe risparmiare quest’anno un versamento nel pilastro 3a (3e pilier A). Basta un salario approssimativo.',
      ],
      [
        'Aggiornamenti',
        'Per installare una nuova versione, rimuovi Taxpresso in Impostazioni, Estensioni, poi installa il nuovo file. La tua cartella resta com’è.',
      ],
      [
        'Un problema?',
        `Qualcosa non funziona come dovrebbe? [Diccelo](${ISSUE_URL.bug}), ma senza mai inserire dati fiscali reali.`,
      ],
    ],
    back: 'Torna alla pagina iniziale',
  },

  footer: {
    independent:
      'Taxpresso è un progetto software indipendente, gratuito e open source. Non è affiliato né sponsorizzato da alcuna fiduciaria, studio contabile o società di servizi fiscali, in Svizzera o altrove, e non è legato né alle amministrazioni fiscali cantonali, né all’Amministrazione federale delle contribuzioni, né ad Anthropic. Claude è un marchio di Anthropic.',
    noTracking: 'Questo sito non usa cookie, tracker o font esterni.',
    source: 'Codice sorgente',
  },
};

const es: Copy = {
  htmlTitle: 'Taxpresso: tus impuestos, mientras te tomas un espresso',
  metaDescription:
    'Taxpresso prepara tu declaración de impuestos suiza con Claude, en tu propio ordenador. Gratis y de código abierto.',
  skip: 'Ir al contenido',
  navLabel: 'Secciones',
  langLabel: 'Idioma',
  suggestLanguage: 'Propón un idioma',
  nav: {
    how: 'Cómo funciona',
    principles: 'Principios',
    faq: 'Preguntas',
    guides: 'Guías',
    start: 'Empieza',
  },

  tagline: 'Tus impuestos, mientras te tomas un espresso.',
  lead: 'Responde unas preguntas. Taxpresso se encarga del resto.',
  available: 'Disponible para las declaraciones de 2026.',
  getStarted: 'Empieza',
  seeHow: 'Mira cómo funciona',
  badges: { swiss: 'Swiss made', open: 'Gratis y de código abierto' },

  ticket: {
    caption: 'Ejemplo de recibo de una declaración preparada con Taxpresso',
    sub: 'Declaración 2026, Ginebra',
    lines: [
      ['Certificado de salario', 'verificado', 'ok'],
      ['Extracto fiscal (banco)', 'verificado', 'ok'],
      ['Certificado del pilar 3a', 'verificado', 'ok'],
      ['Gastos de guardería', 'por confirmar', 'confirm'],
      ['Deducciones', 'todas, en CHF', 'plain'],
      ['Declaración en línea', 'rellenada', 'plain'],
      ['Envío', 'lo haces tú', 'plain'],
    ],
    totalLabel: 'Tiempo total',
    totalValue: '1 espresso',
    footer: 'Nada sale de tu ordenador.',
  },

  how: {
    title: 'Cómo funciona',
    steps: [
      [
        'Responde unas preguntas',
        'En Claude Desktop, Claude te hace unas preguntas sencillas, una a una, en tu idioma. Añade tus documentos cuando los tengas: certificados de salario, extractos bancarios, justificantes.',
      ],
      [
        'Mira cuánto ahorras',
        'Taxpresso calcula tu declaración con y sin cada deducción, y te muestra cuánto te ahorra cada una en francos. Tú decides.',
      ],
      [
        'Revisa y envía',
        'Claude rellena por ti la declaración oficial en línea de tu cantón, en Claude in Chrome o en su navegador integrado. Tú inicias sesión, la revisas y la envías tú. En Ginebra, Taxpresso también compara el PDF oficial con tus cifras.',
      ],
    ],
  },

  principles: {
    title: 'Nuestros principios',
    lead: 'Nada sale de tu ordenador, salvo lo que compartes con la IA que usas.',
    items: [
      [
        'Nadie tiene acceso a tus datos',
        'Ni nosotros ni nadie. Sin servidor, sin cuenta, nada se envía por internet. Tus documentos se quedan en una carpeta de tu ordenador.',
        'heart',
      ],
      [
        'Salvo la IA que usas',
        'Hoy es Claude, con tu propia cuenta: ve lo que compartes en la conversación. ChatGPT aún no está disponible.',
        'tulip',
      ],
      [
        'Tu configuración, no la nuestra',
        'En la configuración de privacidad de Claude, tú decides si tus conversaciones pueden servir para mejorarlo. Y las borras cuando quieras.',
        'dot',
      ],
      [
        'Solo reglas oficiales',
        'Cada importe sigue las guías fiscales de tu cantón y de la Confederación, y cita su página. Claude explica, pero no hace las cuentas.',
        'rosetta',
      ],
      [
        'El envío es cosa tuya',
        'Claude rellena la declaración en línea por ti. Tú inicias sesión, la revisas y la envías tú. Claude nunca escribe tus contraseñas.',
        'check',
      ],
      [
        'Gratis y de código abierto',
        'Taxpresso es de su comunidad, con licencia GNU AGPL. Cualquiera puede comprobar lo que hace y ayudar a mejorarlo.',
        'swirl',
      ],
    ],
    swiss: [
      'Swiss made',
      'Creado en Ginebra, para quienes pagan impuestos en Suiza. Independiente de cualquier administración fiscal y de Anthropic.',
    ],
  },

  support: {
    title: 'Gratis y de código abierto',
    text: 'Taxpresso es gratis y de código abierto. ¿Te ha ahorrado una tarde? El mejor agradecimiento no cuesta nada: una reseña, para que otros también lo encuentren.',
    voices: {
      title: 'Lo que dicen',
      more: 'Tu reseña también es bienvenida: es lo gratis del menú.',
      first: 'Sé el primero o la primera: deja una reseña, es lo gratis del menú.',
    },
    tip: {
      title: 'La carta de propinas',
      note: 'Cada propina va a Precious Plastic Bugoma, una asociación sin ánimo de lucro de Ginebra que trabaja en torno al bosque de Bugoma, en Uganda. Taxpresso no se queda con nada.',
      button: 'Deja una propina',
      review: {
        label: 'Deja una reseña',
        amount: 'gratis',
        star: 'Una estrella en GitHub',
        github: 'Una reseña en GitHub',
        words: 'Unas palabras',
        name: 'Nombre que mostrar (opcional)',
        quote: 'Podéis citarla en taxpresso.ch',
        send: 'Enviar',
        thanks: '¡Gracias! Leemos cada reseña.',
        error: 'No se ha podido enviar. Vuelve a intentarlo en un momento.',
      },
      menu: [
        ['Espresso', 'CHF 2.50'],
        ['Cappuccino', 'CHF 5'],
        ['Dirty chai latte', 'CHF 7.50'],
        ['Affogato', 'CHF 10'],
        ['Café y pastel para dos', 'CHF 25'],
        ['Una ronda para toda la mesa', 'CHF 50'],
        ['A tu gusto', 'el importe que quieras'],
      ],
    },
    ppb: `Precious Plastic Bugoma es una asociación sin ánimo de lucro con sede en Vernier, Ginebra ([inscrita con el número CHE-185.673.320](${PPB_REGISTER})). Recicla residuos plásticos alrededor del bosque de Bugoma, en Uganda. Taxpresso lo desarrollan miembros de su equipo.`,
  },

  contribute: {
    title: 'Mejóralo con nosotros',
    lead: 'Taxpresso se construye en abierto, en GitHub (basta con una cuenta gratuita).',
    items: [
      [
        'Informa de un error',
        '¿Algo falla o no está claro? Cuéntanos qué esperabas. No incluyas nunca datos fiscales reales.',
        'bug',
      ],
      ['Propón una idea', 'Una función, un cantón, una palabra más clara: lo leemos todo.', 'idea'],
      ['Pide tu cantón', 'Vota en GitHub por el próximo cantón que quieres.', 'canton'],
      ['Vota por tu idioma', 'Vota por el próximo idioma, o ayúdanos a traducir.', 'language'],
      [
        'Escribe código',
        'Lee la guía de contribución, elige una incidencia y envía tus cambios.',
        'code',
      ],
      ['Escríbenos', 'Una pregunta, una idea o unas palabras: hello@taxpresso.ch', 'contact'],
    ],
  },

  faq: {
    title: 'Preguntas',
    more: '¿Otra pregunta? [Lee nuestras guías](/es/guides/), con enlaces a las páginas oficiales.',
    items: [
      [
        '¿Necesito Claude?',
        'Sí, por ahora. Taxpresso se instala en [Claude Desktop](https://claude.com/download) (Linux, macOS o Windows) y funciona con tu propia cuenta de Claude. ChatGPT aún no está disponible.',
      ],
      ['¿Qué cantones funcionan?', cantonsAnswer('es')],
      [
        '¿Taxpresso presenta mi declaración?',
        'Casi. Claude rellena por ti la declaración oficial en línea de tu cantón, en Claude in Chrome o en su navegador integrado. Tú inicias sesión, la revisas y la envías tú. Claude nunca escribe tus contraseñas.',
      ],
      [
        '¿Es un servicio oficial?',
        'No. Taxpresso es independiente: no tiene relación con ninguna administración fiscal cantonal, ni con la administración fiscal federal, ni con Anthropic.',
      ],
      [
        '¿Por qué es gratis?',
        'Porque hacer la declaración debería ser sencillo y gratis. Taxpresso es de código abierto (licencia GNU AGPL): cualquiera puede comprobar lo que hace, y ayudar a mejorarlo, traducirlo o añadir un cantón. Nadie puede convertirlo en una versión cerrada.',
      ],
      [
        '¿Y si falta un documento?',
        'Puedes seguir con una estimación. Taxpresso la señala en todas partes, y tu declaración solo está lista cuando cada estimación se ha cambiado por un documento o la has confirmado tú.',
      ],
      [
        '¿En qué idiomas?',
        'Claude te responde en el idioma en el que escribes. La aplicación está en francés, inglés, alemán e italiano, y después llegarán el español y el portugués. Los términos oficiales se quedan en el idioma del formulario de tu cantón.',
      ],
    ],
  },

  finePrint: {
    title: 'La letra pequeña, en palabras claras',
    text: 'Taxpresso es una herramienta gratuita, ofrecida tal cual, sin ninguna garantía. No somos asesores fiscales: lo creamos precisamente para dejar de preocuparnos por nuestros propios impuestos. Taxpresso te ayuda a preparar tu declaración, pero tú decides lo que incluye, y la declaración que envías es responsabilidad tuya. Si tienes dudas, pregunta a la administración fiscal de tu cantón o a una gestoría.',
  },

  start: {
    htmlTitle: 'Empieza con Taxpresso',
    metaDescription:
      'Instala Taxpresso en Claude Desktop y prepara tu declaración de impuestos suiza, paso a paso.',
    title: 'Empieza',
    lead: 'Taxpresso es una extensión para Claude Desktop. Se instala en un minuto, y todo se queda en tu ordenador.',
    download: 'Descarga Taxpresso',
    downloadNote: 'Gratis. Un solo archivo, para Claude Desktop.',
    platforms: ['Linux (beta)', 'macOS', 'Windows'],
    needsTitle: 'Qué necesitas',
    guides:
      'Qué documentos reunir, el pilar 3a, la TOU, tu liquidación: [nuestras guías](/es/guides/) explican lo esencial para Ginebra, con los enlaces oficiales.',
    needs: [
      [
        'Claude Desktop',
        'En Linux, macOS o Windows, con la sesión iniciada en tu cuenta de Claude. [Descarga Claude Desktop](https://claude.com/download)',
      ],
      ['Tus documentos', 'En PDF o en foto, cuando los tengas. Puedes empezar sin ellos.'],
      [
        'Un navegador para Claude',
        'Para rellenar la declaración oficial: Claude in Chrome, o el navegador integrado de Claude.',
      ],
    ],
    stepsTitle: 'En seis pasos',
    steps: [
      [
        'Descarga Taxpresso',
        'Un solo archivo gratuito, taxpresso-version.mcpb, en la página de versiones del proyecto.',
      ],
      [
        'Instálalo',
        'Abre Claude Desktop y haz doble clic en el archivo. Claude Desktop te muestra Taxpresso y sus herramientas: haz clic en Instalar. Si no pasa nada, abre Configuración, luego Extensiones, y arrastra el archivo a esa página.',
      ],
      [
        'Conserva tu carpeta',
        'Claude Desktop te propone una carpeta para tus documentos fiscales, Documentos/Taxpresso. Quédate con ella: tus respuestas y tus documentos se guardan ahí, en tu ordenador. Comprueba que Taxpresso está activado.',
      ],
      [
        'Saluda a Claude',
        'Abre una conversación nueva y escribe la frase de abajo. La primera vez, Claude te pide permiso para usar Taxpresso: dáselo.',
      ],
      [
        'Responde y añade tus documentos',
        'Claude te hace unas preguntas sencillas, una a una, empezando por tu cantón. Para responder con clics o añadir tus documentos, pídele a Claude que abra tu panel.',
      ],
      [
        'Presenta tu declaración',
        'Cuando todo esté listo, Claude rellena la declaración oficial en línea de tu cantón en Claude in Chrome o en su navegador integrado. Inicias sesión, la revisas y la envías tú.',
      ],
    ],
    prompt: 'Ayúdame con mis impuestos usando Taxpresso.',
    promptLabel: 'Escribe esto en Claude',
    mockInstall: 'Instalar',
    mockExtension: 'Tu declaración de impuestos, en tu ordenador.',
    notes: [
      [
        'Tu configuración',
        'Nada sale de tu ordenador, salvo lo que compartes con Claude. En la configuración de Claude, en el apartado Privacidad, tú decides si tus conversaciones pueden servir para mejorar Claude. Bórralas cuando termines tu declaración.',
      ],
      [
        'Antes del 31 de diciembre',
        'Pregúntale a Claude cuánto te ahorraría este año una aportación al pilar 3a (3e pilier A). Basta con un salario aproximado.',
      ],
      [
        'Actualizar',
        'Para instalar una nueva versión, desinstala Taxpresso en Configuración, Extensiones, y luego instala el nuevo archivo. Tu carpeta se queda como está.',
      ],
      [
        '¿Algún problema?',
        `¿Algo no funciona como debería? [Cuéntanoslo](${ISSUE_URL.bug}), pero nunca incluyas datos fiscales reales.`,
      ],
    ],
    back: 'Volver a la página de inicio',
  },

  footer: {
    independent:
      'Taxpresso es un proyecto de software independiente, gratuito y de código abierto. No está afiliado a ninguna gestoría, firma contable ni empresa de servicios fiscales, ni patrocinado por ellas, en Suiza ni en ningún otro lugar, y no está vinculado a ninguna administración fiscal cantonal, ni a la administración fiscal federal, ni a Anthropic. Claude es una marca de Anthropic.',
    noTracking: 'Este sitio no usa cookies, ni rastreadores, ni fuentes externas.',
    source: 'Código fuente',
  },
};

const pt: Copy = {
  htmlTitle: 'Taxpresso: os teus impostos, no tempo de um expresso',
  metaDescription:
    'O Taxpresso prepara a tua declaração de impostos suíça com o Claude, no teu próprio computador. Gratuito e de código aberto.',
  skip: 'Saltar para o conteúdo',
  navLabel: 'Secções',
  langLabel: 'Idioma',
  suggestLanguage: 'Sugere um idioma',
  nav: {
    how: 'Como funciona',
    principles: 'Princípios',
    faq: 'Perguntas',
    guides: 'Guias',
    start: 'Começa',
  },

  tagline: 'Os teus impostos, no tempo de um expresso.',
  lead: 'Responde a algumas perguntas. O Taxpresso trata do resto.',
  available: 'Disponível para as declarações de 2026.',
  getStarted: 'Começa',
  seeHow: 'Vê como funciona',
  badges: { swiss: 'Swiss made', open: 'Gratuito e de código aberto' },

  ticket: {
    caption: 'Exemplo de talão de uma declaração preparada com o Taxpresso',
    sub: 'Declaração 2026, Genebra',
    lines: [
      ['Certificado de salário', 'verificado', 'ok'],
      ['Extrato fiscal (banco)', 'verificado', 'ok'],
      ['Certificado do pilar 3a', 'verificado', 'ok'],
      ['Guarda de crianças', 'a confirmar', 'confirm'],
      ['Deduções', 'todas, em CHF', 'plain'],
      ['Declaração online', 'preenchida', 'plain'],
      ['Envio', 'feito por ti', 'plain'],
    ],
    totalLabel: 'Tempo total',
    totalValue: '1 expresso',
    footer: 'Nada sai do teu computador.',
  },

  how: {
    title: 'Como funciona',
    steps: [
      [
        'Responde a algumas perguntas',
        'No Claude Desktop, o Claude faz-te algumas perguntas simples, uma de cada vez, na tua língua. Junta os teus documentos quando os tiveres: certificados de salário, extratos bancários, comprovativos.',
      ],
      [
        'Vê quanto poupas',
        'O Taxpresso calcula a tua declaração com e sem cada dedução, e mostra-te quanto te poupa cada uma em francos. Tu escolhes.',
      ],
      [
        'Verifica e envia',
        'O Claude preenche por ti a declaração online oficial do teu cantão, no Claude in Chrome ou no navegador integrado. Tu inicias sessão, verificas tudo e quem a envia és tu. Em Genebra, o Taxpresso também compara o PDF oficial com os teus números.',
      ],
    ],
  },

  principles: {
    title: 'Os nossos princípios',
    lead: 'Nada sai do teu computador, exceto o que partilhas com a IA que usas.',
    items: [
      [
        'Ninguém tem acesso aos teus dados',
        'Nem nós, nem ninguém. Sem servidor, sem conta, nada é enviado pela internet. Os teus documentos ficam numa pasta no teu computador.',
        'heart',
      ],
      [
        'Exceto a IA que usas',
        'Hoje é o Claude, com a tua própria conta: ele vê o que partilhas na conversa. O ChatGPT ainda não está disponível.',
        'tulip',
      ],
      [
        'As tuas configurações, não as nossas',
        'Nas configurações de privacidade do Claude, decides se as tuas conversas podem ajudar a melhorá-lo. E podes apagá-las quando quiseres.',
        'dot',
      ],
      [
        'Só as regras oficiais',
        'Cada montante segue os guias fiscais do teu cantão e da Confederação, e cita a página. O Claude explica, mas não faz as contas.',
        'rosetta',
      ],
      [
        'Quem envia és tu',
        'O Claude preenche a declaração online por ti. Tu inicias sessão, revês tudo e quem a envia és tu. O Claude nunca escreve as tuas palavras-passe.',
        'check',
      ],
      [
        'Gratuito e de código aberto',
        'O Taxpresso pertence à sua comunidade, com licença GNU AGPL. Qualquer pessoa pode verificar o que ele faz e ajudar a melhorá-lo.',
        'swirl',
      ],
    ],
    swiss: [
      'Swiss made',
      'Criado em Genebra, para quem paga impostos na Suíça. Independente de qualquer administração fiscal e da Anthropic.',
    ],
  },

  support: {
    title: 'Grátis e de código aberto',
    text: 'O Taxpresso é gratuito e de código aberto. Poupou-te uma tarde? O melhor agradecimento não custa nada: uma opinião, para que outros também o encontrem.',
    voices: {
      title: 'O que dizem',
      more: 'A tua opinião também é bem-vinda: é o que há de grátis no menu.',
      first: 'Sê o primeiro ou a primeira: deixa uma opinião, é o que há de grátis no menu.',
    },
    tip: {
      title: 'A ementa das gorjetas',
      note: 'Cada gorjeta vai para a Precious Plastic Bugoma, uma associação sem fins lucrativos de Genebra que trabalha à volta da floresta de Bugoma, no Uganda. O Taxpresso não fica com nada.',
      button: 'Deixa uma gorjeta',
      review: {
        label: 'Deixa uma opinião',
        amount: 'grátis',
        star: 'Uma estrela no GitHub',
        github: 'Uma opinião no GitHub',
        words: 'Umas palavras',
        name: 'Nome a mostrar (opcional)',
        quote: 'Podem citá-la em taxpresso.ch',
        send: 'Enviar',
        thanks: 'Obrigado! Lemos todas as opiniões.',
        error: 'Não foi possível enviar. Tenta outra vez daqui a pouco.',
      },
      menu: [
        ['Espresso', 'CHF 2.50'],
        ['Cappuccino', 'CHF 5'],
        ['Dirty chai latte', 'CHF 7.50'],
        ['Affogato', 'CHF 10'],
        ['Café e bolo para dois', 'CHF 25'],
        ['Uma rodada para a mesa', 'CHF 50'],
        ['A teu gosto', 'o valor que quiseres'],
      ],
    },
    ppb: `A Precious Plastic Bugoma é uma associação sem fins lucrativos sediada em Vernier, Genebra ([registada com o número CHE-185.673.320](${PPB_REGISTER})). Recicla resíduos de plástico à volta da floresta de Bugoma, no Uganda. O Taxpresso é feito por membros da sua equipa.`,
  },

  contribute: {
    title: 'Ajuda-nos a melhorá-lo',
    lead: 'O Taxpresso é construído às claras, no GitHub (basta uma conta gratuita).',
    items: [
      [
        'Comunica um erro',
        'Algo está mal ou pouco claro? Diz-nos o que esperavas. Nunca incluas dados fiscais reais.',
        'bug',
      ],
      [
        'Sugere uma ideia',
        'Uma funcionalidade, um cantão, uma palavra mais clara: lemos tudo.',
        'idea',
      ],
      ['Pede o teu cantão', 'Vota no GitHub no próximo cantão que queres.', 'canton'],
      ['Vota na tua língua', 'Vota na próxima língua, ou ajuda a traduzir.', 'language'],
      [
        'Escreve código',
        'Lê o guia de contribuição, escolhe uma tarefa e envia as tuas alterações.',
        'code',
      ],
      [
        'Escreve-nos',
        'Uma pergunta, uma ideia ou uma palavra simpática: hello@taxpresso.ch',
        'contact',
      ],
    ],
  },

  faq: {
    title: 'Perguntas',
    more: 'Outra pergunta? [Lê os nossos guias](/pt/guides/), com ligações para as páginas oficiais.',
    items: [
      [
        'Preciso do Claude?',
        'Sim, por agora. O Taxpresso instala-se no [Claude Desktop](https://claude.com/download) (Linux, macOS ou Windows) e funciona com a tua própria conta Claude. O ChatGPT ainda não está disponível.',
      ],
      ['Que cantões funcionam?', cantonsAnswer('pt')],
      [
        'O Taxpresso envia a minha declaração?',
        'Quase. O Claude preenche por ti a declaração online oficial do teu cantão, no Claude in Chrome ou no navegador integrado. Tu inicias sessão, verificas tudo e quem a envia és tu. O Claude nunca escreve as tuas palavras-passe.',
      ],
      [
        'É um serviço oficial?',
        'Não. O Taxpresso é independente: não tem ligação a nenhuma administração fiscal cantonal, nem à administração fiscal federal, nem à Anthropic.',
      ],
      [
        'Porque é gratuito?',
        'Porque declarar impostos devia ser simples e gratuito. O Taxpresso é de código aberto (licença GNU AGPL): qualquer pessoa pode verificar o que ele faz, e ajudar a melhorá-lo, a traduzi-lo ou a acrescentar um cantão. Ninguém o pode transformar numa versão fechada.',
      ],
      [
        'E se faltar um documento?',
        'Podes avançar com uma estimativa. O Taxpresso assinala-a em todo o lado, e a tua declaração só fica pronta quando cada estimativa for substituída por um documento ou confirmada por ti.',
      ],
      [
        'Em que línguas?',
        'O Claude responde-te na língua em que escreves. A aplicação está em francês, inglês, alemão e italiano, e depois virão o espanhol e o português. Os termos oficiais ficam na língua do formulário do teu cantão.',
      ],
    ],
  },

  finePrint: {
    title: 'A letra miudinha, em palavras simples',
    text: 'O Taxpresso é uma ferramenta gratuita, fornecida tal como está, sem qualquer garantia. Não somos consultores fiscais: criámo-lo precisamente para deixarmos de nos preocupar com os nossos próprios impostos. O Taxpresso ajuda-te a preparar a tua declaração, mas és tu quem decide o que ela contém, e a declaração que envias é da tua responsabilidade. Em caso de dúvida, pergunta à administração fiscal do teu cantão ou a um contabilista.',
  },

  start: {
    htmlTitle: 'Começa com o Taxpresso',
    metaDescription:
      'Instala o Taxpresso no Claude Desktop e prepara a tua declaração de impostos suíça, passo a passo.',
    title: 'Começa',
    lead: 'O Taxpresso é uma extensão para o Claude Desktop. Instala-se num minuto, e tudo fica no teu computador.',
    download: 'Descarrega o Taxpresso',
    downloadNote: 'Grátis. Um só ficheiro, para o Claude Desktop.',
    platforms: ['Linux (beta)', 'macOS', 'Windows'],
    needsTitle: 'Do que precisas',
    guides:
      'Que documentos juntar, o pilar 3a, a TOU, a tua liquidação: [os nossos guias](/pt/guides/) explicam o essencial para Genebra, com as ligações oficiais.',
    needs: [
      [
        'Claude Desktop',
        'Em Linux, macOS ou Windows, com sessão iniciada na tua conta Claude. [Descarrega o Claude Desktop](https://claude.com/download)',
      ],
      ['Os teus documentos', 'Em PDF ou fotografia, quando os tiveres. Podes começar sem eles.'],
      [
        'Um navegador para o Claude',
        'Para preencher a declaração oficial: o Claude in Chrome, ou o navegador integrado do Claude.',
      ],
    ],
    stepsTitle: 'Em seis passos',
    steps: [
      [
        'Descarrega o Taxpresso',
        'Um só ficheiro gratuito, taxpresso-version.mcpb, na página de versões do projeto.',
      ],
      [
        'Instala-o',
        'Abre o Claude Desktop e faz duplo clique no ficheiro. O Claude Desktop mostra-te o Taxpresso e as suas ferramentas: clica em Instalar. Se nada acontecer, abre Configurações, depois Extensões, e arrasta o ficheiro para essa página.',
      ],
      [
        'Mantém a tua pasta',
        'O Claude Desktop propõe uma pasta para os teus documentos fiscais, Documentos/Taxpresso. Mantém-na: as tuas respostas e documentos ficam lá, no teu computador. Confirma que o Taxpresso está ativado.',
      ],
      [
        'Diz olá',
        'Abre uma nova conversa e escreve a frase abaixo. Da primeira vez, o Claude pede-te autorização para usar o Taxpresso: autoriza.',
      ],
      [
        'Responde e junta os teus documentos',
        'O Claude faz-te algumas perguntas simples, uma de cada vez, a começar pelo teu cantão. Para responderes com cliques ou juntares os teus documentos, pede ao Claude que abra o teu painel.',
      ],
      [
        'Envia',
        'Quando estiver tudo pronto, o Claude preenche a declaração online oficial do teu cantão no Claude in Chrome ou no navegador integrado. Inicias sessão, verificas tudo e quem a envia és tu.',
      ],
    ],
    prompt: 'Ajuda-me com os meus impostos usando o Taxpresso.',
    promptLabel: 'Escreve isto no Claude',
    mockInstall: 'Instalar',
    mockExtension: 'A tua declaração de impostos, no teu computador.',
    notes: [
      [
        'As tuas configurações',
        'Nada sai do teu computador, exceto o que partilhas com o Claude. Nas configurações do Claude, em Privacidade, decides se as tuas conversas podem ajudar a melhorar o Claude. Apaga-as quando terminares a declaração.',
      ],
      [
        'Antes de 31 de dezembro',
        'Pergunta ao Claude quanto te pouparia este ano uma contribuição para o pilar 3a (3e pilier A). Basta um salário aproximado.',
      ],
      [
        'Atualizar',
        'Para instalar uma nova versão, remove o Taxpresso em Configurações, Extensões, e depois instala o novo ficheiro. A tua pasta fica como está.',
      ],
      [
        'Algum problema?',
        `Algo não funciona como devia? [Diz-nos](${ISSUE_URL.bug}), mas nunca incluas dados fiscais reais.`,
      ],
    ],
    back: 'Voltar à página inicial',
  },

  footer: {
    independent:
      'O Taxpresso é um projeto de software independente, gratuito e de código aberto. Não está afiliado a nenhuma fiduciária, gabinete de contabilidade ou empresa de serviços fiscais, nem é patrocinado por nenhuma, na Suíça ou noutro lado, e não está ligado a nenhuma administração fiscal cantonal, nem à administração fiscal federal, nem à Anthropic. Claude é uma marca da Anthropic.',
    noTracking: 'Este site não usa cookies, nem rastreadores, nem tipos de letra externos.',
    source: 'Código-fonte',
  },
};

export const copy: Record<Lang, Copy> = { fr, en, de, it, es, pt };

/** Where each language lives on the site, in menu order. English is the default: taxpresso.ch
 * redirects to /en/ (vercel.json). */
export const LANGS: { lang: Lang; path: string; label: string; name: string }[] = [
  { lang: 'en', path: '/en/', label: 'EN', name: 'English' },
  { lang: 'fr', path: '/fr/', label: 'FR', name: 'Français' },
  { lang: 'de', path: '/de/', label: 'DE', name: 'Deutsch' },
  { lang: 'it', path: '/it/', label: 'IT', name: 'Italiano' },
  { lang: 'es', path: '/es/', label: 'ES', name: 'Español' },
  { lang: 'pt', path: '/pt/', label: 'PT', name: 'Português' },
];

/** The language search engines get when none of the others fits (hreflang x-default). */
export const DEFAULT_LANG: Lang = 'en';

/** The Get started page of a language. */
export const startPath = (path: string) => `${path}start/`;
