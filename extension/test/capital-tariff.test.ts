// The cantonal and communal tax on pension capital (packages/rules-ge, engine/capital.ts) against
// every row of the AFC's own capital tariffs (SPEC.md 7b: the document wins). Runs where the
// documents were downloaded (node scripts/fetch-sources.mjs); they are never committed.
//
// ge-2025-source-capital-icc-tariff and ge-2026-source-capital-icc-tariff: "Barème ICC à la source
// sur les prestations de prévoyance en capital selon art. 45 LIPP", for a single person, the
// cantonal centimes (48.5 %: 47.5 and 1 for home care) and a flat rate of communal centimes
// included (43.69 % in 2025, 43.44 % in 2026). Each range's rate is the tax at its middle, rounded
// to the hundredth of a percent. The 2026 tariff follows the 2026 scale (ge-2026-rcepf art. 17).
import { existsSync, readFileSync } from 'node:fs';
import { readForReview } from '@taxpresso/intake';
import { Trace } from '@taxpresso/rules-ch';
import { capitalIcc, paramsFor } from '@taxpresso/rules-ge';
import { describe, expect, it } from 'vitest';

const TARIFFS = [
  { taxYear: 2025, communalBp: 4369, rows: 624, differ: [] },
  // One range of the 2026 tariff, at a knife-edge: 39.43 on 20,250 before rounding (0.1947 %),
  // 39.50 with each line rounded to 5 centimes (0.1951 %). The tariff doesn't say how it rounds.
  { taxYear: 2026, communalBp: 4344, rows: 622, differ: [[20_200, 20_299, '0.19', '0.20']] },
] as const;

describe.each(TARIFFS)(
  'the AFC capital tariff $taxYear, every row',
  ({ taxYear, communalBp, rows: count, differ: known }) => {
    const FILE = new URL(
      `../../docs/sources/ge/files/ge-${taxYear}-source-capital-icc-tariff.pdf`,
      import.meta.url,
    );
    it.skipIf(!existsSync(FILE))('gives the printed rate at the middle of each range', async () => {
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
      expect(rows.length).toBe(count);
      const P = paramsFor(taxYear);
      const differ = rows.flatMap(([from, to, rate]) => {
        const mid = ((from + to + 1) / 2) * 100;
        const line = new Trace().line(mid, { en: '', fr: '' }, { en: '', fr: '' });
        const tax = capitalIcc(P, line, 'none', {
          bp: communalBp,
          label: { en: '', fr: '' },
          sources: [],
        }).tax.amount;
        const pct = (Math.floor((tax * 10_000) / mid + 0.5) / 100).toFixed(2);
        return pct === rate ? [] : [[from, to, rate, pct]];
      });
      expect(differ).toEqual(known);
    });
  },
);
