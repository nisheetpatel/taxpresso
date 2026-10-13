import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  Ledger,
  LedgerError,
  safeFilename,
  Vault,
  VaultError,
  type KeyRegistry,
} from '../src/index.js';

const KEYS: KeyRegistry = {
  'household.civil_status': {
    type: 'enum',
    values: ['single', 'married'],
    perPerson: false,
    label: { en: 'Civil status', fr: 'État civil' },
  },
  'income.salary.gross': {
    type: 'money',
    perPerson: true,
    min: 0,
    label: { en: 'Gross salary', fr: 'Salaire brut' },
  },
  'income.employer.gross': {
    type: 'money',
    perPerson: true,
    multiple: true,
    min: 0,
    label: { en: 'Gross salary from one employer', fr: 'Salaire brut d’un employeur' },
  },
};

const tmp = () => mkdtemp(path.join(os.tmpdir(), 'taxpresso-vault-'));

describe('Ledger', () => {
  it('keeps one current value per instance for keys that repeat', () => {
    const ledger = new Ledger(2026, KEYS);
    const add = (instance: string | undefined, value: number) =>
      ledger.append({
        key: 'income.employer.gross',
        person: 'p1',
        ...(instance === undefined ? {} : { instance }),
        value,
        status: 'extracted',
        source: { method: 'claude', docId: instance },
      });
    add('d_aaaa1111', 6_000_000);
    add('d_bbbb2222', 1_500_000);
    const fixed = add('d_aaaa1111', 6_100_000);
    expect(ledger.instances('income.employer.gross', 'p1').map((f) => f.value)).toEqual([
      6_100_000, 1_500_000,
    ]);
    expect(ledger.get('income.employer.gross', 'p1', 'd_aaaa1111')?.id).toBe(fixed.id);
    expect(ledger.history('income.employer.gross', 'p1', 'd_aaaa1111')).toHaveLength(2);
    expect(() => add(undefined, 1)).toThrow(LedgerError);
    expect(() => add('../x', 1)).toThrow(LedgerError);
    expect(() =>
      ledger.append({
        key: 'income.salary.gross',
        person: 'p1',
        instance: 'd_aaaa1111',
        value: 1,
        status: 'stated',
        source: { method: 'user' },
      }),
    ).toThrow(LedgerError);
    const reloaded = Ledger.fromJSON(ledger.toJSON(), KEYS);
    expect(reloaded.instances('income.employer.gross')).toHaveLength(2);
  });

  it('appends, supersedes and keeps the history', () => {
    const ledger = new Ledger(2026, KEYS);
    const a = ledger.append({
      key: 'household.civil_status',
      person: 'household',
      value: 'single',
      status: 'stated',
      source: { method: 'user' },
    });
    const b = ledger.append({
      key: 'household.civil_status',
      person: 'household',
      value: 'married',
      status: 'stated',
      source: { method: 'user' },
    });
    expect(b.supersedes).toBe(a.id);
    expect(ledger.get('household.civil_status')?.value).toBe('married');
    expect(ledger.history('household.civil_status').map((f) => f.value)).toEqual([
      'single',
      'married',
    ]);
    expect(ledger.view()).toHaveLength(1);
  });

  it('keeps money in integer centimes', () => {
    const ledger = new Ledger(2026, KEYS);
    const ok = {
      key: 'income.salary.gross',
      person: 'p1' as const,
      status: 'verified' as const,
      source: { method: 'barcode' as const },
    };
    expect(ledger.append({ ...ok, value: 8_500_000 }).value).toBe(8_500_000);
    expect(() => ledger.append({ ...ok, value: 85000.5 })).toThrow(/integer number of centimes/);
    expect(() => ledger.append({ ...ok, value: -1 })).toThrow(/at least 0/);
  });

  it('refuses unknown keys, wrong owners, bad enum values and computed facts', () => {
    const ledger = new Ledger(2026, KEYS);
    const base = { status: 'stated' as const, source: { method: 'user' as const } };
    expect(() => ledger.append({ ...base, key: 'nope', person: 'household', value: 1 })).toThrow(
      LedgerError,
    );
    expect(() =>
      ledger.append({ ...base, key: 'income.salary.gross', person: 'household', value: 1 }),
    ).toThrow(/per person/);
    expect(() =>
      ledger.append({ ...base, key: 'household.civil_status', person: 'p1', value: 'single' }),
    ).toThrow(/household/);
    expect(() =>
      ledger.append({
        ...base,
        key: 'household.civil_status',
        person: 'household',
        value: 'widowed',
      }),
    ).toThrow(/one of/);
    expect(() =>
      ledger.append({
        key: 'income.salary.gross',
        person: 'p1',
        value: 1,
        status: 'computed',
        source: { method: 'user' },
      }),
    ).toThrow(/rules engine/);
  });

  it('round-trips through JSON and rejects a broken chain', () => {
    const ledger = new Ledger(2026, KEYS);
    ledger.append({
      key: 'household.civil_status',
      person: 'household',
      value: 'single',
      status: 'stated',
      source: { method: 'user' },
    });
    ledger.append({
      key: 'household.civil_status',
      person: 'household',
      value: 'married',
      status: 'stated',
      source: { method: 'user' },
    });
    const json = JSON.parse(JSON.stringify(ledger.toJSON())) as ReturnType<Ledger['toJSON']>;
    expect(Ledger.fromJSON(json, KEYS).get('household.civil_status')?.value).toBe('married');
    json.facts[1]!.supersedes = 'f_other';
    expect(() => Ledger.fromJSON(json, KEYS)).toThrow(/supersedes chain/);
  });
});

