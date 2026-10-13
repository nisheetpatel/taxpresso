// Website copy: the home page and the Get started page. French first (Geneva), then English,
// German, Italian, Spanish and Portuguese; a native speaker reviews each before launch (SPEC.md
// section 1). Second person, plain words, no en or em dashes, official French terms next to their
// gloss. No tax amounts or rules here: those live in the product, each with its source. Links use
// [text](https://...) and are rendered by render.ts.

const NB = String.fromCharCode(0xa0); // French spacing before : ? ! ; and inside « »

export type Lang = 'fr' | 'en' | 'de' | 'it' | 'es' | 'pt';
export type Tone = 'ok' | 'confirm' | 'plain';
/** Latte art drawn in each principle's cup (render.ts). */
export type Art = 'heart' | 'tulip' | 'dot' | 'rosetta' | 'check' | 'swirl';

/** The public repository, where releases, issues and the contributing guide live. */
export const SOURCE_URL = 'https://github.com/nisheetpatel/taxpresso';
export const DOWNLOAD_URL = `${SOURCE_URL}/releases/latest`;
export const ISSUE_URL = {
  bug: `${SOURCE_URL}/issues/new?template=bug.yml`,
  idea: `${SOURCE_URL}/issues/new?template=idea.yml`,
  language: `${SOURCE_URL}/issues/new?template=language.yml`,
  code: `${SOURCE_URL}/blob/main/CONTRIBUTING.md`,
};

/** Tips go straight to Precious Plastic Bugoma; Taxpresso never handles money (SPEC.md section 12). */
export const DONATE_URL = 'https://www.preciousplasticbugoma.com/';
/** The association's entry in the Swiss business register (UID). */
const PPB_REGISTER = 'https://www.uid.admin.ch/Detail.aspx?uid_id=CHE-185.673.320';

const fr = {
  htmlTitle: `Taxpresso${NB}: vos impôts, le temps d’un espresso`,
  metaDescription:
    'Taxpresso prépare votre déclaration d’impôt genevoise avec Claude, sur votre ordinateur. Gratuit et open source.',
  skip: 'Aller au contenu',
  navLabel: 'Sections',
  langLabel: 'Langue',
  suggestLanguage: 'Proposer une langue',
  nav: { how: 'Comment ça marche', principles: 'Principes', faq: 'Questions', start: 'Commencer' },

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
        'Claude remplit pour vous la déclaration en ligne officielle (e-démarches), dans Claude in Chrome ou son navigateur intégré. Taxpresso compare le PDF officiel à vos chiffres. C’est vous qui appuyez sur Transmettre.',
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
        'Chaque montant suit les guides fiscaux genevois et fédéral, et cite sa page. Claude explique, il ne calcule pas.',
        'rosetta',
      ],
      [
        'C’est vous qui transmettez',
        'Claude remplit la déclaration en ligne pour vous. Vous vous connectez, vous relisez et vous appuyez sur Transmettre. Claude ne tape jamais vos mots de passe.',
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
      'Conçu à Genève, pour les personnes imposées en Suisse. Indépendant de l’administration fiscale et d’Anthropic.',
    ] as [string, string],
  },

  support: {
    title: 'Gratuit, pour de bon',
    text: 'Taxpresso est gratuit et open source, et le restera. S’il vous a fait gagner un après-midi, le plus beau merci ne coûte rien : une étoile sur GitHub, pour que d’autres le trouvent aussi.',
    star: {
      title: 'Une étoile sur GitHub',
      text: 'Gratuit, en une seconde, et ça aide d’autres personnes en Suisse à trouver Taxpresso.',
      button: 'Mettre une étoile',
    },
    tip: {
      title: 'Le menu des pourboires',
      note: 'Chaque pourboire va à Precious Plastic Bugoma. Taxpresso ne garde rien.',
      button: 'Laisser un pourboire',
      menu: [
        ['Un verre d’eau', 'gratuit'],
        ['Espresso', 'CHF 2.50'],
        ['Cappuccino', 'CHF 5'],
        ['Latte macchiato', 'CHF 10'],
        ['Café gourmand', 'CHF 20'],
        ['Pumpkin spice latte', 'CHF 35'],
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
        'Une fonction, un canton, un mot plus clair : nous lisons tout.',
        'idea',
      ],
      ['Ajouter une langue', 'Aidez à traduire Taxpresso dans votre langue.', 'language'],
      [
        'Écrire du code',
        'Lisez le guide de contribution, choisissez un ticket et proposez vos changements.',
        'code',
      ],
    ] as [string, string, keyof typeof ISSUE_URL][],
  },

  faq: {
    title: 'Questions',
    items: [
      [
        `Faut-il Claude${NB}?`,
        'Oui, pour l’instant. Taxpresso s’installe dans [Claude Desktop](https://claude.com/download) (Linux, macOS ou Windows) et fonctionne avec votre propre compte Claude. ChatGPT n’est pas encore disponible.',
      ],
      [
        `Taxpresso transmet-il ma déclaration${NB}?`,
        'Presque. Claude remplit pour vous la déclaration en ligne officielle, dans Claude in Chrome ou dans son navigateur intégré. Vous vous connectez, vous relisez le PDF officiel et vous appuyez vous-même sur Transmettre.',
      ],
      [
        `Est-ce un service officiel${NB}?`,
        'Non. Taxpresso est indépendant : il n’est lié ni à l’Administration fiscale cantonale de Genève (AFC), ni à Anthropic.',
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
        'Claude vous répond dans la langue où vous écrivez. L’application est en français et en anglais, puis viendront l’allemand, l’italien, l’espagnol et le portugais. Les termes officiels restent en français, comme sur le formulaire.',
      ],
    ] as [string, string][],
  },

  finePrint: {
    title: 'Les petites lignes, en clair',
    text: 'Taxpresso est un outil gratuit, fourni tel quel, sans aucune garantie. Nous ne sommes pas conseillers fiscaux : nous l’avons construit justement pour ne plus nous soucier de nos propres impôts. Taxpresso vous aide à préparer votre déclaration, mais c’est vous qui décidez de son contenu, et la déclaration que vous transmettez relève de votre responsabilité. En cas de doute, demandez à l’Administration fiscale cantonale (AFC) ou à une fiduciaire.',
  },

  start: {
    htmlTitle: 'Commencer avec Taxpresso',
    metaDescription:
      'Installez Taxpresso dans Claude Desktop et préparez votre déclaration genevoise, pas à pas.',
    title: 'Commencer',
    lead: 'Taxpresso est une extension pour Claude Desktop. Elle s’installe en une minute, et tout reste sur votre ordinateur.',
    download: 'Télécharger Taxpresso',
    downloadNote: 'Gratuit. Un seul fichier, pour Claude Desktop.',
    platforms: ['Linux (bêta)', 'macOS', 'Windows'],
    needsTitle: 'Ce qu’il vous faut',
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
        'Claude vous pose quelques questions simples, une à la fois. Pour répondre en cliquant ou déposer vos documents, demandez à Claude d’ouvrir votre tableau de bord.',
      ],
      [
        'Transmettez',
        'Quand tout est prêt, Claude remplit la déclaration en ligne officielle dans Claude in Chrome ou son navigateur intégré. Vous vous connectez, vous vérifiez et vous appuyez vous-même sur Transmettre.',
      ],
    ] as [string, string][],
    prompt: 'Aide-moi avec mes impôts genevois.',
    promptLabel: 'À écrire dans Claude',
    mockInstall: 'Installer',
    mockExtension: 'Votre déclaration genevoise, sur votre ordinateur.',
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
      'Taxpresso est indépendant et n’est lié ni à l’Administration fiscale cantonale de Genève, ni à Anthropic. Claude est une marque d’Anthropic.',
    noTracking: 'Ce site n’utilise ni cookies, ni traceurs, ni polices externes.',
    source: 'Code source',
  },
};

export type Copy = typeof fr;

