// Citations point to documents in the sources library (SPEC.md 13, item 8b).
import { readFileSync } from 'node:fs';
import { expect } from 'vitest';

const lock = JSON.parse(
  readFileSync(new URL('../../../docs/sources/lock.json', import.meta.url), 'utf8'),
) as Record<string, { status: string }>;

/** Every manifest id in a source string ("id p. 5; other-id p. 17") is in the sources library. */
export function expectCited(source: string, what: string) {
  expect(source, what).toMatch(/^[a-z0-9-]+ p\. /);
  for (const part of source.split(';')) {
    const id = part.trim().split(' ')[0]!;
    expect(lock[id]?.status, `${what}: ${id}`).toBe('ok');
  }
}
