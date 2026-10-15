// UI strings for the pension fund buy-in, the 3a catch-up and the TOU card (SPEC.md section 8,
// groups B and C). Second person, plain words, official terms next to their gloss (French in
// Geneva, German in Zurich).
import { cantonKey, isMessageKey, type Language, t } from './i18n';

const NB = String.fromCharCode(0xa0);

export const messages = {
  en: {
    saving: 'Tax you’d save, about',
    split: 'Geneva {icc} · federal {ifd}',
    onlyWithTou:
      'You’re taxed at source: this lowers your tax only with ordinary taxation afterwards (TOU, taxation ordinaire ultérieure).',
    how: 'How it’s worked out',
    sources: 'Sources',
    yes: 'Yes',
    no: 'No',
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
    'from.certificate': 'from your documents',
    'from.stated': 'your figure',
    'from.tariff': 'estimated with tariff {tariff}',
    touNeedWithheld:
      'How much tax was taken at source this year? It’s on your payslips, then in box 12 of your salary certificate.',
    touWithheldLabel: 'Tax taken at source for the year',
    touTariffLabel: 'Or your tariff (barème) from a payslip',
    touTariffNone: 'Choose',
    touNeedSalary: 'Add a rough salary in the 3a card to compare.',
    touMixed:
      'Only one of you is taxed at source: the other isn’t, and has income of their own (for example as an international civil servant). Taxpresso can’t compare TOU for you: ask the tax office (AFC).',
    touCompulsoryYes: 'TOU is compulsory for you: announce it by {date}.',
    touCompulsoryCheck: 'TOU may be compulsory for you. Ask the tax office (AFC) before deciding.',
    touCompulsoryUnknown: 'Two questions decide whether TOU is compulsory for you:',
    'reason.gross':
      'A gross income taxed at source (salary and benefits) of {amount} or more in the year',
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
    touAnswerFirst:
      'Answer these questions first: they decide whether TOU is compulsory for you, or your choice.',
    touBenefitsUnknown:
      'Taxpresso compares once it has the attestation of your benefits: the amount and the tax taken at source.',
    touIncomeNotCounted:
      'A pension is part of your income, and this comparison doesn’t count pensions yet. The tax office (AFC) can tell you which is better.',
    touNeedComparison: 'You can record your choice here once the comparison is shown.',
    touNotKnown: 'Not known yet',
    touWithheldLater:
      'Taxpresso shows the tax taken at source once it knows your salary, from your salary certificate or from what you tell Claude.',
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
    splitZh: 'Zurich {icc} · federal {ifd}',
    lppAttestationZh:
      'Your fund confirms the payment with a certificate (Bescheinigung): keep it for your return.',
    cuRuleIncomeZh: 'You must have had earned income subject to AHV in 2025.',
    'assume.zh_catchup_rule':
      'No saving for Zurich: no Zurich document Taxpresso has gives the cantonal rule of a 3a catch-up yet. The federal rules above hold.',
    touGenevaOnly:
      'TOU is Geneva’s procedure. For Zurich, Taxpresso doesn’t support taxation at source and its NOV (nachträgliche ordentliche Veranlagung) yet.',
    splitBe: 'Bern {icc} · federal {ifd}',
    lppAttestationBe:
      'Your fund confirms the payment with a certificate (Bescheinigung): keep it for your return.',
    cuRuleIncomeBe: 'You must have had earned income subject to AHV in 2025.',
    touGenevaOnlyBe:
      'TOU is Geneva’s procedure. For Bern, Taxpresso doesn’t support taxation at source (Quellensteuer) and its NOV (nachträgliche ordentliche Veranlagung) yet.',
    splitBl: 'Basel-Landschaft {icc} · federal {ifd}',
    lppAttestationBl:
      'Your fund confirms the payment with a certificate (Bescheinigung): keep it for your return.',
    cuRuleIncomeBl: 'You must have had earned income subject to AHV in 2025.',
    touGenevaOnlyBl:
      'TOU is Geneva’s procedure. For Basel-Landschaft, Taxpresso doesn’t support taxation at source (Quellensteuer) and its NOV (nachträgliche ordentliche Veranlagung) yet.',
    splitVd: 'Vaud {icc} · federal {ifd}',
    lppAttestationVd:
      'Your fund confirms the payment with an official attestation of the buy-in: keep it for your return.',
    touGenevaOnlyVd:
      'Taxpresso’s TOU comparison follows Geneva’s rules. For Vaud, Taxpresso doesn’t support taxation at source (impôt à la source) and its TOU (taxation ordinaire ultérieure) yet.',
    splitBs: 'Basel-Stadt {icc} · federal {ifd}',
    lppAttestationBs:
      'Your fund confirms the payment with a certificate (Bescheinigung): keep it for your return.',
    cuRuleIncomeBs: 'You must have had earned income subject to AHV in 2025.',
    touGenevaOnlyBs:
      'TOU is Geneva’s procedure. For Basel-Stadt, Taxpresso doesn’t support taxation at source (Quellensteuer) and its NOV (nachträgliche ordentliche Veranlagung) yet.',
    splitZg: 'Zug {icc} · federal {ifd}',
    lppAttestationZg:
      'Your fund confirms the payment with a certificate (Bescheinigung): attach it to your return.',
    cuRuleIncomeZg: 'You must have had earned income subject to AHV in 2025.',
    touGenevaOnlyZg:
      'TOU is Geneva’s procedure. For Zug, Taxpresso doesn’t support taxation at source (Quellensteuer) and its NOV (nachträgliche ordentliche Veranlagung) yet.',
    splitLu: 'Lucerne {icc} · federal {ifd}',
    lppAttestationLu:
      'Your fund confirms the payment with a certificate (Bescheinigung): attach it to your return with your pension certificate (Vorsorgeausweis).',
    cuRuleIncomeLu: 'You must have had earned income subject to AHV in 2025.',
    'assume.lu_catchup_rule':
      'No saving for Lucerne: no Lucerne document Taxpresso has gives the cantonal rule of a 3a catch-up yet. The federal rules above hold.',
    touGenevaOnlyLu:
      'TOU is Geneva’s procedure. For Lucerne, Taxpresso doesn’t support taxation at source (Quellensteuer) and its NOV (nachträgliche ordentliche Veranlagung) yet.',
    splitSg: 'St. Gallen {icc} · federal {ifd}',
    lppAttestationSg:
      'Your fund confirms the payment with a certificate (Bescheinigung): attach it to your return.',
    cuRuleIncomeSg: 'You must have had earned income subject to AHV in 2025.',
    touGenevaOnlySg:
      'TOU is Geneva’s procedure. For St. Gallen, Taxpresso doesn’t support taxation at source (Quellensteuer) and its NOV (nachträgliche ordentliche Veranlagung) yet.',
    splitFr: 'Fribourg {icc} · federal {ifd}',
    lppAttestationFr:
      'Your fund confirms the payment with an attestation that states the most you could buy in: attach it to your return.',
    cuRuleIncomeFr: 'You must have had earned income subject to AVS in 2025.',
    touGenevaOnlyFr:
      'TOU is Geneva’s procedure in Taxpresso. For Fribourg, Taxpresso doesn’t support taxation at source (impôt à la source) and its TOU (taxation ordinaire ultérieure) yet.',
    splitTi: 'Ticino {icc} · federal {ifd}',
    splitAg: 'Aargau {icc} · federal {ifd}',
    lppAttestationTi:
      'Your fund confirms the payment with an attestation (attestazione): attach it to your return.',
    lppAttestationAg:
      'Your fund confirms the payment with a certificate (Bescheinigung): it goes with your return.',
    cuRuleIncomeTi: 'You must have had earned income subject to AVS in 2025.',
    cuRuleIncomeAg: 'You must have had earned income subject to AHV in 2025.',
    touGenevaOnlyTi:
      'TOU is Geneva’s procedure. For Ticino, Taxpresso doesn’t support taxation at source (imposta alla fonte) and its ordinary assessment afterwards (tassazione ordinaria ulteriore, TOU) yet.',
    touGenevaOnlyAg:
      'TOU is Geneva’s procedure. For Aargau, Taxpresso doesn’t support taxation at source (Quellensteuer) and its NOV (nachträgliche ordentliche Veranlagung) yet.',
  },
  fr: {
    saving: 'Impôt économisé, environ',
    split: 'Genève {icc} · fédéral {ifd}',
    onlyWithTou: `Vous êtes imposé à la source${NB}: cela ne diminue votre impôt qu’avec une taxation ordinaire ultérieure (TOU).`,
    how: 'Comment c’est calculé',
    sources: 'Sources',
    yes: 'Oui',
    no: 'Non',
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
    'from.certificate': 'selon vos documents',
    'from.stated': 'votre chiffre',
    'from.tariff': 'estimé avec le barème {tariff}',
    touNeedWithheld: `Combien d’impôt a été retenu à la source cette année${NB}? C’est sur vos fiches de salaire, puis au chiffre 12 de votre certificat de salaire.`,
    touWithheldLabel: 'Impôt retenu à la source pour l’année',
    touTariffLabel: 'Ou votre barème, sur une fiche de salaire',
    touTariffNone: 'Choisir',
    touNeedSalary: 'Indiquez un salaire approximatif dans la carte du 3e pilier A pour comparer.',
    touMixed: `Un seul de vous deux est imposé à la source${NB}: l’autre ne l’est pas et a ses propres revenus (par exemple comme fonctionnaire international). Taxpresso ne peut pas comparer la TOU pour vous${NB}: demandez à l’administration fiscale (AFC).`,
    touCompulsoryYes: `La TOU est obligatoire pour vous${NB}: annoncez-la d’ici au {date}.`,
    touCompulsoryCheck:
      'La TOU est peut-être obligatoire pour vous. Demandez à l’administration fiscale (AFC) avant de décider.',
    touCompulsoryUnknown: `Deux questions décident si la TOU est obligatoire pour vous${NB}:`,
    'reason.gross':
      'Un revenu brut imposé à la source (salaire et indemnités) de {amount} ou plus dans l’année',
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
    touAnswerFirst: `Répondez d’abord à ces questions${NB}: elles décident si la TOU est obligatoire pour vous ou à votre choix.`,
    touBenefitsUnknown: `Taxpresso compare dès qu’il a l’attestation de vos indemnités${NB}: le montant et l’impôt retenu à la source.`,
    touIncomeNotCounted:
      'Une rente fait partie de vos revenus, et cette comparaison ne compte pas encore les rentes. L’administration fiscale (AFC) peut vous dire ce qui est le plus avantageux.',
    touNeedComparison: 'Vous pourrez enregistrer votre choix ici une fois la comparaison affichée.',
    touNotKnown: 'Pas encore connu',
    touWithheldLater:
      'Taxpresso affiche l’impôt retenu à la source dès qu’il connaît votre salaire, par votre certificat de salaire ou ce que vous dites à Claude.',
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
    splitZh: 'Zurich {icc} · fédéral {ifd}',
    lppAttestationZh: `Votre caisse confirme le versement par une attestation (Bescheinigung)${NB}: gardez-la pour votre déclaration.`,
    cuRuleIncomeZh: 'Vous devez avoir eu en 2025 un revenu d’activité soumis à l’AVS (AHV).',
    'assume.zh_catchup_rule': `Pas d’économie pour Zurich${NB}: aucun document zurichois dont dispose Taxpresso ne fixe encore la règle cantonale du rattrapage. Les règles fédérales ci-dessus s’appliquent.`,
    touGenevaOnly: `La TOU est une procédure genevoise. Pour Zurich, Taxpresso ne prend pas encore en charge l’imposition à la source ni sa taxation ordinaire ultérieure (NOV, nachträgliche ordentliche Veranlagung).`,
    splitBe: 'Berne {icc} · fédéral {ifd}',
    lppAttestationBe: `Votre caisse confirme le versement par une attestation (Bescheinigung)${NB}: gardez-la pour votre déclaration.`,
    cuRuleIncomeBe: 'Vous devez avoir eu en 2025 un revenu d’activité soumis à l’AVS (AHV).',
    touGenevaOnlyBe: `La TOU est une procédure genevoise. Pour Berne, Taxpresso ne prend pas encore en charge l’impôt à la source (Quellensteuer) ni sa taxation ordinaire ultérieure (NOV, nachträgliche ordentliche Veranlagung).`,
    splitBl: 'Bâle-Campagne {icc} · fédéral {ifd}',
    lppAttestationBl: `Votre caisse confirme le versement par une attestation (Bescheinigung)${NB}: gardez-la pour votre déclaration.`,
    cuRuleIncomeBl: 'Vous devez avoir eu en 2025 un revenu d’activité soumis à l’AVS (AHV).',
    touGenevaOnlyBl: `La TOU est une procédure genevoise. Pour Bâle-Campagne, Taxpresso ne prend pas encore en charge l’impôt à la source (Quellensteuer) ni sa taxation ordinaire ultérieure (NOV, nachträgliche ordentliche Veranlagung).`,
    splitVd: 'Vaud {icc} · fédéral {ifd}',
    lppAttestationVd: `Votre caisse confirme le versement par une attestation officielle de rachat${NB}: gardez-la pour votre déclaration.`,
    touGenevaOnlyVd: `La comparaison TOU de Taxpresso suit les règles genevoises. Pour Vaud, Taxpresso ne prend pas encore en charge l’impôt à la source ni sa taxation ordinaire ultérieure (TOU).`,
    splitBs: 'Bâle-Ville {icc} · fédéral {ifd}',
    lppAttestationBs: `Votre caisse confirme le versement par une attestation (Bescheinigung)${NB}: gardez-la pour votre déclaration.`,
    cuRuleIncomeBs: 'Vous devez avoir eu en 2025 un revenu d’activité soumis à l’AVS (AHV).',
    touGenevaOnlyBs: `La TOU est une procédure genevoise. Pour Bâle-Ville, Taxpresso ne prend pas encore en charge l’impôt à la source (Quellensteuer) ni sa taxation ordinaire ultérieure (NOV, nachträgliche ordentliche Veranlagung).`,
    splitZg: 'Zoug {icc} · fédéral {ifd}',
    lppAttestationZg: `Votre caisse confirme le versement par une attestation (Bescheinigung)${NB}: joignez-la à votre déclaration.`,
    cuRuleIncomeZg: 'Vous devez avoir eu en 2025 un revenu d’activité soumis à l’AVS (AHV).',
    touGenevaOnlyZg: `La TOU est une procédure genevoise. Pour Zoug, Taxpresso ne prend pas encore en charge l’impôt à la source (Quellensteuer) ni sa taxation ordinaire ultérieure (NOV, nachträgliche ordentliche Veranlagung).`,
    splitLu: 'Lucerne {icc} · fédéral {ifd}',
    lppAttestationLu: `Votre caisse confirme le versement par une attestation (Bescheinigung)${NB}: joignez-la à votre déclaration avec votre certificat de prévoyance (Vorsorgeausweis).`,
    cuRuleIncomeLu: 'Vous devez avoir eu en 2025 un revenu d’activité soumis à l’AVS (AHV).',
    'assume.lu_catchup_rule': `Pas d’économie pour Lucerne${NB}: aucun document lucernois dont dispose Taxpresso ne fixe encore la règle cantonale du rattrapage. Les règles fédérales ci-dessus s’appliquent.`,
    touGenevaOnlyLu: `La TOU est une procédure genevoise. Pour Lucerne, Taxpresso ne prend pas encore en charge l’impôt à la source (Quellensteuer) ni sa taxation ordinaire ultérieure (NOV, nachträgliche ordentliche Veranlagung).`,
    splitSg: 'Saint-Gall {icc} · fédéral {ifd}',
    lppAttestationSg: `Votre caisse confirme le versement par une attestation (Bescheinigung)${NB}: joignez-la à votre déclaration.`,
    cuRuleIncomeSg: 'Vous devez avoir eu en 2025 un revenu d’activité soumis à l’AVS (AHV).',
    touGenevaOnlySg: `La TOU est une procédure genevoise. Pour Saint-Gall, Taxpresso ne prend pas encore en charge l’impôt à la source (Quellensteuer) ni sa taxation ordinaire ultérieure (NOV, nachträgliche ordentliche Veranlagung).`,
    splitFr: 'Fribourg {icc} · fédéral {ifd}',
    lppAttestationFr: `Votre caisse confirme le versement par une attestation qui indique le rachat maximal autorisé${NB}: joignez-la à votre déclaration.`,
    cuRuleIncomeFr: 'Vous devez avoir eu en 2025 un revenu d’activité soumis à l’AVS.',
    touGenevaOnlyFr:
      'Dans Taxpresso, la TOU suit la procédure genevoise. Pour Fribourg, Taxpresso ne prend pas encore en charge l’impôt à la source ni sa taxation ordinaire ultérieure (TOU).',
    splitTi: 'Tessin {icc} · fédéral {ifd}',
    splitAg: 'Argovie {icc} · fédéral {ifd}',
    lppAttestationTi: `Votre caisse confirme le versement par une attestation (attestazione)${NB}: joignez-la à votre déclaration.`,
    lppAttestationAg: `Votre caisse confirme le versement par une attestation (Bescheinigung)${NB}: joignez-la à votre déclaration.`,
    cuRuleIncomeTi: 'Vous devez avoir eu en 2025 un revenu d’activité soumis à l’AVS.',
    cuRuleIncomeAg: 'Vous devez avoir eu en 2025 un revenu d’activité soumis à l’AVS (AHV).',
    touGenevaOnlyTi:
      'La TOU est une procédure genevoise. Pour le Tessin, Taxpresso ne prend pas encore en charge l’impôt à la source (imposta alla fonte) ni sa taxation ordinaire ultérieure (tassazione ordinaria ulteriore, TOU).',
    touGenevaOnlyAg: `La TOU est une procédure genevoise. Pour Argovie, Taxpresso ne prend pas encore en charge l’impôt à la source (Quellensteuer) ni sa taxation ordinaire ultérieure (NOV, nachträgliche ordentliche Veranlagung).`,
  },
  de: {
    saving: 'Steuern, die du sparst, etwa',
    split: 'Genf {icc} · Bund {ifd}',
    onlyWithTou:
      'Du bist quellenbesteuert: Das senkt deine Steuern nur mit einer nachträglichen ordentlichen Veranlagung (TOU, taxation ordinaire ultérieure).',
    how: 'So wird es berechnet',
    sources: 'Quellen',
    yes: 'Ja',
    no: 'Nein',
    lppLead:
      'Eine zusätzliche Einzahlung in deine Pensionskasse wird von deinem steuerbaren Einkommen abgezogen, im Jahr, in dem du sie zahlst.',
    lppCapacity: 'Was deine Kasse erlaubt',
    lppCapacityHint: 'Auf deinem Vorsorgeausweis',
    lppAmount: 'Betrag, an den du denkst',
    lppOver: 'Mehr, als deine Kasse erlaubt ({cap}): Sie würde es nicht annehmen.',
    lppNoAmount: 'Gib einen Betrag ein, um die Ersparnis zu sehen',
    lppNoSalary: 'Gib in der Karte zur Säule 3a einen ungefähren Lohn an, um es zu sehen',
    lppCapacityUnknown: 'Schau auf deinem Vorsorgeausweis, wie viel du einkaufen kannst.',
    lppThreeYears:
      'Während 3 Jahren nach einem Einkauf kannst du dieses Geld nicht als Kapital beziehen, zum Beispiel bei der Pensionierung oder für ein Eigenheim. Sonst wird der Abzug rückgängig gemacht.',
    lppPaidInYear: 'Es zählt für {year} nur, wenn deine Kasse es im Jahr {year} erhält.',
    lppHome:
      'Wenn du Geld für ein Eigenheim bezogen hast, musst du es vor einem Einkauf zurückzahlen.',
    lppAttestation:
      'Deine Kasse bestätigt die Zahlung auf dem Formular 21EDP: Bewahre es für deine Steuererklärung auf.',
    cuLead:
      'Neu 2026: Wenn du 2025 weniger als das Maximum in die Säule 3a eingezahlt hast, kannst du die Lücke jetzt nachholen, zusätzlich zur Einzahlung dieses Jahres.',
    cuPaid2025: '2025 in die Säule 3a eingezahlt',
    cuPaid2025Hint: 'Auf deiner Bescheinigung Säule 3a 2025',
    cuUnknown: 'Gib ein, was du 2025 eingezahlt hast, um zu sehen, ob es eine Lücke gibt.',
    cuNoGap: 'Du hast 2025 das Maximum eingezahlt: nichts nachzuholen.',
    cuPossible: 'Du kannst {amount} nachholen.',
    cuPossibleMax:
      'Du kannst bis zu {amount} nachholen: Ohne Pensionskasse lag deine Grenze 2025 bei 20 % deines Erwerbseinkommens 2025.',
    cuFirst: 'Zahl zuerst die Säule 3a dieses Jahres voll ein, dann den Nachkauf.',
    cuRuleGaps: 'Nur Lücken ab 2025 können nachgeholt werden, höchstens {cap} pro Jahr.',
    cuRuleIncome: 'Du musst 2025 ein AHV-pflichtiges Erwerbseinkommen gehabt haben.',
    cuRuleOnce:
      'Ein Nachkauf pro verpasstes Jahr, und keiner mehr, sobald du dein 3a-Geld für die Pensionierung bezogen hast.',
    cuRuleAsk:
      'Frag deine 3a-Bank oder -Versicherung schriftlich an: Du gibst an, welches Jahr du nachholst und wie viel.',
    touTitle: 'Ordentlich statt an der Quelle besteuert werden?',
    touOfficial: 'taxation ordinaire ultérieure (TOU)',
    touLead:
      'Ohne sie ist die von deinem Lohn abgezogene Steuer definitiv: Deine Säule 3a, Einkäufe in die Pensionskasse und Kinderbetreuungskosten senken sie nicht. Mit ihr füllst du eine normale Steuererklärung aus, und die schon abgezogene Steuer wird angerechnet.',
    touDeadline: 'Beantragen bis {date}',
    touDeadlinePassed: 'Die Frist ({date}) ist abgelaufen',
    touWithheld: 'An der Quelle abgezogen',
    touOrdinary: 'Ordentliche Besteuerung, etwa',
    touDifference: 'Differenz für dich',
    touBack: '≈ {amount} zurück',
    touMore: '≈ {amount} mehr',
    touSame: 'Etwa gleich',
    'from.certificate': 'aus deinen Unterlagen',
    'from.stated': 'deine Zahl',
    'from.tariff': 'geschätzt mit Tarif {tariff}',
    touNeedWithheld:
      'Wie viel Steuer wurde dieses Jahr an der Quelle abgezogen? Es steht auf deinen Lohnabrechnungen, dann in Feld 12 deines Lohnausweises.',
    touWithheldLabel: 'An der Quelle abgezogene Steuer für das Jahr',
    touTariffLabel: 'Oder dein Tarif (barème) von einer Lohnabrechnung',
    touTariffNone: 'Wählen',
    touNeedSalary: 'Gib in der Karte zur Säule 3a einen ungefähren Lohn an, um zu vergleichen.',
    touMixed:
      'Nur eine oder einer von euch wird an der Quelle besteuert: Die andere Person nicht, und sie hat eigene Einkünfte (zum Beispiel als internationale Beamtin oder internationaler Beamter). Taxpresso kann die TOU für euch nicht vergleichen: Frag die Steuerverwaltung (AFC).',
    touCompulsoryYes: 'Die TOU ist für dich obligatorisch: Melde sie bis {date} an.',
    touCompulsoryCheck:
      'Die TOU könnte für dich obligatorisch sein. Frag das Steueramt (AFC), bevor du entscheidest.',
    touCompulsoryUnknown: 'Zwei Fragen entscheiden, ob die TOU für dich obligatorisch ist:',
    'reason.gross':
      'Ein an der Quelle besteuertes Bruttoeinkommen (Lohn und Taggelder) von {amount} oder mehr im Jahr',
    'reason.other_income':
      'Andere Einkünfte ohne Quellensteuer von {amount} oder mehr im Jahr: Zinsen, Dividenden, erhaltene Unterhaltsbeiträge, Mieten…',
    'reason.taxable_wealth':
      'Steuerbares Vermögen (fortune imposable) am 31. Dezember: mehr als {single} für eine Einzelperson, {couple} für ein Paar oder Alleinerziehende, plus {child} pro Kind',
    'reason.previous_tou': 'Du wurdest schon früher ordentlich besteuert (TOU)',
    'reason.spouse_without_activity':
      'Ein Ehepartner ohne Arbeit oder Leistungen: Die Webseite des Kantons nennt diesen Fall, seine Weisungen 2026 nicht',
    touIrrevocable:
      'Nicht rückgängig zu machen. Sobald du den Antrag abschickst, kannst du ihn nicht zurückziehen, auch wenn das Ergebnis schlechter ist. Er gilt dann jedes Jahr, solange du quellenbesteuert bist, auch für deinen Ehepartner.',
    touUnderstand: 'Ich verstehe: Ein abgeschickter TOU-Antrag kann nicht zurückgezogen werden.',
    touRequest: 'Ja, ich beantrage die TOU',
    touDecline: 'Nicht dieses Jahr',
    touChosenRequest: 'Deine Wahl: TOU beantragen ({date}).',
    touChosenDecline:
      'Deine Wahl: keine TOU dieses Jahr ({date}). Die an der Quelle abgezogene Steuer bleibt definitiv.',
    touChange: 'Meine Wahl ändern',
    touNextRequest:
      'Als Nächstes: Schick das Formular DRIS/TOU bis {date} aus deinem Steuerbereich bei e-démarches. Taxpresso schickt es nicht für dich.',
    touNextCompulsory:
      'Melde sie bis {date} mit dem Formular DRIS/TOU aus deinem Steuerbereich bei e-démarches an.',
    touAnswerFirst:
      'Beantworte zuerst diese Fragen: Sie entscheiden, ob die TOU für dich obligatorisch ist oder deine Wahl.',
    touBenefitsUnknown:
      'Taxpresso vergleicht, sobald die Bescheinigung deiner Taggelder da ist: der Betrag und die abgezogene Quellensteuer.',
    touIncomeNotCounted:
      'Eine Rente gehört zu deinen Einkünften, und dieser Vergleich zählt Renten noch nicht. Die Steuerverwaltung (AFC) kann dir sagen, was günstiger ist.',
    touNeedComparison: 'Du kannst deine Wahl hier festhalten, sobald der Vergleich angezeigt wird.',
    touNotKnown: 'Noch nicht bekannt',
    touWithheldLater:
      'Taxpresso zeigt die Quellensteuer, sobald es deinen Lohn kennt: aus deinem Lohnausweis oder aus dem, was du Claude sagst.',
    'assume.income_tax_only':
      'Die ordentliche Steuer ist hier nur die Einkommenssteuer (Kanton, Gemeinde und Bund). Die Vermögenssteuer ist nicht gezählt: Mit steuerbarem Vermögen ist die TOU ohnehin obligatorisch.',
    'assume.withheld_from_tariff':
      'Die an der Quelle abgezogene Steuer ist aus deinem Tarif und deinem Bruttojahreslohn geschätzt. Dein Lohnausweis (Feld 12) zeigt die genaue Zahl.',
    'assume.tariff_c_correction':
      'Wenn ihr beide arbeitet (Tarif C), kann das Steueramt die Quellensteuer anhand beider tatsächlicher Einkommen korrigieren.',
    'assume.values_to_confirm':
      'Einige Zahlen stammen aus Dokumenten, die du noch nicht bestätigt hast.',
    'assume.ordinary_may_be_lower':
      'Die ordentliche Steuer zählt vorerst nur Pauschalabzüge: keine Genfer Familienabzüge, Krankenkassenprämien oder Kinderbetreuung. Deine tatsächliche ordentliche Steuer ist wohl tiefer, die TOU könnte also besser sein als gezeigt.',
    estimate: 'Schätzung',
    'assume.pension_fund_2025_same':
      'Wir nehmen an, dass deine Situation bei der Pensionskasse 2025 dieselbe war wie heute.',
    splitZh: 'Zürich {icc} · Bund {ifd}',
    lppAttestationZh:
      'Deine Kasse bestätigt die Zahlung mit einer Bescheinigung: Bewahre sie für deine Steuererklärung auf.',
    cuRuleIncomeZh: 'Du musst 2025 ein AHV-pflichtiges Erwerbseinkommen gehabt haben.',
    'assume.zh_catchup_rule':
      'Keine Ersparnis für Zürich: Kein Zürcher Dokument, das Taxpresso hat, legt die Regel für den Nachkauf in der Staatssteuer schon fest. Die Bundesregeln oben gelten.',
    touGenevaOnly:
      'Die TOU ist ein Genfer Verfahren. Für Zürich unterstützt Taxpresso die Quellensteuer und die nachträgliche ordentliche Veranlagung (NOV) noch nicht.',
    splitBe: 'Bern {icc} · Bund {ifd}',
    lppAttestationBe:
      'Deine Kasse bestätigt die Zahlung mit einer Bescheinigung: Bewahre sie für deine Steuererklärung auf.',
    cuRuleIncomeBe: 'Du musst 2025 ein AHV-pflichtiges Erwerbseinkommen gehabt haben.',
    touGenevaOnlyBe:
      'Die TOU ist ein Genfer Verfahren. Für Bern unterstützt Taxpresso die Quellensteuer und die nachträgliche ordentliche Veranlagung (NOV) noch nicht.',
    splitBl: 'Basel-Landschaft {icc} · Bund {ifd}',
    lppAttestationBl:
      'Deine Kasse bestätigt die Zahlung mit einer Bescheinigung: Bewahre sie für deine Steuererklärung auf.',
    cuRuleIncomeBl: 'Du musst 2025 ein AHV-pflichtiges Erwerbseinkommen gehabt haben.',
    touGenevaOnlyBl:
      'Die TOU ist ein Genfer Verfahren. Für Basel-Landschaft unterstützt Taxpresso die Quellensteuer und die nachträgliche ordentliche Veranlagung (NOV) noch nicht.',
    splitVd: 'Waadt {icc} · Bund {ifd}',
    lppAttestationVd:
      'Deine Pensionskasse bestätigt die Zahlung mit einer offiziellen Bescheinigung (attestation de rachat): Bewahre sie für deine Steuererklärung auf.',
    touGenevaOnlyVd:
      'Der TOU-Vergleich von Taxpresso folgt den Genfer Regeln. Für die Waadt unterstützt Taxpresso die Quellensteuer (impôt à la source) und ihre nachträgliche ordentliche Veranlagung (TOU, taxation ordinaire ultérieure) noch nicht.',
    splitBs: 'Basel-Stadt {icc} · Bund {ifd}',
    lppAttestationBs:
      'Deine Kasse bestätigt die Zahlung mit einer Bescheinigung: Bewahre sie für deine Steuererklärung auf.',
    cuRuleIncomeBs: 'Du musst 2025 ein AHV-pflichtiges Erwerbseinkommen gehabt haben.',
    touGenevaOnlyBs:
      'Die TOU ist ein Genfer Verfahren. Für Basel-Stadt unterstützt Taxpresso die Quellensteuer und die nachträgliche ordentliche Veranlagung (NOV) noch nicht.',
    splitZg: 'Zug {icc} · Bund {ifd}',
    lppAttestationZg:
      'Deine Kasse bestätigt die Zahlung mit einer Bescheinigung: Leg sie deiner Steuererklärung bei.',
    cuRuleIncomeZg: 'Du musst 2025 ein AHV-pflichtiges Erwerbseinkommen gehabt haben.',
    touGenevaOnlyZg:
      'Die TOU ist ein Genfer Verfahren. Für Zug unterstützt Taxpresso die Quellensteuer und die nachträgliche ordentliche Veranlagung (NOV) noch nicht.',
    splitLu: 'Luzern {icc} · Bund {ifd}',
    lppAttestationLu:
      'Deine Kasse bestätigt die Zahlung mit einer Bescheinigung: Leg sie mit deinem Vorsorgeausweis deiner Steuererklärung bei.',
    cuRuleIncomeLu: 'Du musst 2025 ein AHV-pflichtiges Erwerbseinkommen gehabt haben.',
    'assume.lu_catchup_rule':
      'Keine Ersparnis für Luzern: Kein Luzerner Dokument, das Taxpresso hat, legt die Regel für den Nachkauf in der Staatssteuer schon fest. Die Bundesregeln oben gelten.',
    touGenevaOnlyLu:
      'Die TOU ist ein Genfer Verfahren. Für Luzern unterstützt Taxpresso die Quellensteuer und die nachträgliche ordentliche Veranlagung (NOV) noch nicht.',
    splitSg: 'St. Gallen {icc} · Bund {ifd}',
    lppAttestationSg:
      'Deine Kasse bestätigt die Zahlung mit einer Bescheinigung: Leg sie deiner Steuererklärung bei.',
    cuRuleIncomeSg: 'Du musst 2025 ein AHV-pflichtiges Erwerbseinkommen gehabt haben.',
    touGenevaOnlySg:
      'Die TOU ist ein Genfer Verfahren. Für St. Gallen unterstützt Taxpresso die Quellensteuer und die nachträgliche ordentliche Veranlagung (NOV) noch nicht.',
    splitFr: 'Freiburg {icc} · Bund {ifd}',
    lppAttestationFr:
      'Deine Kasse bestätigt die Zahlung mit einer Bescheinigung, die den höchstmöglichen Einkauf nennt: Leg sie deiner Steuererklärung bei.',
    cuRuleIncomeFr: 'Du musst 2025 ein AHV-pflichtiges Erwerbseinkommen gehabt haben.',
    touGenevaOnlyFr:
      'Die TOU folgt in Taxpresso dem Genfer Verfahren. Für Freiburg unterstützt Taxpresso die Quellensteuer (impôt à la source) und die nachträgliche ordentliche Veranlagung (taxation ordinaire ultérieure, TOU) noch nicht.',
    splitTi: 'Tessin {icc} · Bund {ifd}',
    splitAg: 'Aargau {icc} · Bund {ifd}',
    lppAttestationTi:
      'Deine Kasse bestätigt die Zahlung mit einer Bescheinigung (attestazione): Leg sie deiner Steuererklärung bei.',
    lppAttestationAg:
      'Deine Kasse bestätigt die Zahlung mit einer Bescheinigung: Sie gehört zu deiner Steuererklärung.',
    cuRuleIncomeTi: 'Du musst 2025 ein AHV-pflichtiges Erwerbseinkommen gehabt haben.',
    cuRuleIncomeAg: 'Du musst 2025 ein AHV-pflichtiges Erwerbseinkommen gehabt haben.',
    touGenevaOnlyTi:
      'Die TOU ist ein Genfer Verfahren. Für das Tessin unterstützt Taxpresso die Quellensteuer (imposta alla fonte) und die nachträgliche ordentliche Veranlagung (tassazione ordinaria ulteriore, TOU) noch nicht.',
    touGenevaOnlyAg:
      'Die TOU ist ein Genfer Verfahren. Für Aargau unterstützt Taxpresso die Quellensteuer und die nachträgliche ordentliche Veranlagung (NOV) noch nicht.',
  },
  it: {
    saving: 'Imposte che risparmieresti, circa',
    split: 'Ginevra {icc} · federale {ifd}',
    onlyWithTou:
      'Paghi l’imposta alla fonte: questo riduce le tue imposte solo con una tassazione ordinaria ulteriore (TOU, taxation ordinaire ultérieure).',
    how: 'Come viene calcolato',
    sources: 'Fonti',
    yes: 'Sì',
    no: 'No',
    lppLead:
      'Un versamento in più nella cassa pensione del tuo lavoro si deduce dal tuo reddito imponibile, nell’anno in cui lo fai.',
    lppCapacity: 'Quanto ti permette la tua cassa',
    lppCapacityHint: 'Sul tuo certificato di previdenza (certificat de prévoyance)',
    lppAmount: 'Importo a cui pensi',
    lppOver: 'Più di quanto permette la tua cassa ({cap}): non lo accetterebbe.',
    lppNoAmount: 'Inserisci un importo per vedere il risparmio',
    lppNoSalary: 'Inserisci un salario approssimativo nella scheda del pilastro 3a per vederlo',
    lppCapacityUnknown: 'Controlla sul tuo certificato di previdenza quanto puoi riscattare.',
    lppThreeYears:
      'Per 3 anni dopo un riscatto, non puoi prelevare quei soldi sotto forma di capitale, per esempio al pensionamento o per comprare un’abitazione. Se lo fai, la deduzione viene annullata.',
    lppPaidInYear: 'Conta per il {year} solo se la tua cassa lo riceve nel {year}.',
    lppHome:
      'Se hai prelevato dei soldi per comprare un’abitazione, devi rimborsarli prima di un riscatto.',
    lppAttestation:
      'La tua cassa conferma il versamento sul modulo 21EDP: conservalo per la tua dichiarazione.',
    cuLead:
      'Novità 2026: se nel 2025 hai versato nel pilastro 3a meno del massimo, ora puoi colmare la lacuna, in aggiunta al versamento di quest’anno.',
    cuPaid2025: 'Versato nel pilastro 3a nel 2025',
    cuPaid2025Hint: 'Sulla tua attestazione del pilastro 3a 2025',
    cuUnknown: 'Inserisci quanto hai versato nel 2025 per vedere se c’è una lacuna.',
    cuNoGap: 'Nel 2025 hai versato il massimo: niente da recuperare.',
    cuPossible: 'Puoi recuperare {amount}.',
    cuPossibleMax:
      'Puoi recuperare fino a {amount}: senza cassa pensione, il tuo limite 2025 era il 20 % del tuo reddito da lavoro 2025.',
    cuFirst: 'Prima versa per intero il pilastro 3a di quest’anno, poi il riscatto.',
    cuRuleGaps: 'Si possono recuperare solo le lacune dal 2025 in poi, al massimo {cap} all’anno.',
    cuRuleIncome: 'Nel 2025 devi aver avuto un reddito da lavoro soggetto all’AVS.',
    cuRuleOnce:
      'Un solo riscatto per ogni anno mancato, e nessuno dopo che hai prelevato i soldi del tuo pilastro 3a per il pensionamento.',
    cuRuleAsk:
      'Chiedilo per iscritto alla tua banca o assicurazione del pilastro 3a: indichi quale anno recuperi e quanto.',
    touTitle: 'Chiedere una tassazione ordinaria invece dell’imposta alla fonte?',
    touOfficial: 'taxation ordinaire ultérieure (TOU)',
    touLead:
      'Senza la TOU, l’imposta trattenuta dal tuo salario è definitiva: il pilastro 3a, i riscatti nella cassa pensione e le spese di custodia dei figli non la riducono. Con la TOU, compili una dichiarazione normale e l’imposta già trattenuta viene conteggiata.',
    touDeadline: 'Da chiedere entro il {date}',
    touDeadlinePassed: 'Il termine ({date}) è scaduto',
    touWithheld: 'Trattenuto alla fonte',
    touOrdinary: 'Tassazione ordinaria, circa',
    touDifference: 'Differenza per te',
    touBack: '≈ {amount} rimborsati',
    touMore: '≈ {amount} in più',
    touSame: 'Più o meno uguale',
    'from.certificate': 'dai tuoi documenti',
    'from.stated': 'la tua cifra',
    'from.tariff': 'stimato con la tariffa {tariff}',
    touNeedWithheld:
      'Quanta imposta ti è stata trattenuta alla fonte quest’anno? La trovi sulle tue buste paga, poi alla cifra 12 del tuo certificato di salario.',
    touWithheldLabel: 'Imposta trattenuta alla fonte per l’anno',
    touTariffLabel: 'Oppure la tua tariffa (barème), da una busta paga',
    touTariffNone: 'Scegli',
    touNeedSalary:
      'Inserisci un salario approssimativo nella scheda del pilastro 3a per fare il confronto.',
    touMixed:
      'Solo uno di voi paga l’imposta alla fonte: l’altro no, e ha redditi propri (per esempio come funzionario internazionale). Taxpresso non può confrontare la TOU per voi: chiedi all’amministrazione fiscale (AFC).',
    touCompulsoryYes: 'Per te la TOU è obbligatoria: annunciala entro il {date}.',
    touCompulsoryCheck:
      'Per te la TOU potrebbe essere obbligatoria. Chiedi all’amministrazione fiscale (AFC) prima di decidere.',
    touCompulsoryUnknown: 'Due domande decidono se per te la TOU è obbligatoria:',
    'reason.gross':
      'Un reddito lordo tassato alla fonte (salario e indennità) di {amount} o più nell’anno',
    'reason.other_income':
      'Altri redditi non soggetti all’imposta alla fonte di {amount} o più nell’anno: interessi, dividendi, alimenti ricevuti, affitti…',
    'reason.taxable_wealth':
      'Sostanza imponibile (fortune imposable) al 31 dicembre: più di {single} per una persona sola, {couple} per una coppia o una famiglia monoparentale, più {child} per figlio',
    'reason.previous_tou': 'Hai già avuto una tassazione ordinaria (TOU) in passato',
    'reason.spouse_without_activity':
      'Un coniuge senza lavoro né prestazioni: la pagina web del Cantone cita questo caso, le sue direttive 2026 no',
    touIrrevocable:
      'Non si può annullare. Una volta inviata la richiesta, non puoi più ritirarla, anche se il risultato è peggiore. Vale poi ogni anno finché paghi l’imposta alla fonte, anche per il tuo coniuge.',
    touUnderstand: 'Ho capito: una volta inviata, una richiesta di TOU non si può ritirare.',
    touRequest: 'Sì, chiederò la TOU',
    touDecline: 'Non quest’anno',
    touChosenRequest: 'La tua scelta: chiedere la TOU ({date}).',
    touChosenDecline:
      'La tua scelta: niente TOU quest’anno ({date}). L’imposta trattenuta alla fonte resta definitiva.',
    touChange: 'Cambia la mia scelta',
    touNextRequest:
      'Poi: invia il modulo DRIS/TOU dal tuo spazio fiscale e-démarches entro il {date}. Taxpresso non lo invia al posto tuo.',
    touNextCompulsory:
      'Annunciala con il modulo DRIS/TOU dal tuo spazio fiscale e-démarches entro il {date}.',
    touAnswerFirst:
      'Rispondi prima a queste domande: decidono se la TOU è obbligatoria per te o a tua scelta.',
    touBenefitsUnknown:
      'Taxpresso confronta appena ha l’attestazione delle tue indennità: l’importo e l’imposta trattenuta alla fonte.',
    touIncomeNotCounted:
      'Una rendita fa parte dei tuoi redditi, e questo confronto non conta ancora le rendite. L’amministrazione fiscale (AFC) può dirti cosa conviene.',
    touNeedComparison: 'Potrai registrare qui la tua scelta quando sarà visibile il confronto.',
    touNotKnown: 'Non ancora noto',
    touWithheldLater:
      'Taxpresso mostra l’imposta trattenuta alla fonte quando conosce il tuo salario, dal tuo certificato di salario o da quello che dici a Claude.',
    'assume.income_tax_only':
      'Qui l’imposta ordinaria è solo l’imposta sul reddito (cantonale, comunale e federale). L’imposta sulla sostanza non è conteggiata: con una sostanza imponibile, la TOU è comunque obbligatoria.',
    'assume.withheld_from_tariff':
      'L’imposta trattenuta alla fonte è stimata in base alla tua tariffa e al tuo salario lordo annuo. Il tuo certificato di salario (cifra 12) indica l’importo reale.',
    'assume.tariff_c_correction':
      'Quando entrambi i coniugi lavorano (tariffa C), l’amministrazione fiscale può correggere l’imposta trattenuta alla fonte in base ai due redditi reali.',
    'assume.values_to_confirm': 'Alcune cifre vengono da documenti che non hai ancora confermato.',
    'assume.ordinary_may_be_lower':
      'Per ora l’imposta ordinaria tiene conto solo delle deduzioni forfettarie: non delle deduzioni ginevrine per la famiglia, dei premi dell’assicurazione malattia o delle spese di custodia dei figli. La tua imposta ordinaria reale è probabilmente più bassa, quindi la TOU potrebbe convenirti più di quanto mostrato.',
    estimate: 'Stima',
    'assume.pension_fund_2025_same':
      'Supponiamo che nel 2025 la tua situazione con la cassa pensione fosse la stessa di oggi.',
    splitZh: 'Zurigo {icc} · federale {ifd}',
    lppAttestationZh:
      'La tua cassa conferma il versamento con un’attestazione (Bescheinigung): conservala per la tua dichiarazione.',
    cuRuleIncomeZh: 'Nel 2025 devi aver avuto un reddito da lavoro soggetto all’AVS (AHV).',
    'assume.zh_catchup_rule':
      'Nessun risparmio per Zurigo: nessun documento zurighese di cui dispone Taxpresso fissa ancora la regola cantonale del riscatto nel pilastro 3a. Valgono le regole federali qui sopra.',
    touGenevaOnly:
      'La TOU è una procedura ginevrina. Per Zurigo, Taxpresso non supporta ancora l’imposta alla fonte né la relativa tassazione ordinaria ulteriore (NOV, nachträgliche ordentliche Veranlagung).',
    splitBe: 'Berna {icc} · federale {ifd}',
    lppAttestationBe:
      'La tua cassa conferma il versamento con un’attestazione (Bescheinigung): conservala per la tua dichiarazione.',
    cuRuleIncomeBe: 'Nel 2025 devi aver avuto un reddito da lavoro soggetto all’AVS (AHV).',
    touGenevaOnlyBe:
      'La TOU è una procedura ginevrina. Per Berna, Taxpresso non supporta ancora l’imposta alla fonte (Quellensteuer) né la relativa tassazione ordinaria ulteriore (NOV, nachträgliche ordentliche Veranlagung).',
    splitBl: 'Basilea Campagna {icc} · federale {ifd}',
    lppAttestationBl:
      'La tua cassa conferma il versamento con un’attestazione (Bescheinigung): conservala per la tua dichiarazione.',
    cuRuleIncomeBl: 'Nel 2025 devi aver avuto un reddito da lavoro soggetto all’AVS (AHV).',
    touGenevaOnlyBl:
      'La TOU è una procedura ginevrina. Per Basilea Campagna, Taxpresso non supporta ancora l’imposta alla fonte (Quellensteuer) né la relativa tassazione ordinaria ulteriore (NOV, nachträgliche ordentliche Veranlagung).',
    splitVd: 'Vaud {icc} · federale {ifd}',
    lppAttestationVd:
      'La tua cassa conferma il versamento con un’attestazione ufficiale del riscatto: conservala per la tua dichiarazione.',
    touGenevaOnlyVd:
      'Il confronto TOU di Taxpresso segue le regole ginevrine. Per Vaud, Taxpresso non supporta ancora l’imposta alla fonte (impôt à la source) né la relativa TOU (taxation ordinaire ultérieure).',
    splitBs: 'Basilea Città {icc} · federale {ifd}',
    lppAttestationBs:
      'La tua cassa conferma il versamento con un’attestazione (Bescheinigung): conservala per la tua dichiarazione.',
    cuRuleIncomeBs: 'Nel 2025 devi aver avuto un reddito da lavoro soggetto all’AVS (AHV).',
    touGenevaOnlyBs:
      'La TOU è una procedura ginevrina. Per Basilea Città, Taxpresso non supporta ancora l’imposta alla fonte (Quellensteuer) né la relativa tassazione ordinaria ulteriore (NOV, nachträgliche ordentliche Veranlagung).',
    splitZg: 'Zugo {icc} · federale {ifd}',
    lppAttestationZg:
      'La tua cassa conferma il versamento con un’attestazione (Bescheinigung): allegala alla tua dichiarazione.',
    cuRuleIncomeZg: 'Nel 2025 devi aver avuto un reddito da lavoro soggetto all’AVS (AHV).',
    touGenevaOnlyZg:
      'La TOU è una procedura ginevrina. Per Zugo, Taxpresso non supporta ancora l’imposta alla fonte (Quellensteuer) né la relativa tassazione ordinaria ulteriore (NOV, nachträgliche ordentliche Veranlagung).',
    splitLu: 'Lucerna {icc} · federale {ifd}',
    lppAttestationLu:
      'La tua cassa conferma il versamento con un’attestazione (Bescheinigung): allegala alla tua dichiarazione insieme al tuo certificato di previdenza (Vorsorgeausweis).',
    cuRuleIncomeLu: 'Nel 2025 devi aver avuto un reddito da lavoro soggetto all’AVS (AHV).',
    'assume.lu_catchup_rule':
      'Nessun risparmio per Lucerna: nessun documento lucernese di cui dispone Taxpresso fissa ancora la regola cantonale del riscatto nel pilastro 3a. Valgono le regole federali qui sopra.',
    touGenevaOnlyLu:
      'La TOU è una procedura ginevrina. Per Lucerna, Taxpresso non supporta ancora l’imposta alla fonte (Quellensteuer) né la relativa tassazione ordinaria ulteriore (NOV, nachträgliche ordentliche Veranlagung).',
    splitSg: 'San Gallo {icc} · federale {ifd}',
    lppAttestationSg:
      'La tua cassa conferma il versamento con un’attestazione (Bescheinigung): allegala alla tua dichiarazione.',
    cuRuleIncomeSg: 'Nel 2025 devi aver avuto un reddito da lavoro soggetto all’AVS (AHV).',
    touGenevaOnlySg:
      'La TOU è una procedura ginevrina. Per San Gallo, Taxpresso non supporta ancora l’imposta alla fonte (Quellensteuer) né la relativa tassazione ordinaria ulteriore (NOV, nachträgliche ordentliche Veranlagung).',
    splitFr: 'Friburgo {icc} · federale {ifd}',
    lppAttestationFr:
      'La tua cassa conferma il versamento con un’attestazione che indica il riscatto massimo possibile: allegala alla tua dichiarazione.',
    cuRuleIncomeFr: 'Nel 2025 devi aver avuto un reddito da lavoro soggetto all’AVS.',
    touGenevaOnlyFr:
      'In Taxpresso la TOU segue la procedura ginevrina. Per Friburgo, Taxpresso non supporta ancora l’imposta alla fonte (impôt à la source) né la relativa tassazione ordinaria ulteriore (TOU, taxation ordinaire ultérieure).',
    splitTi: 'Ticino {icc} · federale {ifd}',
    splitAg: 'Argovia {icc} · federale {ifd}',
    lppAttestationTi:
      'La tua cassa conferma il versamento con un’attestazione: allegala alla tua dichiarazione.',
    lppAttestationAg:
      'La tua cassa conferma il versamento con un’attestazione (Bescheinigung): allegala alla tua dichiarazione.',
    cuRuleIncomeTi: 'Nel 2025 devi aver avuto un reddito da attività lucrativa soggetto all’AVS.',
    cuRuleIncomeAg: 'Nel 2025 devi aver avuto un reddito da lavoro soggetto all’AVS (AHV).',
    touGenevaOnlyTi:
      'La TOU è una procedura ginevrina. Per il Ticino, Taxpresso non supporta ancora l’imposta alla fonte né la tassazione ordinaria ulteriore (TOU) che la segue.',
    touGenevaOnlyAg:
      'La TOU è una procedura ginevrina. Per Argovia, Taxpresso non supporta ancora l’imposta alla fonte (Quellensteuer) né la relativa tassazione ordinaria ulteriore (NOV, nachträgliche ordentliche Veranlagung).',
  },
} as const;

