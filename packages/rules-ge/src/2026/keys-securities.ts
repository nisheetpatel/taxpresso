// Keys of the securities list (état des titres), SPEC.md sections 4 and 5.7. Each security is one
// instance (KeyDef.multiple): its ISIN, or a stable id when it has none. For the household: the
// owner of each line (civilité A, B or E on the form) comes from the document it was read from.
//
// Official terms, Geneva guide for 2025 (the latest published), ge-2025-guide-declaration-pp:
//   p. 38  état des titres; impôt anticipé (IA); imputation d'impôts étrangers prélevés à la
//          source (IES); titles held in Switzerland or abroad all belong in it
//   p. 39  impôt anticipé, reclaimed through the état des titres
//   p. 40  amounts in a foreign currency are converted at the official rate (liste des cours)
//   p. 41  titres suisses et étrangers: nombre de parts ou valeur nominale, désignation des
//          valeurs, numéro de valeur, rendements bruts soumis ou non soumis à l'impôt anticipé
//          (rounded to the franc), valeur imposable (the official year-end price, ICTax list)
// Re-check against the 2026 guide when it is published (January 2027).
import type { KeyRegistry } from '@taxpresso/ledger';

const security = { perPerson: false, multiple: true } as const;

export const KEYS_SECURITIES_2026 = {
  'securities.name': {
    ...security,
    type: 'string',
    label: { en: 'Security', fr: 'Désignation du titre' },
    official: 'désignation des valeurs',
  },
  'securities.isin': {
    ...security,
    type: 'string',
    label: { en: 'ISIN', fr: 'ISIN' },
  },
  'securities.valor': {
    ...security,
    type: 'string',
    label: { en: 'Swiss security number', fr: 'Numéro de valeur' },
    official: 'numéro de valeur',
  },
  'securities.currency': {
    ...security,
    type: 'string',
    label: { en: 'Currency', fr: 'Monnaie' },
    official: 'devise',
  },
  'securities.country': {
    ...security,
    type: 'string',
    label: { en: 'Country of the issuer', fr: 'Pays de l’émetteur' },
  },
  /** A decimal string ("3.5"): shares can be fractional, bonds count their nominal value. */
  'securities.quantity': {
    ...security,
    type: 'string',
    label: { en: 'Quantity on 31 December', fr: 'Nombre au 31 décembre' },
    official: 'nombre de parts ou valeur nominale',
  },
  /** The broker's valuation in the security's currency, a decimal string. */
  'securities.value_original': {
    ...security,
    type: 'string',
    label: {
      en: 'Value on 31 December, in its currency',
      fr: 'Valeur au 31 décembre, dans sa monnaie',
    },
  },
  /** Until the official ESTV price list (Kursliste) for the year is bundled: an estimate. */
  'securities.value_chf': {
    ...security,
    type: 'money',
    min: 0,
    label: { en: 'Taxable value on 31 December', fr: 'Valeur imposable au 31 décembre' },
    official: 'valeur imposable',
  },
  'securities.income_gross_chf': {
    ...security,
    type: 'money',
    label: { en: 'Gross income', fr: 'Rendement brut' },
    official: 'rendement brut',
  },
  'securities.withholding_swiss_chf': {
    ...security,
    type: 'money',
    label: { en: 'Swiss withholding tax', fr: 'Impôt anticipé' },
    official: 'impôt anticipé (IA)',
  },
  'securities.withholding_foreign_chf': {
    ...security,
    type: 'money',
    label: { en: 'Foreign tax withheld', fr: 'Impôts étrangers prélevés à la source' },
    official: 'impôts étrangers prélevés à la source (IES)',
  },
  /**
   * What the income is, from the export's cash rows: the credit of foreign tax (DA-1) differs for
   * dividends and interest (ch-na-oiis art. 8 al. 3, p. 5). 'mixed' when both, or payments in lieu.
   */
  'securities.income_kind': {
    ...security,
    type: 'enum',
    values: ['dividend', 'interest', 'mixed'],
    label: { en: 'Kind of income', fr: 'Nature du rendement' },
    official: 'dividendes, intérêts',
    source: 'ch-na-oiis art. 8 al. 3 (p. 5)',
  },
  /**
   * The official taxable value on 31 December from the ESTV price list (liste des cours, ICTax),
   * for the whole holding, as the user or Claude read it there. It replaces the broker's estimate
   * (securities.value_chf). The fact's note says where it came from. The extension never fetches it.
   */
  'securities.value_official_chf': {
    ...security,
    type: 'money',
    min: 0,
    max: 100_000_000_00,
    label: {
      en: 'Official taxable value on 31 December (ESTV price list)',
      fr: 'Valeur imposable officielle au 31 décembre (liste des cours AFC)',
    },
    official: 'valeur imposable au 31.12 (cours fiscal, liste des cours)',
    source: 'ge-2025-guide-declaration-pp p. 41; ch-na-listes-des-cours-ictax',
  },
  /** Whose line it is: civilité A (p1), B (p2), A and B (joint) or E (children). */
  'securities.owner': {
    ...security,
    type: 'enum',
    values: ['p1', 'p2', 'joint', 'children'],
    label: { en: 'Whose it is', fr: 'À qui il appartient' },
    official: 'civilité (A, B, E)',
    source: 'ge-2025-guide-declaration-pp p. 41; ge-2025-declaration-specimen p. 23',
  },
} as const satisfies KeyRegistry;

export type SecurityKey = keyof typeof KEYS_SECURITIES_2026;
