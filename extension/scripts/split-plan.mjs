// Plans how the plugin's server is split into files of readable size (extension/scripts/build-plugin.mjs).
//
// esbuild's code splitting puts every module into the chunk of the entry points that reach it by
// static imports: modules reached by the same set of entry points share one file. The plugin's
// server has one real entry point (src/main.ts) and one split point PDF.js already has (a dynamic
// import in unpdf), so a plain split build is still one huge file. This planner adds entry points
// until every file that can be split is under the budget: it takes the largest chunk over the
// budget that holds more than one module and adds, as an entry point, the module of that chunk
// that cuts it closest to half while cutting the fewest other chunks. The extra entry points'
// own output files only re-export from the chunks; nothing imports them, and the build deletes
// them. Module sizes come from the metafile of a build without splitting (bytesInOutput).
//
// The plan is deterministic: the same metafile gives the same entry points.

/**
 * @param {{ inputs: Record<string, { imports: { path: string, kind: string, external?: boolean }[] }>,
 *           outputs: Record<string, { inputs: Record<string, { bytesInOutput: number }> }> }} meta
 *   the metafile of a build of `entry` without splitting
 * @param {string} entry the main entry point, as the metafile names it (e.g. "src/main.ts")
 * @param {number} budget the most bytes a chunk may have, when it can be split
 * @param {RegExp[]} [apart] inputs that start files of their own whatever their size (what they
 *   reach goes with them), such as a dependency whose code is minified upstream
 * @returns {{ entries: string[], chunks: { modules: string[], bytes: number }[] }}
 *   the extra entry points (metafile paths), and the chunks the plan expects
 */
export function planSplit(meta, entry, budget, apart = []) {
  const ids = Object.keys(meta.inputs).sort();
  const index = new Map(ids.map((id, i) => [id, i]));
  const size = new Array(ids.length).fill(0);
  for (const out of Object.values(meta.outputs)) {
    for (const [id, info] of Object.entries(out.inputs)) {
      const i = index.get(id);
      if (i !== undefined) size[i] += info.bytesInOutput;
    }
  }
  /** Static edges, and the targets of dynamic imports (esbuild makes each one an entry point). */
  const deps = ids.map(() => []);
  const dynamic = new Set();
  ids.forEach((id, i) => {
    for (const imp of meta.inputs[id].imports) {
      if (imp.external) continue;
      const j = index.get(imp.path);
      if (j === undefined) continue;
      if (imp.kind === 'dynamic-import') dynamic.add(j);
      else deps[i].push(j);
    }
  });
  const main = index.get(entry);
  if (main === undefined) throw new Error(`${entry} is not in the metafile`);

  // What each module reaches by static imports (itself included), as a bitset.
  const words = Math.ceil(ids.length / 32);
  const closure = ids.map((_, start) => {
    const bits = new Uint32Array(words);
    const stack = [start];
    bits[start >>> 5] |= 1 << (start & 31);
    while (stack.length) {
      for (const j of deps[stack.pop()]) {
        if (bits[j >>> 5] & (1 << (j & 31))) continue;
        bits[j >>> 5] |= 1 << (j & 31);
        stack.push(j);
      }
    }
    return bits;
  });
  const has = (bits, j) => (bits[j >>> 5] & (1 << (j & 31))) !== 0;

  const forced = ids.flatMap((id, i) => (apart.some((re) => re.test(id)) ? [i] : []));
  const entries = [main, ...[...dynamic].sort((a, b) => a - b)];
  const extra = forced.filter((i) => !entries.includes(i));
  entries.push(...extra);
  const stuck = new Set(); // chunk keys no single entry point improves

  const chunksOf = () => {
    const byKey = new Map();
    ids.forEach((_, j) => {
      const key = entries.filter((e) => has(closure[e], j)).join(',');
      if (!key) return; // unreachable: not in the output
      const chunk = byKey.get(key) ?? { key, modules: [], bytes: 0 };
      chunk.modules.push(j);
      chunk.bytes += size[j];
      byKey.set(key, chunk);
    });
    return [...byKey.values()];
  };

  for (;;) {
    const chunks = chunksOf();
    const target = chunks
      .filter((c) => c.bytes > budget && c.modules.length > 1 && !stuck.has(c.key))
      .sort((a, b) => b.bytes - a.bytes || (a.key < b.key ? -1 : 1))[0];
    if (!target) {
      return {
        entries: extra.map((i) => ids[i]),
        chunks: chunks
          .map((c) => ({ modules: c.modules.map((i) => ids[i]), bytes: c.bytes }))
          .sort((a, b) => b.bytes - a.bytes),
      };
    }
    const chunkOf = new Map();
    for (const c of chunks) for (const j of c.modules) chunkOf.set(j, c);
    let best;
    for (const m of target.modules) {
      if (entries.includes(m)) continue;
      let inside = 0;
      const reachedIn = new Map(); // other chunk -> bytes of it m reaches
      for (const j of ids.keys()) {
        if (!has(closure[m], j)) continue;
        const c = chunkOf.get(j);
        if (c === target) inside += size[j];
        else if (c) reachedIn.set(c, (reachedIn.get(c) ?? 0) + size[j]);
      }
      if (inside === target.bytes) continue; // reaches the whole chunk: cuts nothing
      // Cutting another chunk in two makes one more file; small leftovers are the cost.
      let cuts = 0;
      for (const [c, bytes] of reachedIn) if (bytes < c.bytes) cuts++;
      const balance = Math.abs(target.bytes / 2 - inside);
      const score = balance + cuts * (budget / 8);
      if (!best || score < best.score || (score === best.score && m < best.m)) best = { m, score };
    }
    if (!best) {
      stuck.add(target.key);
      continue;
    }
    entries.push(best.m);
    extra.push(best.m);
  }
}
