// The St. Gallen deduction rules with a cap, a floor or an excess, as small pure functions on
// centimes, each tested against the rule as the law, the ordinance, the guide or the forms state it.
import { roundFranc, shareFranc } from '@taxpresso/rules-ch';

/**
 * Form 4, 3.1, other professional costs: a fixed amount plus a share of the net salary, at most the
 * maximum (StV Art. 21 Abs. 1: Fr. 700 plus 10 percent, at most Fr. 2,400). `salary` is the net
 * salary as the ordinance defines it (Abs. 2): gross less the AHV and pension fund contributions,
 * without the buy-ins.
 */
export function otherFlat(salary: number, p: { base: number; rateBp: number; max: number }) {
  if (salary <= 0) return 0;
  return Math.min(p.max, p.base + shareFranc(salary, p.rateBp));
}

/**
 * Form 4, 5.1, a side job: its costs up to its net income while that is at most the minimum; above,
 * the share of it, at least the minimum, at most the maximum (guide p. 25; StV Art. 22).
 */
export function sideJobFlat(net: number, p: { rateBp: number; min: number; max: number }): number {
  if (net <= 0) return 0;
  if (net <= p.min) return net;
  return Math.min(p.max, Math.max(p.min, shareFranc(net, p.rateBp)));
}

/**
 * Form 4, 1.3, a car when public transport can't be used: the km one way, there and back, each
 * working day, at the rate per km, to the franc (Form 4: Total km x Fr. 0.70).
 */
export function vehicleCost(kmOneWay: number, days: number, perKm: number): number {
  return roundFranc(Math.max(0, kmOneWay) * 2 * Math.max(0, days) * perKm);
}

/**
 * 23.3, a child's education costs: what you paid above the excess, at most the maximum, less the
 * state scholarships. The law reduces the capped deduction by the scholarships (StG Art. 48 Abs. 1
 * lit. a: "vermindert sich, soweit der Staat Stipendien gewährt, um den entsprechenden Betrag");
 * Form 10 takes them off the costs before the excess. Both readings are returned: they differ only
 * when the costs above the excess pass the maximum and there are scholarships.
 */
export function educationDeduction(
  costs: number,
  scholarships: number,
  p: { educationMax: number; educationExcess: number },
): { law: number; form: number } {
  const law = Math.max(
    0,
    Math.min(p.educationMax, Math.max(0, costs - p.educationExcess)) - scholarships,
  );
  const form = Math.min(p.educationMax, Math.max(0, costs - scholarships - p.educationExcess));
  return { law, form };
}

/**
 * 14, the most that counts for insurance premiums and savings interest: married couples or everyone
 * else, more when no pension fund or pillar 3a contribution is deducted, more for each child with a
 * child deduction (StG Art. 45 Abs. 1 lit. g; Form 6, B).
 */
export function insuranceCap(
  p: { married: number; other: number; marriedExtra: number; otherExtra: number; perChild: number },
  married: boolean,
  noPension: boolean,
  children: number,
): number {
  const base = married ? p.married : p.other;
  const extra = noPension ? (married ? p.marriedExtra : p.otherExtra) : 0;
  return base + extra + children * p.perChild;
}
