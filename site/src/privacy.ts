// The privacy policy, at /<lang>/privacy/, in every language of the site. Same voice as
// content.ts: vous in French, the informal you in German, Italian, Spanish and Portuguese, Swiss
// spelling in German, no en or em dashes. It says only what the code does (SPEC.md sections 2 and
// 15): the extension makes no network requests (C2), never reads Claude's chat history, memory or
// uploads (C6), never types passwords or transmits (C4). A native speaker reviews each language
// before launch (SPEC.md section 1).

import { SOURCE_URL, type Lang } from './content.ts';
import { frenchSpacing, type Section } from './guides.ts';

/** The day this policy last changed (YYYY-MM-DD), shown at the top of the page. */
export const PRIVACY_UPDATED = '2026-10-14';

/** Anthropic's privacy policy, for what happens in Claude. */
const ANTHROPIC_PRIVACY = 'https://www.anthropic.com/legal/privacy';
const MAIL = '[hello@taxpresso.ch](mailto:hello@taxpresso.ch)';

export interface PrivacyCopy {
  htmlTitle: string;
  metaDescription: string;
  /** The footer link. */
  link: string;
  title: string;
  lead: string;
  /** "{date}" becomes PRIVACY_UPDATED, written out in the page's language. */
  updated: string;
  sections: Section[];
}

// French: plain spaces before ? ! : ; here, frenchSpacing makes them non-breaking.
const fr: PrivacyCopy = frenchSpacing({
  htmlTitle: 'Politique de confidentialité · Taxpresso',
  metaDescription:
    'Comment Taxpresso traite vos données : l’extension fonctionne sur votre ordinateur et n’envoie rien sur internet. Ce que voit Claude, et ce que garde ce site.',
  link: 'Confidentialité',
  title: 'Politique de confidentialité',
  lead: 'Taxpresso est conçu pour que vos données fiscales restent chez vous. Voici, en clair, ce qui arrive à vos données dans l’extension, dans Claude et sur ce site.',
  updated: 'Dernière mise à jour : {date}',
  sections: [
    {
      h: 'L’extension : tout reste sur votre ordinateur',
      p: [
        'Taxpresso est une extension pour Claude Desktop. Elle fonctionne sur votre ordinateur, et tout ce qu’elle garde reste dans votre propre dossier fiscal (Documents/Taxpresso, sauf si vous en avez choisi un autre) : vos réponses, vos documents et ce qu’elle calcule.',
      ],
      list: [
        'Elle ne fait aucune requête réseau : elle n’envoie rien sur internet, ni à nous, ni à personne.',
        'Pas de télémétrie, pas de statistiques, pas de vérification de mises à jour.',
        'Pas de compte, pas d’inscription.',
        'Le tableau de bord s’ouvre depuis votre ordinateur et ne fonctionne que là.',
      ],
    },
    {
      h: 'Rien ne nous parvient',
      p: [
        'Taxpresso n’a aucun serveur qui reçoive vos données : nous ne les recevons jamais. Pour effacer tout ce que Taxpresso a gardé, supprimez votre dossier fiscal. Retirer l’extension laisse le dossier en place.',
      ],
    },
    {
      h: 'Claude, l’IA que vous utilisez',
      p: [
        'Taxpresso fonctionne dans Claude, avec votre propre compte. Ce que vous partagez dans une conversation (vos messages, et les documents que Claude lit avec vous) va à l’entreprise derrière votre IA, Anthropic pour Claude. Elle les traite selon ses propres conditions et sa politique de confidentialité, et selon les réglages que vous choisissez.',
        'Vous gardez la main : dans les paramètres de Claude, rubrique Confidentialité, vous décidez si vos conversations peuvent servir à améliorer Claude, et vous les supprimez quand vous voulez.',
        'Taxpresso ne lit jamais votre historique de conversations, la mémoire de Claude ni les fichiers que vous envoyez à Claude : il ne lit que les documents de votre dossier fiscal.',
        `Lisez la [politique de confidentialité d’Anthropic](${ANTHROPIC_PRIVACY}).`,
      ],
    },
    {
      h: 'Quand vous transmettez',
      p: [
        'Pour transmettre, Claude remplit la déclaration en ligne officielle dans un navigateur, sur le site de l’administration fiscale genevoise (e-démarches). Ce que Claude y voit fait partie de votre conversation. Vous vous connectez vous-même et vous appuyez vous-même sur Transmettre : Claude ne tape jamais vos mots de passe. Ce que vous transmettez va à l’Administration fiscale cantonale (AFC), comme pour toute déclaration.',
      ],
    },
    {
      h: 'Ce site',
      p: [],
      list: [
        'Pas de cookies, pas de statistiques, pas de traceurs, pas de formulaires.',
        'Les polices et les styles viennent de ce site : rien ne se charge depuis un autre.',
        'Vercel, qui héberge ce site, peut garder les journaux de serveur habituels, comme les adresses IP et les pages demandées, comme tout hébergeur.',
        'Les liens vers GitHub (code source, téléchargements, tickets) et vers les pages officielles mènent à d’autres sites, avec leurs propres règles de confidentialité.',
      ],
    },
    {
      h: 'Nous écrire',
      p: [
        `Une question sur vos données ou sur cette page ? Écrivez à ${MAIL}. Nous recevons votre adresse e-mail et votre message, pour vous répondre. N’envoyez jamais de vrais documents fiscaux ni de numéros personnels, par e-mail ou dans un ticket GitHub.`,
      ],
    },
    {
      h: 'Vérifiez par vous-même',
      p: [
        `Taxpresso est open source : chacun peut lire son [code source](${SOURCE_URL}) et vérifier ce qu’il fait. Si cette page change, sa date change aussi.`,
      ],
    },
  ],
});

