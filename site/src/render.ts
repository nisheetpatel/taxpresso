// Renders one language of the website to complete static HTML documents: the home page, the
// Get started page and the guides. No JavaScript; the logo animation is CSS
// (ui/src/shared/logo.css) and the language menu is a <details> element.
import { CUP_SVG, ICON_SVG, wordmark } from '../../ui/src/shared/logo.ts';
import {
  type Art,
  CONTACT_EMAIL,
  copy,
  DONATE_URL,
  DOWNLOAD_URL,
  ISSUE_URL,
  type Lang,
  LANGS,
  SOURCE_URL,
  startPath,
  type Tone,
} from './content.ts';
import {
  frenchSpacing,
  GUIDE_IDS,
  GUIDE_SOURCES,
  type GuideId,
  guidePath,
  guides,
  guidesPath,
  type Section,
} from './guides.ts';
import { privacy, PRIVACY_UPDATED, privacyPath } from './privacy.ts';
import { absoluteUrl, alternates, jsonLd, ORGANIZATION, plain } from './seo.ts';

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * Escapes, then turns [text](https://...) into an outbound link, [text](/path/) into a link on the
 * site and [text](mailto:...) into an email link.
 */
const rich = (s: string) =>
  esc(s).replace(
    /\[([^\]]+)\]\((https:\/\/[^)\s]+|\/[^)\s]*|mailto:[^)\s]+)\)/g,
    (_, text: string, href: string) =>
      href.startsWith('https:')
        ? `<a href="${href}" rel="noopener">${text}</a>`
        : `<a href="${href}">${text}</a>`,
  );

/** Opens in a new tab, so the page stays where it was. */
const out = (href: string) => `href="${href}" target="_blank" rel="noopener"`;

const icon = (d: string, size = 22) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
/**
 * The tagline with the last o of "espresso" (or "expresso") drawn as the logo's cup (hero.css). The
 * letter stays in the text for screen readers, search and copy; the cup is drawn over it.
 */
function cupO(tagline: string): string {
  const m = /^(.*\be[sx]press)(o)(\S*)$/i.exec(tagline);
  if (!m) return esc(tagline);
  const [, before = '', o = '', after = ''] = m;
  const cut = before.lastIndexOf(' ') + 1;
  return (
    esc(before.slice(0, cut)) +
    `<span class="cupo-word">${esc(before.slice(cut))}<span class="cupo tp-play">${o}${CUP_SVG}</span>${esc(after)}</span>`
  );
}

const CHECK = icon('<path d="M5 12.5l4.5 4.5L19 7.5"/>', 16);
const GLOBE = icon(
  '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.6 3.7 5.6 3.7 9s-1.2 6.4-3.7 9c-2.5-2.6-3.7-5.6-3.7-9S9.5 5.6 12 3z"/>',
  18,
);
const CHEVRON = icon('<path d="M6 9l6 6 6-6"/>', 14);
const STAR = icon(
  '<path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/>',
);
const HELP_ICON: Record<keyof typeof ISSUE_URL, string> = {
  bug: icon(
    '<rect x="8" y="7" width="8" height="12" rx="4"/><path d="M12 7V5M9 5l1.2 2M15 5l-1.2 2M8 11H4M8 15H4.5M16 11h4M16 15h3.5M12 11v8"/>',
  ),
  idea: icon(
    '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 1 3.5 10.9c-.6.5-1 1.2-1 2V16h-5v-.1c0-.8-.4-1.5-1-2A6 6 0 0 1 12 3z"/>',
  ),
  language: icon(
    '<path d="M4 6h9M8.5 4v2M6 6c.6 3 2.6 5.6 5 7M11 6c-.8 3.6-3.4 6.6-7 8M13 20l4-9 4 9M14.4 17h5.2"/>',
  ),
  code: icon('<path d="M8 8l-4 4 4 4M16 8l4 4-4 4M13.5 5l-3 14"/>'),
  canton: icon(
    '<path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.4"/>',
  ),
  contact: icon('<rect x="3.5" y="5.5" width="17" height="13" rx="2"/><path d="M4 7l8 6 8-6"/>'),
};
/** The Swiss cross: a white cross with arms one sixth longer than wide, on red. */
const SWISS = `<svg class="ch" viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="4" fill="#DA291C"/><path d="M13 6h6v7h7v6h-7v7h-6v-7H6v-6h7z" fill="#FFFFFF"/></svg>`;

