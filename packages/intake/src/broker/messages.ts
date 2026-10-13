// Warnings about broker exports, in English and French. Second person, plain words; the official
// French term next to its gloss. Placeholders: {name}.
import type { BrokerWarning } from './types.js';

const MESSAGES = {
  unreadable: {
    en: 'This file looks like a {broker} export but can’t be read ({detail}). Export it again.',
    fr: 'Ce fichier ressemble à un export {broker} mais ne peut pas être lu ({detail}). Exportez-le à nouveau.',
  },
  no_statement: {
    en: 'This {broker} export has no statement in it.',
    fr: 'Cet export {broker} ne contient aucun relevé.',
  },
  unknown_date_format: {
    en: 'The dates in this export can’t be read for sure (day or month first?). Dates are left out.',
    fr: 'Les dates de cet export ne peuvent pas être lues avec certitude (jour ou mois en premier ?). Elles sont laissées de côté.',
  },
  unknown_decimal: {
    en: 'The amounts in this export can’t be read for sure (decimal comma or point?). Check them.',
    fr: 'Les montants de cet export ne peuvent pas être lus avec certitude (virgule ou point décimal ?). Vérifiez-les.',
  },
  bad_value: {
    en: 'Line {line}: “{value}” can’t be read, so this row is left out.',
    fr: 'Ligne {line} : « {value} » ne peut pas être lu, cette ligne est donc laissée de côté.',
  },
  bad_isin: {
    en: '{name}: “{isin}” is not a valid ISIN. Check the security number.',
    fr: '{name} : « {isin} » n’est pas un ISIN valide. Vérifiez le numéro du titre.',
  },
  asset_not_read: {
    en: '{name} ({kind}) is not read: Taxpresso reads shares, funds and bonds. Add it to your securities list (état des titres) yourself.',
    fr: '{name} ({kind}) n’est pas lu : Taxpresso lit les actions, les fonds et les obligations. Ajoutez-le vous-même à l’état des titres.',
  },
  short_position: {
    en: '{name} is a short position: not read. Add it yourself.',
    fr: '{name} est une position à découvert : elle n’est pas lue. Ajoutez-la vous-même.',
  },
  no_chf_rate: {
    en: 'No exchange rate to CHF for {currency} in this export: CHF amounts in {currency} stay empty until the official rates are available.',
    fr: 'Aucun taux de change en CHF pour {currency} dans cet export : les montants en {currency} restent vides en CHF jusqu’à la publication des cours officiels.',
  },
  cash_not_read: {
    en: 'Your cash at {broker} is not part of this list: add it with your bank accounts (comptes bancaires).',
    fr: 'Vos liquidités chez {broker} ne font pas partie de cette liste : ajoutez-les avec vos comptes bancaires.',
  },
  interest_not_read: {
    en: 'Interest on your cash at {broker} is not read: add it with your bank accounts (comptes bancaires).',
    fr: 'Les intérêts sur vos liquidités chez {broker} ne sont pas lus : ajoutez-les avec vos comptes bancaires.',
  },
  unknown_cash_type: {
    en: '{count} row(s) of type “{type}” are not read.',
    fr: '{count} ligne(s) de type « {type} » ne sont pas lues.',
  },
  cash_without_security: {
    en: 'Line {line}: {kind} of {amount} {currency} names no security, so it is not counted.',
    fr: 'Ligne {line} : {kind} de {amount} {currency} sans titre indiqué, donc pas compté.',
  },
  corporate_actions: {
    en: '{count} corporate action(s) in this export (splits, mergers, spin-offs): check the quantities.',
    fr: '{count} opération(s) sur titres dans cet export (fractionnements, fusions, scissions) : vérifiez les quantités.',
  },
  unknown_row: {
    en: 'Line {line}: “{description}” for {name} is not read. Check whether it is income.',
    fr: 'Ligne {line} : « {description} » pour {name} n’est pas lu. Vérifiez s’il s’agit d’un revenu.',
  },
  bond_interest_paid: {
    en: 'Accrued interest you paid when buying bonds is not counted.',
    fr: 'Les intérêts courus payés à l’achat d’obligations ne sont pas comptés.',
  },
  payment_in_lieu: {
    en: '{name}: the income includes {amount} {currency} paid in lieu of a dividend (securities lending). Check it with your broker.',
    fr: '{name} : le revenu comprend {amount} {currency} versés en remplacement d’un dividende (prêt de titres). Vérifiez-le auprès de votre courtier.',
  },
  no_date: {
    en: 'This export has no date. Check that it shows what you held on 31 December {year}.',
    fr: 'Cet export n’est pas daté. Vérifiez qu’il montre ce que vous déteniez au 31 décembre {year}.',
  },
  positions_not_year_end: {
    en: 'The positions are on {date}, not on 31 December {year}, so they are not used. Export them again for 31 December.',
    fr: 'Les positions sont au {date}, pas au 31 décembre {year}, elles ne sont donc pas utilisées. Exportez-les à nouveau au 31 décembre.',
  },
  wrong_year: {
    en: 'This export covers {from} to {to}, not {year}, so it is not used.',
    fr: 'Cet export couvre la période du {from} au {to}, pas {year}, il n’est donc pas utilisé.',
  },
  partial_year: {
    en: 'This export covers {from} to {to} only: income outside these dates is missing.',
    fr: 'Cet export couvre seulement la période du {from} au {to} : les revenus hors de ces dates manquent.',
  },
  outside_year: {
    en: '{count} income or tax row(s) dated outside {year} are not counted.',
    fr: '{count} ligne(s) de revenu ou d’impôt datées hors de {year} ne sont pas comptées.',
  },
  replaced: {
    en: 'Replaced by the newer export {file}.',
    fr: 'Remplacé par l’export plus récent {file}.',
  },
  replaced_account: {
    en: 'Account {account}: replaced by the newer export {file}.',
    fr: 'Compte {account} : remplacé par l’export plus récent {file}.',
  },
  withholding_country_unknown: {
    en: '{name}: Taxpresso can’t tell whether the tax withheld is Swiss (impôt anticipé) or foreign, so it is not counted.',
    fr: '{name} : Taxpresso ne peut pas dire si l’impôt retenu est suisse (impôt anticipé) ou étranger, il n’est donc pas compté.',
  },
  empty: {
    en: 'This export has no positions and no income.',
    fr: 'Cet export ne contient ni positions ni revenus.',
  },
} as const satisfies Record<string, { en: string; fr: string }>;

export type WarningCode = keyof typeof MESSAGES;

const NBSP = String.fromCharCode(0xa0);
const frenchSpacing = (s: string) =>
  s.replace(/ ([?!:;»])/g, `${NBSP}$1`).replace(/« /g, `«${NBSP}`);

/** 2026-12-31 -> 31.12.2026, as dates are written in Switzerland. */
export function swissDate(isoDate: string): string {
  const m = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : isoDate;
}

export function warning(
  code: WarningCode,
  params: Record<string, string | number> = {},
  line?: number,
): BrokerWarning {
  const fill = (s: string) =>
    s.replace(/\{(\w+)\}/g, (_, k: string) => String(params[k] ?? (k === 'line' ? line : '')));
  return {
    code,
    en: fill(MESSAGES[code].en),
    fr: frenchSpacing(fill(MESSAGES[code].fr)),
    ...(line !== undefined ? { line } : {}),
  };
}
