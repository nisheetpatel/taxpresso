#!/usr/bin/env node
// Writes the filing kits (test/fixtures/households/README.md): for each invented household of
// kits.mjs, its 2025 documents (documents/), the answers it gives (household.json) and what Claude
// would read in its documents without a barcode (extracted.json, for 2025 and 2026). Deterministic:
// the same bytes at every run. The end-to-end test (extension/test/households.test.ts) writes the
// 2026 documents on the fly with buildDocuments(kit, 2026).
//
//   node test/fixtures/households/make.mjs
//
// The PDFs are written by hand, like the other fixtures: a text layer in Helvetica (WinAnsi), lines,
// and the barcodes the repo's generators draw (packages/intake/test/barcode-fixtures.mjs: the
// Swissdec salary certificate barcode, the eCH-0196 Macro PDF417 segments and the eCH-0270 page
// barcode). Last year's declaration is laid out with make-prior-fixtures.mjs's helpers. Every
// page says it is a made-up document. Nothing here is a real person, company or account.
import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { deflateSync } from 'node:zlib';
import * as prettier from 'prettier';
import {
  code128Matrix,
  ECH0196_NS,
  isin,
  macroSegments,
  pdf,
  pdf417Matrix,
  render,
  stream,
  TXAB_NS_ELM5,
  txabSymbols,
  txabZip,
  vectorBarcode,
} from '../../../packages/intake/test/barcode-fixtures.mjs';
import {
  document as declarationPdf,
  footer as declarationFooter,
  GETAX,
  header as declarationHeader,
  lines as declarationLines,
} from '../make-prior-fixtures.mjs';
import { KITS, ISSUERS } from './kits.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const FICTION = 'Document fictif : toutes les données sont inventées (kit de test Taxpresso).';

// ---- Amounts and dates -------------------------------------------------------------------------

/** 1234567 centimes -> "12'345.67" (Swiss, straight apostrophe). */
export function money(c) {
  const neg = c < 0;
  const s = (Math.abs(c) / 100).toFixed(2);
  const [i, d] = s.split('.');
  return `${neg ? '-' : ''}${i.replace(/\B(?=(\d{3})+(?!\d))/g, "'")}.${d}`;
}
const francs = (c) => money(c).slice(0, -3);
const dmy = (iso) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`;
const xmlMoney = (c) => (c / 100).toFixed(2);

// ---- PDF pages ---------------------------------------------------------------------------------

const esc = (s) => s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
/** Helvetica widths per 1000 em for what amounts are made of (right alignment). */
const WIDTH = { "'": 191, '.': 278, ',': 278, '-': 333, ' ': 278, ':': 278 };
const width = (text, size, bold) =>
  ([...text].reduce((w, c) => w + (WIDTH[c] ?? (/[A-Z]/.test(c) ? 667 : 556)), 0) *
    size *
    (bold ? 1.05 : 1)) /
  1000;

function latin1(s) {
  const out = s.replace(/[’‘]/g, "'").replace(/[–—]/g, '-').replace(/ /g, ' ');
  for (const ch of out) if (ch.charCodeAt(0) > 0xff) throw new Error(`not WinAnsi: ${ch} in ${s}`);
  return out;
}

class Page {
  constructor() {
    this.ops = [];
    this.images = [];
  }
  text(x, y, s, { size = 9, bold = false, align } = {}) {
    const t = latin1(String(s));
    const at = align === 'right' ? x - width(t, size, bold) : x;
    this.ops.push(
      `BT /${bold ? 'F2' : 'F1'} ${size} Tf ${at.toFixed(2)} ${y.toFixed(2)} Td (${esc(t)}) Tj ET`,
    );
    return this;
  }
  line(x1, y1, x2, y2, w = 0.5) {
    this.ops.push(`q ${w} w ${x1} ${y1} m ${x2} ${y2} l S Q`);
    return this;
  }
  frame(x, y, w, h, lw = 0.5) {
    this.ops.push(`q ${lw} w ${x} ${y} ${w} ${h} re S Q`);
    return this;
  }
  check(x, y, on) {
    this.frame(x, y, 8, 8);
    if (on) this.text(x + 1.5, y + 1.2, 'X', { size: 8, bold: true });
    return this;
  }
  raw(ops) {
    this.ops.push(ops);
    return this;
  }
  image(img, x, y, w, h) {
    const name = `Im${this.images.length + 1}`;
    this.images.push({ name, img });
    this.ops.push(`q ${w} 0 0 ${h} ${x} ${y} cm /${name} Do Q`);
    return this;
  }
}

/** A letter's top: the sender at the left, the addressee at the right, the place and date. */
function letterhead(page, from, to, place, date) {
  page.text(50, 790, from.name, { size: 11, bold: true });
  page.text(50, 776, from.street);
  page.text(50, 765, `${from.zip} ${from.city}`);
  let y = 720;
  for (const l of to) {
    page.text(340, y, l);
    y -= 12;
  }
  page.text(340, 660, `${place}, le ${date}`);
  return page;
}

function finish(page, n, total) {
  page.line(50, 52, 545, 52, 0.3);
  page.text(50, 40, FICTION, { size: 7 });
  page.text(545, 40, `Page ${n}/${total}`, { size: 7, align: 'right' });
  return page;
}

/** A table of rows [label, amount], amounts right-aligned at x = 545. */
function rows(page, y, list, { size = 9, gap = 15, boldLast = false } = {}) {
  list.forEach(([label, amount], i) => {
    const bold = boldLast && i === list.length - 1;
    if (bold) page.line(380, y + gap - 3, 545, y + gap - 3, 0.4);
    page.text(60, y, label, { size, bold });
    if (amount !== undefined && amount !== '')
      page.text(545, y, amount, { size, bold, align: 'right' });
    y -= gap;
  });
  return y;
}

/** Builds the PDF of pages (fonts F1 Helvetica and F2 Helvetica-Bold, images as XObjects). */
function buildPdf(pages) {
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
  ];
  const kids = [];
  for (const p of pages) {
    const pageIndex = objects.length + 1;
    objects.push('');
    const xobjects = p.images.map(({ name, img }) => {
      objects.push(stream(img.dict, img.data));
      return `/${name} ${objects.length} 0 R`;
    });
    objects.push(
      stream('/Filter /FlateDecode', deflateSync(Buffer.from(p.ops.join('\n'), 'latin1'))),
    );
    const contents = objects.length;
    objects[pageIndex - 1] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842]${p.rotate ? ` /Rotate ${p.rotate}` : ''} /Resources << /Font << /F1 3 0 R /F2 4 0 R >>${xobjects.length ? ` /XObject << ${xobjects.join(' ')} >>` : ''} >> /Contents ${contents} 0 R >>`;
    kids.push(`${pageIndex} 0 R`);
  }
  objects[1] = `<< /Type /Pages /Kids [${kids.join(' ')}] /Count ${pages.length} >>`;
  return pdf(objects);
}

const grayImage = (img) => ({
  dict: `/Type /XObject /Subtype /Image /Width ${img.width} /Height ${img.height} /ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /FlateDecode`,
  data: deflateSync(Buffer.from(img.data)),
});

// ---- People and households ---------------------------------------------------------------------

