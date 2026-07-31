/** AES-256-GCM decrypt for bundled wallet list (iv || ciphertext+tag, base64). */

function hexToBytes(hex: string): Uint8Array {
  const h = hex.trim().replace(/^0x/, "");
  if (h.length !== 64 || !/^[0-9a-f]+$/i.test(h)) {
    throw new Error("ADMIN_WALLETS_DECRYPT_KEY must be 32-byte hex (64 chars)");
  }
  const out = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    out[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64.trim());
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export async function decryptWalletList(encB64: string, keyHex: string): Promise<string[]> {
  const raw = b64ToBytes(encB64);
  if (raw.length < 13) throw new Error("Invalid ADMIN_WALLETS_ENCRYPTED blob");
  const iv = raw.slice(0, 12);
  const ciphertext = raw.slice(12);
  const keyBytes = hexToBytes(keyHex);
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyBytes as unknown as BufferSource,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"],
  );
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, cryptoKey, ciphertext);
  const parsed = JSON.parse(new TextDecoder().decode(plain));
  if (!Array.isArray(parsed)) throw new Error("Decrypted wallet list must be a JSON array");
  return parsed
    .map((w) => String(w).trim().toLowerCase())
    .filter((w) => /^0x[a-f0-9]{40}$/.test(w));
}
