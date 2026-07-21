#!/usr/bin/env python3
"""
Build encrypted admin wallet bundle for Edge Functions (committed) + local key backup.

Reads LoyalSparkBot/wallets.txt (+ treasury extras), writes:
  - supabase/functions/_shared/admin-wallets.bundle  (AES-256-GCM base64 — safe to commit)
  - scripts/.admin-wallets.local.json               (gitignored plaintext backup)
  - scripts/.admin-wallets-decrypt.key                (gitignored — copy ONCE to Supabase secret)

Requires: pip install eth-account cryptography
"""
from __future__ import annotations

import base64
import json
import os
import secrets
import sys
from pathlib import Path

try:
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM
    from eth_account import Account
except ImportError:
    print("Install: pip install eth-account cryptography", file=sys.stderr)
    raise

# Optional platform wallets to include in the unlimited cluster (public on-chain anyway)
DEFAULT_EXTRAS = [
    "0x5cc0aa9ed773f413f81f78a62f2e94109ce26205",
    "0x40a8cdd6a10ec1a8cb3dfb2834675e7a2cf4ad8b",
]


def addresses_from_wallets_file(path: Path) -> list[str]:
    out: list[str] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        pk = line if line.startswith("0x") else "0x" + line
        out.append(Account.from_key(pk).address.lower())
    return out


def encrypt_wallet_list(addrs: list[str], key_hex: str | None = None) -> tuple[str, str]:
    key = bytes.fromhex(key_hex) if key_hex else secrets.token_bytes(32)
    if len(key) != 32:
        raise ValueError("Key must be 32 bytes (64 hex chars)")
    aes = AESGCM(key)
    iv = os.urandom(12)
    plaintext = json.dumps(sorted(set(addrs)), separators=(",", ":")).encode("utf-8")
    ciphertext = aes.encrypt(iv, plaintext, None)
    blob = base64.b64encode(iv + ciphertext).decode("ascii")
    return blob, key.hex()


def main() -> None:
    repo = Path(__file__).resolve().parents[1]
    default_wallets = Path.home() / "Desktop" / "LoyalSparkBot" / "wallets.txt"
    wallets_path = Path(sys.argv[1]) if len(sys.argv) > 1 else default_wallets
    if not wallets_path.is_file():
        print(f"wallets file not found: {wallets_path}", file=sys.stderr)
        sys.exit(1)

    addrs = sorted(set(addresses_from_wallets_file(wallets_path) + [a.lower() for a in DEFAULT_EXTRAS]))
    local_plain = repo / "scripts" / ".admin-wallets.local.json"
    local_plain.write_text(json.dumps(addrs, indent=2) + "\n", encoding="utf-8")

    reuse_key = os.environ.get("ADMIN_WALLETS_DECRYPT_KEY", "").strip()
    blob, key_hex = encrypt_wallet_list(addrs, reuse_key or None)

    bundle_path = repo / "supabase" / "functions" / "_shared" / "admin-wallets.bundle"
    bundle_path.write_text(blob + "\n", encoding="utf-8")

    key_file = repo / "scripts" / ".admin-wallets-decrypt.key"
    key_file.write_text(key_hex + "\n", encoding="utf-8")
    key_file.chmod(0o600)

    print(f"Committed bundle: {bundle_path} ({len(addrs)} addresses, encrypted)")
    print(f"Plain backup (gitignored): {local_plain}")
    print(f"Decrypt key (gitignored):  {key_file}")
    print()
    print("One-time Supabase / Lovable Edge secret (never commit):")
    print(f"  ADMIN_WALLETS_DECRYPT_KEY={key_hex}")
    print()
    print("After wallets.txt changes: re-run this script, commit admin-wallets.bundle, redeploy functions.")
    print("Optional extra address without re-encrypt: Supabase secret ADMIN_WALLETS=0x...")


if __name__ == "__main__":
    main()