const person = (kit, id) => kit.people.find((p) => p.id === id);
const fullName = (p) => `${p.first} ${p.last}`;
const householdLines = (kit) => {
  const names =
    kit.people.length === 2 && kit.people[0].last === kit.people[1].last
      ? `${kit.people[0].first} et ${kit.people[1].first} ${kit.people[0].last}`
      : kit.people.map(fullName).join(' et ');
  return [names, kit.address.street, `${kit.address.zip} ${kit.address.city}`];
};
const personLines = (kit, p) => [
  fullName(p),
  kit.address.street,
  `${kit.address.zip} ${kit.address.city}`,
];
const slugName = (s) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

// ---- Salary and pension certificates (federal form 11, with the Swissdec barcode) --------------

/** The TxAB XML of one certificate (SalaryDeclarationTxAB, ELM 5.0), form S or A. */
function txab(kit, year, p, c, form) {
  const e = c.employer;
  const docId = `TXPRS-${year}-${slugName(kit.slug).slice(0, 8)}-${p.id}-${form}`;
  const s = [
    `<DocID>${docId}</DocID>`,
    `<Period><from>${year}-01-01</from><until>${year}-12-31</until></Period>`,
  ];
  if (form === 'S') {
    if (c.canteen) s.push('<CanteenLunchCheck/>');
    s.push(
      `<Income>${xmlMoney(c.base)}</Income>`,
      `<GrossIncome>${xmlMoney(c.gross)}</GrossIncome>`,
      `<AHV-ALV-NBUV-AVS-AC-AANP-Contribution>${xmlMoney(c.social)}</AHV-ALV-NBUV-AVS-AC-AANP-Contribution>`,
      `<BVG-LPP-Contribution><Regular>${xmlMoney(c.lppOrdinary)}</Regular></BVG-LPP-Contribution>`,
      `<NetIncome>${xmlMoney(c.gross - c.social - c.lppOrdinary)}</NetIncome>`,
    );
    if (c.sourceTax) s.push(`<DeductionAtSource>${xmlMoney(c.sourceTax)}</DeductionAtSource>`);
    s.push(
      `<Contact><HR-RC-Name>${e.name}</HR-RC-Name><Address><Street>${e.street}</Street><ZIP-Code>${e.zip}</ZIP-Code><City>${e.city}</City></Address><Person>Service du personnel</Person><PhoneNumber>000 000 00 00</PhoneNumber></Contact>`,
    );
  } else {
    s.push(
      `<Income>${xmlMoney(c.amount)}</Income>`,
      `<GrossIncome>${xmlMoney(c.amount)}</GrossIncome>`,
      `<NetIncome>${xmlMoney(c.amount)}</NetIncome>`,
    );
  }
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<T xmlns="${TXAB_NS_ELM5}" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" SID="000" SysV="001">`,
    `<Company HR-RC-Name="${e.name}" ZIP="${e.zip}" Person="Service du personnel"/>`,
    `<PersonID Lastname="${p.last}" Firstname="${p.first}" ZIP="${kit.address.zip}" Street="${kit.address.street.replace(/'/g, '&apos;')}" City="${kit.address.city}" Country="CH"><SV-AS-Nr>${p.ahv}</SV-AS-Nr></PersonID>`,
    `<${form}>${s.join('')}</${form}>`,
    '</T>',
  ].join('\n');
}

/** Federal form 11, laid out like the printed form, with its barcode at the bottom. */
async function form11(kit, year, p, c, form) {
  const page = new Page();
  const pension = form === 'A';
  const e = c.employer;
  page.text(50, 805, 'Certificat de salaire / Attestation de rentes', { size: 13, bold: true });
  page.text(420, 805, 'Formulaire 11', { size: 8 });
  page.check(50, 782, !pension).text(62, 783, 'A  Certificat de salaire');
  page.check(220, 782, pension).text(232, 783, 'B  Attestation de rentes');
  page.text(50, 764, 'C  Numéro AVS');
  page.text(160, 764, p.ahv);
  page.text(300, 764, 'Date de naissance');
  page.text(400, 764, dmy(p.born));
  page.text(50, 749, 'D  Année');
  page.text(160, 749, String(year));
  page.text(300, 749, `E  Période du 01.01.${year} au 31.12.${year}`);
  page
    .check(50, 731, false)
    .text(62, 732, 'F  Transport gratuit entre le domicile et le lieu de travail');
  page.check(50, 717, !!c.canteen).text(62, 718, 'G  Repas à la cantine / chèques-repas');
  page.text(340, 732, 'H', { bold: true });
  personLines(kit, p).forEach((l, i) => page.text(352, 732 - i * 11, l));
  page.line(50, 700, 545, 700);
  const net = pension ? c.amount : c.gross - c.social - c.lppOrdinary;
  const lines = pension
    ? [
        ['1.  Salaire / Rente', money(c.amount)],
        ['8.  Salaire brut total / Rente', money(c.amount)],
        ['11. Salaire net / Rente', money(net)],
        ['12. Retenue de l’impôt à la source', ''],
      ]
    : [
        ['1.  Salaire / Rente', money(c.base)],
        ['2.  Prestations salariales accessoires', ''],
        ['3.  Prestations non périodiques', ''],
        ['4.  Prestations en capital', ''],
        ['7.  Autres prestations', ''],
        ['8.  Salaire brut total / Rente', money(c.gross)],
        ['9.  Cotisations AVS/AI/APG/AC/AANP', `- ${money(c.social)}`],
        [
          '10. Prévoyance professionnelle 2e pilier  10.1 Cotisations ordinaires',
          `- ${money(c.lppOrdinary)}`,
        ],
        ['                                             10.2 Cotisations pour le rachat', ''],
        ['11. Salaire net / Rente', money(net)],
        ['12. Retenue de l’impôt à la source', c.sourceTax ? money(c.sourceTax) : ''],
        ['13. Allocations pour frais', ''],
        ['15. Observations', pension ? '' : 'Activité à 100 %, toute l’année.'],
      ];
  let y = 684;
  for (const [label, amount] of lines) {
    page.text(56, y, label);
    if (amount) page.text(545, y, amount, { align: 'right' });
    page.line(50, y - 5, 545, y - 5, 0.2);
    y -= 17;
  }
  y -= 8;
  page.text(
    50,
    y,
    'I  Lieu et date, données exactes et complètes, y compris adresse et téléphone',
    { size: 8 },
  );
  page.text(
    50,
    y - 13,
    `${e.name}, ${e.street}, ${e.zip} ${e.city}  -  ${e.city}, le 20.01.${year + 1}`,
    { bold: true },
  );
  page.text(50, y - 25, 'Service du personnel, tél. 000 000 00 00 (numéro fictif)', { size: 8 });
  // The barcode, as payroll software draws it: filled rectangles, with room around it.
  const [symbol] = txabSymbols(txabZip(txab(kit, year, p, c, form)), {
    id: [0x51, form === 'A' ? 0x41 : 0x53, kit.people.indexOf(p) + 1, year % 100],
  });
  const matrix = await pdf417Matrix(symbol, { columns: 12 });
  const module = 0.9;
  const row = 2.4;
  const top = Math.min(y - 50, 75 + matrix.rows * row);
  if (top - matrix.rows * row < 62) throw new Error(`barcode too tall for ${kit.slug} ${p.id}`);
  page.raw(vectorBarcode(matrix, { x: 60, y: top, module, row }));
  page.text(60 + matrix.cols * module + 20, top - 10, 'Code-barres 2D (Swissdec)', { size: 7 });
  return buildPdf([finish(page, 1, 1)]);
}