const en: Copy = {
  htmlTitle: 'Taxpresso: your taxes, done over an espresso',
  metaDescription:
    'Taxpresso prepares your Geneva tax return with Claude, on your own computer. Free and open source.',
  skip: 'Skip to content',
  navLabel: 'Sections',
  langLabel: 'Language',
  suggestLanguage: 'Suggest a language',
  nav: { how: 'How it works', principles: 'Principles', faq: 'Questions', start: 'Get started' },

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
        'Claude fills in the official online declaration (e-démarches) for you, in Claude in Chrome or its built-in browser. Taxpresso checks the official PDF against your numbers. You press Transmettre yourself.',
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
        'Every amount follows the Geneva and federal tax guides, and cites its page. Claude explains; it doesn’t do the math.',
        'rosetta',
      ],
      [
        'You press transmit',
        'Claude fills in the online declaration for you. You sign in, review it and press Transmettre. Claude never types your passwords.',
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
      'Built in Geneva, for people taxed in Switzerland. Independent of the tax administration and of Anthropic.',
    ],
  },

  support: {
    title: 'Free, for good',
    text: 'Taxpresso is free and open source, and it stays that way. If it saved you an afternoon, the nicest thanks costs nothing: a star on GitHub, so others find it too.',
    star: {
      title: 'A star on GitHub',
      text: 'Free, takes a second, and helps other people in Switzerland find Taxpresso.',
      button: 'Star on GitHub',
    },
    tip: {
      title: 'The tip menu',
      note: 'Every tip goes to Precious Plastic Bugoma. Taxpresso keeps nothing.',
      button: 'Leave a tip',
      menu: [
        ['A glass of water', 'free'],
        ['Espresso', 'CHF 2.50'],
        ['Cappuccino', 'CHF 5'],
        ['Latte macchiato', 'CHF 10'],
        ['Café gourmand', 'CHF 20'],
        ['Pumpkin spice latte', 'CHF 35'],
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
      ['Add a language', 'Help translate Taxpresso into your language.', 'language'],
      ['Write code', 'Read the contributing guide, pick an issue and send your changes.', 'code'],
    ],
  },

  faq: {
    title: 'Questions',
    items: [
      [
        'Do I need Claude?',
        'Yes, for now. Taxpresso installs in [Claude Desktop](https://claude.com/download) (Linux, macOS or Windows) and works with your own Claude account. ChatGPT isn’t available yet.',
      ],
      [
        'Does Taxpresso file my return?',
        'Almost. Claude fills in the official online declaration for you, in Claude in Chrome or its built-in browser. You sign in, review the official PDF and press Transmettre yourself.',
      ],
      [
        'Is this an official service?',
        'No. Taxpresso is independent and not affiliated with the Geneva cantonal tax administration (AFC) or with Anthropic.',
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
        'Claude answers in the language you write in. The app is in French and English, with German, Italian, Spanish and Portuguese to come. Official terms stay in French, as on the form.',
      ],
    ],
  },

  finePrint: {
    title: 'The fine print, in plain words',
    text: 'Taxpresso is a free tool, provided as is, with no warranty. We’re not tax advisers: we built it precisely so we’d stop worrying about our own taxes. Taxpresso helps you prepare your return, but you decide what goes in it, and the return you transmit is your responsibility. When in doubt, ask the cantonal tax administration (AFC) or a fiduciary.',
  },

  start: {
    htmlTitle: 'Get started with Taxpresso',
    metaDescription:
      'Install Taxpresso in Claude Desktop and prepare your Geneva tax return, step by step.',
    title: 'Get started',
    lead: 'Taxpresso is an extension for Claude Desktop. It installs in a minute, and everything stays on your computer.',
    download: 'Download Taxpresso',
    downloadNote: 'Free. One file, for Claude Desktop.',
    platforms: ['Linux (beta)', 'macOS', 'Windows'],
    needsTitle: 'What you need',
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
        'Claude asks a few simple questions, one at a time. To answer by clicking or to drop in your documents, ask Claude to open your dashboard.',
      ],
      [
        'File',
        'When everything is ready, Claude fills in the official online declaration in Claude in Chrome or its built-in browser. You sign in, check it and press Transmettre yourself.',
      ],
    ],
    prompt: 'Help me with my Geneva taxes.',
    promptLabel: 'Write this in Claude',
    mockInstall: 'Install',
    mockExtension: 'Your Geneva tax return, on your computer.',
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
      'Taxpresso is independent and not affiliated with the Geneva cantonal tax administration or with Anthropic. Claude is a trademark of Anthropic.',
    noTracking: 'This site uses no cookies, no trackers and no external fonts.',
    source: 'Source code',
  },
};