const en: PrivacyCopy = {
  htmlTitle: 'Privacy policy · Taxpresso',
  metaDescription:
    'How Taxpresso handles your data: the extension runs on your computer and sends nothing over the internet. What Claude sees, and what this website keeps.',
  link: 'Privacy',
  title: 'Privacy policy',
  lead: 'Taxpresso is built so that your tax data stays with you. Here is, in plain words, what happens to your data in the extension, in Claude and on this website.',
  updated: 'Last updated: {date}',
  sections: [
    {
      h: 'The extension: everything stays on your computer',
      p: [
        'Taxpresso is an extension for Claude Desktop. It runs on your computer, and everything it keeps stays in your own tax folder (Documents/Taxpresso, unless you chose another one): your answers, your documents and what it works out.',
      ],
      list: [
        'It makes no network requests: it sends nothing over the internet, to us or to anyone else.',
        'No telemetry, no analytics, no update checks.',
        'No account and no sign-up.',
        'The dashboard opens from your own computer and only works there.',
      ],
    },
    {
      h: 'Nothing reaches us',
      p: [
        'Taxpresso has no server that receives your data: we never get it. To delete everything Taxpresso kept, delete your tax folder. Removing the extension leaves the folder where it is.',
      ],
    },
    {
      h: 'Claude, the AI you use',
      p: [
        'Taxpresso works inside Claude, under your own account. What you share in a conversation (your messages, and the documents Claude reads with you) goes to the company behind your AI, Anthropic for Claude. It processes them under its own terms and privacy policy, and under the settings you choose.',
        'You stay in control: in Claude’s settings, under Privacy, you decide whether your chats may be used to improve Claude, and you delete your conversations whenever you like.',
        'Taxpresso never reads your chat history, Claude’s memory or the files you upload to Claude: it only reads the documents in your tax folder.',
        `Read [Anthropic’s privacy policy](${ANTHROPIC_PRIVACY}).`,
      ],
    },
    {
      h: 'When you file',
      p: [
        'To file, Claude fills in the official online declaration in a browser, on the Geneva tax office’s own site (e-démarches). What Claude sees there is part of your conversation. You sign in yourself and you press Transmettre yourself: Claude never types your passwords. What you transmit goes to the cantonal tax office (AFC), as with any return.',
      ],
    },
    {
      h: 'This website',
      p: [],
      list: [
        'No cookies, no analytics, no trackers and no forms.',
        'Fonts and styles come from this site: nothing loads from another one.',
        'Vercel, which hosts this site, may keep the usual server logs, such as IP addresses and the pages requested, as any web host does.',
        'Links to GitHub (source code, downloads, issues) and to official pages take you to other sites, with their own privacy rules.',
      ],
    },
    {
      h: 'Write to us',
      p: [
        `A question about your data or about this page? Write to ${MAIL}. We receive your email address and your message, to reply to you. Never send real tax documents or personal numbers, by email or in a GitHub issue.`,
      ],
    },
    {
      h: 'Check for yourself',
      p: [
        `Taxpresso is open source: anyone can read its [source code](${SOURCE_URL}) and check what it does. If this page changes, its date changes too.`,
      ],
    },
  ],
};

