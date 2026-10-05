import { describe, it, expect } from 'vitest';
import { parseScannedRecipient } from '../qrScan';

const ADDR = '0x683f00000000000000000000000000000000056d';

describe('parseScannedRecipient', () => {
  it('keeps a bare wallet address', () => {
    expect(parseScannedRecipient(` ${ADDR} `)).toBe(ADDR);
  });
  it('extracts the address from an ethereum: URI', () => {
    expect(parseScannedRecipient(`ethereum:${ADDR}@8453`)).toBe(ADDR);
  });
  it('strips mailto: from email QR codes', () => {
    expect(parseScannedRecipient('mailto:a@b.co?subject=x')).toBe('a@b.co');
  });
});
