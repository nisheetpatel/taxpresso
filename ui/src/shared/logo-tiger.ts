// Not wired in: an alternative logo motion (tiger crema), kept for later. The live logo is logo.ts
// (sugar cube). To try it, import from here instead and load logo-tiger.css instead of logo.css.
// The Taxpresso mark (SPEC.md section 11b), motion "tiger crema": the wordmark's last o is an
// espresso seen from above. The espresso pours, a tiger-striped crema blooms and swirls, then the
// crema draws itself together into the check: your return is done. The final frame is the static
// mark, so the favicon and the app icon don't change. The motion lives in logo-tiger.css and plays
// once when an ancestor carries the `tp-play` class; with reduced motion the finished mark shows.
//
// The crema needs a gradient, a blur and a mask, which SVG can only reference by id. Each playing
// cup therefore takes an id prefix, unique in its document ("top", "hero", ...). Keep the prefix
// stable across renders (Preact compares the HTML string). Static cups carry no ids at all.

/** The check, in crema. */
const CHECK = 'M-12 1l8 8 17-18';

/** Tiger stripes, on the 96-unit grid centred on 0: open log-spiral arms, drawn as strokes. */
const BANDS =
  'M3.5 2.7c-.2 .7-.1 3.2-1.3 4.5c-1.3 1.3-3.5 3.2-5.9 3.4c-2.4 .3-5.9-.2-8.6-2c-2.7-1.9-6.3-7.5-7.5-9M1.8 7.4c-1 .1-4.1 1.2-6 .5c-1.9-.6-4.1-2.2-5.4-4.2c-1.3-2.1-2.8-5-2.6-8.3c.2-3.2 3.2-9.2 3.8-11M-2 1.5c-.5-.1-2.2 0-3.2-.8c-1.1-.8-2.6-2.3-3-4.1c-.5-1.8-.6-4.3 .3-6.9c1-2.5 4.6-7 5.6-8.4M-3.6-3c.5-.5 1.2-2.2 2.7-3c1.5-.9 3.6-2.5 6.2-2.1c2.5 .3 6.8 1.2 9.1 4.1c2.3 2.8 3.8 10.9 4.6 13.1M.6-4.9c.6-.1 2.3-1 3.5-.9c1.3 .2 2.7 .8 4.1 1.9c1.4 1.1 3 2.4 4.3 4.8c1.3 2.4 2.9 7.9 3.5 9.5M1.7-1.6c.5 .1 2.2-.3 3.3 .4c1 .6 2.2 1.7 2.8 3.3c.6 1.6 1.2 3.6 .7 6.3c-.4 2.7-2.6 8.4-3.1 10.1M4.5 0c.3 .6 1.8 2.1 1.9 3.5c.2 1.4-.1 3.4-1 4.9c-.9 1.5-2.5 2.9-4.5 4c-2.1 1.1-6.4 2-7.7 2.4';
const LINES =
  'M4.9 6.8c-.6 .7-1.9 3.3-3.6 4.3c-1.7 1-4.1 1.6-6.6 1.6c-2.6 0-7.3-1.4-8.7-1.7M.7 9.5c-1 .1-3.9 1.3-6.4 1c-2.5-.3-5.7-.7-8.5-2.8c-2.8-2-7.1-7.9-8.5-9.5M-2.2 5.3c-.7 .1-2.7 .9-4.7 .5c-2-.4-5-.8-7.3-2.7c-2.3-1.9-5.5-7.3-6.6-8.8M-9.6 5.4c-.5-1.3-3-4.8-3.2-7.7c-.1-3 .3-7.2 2.4-10c2.1-2.8 8.5-5.5 10.2-6.5M-11.4 .5c.2-1.3-.1-5.3 1-7.8c1.2-2.4 3.1-5.3 5.8-7.1c2.8-1.7 9-2.6 10.8-3.1M-3.8-2.4c.3-.8 .2-3.2 1.6-4.6c1.3-1.3 3.7-3.6 6.5-3.8c2.8-.2 8.5 2.3 10.2 2.7M-3.4-7.5c.8-.7 2.7-3.4 4.8-4.1c2.1-.8 5-1.2 8.1-.5c3 .7 8.4 3.9 10.1 4.6M.9-5.8c.9-.1 3.4-1 5.3-.3c2 .6 4.4 1.7 6.4 4.3c1.9 2.6 4.4 9.5 5.3 11.3M4.3-6.5c.9 .1 3.7-.3 5.5 .5c1.8 .8 3.9 2.2 5.5 4.2c1.5 2 3.2 6.7 3.9 8.1M6.8-1.5c.3 1.1 1.9 3.8 1.4 6.4c-.4 2.6-1 6.7-4 9.2c-2.9 2.5-11.5 4.7-13.8 5.6M10.7 4.5c-.8 1.3-2.5 5.9-5.2 7.8c-2.7 1.8-6.9 4-10.9 3.6c-4-.4-10.9-5-13.1-6';