const de: PrivacyCopy = {
  htmlTitle: 'Datenschutzerklärung · Taxpresso',
  metaDescription:
    'Wie Taxpresso mit deinen Daten umgeht: Die Erweiterung läuft auf deinem Computer und sendet nichts ins Internet. Was Claude sieht und was diese Website speichert.',
  link: 'Datenschutz',
  title: 'Datenschutzerklärung',
  lead: 'Taxpresso ist so gebaut, dass deine Steuerdaten bei dir bleiben. Hier steht in einfachen Worten, was mit deinen Daten in der Erweiterung, in Claude und auf dieser Website passiert.',
  updated: 'Zuletzt aktualisiert: {date}',
  sections: [
    {
      h: 'Die Erweiterung: Alles bleibt auf deinem Computer',
      p: [
        'Taxpresso ist eine Erweiterung für Claude Desktop. Sie läuft auf deinem Computer, und alles, was sie speichert, bleibt in deinem eigenen Steuerordner (Dokumente/Taxpresso, ausser du hast einen anderen gewählt): deine Antworten, deine Dokumente und was sie berechnet.',
      ],
      list: [
        'Sie stellt keine Netzwerkanfragen: Sie sendet nichts ins Internet, weder an uns noch an sonst jemanden.',
        'Keine Telemetrie, keine Statistiken, keine Update-Prüfung.',
        'Kein Konto und keine Anmeldung.',
        'Das Dashboard öffnet sich auf deinem eigenen Computer und funktioniert nur dort.',
      ],
    },
    {
      h: 'Nichts kommt bei uns an',
      p: [
        'Taxpresso hat keinen Server, der deine Daten empfängt: Wir bekommen sie nie. Um alles zu löschen, was Taxpresso gespeichert hat, lösch deinen Steuerordner. Wenn du die Erweiterung entfernst, bleibt der Ordner, wo er ist.',
      ],
    },
    {
      h: 'Claude, die KI, die du nutzt',
      p: [
        'Taxpresso läuft in Claude, mit deinem eigenen Konto. Was du in einer Unterhaltung teilst (deine Nachrichten und die Dokumente, die Claude mit dir liest), geht an das Unternehmen hinter deiner KI, bei Claude an Anthropic. Es verarbeitet sie nach seinen eigenen Bedingungen und seiner Datenschutzerklärung und nach den Einstellungen, die du wählst.',
        'Du behältst die Kontrolle: In den Einstellungen von Claude, unter Datenschutz, entscheidest du, ob deine Chats helfen dürfen, Claude zu verbessern, und du löschst deine Unterhaltungen, wann du willst.',
        'Taxpresso liest nie deinen Chatverlauf, das Gedächtnis von Claude oder die Dateien, die du in Claude hochlädst: Es liest nur die Dokumente in deinem Steuerordner.',
        `Lies die [Datenschutzerklärung von Anthropic](${ANTHROPIC_PRIVACY}).`,
      ],
    },
    {
      h: 'Wenn du einreichst',
      p: [
        'Zum Einreichen füllt Claude die offizielle Online-Steuererklärung in einem Browser aus, auf der Website der Genfer Steuerverwaltung (e-démarches). Was Claude dort sieht, gehört zu deiner Unterhaltung. Du meldest dich selbst an und klickst selbst auf Transmettre: Claude tippt nie deine Passwörter. Was du übermittelst, geht an die kantonale Steuerverwaltung (AFC), wie bei jeder Steuererklärung.',
      ],
    },
    {
      h: 'Diese Website',
      p: [],
      list: [
        'Keine Cookies, keine Statistiken, keine Tracker und keine Formulare.',
        'Schriften und Styles kommen von dieser Website: Nichts wird von einer anderen geladen.',
        'Vercel, das diese Website hostet, kann die üblichen Server-Logs speichern, etwa IP-Adressen und die aufgerufenen Seiten, wie jeder Webhoster.',
        'Links zu GitHub (Quellcode, Downloads, Issues) und zu offiziellen Seiten führen zu anderen Websites, mit ihren eigenen Datenschutzregeln.',
      ],
    },
    {
      h: 'Schreib uns',
      p: [
        `Eine Frage zu deinen Daten oder zu dieser Seite? Schreib an ${MAIL}. Wir erhalten deine E-Mail-Adresse und deine Nachricht, um dir zu antworten. Schick nie echte Steuerdokumente oder persönliche Nummern, weder per E-Mail noch in einem GitHub-Issue.`,
      ],
    },
    {
      h: 'Prüf es selbst',
      p: [
        `Taxpresso ist Open Source: Alle können den [Quellcode](${SOURCE_URL}) lesen und prüfen, was er tut. Ändert sich diese Seite, ändert sich auch ihr Datum.`,
      ],
    },
  ],
};

