// Renders one language of the website to complete static HTML documents: the home page and the
// Get started page. No JavaScript; the logo animation is CSS (ui/src/shared/logo.css) and the
// language menu is a <details> element.
import { CUP_SVG, ICON_SVG, wordmark } from '../../ui/src/shared/logo.ts';
import {
  type Art,
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

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Escapes, then turns [text](https://...) into an outbound link. */
const rich = (s: string) =>
  esc(s).replace(
    /\[([^\]]+)\]\((https:\/\/[^)\s]+)\)/g,
    (_, text: string, href: string) => `<a href="${href}" rel="noopener">${text}</a>`,
  );

/** Opens in a new tab, so the page stays where it was. */
const out = (href: string) => `href="${href}" target="_blank" rel="noopener"`;

const icon = (d: string, size = 22) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
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
<meta property="og:locale" content="${OG_LOCALE[lang]}">
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
  const choices = LANGS.map((l) => {
    const href = onStart ? startPath(l.path) : l.path;
    return `<li><a href="${href}" hreflang="${l.lang}" lang="${l.lang}"${l.lang === lang ? ' aria-current="page"' : ''}><span>${l.name}</span><span class="code">${l.label}</span></a></li>`;
  }).join('\n');
  const home = onStart ? here.path : '';
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
<div class="foot-links"><span class="badge">${SWISS}Swiss made</span><a href="${startPath(here.path)}">${esc(t.nav.start)}</a><a ${out(SOURCE_URL)}>${esc(t.footer.source)}</a></div>
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
        `<li><a class="help-card" ${out(ISSUE_URL[kind])}>${HELP_ICON[kind]}<h3>${esc(title)}</h3><p>${esc(text)}</p></a></li>`,
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
