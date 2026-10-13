import { describe, expect, it } from 'vitest';
import { parseCsv, sniffDelimiter } from '../src/broker/csv.js';
import { detectDateFormat, parseDate } from '../src/broker/dates.js';
import { detectBrokerExport, parseBrokerExport } from '../src/broker/detect.js';
import { fallbackId, isinCountry, isValidIsin } from '../src/broker/isin.js';
import { decodeText } from '../src/broker/text.js';
import { descendants, parseXml, XmlError } from '../src/broker/xml.js';
import { bytes, fixture } from './helpers.js';

describe('CSV', () => {
  it('reads quotes, doubled quotes, line breaks in quotes and CRLF', () => {
    const rows = parseCsv('a,"b,1","say ""hi"""\r\n\r\n"x\ny",2,\n', ',');
    expect(rows).toEqual([
      { line: 1, cells: ['a', 'b,1', 'say "hi"'] },
      { line: 3, cells: ['x\ny', '2', ''] },
    ]);
  });

  it('finds the delimiter from the header', () => {
    expect(sniffDelimiter('Date;Time;"A,B";C')).toBe(';');
    expect(sniffDelimiter('a\tb\tc')).toBe('\t');
    expect(sniffDelimiter('a,b')).toBe(',');
  });
});

describe('XML', () => {
  it('reads elements, attributes, entities and text', () => {
    const root = parseXml(
      '<?xml version="1.0"?><!-- c --><R a="1 &amp; 2"><S b=\'x\'/><S b="&#65;&#x42;">t&lt;</S></R>',
    );
    expect(root.name).toBe('R');
    expect(root.attrs.a).toBe('1 & 2');
    expect(descendants(root, 'S').map((s) => s.attrs.b)).toEqual(['x', 'AB']);
    expect(root.children[1]!.text).toBe('t<');
  });

  it('refuses DTDs, unknown entities and broken documents', () => {
    for (const bad of [
      '<!DOCTYPE r [<!ENTITY x "y">]><r>&x;</r>',
      '<r>&nbsp;</r>',
      '<r><s></r>',
      '<r a="1" a="2"/>',
      '<r/><r/>',
      '<r a=1/>',
      'text',
    ]) {
      expect(() => parseXml(bad), bad).toThrow(XmlError);
    }
  });

  it('stops at its limits', () => {
    expect(() => parseXml('<a><b><c></c></b></a>', { maxElements: 10, maxDepth: 2 })).toThrow(
      /nested too deeply/,
    );
    expect(() => parseXml('<a><b/><b/><b/></a>', { maxElements: 3, maxDepth: 10 })).toThrow(
      /Too many/,
    );
  });
});

describe('dates', () => {
  it('reads one format per file, deciding day or month first from the dates themselves', () => {
    expect(detectDateFormat(['20260101', '20261231', '20270104;093000'])).toBe('ymd');
    expect(detectDateFormat(['2026-01-01', '2027-01-04;10:00:00'])).toBe('ymd-dash');
    expect(detectDateFormat(['01/01/2026', '12/31/2026'])).toBe('mdy');
    expect(detectDateFormat(['01/01/2026', '31/12/2026'])).toBe('dmy');
    expect(detectDateFormat(['01/02/2026', '03/04/2026'])).toBeUndefined();
    expect(detectDateFormat(['31-Dec-26', '01-Oct-26'])).toBe('d-mon-y');
    expect(parseDate('31-OCT-26', 'd-mon-y')).toBe('2026-10-31');
    expect(parseDate('20260230', 'ymd')).toBeUndefined();
    expect(parseDate('31.12.2026', 'dmy-dot')).toBe('2026-12-31');
  });
});

describe('ISIN', () => {
  it('checks the check digit', () => {
    expect(isValidIsin('US0378331005')).toBe(true);
    expect(isValidIsin('CH0038863350')).toBe(true);
    expect(isValidIsin('IE00B4L5Y983')).toBe(true);
    expect(isValidIsin('USTXPRS00017')).toBe(true);
    expect(isValidIsin('USTXPRS00018')).toBe(false);
    expect(isValidIsin('us0378331005')).toBe(false);
    expect(isinCountry('CHTXPRS00026')).toBe('CH');
    expect(isinCountry('XS0000000009')).toBeUndefined();
    expect(fallbackId('degiro', 'Café Crème "X"')).toBe('degiro-Cafe-Creme-X');
  });
});

describe('text', () => {
  it('decodes UTF-8 with a BOM, UTF-16 and Windows-1252, and refuses binaries', () => {
    expect(decodeText(bytes('\ufeffProduit,Quantité'))).toBe('Produit,Quantité');
    const utf16 = Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from('Produkt', 'utf16le')]);
    expect(decodeText(utf16)).toBe('Produkt');
    expect(decodeText(Buffer.from([0x51, 0x75, 0x61, 0x6e, 0x74, 0x69, 0x74, 0xe9]))).toBe(
      'Quantité',
    );
    expect(decodeText(bytes('%PDF-1.7 synthetic'))).toBeUndefined();
    expect(decodeText(Buffer.from([0x41, 0x00, 0x42]))).toBeUndefined();
  });
});

describe('detection from content, never the file name', () => {
  it('recognises each format', () => {
    expect(detectBrokerExport(fixture('dupont-ibkr-2026.xml'))).toBe('ibkr_flex_xml');
    expect(detectBrokerExport(fixture('dupont-ibkr-2026-usd-base.xml'))).toBe('ibkr_flex_xml');
    expect(detectBrokerExport(fixture('dupont-degiro-portfolio.csv'))).toBe('degiro_portfolio_csv');
    expect(detectBrokerExport(fixture('dupont-degiro-account.csv'))).toBe('degiro_account_csv');
  });

  it('recognises headers in other languages and with semicolons', () => {
    expect(
      detectBrokerExport(
        bytes('Produkt;Symbol/ISIN;Anzahl;Schlusskurs;Lokaler Wert;;Wert in CHF\n'),
      ),
    ).toBe('degiro_portfolio_csv');
    expect(
      detectBrokerExport(
        bytes('Datum,Tijd,Valutadatum,Product,ISIN,Omschrijving,FX,Mutatie,,Saldo,,Order Id\n'),
      ),
    ).toBe('degiro_account_csv');
    expect(
      detectBrokerExport(
        bytes(
          'Date,Heure,Date de valeur,Produit,ISIN,Description,FX,Mouvements,,Solde,,ID Ordre\n',
        ),
      ),
    ).toBe('degiro_account_csv');
  });

  it('leaves everything else alone', () => {
    for (const other of [
      '%PDF-1.7 synthetic certificate',
      'Date,Amount\n01.01.2026,12\n',
      '<?xml version="1.0"?><FlexStatementResponse><Status>Fail</Status></FlexStatementResponse>',
      '<html><body>FlexQueryResponse</body></html>',
      '',
    ]) {
      expect(detectBrokerExport(bytes(other)), other).toBeUndefined();
      expect(parseBrokerExport(bytes(other)), other).toBeUndefined();
    }
  });

  it('reports a recognised but broken export instead of dropping it', () => {
    const broken = parseBrokerExport(bytes('<FlexQueryResponse><FlexStatements><FlexStatement'));
    expect(broken).toMatchObject({ format: 'ibkr_flex_xml', ok: false });
    expect(broken!.warnings[0]!.code).toBe('unreadable');
  });
});