const it: PrivacyCopy = {
  htmlTitle: 'Informativa sulla privacy · Taxpresso',
  metaDescription:
    'Come Taxpresso tratta i tuoi dati: l’estensione funziona sul tuo computer e non invia nulla su internet. Cosa vede Claude e cosa conserva questo sito.',
  link: 'Privacy',
  title: 'Informativa sulla privacy',
  lead: 'Taxpresso è fatto perché i tuoi dati fiscali restino con te. Ecco, in parole semplici, cosa succede ai tuoi dati nell’estensione, in Claude e su questo sito.',
  updated: 'Ultimo aggiornamento: {date}',
  sections: [
    {
      h: 'L’estensione: tutto resta sul tuo computer',
      p: [
        'Taxpresso è un’estensione per Claude Desktop. Funziona sul tuo computer, e tutto ciò che conserva resta nella tua cartella fiscale (Documenti/Taxpresso, a meno che tu ne abbia scelta un’altra): le tue risposte, i tuoi documenti e ciò che calcola.',
      ],
      list: [
        'Non fa nessuna richiesta di rete: non invia nulla su internet, né a noi né a nessun altro.',
        'Niente telemetria, niente statistiche, nessun controllo degli aggiornamenti.',
        'Nessun account e nessuna registrazione.',
        'La dashboard si apre dal tuo computer e funziona solo lì.',
      ],
    },
    {
      h: 'A noi non arriva nulla',
      p: [
        'Taxpresso non ha nessun server che riceva i tuoi dati: noi non li riceviamo mai. Per cancellare tutto ciò che Taxpresso ha conservato, elimina la tua cartella fiscale. Se rimuovi l’estensione, la cartella resta dov’è.',
      ],
    },
    {
      h: 'Claude, l’IA che usi',
      p: [
        'Taxpresso funziona dentro Claude, con il tuo account. Ciò che condividi in una conversazione (i tuoi messaggi e i documenti che Claude legge con te) va all’azienda dietro la tua IA, Anthropic per Claude. Li tratta secondo le proprie condizioni e la propria informativa sulla privacy, e secondo le impostazioni che scegli tu.',
        'Hai tu il controllo: nelle impostazioni di Claude, alla voce Privacy, decidi se le tue chat possono servire a migliorare Claude, e cancelli le conversazioni quando vuoi.',
        'Taxpresso non legge mai la cronologia delle chat, la memoria di Claude né i file che carichi su Claude: legge solo i documenti nella tua cartella fiscale.',
        `Leggi l’[informativa sulla privacy di Anthropic](${ANTHROPIC_PRIVACY}).`,
      ],
    },
    {
      h: 'Quando invii la dichiarazione',
      p: [
        'Per inviarla, Claude compila la dichiarazione online ufficiale in un browser, sul sito dell’amministrazione fiscale ginevrina (e-démarches). Ciò che Claude vede lì fa parte della tua conversazione. Accedi tu e premi tu Transmettre: Claude non digita mai le tue password. Ciò che trasmetti va all’Amministrazione fiscale cantonale (AFC), come per ogni dichiarazione.',
      ],
    },
    {
      h: 'Questo sito',
      p: [],
      list: [
        'Niente cookie, statistiche, tracker o moduli.',
        'Font e stili arrivano da questo sito: nulla viene caricato da altri siti.',
        'Vercel, che ospita questo sito, può conservare i normali log del server, come gli indirizzi IP e le pagine richieste, come ogni hosting.',
        'I link a GitHub (codice sorgente, download, segnalazioni) e alle pagine ufficiali portano ad altri siti, con le loro regole sulla privacy.',
      ],
    },
    {
      h: 'Scrivici',
      p: [
        `Una domanda sui tuoi dati o su questa pagina? Scrivi a ${MAIL}. Riceviamo il tuo indirizzo e-mail e il tuo messaggio, per risponderti. Non inviare mai veri documenti fiscali o numeri personali, né per e-mail né in una segnalazione su GitHub.`,
      ],
    },
    {
      h: 'Verifica tu stesso',
      p: [
        `Taxpresso è open source: chiunque può leggere il suo [codice sorgente](${SOURCE_URL}) e verificare cosa fa. Se questa pagina cambia, cambia anche la sua data.`,
      ],
    },
  ],
};