const de: Copy = {
  htmlTitle: 'Taxpresso: Steuern, in einem Espresso erledigt',
  metaDescription:
    'Taxpresso erstellt Ihre Genfer Steuererklärung mit Claude, direkt auf Ihrem Computer. Kostenlos und Open Source.',
  skip: 'Zum Inhalt',
  navLabel: 'Abschnitte',
  langLabel: 'Sprache',
  suggestLanguage: 'Sprache vorschlagen',
  nav: { how: 'So funktioniert’s', principles: 'Grundsätze', faq: 'Fragen', start: 'Loslegen' },

  tagline: 'Steuern, in einem Espresso erledigt.',
  lead: 'Taxpresso erstellt Ihre Genfer Steuererklärung mit Claude, direkt auf Ihrem Computer. Rund 15 Fragen, Ihre Dokumente in beliebiger Reihenfolge, und jeder Abzug mit seinem Wert in Franken.',
  available: 'Verfügbar für die Steuererklärung 2026.',
  getStarted: 'Loslegen',
  seeHow: 'So funktioniert’s',
  badges: { swiss: 'Swiss made', open: 'Kostenlos und Open Source' },

  ticket: {
    caption: 'Beispielbeleg für eine mit Taxpresso erstellte Steuererklärung',
    sub: 'Steuererklärung 2026, Genf',
    lines: [
      ['Lohnausweis', 'geprüft', 'ok'],
      ['E-Steuerauszug (Bank)', 'geprüft', 'ok'],
      ['Bescheinigung Säule 3a', 'geprüft', 'ok'],
      ['Kinderbetreuung', 'zu bestätigen', 'confirm'],
      ['Abzüge', 'alle, in CHF', 'plain'],
      ['Online-Erklärung', 'ausgefüllt', 'plain'],
      ['Übermittlung', 'durch Sie', 'plain'],
    ],
    totalLabel: 'Gesamtzeit',
    totalValue: '1 Espresso',
    footer: 'Nichts verlässt Ihren Computer.',
  },

  how: {
    title: 'So funktioniert’s',
    steps: [
      [
        'Ein paar Fragen beantworten',
        'In Claude Desktop stellt Ihnen Claude ein paar einfache Fragen, eine nach der anderen, in Ihrer Sprache. Fügen Sie Ihre Dokumente hinzu, sobald Sie sie haben: Lohnausweise, Bankauszüge, Bescheinigungen.',
      ],
      [
        'Sehen, was Sie sparen',
        'Taxpresso berechnet Ihre Erklärung mit und ohne jeden Abzug und zeigt Ihnen, was jeder in Franken bringt. Sie entscheiden.',
      ],
      [
        'Prüfen und übermitteln',
        'Claude füllt die offizielle Online-Erklärung (e-démarches) für Sie aus, in Claude in Chrome oder im integrierten Browser. Taxpresso vergleicht das offizielle PDF mit Ihren Zahlen. Auf «Transmettre» drücken Sie selbst.',
      ],
    ],
  },

  principles: {
    title: 'Unsere Grundsätze',
    lead: 'Nichts verlässt Ihren Computer, ausser was Sie mit der KI teilen, die Sie nutzen.',
    items: [
      [
        'Niemand hat Zugriff auf Ihre Daten',
        'Weder wir noch sonst jemand. Kein Server, kein Konto, nichts geht ins Internet. Ihre Dokumente bleiben in einem Ordner auf Ihrem Computer.',
        'heart',
      ],
      [
        'Ausser der KI, die Sie nutzen',
        'Heute ist das Claude, mit Ihrem eigenen Konto: Claude sieht, was Sie im Gespräch teilen. ChatGPT ist noch nicht verfügbar.',
        'tulip',
      ],
      [
        'Ihre Einstellungen, nicht unsere',
        'In den Datenschutzeinstellungen von Claude entscheiden Sie, ob Ihre Chats zur Verbesserung beitragen dürfen, und Sie löschen sie, wann Sie wollen.',
        'dot',
      ],
      [
        'Nur offizielle Regeln',
        'Jeder Betrag folgt den Steuerleitfäden von Genf und vom Bund und nennt die Seite. Claude erklärt, rechnet aber nicht.',
        'rosetta',
      ],
      [
        'Sie übermitteln selbst',
        'Claude füllt die Online-Erklärung für Sie aus. Sie melden sich an, prüfen und drücken auf «Transmettre». Claude tippt nie Ihre Passwörter ein.',
        'check',
      ],
      [
        'Kostenlos und Open Source',
        'Taxpresso gehört seiner Community, unter der GNU AGPL. Alle können prüfen, was es tut, und helfen, es zu verbessern.',
        'swirl',
      ],
    ],
    swiss: [
      'Swiss made',
      'In Genf entwickelt, für Menschen, die in der Schweiz Steuern zahlen. Unabhängig von der Steuerverwaltung und von Anthropic.',
    ],
  },

  support: {
    title: 'Kostenlos, für immer',
    text: 'Taxpresso ist kostenlos und Open Source, und das bleibt so. Wenn es Ihnen einen Nachmittag gespart hat, kostet das schönste Dankeschön nichts: ein Stern auf GitHub, damit andere es auch finden.',
    star: {
      title: 'Ein Stern auf GitHub',
      text: 'Kostenlos, in einer Sekunde, und es hilft anderen in der Schweiz, Taxpresso zu finden.',
      button: 'Stern auf GitHub geben',
    },
    tip: {
      title: 'Die Trinkgeld-Karte',
      note: 'Jedes Trinkgeld geht an Precious Plastic Bugoma. Taxpresso behält nichts.',
      button: 'Trinkgeld geben',
      menu: [
        ['Ein Glas Wasser', 'gratis'],
        ['Espresso', 'CHF 2.50'],
        ['Cappuccino', 'CHF 5'],
        ['Latte macchiato', 'CHF 10'],
        ['Café gourmand', 'CHF 20'],
        ['Pumpkin Spice Latte', 'CHF 35'],
        ['Eine Runde für den Tisch', 'CHF 50'],
        ['Nach Ihrem Geschmack', 'Betrag nach Wahl'],
      ],
    },
    ppb: `Precious Plastic Bugoma ist ein Verein ohne Gewinnzweck mit Sitz in Vernier, Genf ([eingetragen unter CHE-185.673.320](${PPB_REGISTER})), der rund um den Bugoma-Wald in Uganda Plastikabfall recycelt. Taxpresso wird von Mitgliedern seines Teams entwickelt.`,
  },

  contribute: {
    title: 'Machen Sie es besser',
    lead: 'Taxpresso entsteht offen, auf GitHub (ein kostenloses Konto genügt).',
    items: [
      [
        'Fehler melden',
        'Stimmt etwas nicht oder ist unklar? Sagen Sie uns, was Sie erwartet haben. Nie echte Steuerdaten angeben.',
        'bug',
      ],
      [
        'Idee vorschlagen',
        'Eine Funktion, ein Kanton, ein klareres Wort: Wir lesen alles.',
        'idea',
      ],
      ['Sprache hinzufügen', 'Helfen Sie, Taxpresso in Ihre Sprache zu übersetzen.', 'language'],
      [
        'Code beitragen',
        'Lesen Sie die Anleitung für Beiträge, wählen Sie eine Aufgabe und schicken Sie Ihre Änderungen.',
        'code',
      ],
    ],
  },

  faq: {
    title: 'Fragen',
    items: [
      [
        'Brauche ich Claude?',
        'Ja, vorerst. Taxpresso wird in [Claude Desktop](https://claude.com/download) (Linux, macOS oder Windows) installiert und nutzt Ihr eigenes Claude-Konto. ChatGPT ist noch nicht verfügbar.',
      ],
      [
        'Übermittelt Taxpresso meine Erklärung?',
        'Fast. Claude füllt die offizielle Online-Erklärung für Sie aus, in Claude in Chrome oder im integrierten Browser. Sie melden sich an, prüfen das offizielle PDF und drücken selbst auf «Transmettre».',
      ],
      [
        'Ist das ein offizieller Dienst?',
        'Nein. Taxpresso ist unabhängig und weder mit der kantonalen Steuerverwaltung Genf (AFC) noch mit Anthropic verbunden.',
      ],
      [
        'Warum ist es kostenlos?',
        'Weil Steuern einfach und kostenlos sein sollten. Taxpresso ist Open Source (Lizenz GNU AGPL): Alle können prüfen, was es tut, und helfen, es zu verbessern, zu übersetzen oder einen Kanton hinzuzufügen. Niemand kann daraus eine geschlossene Version machen.',
      ],
      [
        'Und wenn ein Dokument fehlt?',
        'Sie können mit einer Schätzung weiterarbeiten. Taxpresso markiert sie überall, und Ihre Erklärung ist erst bereit, wenn jede Schätzung durch ein Dokument ersetzt oder von Ihnen bestätigt ist.',
      ],
      [
        'In welchen Sprachen?',
        'Claude antwortet in der Sprache, in der Sie schreiben. Die App gibt es auf Französisch und Englisch, Deutsch, Italienisch, Spanisch und Portugiesisch folgen. Offizielle Begriffe bleiben auf Französisch, wie im Formular.',
      ],
    ],
  },

  finePrint: {
    title: 'Das Kleingedruckte, in klaren Worten',
    text: 'Taxpresso ist ein kostenloses Werkzeug, bereitgestellt wie es ist, ohne jede Gewähr. Wir sind keine Steuerberater: Wir haben es gebaut, damit wir uns um unsere eigenen Steuern keine Sorgen mehr machen müssen. Taxpresso hilft Ihnen, Ihre Erklärung vorzubereiten, aber Sie entscheiden, was hineinkommt, und für die Erklärung, die Sie übermitteln, sind Sie verantwortlich. Im Zweifel fragen Sie die kantonale Steuerverwaltung (AFC) oder ein Treuhandbüro.',
  },

  start: {
    htmlTitle: 'Loslegen mit Taxpresso',
    metaDescription:
      'Installieren Sie Taxpresso in Claude Desktop und erstellen Sie Ihre Genfer Steuererklärung, Schritt für Schritt.',
    title: 'Loslegen',
    lead: 'Taxpresso ist eine Erweiterung für Claude Desktop. Sie ist in einer Minute installiert, und alles bleibt auf Ihrem Computer.',
    download: 'Taxpresso herunterladen',
    downloadNote: 'Kostenlos. Eine Datei, für Claude Desktop.',
    platforms: ['Linux (Beta)', 'macOS', 'Windows'],
    needsTitle: 'Was Sie brauchen',
    needs: [
      [
        'Claude Desktop',
        'Auf Linux, macOS oder Windows, angemeldet mit Ihrem Claude-Konto. [Claude Desktop herunterladen](https://claude.com/download)',
      ],
      ['Ihre Dokumente', 'Als PDF oder Foto, sobald Sie sie haben. Sie können auch ohne beginnen.'],
      [
        'Einen Browser für Claude',
        'Zum Ausfüllen der offiziellen Erklärung: Claude in Chrome oder der integrierte Browser von Claude.',
      ],
    ],
    stepsTitle: 'In sechs Schritten',
    steps: [
      [
        'Taxpresso herunterladen',
        'Eine kostenlose Datei, taxpresso-version.mcpb, von der Seite mit den Versionen des Projekts.',
      ],
      [
        'Installieren',
        'Öffnen Sie Claude Desktop und doppelklicken Sie auf die Datei. Claude Desktop zeigt Taxpresso und seine Werkzeuge: Klicken Sie auf Installieren. Passiert nichts, öffnen Sie Einstellungen, dann Erweiterungen, und ziehen Sie die Datei auf diese Seite.',
      ],
      [
        'Ordner behalten',
        'Claude Desktop schlägt einen Ordner für Ihre Steuerdokumente vor, Dokumente/Taxpresso. Behalten Sie ihn: Ihre Antworten und Dokumente bleiben dort, auf Ihrem Computer. Achten Sie darauf, dass Taxpresso eingeschaltet ist.',
      ],
      [
        'Hallo sagen',
        'Öffnen Sie einen neuen Chat und schreiben Sie den Satz unten. Beim ersten Mal fragt Claude, ob es Taxpresso verwenden darf: Erlauben Sie es.',
      ],
      [
        'Antworten und Dokumente hinzufügen',
        'Claude stellt ein paar einfache Fragen, eine nach der anderen. Um per Klick zu antworten oder Dokumente abzulegen, bitten Sie Claude, Ihr Dashboard zu öffnen.',
      ],
      [
        'Einreichen',
        'Wenn alles bereit ist, füllt Claude die offizielle Online-Erklärung in Claude in Chrome oder im integrierten Browser aus. Sie melden sich an, prüfen und drücken selbst auf «Transmettre».',
      ],
    ],
    prompt: 'Hilf mir mit meinen Genfer Steuern.',
    promptLabel: 'In Claude schreiben',
    mockInstall: 'Installieren',
    mockExtension: 'Ihre Genfer Steuererklärung, auf Ihrem Computer.',
    notes: [
      [
        'Ihre Einstellungen',
        'Nichts verlässt Ihren Computer, ausser was Sie mit Claude teilen. In den Einstellungen von Claude, unter Datenschutz, entscheiden Sie, ob Ihre Chats zur Verbesserung beitragen dürfen. Löschen Sie sie, wenn Ihre Erklärung fertig ist.',
      ],
      [
        'Vor dem 31. Dezember',
        'Fragen Sie Claude, wie viel Sie mit einer Einzahlung in die Säule 3a dieses Jahr sparen würden. Ein ungefährer Lohn genügt.',
      ],
      [
        'Aktualisieren',
        'Für eine neue Version entfernen Sie Taxpresso unter Einstellungen, Erweiterungen und installieren dann die neue Datei. Ihr Ordner bleibt, wie er ist.',
      ],
      [
        'Etwas klappt nicht?',
        `Funktioniert etwas nicht wie erwartet? [Sagen Sie es uns](${ISSUE_URL.bug}), aber nie mit echten Steuerdaten.`,
      ],
    ],
    back: 'Zurück zur Startseite',
  },

  footer: {
    independent:
      'Taxpresso ist unabhängig und weder mit der kantonalen Steuerverwaltung Genf noch mit Anthropic verbunden. Claude ist eine Marke von Anthropic.',
    noTracking:
      'Diese Website verwendet keine Cookies, keine Tracker und keine externen Schriften.',
    source: 'Quellcode',
  },
};