describe('Vault', () => {
  it('creates its folders on first write only, with a README', async () => {
    const root = path.join(await tmp(), 'Taxpresso');
    const vault = new Vault(root, 2026);
    expect(vault.exists()).toBe(false);
    await vault.loadLedger(KEYS);
    expect(vault.exists()).toBe(false);
    await vault.saveLedger(new Ledger(2026, KEYS));
    expect(vault.exists()).toBe(true);
    expect(await readFile(path.join(root, '2026', 'README.txt'), 'utf8')).toMatch(/belongs to you/);
  });

  it('refuses a folder inside a git repository', async () => {
    const repo = await tmp();
    await mkdir(path.join(repo, '.git'));
    const vault = new Vault(path.join(repo, 'Taxpresso'), 2026);
    expect(vault.problem()).toMatch(/code repository/);
    await expect(vault.ensure()).rejects.toThrow(VaultError);
  });

  it('stores documents by content, and the same content twice is a no-op', async () => {
    const vault = new Vault(path.join(await tmp(), 'Taxpresso'), 2026);
    const bytes = new TextEncoder().encode('%PDF-1.7 synthetic');
    const first = await vault.addDocument(bytes, '../../Certificat de salaire.pdf', []);
    expect(first.duplicate).toBe(false);
    expect(first.document.path).toMatch(/^documents\/[0-9a-f]{8}-Certificat de salaire\.pdf$/);
    const again = await vault.addDocument(bytes, 'copy.pdf', [first.document]);
    expect(again).toEqual({ document: first.document, duplicate: true });
    expect((await vault.readDocument(first.document)).toString()).toBe('%PDF-1.7 synthetic');
  });

  it('finds files the user put in the folder, skipping its own files and known content', async () => {
    const vault = new Vault(path.join(await tmp(), 'Taxpresso'), 2026);
    await vault.ensure();
    await writeFile(path.join(vault.dir, 'attestation 3a.pdf'), 'three-a');
    await writeFile(path.join(vault.dir, 'ledger.json'), '{}');
    await writeFile(path.join(vault.dir, '.DS_Store'), 'x');
    await mkdir(path.join(vault.dir, 'filing'));
    await writeFile(path.join(vault.dir, 'filing', 'receipt.pdf'), 'receipt');
    const found = await vault.scan([]);
    expect(found.map((d) => d.path)).toEqual(['attestation 3a.pdf']);
    expect(await vault.scan(found)).toEqual([]);
  });

  it('makes file names safe', () => {
    expect(safeFilename('a/b\\c:d*?.pdf')).toBe('c_d__.pdf');
    expect(safeFilename('...hidden')).toBe('hidden');
    expect(safeFilename('')).toBe('document');
  });
});
