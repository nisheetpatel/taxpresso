// Landing page and Get started page copy. French first (Geneva), then English and German; a native
// speaker reviews each before launch (SPEC.md section 1). Second person, plain words, no en or em
// dashes, official French terms next to their gloss. No tax amounts or rules here: those live in
// the product, each with its source. Links use [text](https://...) and are rendered by render.ts.

const NB = String.fromCharCode(0xa0); // French spacing before : ? ! ; and inside « »

export type Lang = 'fr' | 'en' | 'de';
export type Tone = 'ok' | 'confirm' | 'plain';
/** Latte art drawn in each principle's cup (render.ts). */
export type Art = 'heart' | 'tulip' | 'dot' | 'rosetta' | 'check' | 'swirl';

const fr = {
  htmlTitle: `Taxpresso${NB}: vos impôts, le temps d’un espresso`,
  metaDescription:
    'Taxpresso prépare votre déclaration d’impôt genevoise avec Claude, sur votre ordinateur. Gratuit et open source.',
  skip: 'Aller au contenu',
  navLabel: 'Sections',
  langLabel: 'Langue',
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
    footer: 'Rien n’a quitté votre ordinateur.',
  },

  how: {
    title: 'Comment ça marche',
    steps: [
      [
        'Racontez, déposez',
        'Répondez à une quinzaine de questions, ici ou directement à Claude, dans votre langue. Déposez vos documents en vrac : certificats de salaire, relevés bancaires, attestations.',
      ],
      [
        'Optimisez',
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
    title: 'Dire merci',
    headline: 'Gratuit et open source. Le café, c’est vous qui voyez.',
    text: 'Les impôts devraient être simples, sans douleur et gratuits. Le code de Taxpresso est ouvert (licence GNU AGPL) et appartient à sa communauté : chacun peut le lire, l’améliorer et le partager. Si vous voulez dire merci ou soutenir une cause, choisissez une boisson : tout va en don à Precious Plastic Bugoma, qui recycle les déchets plastiques autour de la forêt de Bugoma, en Ouganda. Taxpresso ne reçoit rien.',
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
    donate: 'Faire un don à Precious Plastic Bugoma',
    source: 'Lire le code sur GitHub',
  },

  faq: {
    title: 'Questions',
    items: [
      [
        `Faut-il Claude${NB}?`,
        'Oui, pour l’instant. Taxpresso s’installe dans [Claude Desktop](https://claude.com/download) (Mac ou Windows) et fonctionne avec votre propre compte Claude. ChatGPT n’est pas encore disponible.',
      ],
      [
        `Taxpresso transmet-il ma déclaration${NB}?`,
        'Presque. Claude remplit pour vous la déclaration en ligne officielle, dans Claude in Chrome ou dans son navigateur intégré. Vous vous connectez, vous relisez le PDF officiel et vous appuyez vous-même sur Transmettre.',
      ],
      [
        `Est-ce un service officiel${NB}?`,
        'Non. Taxpresso est indépendant : il n’est lié ni à l’Administration fiscale cantonale de Genève (AFC), ni à Anthropic. Ce n’est pas un conseil fiscal, et vous restez responsable de votre déclaration.',
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

  start: {
    htmlTitle: 'Commencer avec Taxpresso',
    metaDescription:
      'Installez Taxpresso dans Claude Desktop et préparez votre déclaration genevoise, pas à pas.',
    title: 'Commencer',
    lead: 'Taxpresso est une extension pour Claude Desktop. Elle s’installe en une minute, et tout reste sur votre ordinateur.',
    download: 'Télécharger Taxpresso',
    downloadNote: 'Le fichier .mcpb de la dernière version.',
    needsTitle: 'Ce qu’il vous faut',
    needs: [
      'Claude Desktop sur Mac ou Windows, connecté à votre compte Claude.',
      'Vos documents 2026, en PDF ou en photo, dès que vous les avez. Vous pouvez commencer sans.',
      'Pour remplir la déclaration officielle : Claude in Chrome, ou le navigateur intégré de Claude.',
    ],
    stepsTitle: 'Pas à pas',
    steps: [
      [
        'Téléchargez Taxpresso',
        'C’est gratuit, directement depuis la page des versions du projet.',
      ],
      [
        'Installez-le dans Claude Desktop',
        'Double-cliquez sur le fichier, ou glissez-le sur la page Paramètres, Extensions de Claude Desktop, puis cliquez sur Installer. Gardez le dossier proposé, Documents/Taxpresso : vos réponses et vos documents y restent.',
      ],
      [
        'Dites bonjour',
        `Ouvrez une nouvelle conversation et écrivez${NB}: «${NB}Aide-moi avec mes impôts genevois.${NB}» Claude vous pose une quinzaine de questions, une à la fois. Vous pouvez aussi répondre dans le tableau de bord${NB}: demandez à Claude de l’ouvrir.`,
      ],
      [
        'Ajoutez vos documents',
        'Déposez-les dans le tableau de bord ou dans votre dossier Taxpresso. Claude les lit avec vous, et vous confirmez chaque montant.',
      ],
      [
        'Avant le 31 décembre',
        'Demandez ce qu’un versement au 3e pilier A vous ferait économiser cette année. Un salaire approximatif suffit.',
      ],
      [
        'Transmettez',
        'Quand tout est prêt, Claude remplit la déclaration en ligne officielle dans Claude in Chrome ou son navigateur intégré. Vous vous connectez, vous relisez et vous appuyez vous-même sur Transmettre.',
      ],
    ] as [string, string][],
    privacyTitle: 'Vos réglages',
    privacyText:
      'Rien ne quitte votre ordinateur, sauf ce que vous partagez avec Claude. Dans les paramètres de Claude, rubrique Confidentialité, vous décidez si vos conversations peuvent servir à améliorer Claude. Supprimez vos conversations une fois votre déclaration faite.',
    updateTitle: 'Mettre à jour',
    updateText:
      'Pour installer une nouvelle version, retirez Taxpresso dans Paramètres, Extensions, puis installez le nouveau fichier. Votre dossier reste tel quel.',
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
    footer: 'Nothing left your computer.',
  },

  how: {
    title: 'How it works',
    steps: [
      [
        'Tell and drop',
        'Answer about 15 questions, here or just by telling Claude, in your own language. Drop in your documents in any order: salary certificates, bank statements, attestations.',
      ],
      [
        'Optimize',
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
    title: 'Say thanks',
    headline: 'Free and open source. The coffee is up to you.',
    text: 'Taxes should be painless, simple and free. Taxpresso’s code is open (GNU AGPL license) and belongs to its community: anyone can read it, improve it and share it. If you’d like to say thanks or support a good cause, pick a drink: it all goes as a donation to Precious Plastic Bugoma, which recycles plastic waste around Bugoma forest in Uganda. Taxpresso keeps nothing.',
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
    donate: 'Donate to Precious Plastic Bugoma',
    source: 'Read the code on GitHub',
  },

  faq: {
    title: 'Questions',
    items: [
      [
        'Do I need Claude?',
        'Yes, for now. Taxpresso installs in [Claude Desktop](https://claude.com/download) (Mac or Windows) and works with your own Claude account. ChatGPT isn’t available yet.',
      ],
      [
        'Does Taxpresso file my return?',
        'Almost. Claude fills in the official online declaration for you, in Claude in Chrome or its built-in browser. You sign in, review the official PDF and press Transmettre yourself.',
      ],
      [
        'Is this an official service?',
        'No. Taxpresso is independent and not affiliated with the Geneva cantonal tax administration (AFC) or with Anthropic. It isn’t tax advice, and you remain responsible for your return.',
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

  start: {
    htmlTitle: 'Get started with Taxpresso',
    metaDescription:
      'Install Taxpresso in Claude Desktop and prepare your Geneva tax return, step by step.',
    title: 'Get started',
    lead: 'Taxpresso is an extension for Claude Desktop. It installs in a minute, and everything stays on your computer.',
    download: 'Download Taxpresso',
    downloadNote: 'The .mcpb file of the latest version.',
    needsTitle: 'What you need',
    needs: [
      'Claude Desktop on a Mac or Windows computer, signed in to your Claude account.',
      'Your 2026 documents, as PDFs or photos, whenever you have them. You can start without them.',
      'To fill in the official declaration: Claude in Chrome, or Claude’s built-in browser.',
    ],
    stepsTitle: 'Step by step',
    steps: [
      ['Download Taxpresso', 'It’s free, straight from the project’s releases page.'],
      [
        'Install it in Claude Desktop',
        'Double-click the file, or drag it onto the Settings, Extensions page of Claude Desktop, then click Install. Keep the suggested folder, Documents/Taxpresso: your answers and documents live there.',
      ],
      [
        'Say hello',
        'Start a new chat and write: “Help me with my Geneva taxes.” Claude asks about 15 questions, one at a time. You can also answer in the dashboard: ask Claude to open it.',
      ],
      [
        'Add your documents',
        'Drop them in the dashboard or in your Taxpresso folder. Claude reads them with you, and you confirm each amount.',
      ],
      [
        'Before 31 December',
        'Ask what a pillar 3a payment would save you this year. A rough salary is enough.',
      ],
      [
        'File',
        'When everything is ready, Claude fills in the official online declaration in Claude in Chrome or its built-in browser. You sign in, review it and press Transmettre yourself.',
      ],
    ],
    privacyTitle: 'Your settings',
    privacyText:
      'Nothing leaves your computer except what you share with Claude. In Claude’s settings, under Privacy, you decide whether your chats may help improve Claude. Delete your chats once your return is done.',
    updateTitle: 'Updating',
    updateText:
      'To install a new version, remove Taxpresso under Settings, Extensions, then install the new file. Your folder stays as it is.',
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
    footer: 'Nichts hat Ihren Computer verlassen.',
  },

  how: {
    title: 'So funktioniert’s',
    steps: [
      [
        'Erzählen und ablegen',
        'Beantworten Sie rund 15 Fragen, hier oder direkt im Gespräch mit Claude, in Ihrer Sprache. Legen Sie Ihre Dokumente einfach ab: Lohnausweise, Bankauszüge, Bescheinigungen.',
      ],
      [
        'Optimieren',
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
    title: 'Danke sagen',
    headline: 'Kostenlos und Open Source. Den Kaffee bestimmen Sie.',
    text: 'Steuern sollten einfach, schmerzlos und kostenlos sein. Der Code von Taxpresso ist offen (Lizenz GNU AGPL) und gehört seiner Community: Alle können ihn lesen, verbessern und weitergeben. Wenn Sie Danke sagen oder eine gute Sache unterstützen möchten, wählen Sie ein Getränk: Alles geht als Spende an Precious Plastic Bugoma, das Plastikabfall rund um den Bugoma-Wald in Uganda recycelt. Taxpresso behält nichts.',
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
    donate: 'An Precious Plastic Bugoma spenden',
    source: 'Den Code auf GitHub lesen',
  },

  faq: {
    title: 'Fragen',
    items: [
      [
        'Brauche ich Claude?',
        'Ja, vorerst. Taxpresso wird in [Claude Desktop](https://claude.com/download) (Mac oder Windows) installiert und nutzt Ihr eigenes Claude-Konto. ChatGPT ist noch nicht verfügbar.',
      ],
      [
        'Übermittelt Taxpresso meine Erklärung?',
        'Fast. Claude füllt die offizielle Online-Erklärung für Sie aus, in Claude in Chrome oder im integrierten Browser. Sie melden sich an, prüfen das offizielle PDF und drücken selbst auf «Transmettre».',
      ],
      [
        'Ist das ein offizieller Dienst?',
        'Nein. Taxpresso ist unabhängig und weder mit der kantonalen Steuerverwaltung Genf (AFC) noch mit Anthropic verbunden. Es ist keine Steuerberatung: Für Ihre Erklärung bleiben Sie verantwortlich.',
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

  start: {
    htmlTitle: 'Loslegen mit Taxpresso',
    metaDescription:
      'Installieren Sie Taxpresso in Claude Desktop und erstellen Sie Ihre Genfer Steuererklärung, Schritt für Schritt.',
    title: 'Loslegen',
    lead: 'Taxpresso ist eine Erweiterung für Claude Desktop. Sie ist in einer Minute installiert, und alles bleibt auf Ihrem Computer.',
    download: 'Taxpresso herunterladen',
    downloadNote: 'Die .mcpb-Datei der neuesten Version.',
    needsTitle: 'Was Sie brauchen',
    needs: [
      'Claude Desktop auf einem Mac oder Windows-Computer, angemeldet mit Ihrem Claude-Konto.',
      'Ihre Dokumente für 2026, als PDF oder Foto, sobald Sie sie haben. Sie können auch ohne beginnen.',
      'Zum Ausfüllen der offiziellen Erklärung: Claude in Chrome oder der integrierte Browser von Claude.',
    ],
    stepsTitle: 'Schritt für Schritt',
    steps: [
      [
        'Taxpresso herunterladen',
        'Kostenlos, direkt von der Seite mit den Versionen des Projekts.',
      ],
      [
        'In Claude Desktop installieren',
        'Doppelklicken Sie auf die Datei oder ziehen Sie sie auf die Seite Einstellungen, Erweiterungen von Claude Desktop, dann auf Installieren. Behalten Sie den vorgeschlagenen Ordner Dokumente/Taxpresso: Dort bleiben Ihre Antworten und Dokumente.',
      ],
      [
        'Hallo sagen',
        'Starten Sie einen neuen Chat und schreiben Sie: «Hilf mir mit meinen Genfer Steuern.» Claude stellt Ihnen rund 15 Fragen, eine nach der anderen. Sie können auch im Dashboard antworten: Bitten Sie Claude, es zu öffnen.',
      ],
      [
        'Dokumente hinzufügen',
        'Legen Sie sie im Dashboard oder in Ihrem Taxpresso-Ordner ab. Claude liest sie mit Ihnen, und Sie bestätigen jeden Betrag.',
      ],
      [
        'Vor dem 31. Dezember',
        'Fragen Sie, wie viel Sie mit einer Einzahlung in die Säule 3a dieses Jahr sparen würden. Ein ungefährer Lohn genügt.',
      ],
      [
        'Einreichen',
        'Wenn alles bereit ist, füllt Claude die offizielle Online-Erklärung in Claude in Chrome oder im integrierten Browser aus. Sie melden sich an, prüfen und drücken selbst auf «Transmettre».',
      ],
    ],
    privacyTitle: 'Ihre Einstellungen',
    privacyText:
      'Nichts verlässt Ihren Computer, ausser was Sie mit Claude teilen. In den Einstellungen von Claude, unter Datenschutz, entscheiden Sie, ob Ihre Chats zur Verbesserung von Claude beitragen dürfen. Löschen Sie Ihre Chats, wenn Ihre Erklärung fertig ist.',
    updateTitle: 'Aktualisieren',
    updateText:
      'Für eine neue Version entfernen Sie Taxpresso unter Einstellungen, Erweiterungen und installieren dann die neue Datei. Ihr Ordner bleibt, wie er ist.',
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

/** Donations go straight to Precious Plastic Bugoma; Taxpresso never handles money (SPEC.md section 12). */
export const DONATE_URL = 'https://www.preciousplasticbugoma.com/';

/** The public repository, and where each release's .mcpb is published. */
export const SOURCE_URL = 'https://github.com/nisheetpatel/taxpresso';
export const DOWNLOAD_URL = `${SOURCE_URL}/releases/latest`;

/** Where each language lives on the site. French is the default: Geneva. */
export const LANGS: { lang: Lang; path: string; label: string; name: string }[] = [
  { lang: 'fr', path: '/', label: 'FR', name: 'Français' },
  { lang: 'en', path: '/en/', label: 'EN', name: 'English' },
  { lang: 'de', path: '/de/', label: 'DE', name: 'Deutsch' },
];

/** The Get started page of a language. */
export const startPath = (path: string) => `${path}start/`;
