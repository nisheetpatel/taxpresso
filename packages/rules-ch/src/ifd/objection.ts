// The deadline to object to a federal assessment (réclamation), the same in every canton, read in
// the law itself: LIFD, RS 642.11 (ch-na-law-lifd, p. 71). Art. 132 al. 1: 30 days after
// notification. Art. 133 al. 1: the time limit starts the day after notification; when its last
// day is a Saturday, a Sunday or an official public holiday, it ends on the next working day.
// No value imports: the website reads this module with Node's type stripping.
import type { Cited } from '../core/cited.js';

/** A deadline to object, as a law sets it. */
export interface ObjectionRule {
  days: Cited<number>;
  /** Counting starts the day after notification; a weekend last day moves to the next working day. */
  counting: string;
  law: string;
  /** Where the objection goes, in the law's words. */
  to: string;
}

export const IFD_OBJECTION: ObjectionRule = {
  days: { value: 30, source: 'ch-na-law-lifd art. 132 al. 1 (p. 71)' },
  counting: 'ch-na-law-lifd art. 133 al. 1 (p. 71)',
  law: 'LIFD (RS 642.11)',
  to: 'ch-na-law-lifd art. 132 al. 1 (p. 71) (réclamation écrite à l’autorité de taxation)',
};