const it: Copy = {
  htmlTitle: 'Taxpresso: le imposte, il tempo di un espresso',
  metaDescription:
    'Taxpresso prepara la sua dichiarazione d’imposta ginevrina con Claude, sul suo computer. Gratuito e open source.',
  skip: 'Passare al contenuto',
  navLabel: 'Sezioni',
  langLabel: 'Lingua',
  suggestLanguage: 'Proporre una lingua',
  nav: { how: 'Come funziona', principles: 'Principi', faq: 'Domande', start: 'Per iniziare' },

  tagline: 'Le imposte, il tempo di un espresso.',
  lead: 'Taxpresso prepara la sua dichiarazione d’imposta ginevrina con Claude, sul suo computer. Una quindicina di domande, i suoi documenti in qualsiasi ordine, e per ogni deduzione il suo valore in franchi.',
  available: 'Disponibile per le dichiarazioni 2026.',
  getStarted: 'Iniziare',
  seeHow: 'Vedere come funziona',
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
      ['Trasmissione', 'da parte sua', 'plain'],
    ],
    totalLabel: 'Tempo totale',
    totalValue: '1 espresso',
    footer: 'Nulla esce dal suo computer.',
  },

  how: {
    title: 'Come funziona',
    steps: [
      [
        'Risponda a qualche domanda',
        'In Claude Desktop, Claude le fa alcune domande semplici, una alla volta, nella sua lingua. Aggiunga i suoi documenti quando li ha: certificati di salario, estratti bancari, attestazioni.',
      ],
      [
        'Veda quanto risparmia',
        'Taxpresso calcola la sua dichiarazione con e senza ogni deduzione, e le mostra quanto le fa risparmiare ciascuna in franchi. Sceglie lei.',
      ],
      [
        'Verifichi e trasmetta',
        'Claude compila per lei la dichiarazione online ufficiale (e-démarches), in Claude in Chrome o nel browser integrato. Taxpresso confronta il PDF ufficiale con le sue cifre. Il pulsante Transmettre lo preme lei.',
      ],
    ],
  },

  principles: {
    title: 'I nostri principi',
    lead: 'Nulla esce dal suo computer, tranne ciò che condivide con l’IA che usa.',
    items: [
      [
        'Nessuno ha accesso ai suoi dati',
        'Né noi, né nessun altro. Nessun server, nessun account, niente viene inviato su internet. I suoi documenti restano in una cartella sul suo computer.',
        'heart',
      ],
      [
        'Tranne l’IA che usa',
        'Oggi è Claude, con il suo account personale: vede ciò che lei condivide nella conversazione. ChatGPT non è ancora disponibile.',
        'tulip',
      ],
      [
        'Le sue impostazioni, non le nostre',
        'Nelle impostazioni sulla privacy di Claude decide lei se le sue conversazioni possono servire a migliorarlo, e le cancella quando vuole.',
        'dot',
      ],
      [
        'Solo regole ufficiali',
        'Ogni importo segue la guida fiscale ginevrina e quella federale, e ne cita la pagina. Claude spiega, ma non calcola.',
        'rosetta',
      ],
      [
        'È lei a trasmettere',
        'Claude compila per lei la dichiarazione online. Lei accede, la rilegge e preme Transmettre. Claude non digita mai le sue password.',
        'check',
      ],
      [
        'Gratuito e open source',
        'Taxpresso appartiene alla propria comunità, con licenza GNU AGPL. Chiunque può verificare cosa fa e aiutare a migliorarlo.',
        'swirl',
      ],
    ],
    swiss: [
      'Swiss made',
      'Ideato a Ginevra, per chi paga le imposte in Svizzera. Indipendente dall’amministrazione fiscale e da Anthropic.',
    ],
  },

  support: {
    title: 'Gratuito, per sempre',
    text: 'Taxpresso è gratuito e open source, e lo resterà. Se le ha fatto risparmiare un pomeriggio, il ringraziamento più bello non costa nulla: una stella su GitHub, perché anche altri lo trovino.',
    star: {
      title: 'Una stella su GitHub',
      text: 'Gratis, in un secondo, e aiuta altre persone in Svizzera a trovare Taxpresso.',
      button: 'Mettere una stella',
    },
    tip: {
      title: 'Il menu delle mance',
      note: 'Ogni mancia va a Precious Plastic Bugoma. Taxpresso non trattiene nulla.',
      button: 'Lasciare una mancia',
      menu: [
        ['Un bicchiere d’acqua', 'gratis'],
        ['Espresso', 'CHF 2.50'],
        ['Cappuccino', 'CHF 5'],
        ['Latte macchiato', 'CHF 10'],
        ['Café gourmand', 'CHF 20'],
        ['Pumpkin spice latte', 'CHF 35'],
        ['Un giro per tutta la tavolata', 'CHF 50'],
        ['A piacere', 'l’importo che vuole'],
      ],
    },
    ppb: `Precious Plastic Bugoma è un’associazione senza scopo di lucro con sede a Vernier, Ginevra ([iscritta con il numero CHE-185.673.320](${PPB_REGISTER})), che ricicla i rifiuti di plastica intorno alla foresta di Bugoma, in Uganda. Taxpresso è realizzato da membri del suo team.`,
  },

  contribute: {
    title: 'Ci aiuti a migliorarlo',
    lead: 'Taxpresso si costruisce alla luce del sole, su GitHub (basta un account gratuito).',
    items: [
      [
        'Segnalare un bug',
        'Qualcosa non va o non è chiaro? Ci dica cosa si aspettava. Non inserisca mai dati fiscali reali.',
        'bug',
      ],
      [
        'Proporre un’idea',
        'Una funzione, un cantone, una parola più chiara: leggiamo tutto.',
        'idea',
      ],
      ['Aggiungere una lingua', 'Ci aiuti a tradurre Taxpresso nella sua lingua.', 'language'],
      [
        'Scrivere codice',
        'Legga la guida per contribuire, scelga un ticket e proponga le sue modifiche.',
        'code',
      ],
    ],
  },

  faq: {
    title: 'Domande',
    items: [
      [
        'Serve Claude?',
        'Sì, per ora. Taxpresso si installa in [Claude Desktop](https://claude.com/download) (Linux, macOS o Windows) e funziona con il suo account Claude personale. ChatGPT non è ancora disponibile.',
      ],
      [
        'Taxpresso trasmette la mia dichiarazione?',
        'Quasi. Claude compila per lei la dichiarazione online ufficiale, in Claude in Chrome o nel browser integrato. Lei accede, rilegge il PDF ufficiale e preme personalmente Transmettre.',
      ],
      [
        'È un servizio ufficiale?',
        'No. Taxpresso è indipendente: non è legato né all’Amministrazione fiscale cantonale di Ginevra (AFC), né ad Anthropic.',
      ],
      [
        'Perché è gratuito?',
        'Perché la dichiarazione d’imposta dovrebbe essere semplice e gratuita. Taxpresso è open source (licenza GNU AGPL): chiunque può verificare cosa fa, e aiutare a migliorarlo, a tradurlo o ad aggiungere un cantone. Nessuno può farne una versione chiusa.',
      ],
      [
        'E se manca un documento?',
        'Può andare avanti con una stima. Taxpresso la segnala ovunque, e la sua dichiarazione è pronta solo quando ogni stima è stata sostituita da un documento o confermata da lei.',
      ],
      [
        'In quali lingue?',
        'Claude le risponde nella lingua in cui scrive. L’app è in francese e in inglese, poi arriveranno il tedesco, l’italiano, lo spagnolo e il portoghese. I termini ufficiali restano in francese, come sul modulo.',
      ],
    ],
  },

  finePrint: {
    title: 'Le clausole in piccolo, in parole semplici',
    text: 'Taxpresso è uno strumento gratuito, fornito così com’è, senza alcuna garanzia. Non siamo consulenti fiscali: l’abbiamo creato proprio per non doverci più preoccupare delle nostre imposte. Taxpresso la aiuta a preparare la sua dichiarazione, ma è lei a decidere cosa contiene, e la dichiarazione che trasmette è sotto la sua responsabilità. In caso di dubbio, si rivolga all’Amministrazione fiscale cantonale (AFC) o a una fiduciaria.',
  },

  start: {
    htmlTitle: 'Iniziare con Taxpresso',
    metaDescription:
      'Installi Taxpresso in Claude Desktop e prepari la sua dichiarazione d’imposta ginevrina, passo dopo passo.',
    title: 'Per iniziare',
    lead: 'Taxpresso è un’estensione per Claude Desktop. Si installa in un minuto, e tutto resta sul suo computer.',
    download: 'Scaricare Taxpresso',
    downloadNote: 'Gratuito. Un solo file, per Claude Desktop.',
    platforms: ['Linux (beta)', 'macOS', 'Windows'],
    needsTitle: 'Cosa le serve',
    needs: [
      [
        'Claude Desktop',
        'Su Linux, macOS o Windows, connesso al suo account Claude. [Scaricare Claude Desktop](https://claude.com/download)',
      ],
      ['I suoi documenti', 'In PDF o in foto, appena li ha. Può anche iniziare senza.'],
      [
        'Un browser per Claude',
        'Per compilare la dichiarazione ufficiale: Claude in Chrome, o il browser integrato di Claude.',
      ],
    ],
    stepsTitle: 'In sei passi',
    steps: [
      [
        'Scarichi Taxpresso',
        'Un solo file gratuito, taxpresso-version.mcpb, dalla pagina delle versioni del progetto.',
      ],
      [
        'Lo installi',
        'Apra Claude Desktop, poi faccia doppio clic sul file. Claude Desktop le mostra Taxpresso e i suoi strumenti: clicchi su Installa. Se non succede nulla, apra Impostazioni, poi Estensioni, e trascini il file su quella pagina.',
      ],
      [
        'Tenga la sua cartella',
        'Claude Desktop propone una cartella per i suoi documenti fiscali, Documenti/Taxpresso. La tenga: le sue risposte e i suoi documenti restano lì, sul suo computer. Verifichi che Taxpresso sia attivato.',
      ],
      [
        'Saluti Claude',
        'Apra una nuova conversazione e scriva la frase qui sotto. La prima volta, Claude le chiede il permesso di usare Taxpresso: lo consenta.',
      ],
      [
        'Risponda e aggiunga i suoi documenti',
        'Claude le fa alcune domande semplici, una alla volta. Per rispondere con un clic o caricare i suoi documenti, chieda a Claude di aprire la sua dashboard.',
      ],
      [
        'Trasmetta',
        'Quando tutto è pronto, Claude compila la dichiarazione online ufficiale in Claude in Chrome o nel browser integrato. Lei accede, verifica e preme personalmente Transmettre.',
      ],
    ],
    prompt: 'Aiutami con le mie imposte a Ginevra.',
    promptLabel: 'Da scrivere in Claude',
    mockInstall: 'Installa',
    mockExtension: 'La sua dichiarazione d’imposta ginevrina, sul suo computer.',
    notes: [
      [
        'Le sue impostazioni',
        'Nulla esce dal suo computer, tranne ciò che condivide con Claude. Nelle impostazioni di Claude, alla voce Privacy, decide lei se le sue conversazioni possono servire a migliorare Claude. Le cancelli una volta finita la dichiarazione.',
      ],
      [
        'Prima del 31 dicembre',
        'Chieda a Claude quanto le farebbe risparmiare quest’anno un versamento nel pilastro 3a (3e pilier A). Basta un salario approssimativo.',
      ],
      [
        'Aggiornare',
        'Per installare una nuova versione, rimuova Taxpresso in Impostazioni, Estensioni, poi installi il nuovo file. La sua cartella resta com’è.',
      ],
      [
        'Un problema?',
        `Qualcosa non funziona come previsto? [Ce lo dica](${ISSUE_URL.bug}), senza mai inserire dati fiscali reali.`,
      ],
    ],
    back: 'Tornare alla pagina iniziale',
  },

  footer: {
    independent:
      'Taxpresso è indipendente e non è legato né all’Amministrazione fiscale cantonale di Ginevra, né ad Anthropic. Claude è un marchio di Anthropic.',
    noTracking: 'Questo sito non usa né cookie, né tracker, né font esterni.',
    source: 'Codice sorgente',
  },
};