// ---- eCH-0196 e-tax statement --------------------------------------------------------------------

function statementXml(kit, year, st) {
  const holder = st.person === 'household' ? kit.people[0] : person(kit, st.person);
  const accountsValue = st.accounts.reduce((s, a) => s + a.balance, 0);
  const secs = st.securities.map((x, i) => {
    const value = Math.round(x.quantity * x.unitPrice * 100);
    return {
      ...x,
      isin: isin(x.isinPrefix),
      value,
      ia: Math.round(x.dividend * 0.35),
      positionId: i + 1,
    };
  });
  for (const x of secs) if (x.dividend % 20 !== 0) throw new Error('dividend: IA must be exact');
  const secValue = secs.reduce((s, x) => s + x.value, 0);
  const revA = secs.reduce((s, x) => s + x.dividend, 0);
  const ia = secs.reduce((s, x) => s + x.ia, 0);
  const total = accountsValue + secValue;
  const accounts = st.accounts
    .map(
      (
        a,
      ) => `    <bankAccount iban="${a.iban}" bankAccountName="${a.name}" bankAccountCountry="CH" bankAccountCurrency="CHF" totalTaxValue="${xmlMoney(a.balance)}" totalGrossRevenueA="0" totalGrossRevenueB="0" totalWithHoldingTaxClaim="0">
      <taxValue referenceDate="${year}-12-31" balanceCurrency="CHF" balance="${xmlMoney(a.balance)}" value="${xmlMoney(a.balance)}"/>
    </bankAccount>`,
    )
    .join('\n');
  const securities = secs
    .map(
      (
        x,
      ) => `      <security positionId="${x.positionId}" isin="${x.isin}" valorNumber="${x.valor}" country="CH" currency="CHF" quotationType="PIECE" securityCategory="${x.category ?? 'FUND'}" securityName="${x.name}">
        <taxValue referenceDate="${year}-12-31" quotationType="PIECE" quantity="${x.quantity}" balanceCurrency="CHF" unitPrice="${x.unitPrice.toFixed(2)}" balance="${xmlMoney(x.value)}" value="${xmlMoney(x.value)}" kursliste="true"/>
        <payment paymentDate="${year}-${x.paid ?? '05-15'}" quotationType="PIECE" quantity="${x.quantity}" amountCurrency="CHF" amount="${xmlMoney(x.dividend)}" grossRevenueA="${xmlMoney(x.dividend)}" grossRevenueB="0" withHoldingTaxClaim="${xmlMoney(x.ia)}"/>
        <stock referenceDate="${year}-01-01" mutation="false" quotationType="PIECE" quantity="${x.quantity}" balanceCurrency="CHF"/>
      </security>`,
    )
    .join('\n');
  const id = `CH0000100TXPRS${String(kit.people[0].ahv.replace(/\D/g, '')).slice(-8)}${year}123101`;
  return {
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<taxStatement xmlns="${ECH0196_NS}" minorVersion="2" id="${id}" creationDate="${year + 1}-01-18T10:00:00" taxPeriod="${year}" periodFrom="${year}-01-01" periodTo="${year}-12-31" country="CH" canton="GE" totalTaxValue="${xmlMoney(total)}" totalGrossRevenueA="${xmlMoney(revA)}" totalGrossRevenueB="0" totalWithHoldingTaxClaim="${xmlMoney(ia)}">
  <institution name="${st.bank.name}"/>
  <client clientNumber="${st.client}" firstName="${holder.first}" lastName="${holder.last}"/>
  <listOfBankAccounts totalTaxValue="${xmlMoney(accountsValue)}" totalGrossRevenueA="0" totalGrossRevenueB="0" totalWithHoldingTaxClaim="0">
${accounts}
  </listOfBankAccounts>
  <listOfSecurities totalTaxValue="${xmlMoney(secValue)}" totalGrossRevenueA="${xmlMoney(revA)}" totalGrossRevenueB="0" totalWithHoldingTaxClaim="${xmlMoney(ia)}" totalLumpSumTaxCredit="0" totalNonRecoverableTax="0" totalAdditionalWithHoldingTaxUSA="0" totalGrossRevenueIUP="0" totalGrossRevenueConversion="0">
    <depot depotNumber="${st.depot}">
${securities}
    </depot>
  </listOfSecurities>
</taxStatement>`,
    total,
    accountsValue,
    secs,
    revA,
    ia,
    holder,
  };
}

async function statement(kit, year, st) {
  const s = statementXml(kit, year, st);
  const segments = macroSegments(deflateSync(Buffer.from(s.xml, 'utf8'), { level: 9 }), {
    fileId: [101, kit.people[0].ahv.slice(-2) * 1, year % 1000, 7],
    fileName: `CH0000100TXPRS${year}`,
  });
  const pageCode = async (n, sheet) =>
    vectorBarcode(await code128Matrix(`1962210000${String(n).padStart(3, '0')}${sheet}01`), {
      x: 380,
      y: 822,
      module: 0.5,
      row: 16,
    });
  const p1 = new Page();
  letterhead(p1, st.bank, householdLines(kit), 'Genève', `18.01.${year + 1}`);
  p1.text(50, 620, `Relevé fiscal ${year} (e-relevé fiscal, eCH-0196)`, { size: 13, bold: true });
  p1.text(
    50,
    604,
    `Client ${st.client}  -  dépôt ${st.depot}  -  période du 01.01.${year} au 31.12.${year}`,
  );
  let y = 576;
  p1.text(50, y, 'Comptes', { bold: true });
  y = rows(
    p1,
    y - 16,
    st.accounts.map((a) => [
      `${a.name}, IBAN ${a.iban.replace(/(.{4})/g, '$1 ').trim()}, solde au 31.12.${year}`,
      money(a.balance),
    ]),
  );
  p1.text(60, y, 'Intérêts crédités en ' + year, { size: 8 });
  p1.text(545, y, '0.00', { size: 8, align: 'right' });
  y -= 24;
  p1.text(50, y, 'Titres (valeurs fiscales selon la liste des cours de l’AFC)', { bold: true });
  y = rows(
    p1,
    y - 16,
    s.secs.map((x) => [
      `${x.quantity} x ${x.name}, ISIN ${x.isin}, cours ${x.unitPrice.toFixed(2)}`,
      money(x.value),
    ]),
  );
  y -= 8;
  p1.text(50, y, 'Récapitulation pour la déclaration (état des titres, relevés fiscaux)', {
    bold: true,
  });
  rows(
    p1,
    y - 16,
    [
      ['Rendements bruts soumis à l’impôt anticipé', money(s.revA)],
      ['Rendements bruts non soumis à l’impôt anticipé', '0.00'],
      [`Valeur imposable au 31.12.${year}`, money(s.total)],
      ['Impôt anticipé à récupérer (35 %)', money(s.ia)],
    ],
    { boldLast: false },
  );
  p1.text(
    50,
    140,
    'Les codes-barres de la page 2 contiennent ce relevé pour votre logiciel fiscal.',
    { size: 8 },
  );
  p1.raw(await pageCode(1, 0));
  const p2 = new Page();
  p2.rotate = 90;
  segments.forEach((seg, k) => {
    p2.image(grayImage(render(seg)), 40, 40 + k * 100, 345, 79.4);
  });
  p2.raw(await pageCode(2, 1));
  p2.text(400, 60, 'Codes-barres eCH-0196', { size: 7 });
  return buildPdf([finish(p1, 1, 2), finish(p2, 2, 2)]);
}

// ---- Letters and statements read by Claude -------------------------------------------------------

function letter(from, to, date, title, subtitle, body) {
  const page = new Page();
  letterhead(page, from, to, from.city.replace(/ \d+$/, ''), date);
  page.text(50, 620, title, { size: 13, bold: true });
  if (subtitle) page.text(50, 604, subtitle);
  body(page, 576);
  return page;
}

function pillar3a(kit, year, a) {
  const p = person(kit, a.person);
  const from = a.issuer ?? ISSUERS.pillar3a;
  const page = letter(
    from,
    personLines(kit, p),
    `10.01.${year + 1}`,
    `Attestation ${year} - prévoyance individuelle liée (pilier 3a)`,
    `Compte de prévoyance 3a n° ${a.account ?? `3A-${p.ahv.slice(-5).replace('.', '')}`}`,
    (pg, y) => {
      pg.text(
        50,
        y,
        `Nous attestons avoir reçu de ${fullName(p)}, né(e) le ${dmy(p.born)}, en ${year} :`,
      );
      y = rows(
        pg,
        y - 24,
        [
          ['Cotisations versées du 01.01 au 31.12.' + year, money(a.paid)],
          ['Total déductible selon OPP 3 (art. 7)', money(a.paid)],
        ],
        { boldLast: true },
      );
      pg.text(50, y - 10, 'Cette attestation est à joindre à votre déclaration d’impôt.', {
        size: 8,
      });
    },
  );
  return {
    bytes: buildPdf([finish(page, 1, 1)]),
    values: [['pillar3a.paid', money(a.paid), 1, null]],
  };
}

function healthPremiums(kit, year) {
  const h = kit.years[year].health;
  const from = h.insurer ?? ISSUERS.insurer;
  const total = h.members.reduce((s, m) => s + m.basic + m.supplementary, 0);
  const page = letter(
    from,
    householdLines(kit),
    `15.01.${year + 1}`,
    `Attestation fiscale ${year} - primes d’assurance-maladie`,
    `Police n° ${h.policy ?? 'P-' + kit.people[0].ahv.slice(-5).replace('.', '')}  -  primes payées du 01.01.${year} au 31.12.${year}`,
    (pg, y) => {
      pg.text(60, y, 'Assuré(e)', { bold: true });
      pg.text(330, y, 'LAMal (base)', { bold: true, align: 'right' });
      pg.text(440, y, 'LCA (complém.)', { bold: true, align: 'right' });
      pg.text(545, y, 'Total', { bold: true, align: 'right' });
      y -= 16;
      for (const m of h.members) {
        pg.text(60, y, m.name);
        pg.text(330, y, money(m.basic), { align: 'right' });
        pg.text(440, y, money(m.supplementary), { align: 'right' });
        pg.text(545, y, money(m.basic + m.supplementary), { align: 'right' });
        y -= 15;
      }
      pg.line(380, y + 11, 545, y + 11, 0.4);
      pg.text(60, y, 'Total des primes payées', { bold: true });
      pg.text(545, y, money(total), { bold: true, align: 'right' });
      pg.text(50, y - 26, 'Aucun subside de l’assurance-maladie n’a été déduit de vos primes.', {
        size: 8,
      });
      pg.text(
        50,
        y - 38,
        'Les participations aux coûts (franchise, quote-part) ne sont pas comprises.',
        { size: 8 },
      );
    },
  );
  return {
    bytes: buildPdf([finish(page, 1, 1)]),
    values: [['health.premiums', money(total), 1, null]],
  };
}

function bankAttestation(kit, year, a) {
  const p = a.person === 'household' ? null : person(kit, a.person);
  const page = letter(
    a.bank,
    p ? personLines(kit, p) : householdLines(kit),
    `12.01.${year + 1}`,
    `Attestation d’intérêts et de capital ${year}`,
    `${a.name}, IBAN ${a.iban.replace(/(.{4})/g, '$1 ').trim()}, CHF`,
    (pg, y) => {
      rows(pg, y, [
        [`Solde au 31.12.${year}`, money(a.balance)],
        ['Intérêts bruts crédités en ' + year, money(a.interest)],
        ['Impôt anticipé retenu (35 %)', '0.00'],
        ['Frais de tenue de compte', '0.00'],
      ]);
      pg.text(50, y - 80, 'Intérêts inférieurs à CHF 200 : pas d’impôt anticipé.', { size: 8 });
    },
  );
  return {
    bytes: buildPdf([finish(page, 1, 1)]),
    values: [
      ['bank.account_number', a.iban, 1, null],
      ['bank.currency', 'CHF', 1, null],
      ['bank.balance', money(a.balance), 1, null],
      ['bank.interest_gross', money(a.interest), 1, null],
      ['bank.withholding_swiss', '0.00', 1, null],
    ],
  };
}

function childcareInvoice(kit, year, c) {
  const child = kit.children.find((x) => x.first === c.child);
  const page = letter(
    c.provider,
    householdLines(kit),
    `09.01.${year + 1}`,
    `Récapitulatif annuel ${year} - frais de garde`,
    `Enfant : ${child.first} ${kit.people[0].last}, né(e) le ${dmy(child.born)}`,
    (pg, y) => {
      const months = [
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
      ];
      const monthly = Math.floor(c.amount / 12 / 100) * 100;
      const last = c.amount - monthly * 11;
      pg.text(60, y, `Accueil en crèche, ${c.days ?? 4} jours par semaine (repas non compris)`, {
        size: 8,
      });
      y -= 16;
      months.forEach((m, i) => {
        pg.text(60, y, `Pension ${m} ${year}`, { size: 8 });
        pg.text(545, y, money(i === 11 ? last : monthly), { size: 8, align: 'right' });
        y -= 11;
      });
      pg.line(380, y + 8, 545, y + 8, 0.4);
      pg.text(60, y - 2, `Total payé en ${year}`, { bold: true });
      pg.text(545, y - 2, money(c.amount), { bold: true, align: 'right' });
      pg.text(
        50,
        y - 26,
        'Montants payés par les parents, après déduction des subventions communales.',
        { size: 8 },
      );
    },
  );
  return {
    bytes: buildPdf([finish(page, 1, 1)]),
    values: [['childcare.costs', money(c.amount), 1, null]],
  };
}

function donationReceipt(kit, year, d) {
  const page = letter(
    d.org,
    householdLines(kit),
    `31.01.${year + 1}`,
    `Attestation de dons ${year}`,
    'Association reconnue d’utilité publique, exonérée d’impôt (exemple fictif)',
    (pg, y) => {
      rows(pg, y, [[`Dons reçus de votre part en ${year}`, money(d.amount)]], { boldLast: true });
      pg.text(50, y - 30, 'Merci de votre soutien.', { size: 8 });
    },
  );
  return {
    bytes: buildPdf([finish(page, 1, 1)]),
    values: [['donation.amount', money(d.amount), 1, null]],
  };
}

function avsPension(kit, year, pen) {
  const p = person(kit, pen.person);
  const monthly = pen.amount / 12;
  const page = letter(
    ISSUERS.avs,
    personLines(kit, p),
    `12.01.${year + 1}`,
    `Attestation de rente ${year} - AVS`,
    `Numéro AVS ${p.ahv}`,
    (pg, y) => {
      pg.text(
        50,
        y,
        `Rente de vieillesse versée à ${fullName(p)} du 01.01.${year} au 31.12.${year} :`,
      );
      rows(
        pg,
        y - 24,
        [
          ['Rente mensuelle', money(monthly)],
          ['Nombre de mois', '12'],
          [`Total des rentes versées en ${year}`, money(pen.amount)],
        ],
        { boldLast: true },
      );
      pg.text(
        50,
        y - 90,
        'Rentes AVS / AI : imposables à 100 % (déclaration d’impôt, rubrique 17.10).',
        { size: 8 },
      );
    },
  );
  if (pen.amount % 1200 !== 0) throw new Error('AVS pension: whole francs a month');
  return {
    bytes: buildPdf([finish(page, 1, 1)]),
    values: [
      ['pension.amount', money(pen.amount), 1, null],
      ['pension.type', 'avs_ai', 1, null],
    ],
  };
}

function pensionText(kit, year, pen) {
  const p = person(kit, pen.person);
  const page = letter(
    pen.fund,
    personLines(kit, p),
    `14.01.${year + 1}`,
    `Attestation de rente ${year}`,
    `Rente de vieillesse de la prévoyance professionnelle, assuré(e) n° ${pen.member}`,
    (pg, y) => {
      rows(pg, y, [
        ['Rente de vieillesse annuelle brute', money(pen.amount)],
        [`Versée du 01.01.${year} au 31.12.${year}`, ''],
        ['Début de la rente', dmy(pen.since)],
        ['Impôt à la source retenu', '0.00'],
      ]);
      pg.text(
        50,
        y - 80,
        'Rente de la prévoyance professionnelle (2e pilier), à déclarer sous la rubrique 13.20.',
        { size: 8 },
      );
    },
  );
  return {
    bytes: buildPdf([finish(page, 1, 1)]),
    values: [
      ['pension.amount', money(pen.amount), 1, null],
      ['pension.type', 'occupational', 1, null],
    ],
  };
}

function afcLetter(kit, year, pr) {
  const page = letter(
    ISSUERS.afc,
    householdLines(kit),
    `10.03.${year}`,
    `Valeur locative et valeur fiscale ${year} de votre logement`,
    `Parcelle ${pr.parcel}, commune de ${kit.commune}, ${pr.description}`,
    (pg, y) => {
      pg.text(50, y, 'Madame, Monsieur,');
      pg.text(
        50,
        y - 14,
        `Voici les valeurs de votre logement pour la déclaration d’impôt ${year} :`,
      );
      rows(pg, y - 40, [
        [
          `Valeur fiscale ${year} (capital selon estimation fiscale, y c. la majoration LEFI)`,
          money(pr.taxValue),
        ],
        [`Valeur locative ${year} (valeur locative brute, indexée)`, money(pr.rentalValue)],
      ]);
      pg.text(
        50,
        y - 92,
        'L’abattement pour la durée d’occupation n’est pas déduit de ces valeurs : il est',
        { size: 8 },
      );
      pg.text(50, y - 103, 'calculé dans la déclaration (annexe D, 15.10).', { size: 8 });
      pg.text(50, y - 125, 'Veuillez agréer nos salutations distinguées.', { size: 9 });
    },
  );
  return {
    bytes: buildPdf([finish(page, 1, 1)]),
    values: [
      ['property.tax_value', money(pr.taxValue), 1, null],
      ['property.rental_value', money(pr.rentalValue), 1, null],
      ['property.parcel', pr.parcel, 1, null],
    ],
  };
}

function mortgageStatement(kit, year, m) {
  const page = letter(
    m.lender,
    householdLines(kit),
    `08.01.${year + 1}`,
    `Attestation fiscale ${year} - prêt hypothécaire`,
    `Prêt n° ${m.number}, débiteurs solidaires : ${kit.people.map(fullName).join(' et ')}`,
    (pg, y) => {
      rows(pg, y, [
        [`Solde du prêt au 31.12.${year}`, money(m.balance)],
        [`Intérêts débités en ${year} (taux fixe ${m.rate})`, money(m.interest)],
        ['Amortissement indirect', 'aucun'],
      ]);
      pg.text(50, y - 70, `Gage : logement en PPE, parcelle ${m.parcel}, ${kit.commune}.`, {
        size: 8,
      });
    },
  );
  return {
    bytes: buildPdf([finish(page, 1, 1)]),
    values: [
      ['debt.interest', money(m.interest), 1, null],
      ['debt.balance', money(m.balance), 1, null],
    ],
  };
}

function businessAccounts(kit, year, b) {
  const p = person(kit, b.person);
  const revenue = b.turnover;
  const costs = b.costsOther + b.depreciation;
  const profit = revenue - costs;
  const page = letter(
    { name: b.name, street: kit.address.street, zip: kit.address.zip, city: kit.address.city },
    personLines(kit, p),
    `28.02.${year + 1}`,
    `Comptes ${year} (comptabilité simplifiée)`,
    `Raison individuelle de ${fullName(p)}  -  exercice du 01.01.${year} au 31.12.${year}`,
    (pg, y) => {
      pg.text(50, y, 'Compte de résultat', { bold: true });
      y = rows(
        pg,
        y - 16,
        [
          ['Chiffre d’affaires (honoraires facturés)', money(b.turnover)],
          [
            'Frais généraux (loyer du bureau, logiciels, téléphone, assurances)',
            `- ${money(b.costsOther)}`,
          ],
          ['Amortissements (matériel informatique)', `- ${money(b.depreciation)}`],
          ['Bénéfice de l’exercice', money(profit)],
        ],
        { boldLast: true },
      );
      pg.text(
        60,
        y + 2,
        'Les cotisations AVS personnelles ne sont pas comptabilisées dans ce résultat.',
        { size: 8 },
      );
      y -= 26;
      pg.text(50, y, `Bilan au 31.12.${year}`, { bold: true });
      rows(
        pg,
        y - 16,
        [
          ['Actifs circulants (compte commercial, débiteurs)', money(b.currentAssets)],
          ['Actifs immobilisés (matériel)', money(b.fixedAssets)],
          ['Dettes (créanciers)', money(b.liabilities)],
          ['Capital propre', money(b.currentAssets + b.fixedAssets - b.liabilities)],
        ],
        { boldLast: true },
      );
    },
  );
  return {
    bytes: buildPdf([finish(page, 1, 1)]),
    values: [
      ['business.name', b.name, 1, null],
      ['business.period_from', `01.01.${year}`, 1, null],
      ['business.period_to', `31.12.${year}`, 1, null],
      ['business.turnover', money(b.turnover), 1, null],
      ['business.costs_other', money(b.costsOther), 1, null],
      ['business.depreciation', money(b.depreciation), 1, null],
      ['business.current_assets', money(b.currentAssets), 1, null],
      ['business.fixed_assets', money(b.fixedAssets), 1, null],
      ['business.liabilities', money(b.liabilities), 1, null],
    ],
  };
}

function avsContributions(kit, year, b) {
  const p = person(kit, b.person);
  const quarter = b.avs / 4;
  const page = letter(
    ISSUERS.avs,
    personLines(kit, p),
    `15.01.${year + 1}`,
    `Relevé des cotisations personnelles ${year}`,
    `Indépendant(e), numéro AVS ${p.ahv}`,
    (pg, y) => {
      pg.text(60, y, 'Acomptes AVS/AI/APG/AF/AMat de l’exploitant pour l’année ' + year, {
        bold: true,
      });
      y -= 16;
      ['1er', '2e', '3e', '4e'].forEach((q) => {
        pg.text(60, y, `Acompte du ${q} trimestre ${year}, payé`);
        pg.text(545, y, money(quarter), { align: 'right' });
        y -= 15;
      });
      rows(pg, y, [[`Total des acomptes versés pour ${year}`, money(b.avs)]], { boldLast: true });
      pg.text(
        50,
        y - 30,
        'Aucune cotisation complémentaire pour des années antérieures n’a été facturée.',
        { size: 8 },
      );
    },
  );
  if (b.avs % 400 !== 0) throw new Error('AVS instalments: quarters in whole centimes');
  return {
    bytes: buildPdf([finish(page, 1, 1)]),
    values: [['avs.contributions_year', money(b.avs), 1, null]],
  };
}

// ---- Interactive Brokers Flex Query ---------------------------------------------------------------

function ibkrFlex(kit, year, br) {
  const p = person(kit, br.person);
  const ymd = (m, d) => `${year}${m}${d}`;
  const positions = br.positions
    .map((x, i) => {
      const id = isin(x.isinPrefix);
      return `        <OpenPosition accountId="${br.account}" currency="CHF" fxRateToBase="1" assetCategory="STK" symbol="${x.symbol}" description="${x.name.toUpperCase()}" conid="${700001 + i}" securityID="${id}" securityIDType="ISIN" isin="${id}" listingExchange="EBS" issuerCountryCode="CH" multiplier="1" reportDate="${ymd('12', '31')}" position="${x.quantity}" markPrice="${x.unitPrice}" positionValue="${(x.quantity * x.unitPrice).toFixed(2)}" side="Long" levelOfDetail="SUMMARY" />`;
    })
    .join('\n');
  let tx = 9100001;
  const cash = br.positions
    .flatMap((x) => {
      const id = isin(x.isinPrefix);
      const per = (x.dividend / x.quantity / 100).toFixed(2);
      const date = ymd(x.month ?? '05', '12');
      const wht = (x.dividend * 0.35) / 100;
      return [
        `        <CashTransaction accountId="${br.account}" currency="CHF" fxRateToBase="1" assetCategory="STK" symbol="${x.symbol}" description="${x.symbol}(${id}) CASH DIVIDEND CHF ${per} PER SHARE (Ordinary Dividend)" conid="" securityID="${id}" securityIDType="ISIN" isin="${id}" issuerCountryCode="CH" dateTime="${date};201000" settleDate="${date}" amount="${(x.dividend / 100).toFixed(2)}" type="Dividends" levelOfDetail="DETAIL" reportDate="${date}" transactionID="${tx++}" />`,
        `        <CashTransaction accountId="${br.account}" currency="CHF" fxRateToBase="1" assetCategory="STK" symbol="${x.symbol}" description="${x.symbol}(${id}) CASH DIVIDEND CHF ${per} PER SHARE - CH TAX" conid="" securityID="${id}" securityIDType="ISIN" isin="${id}" issuerCountryCode="CH" dateTime="${date};201000" settleDate="${date}" amount="-${wht.toFixed(2)}" type="Withholding Tax" levelOfDetail="DETAIL" reportDate="${date}" transactionID="${tx++}" />`,
      ];
    })
    .join('\n');
  return Buffer.from(
    `<?xml version="1.0" encoding="UTF-8"?>
<!-- Made-up Interactive Brokers Flex Query export for a Taxpresso test household: the account,
     the securities (TXPRS ISINs, no real security) and every amount are invented. -->
<FlexQueryResponse queryName="Annual tax ${year}" type="AF">
  <FlexStatements count="1">
    <FlexStatement accountId="${br.account}" fromDate="${ymd('01', '01')}" toDate="${ymd('12', '31')}" period="LastYear" whenGenerated="${year + 1}0110;101500">
      <AccountInformation accountId="${br.account}" acctAlias="" currency="CHF" name="${fullName(p)} (fictive)" accountType="Individual" />
      <OpenPositions>
${positions}
      </OpenPositions>
      <CashTransactions>
${cash}
      </CashTransactions>
    </FlexStatement>
  </FlexStatements>
</FlexQueryResponse>
`,
    'utf8',
  );
}

// ---- Last year's declaration (as GeTax prints it) -------------------------------------------------

function priorDeclaration(kit, year, d) {
  const c = GETAX;
  const yy = String(year).slice(2);
  const [a, b] = kit.people;
  const N = 6;
  const f = (n) => declarationFooter('GeTax', n, N, year);
  const pg1 = [
    [40, 800, `GAPP${yy}-1`, 8],
    [40, 780, `Déclaration d'impôt ${year} des personnes physiques`, 12],
    [40, 762, 'Code déclaration'],
    [200, 762, '0000-0000-0000'],
    [330, 762, 'N° de contribuable'],
    [450, 762, '000.00.0000-0'],
    [40, 740, `Monsieur et Madame ${a.first} et ${b.first} ${a.last.toUpperCase()}`],
    [40, 728, kit.address.street],
    [40, 716, `${kit.address.zip} ${kit.address.city}`],
    [40, 700, 'Commune de domicile'],
    [200, 700, kit.commune],
    [200, 680, 'Contribuable A'],
    [360, 680, 'Contribuable B'],
    [40, 664, 'Nom'],
    [200, 664, a.last.toUpperCase()],
    [360, 664, b.last.toUpperCase()],
    [40, 648, 'Prénom'],
    [200, 648, a.first],
    [360, 648, b.first],
    [40, 632, 'Date de naissance'],
    [200, 632, dmy(a.born)],
    [360, 632, dmy(b.born)],
    [40, 616, 'Etat civil'],
    [200, 616, 'Marié-e'],
    [360, 616, 'Marié-e'],
    [40, 600, 'N° AVS'],
    [200, 600, a.ahv],
    [360, 600, b.ahv],
    [40, 584, 'Profession'],
    [200, 584, a.job],
    [360, 584, b.job],
    [40, 552, 'Enfants à charge'],
    [200, 552, kit.children.map((x) => `${x.first} (${dmy(x.born)})`).join(', ')],
    [40, 120, FICTION, 7],
    ...f(1),
  ];
  const gross = d.salaryA + d.salaryB + d.interest;
  const pg2 = [
    [40, 800, `GAPP${yy}-2`, 8],
    [40, 784, `PG2   Récapitulation   ${year}`, 11],
    ...declarationHeader(c, 764),
    ...declarationLines(c, 764, [
      [
        '11.00',
        "Revenus de l'activité dépendante c.A",
        { annex: 'A1', icc: francs(d.salaryA), ifd: francs(d.salaryA) },
      ],
      [
        '21.00',
        "Revenus de l'activité dépendante c.B",
        { annex: 'A2', icc: francs(d.salaryB), ifd: francs(d.salaryB) },
      ],
      [
        '14.00',
        'Revenus de la fortune mobilière',
        { annex: 'F 1', icc: francs(d.interest), ifd: francs(d.interest) },
      ],
      ['91.00', 'Total des revenus bruts', { icc: francs(gross), ifd: francs(gross) }],
    ]),
    ...f(2),
  ];
  const pg3 = [
    [40, 800, `GAPP${yy}-3`, 8],
    [40, 784, `PG3   Récapitulation   ${year}`, 11],
    ...declarationHeader(c, 764),
    ...declarationLines(c, 764, [
      ['91.00', 'Report du total des revenus bruts', { icc: francs(gross), ifd: francs(gross) }],
      [
        '52.00',
        "Primes d'assurances",
        { annex: 'C3', icc: francs(d.premiums), ifd: francs(d.insuranceIfd) },
      ],
      [
        '59.00',
        'Autres déductions',
        { annex: 'C4', icc: francs(d.childcare), ifd: francs(d.childcare) },
      ],
      ['73.10', 'Dons ICC', { icc: francs(d.donation) }],
      ['73.20', 'Dons IFD', { ifd: francs(d.donation) }],
    ]),
    ...f(3),
  ];
  const pg4 = [
    [40, 800, `GAPP${yy}-4`, 8],
    [40, 784, `PG4   Récapitulation   ${year}`, 11],
    [c.icc - 40, 764, 'Fortune'],
    ...declarationLines(c, 764, [
      ['14.00', 'Fortune mobilière brute', { annex: 'F 1', icc: francs(d.savings) }],
      ['91.00', 'Total de la fortune brute', { icc: francs(d.savings) }],
    ]),
    ...f(4),
  ];
  const annex = (n, who, p, s, lpp, p3a, flat) => [
    [40, 800, `GAPP${yy}A${n}`, 8],
    [40, 784, `Annexe A   Activité dépendante   Contribuable ${who}   ${year}`, 11],
    [c.commune - 6, 764, 'Commune'],
    ...declarationHeader(c, 764),
    [c.box - 4, 764, 'Cert.'],
    ...declarationLines(c, 764, [
      [
        who === 'A' ? '11.10' : '21.10',
        `Salaires bruts - ${p.employer}`,
        { commune: kit.communeCode, icc: francs(s), ifd: francs(s), box: '8' },
      ],
      [
        who === 'A' ? '11.00' : '21.00',
        "Total de l'activité dépendante",
        { icc: francs(s), ifd: francs(s) },
      ],
      [
        who === 'A' ? '31.12' : '41.12',
        'Cotisations 2e pilier',
        { icc: francs(lpp), ifd: francs(lpp), box: '10.1' },
      ],
      [
        who === 'A' ? '31.40' : '41.40',
        'Cotisations 3e pilier A',
        { icc: francs(p3a), ifd: francs(p3a) },
      ],
      [
        who === 'A' ? '31.50' : '41.50',
        'Déduction forfaitaire ICC frais prof.',
        { icc: francs(flat) },
      ],
    ]),
    ...f(4 + n),
  ];
  return declarationPdf([
    pg1,
    pg2,
    pg3,
    pg4,
    annex(1, 'A', { employer: d.employerA }, d.salaryA, d.lppA, d.p3aA, d.flatA),
    annex(2, 'B', { employer: d.employerB }, d.salaryB, d.lppB, d.p3aB, d.flatB),
  ]);
}

