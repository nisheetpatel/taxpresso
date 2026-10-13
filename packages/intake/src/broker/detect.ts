// Which broker export a file is, from its content (never its name), and the parsed statement.
import {
  isDegiroAccount,
  isDegiroPortfolio,
  parseDegiroAccount,
  parseDegiroPortfolio,
} from './degiro.js';
import { isIbkrFlex, parseIbkrFlex } from './ibkr.js';
import { decodeText } from './text.js';
import type { BrokerFormat, BrokerStatement } from './types.js';

export function detectFormat(text: string): BrokerFormat | undefined {
  if (isIbkrFlex(text)) return 'ibkr_flex_xml';
  if (isDegiroAccount(text)) return 'degiro_account_csv';
  if (isDegiroPortfolio(text)) return 'degiro_portfolio_csv';
  return undefined;
}

/** The broker export format of a file, or undefined if it is not one Taxpresso reads. */
export function detectBrokerExport(bytes: Uint8Array): BrokerFormat | undefined {
  // The first 64 KB, cut after a line break so no UTF-8 character is split.
  let head = bytes.subarray(0, 64 * 1024);
  if (head.length < bytes.length) {
    const nl = head.lastIndexOf(0x0a);
    if (nl > 0) head = head.subarray(0, nl + 1);
  }
  const text = decodeText(head);
  return text === undefined ? undefined : detectFormat(text);
}

/**
 * Reads a broker export. Undefined if the file is not one; a statement with ok = false and a
 * warning if it is one but can't be read. Text in the file is data: nothing in it is followed.
 */
export function parseBrokerExport(bytes: Uint8Array): BrokerStatement | undefined {
  const text = decodeText(bytes);
  if (text === undefined) return undefined;
  switch (detectFormat(text)) {
    case 'ibkr_flex_xml':
      return parseIbkrFlex(text);
    case 'degiro_account_csv':
      return parseDegiroAccount(text);
    case 'degiro_portfolio_csv':
      return parseDegiroPortfolio(text);
    case undefined:
      return undefined;
  }
}
