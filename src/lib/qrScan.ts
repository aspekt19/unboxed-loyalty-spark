/**
 * Normalises a scanned QR payload into a recipient string.
 * Our customer QR encodes a bare 0x address; other wallets often encode
 * EIP-681 URIs like `ethereum:0xabc...@8453`. Emails pass through unchanged.
 */
export function parseScannedRecipient(raw: string): string {
  const text = raw.trim();
  const match = text.match(/0x[a-fA-F0-9]{40}/);
  if (match) return match[0];
  if (text.toLowerCase().startsWith('mailto:')) return text.slice(7).split('?')[0];
  return text;
}