const es: PrivacyCopy = {
  htmlTitle: 'Política de privacidad · Taxpresso',
  metaDescription:
    'Cómo trata Taxpresso tus datos: la extensión funciona en tu ordenador y no envía nada por internet. Lo que ve Claude y lo que guarda este sitio.',
  link: 'Privacidad',
  title: 'Política de privacidad',
  lead: 'Taxpresso está hecho para que tus datos fiscales se queden contigo. Aquí tienes, en palabras sencillas, lo que pasa con tus datos en la extensión, en Claude y en este sitio.',
  updated: 'Última actualización: {date}',
  sections: [
    {
      h: 'La extensión: todo se queda en tu ordenador',
      p: [
        'Taxpresso es una extensión para Claude Desktop. Funciona en tu ordenador, y todo lo que guarda se queda en tu propia carpeta fiscal (Documentos/Taxpresso, salvo que hayas elegido otra): tus respuestas, tus documentos y lo que calcula.',
      ],
      list: [
        'No hace ninguna petición de red: no envía nada por internet, ni a nosotros ni a nadie.',
        'Sin telemetría, sin estadísticas, sin comprobación de actualizaciones.',
        'Sin cuenta y sin registro.',
        'El panel se abre desde tu propio ordenador y solo funciona ahí.',
      ],
    },
    {
      h: 'Nada nos llega',
      p: [
        'Taxpresso no tiene ningún servidor que reciba tus datos: nunca los recibimos. Para borrar todo lo que Taxpresso guardó, borra tu carpeta fiscal. Si quitas la extensión, la carpeta se queda donde está.',
      ],
    },
    {
      h: 'Claude, la IA que usas',
      p: [
        'Taxpresso funciona dentro de Claude, con tu propia cuenta. Lo que compartes en una conversación (tus mensajes y los documentos que Claude lee contigo) va a la empresa que está detrás de tu IA, Anthropic en el caso de Claude. Los trata según sus propias condiciones y su política de privacidad, y según los ajustes que elijas.',
        'Tú decides: en los ajustes de Claude, en Privacidad, eliges si tus chats pueden servir para mejorar Claude, y borras tus conversaciones cuando quieras.',
        'Taxpresso nunca lee tu historial de chats, la memoria de Claude ni los archivos que subes a Claude: solo lee los documentos de tu carpeta fiscal.',
        `Lee la [política de privacidad de Anthropic](${ANTHROPIC_PRIVACY}).`,
      ],
    },
    {
      h: 'Cuando presentas la declaración',
      p: [
        'Para presentarla, Claude rellena la declaración online oficial en un navegador, en el sitio de la administración fiscal de Ginebra (e-démarches). Lo que Claude ve ahí forma parte de tu conversación. Inicias sesión tú y pulsas tú Transmettre: Claude nunca escribe tus contraseñas. Lo que transmites va a la Administración fiscal cantonal (AFC), como cualquier declaración.',
      ],
    },
    {
      h: 'Este sitio',
      p: [],
      list: [
        'Sin cookies, sin estadísticas, sin rastreadores y sin formularios.',
        'Las fuentes y los estilos vienen de este sitio: nada se carga desde otro.',
        'Vercel, que aloja este sitio, puede guardar los registros de servidor habituales, como direcciones IP y las páginas pedidas, como cualquier alojamiento web.',
        'Los enlaces a GitHub (código fuente, descargas, incidencias) y a las páginas oficiales llevan a otros sitios, con sus propias normas de privacidad.',
      ],
    },
    {
      h: 'Escríbenos',
      p: [
        `¿Una pregunta sobre tus datos o sobre esta página? Escribe a ${MAIL}. Recibimos tu dirección de correo y tu mensaje, para responderte. Nunca envíes documentos fiscales reales ni números personales, ni por correo ni en una incidencia de GitHub.`,
      ],
    },
    {
      h: 'Compruébalo tú',
      p: [
        `Taxpresso es de código abierto: cualquiera puede leer su [código fuente](${SOURCE_URL}) y comprobar lo que hace. Si esta página cambia, también cambia su fecha.`,
      ],
    },
  ],
};

