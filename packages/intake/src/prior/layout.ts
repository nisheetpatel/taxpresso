// Lines and cells of a PDF page, the way layoutText (../review.ts) rebuilds reading order, but
// keeping where each cell starts and ends: on a declaration, which column an amount sits in says
// whether it is the cantonal (ICC) or the federal (IFD) one. Same thresholds as layoutText, so a
// page's cells joined with four spaces read like its review text.
import type { Cell, Line } from './types.js';

export interface TextItem {
  str: string;
  transform: number[];
  width: number;
}

export function layoutCells(items: readonly TextItem[]): Line[] {
  const words = items
    .filter((i) => i.str.trim() !== '')
    .map((i) => {
      const [a = 0, b = 0, , d = 0, x = 0, y = 0] = i.transform;
      return { str: i.str, x, y, w: i.width, size: Math.max(Math.hypot(a, b), Math.abs(d), 1) };
    })
    .sort((p, q) => q.y - p.y || p.x - q.x);
  const rows: (typeof words)[] = [];
  for (const word of words) {
    const row = rows.at(-1);
    if (row && Math.abs(row[0]!.y - word.y) <= Math.max(2, 0.4 * word.size)) row.push(word);
    else rows.push([word]);
  }
  return rows.map((row) => {
    row.sort((p, q) => p.x - q.x);
    const cells: Cell[] = [];
    let cell: { text: string; x: number; right: number } | undefined;
    for (const w of row) {
      const gap = cell ? w.x - cell.right : Infinity;
      if (!cell || gap > 1.5 * w.size) {
        if (cell) cells.push(finish(cell));
        cell = { text: w.str, x: w.x, right: w.x + w.w };
        continue;
      }
      if (gap > 0.15 * w.size && !cell.text.endsWith(' ') && !w.str.startsWith(' ')) {
        cell.text += ' ';
      }
      cell.text += w.str;
      cell.right = Math.max(cell.right, w.x + w.w);
    }
    if (cell) cells.push(finish(cell));
    return { cells };
  });
}

const finish = (c: { text: string; x: number; right: number }): Cell => ({
  text: c.text.replace(/\s+/g, ' ').trim(),
  x: c.x,
  right: c.right,
});

/** Plain text: one line per text line, cells split where two or more spaces are. */
export function linesFromText(text: string): Line[] {
  return text
    .split(/\r?\n/)
    .map((l) => ({
      cells: l
        .split(/\s{2,}/)
        .map((t) => t.trim())
        .filter((t) => t !== '')
        .map((t) => ({ text: t })),
    }))
    .filter((l) => l.cells.length > 0);
}

export const lineText = (line: Line): string => line.cells.map((c) => c.text).join('    ');
