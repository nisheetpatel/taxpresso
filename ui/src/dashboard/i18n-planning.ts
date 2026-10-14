// UI strings for the pension fund buy-in, the 3a catch-up and the TOU card (SPEC.md section 8,
// groups B and C). Second person, plain words, official terms next to their gloss (French in
// Geneva, German in Zurich).
import { cantonKey, isMessageKey, type Language, t } from './i18n';

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
    splitZh: 'Zurich {icc} · federal {ifd}',
    lppOfficialZh: 'Einkauf in die Pensionskasse',
    lppAttestationZh:
      'Your fund confirms the payment with a certificate (Bescheinigung): keep it for your return.',
    cuOfficialZh: 'Einkauf in die Säule 3a',
    cuRuleIncomeZh: 'You must have had earned income subject to AHV in 2025.',
    'assume.zh_catchup_rule':
      'No saving for Zurich: no Zurich document Taxpresso has gives the cantonal rule of a 3a catch-up yet. The federal rules above hold.',
    touGenevaOnly:
      'TOU is Geneva’s procedure. For Zurich, Taxpresso doesn’t support taxation at source and its NOV (nachträgliche ordentliche Veranlagung) yet.',
    splitBe: 'Bern {icc} · federal {ifd}',
    lppOfficialBe: 'Einkauf 2. Säule (Pensionskasse)',
    lppAttestationBe:
      'Your fund confirms the payment with a certificate (Bescheinigung): keep it for your return.',
    cuOfficialBe: 'Nachzahlung (Einkauf) in die Säule 3a',
    cuRuleIncomeBe: 'You must have had earned income subject to AHV in 2025.',
    touGenevaOnlyBe:
      'TOU is Geneva’s procedure. For Bern, Taxpresso doesn’t support taxation at source (Quellensteuer) and its NOV (nachträgliche ordentliche Veranlagung) yet.',
    splitBl: 'Basel-Landschaft {icc} · federal {ifd}',
    lppOfficialBl: 'Einkäufe 2. Säule (Pensionskasse)',
    lppAttestationBl:
      'Your fund confirms the payment with a certificate (Bescheinigung): keep it for your return.',
    cuOfficialBl: 'Nachträglicher Einkauf in die Säule 3a',
    cuRuleIncomeBl: 'You must have had earned income subject to AHV in 2025.',
    touGenevaOnlyBl:
      'TOU is Geneva’s procedure. For Basel-Landschaft, Taxpresso doesn’t support taxation at source (Quellensteuer) and its NOV (nachträgliche ordentliche Veranlagung) yet.',
    splitVd: 'Vaud {icc} · federal {ifd}',
    lppOfficialVd: 'Rachats d’années d’assurance (2e pilier)',
    lppAttestationVd:
      'Your fund confirms the payment with an official attestation of the buy-in: keep it for your return.',
    cuOfficialVd: 'rachat dans la prévoyance individuelle liée (3e pilier A)',
    touGenevaOnlyVd:
      'Taxpresso’s TOU comparison follows Geneva’s rules. For Vaud, Taxpresso doesn’t support taxation at source (impôt à la source) and its TOU (taxation ordinaire ultérieure) yet.',
    splitBs: 'Basel-Stadt {icc} · federal {ifd}',
    lppOfficialBs: 'Einkauf in die berufliche Vorsorge (Pensionskasse)',
    lppAttestationBs:
      'Your fund confirms the payment with a certificate (Bescheinigung): keep it for your return.',
    cuOfficialBs: 'zusätzlicher Einkauf in die Säule 3a',
    cuRuleIncomeBs: 'You must have had earned income subject to AHV in 2025.',
    touGenevaOnlyBs:
      'TOU is Geneva’s procedure. For Basel-Stadt, Taxpresso doesn’t support taxation at source (Quellensteuer) and its NOV (nachträgliche ordentliche Veranlagung) yet.',
    splitZg: 'Zug {icc} · federal {ifd}',
    lppOfficialZg: 'Beiträge an die 2. Säule (Einkaufsbeiträge)',
    lppAttestationZg:
      'Your fund confirms the payment with a certificate (Bescheinigung): attach it to your return.',
    cuOfficialZg: 'Nachträglicher Einkauf in die Säule 3a',
    cuRuleIncomeZg: 'You must have had earned income subject to AHV in 2025.',
    touGenevaOnlyZg:
      'TOU is Geneva’s procedure. For Zug, Taxpresso doesn’t support taxation at source (Quellensteuer) and its NOV (nachträgliche ordentliche Veranlagung) yet.',
    splitLu: 'Lucerne {icc} · federal {ifd}',
    lppOfficialLu: 'Beiträge an 2. Säule (Einkauf)',
    lppAttestationLu:
      'Your fund confirms the payment with a certificate (Bescheinigung): attach it to your return with your pension certificate (Vorsorgeausweis).',
    cuOfficialLu: 'Einkauf in die Säule 3a',
    cuRuleIncomeLu: 'You must have had earned income subject to AHV in 2025.',
    'assume.lu_catchup_rule':
      'No saving for Lucerne: no Lucerne document Taxpresso has gives the cantonal rule of a 3a catch-up yet. The federal rules above hold.',
    touGenevaOnlyLu:
      'TOU is Geneva’s procedure. For Lucerne, Taxpresso doesn’t support taxation at source (Quellensteuer) and its NOV (nachträgliche ordentliche Veranlagung) yet.',
    splitSg: 'St. Gallen {icc} · federal {ifd}',
    lppOfficialSg: 'Säule 2 (BVG) inkl. Einkaufsbeiträge',
    lppAttestationSg:
      'Your fund confirms the payment with a certificate (Bescheinigung): attach it to your return.',
    cuOfficialSg: 'Nachträgliche Einkäufe Säule 3a',
    cuRuleIncomeSg: 'You must have had earned income subject to AHV in 2025.',
    touGenevaOnlySg:
      'TOU is Geneva’s procedure. For St. Gallen, Taxpresso doesn’t support taxation at source (Quellensteuer) and its NOV (nachträgliche ordentliche Veranlagung) yet.',
    splitFr: 'Fribourg {icc} · federal {ifd}',
    lppOfficialFr: 'Rachats d’années d’assurance (2e pilier, caisse de pension)',
    lppAttestationFr:
      'Your fund confirms the payment with an attestation that states the most you could buy in: attach it to your return.',
    cuOfficialFr: 'rachat dans le pilier 3a',
    cuRuleIncomeFr: 'You must have had earned income subject to AVS in 2025.',
    touGenevaOnlyFr:
      'TOU is Geneva’s procedure in Taxpresso. For Fribourg, Taxpresso doesn’t support taxation at source (impôt à la source) and its TOU (taxation ordinaire ultérieure) yet.',
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
    splitZh: 'Zurich {icc} · fédéral {ifd}',
    lppOfficialZh: 'Einkauf in die Pensionskasse',
    lppAttestationZh: `Votre caisse confirme le versement par une attestation (Bescheinigung)${NB}: gardez-la pour votre déclaration.`,
    cuOfficialZh: 'Einkauf in die Säule 3a',
    cuRuleIncomeZh: 'Vous devez avoir eu en 2025 un revenu d’activité soumis à l’AVS (AHV).',
    'assume.zh_catchup_rule': `Pas d’économie pour Zurich${NB}: aucun document zurichois dont dispose Taxpresso ne fixe encore la règle cantonale du rattrapage. Les règles fédérales ci-dessus s’appliquent.`,
    touGenevaOnly: `La TOU est une procédure genevoise. Pour Zurich, Taxpresso ne prend pas encore en charge l’imposition à la source ni sa taxation ordinaire ultérieure (NOV, nachträgliche ordentliche Veranlagung).`,
    splitBe: 'Berne {icc} · fédéral {ifd}',
    lppOfficialBe: 'Einkauf 2. Säule (Pensionskasse)',
    lppAttestationBe: `Votre caisse confirme le versement par une attestation (Bescheinigung)${NB}: gardez-la pour votre déclaration.`,
    cuOfficialBe: 'Nachzahlung (Einkauf) in die Säule 3a',
    cuRuleIncomeBe: 'Vous devez avoir eu en 2025 un revenu d’activité soumis à l’AVS (AHV).',
    touGenevaOnlyBe: `La TOU est une procédure genevoise. Pour Berne, Taxpresso ne prend pas encore en charge l’impôt à la source (Quellensteuer) ni sa taxation ordinaire ultérieure (NOV, nachträgliche ordentliche Veranlagung).`,
    splitBl: 'Bâle-Campagne {icc} · fédéral {ifd}',
    lppOfficialBl: 'Einkäufe 2. Säule (Pensionskasse)',
    lppAttestationBl: `Votre caisse confirme le versement par une attestation (Bescheinigung)${NB}: gardez-la pour votre déclaration.`,
    cuOfficialBl: 'Nachträglicher Einkauf in die Säule 3a',
    cuRuleIncomeBl: 'Vous devez avoir eu en 2025 un revenu d’activité soumis à l’AVS (AHV).',
    touGenevaOnlyBl: `La TOU est une procédure genevoise. Pour Bâle-Campagne, Taxpresso ne prend pas encore en charge l’impôt à la source (Quellensteuer) ni sa taxation ordinaire ultérieure (NOV, nachträgliche ordentliche Veranlagung).`,
    splitVd: 'Vaud {icc} · fédéral {ifd}',
    lppOfficialVd: 'Rachats d’années d’assurance (2e pilier)',
    lppAttestationVd: `Votre caisse confirme le versement par une attestation officielle de rachat${NB}: gardez-la pour votre déclaration.`,
    cuOfficialVd: 'rachat dans la prévoyance individuelle liée (3e pilier A)',
    touGenevaOnlyVd: `La comparaison TOU de Taxpresso suit les règles genevoises. Pour Vaud, Taxpresso ne prend pas encore en charge l’impôt à la source ni sa taxation ordinaire ultérieure (TOU).`,
    splitBs: 'Bâle-Ville {icc} · fédéral {ifd}',
    lppOfficialBs: 'Einkauf in die berufliche Vorsorge (Pensionskasse)',
    lppAttestationBs: `Votre caisse confirme le versement par une attestation (Bescheinigung)${NB}: gardez-la pour votre déclaration.`,
    cuOfficialBs: 'zusätzlicher Einkauf in die Säule 3a',
    cuRuleIncomeBs: 'Vous devez avoir eu en 2025 un revenu d’activité soumis à l’AVS (AHV).',
    touGenevaOnlyBs: `La TOU est une procédure genevoise. Pour Bâle-Ville, Taxpresso ne prend pas encore en charge l’impôt à la source (Quellensteuer) ni sa taxation ordinaire ultérieure (NOV, nachträgliche ordentliche Veranlagung).`,
    splitZg: 'Zoug {icc} · fédéral {ifd}',
    lppOfficialZg: 'Beiträge an die 2. Säule (Einkaufsbeiträge)',
    lppAttestationZg: `Votre caisse confirme le versement par une attestation (Bescheinigung)${NB}: joignez-la à votre déclaration.`,
    cuOfficialZg: 'Nachträglicher Einkauf in die Säule 3a',
    cuRuleIncomeZg: 'Vous devez avoir eu en 2025 un revenu d’activité soumis à l’AVS (AHV).',
    touGenevaOnlyZg: `La TOU est une procédure genevoise. Pour Zoug, Taxpresso ne prend pas encore en charge l’impôt à la source (Quellensteuer) ni sa taxation ordinaire ultérieure (NOV, nachträgliche ordentliche Veranlagung).`,
    splitLu: 'Lucerne {icc} · fédéral {ifd}',
    lppOfficialLu: 'Beiträge an 2. Säule (Einkauf)',
    lppAttestationLu: `Votre caisse confirme le versement par une attestation (Bescheinigung)${NB}: joignez-la à votre déclaration avec votre certificat de prévoyance (Vorsorgeausweis).`,
    cuOfficialLu: 'Einkauf in die Säule 3a',
    cuRuleIncomeLu: 'Vous devez avoir eu en 2025 un revenu d’activité soumis à l’AVS (AHV).',
    'assume.lu_catchup_rule': `Pas d’économie pour Lucerne${NB}: aucun document lucernois dont dispose Taxpresso ne fixe encore la règle cantonale du rattrapage. Les règles fédérales ci-dessus s’appliquent.`,
    touGenevaOnlyLu: `La TOU est une procédure genevoise. Pour Lucerne, Taxpresso ne prend pas encore en charge l’impôt à la source (Quellensteuer) ni sa taxation ordinaire ultérieure (NOV, nachträgliche ordentliche Veranlagung).`,
    splitSg: 'Saint-Gall {icc} · fédéral {ifd}',
    lppOfficialSg: 'Säule 2 (BVG) inkl. Einkaufsbeiträge',
    lppAttestationSg: `Votre caisse confirme le versement par une attestation (Bescheinigung)${NB}: joignez-la à votre déclaration.`,
    cuOfficialSg: 'Nachträgliche Einkäufe Säule 3a',
    cuRuleIncomeSg: 'Vous devez avoir eu en 2025 un revenu d’activité soumis à l’AVS (AHV).',
    touGenevaOnlySg: `La TOU est une procédure genevoise. Pour Saint-Gall, Taxpresso ne prend pas encore en charge l’impôt à la source (Quellensteuer) ni sa taxation ordinaire ultérieure (NOV, nachträgliche ordentliche Veranlagung).`,
    splitFr: 'Fribourg {icc} · fédéral {ifd}',
    lppOfficialFr: 'Rachats d’années d’assurance (2e pilier, caisse de pension)',
    lppAttestationFr: `Votre caisse confirme le versement par une attestation qui indique le rachat maximal autorisé${NB}: joignez-la à votre déclaration.`,
    cuOfficialFr: 'rachat dans le pilier 3a',
    cuRuleIncomeFr: 'Vous devez avoir eu en 2025 un revenu d’activité soumis à l’AVS.',
    touGenevaOnlyFr:
      'Dans Taxpresso, la TOU suit la procédure genevoise. Pour Fribourg, Taxpresso ne prend pas encore en charge l’impôt à la source ni sa taxation ordinaire ultérieure (TOU).',
  },
  de: {
    when: 'Vor dem 31. Dezember',
    saving: 'Steuern, die du sparst, etwa',
    split: 'Genf {icc} · Bund {ifd}',
    onlyWithTou:
      'Du bist quellenbesteuert: Das senkt deine Steuern nur mit einer nachträglichen ordentlichen Veranlagung (TOU, taxation ordinaire ultérieure).',
    how: 'So wird es berechnet',
    sources: 'Quellen',
    yes: 'Ja',
    no: 'Nein',
    lppTitle: 'Kauf dich in deine Pensionskasse ein',
    lppOfficial: 'rachat 2e pilier (LPP)',
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
    cuTitle: 'Hol 2025 in deiner Säule 3a nach',
    cuOfficial: 'rachat 3e pilier A',
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
    touWhen: 'Zuerst entscheiden',
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
    'from.certificate': 'aus deinem Lohnausweis',
    'from.stated': 'deine Zahl',
    'from.tariff': 'geschätzt mit Tarif {tariff}',
    touNeedWithheld:
      'Wie viel Steuer wurde dieses Jahr an der Quelle abgezogen? Es steht auf deinen Lohnabrechnungen, dann in Feld 12 deines Lohnausweises.',
    touWithheldLabel: 'An der Quelle abgezogene Steuer für das Jahr',
    touTariffLabel: 'Oder dein Tarif (barème) von einer Lohnabrechnung',
    touTariffNone: 'Wählen',
    touNeedSalary: 'Gib in der Karte zur Säule 3a einen ungefähren Lohn an, um zu vergleichen.',
    touMixed:
      'Nur eine Person von euch ist quellenbesteuert. Taxpresso kann diesen Fall nicht vergleichen: Frag das Steueramt (AFC).',
    touCompulsoryYes: 'Die TOU ist für dich obligatorisch: Melde sie bis {date} an.',
    touCompulsoryCheck:
      'Die TOU könnte für dich obligatorisch sein. Frag das Steueramt (AFC), bevor du entscheidest.',
    touCompulsoryUnknown: 'Zwei Fragen entscheiden, ob die TOU für dich obligatorisch ist:',
    'reason.gross': 'Ein Bruttolohn von {amount} oder mehr im Jahr',
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
    touNeedComparison: 'Du kannst deine Wahl hier festhalten, sobald der Vergleich angezeigt wird.',
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
    lppOfficialZh: 'Einkauf in die Pensionskasse',
    lppAttestationZh:
      'Deine Kasse bestätigt die Zahlung mit einer Bescheinigung: Bewahre sie für deine Steuererklärung auf.',
    cuOfficialZh: 'Einkauf in die Säule 3a',
    cuRuleIncomeZh: 'Du musst 2025 ein AHV-pflichtiges Erwerbseinkommen gehabt haben.',
    'assume.zh_catchup_rule':
      'Keine Ersparnis für Zürich: Kein Zürcher Dokument, das Taxpresso hat, legt die Regel für den Nachkauf in der Staatssteuer schon fest. Die Bundesregeln oben gelten.',
    touGenevaOnly:
      'Die TOU ist ein Genfer Verfahren. Für Zürich unterstützt Taxpresso die Quellensteuer und die nachträgliche ordentliche Veranlagung (NOV) noch nicht.',
    splitBe: 'Bern {icc} · Bund {ifd}',
    lppOfficialBe: 'Einkauf 2. Säule (Pensionskasse)',
    lppAttestationBe:
      'Deine Kasse bestätigt die Zahlung mit einer Bescheinigung: Bewahre sie für deine Steuererklärung auf.',
    cuOfficialBe: 'Nachzahlung (Einkauf) in die Säule 3a',
    cuRuleIncomeBe: 'Du musst 2025 ein AHV-pflichtiges Erwerbseinkommen gehabt haben.',
    touGenevaOnlyBe:
      'Die TOU ist ein Genfer Verfahren. Für Bern unterstützt Taxpresso die Quellensteuer und die nachträgliche ordentliche Veranlagung (NOV) noch nicht.',
    splitBl: 'Basel-Landschaft {icc} · Bund {ifd}',
    lppOfficialBl: 'Einkäufe 2. Säule (Pensionskasse)',
    lppAttestationBl:
      'Deine Kasse bestätigt die Zahlung mit einer Bescheinigung: Bewahre sie für deine Steuererklärung auf.',
    cuOfficialBl: 'Nachträglicher Einkauf in die Säule 3a',
    cuRuleIncomeBl: 'Du musst 2025 ein AHV-pflichtiges Erwerbseinkommen gehabt haben.',
    touGenevaOnlyBl:
      'Die TOU ist ein Genfer Verfahren. Für Basel-Landschaft unterstützt Taxpresso die Quellensteuer und die nachträgliche ordentliche Veranlagung (NOV) noch nicht.',
    splitVd: 'Waadt {icc} · Bund {ifd}',
    lppOfficialVd: 'Rachats d’années d’assurance (2e pilier)',
    lppAttestationVd:
      'Deine Pensionskasse bestätigt die Zahlung mit einer offiziellen Bescheinigung (attestation de rachat): Bewahre sie für deine Steuererklärung auf.',
    cuOfficialVd: 'rachat dans la prévoyance individuelle liée (3e pilier A)',
    touGenevaOnlyVd:
      'Der TOU-Vergleich von Taxpresso folgt den Genfer Regeln. Für die Waadt unterstützt Taxpresso die Quellensteuer (impôt à la source) und ihre nachträgliche ordentliche Veranlagung (TOU, taxation ordinaire ultérieure) noch nicht.',
    splitBs: 'Basel-Stadt {icc} · Bund {ifd}',
    lppOfficialBs: 'Einkauf in die berufliche Vorsorge (Pensionskasse)',
    lppAttestationBs:
      'Deine Kasse bestätigt die Zahlung mit einer Bescheinigung: Bewahre sie für deine Steuererklärung auf.',
    cuOfficialBs: 'zusätzlicher Einkauf in die Säule 3a',
    cuRuleIncomeBs: 'Du musst 2025 ein AHV-pflichtiges Erwerbseinkommen gehabt haben.',
    touGenevaOnlyBs:
      'Die TOU ist ein Genfer Verfahren. Für Basel-Stadt unterstützt Taxpresso die Quellensteuer und die nachträgliche ordentliche Veranlagung (NOV) noch nicht.',
    splitZg: 'Zug {icc} · Bund {ifd}',
    lppOfficialZg: 'Beiträge an die 2. Säule (Einkaufsbeiträge)',
    lppAttestationZg:
      'Deine Kasse bestätigt die Zahlung mit einer Bescheinigung: Leg sie deiner Steuererklärung bei.',
    cuOfficialZg: 'Nachträglicher Einkauf in die Säule 3a',
    cuRuleIncomeZg: 'Du musst 2025 ein AHV-pflichtiges Erwerbseinkommen gehabt haben.',
    touGenevaOnlyZg:
      'Die TOU ist ein Genfer Verfahren. Für Zug unterstützt Taxpresso die Quellensteuer und die nachträgliche ordentliche Veranlagung (NOV) noch nicht.',
    splitLu: 'Luzern {icc} · Bund {ifd}',
    lppOfficialLu: 'Beiträge an 2. Säule (Einkauf)',
    lppAttestationLu:
      'Deine Kasse bestätigt die Zahlung mit einer Bescheinigung: Leg sie mit deinem Vorsorgeausweis deiner Steuererklärung bei.',
    cuOfficialLu: 'Einkauf in die Säule 3a',
    cuRuleIncomeLu: 'Du musst 2025 ein AHV-pflichtiges Erwerbseinkommen gehabt haben.',
    'assume.lu_catchup_rule':
      'Keine Ersparnis für Luzern: Kein Luzerner Dokument, das Taxpresso hat, legt die Regel für den Nachkauf in der Staatssteuer schon fest. Die Bundesregeln oben gelten.',
    touGenevaOnlyLu:
      'Die TOU ist ein Genfer Verfahren. Für Luzern unterstützt Taxpresso die Quellensteuer und die nachträgliche ordentliche Veranlagung (NOV) noch nicht.',
    splitSg: 'St. Gallen {icc} · Bund {ifd}',
    lppOfficialSg: 'Säule 2 (BVG) inkl. Einkaufsbeiträge',
    lppAttestationSg:
      'Deine Kasse bestätigt die Zahlung mit einer Bescheinigung: Leg sie deiner Steuererklärung bei.',
    cuOfficialSg: 'Nachträgliche Einkäufe Säule 3a',
    cuRuleIncomeSg: 'Du musst 2025 ein AHV-pflichtiges Erwerbseinkommen gehabt haben.',
    touGenevaOnlySg:
      'Die TOU ist ein Genfer Verfahren. Für St. Gallen unterstützt Taxpresso die Quellensteuer und die nachträgliche ordentliche Veranlagung (NOV) noch nicht.',
    splitFr: 'Freiburg {icc} · Bund {ifd}',
    lppOfficialFr: 'Rachats d’années d’assurance (2e pilier, caisse de pension)',
    lppAttestationFr:
      'Deine Kasse bestätigt die Zahlung mit einer Bescheinigung, die den höchstmöglichen Einkauf nennt: Leg sie deiner Steuererklärung bei.',
    cuOfficialFr: 'rachat dans le pilier 3a',
    cuRuleIncomeFr: 'Du musst 2025 ein AHV-pflichtiges Erwerbseinkommen gehabt haben.',
    touGenevaOnlyFr:
      'Die TOU folgt in Taxpresso dem Genfer Verfahren. Für Freiburg unterstützt Taxpresso die Quellensteuer (impôt à la source) und die nachträgliche ordentliche Veranlagung (taxation ordinaire ultérieure, TOU) noch nicht.',
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
 * "31 March 2027" or "31 mars 2027": a day (YYYY-MM-DD) as written, or a moment (an ISO timestamp,
 * like when a choice was recorded) on this computer's calendar.
 */
export function day(iso: string, lang: Language): string {
  const isDay = /^\d{4}-\d{2}-\d{2}$/.test(iso);
  return new Intl.DateTimeFormat({ en: 'en-GB', fr: 'fr-CH', de: 'de-CH' }[lang], {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    ...(isDay ? { timeZone: 'UTC' } : {}),
  }).format(new Date(isDay ? `${iso}T00:00:00Z` : iso));
}
