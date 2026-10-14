// Accounts, securities and the other movable wealth of a Zurich return. The securities rules are
// the same in every canton (the ESTV price list, Swiss withholding tax, the foreign tax credit:
// packages/rules-ch); Taxpresso reads them with the état des titres (@taxpresso/rules-ge,
// etatDesTitres), whose totals per owner then go on the Zurich lines: 400 and 150
// (Wertschriftenverzeichnis), 283 costs, 270 savings interest and life insurance premiums, 406 the
// surrender value, 416 the other valuables, 470 and 250 the private debts and their interest
// (zh-2025-form-steuererklaerung-hauptformular p. 2 to 4). The Zurich securities list itself
// (Wertschriftenverzeichnis, its columns and the Verrechnungssteuer refund) is a later step.
import type { Fact, VaultDocument } from '@taxpresso/ledger';
import type { Amount, MovableAsset, Text } from '@taxpresso/rules-ch';
import { etatDesTitres } from '@taxpresso/rules-ge';
import type { ZurichWealth } from '@taxpresso/rules-zh';

const NB = ' ';

export const NOTE_VALUABLES: Text = {
  en: 'Cash, precious metals and vehicles you described are taken together on line 416 (Übrige Vermögenswerte); the form also has 404 for cash and gold and 412 for vehicles: the taxable wealth is the same.',
  fr: `Les espèces, métaux précieux et véhicules décrits sont pris ensemble à la ligne 416 (Übrige Vermögenswerte)${NB}; le formulaire a aussi 404 pour les espèces et l’or et 412 pour les véhicules${NB}: la fortune imposable est la même.`,
};

/** The movable wealth of the ledger, on Zurich's lines. */
export function zurichWealth(
  taxYear: number,
  people: readonly ('p1' | 'p2')[],
  facts: readonly Fact[],
  documents: readonly VaultDocument[],
): ZurichWealth {
  const etat = etatDesTitres({ taxYear, people: [...people], facts, documents });
  const movable: MovableAsset[] = [];
  const household: NonNullable<ZurichWealth['household']> = {};
  const notes: Text[] = [];
  const amount = (centimes: number, estimate: boolean, complete: boolean): Amount => ({
    value: centimes,
    status: estimate ? 'estimate' : 'stated',
    ...(complete ? {} : { complete: false }),
  });
  const addTo = (
    field: keyof NonNullable<ZurichWealth['household']>,
    centimes: number,
    estimate: boolean,
    complete: boolean,
  ) => {
    const had = household[field];
    household[field] = had
      ? {
          value: had.value + centimes,
          status: had.status === 'estimate' || estimate ? 'estimate' : 'stated',
          ...(had.complete === false || !complete ? { complete: false } : {}),
        }
      : amount(centimes, estimate, complete);
  };
  for (const item of etat.items) {
    const a = amount(item.centimes, item.estimate, item.complete);
    switch (item.rubric) {
      case 'income':
        if (item.centimes) movable.push({ owner: item.person, income: a });
        break;
      case 'wealth':
        if (item.centimes) movable.push({ owner: item.person, value: a });
        break;
      case 'fees':
        addTo('bankFees', item.centimes, item.estimate, item.complete);
        break;
      case 'savings':
        addTo('savingsInterest', item.centimes, item.estimate, item.complete);
        break;
      case 'lifeInsurancePremiums':
        addTo('lifeInsurancePremiums', item.centimes, item.estimate, item.complete);
        break;
      case 'lifeInsuranceValue':
        addTo('lifeInsuranceValue', item.centimes, item.estimate, item.complete);
        break;
      case 'valuables':
        addTo('otherAssets', item.centimes, item.estimate, item.complete);
        if (!notes.includes(NOTE_VALUABLES)) notes.push(NOTE_VALUABLES);
        break;
      case 'debts':
        addTo('debts', item.centimes, item.estimate, item.complete);
        break;
      case 'debtInterest':
        addTo('debtInterest', item.centimes, item.estimate, item.complete);
        break;
      // The withholding tax claimed back and the foreign tax credit: next to the tax, not in it.
      default:
        break;
    }
  }
  return {
    ...(movable.length ? { movable } : {}),
    ...(Object.keys(household).length ? { household } : {}),
    ...(notes.length ? { notes } : {}),
  };
}
