// Last year's figures (keys-prior.ts) and the official commune codes (commune-codes.ts).
import { readFileSync } from 'node:fs';
import { Ledger } from '@taxpresso/ledger';
import { describe, expect, it } from 'vitest';
import {
  COMMUNE_CODES,
  COMMUNE_CODES_SOURCE,
  communeByCode,
  communeByName,
  COMMUNES_2026,
  KEYS_2026,
  KEYS_PRIOR_2026,
  parsePriorInstance,
  PRIOR_MAIN_LINES_2026,
  priorInstance,
  priorLines,
} from '../src/index.js';

const lock = JSON.parse(
  readFileSync(new URL('../../../docs/sources/lock.json', import.meta.url), 'utf8'),
) as Record<string, { status: string }>;
const cited = (source: string) => lock[source.split(' ')[0]!]?.status;

describe('commune codes (code lieu)', () => {
  it('map every Geneva commune once, from the guide’s list', () => {
    const slugs = Object.keys(COMMUNE_CODES).map((c) => communeByCode(Number(c)));
    expect(slugs.every(Boolean)).toBe(true);
    expect(new Set(slugs).size).toBe(COMMUNES_2026.length);
    expect(communeByCode(6643)).toBe('vernier');
    expect(communeByCode(6621)).toBe('geneve');
    expect(communeByCode(6642)).toBe('vandoeuvres');
    expect(communeByCode(9022)).toBeUndefined(); // Vaud: a canton, not a Geneva commune
    expect(communeByCode(1214)).toBeUndefined();
    expect(cited(COMMUNE_CODES_SOURCE)).toBe('ok');
  });

  it('match a place to a commune only when it is the commune’s own name', () => {
    expect(communeByName('Vernier')).toBe('vernier');
    expect(communeByName('VERNIER')).toBe('vernier');
    expect(communeByName('Le Grand-Saconnex')).toBe('grand-saconnex');
    expect(communeByName('Genève 3')).toBe('geneve');
    expect(communeByName('Vandœuvres')).toBe('vandoeuvres');
    expect(communeByName('Thonex')).toBe('thonex');
    for (const place of ['Petit-Lancy', 'Le Lignon', 'Vésenaz', 'Lausanne', '']) {
      expect(communeByName(place), place).toBeUndefined();
    }
  });
});

describe('last year’s figures', () => {
  it('name each printed line by its form page, code and repeat', () => {
    const ref = { form: 'A1', code: '11.10', occurrence: 2 } as const;
    expect(priorInstance(ref)).toBe('A1-11.10:2');
    expect(parsePriorInstance('A1-11.10:2')).toEqual(ref);
    expect(priorInstance({ form: 'A2', code: '41.10', suffix: 'r', occurrence: 1 })).toBe(
      'A2-41.10r',
    );
    expect(parsePriorInstance('A2-41.10r')).toEqual({
      form: 'A2',
      code: '41.10',
      suffix: 'r',
      occurrence: 1,
    });
    expect(parsePriorInstance('C3-52.00')).toBeUndefined();
    expect(parsePriorInstance('PG2-1.00')).toBeUndefined();
  });

  it('are stored in the ledger per person or for the household, and read back as lines', () => {
    const ledger = new Ledger(2026, KEYS_2026);
    const source = { method: 'pdf_text', docId: 'd_1', page: 5 } as const;
    const base = { status: 'extracted', source } as const;
    ledger.append({
      ...base,
      key: 'prior.person.icc',
      person: 'p1',
      instance: 'A1-31.40',
      value: 700_000,
    });
    ledger.append({
      ...base,
      key: 'prior.person.ifd',
      person: 'p1',
      instance: 'A1-31.40',
      value: 700_000,
    });
    ledger.append({
      ...base,
      key: 'prior.household.icc',
      person: 'household',
      instance: 'PG4-99.00',
      value: 6_240_000,
    });
    expect(() =>
      ledger.append({
        ...base,
        key: 'prior.household.icc',
        person: 'p1',
        instance: 'PG2-91.00',
        value: 1,
      }),
    ).toThrow(/for the household/);
    expect(priorLines(ledger.view())).toEqual([
      {
        form: 'PG4',
        code: '99.00',
        occurrence: 1,
        person: 'household',
        icc: 6_240_000,
        page: 5,
        docId: 'd_1',
        status: 'extracted',
      },
      {
        form: 'A1',
        code: '31.40',
        occurrence: 1,
        person: 'p1',
        icc: 700_000,
        ifd: 700_000,
        page: 5,
        docId: 'd_1',
        status: 'extracted',
      },
    ]);
  });

  it('cite the official guide, and name main lines on forms that are kept', () => {
    for (const [key, def] of Object.entries(KEYS_PRIOR_2026)) {
      expect(def.multiple, key).toBe(true);
      expect(cited(def.source ?? ''), key).toBe('ok');
    }
    for (const main of PRIOR_MAIN_LINES_2026) {
      expect(cited(main.source), main.code).toBe('ok');
      expect(main.official, main.code).toBeTruthy();
      expect(
        parsePriorInstance(priorInstance({ ...main, occurrence: 1 })),
        main.code,
      ).toBeDefined();
    }
  });
});
