// The cantonal and communal tax on pension capital (packages/rules-ge, engine/capital.ts) against
// every row of the AFC's own capital tariff (SPEC.md 7b: the document wins). Runs where the
// documents were downloaded (node scripts/fetch-sources.mjs); they are never committed.
//
// ge-2025-source-capital-icc-tariff: "Barème 2025 ICC à la source sur les prestations de
// prévoyance en capital selon art. 45 LIPP", for a single person, the cantonal centimes (48.5 %:
// 47.5 and 1 for home care) and a flat 43.69 % of communal centimes included. Each range's rate is
// the tax at its middle, rounded to the hundredth of a percent.
import { existsSync, readFileSync } from 'node:fs';
import { readForReview } from '@taxpresso/intake';
import { Trace } from '@taxpresso/rules-ch';
import { capitalIcc, paramsFor } from '@taxpresso/rules-ge';
import { describe, expect, it } from 'vitest';

const FILE = new URL(
  '../../docs/sources/ge/files/ge-2025-source-capital-icc-tariff.pdf',
  import.meta.url,
);

describe.skipIf(!existsSync(FILE))('the AFC capital tariff 2025, every row', () => {
  it('gives the printed rate at the middle of each range', async () => {
    const bytes = new Uint8Array(readFileSync(FILE));
    let text = '';
    for (let from: number | undefined = 1; from !== undefined;) {
      const r = await readForReview(bytes, 'tariff.pdf', from);
      text += `${r.items.map((p) => p.text).join('\n')}\n`;
      from = r.nextPage;
    }
    const num = (s: string) => Number(s.replace(/[’']/g, ''));
    const rows = [...text.matchAll(/(\d[\d’']*)\s+(\d[\d’']*)\s+(\d+\.\d\d)(?!\d)/g)]
      .map((m) => [num(m[1]!), num(m[2]!), m[3]!] as const)
      .filter(([from, to]) => to > from);
    expect(rows.length).toBe(624);
    const P = paramsFor(2025);
    const differ = rows.filter(([from, to, rate]) => {
      const mid = ((from + to + 1) / 2) * 100;
      const line = new Trace().line(mid, { en: '', fr: '' }, { en: '', fr: '' });
      const tax = capitalIcc(P, line, 'none', {
        bp: 4369,
        label: { en: '', fr: '' },
        sources: [],
      }).tax.amount;
      const pct = (Math.floor((tax * 10_000) / mid + 0.5) / 100).toFixed(2);
      return pct !== rate;
    });
    expect(differ).toEqual([]);
  });
});
