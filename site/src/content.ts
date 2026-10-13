// Website copy: the home page and the Get started page. French first (Geneva), then English and
// German; a native speaker reviews each before launch (SPEC.md section 1). Second person, plain
// words, no en or em dashes, official French terms next to their gloss. No tax amounts or rules
// here: those live in the product, each with its source. Links use [text](https://...) and are
// rendered by render.ts.

const NB = String.fromCharCode(0xa0); // French spacing before : ? ! ; and inside « »

export type Lang = 'fr' | 'en' | 'de';
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
  lead: 'Taxpresso prépare votre déclaration d’impôt genevoise avec Claude, sur votre ordinateur. Une quinzaine de questions, vos documents en vrac, et chaque déduction avec sa valeur en francs.',
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
  htmlTitle: 'Taxpresso: your taxes, in one espresso',
  metaDescription:
    'Taxpresso prepares your Geneva tax return with Claude, on your own computer. Free and open source.',
  skip: 'Skip to content',
  navLabel: 'Sections',
  langLabel: 'Language',
  suggestLanguage: 'Suggest a language',
  nav: { how: 'How it works', principles: 'Principles', faq: 'Questions', start: 'Get started' },

  tagline: 'Your taxes, in one espresso.',
  lead: 'Taxpresso prepares your Geneva tax return with Claude, on your own computer. About 15 questions, your documents in any order, and every deduction with its value in francs.',
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

export const copy: Record<Lang, Copy> = { fr, en, de };

/** Where each language lives on the site. French is the default: Geneva. */
export const LANGS: { lang: Lang; path: string; label: string; name: string }[] = [
  { lang: 'fr', path: '/', label: 'FR', name: 'Français' },
  { lang: 'en', path: '/en/', label: 'EN', name: 'English' },
  { lang: 'de', path: '/de/', label: 'DE', name: 'Deutsch' },
];

/** The Get started page of a language. */
export const startPath = (path: string) => `${path}start/`;
