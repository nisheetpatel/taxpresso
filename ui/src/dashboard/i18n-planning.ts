// UI strings for the pension fund buy-in, the 3a catch-up and the TOU card (SPEC.md section 8,
// groups B and C). Second person, plain words, official French terms next to their gloss.
import { isMessageKey, t, type Language } from './i18n';

const NB = String.fromCharCode(0xa0);

const messages = {
  en: {
    when: 'Before 31 December',
    saving: 'Tax you’d save, about',
    split: 'Geneva {icc} · federal {ifd}',
    onlyWithTou:
      'You’re taxed at source: this lowers your tax only with ordinary taxation afterwards (TOU, taxation ordinaire ultérieure).',
    how: 'How it’s worked out',
    sources: 'Sources',
    yes: 'Yes',
    no: 'No',
    lppTitle: 'Buy into your pension fund',
    lppOfficial: 'rachat 2e pilier (LPP)',
    lppLead:
      'An extra payment into your pension fund at work comes off your taxable income, in the year you pay it.',
    lppCapacity: 'What your fund allows',
    lppCapacityHint: 'On your pension certificate (certificat de prévoyance)',
    lppAmount: 'Amount you’re thinking of',
    lppOver: 'More than your fund allows ({cap}): it wouldn’t accept it.',
    lppNoAmount: 'Enter an amount to see the saving',
    lppNoSalary: 'Add a rough salary in the 3a card to see it',
    lppCapacityUnknown: 'Check on your pension certificate how much you can buy in.',
    lppThreeYears:
      'For 3 years after a buy-in, you can’t take that money out as a lump sum, for example at retirement or to buy a home. If you do, the deduction is taken back.',
    lppPaidInYear: 'It counts for {year} only if your fund receives it in {year}.',
    lppHome: 'If you took money out to buy a home, you must pay it back before a buy-in.',
    lppAttestation: 'Your fund confirms the payment on form 21EDP: keep it for your declaration.',
    cuTitle: 'Make up for 2025 in your 3a',
    cuOfficial: 'rachat 3e pilier A',
    cuLead:
      'New in 2026: if you paid less than the maximum into 3a in 2025, you can make up the gap now, on top of this year’s payment.',
    cuPaid2025: 'Paid into 3a in 2025',
    cuPaid2025Hint: 'On your 2025 3a attestation',
    cuUnknown: 'Enter what you paid in 2025 to see if there’s a gap.',
    cuNoGap: 'You paid the 2025 maximum: nothing to make up.',
    cuPossible: 'You can make up {amount}.',
    cuPossibleMax:
      'You can make up to {amount}: without a pension fund, your 2025 limit was 20 % of what you earned in 2025.',
    cuFirst: 'First pay this year’s 3a in full, then the catch-up.',
    cuRuleGaps: 'Only gaps from 2025 on can be made up, at most {cap} in a year.',
    cuRuleIncome: 'You must have had earned income subject to AVS in 2025.',
    cuRuleOnce:
      'One catch-up per missed year, and none once you’ve taken your 3a money for retirement.',
    cuRuleAsk:
      'Ask your 3a bank or insurer in writing: you say which year you’re making up, and how much.',
    touWhen: 'Decide first',
    touTitle: 'Ask to be taxed ordinarily instead of at source?',
    touOfficial: 'taxation ordinaire ultérieure (TOU)',
    touLead:
      'Without it, the tax taken from your salary is final: your 3a, pension fund buy-ins and childcare costs don’t lower it. With it, you fill in a normal declaration and the tax already taken counts towards it.',
    touDeadline: 'Ask by {date}',
    touDeadlinePassed: 'The deadline ({date}) has passed',
    touWithheld: 'Taken at source',
    touOrdinary: 'Ordinary taxation, about',
    touDifference: 'Difference for you',
    touBack: '≈ {amount} back',
    touMore: '≈ {amount} more',
    touSame: 'About the same',
    'from.certificate': 'from your salary certificate',
    'from.stated': 'your figure',
    'from.tariff': 'estimated with tariff {tariff}',
    touNeedWithheld:
      'How much tax was taken at source this year? It’s on your payslips, then in box 12 of your salary certificate.',
    touWithheldLabel: 'Tax taken at source for the year',
    touTariffLabel: 'Or your tariff (barème) from a payslip',
    touTariffNone: 'Choose',
    touNeedSalary: 'Add a rough salary in the 3a card to compare.',
    touMixed:
      'Only one of you is taxed at source. Taxpresso can’t compare this case: ask the tax office (AFC).',
    touCompulsoryYes: 'TOU is compulsory for you: announce it by {date}.',
    touCompulsoryCheck: 'TOU may be compulsory for you. Ask the tax office (AFC) before deciding.',
    touCompulsoryUnknown: 'Two questions decide whether TOU is compulsory for you:',
    'reason.gross': 'A gross salary of {amount} or more in the year',
    'reason.other_income':
      'Other income not taxed at source of {amount} or more in the year: interest, dividends, alimony received, rent…',
    'reason.taxable_wealth':
      'Taxable wealth (fortune imposable) on 31 December: more than {single} for a single person, {couple} for a couple or a single parent, plus {child} per child',
    'reason.previous_tou': 'You were already taxed ordinarily (TOU) before',
    'reason.spouse_without_activity':
      'A spouse without work or benefits: the canton’s web page lists this case, its 2026 directives don’t',
    touIrrevocable:
      'Can’t be undone. Once you send the request, you can’t withdraw it, even if the result is worse. It then applies every year while you’re taxed at source, your spouse included.',
    touUnderstand: 'I understand: once sent, a TOU request can’t be withdrawn.',
    touRequest: 'Yes, I’ll ask for TOU',
    touDecline: 'Not this year',
    touChosenRequest: 'Your choice: ask for TOU ({date}).',
    touChosenDecline:
      'Your choice: no TOU this year ({date}). The tax taken at source stays final.',
    touChange: 'Change my choice',
    touNextRequest:
      'Next: send the DRIS/TOU form from your e-démarches tax space by {date}. Taxpresso doesn’t send it for you.',
    touNextCompulsory:
      'Announce it with the DRIS/TOU form from your e-démarches tax space by {date}.',
    touNeedComparison: 'You can record your choice here once the comparison is shown.',
    'assume.income_tax_only':
      'The ordinary tax here is income tax only (cantonal, communal and federal). Wealth tax isn’t counted: with taxable wealth, TOU is compulsory anyway.',
    'assume.withheld_from_tariff':
      'The tax taken at source is estimated from your tariff and your yearly gross salary. Your salary certificate (box 12) has the real figure.',
    'assume.tariff_c_correction':
      'When both of you work (tariff C), the tax office may correct the tax taken at source using both real incomes.',
    'assume.values_to_confirm': 'Some figures come from documents you haven’t confirmed yet.',
    'assume.ordinary_may_be_lower':
      'The ordinary tax counts only flat deductions for now: not Geneva’s family deductions, health insurance premiums or childcare. Your real ordinary tax is likely lower, so TOU may be better than shown.',
    estimate: 'Estimate',
    'assume.pension_fund_2025_same':
      'We assume you had the same pension fund situation in 2025 as now.',
  },
  fr: {
    when: 'Avant le 31 décembre',
    saving: 'Impôt économisé, environ',
    split: 'Genève {icc} · fédéral {ifd}',
    onlyWithTou: `Vous êtes imposé à la source${NB}: cela ne diminue votre impôt qu’avec une taxation ordinaire ultérieure (TOU).`,
    how: 'Comment c’est calculé',
    sources: 'Sources',
    yes: 'Oui',
    no: 'Non',
    lppTitle: 'Faire un rachat dans votre caisse de pension',
    lppOfficial: 'rachat 2e pilier (LPP)',
    lppLead:
      'Un versement supplémentaire dans votre caisse de pension est déduit de votre revenu imposable, l’année où vous le payez.',
    lppCapacity: 'Rachat possible',
    lppCapacityHint: 'Sur votre certificat de prévoyance',
    lppAmount: 'Montant envisagé',
    lppOver: `Plus que ce que votre caisse accepte ({cap})${NB}: elle le refuserait.`,
    lppNoAmount: 'Indiquez un montant pour voir l’économie',
    lppNoSalary: 'Indiquez un salaire approximatif dans la carte du 3e pilier A pour la voir',
    lppCapacityUnknown: 'Vérifiez sur votre certificat de prévoyance combien vous pouvez racheter.',
    lppThreeYears:
      'Pendant 3 ans après un rachat, vous ne pouvez pas retirer cet argent en capital, par exemple à la retraite ou pour acheter un logement. Sinon, la déduction est reprise.',
    lppPaidInYear: 'Il compte pour {year} seulement si votre caisse le reçoit en {year}.',
    lppHome:
      'Si vous avez retiré de l’argent pour acheter un logement, vous devez le rembourser avant un rachat.',
    lppAttestation: `Votre caisse confirme le versement sur le formulaire 21EDP${NB}: gardez-le pour votre déclaration.`,
    cuTitle: 'Rattraper 2025 dans votre 3e pilier A',
    cuOfficial: 'rachat 3e pilier A',
    cuLead: `Nouveau en 2026${NB}: si vous avez versé moins que le maximum au 3e pilier A en 2025, vous pouvez rattraper la différence maintenant, en plus du versement de cette année.`,
    cuPaid2025: 'Versé au 3e pilier A en 2025',
    cuPaid2025Hint: 'Sur votre attestation 3e pilier A 2025',
    cuUnknown: 'Indiquez ce que vous avez versé en 2025 pour voir s’il y a une lacune.',
    cuNoGap: `Vous avez versé le maximum 2025${NB}: rien à rattraper.`,
    cuPossible: 'Vous pouvez rattraper {amount}.',
    cuPossibleMax: `Vous pouvez rattraper jusqu’à {amount}${NB}: sans caisse de pension, votre limite 2025 était de 20 % de votre revenu du travail 2025.`,
    cuFirst: 'Versez d’abord votre 3e pilier A de cette année en entier, puis le rattrapage.',
    cuRuleGaps: 'Seules les lacunes depuis 2025 se rattrapent, au plus {cap} par année.',
    cuRuleIncome: 'Vous devez avoir eu en 2025 un revenu du travail soumis à l’AVS.',
    cuRuleOnce:
      'Un seul rattrapage par année manquée, et aucun une fois votre 3e pilier A retiré pour la retraite.',
    cuRuleAsk: `Demandez-le par écrit à votre banque ou assurance 3e pilier A${NB}: vous indiquez l’année rattrapée et le montant.`,
    touWhen: 'À décider d’abord',
    touTitle: `Demander une taxation ordinaire au lieu de l’impôt à la source${NB}?`,
    touOfficial: 'taxation ordinaire ultérieure (TOU)',
    touLead: `Sans elle, l’impôt retenu sur votre salaire est définitif${NB}: votre 3e pilier A, vos rachats 2e pilier et vos frais de garde ne le diminuent pas. Avec elle, vous remplissez une déclaration normale et l’impôt déjà retenu est imputé.`,
    touDeadline: 'Demande d’ici au {date}',
    touDeadlinePassed: 'Le délai ({date}) est passé',
    touWithheld: 'Retenu à la source',
    touOrdinary: 'Taxation ordinaire, environ',
    touDifference: 'Différence pour vous',
    touBack: '≈ {amount} remboursés',
    touMore: '≈ {amount} de plus',
    touSame: 'À peu près pareil',
    'from.certificate': 'selon votre certificat de salaire',
    'from.stated': 'votre chiffre',
    'from.tariff': 'estimé avec le barème {tariff}',
    touNeedWithheld: `Combien d’impôt a été retenu à la source cette année${NB}? C’est sur vos fiches de salaire, puis au chiffre 12 de votre certificat de salaire.`,
    touWithheldLabel: 'Impôt retenu à la source pour l’année',
    touTariffLabel: 'Ou votre barème, sur une fiche de salaire',
    touTariffNone: 'Choisir',
    touNeedSalary: 'Indiquez un salaire approximatif dans la carte du 3e pilier A pour comparer.',
    touMixed: `Un seul de vous deux est imposé à la source. Taxpresso ne peut pas comparer ce cas${NB}: demandez à l’administration fiscale (AFC).`,
    touCompulsoryYes: `La TOU est obligatoire pour vous${NB}: annoncez-la d’ici au {date}.`,
    touCompulsoryCheck:
      'La TOU est peut-être obligatoire pour vous. Demandez à l’administration fiscale (AFC) avant de décider.',
    touCompulsoryUnknown: `Deux questions décident si la TOU est obligatoire pour vous${NB}:`,
    'reason.gross': 'Un salaire brut de {amount} ou plus dans l’année',
    'reason.other_income': `D’autres revenus non imposés à la source de {amount} ou plus dans l’année${NB}: intérêts, dividendes, pension alimentaire reçue, loyers…`,
    'reason.taxable_wealth': `Une fortune imposable au 31 décembre${NB}: plus de {single} pour une personne seule, {couple} pour un couple ou une famille monoparentale, plus {child} par enfant`,
    'reason.previous_tou': 'Vous avez déjà été taxé de façon ordinaire (TOU)',
    'reason.spouse_without_activity': `Un conjoint sans travail ni indemnités${NB}: la page du canton cite ce cas, ses directives 2026 non`,
    touIrrevocable:
      'Irréversible. Une fois la demande envoyée, vous ne pouvez plus la retirer, même si le résultat est moins bon. Elle s’applique ensuite chaque année tant que vous êtes imposé à la source, conjoint compris.',
    touUnderstand: `J’ai compris${NB}: une fois envoyée, une demande de TOU ne peut plus être retirée.`,
    touRequest: 'Oui, je demanderai la TOU',
    touDecline: 'Pas cette année',
    touChosenRequest: `Votre choix${NB}: demander la TOU ({date}).`,
    touChosenDecline: `Votre choix${NB}: pas de TOU cette année ({date}). L’impôt retenu à la source reste définitif.`,
    touChange: 'Changer mon choix',
    touNextRequest: `Ensuite${NB}: envoyez le formulaire DRIS/TOU depuis votre espace fiscal e-démarches d’ici au {date}. Taxpresso ne l’envoie pas à votre place.`,
    touNextCompulsory:
      'Annoncez-la avec le formulaire DRIS/TOU depuis votre espace fiscal e-démarches d’ici au {date}.',
    touNeedComparison: 'Vous pourrez enregistrer votre choix ici une fois la comparaison affichée.',
    'assume.income_tax_only': `L’impôt ordinaire est ici l’impôt sur le revenu seul (cantonal, communal et fédéral). L’impôt sur la fortune n’est pas compté${NB}: avec une fortune imposable, la TOU est de toute façon obligatoire.`,
    'assume.withheld_from_tariff':
      'L’impôt retenu à la source est estimé avec votre barème et votre salaire brut annuel. Votre certificat de salaire (chiffre 12) indique le vrai montant.',
    'assume.tariff_c_correction':
      'Quand vous travaillez tous les deux (barème C), l’administration fiscale peut corriger l’impôt retenu selon vos deux revenus réels.',
    'assume.values_to_confirm':
      'Certains chiffres viennent de documents que vous n’avez pas encore confirmés.',
    'assume.ordinary_may_be_lower': `L’impôt ordinaire ne compte pour l’instant que les déductions forfaitaires${NB}: ni les déductions genevoises pour charges de famille, ni les primes d’assurance-maladie, ni les frais de garde. Votre impôt ordinaire réel est sans doute plus bas, donc la TOU peut être plus avantageuse qu’affiché.`,
    estimate: 'Estimation',
    'assume.pension_fund_2025_same':
      'Nous supposons que votre situation de caisse de pension était la même en 2025 qu’aujourd’hui.',
  },
} as const;

export type PlanningMessageKey = keyof (typeof messages)['en'];

export function tp(
  lang: Language,
  key: PlanningMessageKey,
  vars: Record<string, string | number> = {},
): string {
  return messages[lang][key].replace(/\{(\w+)\}/g, (_, name: string) => String(vars[name] ?? ''));
}

/** An assumption in plain words: ours first, then the 3a card's. */
export function assumption(lang: Language, id: string): string {
  const own = `assume.${id}`;
  if (own in messages.en) return tp(lang, own as PlanningMessageKey);
  return isMessageKey(own) ? t(lang, own) : id;
}

/**
 * "31 March 2027" or "31 mars 2027": a day (YYYY-MM-DD) as written, or a moment (an ISO timestamp,
 * like when a choice was recorded) on this computer's calendar.
 */
export function day(iso: string, lang: Language): string {
  const isDay = /^\d{4}-\d{2}-\d{2}$/.test(iso);
  return new Intl.DateTimeFormat(lang === 'fr' ? 'fr-CH' : 'en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    ...(isDay ? { timeZone: 'UTC' } : {}),
  }).format(new Date(isDay ? `${iso}T00:00:00Z` : iso));
}
