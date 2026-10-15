// The five invented Geneva households of the filing kits (test/fixtures/households/README.md).
// Plain data, one place: the document generator (make.mjs) writes their papers from it, and the
// hand calculation (ground-truth.mjs) works their tax out from it, never from Taxpresso's code.
//
// Everything here is made up: names, birth dates, AHV numbers (756.0000...), addresses, employers,
// banks, insurers, account numbers ("CH00 0000..." IBANs), ISINs ("TXPRS", valid check digit, no
// real security) and every amount. Money is in centimes. The amounts are chosen so that no rounding
// rule the official documents leave open decides a centime (ground-truth.mjs checks it): whole
// francs on every document, even splitting incomes, and cantonal base taxes that are multiples of
// CHF 50, so that every centime additionnel is exact.
//
// Each kit gives the household's facts for 2025 (its documents/ folder) and 2026 (written on the
// fly by the end-to-end test): the same people and papers, a year later, with the amounts of 2026.

/** CHF to centimes, from whole francs or francs and centimes. */
export const chf = (francs) => Math.round(francs * 100);

const ADDR = {
  carouge: { street: "Rue de l'Exemple 12", zip: '1227', city: 'Carouge' },
  lancy: { street: 'Avenue des Essais 8', zip: '1212', city: 'Grand-Lancy' },
  meyrin: { street: 'Rue du Test 4', zip: '1217', city: 'Meyrin' },
  thonex: { street: 'Chemin des Fictifs 10', zip: '1226', city: 'Thônex' },
  onex: { street: 'Avenue du Modèle 7', zip: '1213', city: 'Onex' },
};

/** The insurers, banks and other issuers: invented, none is a real company. */
const ISSUERS = {
  insurer: { name: 'Caisse-maladie Exemple', street: 'Case postale 100', zip: '1211', city: 'Genève 2' },
  bank: { name: 'Banque Exemple SA', street: 'Quai du Spécimen 3', zip: '1204', city: 'Genève' },
  private: { name: 'Banque Privée Exemple SA', street: "Rue de l'Essai 30", zip: '1204', city: 'Genève' },
  mortgage: { name: 'Banque Hypothécaire Exemple', street: 'Place du Modèle 1', zip: '1201', city: 'Genève' },
  pillar3a: { name: 'Fondation 3a Exemple', street: 'Case postale 300', zip: '1211', city: 'Genève 3' },
  avs: { name: 'Caisse de compensation Exemple', street: 'Route du Fictif 20', zip: '1203', city: 'Genève' },
  afc: {
    name: 'Administration fiscale cantonale (exemple)',
    street: 'Rue du Stand 26',
    zip: '1211',
    city: 'Genève 3',
  },
};

export const KITS = [
  // 1. Single, salaried, Carouge.
  {
    slug: 'essai-carouge',
    title: 'Sophie Essai, single, salaried, Carouge',
    commune: 'Carouge',
    communeCode: '6608',
    address: ADDR.carouge,
    civil: 'single',
    people: [
      {
        id: 'p1',
        first: 'Sophie',
        last: 'Essai',
        born: '1993-03-14',
        ahv: '756.0000.1001.13',
        job: 'Architecte (fictive)',
      },
    ],
    children: [],
    answers: {
      canton: 'GE',
      civil_status: 'single',
      children: 0,
      commune: 'Carouge',
      moved: 'no',
      'income_sources:p1': ['salary'],
      'employers:p1': 1,
      'residence:p1': 'swiss',
      'pillar3a:p1': true,
      'lpp_buyin:p1': false,
      'commute:p1': 'public_transport',
      'commute_transit_cost:p1': 500,
      'meal_days:p1': 0,
      banks: 1,
      crypto: false,
      payments: [],
      special: [],
    },
    years: {
      2025: {
        salaries: [
          {
            person: 'p1',
            employer: { name: 'Atelier Exemple SA', street: 'Route du Modèle 5', zip: '1227', city: 'Carouge' },
            base: chf(86_400),
            gross: chf(86_400),
            social: chf(5_962),
            lppOrdinary: chf(5_138),
          },
        ],
        commute: { p1: { transit: chf(500) } },
        pillar3a: [{ person: 'p1', paid: chf(7_258) }],
        health: {
          members: [{ person: 'p1', name: 'Sophie Essai', basic: chf(4_762), supplementary: chf(1_524) }],
        },
        statements: [
          {
            person: 'p1',
            bank: ISSUERS.bank,
            client: 'TXP-0101',
            depot: 'D-0001017',
            accounts: [
              { iban: 'CH0000000000000101001', name: 'Compte privé', balance: chf(12_480) },
            ],
            securities: [
              {
                isinPrefix: 'CHTXPRS0101',
                valor: '9100101',
                name: 'Fonds Actions Suisses Exemple (fictif)',
                quantity: 180,
                unitPrice: 131.0,
                dividend: chf(180),
              },
            ],
          },
        ],
      },
      2026: {
        salaries: [
          {
            person: 'p1',
            employer: { name: 'Atelier Exemple SA', street: 'Route du Modèle 5', zip: '1227', city: 'Carouge' },
            base: chf(88_200),
            gross: chf(88_200),
            social: chf(6_086),
            lppOrdinary: chf(5_314),
          },
        ],
        commute: { p1: { transit: chf(500) } },
        pillar3a: [{ person: 'p1', paid: chf(7_258) }],
        health: {
          members: [{ person: 'p1', name: 'Sophie Essai', basic: chf(5_887), supplementary: chf(1_560) }],
        },
        statements: [
          {
            person: 'p1',
            bank: ISSUERS.bank,
            client: 'TXP-0101',
            depot: 'D-0001017',
            accounts: [
              { iban: 'CH0000000000000101001', name: 'Compte privé', balance: chf(15_920) },
            ],
            securities: [
              {
                isinPrefix: 'CHTXPRS0101',
                valor: '9100101',
                name: 'Fonds Actions Suisses Exemple (fictif)',
                quantity: 200,
                unitPrice: 134.0,
                dividend: chf(220),
              },
            ],
          },
        ],
      },
    },
  },
];

export { ISSUERS };