const GLINTS =
  'M-1 2.8c-.5 0-1.7 .3-2.9-.3c-1.2-.6-3.4-1.3-4.4-3.1c-1-1.9-1.3-6.9-1.6-8.2M-2.5 1.7c-.5-.5-2.4-1.3-2.7-2.8c-.4-1.5-.9-3.7 .5-6.1c1.5-2.4 6.7-6.9 8-8.2M-2.9-.3c-.1-.5-1-2.2-.6-3.5c.5-1.3 1.7-3.5 3.5-4.2c1.8-.7 6.2-.1 7.4-.2M.2-3c.6 .1 2.4-.4 3.5 .4c1.1 .9 3.1 2.2 3.3 4.8c.1 2.6-1.9 8.9-2.3 10.7M4.4-1c.1 .6 .9 2.2 .8 3.7c-.2 1.6-.3 3.9-1.9 5.7c-1.7 1.8-6.7 4.3-8 5.1M2.4 3c-.5 .7-1.2 3.1-2.8 3.8c-1.7 .7-4.3 1.5-7 .4c-2.7-1-7.7-5.4-9.3-6.5';
const FLECKS =
  'M4.2 3.1c-.3 .7-.3 2.6-1.4 4c-1 1.4-2.5 3.5-4.8 4.4c-2.3 1-5.8 1.9-9.1 1c-3.3-.8-8.8-4.9-10.6-5.9M3.1 9c-.9 .3-3.5 1.6-5.6 1.7c-2.2 .1-4.7-.1-7.2-1.2c-2.4-1.2-5.6-2.9-7.6-5.8c-1.9-2.9-3.4-9.7-4.1-11.6M-.6 6.4c-.9 .1-3.4 1.3-5.2 .8c-1.8-.5-4.2-1.7-5.6-3.6c-1.4-1.9-2.7-4.7-2.8-7.8c-.2-3 1.5-8.8 1.8-10.6M-6.7 5.9c-.6-.8-2.7-2.8-3.4-4.7c-.7-1.9-1.3-4.4-.8-6.9c.4-2.6 1.2-6.1 3.4-8.5c2.2-2.4 8.2-5.1 9.9-6.2M-5.5-.6c0-.7-.5-3 .2-4.5c.7-1.5 1.8-3.4 3.9-4.7c2-1.3 4.9-3.2 8.6-3c3.7 .2 11.4 3.4 13.6 4M-5.5-4.8c.7-.7 2.1-3.1 4-4c2-.9 4.8-2.1 7.5-1.5c2.6 .6 6.6 2.2 8.5 4.9c2 2.8 2.8 9.7 3.4 11.7M-.3-5.3c.8-.2 3.3-1.7 5.1-1.3c1.8 .5 4.5 1.9 5.8 4c1.3 2.1 2.6 5.4 2.1 8.8c-.4 3.4-3.9 9.6-4.7 11.5M3.1-3.8c.7 .3 3.3 .6 4.4 1.9c1.1 1.2 2.4 3.5 2.4 5.8c0 2.3-.5 5.4-2.4 7.9c-1.8 2.6-7.2 6.3-8.7 7.6M8.3-3.4c.5 .9 2.6 3.5 2.9 5.9c.3 2.4 .2 5.9-1.2 8.5c-1.5 2.5-4.5 5.5-7.8 6.8c-3.3 1.2-10 .5-12 .6M8.8 1.8c-.4 .9-.9 4-2.2 5.8c-1.4 1.7-3.3 3.8-5.9 4.7c-2.6 .9-6.4 1.8-9.7 .8c-3.3-1-8.3-5.8-9.9-7';