// ---- One kit, one year ----------------------------------------------------------------------------

/**
 * Every document of a kit for a year, in the order a household would gather them: what it is,
 * whose, how Taxpresso reads it (barcode, export, last year's declaration, or Claude), and for
 * the documents Claude reads the values it would propose, with their page and box.
 */
export async function buildDocuments(kit, year) {
  const Y = kit.years[year];
  const docs = [];
  const add = (file, kind, who, read, built, extra = {}) =>
    docs.push({
      file: `${String(docs.length + 1).padStart(2, '0')}-${file}-${year}.${read === 'export' ? 'xml' : 'pdf'}`,
      kind,
      person: who,
      read,
      bytes: Buffer.isBuffer(built) ? built : built.bytes,
      values: Buffer.isBuffer(built) ? undefined : built.values,
      ...extra,
    });
  const last = (id) => slugName(person(kit, id).last);
  const first = (id) => slugName(person(kit, id).first);
  for (const s of Y.salaries ?? []) {
    add(
      `certificat-salaire-${first(s.person)}`,
      'salary_certificate',
      s.person,
      'barcode',
      await form11(kit, year, person(kit, s.person), s, 'S'),
    );
  }
  for (const pen of Y.pensions ?? []) {
    if (pen.type === 'avs_ai')
      add(
        `rente-avs-${first(pen.person)}`,
        'pension_certificate',
        pen.person,
        'claude',
        avsPension(kit, year, pen),
      );
    else if (pen.barcode)
      add(
        `attestation-rente-caisse-pension-${first(pen.person)}`,
        'pension_certificate',
        pen.person,
        'barcode',
        await form11(kit, year, person(kit, pen.person), { ...pen, employer: pen.fund }, 'A'),
      );
    else
      add(
        `attestation-rente-caisse-pension-${first(pen.person)}`,
        'pension_certificate',
        pen.person,
        'claude',
        pensionText(kit, year, pen),
      );
  }
  for (const b of Y.businesses ?? []) {
    add(
      `comptes-${slugName(b.name)}`,
      'business_accounts',
      b.person,
      'claude',
      businessAccounts(kit, year, b),
    );
    add(
      `cotisations-avs-${first(b.person)}`,
      'avs_contributions',
      b.person,
      'claude',
      avsContributions(kit, year, b),
    );
  }
  for (const a of Y.pillar3a ?? [])
    add(
      `attestation-3a-${first(a.person)}`,
      'pillar3a_attestation',
      a.person,
      'claude',
      pillar3a(kit, year, a),
    );
  if (Y.health)
    add(
      'primes-assurance-maladie',
      'health_premiums',
      'household',
      'claude',
      healthPremiums(kit, year),
    );
  for (const c of Y.childcare ?? [])
    add(
      `creche-${slugName(c.child)}`,
      'childcare_invoice',
      'household',
      'claude',
      childcareInvoice(kit, year, c),
      { child: c.child },
    );
  for (const d of Y.donations ?? [])
    add(
      'attestation-dons',
      'donation_receipt',
      'household',
      'claude',
      donationReceipt(kit, year, d),
    );
  for (const st of Y.statements ?? [])
    add(
      `releve-fiscal-${slugName(st.bank.name)}`,
      'ech0196_statement',
      st.person,
      'barcode',
      await statement(kit, year, st),
      { owner: st.person },
    );
  for (const a of Y.bankAccounts ?? [])
    add(
      `attestation-bancaire-${slugName(a.bank.name)}`,
      'bank_attestation',
      a.person,
      'claude',
      bankAttestation(kit, year, a),
    );
  for (const br of Y.brokers ?? [])
    add(
      `interactive-brokers-${last(br.person)}`,
      'broker_export',
      br.person,
      'export',
      ibkrFlex(kit, year, br),
      {
        official: br.positions.map((x) => ({
          security: isin(x.isinPrefix),
          officialValue: money(Math.round(x.quantity * x.unitPrice * 100)),
          from: `Liste des cours AFC ${year} : CHF ${x.unitPrice.toFixed(2)} x ${x.quantity}`,
        })),
      },
    );
  if (Y.property)
    add(
      'valeurs-logement-afc',
      'property_values',
      'household',
      'claude',
      afcLetter(kit, year, Y.property),
    );
  for (const m of Y.mortgages ?? [])
    add(
      `pret-hypothecaire-${slugName(m.lender.name)}`,
      'mortgage_statement',
      'household',
      'claude',
      mortgageStatement(kit, year, m),
    );
  if (Y.prior) {
    docs.push({
      file: `${String(docs.length + 1).padStart(2, '0')}-declaration-${year - 1}.pdf`,
      kind: 'prior_declaration',
      person: 'household',
      read: 'prior',
      bytes: priorDeclaration(kit, year - 1, Y.prior),
    });
  }
  return docs;
}