const es: Copy = {
  htmlTitle: 'Taxpresso: sus impuestos, en lo que dura un espresso',
  metaDescription:
    'Taxpresso prepara su declaración de impuestos de Ginebra con Claude, en su propio ordenador. Gratis y de código abierto.',
  skip: 'Ir al contenido',
  navLabel: 'Secciones',
  langLabel: 'Idioma',
  suggestLanguage: 'Proponer un idioma',
  nav: { how: 'Cómo funciona', principles: 'Principios', faq: 'Preguntas', start: 'Empezar' },

  tagline: 'Sus impuestos, en lo que dura un espresso.',
  lead: 'Taxpresso prepara su declaración de impuestos de Ginebra con Claude, en su propio ordenador. Unas quince preguntas, sus documentos en cualquier orden, y cada deducción con su valor en francos.',
  available: 'Disponible para las declaraciones de 2026.',
  getStarted: 'Empezar',
  seeHow: 'Ver cómo funciona',
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
      ['Envío', 'por usted', 'plain'],
    ],
    totalLabel: 'Tiempo total',
    totalValue: '1 espresso',
    footer: 'Nada sale de su ordenador.',
  },

  how: {
    title: 'Cómo funciona',
    steps: [
      [
        'Responda a unas preguntas',
        'En Claude Desktop, Claude le hace unas preguntas sencillas, una a una, en su idioma. Añada sus documentos cuando los tenga: certificados de salario, extractos bancarios, justificantes.',
      ],
      [
        'Vea cuánto ahorra',
        'Taxpresso calcula su declaración con y sin cada deducción, y le muestra cuánto le ahorra cada una en francos. Usted decide.',
      ],
      [
        'Revise y presente',
        'Claude rellena por usted la declaración oficial en línea (e-démarches), en Claude in Chrome o en el navegador integrado. Taxpresso compara el PDF oficial con sus cifras. Quien pulsa Transmettre es usted.',
      ],
    ],
  },

  principles: {
    title: 'Nuestros principios',
    lead: 'Nada sale de su ordenador, salvo lo que comparte con la IA que utiliza.',
    items: [
      [
        'Nadie tiene acceso a sus datos',
        'Ni nosotros ni nadie. Sin servidor, sin cuenta, nada se envía por internet. Sus documentos se quedan en una carpeta de su ordenador.',
        'heart',
      ],
      [
        'Salvo la IA que utiliza',
        'Hoy es Claude, con su propia cuenta: ve lo que usted comparte en la conversación. ChatGPT aún no está disponible.',
        'tulip',
      ],
      [
        'Su configuración, no la nuestra',
        'En la configuración de privacidad de Claude, usted decide si sus conversaciones pueden servir para mejorarlo, y las borra cuando quiera.',
        'dot',
      ],
      [
        'Solo reglas oficiales',
        'Cada importe sigue las guías fiscales de Ginebra y de la Confederación, y cita su página. Claude explica, pero no calcula.',
        'rosetta',
      ],
      [
        'Quien envía es usted',
        'Claude rellena la declaración en línea por usted. Usted inicia sesión, la revisa y pulsa Transmettre. Claude nunca escribe sus contraseñas.',
        'check',
      ],
      [
        'Gratis y de código abierto',
        'Taxpresso pertenece a su comunidad, con licencia GNU AGPL. Cualquiera puede comprobar lo que hace y ayudar a mejorarlo.',
        'swirl',
      ],
    ],
    swiss: [
      'Swiss made',
      'Creado en Ginebra, para quienes pagan impuestos en Suiza. Independiente de la administración fiscal y de Anthropic.',
    ],
  },

  support: {
    title: 'Gratis, para siempre',
    text: 'Taxpresso es gratis y de código abierto, y lo seguirá siendo. Si le ha ahorrado una tarde, el mejor agradecimiento no cuesta nada: una estrella en GitHub, para que otros también lo encuentren.',
    star: {
      title: 'Una estrella en GitHub',
      text: 'Gratis, en un segundo, y ayuda a otras personas en Suiza a encontrar Taxpresso.',
      button: 'Dar una estrella',
    },
    tip: {
      title: 'La carta de propinas',
      note: 'Cada propina va a Precious Plastic Bugoma. Taxpresso no se queda con nada.',
      button: 'Dejar una propina',
      menu: [
        ['Un vaso de agua', 'gratis'],
        ['Espresso', 'CHF 2.50'],
        ['Capuchino', 'CHF 5'],
        ['Latte macchiato', 'CHF 10'],
        ['Café gourmand', 'CHF 20'],
        ['Pumpkin spice latte', 'CHF 35'],
        ['Una ronda para toda la mesa', 'CHF 50'],
        ['A su gusto', 'el importe que quiera'],
      ],
    },
    ppb: `Precious Plastic Bugoma es una asociación sin ánimo de lucro con sede en Vernier, Ginebra ([inscrita con el número CHE-185.673.320](${PPB_REGISTER})), que recicla residuos plásticos en torno al bosque de Bugoma, en Uganda. Taxpresso lo desarrollan miembros de su equipo.`,
  },

  contribute: {
    title: 'Mejórelo con nosotros',
    lead: 'Taxpresso se construye en abierto, en GitHub (basta con una cuenta gratuita).',
    items: [
      [
        'Informar de un error',
        '¿Algo falla o no está claro? Cuéntenos qué esperaba. No incluya nunca datos fiscales reales.',
        'bug',
      ],
      [
        'Proponer una idea',
        'Una función, un cantón, una palabra más clara: lo leemos todo.',
        'idea',
      ],
      ['Añadir un idioma', 'Ayude a traducir Taxpresso a su idioma.', 'language'],
      [
        'Escribir código',
        'Lea la guía de contribución, elija una incidencia y envíe sus cambios.',
        'code',
      ],
    ],
  },

  faq: {
    title: 'Preguntas',
    items: [
      [
        '¿Necesito Claude?',
        'Sí, por ahora. Taxpresso se instala en [Claude Desktop](https://claude.com/download) (Linux, macOS o Windows) y funciona con su propia cuenta de Claude. ChatGPT aún no está disponible.',
      ],
      [
        '¿Taxpresso presenta mi declaración?',
        'Casi. Claude rellena por usted la declaración oficial en línea, en Claude in Chrome o en el navegador integrado. Usted inicia sesión, revisa el PDF oficial y el botón Transmettre lo pulsa usted.',
      ],
      [
        '¿Es un servicio oficial?',
        'No. Taxpresso es independiente: no está vinculado ni a la Administración fiscal cantonal de Ginebra (AFC) ni a Anthropic.',
      ],
      [
        '¿Por qué es gratis?',
        'Porque declarar impuestos debería ser sencillo y gratis. Taxpresso es de código abierto (licencia GNU AGPL): cualquiera puede comprobar lo que hace, y ayudar a mejorarlo, traducirlo o añadir un cantón. Nadie puede convertirlo en una versión cerrada.',
      ],
      [
        '¿Y si falta un documento?',
        'Puede seguir adelante con una estimación. Taxpresso la señala en todas partes, y su declaración solo está lista cuando cada estimación se ha sustituido por un documento o usted la ha confirmado.',
      ],
      [
        '¿En qué idiomas?',
        'Claude le responde en el idioma en el que usted escribe. La aplicación está en francés e inglés, y después llegarán el alemán, el italiano, el español y el portugués. Los términos oficiales se quedan en francés, como en el formulario.',
      ],
    ],
  },

  finePrint: {
    title: 'La letra pequeña, en palabras claras',
    text: 'Taxpresso es una herramienta gratuita, ofrecida tal cual, sin ninguna garantía. No somos asesores fiscales: lo creamos precisamente para dejar de preocuparnos por nuestros propios impuestos. Taxpresso le ayuda a preparar su declaración, pero usted decide lo que incluye, y la declaración que envía es responsabilidad suya. Si tiene dudas, pregunte a la Administración fiscal cantonal (AFC) o a una gestoría.',
  },

  start: {
    htmlTitle: 'Empezar con Taxpresso',
    metaDescription:
      'Instale Taxpresso en Claude Desktop y prepare su declaración de impuestos de Ginebra, paso a paso.',
    title: 'Empezar',
    lead: 'Taxpresso es una extensión para Claude Desktop. Se instala en un minuto, y todo se queda en su ordenador.',
    download: 'Descargar Taxpresso',
    downloadNote: 'Gratis. Un solo archivo, para Claude Desktop.',
    platforms: ['Linux (beta)', 'macOS', 'Windows'],
    needsTitle: 'Qué necesita',
    needs: [
      [
        'Claude Desktop',
        'En Linux, macOS o Windows, con la sesión iniciada en su cuenta de Claude. [Descargar Claude Desktop](https://claude.com/download)',
      ],
      ['Sus documentos', 'En PDF o en foto, cuando los tenga. Puede empezar sin ellos.'],
      [
        'Un navegador para Claude',
        'Para rellenar la declaración oficial: Claude in Chrome, o el navegador integrado de Claude.',
      ],
    ],
    stepsTitle: 'En seis pasos',
    steps: [
      [
        'Descargue Taxpresso',
        'Un solo archivo gratuito, taxpresso-version.mcpb, en la página de versiones del proyecto.',
      ],
      [
        'Instálelo',
        'Abra Claude Desktop y haga doble clic en el archivo. Claude Desktop le muestra Taxpresso y sus herramientas: haga clic en Instalar. Si no pasa nada, abra Configuración, luego Extensiones, y arrastre el archivo a esa página.',
      ],
      [
        'Conserve su carpeta',
        'Claude Desktop le propone una carpeta para sus documentos fiscales, Documentos/Taxpresso. Consérvela: sus respuestas y sus documentos se quedan ahí, en su ordenador. Compruebe que Taxpresso está activado.',
      ],
      [
        'Salude a Claude',
        'Abra una conversación nueva y escriba la frase de abajo. La primera vez, Claude le pide permiso para usar Taxpresso: concédaselo.',
      ],
      [
        'Responda y añada sus documentos',
        'Claude le hace unas preguntas sencillas, una a una. Para responder con clics o subir sus documentos, pídale a Claude que abra su panel.',
      ],
      [
        'Presente su declaración',
        'Cuando todo esté listo, Claude rellena la declaración oficial en línea en Claude in Chrome o en el navegador integrado. Usted inicia sesión, la revisa y el botón Transmettre lo pulsa usted.',
      ],
    ],
    prompt: 'Ayúdame con mis impuestos de Ginebra.',
    promptLabel: 'Escriba esto en Claude',
    mockInstall: 'Instalar',
    mockExtension: 'Su declaración de Ginebra, en su ordenador.',
    notes: [
      [
        'Su configuración',
        'Nada sale de su ordenador, salvo lo que comparte con Claude. En la configuración de Claude, en el apartado Privacidad, usted decide si sus conversaciones pueden servir para mejorar Claude. Bórrelas cuando haya terminado su declaración.',
      ],
      [
        'Antes del 31 de diciembre',
        'Pregunte a Claude cuánto le ahorraría este año una aportación al pilar 3a (3e pilier A). Basta con un salario aproximado.',
      ],
      [
        'Actualizar',
        'Para instalar una nueva versión, desinstale Taxpresso en Configuración, Extensiones, y luego instale el nuevo archivo. Su carpeta se queda como está.',
      ],
      [
        '¿Algún problema?',
        `¿Algo no funciona como debería? [Cuéntenoslo](${ISSUE_URL.bug}), sin incluir nunca datos fiscales reales.`,
      ],
    ],
    back: 'Volver a la página de inicio',
  },

  footer: {
    independent:
      'Taxpresso es independiente y no está vinculado ni a la Administración fiscal cantonal de Ginebra ni a Anthropic. Claude es una marca de Anthropic.',
    noTracking: 'Este sitio no usa cookies, ni rastreadores, ni fuentes externas.',
    source: 'Código fuente',
  },
};

