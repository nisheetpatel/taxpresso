// Renders one language of the website to complete static HTML documents: the home page and the
// Get started page. No JavaScript; the logo animation is CSS (ui/src/shared/logo.css).
import { CUP_SVG, wordmark } from '../../ui/src/shared/logo.ts';
import {
  type Art,
  copy,
  DONATE_URL,
  DOWNLOAD_URL,
  type Lang,
  LANGS,
  SOURCE_URL,
  startPath,
  type Tone,
} from './content.ts';

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Escapes, then turns [text](https://...) into an outbound link. */
const rich = (s: string) =>
  esc(s).replace(
    /\[([^\]]+)\]\((https:\/\/[^)\s]+)\)/g,
    (_, text: string, href: string) => `<a href="${href}" rel="noopener">${text}</a>`,
  );

const CHECK = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>`;
/** The Swiss cross: a white cross with arms one sixth longer than wide, on red. */
const SWISS = `<svg class="ch" viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="4" fill="#DA291C"/><path d="M13 6h6v7h7v6h-7v7h-6v-7H6v-6h7z" fill="#FFFFFF"/></svg>`;

/** Milk shapes on the crema, on a 96-unit grid centred on 0. */
const ART: Record<Art | 'swiss', string> = {
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
  swiss: '<path class="la" d="M-3-10h6v7h7v6h-7v7h-6v-7h-7v-6h7z"/>',
};

const latte = (art: Art | 'swiss') =>
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

function head(lang: Lang, title: string, description: string, cssVersion: string, alt: string[]) {
  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'self'; font-src 'self'; img-src 'self'; base-uri 'none'; form-action 'none'">
<meta name="referrer" content="strict-origin-when-cross-origin">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:locale" content="${lang === 'fr' ? 'fr_CH' : lang === 'de' ? 'de_CH' : 'en'}">
${LANGS.map((l, i) => `<link rel="alternate" hreflang="${l.lang}" href="${alt[i]}">`).join('\n')}
<link rel="alternate" hreflang="x-default" href="${alt[0]}">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="preload" href="/fonts/geist-latin-wght-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/styles.css${cssVersion ? `?v=${cssVersion}` : ''}">
</head>`;
}

function header(lang: Lang, onStart: boolean) {
  const t = copy[lang];
  const here = LANGS.find((l) => l.lang === lang)!;
  const langLinks = LANGS.map((l) => {
    const href = onStart ? startPath(l.path) : l.path;
    return `<a href="${href}" hreflang="${l.lang}" lang="${l.lang}" title="${l.name}"${l.lang === lang ? ' aria-current="page"' : ''}>${l.label}</a>`;
  }).join('');
  const home = onStart ? here.path : '';
  return `<a class="skip" href="#main">${esc(t.skip)}</a>
<header class="top">
<a class="brand" href="${here.path}">${wordmark(true)}</a>
<nav class="sections" aria-label="${esc(t.navLabel)}"><a href="${home}#how">${esc(t.nav.how)}</a><a href="${home}#principles">${esc(t.nav.principles)}</a><a href="${home}#faq">${esc(t.nav.faq)}</a></nav>
<a class="top-start" href="${startPath(here.path)}"${onStart ? ' aria-current="page"' : ''}>${esc(t.nav.start)}</a>
<nav class="langs" aria-label="${esc(t.langLabel)}">${langLinks}</nav>
</header>`;
}

function footer(lang: Lang) {
  const t = copy[lang];
  const here = LANGS.find((l) => l.lang === lang)!;
  return `<footer class="foot">
<div class="foot-links"><span class="badge">${SWISS}Swiss made</span><a href="${startPath(here.path)}">${esc(t.nav.start)}</a><a href="${SOURCE_URL}" rel="noopener">${esc(t.footer.source)}</a></div>
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

  const menu = t.support.menu
    .map(
      ([drink, amount]) =>
        `<li><span>${esc(drink)}</span><span class="dots" aria-hidden="true"></span><span class="amount">${esc(amount)}</span></li>`,
    )
    .join('\n');

  const faq = t.faq.items
    .map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${rich(a)}</p></details>`)
    .join('\n');

  return `${head(
    lang,
    t.htmlTitle,
    t.metaDescription,
    cssVersion,
    LANGS.map((l) => l.path),
  )}
<body>
${header(lang, false)}

<main id="main">
<section class="hero">
<div class="hero-text">
<h1>${esc(t.tagline)}</h1>
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
<li class="pc pc-swiss">${latte('swiss')}<div><h3>${esc(swissTitle)}</h3><p>${esc(swissText)}</p></div></li>
</ul>
</section>

<section class="band support" aria-labelledby="support-title">
<div class="support-text">
<h2 id="support-title">${esc(t.support.title)}</h2>
<p class="support-line">${esc(t.support.headline)}</p>
<p>${esc(t.support.text)}</p>
<div class="support-actions">
<a class="btn btn-primary" href="${DONATE_URL}" rel="noopener">${esc(t.support.donate)}</a>
<a class="btn btn-quiet" href="${SOURCE_URL}" rel="noopener">${esc(t.support.source)}</a>
</div>
</div>
<ul class="menu">
${menu}
</ul>
</section>

<section id="faq" class="band faq" aria-labelledby="faq-title">
<h2 id="faq-title">${esc(t.faq.title)}</h2>
<div class="qa">
${faq}
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

  const needs = s.needs.map((n) => `<li>${CHECK}<span>${rich(n)}</span></li>`).join('\n');
  const steps = s.steps
    .map(
      ([title, text], i) =>
        `<li><span class="num" aria-hidden="true">${i + 1}</span><div><h3>${esc(title)}</h3><p>${rich(text)}</p>${
          i === 0
            ? `<p class="dl"><a class="btn btn-primary" href="${DOWNLOAD_URL}" rel="noopener">${esc(s.download)}</a><span>${esc(s.downloadNote)}</span></p>`
            : ''
        }</div></li>`,
    )
    .join('\n');

  return `${head(
    lang,
    s.htmlTitle,
    s.metaDescription,
    cssVersion,
    LANGS.map((l) => startPath(l.path)),
  )}
<body>
${header(lang, true)}

<main id="main" class="start">
<h1>${esc(s.title)}</h1>
<p class="lead">${esc(s.lead)}</p>

<section class="start-needs" aria-labelledby="needs-title">
<h2 id="needs-title">${esc(s.needsTitle)}</h2>
<ul class="checks">
${needs}
</ul>
</section>

<section aria-labelledby="steps-title">
<h2 id="steps-title">${esc(s.stepsTitle)}</h2>
<ol class="start-steps">
${steps}
</ol>
</section>

<div class="start-notes">
<section class="note note-dark" aria-labelledby="privacy-title">
<h2 id="privacy-title">${esc(s.privacyTitle)}</h2>
<p>${esc(s.privacyText)}</p>
</section>
<section class="note" aria-labelledby="update-title">
<h2 id="update-title">${esc(s.updateTitle)}</h2>
<p>${esc(s.updateText)}</p>
</section>
</div>

<p class="back"><a href="${here.path}">${esc(s.back)}</a></p>
</main>

${footer(lang)}`;
}