/** What Claude would propose for the documents without a barcode (extracted.json, one year). */
export function extractedFor(kit, year, docs) {
  return docs.map((d) => {
    const base = { file: d.file, kind: d.kind, read: d.read };
    if (d.read === 'barcode') {
      return {
        ...base,
        note: 'Read from its barcode by Taxpresso: Claude reads nothing.',
        ...(kit.people.length > 1 && d.kind !== 'ech0196_statement' ? { owner: d.person } : {}),
      };
    }
    if (d.read === 'export') {
      return {
        ...base,
        note: 'Read as a broker export by Taxpresso. The user confirms its values and gives each security’s official value from the ESTV price list (set_holding).',
        official: d.official,
      };
    }
    if (d.read === 'prior') {
      return {
        ...base,
        note: 'Last year’s declaration, read by Taxpresso on this computer: its answers come back as suggestions.',
      };
    }
    return {
      ...base,
      person: d.person,
      taxYear: year,
      values: d.values.map(([key, value, page, box]) => ({
        key,
        value,
        page,
        ...(box ? { box } : {}),
      })),
    };
  });
}

/** household.json: the answers to the questions, as answer_question takes them. */
export function householdFor(kit) {
  return {
    kit: kit.slug,
    household: kit.title,
    note: 'The answers this invented household gives, as answer_question takes them (id: value). Money in francs. The same for 2025 and 2026.',
    answers: kit.answers,
  };
}

