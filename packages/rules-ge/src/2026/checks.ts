// Consistency checks across documents (SPEC.md section 5.8): deterministic rules over the ledger
// and the document details, never a model. Derived on every read, never stored; only the user's
// note that settles one is stored (key check.note, instance = the check id).
import type { Fact, Owner, VaultDocument } from '@taxpresso/ledger';
import { PILLAR3A_2026_FACTS, type Text } from '@taxpresso/rules-ch';

export type { Text };

export type CheckRule =
  'other_year' | 'pillar3a_year' | 'salary_period' | 'replacement_in_salary' | 'duplicate';

export interface ConsistencyCheck {
  /** Stable while the documents don't change, e.g. "other_year:d_1a2b3c4d5e6f". */
  id: string;
  rule: CheckRule;
  /** The documents involved, by id. */
  documents: string[];
  person?: Owner;
  title: Text;
  /** What Taxpresso saw. */
  detail: Text;
  /** What the user can do. */
  todo: Text;
  /** Official source for the rule, when one is involved. */
  source?: string;
  /** Set once the user settled it with a note. */
  resolved?: { note: string; at: string };
}

export interface CheckInput {
  taxYear: number;
  /** Documents that count: replaced ones are left out by the caller. */
  documents: readonly VaultDocument[];
  /** The ledger's current view. */
  facts: readonly Fact[];
}

const WAGE_GUIDE = 'std-lohnausweis-wegleitung-2026-fr';
const MOVED_DURING_YEAR = new Set(['from_other_canton', 'from_abroad', 'leaving_switzerland']);
/** Values that tell two documents of the same kind and issuer apart. */
const SUBJECT_KEYS = ['assessment.tax', 'replacement.type', 'pension.type'];

const MONTHS = {
  en: [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ],
  fr: [
    'janvier',
    'février',
    'mars',
    'avril',
    'mai',
    'juin',
    'juillet',
    'août',
    'septembre',
    'octobre',
    'novembre',
    'décembre',
  ],
} as const;

/** 2026-03-01 -> "1 March 2026" / "1er mars 2026". */
export function formatDay(iso: string, lang: 'en' | 'fr'): string {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  const month = MONTHS[lang][m - 1] ?? '';
  return lang === 'fr' ? `${d === 1 ? '1er' : d} ${month} ${y}` : `${d} ${month} ${y}`;
}

