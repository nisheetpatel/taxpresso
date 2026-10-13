// Withholding tax rules and official exchange rates, each against the document it cites.
import { readFileSync } from 'node:fs';
import type { KeyDef } from '@taxpresso/ledger';
import { describe, expect, it } from 'vitest';
import {
  DOCUMENT_KEYS_WEALTH_2026,
  FOREIGN_RESIDUAL_RATES,
  IA_DEPOSIT_INTEREST_EXEMPT,
  IA_RATE,
  IA_ROUNDING,
  IES_MINIMUM,
  iaClaim,
  iaOn,
  KEYS_SECURITIES_2026,
  KEYS_WEALTH_2026,
  OFFICIAL_RATES,
  OFFICIAL_VALUE_HELP,
  officialChf,
  residualRate,
  roundFranc,
  RUBRICS_2026,
  SECTIONS_2026,
  splitForeignTax,
} from '../src/index.js';

describe('Swiss withholding tax (impôt anticipé)', () => {
  it('is 35 % (LIA art. 13), claimed on the income subject to it, to 5 centimes (guide p. 39)', () => {
    expect(IA_RATE.value).toBe(3500);
    expect(IA_ROUNDING.value).toBe(5);
    expect(iaClaim(1500_00)).toBe(525_00);
    expect(iaClaim(123_00)).toBe(43_05);
    expect(iaClaim(0)).toBe(0);
    // Not whole francs: 35 % of CHF 10.08 is CHF 3.528, so CHF 3.55; of CHF 10.03, CHF 3.50.
    expect(iaClaim(10_08)).toBe(3_55);
    expect(iaClaim(10_03)).toBe(3_50);
    expect(iaOn(88_10)).toBe(30_84);
  });

  it('leaves client-deposit interest of CHF 200 or less untaxed (LIA art. 5 al. 1 let. c)', () => {
    expect(IA_DEPOSIT_INTEREST_EXEMPT.value).toBe(200_00);
  });

  it('rounds amounts to the franc, halves up, as the form asks (F1)', () => {
    expect(roundFranc(123_49)).toBe(123_00);
    expect(roundFranc(123_50)).toBe(124_00);
    expect(roundFranc(-123_50)).toBe(-124_00);
    expect(roundFranc(0)).toBe(0);
  });
});

describe('foreign tax withheld (DA-1)', () => {
  it('uses the non-recoverable rates of the 2025 list (ch-2025-oiis-dff-annexe)', () => {
    const us = residualRate('US', 'dividend', 2025);
    expect(us).toMatchObject({ ok: true, rate: { bp: 1500 } });
    expect(us.ok && us.rate.caveat?.en).toMatch(/REIT/);
    expect(residualRate('fr', 'dividend', 2025)).toMatchObject({ ok: true, rate: { bp: 1280 } });
    expect(residualRate('GB', 'dividend', 2025)).toMatchObject({ ok: true, rate: { bp: 0 } });
    expect(residualRate('BE', 'interest', 2025)).toMatchObject({ ok: true, rate: { bp: 1000 } });
  });

  it('fails closed: no list for the year, no country, no rate for the kind of income', () => {
    expect(residualRate('US', 'dividend', 2026)).toEqual({ ok: false, reason: 'no_list' });
    expect(residualRate('XX', 'dividend', 2025)).toEqual({ ok: false, reason: 'no_country' });
    expect(residualRate(undefined, 'dividend', 2025)).toEqual({ ok: false, reason: 'no_country' });
    expect(residualRate('DE', 'interest', 2025)).toEqual({ ok: false, reason: 'no_kind' });
  });

  it('credits at most the rate, and only what was withheld (note A2)', () => {
    // 30 % withheld on USD dividends: 15 % non-recoverable, 15 % to reclaim from the US.
    expect(splitForeignTax(1000_00, 300_00, 1500)).toEqual({
      nonRecoverable: 150_00,
      recoverableAbroad: 150_00,
    });
    // Less withheld than the rate: only what was withheld.
    expect(splitForeignTax(1000_00, 100_00, 1500)).toEqual({
      nonRecoverable: 100_00,
      recoverableAbroad: 0,
    });
    // 15 % of CHF 88.10 is CHF 13.215: CHF 13.22.
    expect(splitForeignTax(88_10, 13_22, 1500).nonRecoverable).toBe(13_22);
  });

  it('grants the credit only above CHF 100 (OIIS art. 7)', () => {
    expect(IES_MINIMUM.value).toBe(100_00);
  });
});

describe('official exchange rates', () => {
  it('converts at the 2025 rates: average for income, 31 December for wealth', () => {
    expect(officialChf(1000_00, 'USD', 2025, 'wealth')).toMatchObject({
      ok: true,
      centimes: 792_25,
      rate: '0.792250',
    });
    // EUR 123.45 at 0.9370347 = CHF 115.6769...: CHF 115.68.
    expect(officialChf(123_45, 'eur', 2025, 'income')).toMatchObject({
      ok: true,
      centimes: 115_68,
    });
    expect(officialChf(500_00, 'CHF', 2026, 'wealth')).toMatchObject({
      ok: true,
      centimes: 500_00,
    });
  });

  it('fails closed before the year’s rates are published, or for another currency', () => {
    expect(officialChf(100_00, 'USD', 2026, 'wealth')).toEqual({
      ok: false,
      reason: 'no_rates_for_year',
    });
    expect(officialChf(100_00, 'JPY', 2025, 'wealth')).toEqual({
      ok: false,
      reason: 'no_rate_for_currency',
    });
  });
});

describe('citations (SPEC.md 13, item 8b)', () => {
  const lock = JSON.parse(
    readFileSync(new URL('../../../docs/sources/lock.json', import.meta.url), 'utf8'),
  ) as Record<string, { status: string }>;
  const cited = (source: string | undefined, what: string) => {
    expect(source, what).toBeTruthy();
    for (const part of source!.split(';')) {
      const id = part.trim().split(' ')[0]!;
      expect(lock[id]?.status, `${what}: ${id}`).toBe('ok');
    }
  };

  it('cite official documents that are in the sources library', () => {
    for (const c of [IA_RATE, IA_ROUNDING, IA_DEPOSIT_INTEREST_EXEMPT, IES_MINIMUM]) {
      cited(c.source, String(c.value));
    }
    for (const [year, list] of Object.entries(FOREIGN_RESIDUAL_RATES)) {
      cited(list.source, year);
      for (const [country, rates] of Object.entries(list.countries)) {
        for (const rate of Object.values(rates)) cited(rate.source, `${year} ${country}`);
      }
    }
    for (const [year, table] of Object.entries(OFFICIAL_RATES)) cited(table.source, year);
    for (const [name, r] of Object.entries(RUBRICS_2026)) cited(r.source, name);
    for (const [name, s] of Object.entries(SECTIONS_2026)) cited(s.source, name);
    cited(OFFICIAL_VALUE_HELP.source, 'official value help');
    for (const registry of [KEYS_WEALTH_2026, DOCUMENT_KEYS_WEALTH_2026] as Record<
      string,
      KeyDef
    >[]) {
      for (const [key, def] of Object.entries(registry)) cited(def.source, key);
    }
    for (const key of [
      'securities.value_official_chf',
      'securities.owner',
      'securities.income_kind',
    ] as const) {
      cited(KEYS_SECURITIES_2026[key].source, key);
    }
  });
});