function readme(kit, docs) {
  const people = kit.people
    .map(
      (p) =>
        `- ${fullName(p)}, born ${dmy(p.born)}${p.job ? `, ${p.job.replace(/ \(fictive?\)/, '')}` : ''}`,
    )
    .join('\n');
  const kids = (kit.children ?? []).map((c) => `- ${c.first}, born ${dmy(c.born)}`).join('\n');
  return `# ${kit.title}

An invented Geneva household for testing Taxpresso end to end. Nobody here is real: the names, birth
dates, AHV numbers (756.0000...), address, employers, banks, insurers, account numbers and amounts
are all made up, and every document says so at the bottom of its pages.

${kit.story}

${people}${kids ? `\n\nChildren:\n\n${kids}` : ''}

Commune: ${kit.commune}.

## Documents (tax year 2025)

${docs.map((d) => `- \`documents/${d.file}\`: ${DOC_WORDS[d.kind]}${d.read === 'barcode' ? ' (read from its barcode)' : d.read === 'export' ? ' (read as a broker export)' : d.read === 'prior' ? ' (last year’s declaration, gives suggestions)' : ' (read by Claude, values in extracted.json)'}`).join('\n')}

## Files

- \`household.json\`: the answers to Taxpresso's questions.
- \`extracted.json\`: what Claude would read in the documents without a barcode, per year, with page.
- \`expected.json\`: the tax worked out by hand from the official documents, for 2025 and 2026, each
  figure with how it was obtained and its source (ground-truth.mjs).

Written by \`node test/fixtures/households/make.mjs\` and \`node test/fixtures/households/ground-truth.mjs\`.
`;
}