/** 123456 -> "CHF 1'234.56", the Swiss way of writing it in both languages. */
export function formatChf(centimes: number): string {
  const abs = Math.abs(centimes);
  const francs = String(Math.trunc(abs / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, '’');
  return `${centimes < 0 ? '-' : ''}CHF ${francs}.${String(abs % 100).padStart(2, '0')}`;
}

/** Issuer names compared without case, accents, spaces or punctuation. */
export function sameIssuer(a: string | undefined, b: string | undefined): boolean {
  const norm = (s: string) =>
    s
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');
  return !!a && !!b && norm(a) !== '' && norm(a) === norm(b);
}

/** The year a document is for, when it is clearly not `year`: from its tax year, else its period. */
function otherYear(doc: VaultDocument, year: number): number | undefined {
  if (doc.taxYear !== undefined) return doc.taxYear !== year ? doc.taxYear : undefined;
  if (doc.periodFrom && doc.periodTo) {
    if (doc.periodTo < `${year}-01-01` || doc.periodFrom > `${year}-12-31`) {
      return Number(doc.periodFrom.slice(0, 4));
    }
  }
  return undefined;
}

const quoted = (name: string, lang: 'en' | 'fr') =>
  lang === 'fr' ? `«\u00a0${name}\u00a0»` : `“${name}”`;

/** Whether the periods, merged, cover the whole calendar year. */
function coversYear(periods: { from: string; to: string }[], year: number): boolean {
  const sorted = [...periods].sort((a, b) => a.from.localeCompare(b.from));
  let reached = `${year}-01-01`;
  for (const p of sorted) {
    if (p.from > reached) return false;
    // The next day after p.to is still covered when the next period starts then.
    const next = new Date(`${p.to}T00:00:00Z`);
    next.setUTCDate(next.getUTCDate() + 1);
    const after = next.toISOString().slice(0, 10);
    if (after > reached) reached = after;
    if (reached > `${year}-12-31`) return true;
  }
  return false;
}

/**
 * Where "only payments made in the year count" is written, by tax year (docs/design/tax-years.md):
 * the year's federal instructions, or for 2025 (whose are not in the library) the 2025 guide,
 * "les cotisations ou versements effectués en 2025".
 */
const PAID_IN_YEAR: Readonly<Record<number, string>> = {
  2025: 'ge-2025-guide-declaration-pp p. 18',
  2026: PILLAR3A_2026_FACTS.paidInYearOnly,
};

export function consistencyChecks({ taxYear, documents, facts }: CheckInput): ConsistencyCheck[] {
  const Y = taxYear;
  const value = (key: string, docId: string, person?: Owner) =>
    facts.find(
      (f) => f.key === key && f.instance === docId && (person === undefined || f.person === person),
    )?.value;
  const docFacts = (key: string, docId: string) =>
    facts.filter((f) => f.key === key && f.instance === docId);
  const name = (doc: VaultDocument, lang: 'en' | 'fr') => quoted(doc.filename, lang);
  const checks: ConsistencyCheck[] = [];

  // 1 and 5. A document for another tax year; a pillar 3a attestation for another year.
  for (const doc of documents) {
    if (doc.kind === 'prior_declaration') continue; // last year's declaration, by design
    // Last year's assessment (avis de taxation) too: "Last year, reviewed" reads it, and it is
    // what a new user often has first (docs/design/simple.md).
    if (doc.kind === 'tax_assessment' && doc.taxYear === Y - 1) continue;
    const year = otherYear(doc, Y);
    if (year === undefined) continue;
    if (doc.kind === 'pillar3a_attestation') {
      checks.push({
        id: `pillar3a_year:${doc.id}`,
        rule: 'pillar3a_year',
        documents: [doc.id],
        ...(doc.person ? { person: doc.person } : {}),
        title: {
          en: 'A pillar 3a attestation for another year',
          fr: 'Une attestation 3e pilier A d’une autre année',
        },
        detail: {
          en: `${name(doc, 'en')} is for ${year}. Only payments made in ${Y} count for your ${Y} return.`,
          fr: `${name(doc, 'fr')} concerne ${year}. Seuls les versements faits en ${Y} comptent pour votre déclaration ${Y}.`,
        },
        todo: {
          en: `Ask your bank or insurer for the ${Y} attestation and add it instead. If you keep this one on purpose, say why in a short note.`,
          fr: `Demandez l’attestation ${Y} à votre banque ou assurance et ajoutez-la à la place. Si vous gardez celle-ci exprès, dites pourquoi en une courte remarque.`,
        },
        ...(PAID_IN_YEAR[Y] ? { source: PAID_IN_YEAR[Y] } : {}),
      });
      continue;
    }
    checks.push({
      id: `other_year:${doc.id}`,
      rule: 'other_year',
      documents: [doc.id],
      ...(doc.person ? { person: doc.person } : {}),
      title: { en: 'A document for another year', fr: 'Un document d’une autre année' },
      detail: {
        en: `${name(doc, 'en')} is for ${year}, not ${Y}.`,
        fr: `${name(doc, 'fr')} concerne ${year}, pas ${Y}.`,
      },
      todo: {
        en: `Replace it with the ${Y} version. If you keep it on purpose, say why in a short note.`,
        fr: `Remplacez-le par la version ${Y}. Si vous le gardez exprès, dites pourquoi en une courte remarque.`,
      },
    });
  }

  // 2. A salary certificate that doesn't cover the year, with no reason given.
  const moved = facts.find((f) => f.key === 'profile.moved' && f.person === 'household')?.value;
  const salaryDocs = documents.filter(
    (d) => d.kind === 'salary_certificate' && otherYear(d, Y) === undefined,
  );
  if (!MOVED_DURING_YEAR.has(String(moved))) {
    for (const doc of salaryDocs) {
      if (!doc.periodFrom || !doc.periodTo) continue;
      if (coversYear([{ from: doc.periodFrom, to: doc.periodTo }], Y)) continue;
      // Changed jobs, or had benefits in between: together the documents cover the year.
      const together = documents
        .filter(
          (d) =>
            (d.kind === 'salary_certificate' || d.kind === 'replacement_income_certificate') &&
            d.person === doc.person &&
            d.periodFrom &&
            d.periodTo,
        )
        .map((d) => ({ from: d.periodFrom!, to: d.periodTo! }));
      if (coversYear(together, Y)) continue;
      checks.push({
        id: `salary_period:${doc.id}`,
        rule: 'salary_period',
        documents: [doc.id],
        ...(doc.person ? { person: doc.person } : {}),
        title: {
          en: 'A salary certificate for part of the year',
          fr: 'Un certificat de salaire pour une partie de l’année',
        },
        detail: {
          en: `${name(doc, 'en')} covers ${formatDay(doc.periodFrom, 'en')} to ${formatDay(doc.periodTo, 'en')}, not the whole of ${Y}.`,
          fr: `${name(doc, 'fr')} couvre du ${formatDay(doc.periodFrom, 'fr')} au ${formatDay(doc.periodTo, 'fr')}, pas toute l’année ${Y}.`,
        },
        todo: {
          en: 'If you started or left a job, or had no salary for part of the year, say so in a short note. If not, ask your employer for a certificate for the whole year.',
          fr: 'Si vous avez commencé ou quitté un emploi, ou n’avez pas eu de salaire pendant une partie de l’année, dites-le en une courte remarque. Sinon, demandez à votre employeur un certificat pour toute l’année.',
        },
        source: `${WAGE_GUIDE} p. 8 (Cm 8)`,
      });
    }
  }

  // 3. Benefits already inside a salary certificate (paid through the employer).
  for (const doc of documents) {
    if (doc.kind !== 'replacement_income_certificate' || otherYear(doc, Y) !== undefined) continue;
    for (const amountFact of docFacts('replacement.amount', doc.id)) {
      const amount = amountFact.value;
      if (typeof amount !== 'number' || amount <= 0) continue;
      const person = amountFact.person;
      const paidToEmployer = value('replacement.paid_to_employer', doc.id, person) === true;
      const certs = salaryDocs.filter(
        (s) =>
          s.person === person ||
          facts.some(
            (f) => f.instance === s.id && f.key.startsWith('salary.') && f.person === person,
          ),
      );
      const remark = certs.filter(
        (s) => value('salary.indemnities_included', s.id, person) === true,
      );
      const sameAmount = certs.filter(
        (s) => value('salary.other_benefits', s.id, person) === amount,
      );
      const involved = paidToEmployer ? certs : [...new Set([...remark, ...sameAmount])];
      if (involved.length === 0) continue;
      const first = involved[0]!;
      const why = paidToEmployer
        ? {
            en: 'the attestation says they were paid to your employer',
            fr: 'l’attestation indique qu’elles ont été versées à votre employeur',
          }
        : remark.includes(first)
          ? {
              en: 'its box 15 says benefits paid by your employer are included',
              fr: 'son chiffre 15 indique que des indemnités versées par l’employeur sont comprises',
            }
          : { en: 'its box 7 shows the same amount', fr: 'son chiffre 7 indique le même montant' };
      checks.push({
        id: `replacement_in_salary:${doc.id}:${person}`,
        rule: 'replacement_in_salary',
        documents: [doc.id, ...involved.map((s) => s.id)],
        person,
        title: {
          en: 'Benefits that may already be in your salary',
          fr: 'Des indemnités peut-être déjà comprises dans le salaire',
        },
        detail: {
          en: `${name(doc, 'en')} shows ${formatChf(amount)} of benefits that look already included in ${name(first, 'en')}: ${why.en}.`,
          fr: `${name(doc, 'fr')} indique ${formatChf(amount)} d’indemnités qui semblent déjà comprises dans ${name(first, 'fr')}${'\u00a0'}: ${why.fr}.`,
        },
        todo: {
          en: 'Benefits paid through your employer are part of the salary certificate, so they count once. Compare the two documents. If they are separate amounts, say so in a short note.',
          fr: 'Les indemnités versées par l’employeur font partie du certificat de salaire et ne comptent qu’une fois. Comparez les deux documents. S’il s’agit de montants distincts, dites-le en une courte remarque.',
        },
        source: `${WAGE_GUIDE} p. 9 (Cm 14), p. 13 (Cm 33 to 35), p. 19 (Cm 64)`,
      });
    }
  }

  // 4. Two documents of the same kind, issuer and period, for the same person.
  const samePeriod = (a: VaultDocument, b: VaultDocument) =>
    a.periodFrom || a.periodTo || b.periodFrom || b.periodTo
      ? a.periodFrom === b.periodFrom && a.periodTo === b.periodTo
      : a.taxYear !== undefined && a.taxYear === b.taxYear;
  // Same kind and issuer but a different subject, e.g. the ICC and the IFD bordereaux.
  const differentSubject = (a: VaultDocument, b: VaultDocument) =>
    SUBJECT_KEYS.some((key) => {
      const [x, y] = [value(key, a.id), value(key, b.id)];
      return x !== undefined && y !== undefined && x !== y;
    });
  documents.forEach((a, i) => {
    for (const b of documents.slice(i + 1)) {
      if (!a.kind || a.kind === 'other' || a.kind !== b.kind) continue;
      // This year's declaration downloaded again after a fix: the latest one is checked, by design.
      if (a.kind === 'official_declaration') continue;
      if (a.person !== b.person || !sameIssuer(a.issuer, b.issuer) || !samePeriod(a, b)) continue;
      if (differentSubject(a, b)) continue;
      checks.push({
        id: `duplicate:${a.id}:${b.id}`,
        rule: 'duplicate',
        documents: [a.id, b.id],
        ...(a.person ? { person: a.person } : {}),
        title: { en: 'The same document twice?', fr: 'Le même document deux fois\u00a0?' },
        detail: {
          en: `${name(a, 'en')} and ${name(b, 'en')} are the same kind of document, from ${a.issuer}, for the same period.`,
          fr: `${name(a, 'fr')} et ${name(b, 'fr')} sont le même type de document, de ${a.issuer}, pour la même période.`,
        },
        todo: {
          en: 'If one is a copy, count it once. If they really are two documents, say so in a short note.',
          fr: 'Si l’un est une copie, comptez-le une seule fois. S’il s’agit vraiment de deux documents, dites-le en une courte remarque.',
        },
      });
    }
  });

  // Settled by a note.
  for (const check of checks) {
    const note = facts.find(
      (f) => f.key === 'check.note' && f.instance === check.id && f.person === 'household',
    );
    if (note && typeof note.value === 'string' && note.value.trim()) {
      check.resolved = { note: note.value, at: note.createdAt };
    }
  }
  return checks;
}

/** Check ids are ledger instances: they must fit INSTANCE_PATTERN (64 characters at most). */
export const CHECK_ID_PATTERN = /^[a-z_]+:[A-Za-z0-9_.:-]{1,56}$/;
