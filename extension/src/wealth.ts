// Accounts, securities and the other movable wealth of a return in any canton but Geneva. The
// securities rules are the same in every canton (the ESTV price list, Swiss withholding tax, the
// foreign tax credit: packages/rules-ch); Taxpresso reads them with the état des titres
// (@taxpresso/rules-ge, etatDesTitres), whose totals per owner then go on the shared household
// fields each canton puts on its own lines (Zurich: 400 and 150, 283, 270, 406, 416, 470, 250,
// zh-2025-form-steuererklaerung-hauptformular p. 2 to 4; Bern: form 3.0, 4.1 to 4.3). A canton's
// own securities list (Zurich's and Bern's Wertschriftenverzeichnis, with the withholding tax
// refund) is a later step.
import type { Fact, VaultDocument } from '@taxpresso/ledger';
import type { Amount, MovableAsset, MovableWealth, Text } from '@taxpresso/rules-ch';
import { etatDesTitres } from '@taxpresso/rules-ge';

/**
 * The movable wealth of the ledger, on the shared household fields. `valuables`: what to note when
 * cash, precious metals or vehicles are taken together as other assets, when the canton's form has
 * lines of their own for them.
 */
export function movableWealth(
  taxYear: number,
  people: readonly ('p1' | 'p2')[],
  facts: readonly Fact[],
  documents: readonly VaultDocument[],
  valuables?: Text,
): MovableWealth {
  const etat = etatDesTitres({ taxYear, people: [...people], facts, documents });
  const movable: MovableAsset[] = [];
  const household: NonNullable<MovableWealth['household']> = {};
  const notes: Text[] = [];
  const amount = (centimes: number, estimate: boolean, complete: boolean): Amount => ({
    value: centimes,
    status: estimate ? 'estimate' : 'stated',
    ...(complete ? {} : { complete: false }),
  });
  const addTo = (
    field: keyof NonNullable<MovableWealth['household']>,
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
        if (valuables && !notes.includes(valuables)) notes.push(valuables);
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
