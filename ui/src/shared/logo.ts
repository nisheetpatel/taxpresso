// The Taxpresso mark (SPEC.md section 11b): the wordmark's last o is an espresso seen from above.
// Motion, sugar cube: a cube of brown sugar drops in, the crema holds it for a moment and it sinks,
// two ripples run out to the cup, and as they settle the check is drawn. One source for the
// dashboard, the MCP Apps card and the website; the animation lives in logo.css and plays once when
// the element carries the `tp-play` class. At rest the cup is the static mark: the espresso and its
// crema check.

/** The check, in crema. */
const CHECK = 'M-12 1l8 8 17-18';

/** The cup on its own, for icons and small places. */
export const CUP_SVG =
  '<svg class="tp-cup" viewBox="0 0 96 96" aria-hidden="true" focusable="false">' +
  '<g transform="translate(48 48)">' +
  '<circle class="tp-rim" r="40"/>' +
  '<circle class="tp-coffee" r="24"/>' +
  '<circle class="tp-ripple" r="21"/><circle class="tp-ripple tp-ripple-b" r="21"/>' +
  // A cube of brown sugar, the old crema test: good crema holds it for a moment.
  '<rect class="tp-cube" x="-6" y="-6" width="12" height="12" rx="2.5"/>' +
  `<path class="tp-check" pathLength="100" d="${CHECK}"/>` +
  '</g></svg>';

/** The wordmark: "taxpress" and the cup as its o. Add `tp-play` to animate it once. */
export function wordmark(play = false): string {
  return `<span class="tp-word${play ? ' tp-play' : ''}" role="img" aria-label="Taxpresso"><span aria-hidden="true">taxpress</span>${CUP_SVG}</span>`;
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
