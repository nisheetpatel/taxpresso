// The deadline to object to the cantonal and communal assessment (réclamation), read in the law
// itself: LPFisc, rsGE D 3 17 (ge-na-law-lpfisc). Art. 39 al. 1: a written réclamation "dans les 30
// jours qui suivent sa notification". Art. 41 al. 1: the time limit starts the day after
// notification; when its last day is a Saturday, a Sunday or an official public holiday, it ends on
// the next working day. The federal deadline is packages/rules-ch's (ifd/objection.ts).
// No value imports: the website reads this module with Node's type stripping.
import type { ObjectionRule } from '@taxpresso/rules-ch';

export const ICC_OBJECTION_2026: ObjectionRule = {
  days: { value: 30, source: 'ge-na-law-lpfisc art. 39 al. 1' },
  counting: 'ge-na-law-lpfisc art. 41 al. 1',
  law: 'LPFisc (rsGE D 3 17)',
  to: 'ge-na-law-lpfisc art. 39 al. 1 (réclamation écrite au département)',
};
