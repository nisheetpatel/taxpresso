// The six invented Geneva households of the filing kits (test/fixtures/households/README.md).
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
  vernier: { street: "Chemin de l'Échantillon 14", zip: '1214', city: 'Vernier' },
};

/** The insurers, banks and other issuers: invented, none is a real company. */
const ISSUERS = {
  insurer: {
    name: 'Caisse-maladie Exemple',
    street: 'Case postale 100',
    zip: '1211',
    city: 'Genève 2',
  },
  bank: { name: 'Banque Exemple SA', street: 'Quai du Spécimen 3', zip: '1204', city: 'Genève' },
  private: {
    name: 'Banque Privée Exemple SA',
    street: "Rue de l'Essai 30",
    zip: '1204',
    city: 'Genève',
  },
  mortgage: {
    name: 'Banque Hypothécaire Exemple',
    street: 'Place du Modèle 1',
    zip: '1201',
    city: 'Genève',
  },
  pillar3a: {
    name: 'Fondation 3a Exemple',
    street: 'Case postale 300',
    zip: '1211',
    city: 'Genève 3',
  },
  avs: {
    name: 'Caisse de compensation Exemple',
    street: 'Route du Fictif 20',
    zip: '1203',
    city: 'Genève',
  },
  afc: {
    name: 'Administration fiscale cantonale (exemple)',
    street: 'Rue du Stand 26',
    zip: '1211',
    city: 'Genève 3',
  },
};

const LANCY_EMPLOYERS = {
  p1: {
    name: "Bureau d'Etudes Exemple SA",
    street: 'Chemin du Spécimen 3',
    zip: '1213',
    city: 'Petit-Lancy',
  },
  p2: {
    name: 'Laboratoire Fictif Sàrl',
    street: "Route de l'Essai 21",
    zip: '1212',
    city: 'Grand-Lancy',
  },
};
const MEYRIN_EMPLOYERS = {
  p1: {
    name: 'Mécanique Exemple SA',
    street: 'Chemin du Prototype 9',
    zip: '1217',
    city: 'Meyrin',
  },
  p2: {
    name: 'Laboratoires Modèle SA',
    street: "Route de l'Essai 40",
    zip: '1217',
    city: 'Meyrin',
  },
};
const PENSION_FUNDS = {
  p1: {
    name: 'Caisse de pension Exemple',
    street: 'Avenue du Fictif 15',
    zip: '1205',
    city: 'Genève',
  },
  p2: {
    name: 'Fondation de prévoyance Modèle',
    street: 'Case postale 410',
    zip: '1211',
    city: 'Genève 26',
  },
};
/** The Fictif couple's flat: bought in 2004 for CHF 640'000, raised by 12 % from 2025 (LEFI). */
const THONEX_FLAT = (year, rentalValue) => ({
  since: 2004,
  old: true,
  parcel: '4321',
  description: 'appartement de 5 pièces en PPE (lot 12), Chemin des Fictifs 10',
  taxValue: chf(716_800),
  rentalValue,
});
const CRECHE = {
  name: 'Crèche Les Petits Exemples',
  street: 'Chemin des Essais 2',
  zip: '1212',
  city: 'Grand-Lancy',
};
const CHARITY = {
  name: 'Fondation Exemple pour l’enfance',
  street: 'Case postale 12',
  zip: '1211',
  city: 'Genève 4',
};