/** Milk shapes on the crema, on a 96-unit grid centred on 0. */
const ART: Record<Art, string> = {
  heart:
    '<path class="la" d="M0 12C-3 9-15 2-15-5C-15-11-9-14-5-12C-2-11 0-8 0-6C0-8 2-11 5-12C9-14 15-11 15-5C15 2 3 9 0 12Z"/>',
  tulip:
    '<path class="la" d="M-13 6C-13-1 13-1 13 6C13 12 6 14 0 14C-6 14-13 12-13 6Z"/><path class="la" d="M-10-4C-10-9 10-9 10-4C10-1 5 1 0 1C-5 1-10-1-10-4Z"/><circle class="la" cy="-12" r="4"/><path class="la-cut" d="M0-17V15"/>',
  dot: '<circle class="la" cy="1" r="10"/><circle class="la-ring" cy="1" r="15"/>',
  rosetta:
    '<path class="la-line" d="M-13 10Q0 17 13 10M-12 5Q0 12 12 5M-10 0Q0 7 10 0M-8-5Q0 2 8-5M-5-10Q0-4 5-10"/><circle class="la" cy="-14" r="2.5"/><path class="la-cut" d="M0-16V15"/>',
  check: '<path class="la-line la-thick" d="M-12 0C-12 4 -8 6.5 -4 9.5L13 -9"/>',
  swirl:
    '<path class="la-line" d="M0 0A3 3 0 0 0 6 0A6 6 0 0 0 -6 0A9 9 0 0 0 12 0A12 12 0 0 0 -12 0A15 15 0 0 0 18 0"/>',
};

const latte = (art: Art) =>
  `<svg class="pc-cup" viewBox="0 0 96 96" aria-hidden="true"><g transform="translate(48 48)"><circle class="tp-rim" r="40"/><circle class="tp-coffee" r="24"/><circle class="tp-crema" r="21"/>${ART[art]}</g></svg>`;

/** One look per principle card, in the order of the copy; the Swiss card comes last. */
const CARD_LOOK = [
  'pc-espresso pc-wide',
  'pc-crema',
  'pc-white',
  'pc-latte',
  'pc-roast',
  'pc-matcha pc-wide',
];

const TONE_CLASS: Record<Tone, string> = { ok: 'st st-ok', confirm: 'st st-confirm', plain: 'st' };

const OG_LOCALE: Record<Lang, string> = {
  fr: 'fr_CH',
  en: 'en',
  de: 'de_CH',
  it: 'it_CH',
  es: 'es_ES',
  pt: 'pt_PT',
};

/** What the <head> says about a page, for browsers, search engines and link previews. */
interface Meta {
  title: string;
  description: string;
  /** The page's path from a language's prefix ('/en/' -> '/en/start/'). */
  at: (prefix: string) => string;
  /** Open Graph type: 'article' for the guides, 'website' for the rest. */
  type?: 'website' | 'article';
  /** Structured data (JSON-LD), one block per object. */
  data?: Record<string, unknown>[];
}

/** Numbers and dates are written the Swiss way, in the page's language. */
const LOCALE: Record<Lang, string> = {
  fr: 'fr-CH',
  en: 'en-CH',
  de: 'de-CH',
  it: 'it-CH',
  es: 'es-CH',
  pt: 'pt-CH',
};