const pt: PrivacyCopy = {
  htmlTitle: 'Política de privacidade · Taxpresso',
  metaDescription:
    'Como o Taxpresso trata os teus dados: a extensão funciona no teu computador e não envia nada pela internet. O que o Claude vê e o que este site guarda.',
  link: 'Privacidade',
  title: 'Política de privacidade',
  lead: 'O Taxpresso foi feito para que os teus dados fiscais fiquem contigo. Aqui está, em palavras simples, o que acontece aos teus dados na extensão, no Claude e neste site.',
  updated: 'Última atualização: {date}',
  sections: [
    {
      h: 'A extensão: tudo fica no teu computador',
      p: [
        'O Taxpresso é uma extensão para o Claude Desktop. Funciona no teu computador, e tudo o que guarda fica na tua própria pasta fiscal (Documentos/Taxpresso, a não ser que tenhas escolhido outra): as tuas respostas, os teus documentos e o que calcula.',
      ],
      list: [
        'Não faz nenhum pedido de rede: não envia nada pela internet, nem para nós nem para ninguém.',
        'Sem telemetria, sem estatísticas, sem verificação de atualizações.',
        'Sem conta e sem registo.',
        'O painel abre-se a partir do teu computador e só funciona aí.',
      ],
    },
    {
      h: 'Nada nos chega',
      p: [
        'O Taxpresso não tem nenhum servidor que receba os teus dados: nunca os recebemos. Para apagar tudo o que o Taxpresso guardou, apaga a tua pasta fiscal. Se removeres a extensão, a pasta fica onde está.',
      ],
    },
    {
      h: 'O Claude, a IA que usas',
      p: [
        'O Taxpresso funciona dentro do Claude, com a tua própria conta. O que partilhas numa conversa (as tuas mensagens e os documentos que o Claude lê contigo) vai para a empresa por trás da tua IA, a Anthropic no caso do Claude. Ela trata-os segundo os seus próprios termos e a sua política de privacidade, e segundo as configurações que escolheres.',
        'Tu decides: nas configurações do Claude, em Privacidade, escolhes se as tuas conversas podem ajudar a melhorar o Claude, e apagas as tuas conversas quando quiseres.',
        'O Taxpresso nunca lê o teu histórico de conversas, a memória do Claude nem os ficheiros que carregas no Claude: só lê os documentos da tua pasta fiscal.',
        `Lê a [política de privacidade da Anthropic](${ANTHROPIC_PRIVACY}).`,
      ],
    },
    {
      h: 'Quando envias a declaração',
      p: [
        'Para a enviar, o Claude preenche a declaração online oficial num navegador, no site da administração fiscal de Genebra (e-démarches). O que o Claude vê lá faz parte da tua conversa. És tu quem inicia sessão e quem clica em Transmettre: o Claude nunca escreve as tuas palavras-passe. O que transmites vai para a Administração Fiscal Cantonal (AFC), como qualquer declaração.',
      ],
    },
    {
      h: 'Este site',
      p: [],
      list: [
        'Sem cookies, sem estatísticas, sem rastreadores e sem formulários.',
        'Os tipos de letra e os estilos vêm deste site: nada é carregado de outro.',
        'A Vercel, que aloja este site, pode guardar os registos de servidor habituais, como endereços IP e as páginas pedidas, como qualquer alojamento web.',
        'As ligações para o GitHub (código-fonte e transferências) e para as páginas oficiais levam a outros sites, com as suas próprias regras de privacidade.',
      ],
    },
    {
      h: 'Escreve-nos',
      p: [
        `Uma pergunta sobre os teus dados ou sobre esta página? Escreve para ${MAIL}. Recebemos o teu endereço de e-mail e a tua mensagem, para te responder. Nunca envies documentos fiscais reais nem números pessoais, nem por e-mail nem no GitHub.`,
      ],
    },
    {
      h: 'Verifica por ti',
      p: [
        `O Taxpresso é de código aberto: qualquer pessoa pode ler o seu [código-fonte](${SOURCE_URL}) e verificar o que faz. Se esta página mudar, a data também muda.`,
      ],
    },
  ],
};

export const privacy: Record<Lang, PrivacyCopy> = { fr, en, de, it, es, pt };

/** The privacy policy of a language. */
export const privacyPath = (path: string) => `${path}privacy/`;