export type PlanningMessageKey = keyof (typeof messages)['en'];

/** The key of a canton's own text, else Geneva's (./i18n.ts, cantonKey). */
export const pck = (key: PlanningMessageKey, canton: string | undefined): PlanningMessageKey =>
  cantonKey(messages.en, key, canton);

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
 * The assumptions that have words, each once: an id with no text is left out rather than shown as
 * a code, and an empty one never makes an empty bullet.
 */
export function assumptionList(lang: Language, ids: readonly string[]): string[] {
  const out: string[] = [];
  for (const id of ids) {
    const own = `assume.${id}`;
    const text =
      own in messages.en
        ? tp(lang, own as PlanningMessageKey)
        : isMessageKey(own)
          ? t(lang, own)
          : '';
    if (text.trim() && !out.includes(text)) out.push(text);
  }
  return out;
}

/**
 * "31 March 2027" or "31 mars 2027": a day (YYYY-MM-DD) as written, or a moment (an ISO timestamp,
 * like when a choice was recorded) on this computer's calendar.
 */
export function day(iso: string, lang: Language): string {
  const isDay = /^\d{4}-\d{2}-\d{2}$/.test(iso);
  return new Intl.DateTimeFormat({ en: 'en-GB', fr: 'fr-CH', de: 'de-CH', it: 'it-CH' }[lang], {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    ...(isDay ? { timeZone: 'UTC' } : {}),
  }).format(new Date(isDay ? `${iso}T00:00:00Z` : iso));
}
