// Plain-words texts the engine attaches to a result (SPEC.md section 11b: second person, plain
// words, the official term next to its gloss; Ticino's official terms are Italian), so Claude can
// explain without stating rules from memory. In English, French and Italian (informal "tu"): the
// dashboard shows a Ticino result in Italian on an Italian page.
import type { Text } from './types.js';

const NB = '\u00a0';

/** Why a figure can be an estimate. No Ticino constant is one: only amounts given as estimates. */
export const ESTIMATE_TEXT: Record<'input-estimate', Text> = {
  'input-estimate': {
    en: 'Some amounts you gave are estimates, so the taxes that rest on them are estimates too.',
    fr: `Certains montants indiqués sont des estimations${NB}: les impôts qui en dépendent le sont aussi.`,
    it: 'Alcuni importi che hai indicato sono stime: anche le imposte che ne dipendono lo sono.',
  },
};

export const NOTE = {
  // Rules applied whose detail the documents don't spell out (unverifiedRules).
  tariffLine: {
    en: 'Tariff: the tax law gives the tax at the top of each income band and the rate of each band (LT art. 35). Between two of those amounts Taxpresso draws a straight line, to 5 centimes. The canton’s own 2025 table (Istruzioni p. 51) differs from it by 5 to 50 centimes at some incomes, because the canton’s method between those amounts is not published.',
    fr: `Barème${NB}: la loi fiscale donne l’impôt au sommet de chaque tranche de revenu et le taux de chaque tranche (LT art. 35). Entre deux de ces montants, Taxpresso trace une droite, à 5 centimes près. Le tableau 2025 du canton (Istruzioni p. 51) en diffère de 5 à 50 centimes pour certains revenus, car la méthode du canton entre ces montants n’est pas publiée.`,
    it: 'Tariffa: la legge tributaria indica l’imposta al limite superiore di ogni categoria di reddito e l’aliquota di ogni categoria (LT art. 35). Tra due di questi importi Taxpresso traccia una retta, ai 5 centesimi. La tabella 2025 del Cantone (Istruzioni p. 51) se ne scosta da 5 a 50 centesimi per alcuni redditi, perché il metodo del Cantone tra questi importi non è pubblicato.',
  },
  rounding: {
    en: 'Rounding: the documents don’t say how the 5 % threshold for illness costs, the 20 % cap on donations and the communal tax are rounded. Taxpresso rounds the shares of income to the franc and the communal tax to 5 centimes, so a bill can differ by a few centimes.',
    fr: `Arrondis${NB}: les documents ne disent pas comment arrondir le seuil de 5${NB}% des frais de maladie, le plafond de 20${NB}% des dons et l’impôt communal. Taxpresso arrondit les parts du revenu au franc et l’impôt communal à 5 centimes${NB}: un bordereau peut différer de quelques centimes.`,
    it: 'Arrotondamenti: i documenti non dicono come arrotondare la franchigia del 5% delle spese di malattia, il limite del 20% delle liberalità e l’imposta comunale. Taxpresso arrotonda le quote di reddito al franco e l’imposta comunale ai 5 centesimi: un conteggio può differire di qualche centesimo.',
  },
  sharedTariff: {
    en: 'A child in shared custody without child support lives with you and you provide for it, so Taxpresso applies the family tariff (LT art. 35 cpv. 2) to you. The documents don’t address shared custody for the tariff in so many words.',
    fr: `Un enfant en garde partagée sans contribution d’entretien vit avec vous et vous pourvoyez à son entretien${NB}: Taxpresso vous applique donc le barème familial (LT art. 35 cpv. 2). Les documents ne traitent pas expressément la garde partagée pour le barème.`,
    it: 'Un figlio in custodia alternata senza alimenti vive con te e provvedi al suo mantenimento: Taxpresso ti applica quindi la tariffa per famiglie (LT art. 35 cpv. 2). I documenti non trattano esplicitamente la custodia alternata per la tariffa.',
  },
  sharedInsurance: {
    en: 'For a child in shared custody without child support, the law halves the child deduction (LT art. 34 cpv. 1 lett. a) but says nothing of halving the CHF 1,200 added to the insurance cap (art. 32 cpv. 1bis): Taxpresso adds it in full.',
    fr: `Pour un enfant en garde partagée sans contribution d’entretien, la loi partage par moitié la déduction pour enfant (LT art. 34 cpv. 1 lett. a), mais ne dit rien d’un partage des CHF 1’200 ajoutés au plafond des assurances (art. 32 cpv. 1bis)${NB}: Taxpresso les ajoute en entier.`,
    it: 'Per un figlio in custodia alternata senza alimenti, la legge divide a metà la deduzione per figli (LT art. 34 cpv. 1 lett. a), ma non dice nulla di una divisione dei CHF 1’200 aggiunti al limite degli oneri assicurativi (art. 32 cpv. 1bis): Taxpresso li aggiunge per intero.',
  },
  // What the engine was told to assume (assumptions).
  adults: {
    en: 'Each of you is 18 or older, so each pays the communal personal tax (imposta personale, CHF 40).',
    fr: `Chacun de vous a 18 ans ou plus et paie donc l’impôt personnel communal (imposta personale, CHF 40).`,
    it: 'Ogni persona tassata ha 18 anni o più e paga quindi l’imposta personale comunale (CHF 40).',
  },
  fullYear: {
    en: 'You worked the whole year: the flat amounts for professional costs are for a full year, and in proportion for part of it (Modulo 4, cifra 1).',
    fr: `Vous avez travaillé toute l’année${NB}: les forfaits des frais professionnels valent pour une année entière, et au prorata pour une partie (Modulo 4, cifra 1).`,
    it: 'Hai lavorato tutto l’anno: gli importi forfettari delle spese professionali valgono per un anno intero, e in proporzione per una parte dell’anno (Modulo 4, cifra 1).',
  },
  canteen: {
    en: 'Your certificate shows a canteen or meal vouchers (box G): meals count at half the rate (CHF 7.50 a day, at most CHF 1,600).',
    fr: `Votre certificat indique une cantine ou des bons de repas (case G)${NB}: les repas comptent à moitié (CHF 7.50 par jour, au plus CHF 1’600).`,
    it: 'Il tuo certificato di salario indica una mensa o buoni pasto (casella G): i pasti contano a metà (CHF 7.50 al giorno, al massimo CHF 1’600).',
  },
  freeTransport: {
    en: 'Your employer provides the transport to work (box F): no travel costs.',
    fr: `Votre employeur fournit le transport au travail (case F)${NB}: pas de frais de transport.`,
    it: 'Il tuo datore di lavoro ti fornisce il trasporto al lavoro (casella F): nessuna spesa di trasporto.',
  },
  workFromHome: {
    en: 'You work from home: no travel costs and no meals away from home.',
    fr: `Vous travaillez à domicile${NB}: pas de frais de transport ni de repas hors du domicile.`,
    it: 'Lavori da casa: nessuna spesa di trasporto e nessun pasto fuori casa.',
  },
  replacement: {
    en: 'Daily allowances not on a salary certificate are put on 3.5 (sickness and accident insurance), unemployment benefits on 3.4. The tax is the same either way.',
    fr: `Les indemnités journalières hors certificat de salaire vont sous 3.5 (assurance maladie et accident), les indemnités de chômage sous 3.4. L’impôt est le même dans les deux cas.`,
    it: 'Le indennità giornaliere fuori dal certificato di salario vanno alla cifra 3.5 (assicurazione malattia e infortuni), le indennità di disoccupazione alla 3.4. L’imposta è la stessa nei due casi.',
  },
  lifeAnnuity: {
    en: 'Other pensions are taken as given. For a life annuity, give the taxable part the insurer certifies (quota di reddito imponibile), as asked from 2025.',
    fr: `Les autres rentes sont prises telles quelles. Pour une rente viagère, indiquez la part imposable attestée par l’assureur (quota di reddito imponibile), comme demandé dès 2025.`,
    it: 'Le altre rendite sono prese come indicate. Per una rendita vitalizia, indica la quota di reddito imponibile attestata dall’assicuratore, come chiesto dal 2025.',
  },
  receivesSupport: {
    en: 'You receive child support for the children in shared custody: they count in full for you (the deduction is shared only without child support).',
    fr: `Vous recevez une contribution d’entretien pour les enfants en garde partagée${NB}: ils comptent entièrement pour vous (la déduction n’est partagée que sans contribution).`,
    it: 'Ricevi gli alimenti per i figli in custodia alternata: contano interamente per te (la deduzione si divide solo senza alimenti).',
  },
  paysSupport: {
    en: 'You pay child support for the children in shared custody: they count for the other parent, and you deduct what you pay (cifra 14.2).',
    fr: `Vous versez une contribution d’entretien pour les enfants en garde partagée${NB}: ils comptent pour l’autre parent, et vous déduisez ce que vous versez (cifra 14.2).`,
    it: 'Versi gli alimenti per i figli in custodia alternata: contano per l’altro genitore, e deduci ciò che versi (cifra 14.2).',
  },
  sharedHalf: {
    en: 'Shared custody without child support: the child deduction is shared half and half with the other parent (LT art. 34 cpv. 1 lett. a).',
    fr: `Garde partagée sans contribution d’entretien${NB}: la déduction pour enfant est partagée par moitié avec l’autre parent (LT art. 34 cpv. 1 lett. a).`,
    it: 'Custodia alternata senza alimenti: la deduzione per figli è divisa a metà con l’altro genitore (LT art. 34 cpv. 1 lett. a).',
  },
  under14: {
    en: 'The children with childcare are taken as under 14 at the end of the year.',
    fr: `Les enfants gardés sont considérés comme ayant moins de 14 ans à la fin de l’année.`,
    it: 'I figli con spese di custodia sono considerati di età inferiore ai 14 anni alla fine dell’anno.',
  },
  daysCapped: {
    en: 'Travel by car counts at most 220 working days a year for a full-time job (Istruzioni p. 23).',
    fr: `Le trajet en voiture compte au plus 220 jours de travail par an pour un plein temps (Istruzioni p. 23).`,
    it: 'Il tragitto in automobile conta al massimo 220 giorni lavorativi all’anno per un impiego al 100% (Istruzioni p. 23).',
  },
  wealthChildLeftOut: {
    en: 'The wealth deduction per minor child (35.2, CHF 30,000) for a child in shared custody, or whose age is not given, is not settled by the documents. With your figures it does not change the tax, so it is left out.',
    fr: `La déduction de fortune par enfant mineur (35.2, CHF 30’000) pour un enfant en garde partagée, ou dont l’âge n’est pas indiqué, n’est pas tranchée par les documents. Avec vos chiffres, elle ne change pas l’impôt${NB}: elle est laissée de côté.`,
    it: 'La deduzione sociale sulla sostanza per figlio minorenne (35.2, CHF 30’000) per un figlio in custodia alternata, o di cui non è indicata l’età, non è chiarita dai documenti. Con i tuoi importi non cambia l’imposta: è lasciata da parte.',
  },
  // What is not in the calculation (notCounted).
  notAsked: {
    en: 'Not in this calculation because Taxpresso does not ask about them yet: children in education (25.2, CHF 1,300 to 13,900), dependants (25.3), disability costs (15.1), permanent charges and annuities you pay (14.3, 14.4).',
    fr: `Pas dans ce calcul, car Taxpresso ne les demande pas encore${NB}: enfants aux études (25.2, CHF 1’300 à 13’900), personnes à charge (25.3), frais liés au handicap (15.1), charges durables et rentes versées (14.3, 14.4).`,
    it: 'Non in questo calcolo, perché Taxpresso non lo chiede ancora: figli agli studi (25.2, da CHF 1’300 a 13’900), persone bisognose a carico (25.3), spese per disabilità (15.1), oneri permanenti e rendite vitalizie pagate (14.3, 14.4).',
  },
  church: {
    en: 'Church tax: the canton’s documents in Taxpresso’s library give none for natural persons, so none is computed.',
    fr: `Impôt ecclésiastique${NB}: les documents du canton dont dispose Taxpresso n’en prévoient pas pour les personnes physiques${NB}: aucun n’est calculé.`,
    it: 'Imposta di culto: i documenti del Cantone a disposizione di Taxpresso non ne prevedono per le persone fisiche, quindi non ne è calcolata nessuna.',
  },
  medicalBelow: {
    en: 'Illness costs (22.1): below 5 % of the net income II (21), nothing to deduct.',
    fr: `Frais de maladie (22.1)${NB}: sous 5${NB}% du revenu net II (21), rien à déduire.`,
    it: 'Spese per malattia e infortunio (22.1): sotto il 5% del reddito netto intermedio II (21), niente da dedurre.',
  },
  donationsMin: {
    en: 'Donations (24): deducted only from CHF 100 in the year.',
    fr: `Dons (24)${NB}: déductibles seulement dès CHF 100 dans l’année.`,
    it: 'Liberalità (24): deducibili solo da CHF 100 nell’anno.',
  },
  transitDetails: {
    en: 'Travel to work: give what public transport cost (or would have cost) in the year; without it, nothing is counted.',
    fr: `Trajet au travail${NB}: indiquez ce qu’ont coûté (ou auraient coûté) les transports publics dans l’année${NB}; sans cela, rien n’est compté.`,
    it: 'Tragitto al lavoro: indica quanto è costato (o sarebbe costato) il mezzo pubblico nell’anno; senza questo dato non è contato nulla.',
  },
  drivingDetails: {
    en: 'Driving to work without usable public transport: give the km one way and the days driven; without them, nothing is counted.',
    fr: `Trajet en voiture sans transports publics utilisables${NB}: indiquez les km pour un trajet et les jours de trajet${NB}; sans cela, rien n’est compté.`,
    it: 'Tragitto in auto senza un mezzo pubblico utilizzabile: indica i km di un tragitto e i giorni di tragitto; senza questi dati non è contato nulla.',
  },
  bikeAmount: {
    en: 'Bike or moped to work: the deduction is up to CHF 700 a year, never more than public transport would cost. Give the amount (and what public transport would cost); without it, nothing is counted.',
    fr: `Vélo ou cyclomoteur${NB}: la déduction va jusqu’à CHF 700 par an, jamais plus que les transports publics. Indiquez le montant (et le coût des transports publics)${NB}; sans cela, rien n’est compté.`,
    it: 'Bicicletta o ciclomotore per andare al lavoro: la deduzione arriva a CHF 700 l’anno, mai più del costo del mezzo pubblico. Indica l’importo (e quanto costerebbe il mezzo pubblico); senza questo dato non è contato nulla.',
  },
  childcareSplit: {
    en: 'Childcare by third parties (cure prestate da terzi, 20) not computed: the limit is per child under 14 (LT art. 32a), and the costs you gave for the household are too high for every split between your children to give the same deduction. Taxpresso doesn’t compute the tax until it knows what was paid for each child.',
    fr: `Frais de garde par des tiers (cure prestate da terzi, 20) non calculés${NB}: la limite est par enfant de moins de 14 ans (LT art. 32a), et les frais indiqués pour le ménage sont trop élevés pour que toute répartition entre vos enfants donne la même déduction. Taxpresso ne calcule pas l’impôt avant de savoir ce qui a été payé pour chaque enfant.`,
    it: 'Spese per cure prestate da terzi (20) non calcolate: il limite vale per ogni figlio di età inferiore ai 14 anni (LT art. 32a), e le spese indicate per l’economia domestica sono troppo alte perché ogni ripartizione tra i tuoi figli dia la stessa deduzione. Taxpresso non calcola l’imposta finché non sa quanto è stato pagato per ogni figlio.',
  },
  childcareNoChild: {
    en: 'Childcare by third parties (cure prestate da terzi, 20): not counted, no child under 14 who lives with you and counts for you was given.',
    fr: `Frais de garde par des tiers (cure prestate da terzi, 20)${NB}: non comptés, aucun enfant de moins de 14 ans vivant avec vous et compté pour vous n’est indiqué.`,
    it: 'Spese per cure prestate da terzi (20): non contate, non è indicato nessun figlio di età inferiore ai 14 anni che vive con te e conta per te.',
  },
  childcareAway: {
    en: 'Childcare (20) counts only for a child under 14 who lives with you.',
    fr: `Les frais de garde (20) ne comptent que pour un enfant de moins de 14 ans qui vit avec vous.`,
    it: 'Le spese per cure prestate da terzi (20) contano solo per un figlio di età inferiore ai 14 anni che vive con te.',
  },
  // Why the tax is not computed (unsupported).
  selfEmployed: {
    en: 'Self-employment (attività indipendente, cifra 2) is not supported yet: the tax is not computed.',
    fr: `L’activité indépendante (attività indipendente, cifra 2) n’est pas encore prise en charge${NB}: l’impôt n’est pas calculé.`,
    it: 'L’attività indipendente (cifra 2) non è ancora supportata: l’imposta non è calcolata.',
  },
  workRate: {
    en: 'Say how much you work, as a percentage of full time (grado di occupazione): under 50 %, the flat amount for other professional costs is halved (Modulo 4, cifra 1).',
    fr: `Indiquez votre taux d’activité en pour-cent d’un plein temps (grado di occupazione)${NB}: sous 50${NB}%, le forfait des autres frais professionnels est réduit de moitié (Modulo 4, cifra 1).`,
    it: 'Indica il tuo grado di occupazione, in percentuale di un tempo pieno: sotto il 50% il forfait per le altre spese professionali è dimezzato (Modulo 4, cifra 1).',
  },
  partYear: {
    en: 'You worked only part of the year: the flat amounts for professional costs are then in proportion, and halved under 6 months, and the documents don’t say how the two combine. The tax is not computed.',
    fr: `Vous n’avez travaillé qu’une partie de l’année${NB}: les forfaits des frais professionnels sont alors au prorata, et réduits de moitié sous 6 mois, et les documents ne disent pas comment combiner les deux. L’impôt n’est pas calculé.`,
    it: 'Hai lavorato solo una parte dell’anno: gli importi forfettari delle spese professionali sono allora in proporzione, e dimezzati sotto i 6 mesi, e i documenti non dicono come combinare le due regole. L’imposta non è calcolata.',
  },
  costsAboveSalary: {
    en: 'Your professional costs are higher than your salary, and the documents don’t say whether they can be deducted beyond it. The tax is not computed.',
    fr: `Vos frais professionnels dépassent votre salaire, et les documents ne disent pas s’ils sont déductibles au-delà. L’impôt n’est pas calculé.`,
    it: 'Le tue spese professionali superano il tuo salario, e i documenti non dicono se si possono dedurre oltre. L’imposta non è calcolata.',
  },
  twoEarnerConflict: {
    en: 'Both spouses work (15.5): the deduction is at most the lower of your two incomes, and with your figures the result depends on which income counts (the net salary, the salary after its costs, or with daily allowances). The tax is not computed.',
    fr: `Activité des deux conjoints (15.5)${NB}: la déduction est au plus le plus bas de vos deux revenus, et avec vos chiffres le résultat dépend du revenu retenu (salaire net, salaire après frais, ou avec les indemnités journalières). L’impôt n’est pas calculé.`,
    it: 'Attività lucrativa di entrambi i coniugi (15.5): la deduzione è al massimo il minore dei due redditi, e con i tuoi importi il risultato dipende da quale reddito conta (il salario netto, il salario dopo le spese o con le indennità giornaliere). L’imposta non è calcolata.',
  },
  childcareWork: {
    en: 'Childcare (20) is deductible when it is needed for your work, training or inability to work; for a couple, Taxpresso supports it only when both spouses have a salary, and for a single parent when you have one. The tax is not computed.',
    fr: `Les frais de garde (20) sont déductibles s’ils sont liés à votre travail, votre formation ou votre incapacité de travailler${NB}; pour un couple, Taxpresso ne les prend en charge que si les deux conjoints ont un salaire, et pour un parent seul s’il en a un. L’impôt n’est pas calculé.`,
    it: 'Le spese per cure prestate da terzi (20) sono deducibili se sono legate al lavoro, alla formazione o all’incapacità lavorativa; per una coppia, Taxpresso le considera solo se entrambi i coniugi hanno un salario, e per un genitore solo se lo ha. L’imposta non è calcolata.',
  },
  sharedChildcare: {
    en: 'Childcare for a child in shared custody without child support: the documents don’t say how the CHF 26,200 limit is shared between the parents, and you paid more than half of it. The tax is not computed.',
    fr: `Frais de garde d’un enfant en garde partagée sans contribution d’entretien${NB}: les documents ne disent pas comment la limite de CHF 26’200 se partage entre les parents, et vous avez payé plus de la moitié. L’impôt n’est pas calculé.`,
    it: 'Spese di custodia di un figlio in custodia alternata senza alimenti: i documenti non dicono come il limite di CHF 26’200 si divide tra i genitori, e hai pagato più della metà. L’imposta non è calcolata.',
  },
  childcarePays: {
    en: 'Childcare for a child who counts for the other parent (you pay child support): the documents don’t say who deducts it. The tax is not computed.',
    fr: `Frais de garde d’un enfant qui compte pour l’autre parent (vous versez une contribution d’entretien)${NB}: les documents ne disent pas qui les déduit. L’impôt n’est pas calculé.`,
    it: 'Spese di custodia di un figlio che conta per l’altro genitore (versi gli alimenti): i documenti non dicono chi le deduce. L’imposta non è calcolata.',
  },
  childSupport: {
    en: 'Joint parental authority: whether you receive or pay child support (alimenti) decides who counts the children (the child deduction is shared half and half only without child support). Answer the question on child support.',
    fr: `Autorité parentale conjointe${NB}: recevoir ou verser une contribution d’entretien (alimenti) décide qui compte les enfants (la déduction pour enfant n’est partagée par moitié que sans contribution). Répondez à la question sur la contribution d’entretien.`,
    it: 'Autorità parentale congiunta: ricevere o versare gli alimenti decide chi conta i figli (la deduzione per figli si divide a metà solo senza alimenti). Rispondi alla domanda sugli alimenti.',
  },
  marriedShared: {
    en: 'A married couple with a child in shared custody with another parent: the documents Taxpresso has don’t say how the child counts for the couple. The tax is not computed.',
    fr: `Couple marié avec un enfant en garde partagée avec un autre parent${NB}: les documents dont dispose Taxpresso ne disent pas comment l’enfant compte pour le couple. L’impôt n’est pas calculé.`,
    it: 'Coppia sposata con un figlio in custodia alternata con un altro genitore: i documenti a disposizione di Taxpresso non dicono come conta il figlio per la coppia. L’imposta non è calcolata.',
  },
  paysLiving: {
    en: 'You pay child support for a child in shared custody who also lives with you: the documents don’t say whether the family tariff (LT art. 35 cpv. 2) then applies to you. The tax is not computed.',
    fr: `Vous versez une contribution d’entretien pour un enfant en garde partagée qui vit aussi avec vous${NB}: les documents ne disent pas si le barème familial (LT art. 35 cpv. 2) s’applique alors à vous. L’impôt n’est pas calculé.`,
    it: 'Versi gli alimenti per un figlio in custodia alternata che vive anche con te: i documenti non dicono se allora ti si applica la tariffa per famiglie (LT art. 35 cpv. 2). L’imposta non è calcolata.',
  },
  statusChange: {
    en: 'Say whether you were divorced, separated or widowed during the year: for that year the family tariff applies (LT art. 35 cpv. 5).',
    fr: `Dites si vous avez divorcé, été séparé ou êtes devenu veuf ou veuve pendant l’année${NB}: pour cette année, le barème familial s’applique (LT art. 35 cpv. 5).`,
    it: 'Indica se nell’anno hai divorziato, ti sei separato o separata, o sei rimasto o rimasta vedovo o vedova: per quell’anno si applica la tariffa per famiglie (LT art. 35 cpv. 5).',
  },
  widowedThisYear: {
    en: 'Your spouse died during the year: you are taxed together up to that day and separately after it, each for part of the year (LT art. 53 cpv. 3). Taxpresso does not support part of a year yet: the tax is not computed.',
    fr: `Votre conjoint est décédé pendant l’année${NB}: vous êtes imposés ensemble jusqu’à ce jour et séparément ensuite, chacun pour une partie de l’année (LT art. 53 cpv. 3). Taxpresso ne prend pas encore en charge une partie d’année${NB}: l’impôt n’est pas calculé.`,
    it: 'Il tuo coniuge è deceduto nell’anno: siete tassati insieme fino a quel giorno e separatamente dopo, ciascuno per una parte dell’anno (LT art. 53 cpv. 3). Taxpresso non supporta ancora una parte dell’anno: l’imposta non è calcolata.',
  },
  drivingDays2026: {
    en: 'Driving to work in 2026: the 2026 instructions are not published, and with them the most working days a year that count (220 in 2025). The tax is not computed.',
    fr: `Trajet en voiture en 2026${NB}: les instructions 2026 ne sont pas publiées, ni le nombre maximal de jours de travail par an qui comptent (220 en 2025). L’impôt n’est pas calculé.`,
    it: 'Tragitto in automobile nel 2026: le Istruzioni 2026 non sono pubblicate, e con esse il numero massimo di giorni lavorativi all’anno che contano (220 nel 2025). L’imposta non è calcolata.',
  },
  catchUp2025: {
    en: 'A pillar 3a catch-up payment (riscatto nel 3° pilastro A) is possible from tax year 2026 only.',
    fr: `Un rachat dans le pilier 3a (riscatto nel 3° pilastro A) n’est possible qu’à partir de l’année fiscale 2026.`,
    it: 'Un riscatto nel 3° pilastro A è possibile solo dal periodo fiscale 2026.',
  },
  wealthBrake: {
    en: 'Your cantonal and communal taxes are more than 60 % of your taxable income: on request, the wealth tax is cut (freno all’imposta sulla sostanza, LT art. 49a). Taxpresso does not compute that request: the tax is not computed.',
    fr: `Vos impôts cantonaux et communaux dépassent 60${NB}% de votre revenu imposable${NB}: sur demande, l’impôt sur la fortune est réduit (freno all’imposta sulla sostanza, LT art. 49a). Taxpresso ne calcule pas cette demande${NB}: l’impôt n’est pas calculé.`,
    it: 'Le tue imposte cantonali e comunali superano il 60% del tuo reddito imponibile: su richiesta, l’imposta sulla sostanza è ridotta (freno all’imposta sulla sostanza, LT art. 49a). Taxpresso non calcola questa richiesta: l’imposta non è calcolata.',
  },
  wealthChild: {
    en: 'The wealth deduction per minor child (35.2, CHF 30,000) for a child in shared custody, or whose age is not given, is not settled by the documents, and with your figures it changes the tax. Say whether each child was under 18 at the end of the year; for shared custody, the tax is not computed.',
    fr: `La déduction de fortune par enfant mineur (35.2, CHF 30’000) pour un enfant en garde partagée, ou dont l’âge n’est pas indiqué, n’est pas tranchée par les documents, et avec vos chiffres elle change l’impôt. Indiquez si chaque enfant avait moins de 18 ans à la fin de l’année${NB}; en garde partagée, l’impôt n’est pas calculé.`,
    it: 'La deduzione sociale sulla sostanza per figlio minorenne (35.2, CHF 30’000) per un figlio in custodia alternata, o di cui non è indicata l’età, non è chiarita dai documenti, e con i tuoi importi cambia l’imposta. Indica se ogni figlio aveva meno di 18 anni alla fine dell’anno; in custodia alternata l’imposta non è calcolata.',
  },
} as const satisfies Record<string, Text>;