const pt: Copy = {
  htmlTitle: 'Taxpresso: os seus impostos, no tempo de um expresso',
  metaDescription:
    'O Taxpresso prepara a sua declaração de impostos de Genebra com o Claude, no seu próprio computador. Gratuito e de código aberto.',
  skip: 'Saltar para o conteúdo',
  navLabel: 'Secções',
  langLabel: 'Idioma',
  suggestLanguage: 'Sugerir um idioma',
  nav: { how: 'Como funciona', principles: 'Princípios', faq: 'Perguntas', start: 'Começar' },

  tagline: 'Os seus impostos, no tempo de um expresso.',
  lead: 'O Taxpresso prepara a sua declaração de impostos de Genebra com o Claude, no seu próprio computador. Umas quinze perguntas, os seus documentos por qualquer ordem, e cada dedução com o seu valor em francos.',
  available: 'Disponível para as declarações de 2026.',
  getStarted: 'Começar',
  seeHow: 'Ver como funciona',
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
      ['Envio', 'feito por si', 'plain'],
    ],
    totalLabel: 'Tempo total',
    totalValue: '1 expresso',
    footer: 'Nada sai do seu computador.',
  },

  how: {
    title: 'Como funciona',
    steps: [
      [
        'Responda a algumas perguntas',
        'No Claude Desktop, o Claude faz-lhe algumas perguntas simples, uma de cada vez, na sua língua. Junte os seus documentos quando os tiver: certificados de salário, extratos bancários, comprovativos.',
      ],
      [
        'Veja quanto poupa',
        'O Taxpresso calcula a sua declaração com e sem cada dedução, e mostra-lhe quanto cada uma lhe poupa em francos. A escolha é sua.',
      ],
      [
        'Verifique e envie',
        'O Claude preenche por si a declaração online oficial (e-démarches), no Claude in Chrome ou no navegador integrado. O Taxpresso compara o PDF oficial com os seus números. O clique em Transmettre é sempre seu.',
      ],
    ],
  },

  principles: {
    title: 'Os nossos princípios',
    lead: 'Nada sai do seu computador, exceto o que partilha com a IA que utiliza.',
    items: [
      [
        'Ninguém tem acesso aos seus dados',
        'Nem nós, nem ninguém. Sem servidor, sem conta, nada é enviado pela internet. Os seus documentos ficam numa pasta no seu computador.',
        'heart',
      ],
      [
        'Exceto a IA que utiliza',
        'Hoje é o Claude, com a sua própria conta: ele vê o que partilha na conversa. O ChatGPT ainda não está disponível.',
        'tulip',
      ],
      [
        'As suas configurações, não as nossas',
        'Nas configurações de privacidade do Claude, decide se as suas conversas podem ajudar a melhorá-lo, e apaga-as quando quiser.',
        'dot',
      ],
      [
        'Só as regras oficiais',
        'Cada montante segue os guias fiscais de Genebra e da Confederação, e cita a página. O Claude explica, mas não faz as contas.',
        'rosetta',
      ],
      [
        'O envio fica consigo',
        'O Claude preenche a declaração online por si. A si cabe iniciar sessão, revê-la e clicar em Transmettre. O Claude nunca escreve as suas palavras-passe.',
        'check',
      ],
      [
        'Gratuito e de código aberto',
        'O Taxpresso pertence à sua comunidade, sob licença GNU AGPL. Qualquer pessoa pode verificar o que ele faz e ajudar a melhorá-lo.',
        'swirl',
      ],
    ],
    swiss: [
      'Swiss made',
      'Criado em Genebra, para quem paga impostos na Suíça. Independente da administração fiscal e da Anthropic.',
    ],
  },

  support: {
    title: 'Gratuito, para sempre',
    text: 'O Taxpresso é gratuito e de código aberto, e vai continuar a sê-lo. Se lhe poupou uma tarde, o melhor agradecimento não custa nada: uma estrela no GitHub, para que outros também o encontrem.',
    star: {
      title: 'Uma estrela no GitHub',
      text: 'Grátis, num segundo, e ajuda outras pessoas na Suíça a encontrar o Taxpresso.',
      button: 'Dar uma estrela',
    },
    tip: {
      title: 'A ementa das gorjetas',
      note: 'Cada gorjeta vai para a Precious Plastic Bugoma. O Taxpresso não fica com nada.',
      button: 'Deixar uma gorjeta',
      menu: [
        ['Um copo de água', 'grátis'],
        ['Expresso', 'CHF 2.50'],
        ['Cappuccino', 'CHF 5'],
        ['Galão', 'CHF 10'],
        ['Café gourmand', 'CHF 20'],
        ['Pumpkin spice latte', 'CHF 35'],
        ['Uma rodada para a mesa', 'CHF 50'],
        ['A seu gosto', 'o valor que quiser'],
      ],
    },
    ppb: `A Precious Plastic Bugoma é uma associação sem fins lucrativos sediada em Vernier, Genebra ([registada com o número CHE-185.673.320](${PPB_REGISTER})), que recicla resíduos de plástico em redor da floresta de Bugoma, no Uganda. O Taxpresso é desenvolvido por membros da sua equipa.`,
  },

  contribute: {
    title: 'Ajude-nos a melhorá-lo',
    lead: 'O Taxpresso é construído às claras, no GitHub (basta uma conta gratuita).',
    items: [
      [
        'Comunicar um erro',
        'Algo está mal ou pouco claro? Diga-nos o que esperava. Nunca inclua dados fiscais reais.',
        'bug',
      ],
      [
        'Sugerir uma ideia',
        'Uma funcionalidade, um cantão, uma palavra mais clara: lemos tudo.',
        'idea',
      ],
      ['Adicionar uma língua', 'Ajude a traduzir o Taxpresso para a sua língua.', 'language'],
      [
        'Escrever código',
        'Leia o guia de contribuição, escolha uma tarefa e envie as suas alterações.',
        'code',
      ],
    ],
  },

  faq: {
    title: 'Perguntas',
    items: [
      [
        'Preciso do Claude?',
        'Sim, por agora. O Taxpresso instala-se no [Claude Desktop](https://claude.com/download) (Linux, macOS ou Windows) e funciona com a sua própria conta Claude. O ChatGPT ainda não está disponível.',
      ],
      [
        'O Taxpresso envia a minha declaração?',
        'Quase. O Claude preenche por si a declaração online oficial, no Claude in Chrome ou no navegador integrado. A si cabe iniciar sessão, rever o PDF oficial e clicar em Transmettre.',
      ],
      [
        'É um serviço oficial?',
        'Não. O Taxpresso é independente: não está ligado nem à Administração Fiscal Cantonal de Genebra (AFC), nem à Anthropic.',
      ],
      [
        'Porque é gratuito?',
        'Porque declarar impostos devia ser simples e gratuito. O Taxpresso é de código aberto (licença GNU AGPL): qualquer pessoa pode verificar o que ele faz, e ajudar a melhorá-lo, a traduzi-lo ou a adicionar um cantão. Ninguém pode transformá-lo numa versão fechada.',
      ],
      [
        'E se faltar um documento?',
        'Pode avançar com uma estimativa. O Taxpresso assinala-a em todo o lado, e a sua declaração só fica pronta quando cada estimativa for substituída por um documento ou confirmada por si.',
      ],
      [
        'Em que línguas?',
        'O Claude responde-lhe na língua em que escreve. A aplicação está em francês e inglês, e depois virão o alemão, o italiano, o espanhol e o português. Os termos oficiais ficam em francês, como no formulário.',
      ],
    ],
  },

  finePrint: {
    title: 'A letra miudinha, em palavras simples',
    text: 'O Taxpresso é uma ferramenta gratuita, fornecida tal como está, sem qualquer garantia. Não somos consultores fiscais: criámo-lo precisamente para deixarmos de nos preocupar com os nossos próprios impostos. O Taxpresso ajuda-o a preparar a sua declaração, mas a decisão sobre o que ela contém é sua, e a declaração que envia é da sua responsabilidade. Em caso de dúvida, pergunte à Administração Fiscal Cantonal (AFC) ou a um contabilista.',
  },

  start: {
    htmlTitle: 'Começar com o Taxpresso',
    metaDescription:
      'Instale o Taxpresso no Claude Desktop e prepare a sua declaração de impostos de Genebra, passo a passo.',
    title: 'Começar',
    lead: 'O Taxpresso é uma extensão para o Claude Desktop. Instala-se num minuto, e tudo fica no seu computador.',
    download: 'Descarregar o Taxpresso',
    downloadNote: 'Gratuito. Um só ficheiro, para o Claude Desktop.',
    platforms: ['Linux (beta)', 'macOS', 'Windows'],
    needsTitle: 'Do que precisa',
    needs: [
      [
        'Claude Desktop',
        'Em Linux, macOS ou Windows, com sessão iniciada na sua conta Claude. [Descarregar o Claude Desktop](https://claude.com/download)',
      ],
      ['Os seus documentos', 'Em PDF ou fotografia, quando os tiver. Pode começar sem eles.'],
      [
        'Um navegador para o Claude',
        'Para preencher a declaração oficial: o Claude in Chrome, ou o navegador integrado do Claude.',
      ],
    ],
    stepsTitle: 'Em seis passos',
    steps: [
      [
        'Descarregue o Taxpresso',
        'Um só ficheiro gratuito, taxpresso-version.mcpb, na página de versões do projeto.',
      ],
      [
        'Instale-o',
        'Abra o Claude Desktop e faça duplo clique no ficheiro. O Claude Desktop mostra-lhe o Taxpresso e as suas ferramentas: clique em Instalar. Se nada acontecer, abra Configurações, depois Extensões, e arraste o ficheiro para essa página.',
      ],
      [
        'Mantenha a sua pasta',
        'O Claude Desktop propõe uma pasta para os seus documentos fiscais, Documentos/Taxpresso. Mantenha-a: as suas respostas e documentos ficam lá, no seu computador. Confirme que o Taxpresso está ativado.',
      ],
      [
        'Diga olá',
        'Abra uma nova conversa e escreva a frase abaixo. Da primeira vez, o Claude pede-lhe autorização para usar o Taxpresso: autorize.',
      ],
      [
        'Responda e junte os seus documentos',
        'O Claude faz-lhe algumas perguntas simples, uma de cada vez. Para responder com cliques ou carregar os seus documentos, peça ao Claude que abra o seu painel.',
      ],
      [
        'Envie',
        'Quando tudo estiver pronto, o Claude preenche a declaração online oficial no Claude in Chrome ou no navegador integrado. A si cabe iniciar sessão, verificar e clicar em Transmettre.',
      ],
    ],
    prompt: 'Ajuda-me com os meus impostos de Genebra.',
    promptLabel: 'Escreva isto no Claude',
    mockInstall: 'Instalar',
    mockExtension: 'A sua declaração de Genebra, no seu computador.',
    notes: [
      [
        'As suas configurações',
        'Nada sai do seu computador, exceto o que partilha com o Claude. Nas configurações do Claude, em Privacidade, decide se as suas conversas podem ajudar a melhorar o Claude. Apague-as quando terminar a declaração.',
      ],
      [
        'Antes de 31 de dezembro',
        'Pergunte ao Claude quanto lhe pouparia este ano uma contribuição para o pilar 3a (3e pilier A). Basta um salário aproximado.',
      ],
      [
        'Atualizar',
        'Para instalar uma nova versão, remova o Taxpresso em Configurações, Extensões, e depois instale o novo ficheiro. A sua pasta fica como está.',
      ],
      [
        'Algum problema?',
        `Algo não funciona como devia? [Diga-nos](${ISSUE_URL.bug}), sem nunca incluir dados fiscais reais.`,
      ],
    ],
    back: 'Voltar à página inicial',
  },

  footer: {
    independent:
      'O Taxpresso é independente e não está ligado nem à Administração Fiscal Cantonal de Genebra, nem à Anthropic. Claude é uma marca da Anthropic.',
    noTracking: 'Este site não usa cookies, nem rastreadores, nem tipos de letra externos.',
    source: 'Código-fonte',
  },
};

export const copy: Record<Lang, Copy> = { fr, en, de, it, es, pt };

/** Where each language lives on the site. French is the default: Geneva. */
export const LANGS: { lang: Lang; path: string; label: string; name: string }[] = [
  { lang: 'fr', path: '/', label: 'FR', name: 'Français' },
  { lang: 'en', path: '/en/', label: 'EN', name: 'English' },
  { lang: 'de', path: '/de/', label: 'DE', name: 'Deutsch' },
  { lang: 'it', path: '/it/', label: 'IT', name: 'Italiano' },
  { lang: 'es', path: '/es/', label: 'ES', name: 'Español' },
  { lang: 'pt', path: '/pt/', label: 'PT', name: 'Português' },
];

/** The Get started page of a language. */
export const startPath = (path: string) => `${path}start/`;