const DOC_WORDS = {
  salary_certificate: 'salary certificate (certificat de salaire, form 11)',
  pension_certificate: 'pension certificate (attestation de rente)',
  pillar3a_attestation: 'pillar 3a attestation',
  health_premiums: 'health insurance premiums of the year',
  childcare_invoice: 'crèche, yearly statement of the fees paid',
  donation_receipt: 'donation receipt',
  ech0196_statement: 'bank e-tax statement (e-relevé fiscal, eCH-0196)',
  bank_attestation: 'bank statement on 31 December (interest and balance)',
  broker_export: 'Interactive Brokers Flex Query export (XML)',
  property_values: 'the AFC’s letter with the flat’s tax value and rental value',
  mortgage_statement: 'mortgage statement (interest and balance)',
  business_accounts: 'the business’s accounts (simple bookkeeping)',
  avs_contributions: 'AVS contributions statement of a self-employed person',
  prior_declaration: 'last year’s declaration, printed by GeTax',
};

/** JSON as the repo's prettier writes it, so the format check passes on generated files. */
export async function writeJson(file, value) {
  const options = (await prettier.resolveConfig(file)) ?? {};
  writeFileSync(file, await prettier.format(JSON.stringify(value), { ...options, parser: 'json' }));
}

export async function writeKit(kit) {
  const dir = path.join(here, kit.slug);
  const docsDir = path.join(dir, 'documents');
  rmSync(docsDir, { recursive: true, force: true });
  mkdirSync(docsDir, { recursive: true });
  const docs = await buildDocuments(kit, 2025);
  for (const d of docs) writeFileSync(path.join(docsDir, d.file), d.bytes);
  const extracted = {
    kit: kit.slug,
    note: 'What Claude would propose with propose_extraction for each document without a barcode, per tax year (the 2026 documents are written by the end-to-end test with make.mjs). Money as printed on the document.',
    years: {},
  };
  for (const year of Object.keys(kit.years).map(Number)) {
    extracted.years[year] = extractedFor(
      kit,
      year,
      year === 2025 ? docs : await buildDocuments(kit, year),
    );
  }
  await writeJson(path.join(dir, 'household.json'), householdFor(kit));
  await writeJson(path.join(dir, 'extracted.json'), extracted);
  writeFileSync(path.join(dir, 'README.md'), readme(kit, docs));
  return docs;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const only = process.argv.slice(2);
  for (const kit of KITS) {
    if (only.length && !only.includes(kit.slug)) continue;
    const docs = await writeKit(kit);
    console.log(
      `${kit.slug}: ${docs.length} documents (${readdirSync(path.join(here, kit.slug, 'documents')).length} files)`,
    );
  }
}