/** A day (YYYY-MM-DD) written out: "14 October 2026", "14 octobre 2026". */
function longDate(lang: Lang, iso: string): string {
  const s = new Intl.DateTimeFormat(LOCALE[lang], {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${iso}T00:00:00Z`));
  return lang === 'fr' ? frenchSpacing(s) : s;
}

function head(lang: Lang, meta: Meta, cssVersion: string) {
  const here = LANGS.find((l) => l.lang === lang)!;
  const url = absoluteUrl(meta.at(here.path));
  const others = LANGS.filter((l) => l.lang !== lang);
  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'self'; font-src 'self'; img-src 'self'; base-uri 'none'; form-action 'none'">
<meta name="referrer" content="strict-origin-when-cross-origin">
<title>${esc(meta.title)}</title>
<meta name="description" content="${esc(meta.description)}">
<link rel="canonical" href="${url}">
${alternates(meta.at)
  .map((a) => `<link rel="alternate" hreflang="${a.hreflang}" href="${a.href}">`)
  .join('\n')}
<meta property="og:type" content="${meta.type ?? 'website'}">
<meta property="og:site_name" content="Taxpresso">
<meta property="og:title" content="${esc(meta.title)}">
<meta property="og:description" content="${esc(meta.description)}">
<meta property="og:url" content="${url}">
<meta property="og:locale" content="${OG_LOCALE[lang]}">
${others.map((l) => `<meta property="og:locale:alternate" content="${OG_LOCALE[l.lang]}">`).join('\n')}
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="preload" href="/fonts/geist-latin-wght-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/styles.css${cssVersion ? `?v=${cssVersion}` : ''}">
${(meta.data ?? []).map(jsonLd).join('\n')}
</head>`.replace(/\n\n/g, '\n');
}

/**
 * The top bar. `alt` gives this page's address in another language (its path prefix in), for the
 * language menu; on any page but the home page, the section links go back to the home page.
 */
function header(lang: Lang, alt: (path: string) => string = (p) => p) {
  const t = copy[lang];
  const here = LANGS.find((l) => l.lang === lang)!;
  const choices = LANGS.map((l) => {
    return `<li><a href="${alt(l.path)}" hreflang="${l.lang}" lang="${l.lang}"${l.lang === lang ? ' aria-current="page"' : ''}><span>${l.name}</span><span class="code">${l.label}</span></a></li>`;
  }).join('\n');
  const home = alt(here.path) === here.path ? '' : here.path;
  const onStart = alt(here.path) === startPath(here.path);
  return `<a class="skip" href="#main">${esc(t.skip)}</a>
<header class="top">
<a class="brand" href="${here.path}">${wordmark(true)}</a>
<nav class="sections" aria-label="${esc(t.navLabel)}"><a href="${home}#how">${esc(t.nav.how)}</a><a href="${home}#principles">${esc(t.nav.principles)}</a><a href="${home}#faq">${esc(t.nav.faq)}</a></nav>
<a class="top-start" href="${startPath(here.path)}"${onStart ? ' aria-current="page"' : ''}>${esc(t.nav.start)}</a>
<details class="langs">
<summary aria-label="${esc(t.langLabel)}: ${here.name}">${GLOBE}<span>${here.label}</span>${CHEVRON}</summary>
<ul>
${choices}
<li class="suggest"><a ${out(ISSUE_URL.language)}>${esc(t.suggestLanguage)}</a></li>
</ul>
</details>
</header>`;
}

function footer(lang: Lang) {
  const t = copy[lang];
  const here = LANGS.find((l) => l.lang === lang)!;
  return `<footer class="foot">
<div class="foot-links"><span class="badge">${SWISS}Swiss made</span><a href="${startPath(here.path)}">${esc(t.nav.start)}</a><a href="${guidesPath(here.path)}">${esc(t.nav.guides)}</a><a ${out(SOURCE_URL)}>${esc(t.footer.source)}</a><a href="${privacyPath(here.path)}">${esc(privacy[lang].link)}</a><a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a></div>
<p>${esc(t.footer.independent)}</p>
<p>${esc(t.footer.noTracking)}</p>
<p>© 2026 Taxpresso</p>
</footer>
</body>
</html>
`;
}

/** The home page. `cssVersion` is a hash of styles.css, so browsers fetch it again when it changes. */
export function render(lang: Lang, cssVersion = ''): string {
  const t = copy[lang];
  const here = LANGS.find((l) => l.lang === lang)!;

  const ticketLines = t.ticket.lines
    .map(
      ([label, value, tone]) =>
        `<li><span>${esc(label)}</span><span class="dots" aria-hidden="true"></span><span class="${TONE_CLASS[tone]}">${esc(value)}</span></li>`,
    )
    .join('\n');

  const steps = t.how.steps
    .map(
      ([title, text], i) =>
        `<li><span class="num" aria-hidden="true">${i + 1}</span><h3>${esc(title)}</h3><p>${rich(text)}</p></li>`,
    )
    .join('\n');

  const cards = t.principles.items
    .map(
      ([title, text, art], i) =>
        `<li class="pc ${CARD_LOOK[i] ?? 'pc-white'}">${latte(art)}<div><h3>${esc(title)}</h3><p>${rich(text)}</p></div></li>`,
    )
    .join('\n');
  const [swissTitle, swissText] = t.principles.swiss;

  const menu = t.support.tip.menu
    .map(
      ([drink, amount]) =>
        `<li><span>${esc(drink)}</span><span class="dots" aria-hidden="true"></span><span class="amount">${esc(amount)}</span></li>`,
    )
    .join('\n');

  const help = t.contribute.items
    .map(
      ([title, text, kind]) =>
        `<li><a class="help-card" ${kind === 'contact' ? `href="${ISSUE_URL[kind]}"` : out(ISSUE_URL[kind])}>${HELP_ICON[kind]}<h3>${esc(title)}</h3><p>${esc(text)}</p></a></li>`,
    )
    .join('\n');

  const faq = t.faq.items
    .map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${rich(a)}</p></details>`)
    .join('\n');

  const app = {
    '@type': 'SoftwareApplication',
    name: 'Taxpresso',
    description: t.metaDescription,
    url: absoluteUrl(here.path),
    inLanguage: lang,
    applicationCategory: 'FinanceApplication',
    operatingSystem: 'Linux, macOS, Windows',
    softwareRequirements: 'Claude Desktop',
    downloadUrl: DOWNLOAD_URL,
    license: 'https://www.gnu.org/licenses/agpl-3.0.html',
    isAccessibleForFree: true,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'CHF' },
    author: ORGANIZATION,
  };
  const faqData = {
    '@type': 'FAQPage',
    inLanguage: lang,
    mainEntity: t.faq.items.map(([q, a]) => ({
      '@type': 'Question',
      name: q,
      acceptedAnswer: { '@type': 'Answer', text: plain(a) },
    })),
  };

  return `${head(
    lang,
    { title: t.htmlTitle, description: t.metaDescription, at: (p) => p, data: [app, faqData] },
    cssVersion,
  )}
<body>
${header(lang)}

<main id="main">
<section class="hero">
<div class="hero-text">
<h1>${cupO(t.tagline)}</h1>
<p class="lead">${esc(t.lead)}</p>
<div class="cta">
<a class="btn btn-primary" href="${startPath(here.path)}">${esc(t.getStarted)}</a>
<a class="more" href="#how">${esc(t.seeHow)}</a>
</div>
<p class="avail">${esc(t.available)}</p>
<ul class="badges">
<li class="badge">${SWISS}${esc(t.badges.swiss)}</li>
<li class="badge">${CUP_SVG}${esc(t.badges.open)}</li>
</ul>
</div>
<figure class="printer">
<div class="slot" aria-hidden="true"></div>
<div class="clip">
<div class="ticket">
<p class="t-head">Taxpresso</p>
<p class="t-sub">${esc(t.ticket.sub)}</p>
<ul class="t-lines">
${ticketLines}
</ul>
<p class="t-total"><span>${esc(t.ticket.totalLabel)}</span><span class="dots" aria-hidden="true"></span><span class="t-cup">${esc(t.ticket.totalValue)}${CUP_SVG}</span></p>
<p class="t-foot">${esc(t.ticket.footer)}</p>
</div>
</div>
<figcaption class="sr-only">${esc(t.ticket.caption)}</figcaption>
</figure>
</section>

<section id="how" class="band how" aria-labelledby="how-title">
<h2 id="how-title">${esc(t.how.title)}</h2>
<ol class="steps">
${steps}
</ol>
</section>

<section id="principles" class="band principles" aria-labelledby="principles-title">
<h2 id="principles-title">${esc(t.principles.title)}</h2>
<p class="band-lead">${esc(t.principles.lead)}</p>
<ul class="pgrid">
${cards}
<li class="pc pc-white pc-swiss">${SWISS}<div><h3>${esc(swissTitle)}</h3><p>${esc(swissText)}</p></div></li>
</ul>
</section>

<section id="free" class="band free" aria-labelledby="free-title">
<div class="free-intro">
<h2 id="free-title">${esc(t.support.title)}</h2>
<p>${esc(t.support.text)}</p>
</div>
<div class="free-grid">
<div class="star-card">
<span class="star-mark">${STAR}</span>
<h3>${esc(t.support.star.title)}</h3>
<p>${esc(t.support.star.text)}</p>
<a class="btn btn-primary" ${out(SOURCE_URL)}>${STAR}${esc(t.support.star.button)}</a>
</div>
<div class="tip-card">
<h3>${esc(t.support.tip.title)}</h3>
<ul class="menu">
${menu}
</ul>
<p class="tip-note">${esc(t.support.tip.note)}</p>
<a class="btn btn-crema" ${out(DONATE_URL)}>${esc(t.support.tip.button)}</a>
</div>
</div>
<p class="ppb">${rich(t.support.ppb)}</p>
</section>

<section id="help" class="band help" aria-labelledby="help-title">
<h2 id="help-title">${esc(t.contribute.title)}</h2>
<p class="band-lead">${esc(t.contribute.lead)}</p>
<ul class="help-grid">
${help}
</ul>
</section>

<section id="faq" class="band faq" aria-labelledby="faq-title">
<h2 id="faq-title">${esc(t.faq.title)}</h2>
<div class="qa">
${faq}
</div>
<p class="qa-more">${rich(t.faq.more)}</p>
</section>

<section class="band fine" aria-labelledby="fine-title">
<div class="fine-box">
<h2 id="fine-title">${esc(t.finePrint.title)}</h2>
<p>${esc(t.finePrint.text)}</p>
</div>
</section>
</main>

${footer(lang)}`;
}

/** The Get started page: download, install, first steps. */
export function renderStart(lang: Lang, cssVersion = ''): string {
  const t = copy[lang];
  const s = t.start;
  const here = LANGS.find((l) => l.lang === lang)!;

  const platforms = s.platforms.map((p) => `<li>${esc(p)}</li>`).join('');
  const needs = s.needs
    .map(
      ([title, text]) =>
        `<li class="need"><span class="need-mark" aria-hidden="true">${CHECK}</span><h3>${esc(title)}</h3><p>${rich(text)}</p></li>`,
    )
    .join('\n');

  const extra = (i: number) => {
    if (i === 0)
      return `<p class="dl"><a class="btn btn-primary" href="${DOWNLOAD_URL}" rel="noopener">${esc(s.download)}</a></p>`;
    if (i === 1)
      return `<div class="mock" aria-hidden="true"><div class="mock-bar"><i></i><i></i><i></i></div><div class="mock-body"><span class="mock-icon">${ICON_SVG}</span><span class="mock-name"><strong>Taxpresso</strong><span>${esc(s.mockExtension)}</span></span><span class="mock-btn">${esc(s.mockInstall)}</span></div></div>`;
    if (i === 3)
      return `<figure class="prompt"><figcaption>${esc(s.promptLabel)}</figcaption><p>${esc(s.prompt)}</p></figure>`;
    return '';
  };
  const steps = s.steps
    .map(
      ([title, text], i) =>
        `<li><span class="num" aria-hidden="true">${i + 1}</span><div class="step-body"><h3>${esc(title)}</h3><p>${rich(text)}</p>${extra(i)}</div></li>`,
    )
    .join('\n');
  const notes = s.notes
    .map(([title, text]) => `<li class="note"><h3>${esc(title)}</h3><p>${rich(text)}</p></li>`)
    .join('\n');

  const howTo = {
    '@type': 'HowTo',
    name: s.htmlTitle,
    description: s.metaDescription,
    inLanguage: lang,
    tool: [{ '@type': 'HowToTool', name: 'Claude Desktop' }],
    step: s.steps.map(([name, text], i) => ({
      '@type': 'HowToStep',
      position: i + 1,
      name,
      text: plain(text),
    })),
  };

  return `${head(
    lang,
    { title: s.htmlTitle, description: s.metaDescription, at: startPath, data: [howTo] },
    cssVersion,
  )}
<body>
${header(lang, startPath)}

<main id="main" class="start">
<section class="start-hero">
<div class="start-hero-text">
<h1>${esc(s.title)}</h1>
<p class="lead">${esc(s.lead)}</p>
<div class="dl-row">
<a class="btn btn-crema btn-big" href="${DOWNLOAD_URL}" rel="noopener">${esc(s.download)}</a>
<span class="dl-note">${esc(s.downloadNote)}</span>
</div>
<ul class="platforms" aria-label="Claude Desktop">${platforms}</ul>
</div>
<div class="start-hero-art tp-play" aria-hidden="true">${CUP_SVG}</div>
</section>

<section class="start-sec" aria-labelledby="needs-title">
<h2 id="needs-title">${esc(s.needsTitle)}</h2>
<ul class="needs">
${needs}
</ul>
<p class="start-guides">${rich(s.guides)}</p>
</section>

<section class="start-sec" aria-labelledby="steps-title">
<h2 id="steps-title">${esc(s.stepsTitle)}</h2>
<ol class="timeline">
${steps}
</ol>
</section>

<section class="start-sec">
<ul class="notes">
${notes}
</ul>
</section>

<p class="back"><a href="${here.path}">${esc(s.back)}</a></p>
</main>

${footer(lang)}`;
}

/** The guides index: one card per guide. */
export function renderGuides(lang: Lang, cssVersion = ''): string {
  const g = guides[lang];
  const here = LANGS.find((l) => l.lang === lang)!;
  const cards = GUIDE_IDS.map(
    (id) =>
      `<li><a class="guide-card" href="${guidePath(here.path, id)}"><h2>${esc(g.guides[id].title)}</h2><p>${esc(g.guides[id].summary)}</p><span class="guide-go" aria-hidden="true">${esc(g.read)}</span></a></li>`,
  ).join('\n');

  return `${head(lang, { title: g.htmlTitle, description: g.metaDescription, at: guidesPath }, cssVersion)}
<body>
${header(lang, guidesPath)}

<main id="main" class="guides">
<section class="guides-hero">
<h1>${esc(g.title)}</h1>
<p class="lead">${esc(g.lead)}</p>
</section>
<ul class="guide-list">
${cards}
</ul>
<p class="guide-basis">${esc(g.basis)} ${esc(g.disclaimer)}</p>
<p class="back"><a href="${here.path}">${esc(copy[lang].start.back)}</a></p>
</main>

${footer(lang)}`;
}

/** Short sections of a reading page: a heading, paragraphs, then an optional list. */
const sectionsHtml = (sections: Section[]) =>
  sections
    .map(
      (s) =>
        `<section>\n<h2>${esc(s.h)}</h2>\n${s.p.map((p) => `<p>${rich(p)}</p>\n`).join('')}${
          s.list ? `<ul>\n${s.list.map((li) => `<li>${rich(li)}</li>`).join('\n')}\n</ul>\n` : ''
        }</section>`,
    )
    .join('\n');

/** One guide: short sections, then the official sources, then the other guides. */
export function renderGuide(lang: Lang, id: GuideId, cssVersion = ''): string {
  const g = guides[lang];
  const guide = g.guides[id];
  const here = LANGS.find((l) => l.lang === lang)!;

  const sections = sectionsHtml(guide.sections);
  const sources = GUIDE_SOURCES[id]
    .map((url, i) => `<li><a ${out(url)}>${esc(guide.sources[i] ?? url)}</a></li>`)
    .join('\n');
  const more = GUIDE_IDS.filter((other) => other !== id)
    .map(
      (other) =>
        `<li><a href="${guidePath(here.path, other)}">${esc(g.guides[other].title)}</a></li>`,
    )
    .join('\n');

  const at = (p: string) => guidePath(p, id);
  const article = {
    '@type': 'Article',
    headline: guide.title,
    description: guide.summary,
    inLanguage: lang,
    url: absoluteUrl(at(here.path)),
    mainEntityOfPage: absoluteUrl(at(here.path)),
    isAccessibleForFree: true,
    author: ORGANIZATION,
    publisher: ORGANIZATION,
    citation: GUIDE_SOURCES[id],
  };

  return `${head(
    lang,
    {
      title: `${guide.title} · Taxpresso`,
      description: guide.summary,
      at,
      type: 'article',
      data: [article],
    },
    cssVersion,
  )}
<body>
${header(lang, (p) => guidePath(p, id))}

<main id="main" class="guides">
<article class="guide">
<p class="crumb"><a href="${guidesPath(here.path)}">${esc(g.title)}</a></p>
<h1>${esc(guide.title)}</h1>
<p class="lead">${esc(guide.summary)}</p>
${sections}
<aside class="guide-sources" aria-labelledby="sources-title">
<h2 id="sources-title">${esc(g.sourcesTitle)}</h2>
<ul>
${sources}
</ul>
<p>${esc(g.sourcesNote)}</p>
</aside>
<p class="guide-basis">${esc(g.basis)} ${esc(g.disclaimer)}</p>
</article>
<nav class="guide-more" aria-labelledby="more-title">
<h2 id="more-title">${esc(g.moreTitle)}</h2>
<ul>
${more}
</ul>
</nav>
<p class="back"><a href="${guidesPath(here.path)}">${esc(g.all)}</a></p>
</main>

${footer(lang)}`;
}

/** The privacy policy: what stays on your computer, what Claude sees, what this site keeps. */
export function renderPrivacy(lang: Lang, cssVersion = ''): string {
  const t = privacy[lang];
  const here = LANGS.find((l) => l.lang === lang)!;

  return `${head(lang, { title: t.htmlTitle, description: t.metaDescription, at: privacyPath }, cssVersion)}
<body>
${header(lang, privacyPath)}

<main id="main" class="guides">
<article class="guide policy">
<h1>${esc(t.title)}</h1>
<p class="updated">${esc(t.updated.replace('{date}', longDate(lang, PRIVACY_UPDATED)))}</p>
<p class="lead">${esc(t.lead)}</p>
${sectionsHtml(t.sections)}
</article>
<p class="back"><a href="${here.path}">${esc(copy[lang].start.back)}</a></p>
</main>

${footer(lang)}`;
}