export const KITS = [
  // 1. Single, salaried, Carouge.
  {
    slug: 'essai-carouge',
    title: 'Sophie Essai, single, salaried, Carouge',
    story:
      'Sophie is an architect employed full time by a firm in Carouge, where she lives. She pays into a pension fund through her employer and the maximum into her pillar 3a, takes the tram to work and keeps her savings at one bank, which sends her an e-tax statement (a current account and a Swiss equity fund).',
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
      'work_commune:p1': 'Carouge',
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
            employer: {
              name: 'Atelier Exemple SA',
              street: 'Route du Modèle 5',
              zip: '1227',
              city: 'Carouge',
            },
            base: chf(86_400),
            gross: chf(86_400),
            social: chf(5_962),
            lppOrdinary: chf(5_138),
          },
        ],
        commute: { p1: { transit: chf(500) } },
        pillar3a: [{ person: 'p1', paid: chf(7_258) }],
        health: {
          members: [
            { person: 'p1', name: 'Sophie Essai', basic: chf(4_762), supplementary: chf(1_524) },
          ],
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
            employer: {
              name: 'Atelier Exemple SA',
              street: 'Route du Modèle 5',
              zip: '1227',
              city: 'Carouge',
            },
            base: chf(88_200),
            gross: chf(88_200),
            social: chf(6_086),
            lppOrdinary: chf(5_314),
          },
        ],
        commute: { p1: { transit: chf(500) } },
        pillar3a: [{ person: 'p1', paid: chf(7_258) }],
        health: {
          members: [
            { person: 'p1', name: 'Sophie Essai', basic: chf(5_887), supplementary: chf(1_560) },
          ],
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
  // 2. Married, two salaries, two children in a crèche, Lancy.
  {
    slug: 'temoin-lancy',
    title: 'Thomas and Laura Témoin, married, two salaries, two children in a crèche, Lancy',
    story:
      'Thomas is an engineer and Laura a biologist; both work for employers in Lancy, where they live with Hugo and Inès, who go to a crèche. Both pay into a pension fund and a pillar 3a. Thomas takes the bus and eats out at lunch; Laura walks to work. They keep their savings in a joint account, give to a children’s charity each year, and kept last year’s declaration, which Taxpresso reads for suggestions.',
    commune: 'Lancy',
    communeCode: '6628',
    address: ADDR.lancy,
    civil: 'married',
    people: [
      {
        id: 'p1',
        first: 'Thomas',
        last: 'Témoin',
        born: '1987-06-21',
        ahv: '756.0000.1002.20',
        job: 'Ingénieur (fictif)',
      },
      {
        id: 'p2',
        first: 'Laura',
        last: 'Témoin',
        born: '1989-11-04',
        ahv: '756.0000.1003.37',
        job: 'Biologiste (fictive)',
      },
    ],
    children: [
      { first: 'Hugo', born: '2021-05-10' },
      { first: 'Inès', born: '2023-09-02' },
    ],
    answers: {
      canton: 'GE',
      civil_status: 'married',
      children: 2,
      children_custody: 'with_household',
      childcare: 'creche_or_daycare',
      commune: 'Lancy',
      moved: 'no',
      'income_sources:p1': ['salary'],
      'income_sources:p2': ['salary'],
      'employers:p1': 1,
      'employers:p2': 1,
      'work_commune:p1': 'Lancy',
      'work_commune:p2': 'Lancy',
      'residence:p1': 'swiss',
      'pillar3a:p1': true,
      'pillar3a:p2': true,
      'lpp_buyin:p1': false,
      'lpp_buyin:p2': false,
      'commute:p1': 'public_transport',
      'commute_transit_cost:p1': 500,
      'commute:p2': 'walk',
      'meal_days:p1': 220,
      'meal_days:p2': 0,
      banks: 1,
      crypto: false,
      payments: ['donations'],
      special: [],
    },
    // Asked only once the crèche invoices are in: they come to more than one child's maximum.
    yearAnswers: {
      2025: { 'child_care:child1': 14_200, 'child_care:child2': 16_800 },
      2026: { 'child_care:child1': 11_400, 'child_care:child2': 17_400 },
    },
    years: {
      2025: {
        salaries: [
          {
            person: 'p1',
            employer: LANCY_EMPLOYERS.p1,
            base: chf(118_000),
            gross: chf(118_000),
            social: chf(8_142),
            lppOrdinary: chf(9_558),
          },
          {
            person: 'p2',
            employer: LANCY_EMPLOYERS.p2,
            base: chf(68_000),
            gross: chf(68_000),
            social: chf(4_692),
            lppOrdinary: chf(3_808),
          },
        ],
        commute: { p1: { transit: chf(500), mealDays: 220 } },
        pillar3a: [
          { person: 'p1', paid: chf(7_258) },
          { person: 'p2', paid: chf(5_000) },
        ],
        health: {
          members: [
            { person: 'p1', name: 'Thomas Témoin', basic: chf(6_152), supplementary: chf(960) },
            { person: 'p2', name: 'Laura Témoin', basic: chf(5_580), supplementary: chf(960) },
            { person: 'c1', name: 'Hugo Témoin', basic: chf(1_260), supplementary: chf(204) },
            { person: 'c2', name: 'Inès Témoin', basic: chf(1_260), supplementary: chf(204) },
          ],
        },
        childcare: [
          { child: 'Hugo', provider: CRECHE, amount: chf(14_200) },
          { child: 'Inès', provider: CRECHE, amount: chf(16_800) },
        ],
        donations: [{ to: 'Fondation Exemple pour l’enfance', org: CHARITY, amount: chf(300) }],
        bankAccounts: [
          {
            person: 'household',
            bank: ISSUERS.bank,
            name: 'Compte épargne joint',
            iban: 'CH0000000000000102001',
            balance: chf(46_300),
            interest: chf(92),
          },
        ],
        prior: {
          employerA: LANCY_EMPLOYERS.p1.name,
          employerB: LANCY_EMPLOYERS.p2.name,
          salaryA: chf(115_000),
          salaryB: chf(66_000),
          lppA: chf(9_300),
          lppB: chf(3_700),
          p3aA: chf(7_056),
          p3aB: chf(5_000),
          flatA: chf(1_812),
          flatB: chf(1_740),
          interest: chf(80),
          premiums: chf(15_600),
          insuranceIfd: chf(5_100),
          childcare: chf(29_000),
          donation: chf(250),
          savings: chf(41_000),
        },
      },
      2026: {
        salaries: [
          {
            person: 'p1',
            employer: LANCY_EMPLOYERS.p1,
            base: chf(120_000),
            gross: chf(120_000),
            social: chf(8_280),
            lppOrdinary: chf(9_720),
          },
          {
            person: 'p2',
            employer: LANCY_EMPLOYERS.p2,
            base: chf(69_000),
            gross: chf(69_000),
            social: chf(4_761),
            lppOrdinary: chf(3_939),
          },
        ],
        commute: { p1: { transit: chf(500), mealDays: 220 } },
        pillar3a: [
          { person: 'p1', paid: chf(7_258) },
          { person: 'p2', paid: chf(5_000) },
        ],
        health: {
          members: [
            { person: 'p1', name: 'Thomas Témoin', basic: chf(6_364), supplementary: chf(984) },
            { person: 'p2', name: 'Laura Témoin', basic: chf(6_336), supplementary: chf(984) },
            { person: 'c1', name: 'Hugo Témoin', basic: chf(1_308), supplementary: chf(216) },
            { person: 'c2', name: 'Inès Témoin', basic: chf(1_308), supplementary: chf(216) },
          ],
        },
        childcare: [
          { child: 'Hugo', provider: CRECHE, amount: chf(11_400) },
          { child: 'Inès', provider: CRECHE, amount: chf(17_400) },
        ],
        donations: [{ to: 'Fondation Exemple pour l’enfance', org: CHARITY, amount: chf(300) }],
        bankAccounts: [
          {
            person: 'household',
            bank: ISSUERS.bank,
            name: 'Compte épargne joint',
            iban: 'CH0000000000000102001',
            balance: chf(49_100),
            interest: chf(88),
          },
        ],
        prior: {
          employerA: LANCY_EMPLOYERS.p1.name,
          employerB: LANCY_EMPLOYERS.p2.name,
          salaryA: chf(118_000),
          salaryB: chf(68_000),
          lppA: chf(9_558),
          lppB: chf(3_808),
          p3aA: chf(7_258),
          p3aB: chf(5_000),
          flatA: chf(1_812),
          flatB: chf(1_785),
          interest: chf(92),
          premiums: chf(16_008),
          insuranceIfd: chf(5_100),
          childcare: chf(31_000),
          donation: chf(300),
          savings: chf(46_300),
        },
      },
    },
  },
  // 3. Married, both with a B permit, both salaried and taxed at source, already in TOU, two
  // children, Meyrin.
  {
    slug: 'exemplo-meyrin',
    title:
      'Tiago and Marta Exemplo, B permits, taxed at source and already in TOU, two children, Meyrin',
    story:
      'Tiago and Marta came to Geneva with B permits and work for two companies in Meyrin, where they live with Leo and Mia, who are at school. Their employers take the tax at source from their salaries (box 12 of the salary certificates); the tax office already taxes them ordinarily afterwards (TOU), so they file a full declaration and the tax taken at source counts towards the tax. Tiago pays into a pillar 3a; both take the tram.',
    commune: 'Meyrin',
    communeCode: '6630',
    address: ADDR.meyrin,
    civil: 'married',
    people: [
      {
        id: 'p1',
        first: 'Tiago',
        last: 'Exemplo',
        born: '1988-02-17',
        ahv: '756.0000.1004.44',
        job: 'Mécanicien (fictif)',
      },
      {
        id: 'p2',
        first: 'Marta',
        last: 'Exemplo',
        born: '1990-07-30',
        ahv: '756.0000.1005.51',
        job: 'Laborantine (fictive)',
      },
    ],
    children: [
      { first: 'Leo', born: '2014-03-08' },
      { first: 'Mia', born: '2017-10-21' },
    ],
    answers: {
      canton: 'GE',
      civil_status: 'married',
      children: 2,
      children_custody: 'with_household',
      childcare: 'none',
      commune: 'Meyrin',
      moved: 'no',
      'income_sources:p1': ['salary'],
      'income_sources:p2': ['salary'],
      'employers:p1': 1,
      'employers:p2': 1,
      'work_commune:p1': 'Meyrin',
      'work_commune:p2': 'Meyrin',
      'residence:p1': 'permit_other',
      'residence:p2': 'permit_other',
      'employer_in_switzerland:p1': true,
      'employer_in_switzerland:p2': true,
      'tou:p1': 'already',
      'tou:p2': 'already',
      'pillar3a:p1': true,
      'pillar3a:p2': false,
      'lpp_buyin:p1': false,
      'lpp_buyin:p2': false,
      'commute:p1': 'public_transport',
      'commute_transit_cost:p1': 500,
      'commute:p2': 'public_transport',
      'commute_transit_cost:p2': 500,
      'meal_days:p1': 0,
      'meal_days:p2': 0,
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
            employer: MEYRIN_EMPLOYERS.p1,
            base: chf(82_000),
            gross: chf(82_000),
            social: chf(5_658),
            lppOrdinary: chf(4_642),
            sourceTax: chf(6_834),
          },
          {
            person: 'p2',
            employer: MEYRIN_EMPLOYERS.p2,
            base: chf(58_000),
            gross: chf(58_000),
            social: chf(4_002),
            lppOrdinary: chf(2_898),
            sourceTax: chf(3_960),
          },
        ],
        commute: { p1: { transit: chf(500) }, p2: { transit: chf(500) } },
        pillar3a: [{ person: 'p1', paid: chf(3_000) }],
        health: {
          members: [
            { person: 'p1', name: 'Tiago Exemplo', basic: chf(5_956), supplementary: chf(840) },
            { person: 'p2', name: 'Marta Exemplo', basic: chf(5_460), supplementary: chf(840) },
            { person: 'c1', name: 'Leo Exemplo', basic: chf(1_200), supplementary: chf(180) },
            { person: 'c2', name: 'Mia Exemplo', basic: chf(1_200), supplementary: chf(180) },
          ],
        },
        bankAccounts: [
          {
            person: 'household',
            bank: ISSUERS.bank,
            name: 'Compte privé joint',
            iban: 'CH0000000000000103001',
            balance: chf(11_200),
            interest: 0,
          },
        ],
      },
      2026: {
        salaries: [
          {
            person: 'p1',
            employer: MEYRIN_EMPLOYERS.p1,
            base: chf(83_500),
            gross: chf(83_500),
            social: chf(5_762),
            lppOrdinary: chf(4_738),
            sourceTax: chf(7_010),
          },
          {
            person: 'p2',
            employer: MEYRIN_EMPLOYERS.p2,
            base: chf(59_000),
            gross: chf(59_000),
            social: chf(4_071),
            lppOrdinary: chf(2_929),
            sourceTax: chf(4_080),
          },
        ],
        commute: { p1: { transit: chf(500) }, p2: { transit: chf(500) } },
        pillar3a: [{ person: 'p1', paid: chf(3_500) }],
        health: {
          members: [
            { person: 'p1', name: 'Tiago Exemplo', basic: chf(5_961), supplementary: chf(870) },
            { person: 'p2', name: 'Marta Exemplo', basic: chf(5_640), supplementary: chf(870) },
            { person: 'c1', name: 'Leo Exemplo', basic: chf(1_240), supplementary: chf(190) },
            { person: 'c2', name: 'Mia Exemplo', basic: chf(1_240), supplementary: chf(190) },
          ],
        },
        bankAccounts: [
          {
            person: 'household',
            bank: ISSUERS.bank,
            name: 'Compte privé joint',
            iban: 'CH0000000000000103001',
            balance: chf(12_900),
            interest: 0,
          },
        ],
      },
    },
  },
  // 4. A retired couple in Thônex: AVS and pension fund pensions, their own flat (PPE) with a
  // mortgage, securities.
  {
    slug: 'fictif-thonex',
    title: 'Bernard and Monique Fictif, retired, their own flat with a mortgage, Thônex',
    story:
      'Bernard and Monique are retired and live in the flat they bought in a building in Thônex (propriété par étage) in 2004. Each receives an AVS pension and a pension from a pension fund (Bernard’s certificate carries the Swissdec barcode). The AFC sends them the flat’s tax value and rental value each spring; a mortgage remains, and they keep Swiss shares at a private bank, which sends an e-tax statement.',
    commune: 'Thônex',
    communeCode: '6640',
    address: ADDR.thonex,
    civil: 'married',
    people: [
      {
        id: 'p1',
        first: 'Bernard',
        last: 'Fictif',
        born: '1953-04-12',
        ahv: '756.0000.1006.68',
        job: 'Retraité (fictif)',
      },
      {
        id: 'p2',
        first: 'Monique',
        last: 'Fictif',
        born: '1956-09-25',
        ahv: '756.0000.1007.75',
        job: 'Retraitée (fictive)',
      },
    ],
    children: [],
    answers: {
      canton: 'GE',
      civil_status: 'married',
      children: 0,
      commune: 'Thônex',
      moved: 'no',
      'income_sources:p1': ['pension'],
      'income_sources:p2': ['pension'],
      'residence:p1': 'swiss',
      banks: 1,
      crypto: false,
      payments: [],
      special: ['real_estate'],
      swiss_property: 'own_flat',
      swiss_property_owner: 'both',
      swiss_property_since: 2004,
      swiss_property_old: true,
      swiss_property_special: [],
      swiss_property_loan: true,
    },
    years: {
      2025: {
        pensions: [
          { person: 'p1', type: 'avs_ai', amount: chf(26_460) },
          {
            person: 'p1',
            type: 'occupational',
            barcode: true,
            fund: PENSION_FUNDS.p1,
            amount: chf(46_800),
          },
          { person: 'p2', type: 'avs_ai', amount: chf(18_900) },
          {
            person: 'p2',
            type: 'occupational',
            fund: PENSION_FUNDS.p2,
            member: 'FPM-55210',
            since: '2020-10-01',
            amount: chf(18_600),
          },
        ],
        property: THONEX_FLAT(2025, chf(24_600)),
        mortgages: [
          {
            lender: ISSUERS.mortgage,
            number: 'HYP-0104-77',
            parcel: '4321',
            rate: '1.70 %',
            balance: chf(280_000),
            interest: chf(4_760),
          },
        ],
        health: {
          members: [
            { person: 'p1', name: 'Bernard Fictif', basic: chf(6_568), supplementary: chf(840) },
            { person: 'p2', name: 'Monique Fictif', basic: chf(6_510), supplementary: chf(840) },
          ],
        },
        statements: [
          {
            person: 'household',
            bank: ISSUERS.private,
            client: 'TXP-0104',
            depot: 'D-0001044',
            accounts: [
              { iban: 'CH0000000000000104001', name: 'Compte courant', balance: chf(19_965) },
            ],
            securities: [
              {
                isinPrefix: 'CHTXPRS0104',
                valor: '9100104',
                name: 'Exemple Industrie SA (fictive)',
                category: 'SHARE',
                quantity: 400,
                unitPrice: 210.0,
                dividend: chf(2_480),
                paid: '04-24',
              },
              {
                isinPrefix: 'CHTXPRS0105',
                valor: '9100105',
                name: 'Assurances Modèle SA (fictive)',
                category: 'SHARE',
                quantity: 260,
                unitPrice: 502.0,
                dividend: chf(1_820),
                paid: '05-07',
              },
            ],
          },
        ],
      },
      2026: {
        pensions: [
          { person: 'p1', type: 'avs_ai', thirteenth: true, amount: chf(28_665) },
          {
            person: 'p1',
            type: 'occupational',
            barcode: true,
            fund: PENSION_FUNDS.p1,
            amount: chf(46_800),
          },
          { person: 'p2', type: 'avs_ai', thirteenth: true, amount: chf(20_475) },
          {
            person: 'p2',
            type: 'occupational',
            fund: PENSION_FUNDS.p2,
            member: 'FPM-55210',
            since: '2020-10-01',
            amount: chf(18_600),
          },
        ],
        property: THONEX_FLAT(2026, chf(24_860)),
        mortgages: [
          {
            lender: ISSUERS.mortgage,
            number: 'HYP-0104-77',
            parcel: '4321',
            rate: '1.60 %',
            balance: chf(275_000),
            interest: chf(4_480),
          },
        ],
        health: {
          members: [
            { person: 'p1', name: 'Bernard Fictif', basic: chf(6_819), supplementary: chf(870) },
            { person: 'p2', name: 'Monique Fictif', basic: chf(6_720), supplementary: chf(870) },
          ],
        },
        statements: [
          {
            person: 'household',
            bank: ISSUERS.private,
            client: 'TXP-0104',
            depot: 'D-0001044',
            accounts: [
              { iban: 'CH0000000000000104001', name: 'Compte courant', balance: chf(9_785) },
            ],
            securities: [
              {
                isinPrefix: 'CHTXPRS0104',
                valor: '9100104',
                name: 'Exemple Industrie SA (fictive)',
                category: 'SHARE',
                quantity: 400,
                unitPrice: 214.5,
                dividend: chf(2_560),
                paid: '04-23',
              },
              {
                isinPrefix: 'CHTXPRS0105',
                valor: '9100105',
                name: 'Assurances Modèle SA (fictive)',
                category: 'SHARE',
                quantity: 260,
                unitPrice: 515.0,
                dividend: chf(1_872),
                paid: '05-06',
              },
            ],
          },
        ],
      },
    },
  },
  // 5. Single, self-employed, Onex: simple accounts, the AVS contributions, the higher pillar 3a
  // limit without a pension fund, and securities at Interactive Brokers.
  {
    slug: 'modele-onex',
    title: 'Nadia Modèle, single, self-employed IT consultant, Onex',
    story:
      'Nadia works on her own as an IT consultant from her home in Onex, in her own name (raison individuelle). She keeps simple accounts, pays her AVS contributions as quarterly instalments, has no pension fund and so may pay more into her pillar 3a. She holds two Swiss shares at Interactive Brokers, whose Flex Query export Taxpresso reads; she looks up their official values in the ESTV price list herself.',
    commune: 'Onex',
    communeCode: '6631',
    address: ADDR.onex,
    civil: 'single',
    people: [
      {
        id: 'p1',
        first: 'Nadia',
        last: 'Modèle',
        born: '1985-01-29',
        ahv: '756.0000.1008.82',
        job: 'Consultante informatique (fictive)',
      },
    ],
    children: [],
    answers: {
      canton: 'GE',
      civil_status: 'single',
      children: 0,
      commune: 'Onex',
      moved: 'no',
      'income_sources:p1': ['self_employment'],
      'business_form:p1': 'sole_proprietor',
      'business_year:p1': 'calendar',
      'business_place:p1': 'home_commune',
      'business_method:p1': 'invoice',
      'business_special:p1': [],
      'business_losses:p1': false,
      'pillar3a:p1': true,
      banks: 2,
      crypto: false,
      payments: [],
      special: [],
    },
    years: {
      2025: {
        businesses: [
          {
            person: 'p1',
            name: 'Modèle Conseil Informatique',
            turnover: chf(132_000),
            costsOther: chf(19_800),
            depreciation: chf(2_200),
            currentAssets: chf(21_500),
            fixedAssets: chf(4_500),
            liabilities: chf(3_000),
            avs: chf(10_780),
          },
        ],
        pillar3a: [{ person: 'p1', paid: chf(15_000) }],
        health: {
          members: [
            { person: 'p1', name: 'Nadia Modèle', basic: chf(5_065), supplementary: chf(840) },
          ],
        },
        brokers: [
          {
            person: 'p1',
            name: 'Interactive Brokers',
            account: 'U0000501',
            positions: [
              {
                isinPrefix: 'CHTXPRS0106',
                symbol: 'FPHA',
                name: 'Fiction Pharma SA',
                quantity: 120,
                unitPrice: 89.5,
                dividend: chf(384),
                month: '04',
              },
              {
                isinPrefix: 'CHTXPRS0107',
                symbol: 'EXAS',
                name: 'Exemple Assurances SA',
                quantity: 40,
                unitPrice: 512,
                dividend: chf(960),
                month: '05',
              },
            ],
          },
        ],
        bankAccounts: [
          {
            person: 'p1',
            bank: ISSUERS.bank,
            name: 'Compte privé',
            iban: 'CH0000000000000105001',
            balance: chf(8_400),
            interest: 0,
          },
        ],
      },
      2026: {
        businesses: [
          {
            person: 'p1',
            name: 'Modèle Conseil Informatique',
            turnover: chf(138_000),
            costsOther: chf(20_400),
            depreciation: chf(2_100),
            currentAssets: chf(24_800),
            fixedAssets: chf(3_800),
            liabilities: chf(2_600),
            avs: chf(11_320),
          },
        ],
        pillar3a: [{ person: 'p1', paid: chf(16_000) }],
        health: {
          members: [
            { person: 'p1', name: 'Nadia Modèle', basic: chf(5_786), supplementary: chf(860) },
          ],
        },
        brokers: [
          {
            person: 'p1',
            name: 'Interactive Brokers',
            account: 'U0000501',
            positions: [
              {
                isinPrefix: 'CHTXPRS0106',
                symbol: 'FPHA',
                name: 'Fiction Pharma SA',
                quantity: 120,
                unitPrice: 92,
                dividend: chf(396),
                month: '04',
              },
              {
                isinPrefix: 'CHTXPRS0107',
                symbol: 'EXAS',
                name: 'Exemple Assurances SA',
                quantity: 50,
                unitPrice: 520,
                dividend: chf(1_250),
                month: '05',
              },
            ],
          },
        ],
        bankAccounts: [
          {
            person: 'p1',
            bank: ISSUERS.bank,
            name: 'Compte privé',
            iban: 'CH0000000000000105001',
            balance: chf(9_100),
            interest: 0,
          },
        ],
      },
    },
  },
  // 6. Single, salaried, lives in Vernier and works in the City of Geneva: the communal tax shared
  // between the commune of residence (its privileged share) and the commune of work (the rest).
  // Her salary is all her income, so the rest goes to Genève whatever measures the shares.
  {
    slug: 'specimen-vernier',
    title: 'Léa Spécimen, single, lives in Vernier, works in the City of Geneva',
    story:
      'Léa is a lawyer employed full time by a firm in the City of Geneva; she lives in Vernier and takes the tram to work. She pays into a pension fund through her employer and the maximum into her pillar 3a, and keeps her savings in a current account that earns no interest. Her salary is all her income, so the part of her communal tax that doesn’t stay in Vernier goes to Genève.',
    commune: 'Vernier',
    communeCode: '6643',
    address: ADDR.vernier,
    civil: 'single',
    people: [
      {
        id: 'p1',
        first: 'Léa',
        last: 'Spécimen',
        born: '1990-07-02',
        ahv: '756.0000.1009.99',
        job: 'Juriste (fictive)',
      },
    ],
    children: [],
    answers: {
      canton: 'GE',
      civil_status: 'single',
      children: 0,
      commune: 'Vernier',
      moved: 'no',
      'income_sources:p1': ['salary'],
      'employers:p1': 1,
      'work_commune:p1': 'Ville de Genève',
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
            employer: {
              name: 'Etude Exemple Avocats SA',
              street: 'Rue du Spécimen 21',
              zip: '1204',
              city: 'Genève',
            },
            workCommune: 'Genève',
            workCommuneCode: '6621',
            base: chf(130_000),
            gross: chf(130_000),
            social: chf(8_970),
            lppOrdinary: chf(9_030),
          },
        ],
        commute: { p1: { transit: chf(500) } },
        pillar3a: [{ person: 'p1', paid: chf(7_258) }],
        health: {
          members: [
            { person: 'p1', name: 'Léa Spécimen', basic: chf(3_657), supplementary: chf(600) },
          ],
        },
        bankAccounts: [
          {
            person: 'p1',
            bank: ISSUERS.bank,
            name: 'Compte privé',
            iban: 'CH0000000000000106001',
            balance: chf(25_400),
            interest: 0,
          },
        ],
      },
      2026: {
        salaries: [
          {
            person: 'p1',
            employer: {
              name: 'Etude Exemple Avocats SA',
              street: 'Rue du Spécimen 21',
              zip: '1204',
              city: 'Genève',
            },
            workCommune: 'Genève',
            workCommuneCode: '6621',
            base: chf(132_000),
            gross: chf(132_000),
            social: chf(9_108),
            lppOrdinary: chf(9_092),
          },
        ],
        commute: { p1: { transit: chf(500) } },
        pillar3a: [{ person: 'p1', paid: chf(7_258) }],
        health: {
          members: [
            { person: 'p1', name: 'Léa Spécimen', basic: chf(5_457), supplementary: chf(600) },
          ],
        },
        bankAccounts: [
          {
            person: 'p1',
            bank: ISSUERS.bank,
            name: 'Compte privé',
            iban: 'CH0000000000000106001',
            balance: chf(31_800),
            interest: 0,
          },
        ],
      },
    },
  },
];

export { ISSUERS };