/** An invisible circle as big as the coffee: it centres each layer's box, so it turns in place. */
const HUB = '<circle r="24" fill="none"/>';

const svg = (inner: string, defs = '') =>
  '<svg class="tp-cup" viewBox="0 0 96 96" aria-hidden="true" focusable="false">' +
  defs +
  '<g transform="translate(48 48)">' +
  '<circle class="tp-rim" r="40"/>' +
  '<circle class="tp-coffee" r="24"/>' +
  `<path class="tp-check" d="${CHECK}"/>` +
  inner +
  '</g></svg>';

/** The cup on its own, static, for icons and small places. */
export const CUP_SVG = svg('');

/**
 * The cup with its crema, ready to play under `tp-play`. `id` prefixes the gradient, blur and mask
 * ids: give each playing cup on a page its own.
 */
export function playingCup(id: string): string {
  const g = `${id}-crema`;
  const b = `${id}-soft`;
  const m = `${id}-gather`;
  const defs =
    '<defs>' +
    `<radialGradient id="${g}">` +
    '<stop offset="0" stop-color="#e6bb80"/>' +
    '<stop offset=".42" stop-color="#cf975a"/>' +
    '<stop offset=".7" stop-color="#ad6d37"/>' +
    '<stop offset=".87" stop-color="#874a21"/>' +
    '<stop offset="1" stop-color="#4a2c1d" stop-opacity="0"/>' +
    '</radialGradient>' +
    `<filter id="${b}" filterUnits="userSpaceOnUse" x="-28" y="-28" width="56" height="56"><feGaussianBlur stdDeviation="1.2"/></filter>` +
    `<mask id="${m}" maskUnits="userSpaceOnUse" x="-28" y="-28" width="56" height="56">` +
    `<path class="tp-gather" d="${CHECK}" filter="url(#${b})"/>` +
    '</mask>' +
    '</defs>';
  const fx =
    `<g class="tp-fx" mask="url(#${m})">` +
    `<g class="tp-draw">${HUB}<g class="tp-foam">` +
    `<circle r="24" fill="url(#${g})"/>` +
    `<g class="tp-spin tp-spin-a" filter="url(#${b})">${HUB}<path class="tp-bands" d="${BANDS}"/><path class="tp-glints" d="${GLINTS}"/></g>` +
    `<g class="tp-spin tp-spin-b">${HUB}<path class="tp-lines" d="${LINES}"/></g>` +
    `<g class="tp-spin tp-spin-c">${HUB}<path class="tp-flecks" d="${FLECKS}"/><path class="tp-specks" d="${BANDS}"/></g>` +
    `<circle class="tp-stream" r="8" filter="url(#${b})"/>` +
    '</g>' +
    `<circle class="tp-solid" r="23" filter="url(#${b})"/>` +
    '</g>' +
    '</g>';
  return svg(fx, defs);
}

/**
 * The wordmark: "taxpress" and the cup as its o. With `play`, it animates once; `id` must then be
 * unique in the document.
 */
export function wordmark(play = false, id = 'tp'): string {
  return `<span class="tp-word${play ? ' tp-play' : ''}" role="img" aria-label="Taxpresso"><span aria-hidden="true">taxpress</span>${play ? playingCup(id) : CUP_SVG}</span>`;
}

/** Favicon and app icon: the cup with its check on an espresso tile. */
export const ICON_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96">' +
  '<rect width="96" height="96" rx="24" fill="#1E1612"/>' +
  '<g transform="translate(48 48) scale(0.74)">' +
  '<circle r="40" fill="none" stroke="#F6F0E8" stroke-width="14"/>' +
  '<circle r="24" fill="#4A2C1D"/>' +
  `<path d="${CHECK}" fill="none" stroke="#D7A86E" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>` +
  '</g></svg>\n';
