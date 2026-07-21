/**
 * Unlimited API rate-limit bypass (lsk_ + rwk_).
 *
 * Encrypted wallet list ships in-repo as `admin-wallets.bundle` (AES-256-GCM, not reversible without key).
 * Supabase secret (set once in Lovable / Edge env): ADMIN_WALLETS_DECRYPT_KEY — 64-char hex, never commit.
 * Optional: ADMIN_WALLETS_ENCRYPTED overrides bundle; ADMIN_WALLETS — comma-separated extras.
 *
 * Regenerate bundle: python3 scripts/sync-bot-cluster-wallets.py [/path/to/wallets.txt]
 */
import { decryptWalletList } from "./admin-wallets-crypto.ts";

const BUNDLE_FILE = new URL("./admin-wallets.bundle", import.meta.url);

async function loadBundledEncryptedList(): Promise<string | null> {
  try {
    const raw = (await Deno.readTextFile(BUNDLE_FILE)).trim();
    return raw || null;
  } catch (e) {
    if (e instanceof Deno.errors.NotFound) return null;
    console.error("[admin-wallets] bundle read failed:", e);
    return null;
  }
}

function parseEnvAdminWallets(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(/[,\s]+/)
    .map((s) => s.trim().toLowerCase())
    .filter((s) => /^0x[a-f0-9]{40}$/.test(s));
}

async function buildAdminWalletSet(): Promise<Set<string>> {
  const set = new Set<string>();

  for (const w of parseEnvAdminWallets(Deno.env.get("ADMIN_WALLETS"))) {
    set.add(w);
  }

  const key = Deno.env.get("ADMIN_WALLETS_DECRYPT_KEY")?.trim();
  const enc =
    Deno.env.get("ADMIN_WALLETS_ENCRYPTED")?.trim() || (key ? await loadBundledEncryptedList() : null);

  if (enc && key) {
    try {
      for (const w of await decryptWalletList(enc, key)) {
        set.add(w);
      }
    } catch (e) {
      console.error("[admin-wallets] decrypt failed:", e);
    }
  } else if (enc && !key) {
    console.warn("[admin-wallets] encrypted list present but ADMIN_WALLETS_DECRYPT_KEY missing");
  }

  return set;
}

const adminSetPromise = buildAdminWalletSet();

export async function isAdminWallet(address: string | null | undefined): Promise<boolean> {
  if (!address) return false;
  const set = await adminSetPromise;
  return set.has(address.toLowerCase());
}

export async function preloadAdminWallets(): Promise<void> {
  await adminSetPromise;
}
