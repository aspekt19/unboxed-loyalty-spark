"""
Bridge: call the Node x402 paid agent-api helper from a Python traffic bot.

x402 pays USDC (EIP-3009) for HTTP to x402-gateway → agent-api. It does NOT sign your
loyalty-token transfer() / approve() calldata — keep those in Web3 as today.

Typical setup:
  1) Pick 1+ wallets that hold USDC on Base for x402 (can overlap with wallets.txt or a
     separate x402_payers.txt of private keys).
  2) Fund them with a small USDC buffer (each paid GET is ~$0.001 list price + gas via facilitator).
  3) From your bot loop, subprocess this repo's Node runner occasionally.

Env for run_x402_agent_api():
  x402_private_key   — 0x... or 64 hex (payer, must have USDC)
  lsk                — lsk_... merchant agent key
  gateway_url        — optional, default production x402-gateway
  resource           — e.g. "programs", "rewards", "balance"
  method             — "GET" or "POST"
  query              — optional, e.g. "token_address=0x..."
  body_json          — optional dict for POST (serialized to JSON)

Returns (exit_code, stdout, stderr).
"""

from __future__ import annotations

import json
import os
import subprocess
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parents[1]
NODE_SCRIPT_DIR = REPO_ROOT / "scripts" / "x402-paid-agent-api"
RUN_MJS = NODE_SCRIPT_DIR / "run.mjs"


def run_x402_agent_api(
    *,
    x402_private_key: str,
    lsk: str,
    resource: str = "programs",
    method: str = "GET",
    query: str | None = None,
    body_json: dict[str, Any] | None = None,
    gateway_url: str | None = None,
    timeout_sec: int = 180,
) -> tuple[int, str, str]:
    if not RUN_MJS.is_file():
        raise FileNotFoundError(f"Missing {RUN_MJS} — clone repo and run npm install in scripts/x402-paid-agent-api")

    pk = x402_private_key.strip()
    if not pk.startswith("0x") and len(pk) == 64:
        pk = "0x" + pk

    env = os.environ.copy()
    env["X402_PRIVATE_KEY"] = pk
    env["LOYAL_SPARK_API_KEY"] = lsk
    env["X402_RESOURCE"] = resource
    env["HTTP_METHOD"] = method.upper()
    if query:
        env["X402_QUERY"] = query
    if gateway_url:
        env["X402_GATEWAY_URL"] = gateway_url
    if method.upper() == "POST" and body_json is not None:
        env["AGENT_API_BODY"] = json.dumps(body_json)

    proc = subprocess.run(
        ["node", str(RUN_MJS)],
        cwd=str(NODE_SCRIPT_DIR),
        env=env,
        capture_output=True,
        text=True,
        timeout=timeout_sec,
    )
    return proc.returncode, proc.stdout or "", proc.stderr or ""


# --- Example: wire into your long-running bot (optional pattern) ---
if __name__ == "__main__":
    pk = os.environ.get("X402_PRIVATE_KEY", "").strip()
    lsk = os.environ.get("LOYAL_SPARK_API_KEY", "").strip()
    if not pk or not lsk.startswith("lsk_"):
        print("Set X402_PRIVATE_KEY and LOYAL_SPARK_API_KEY=lsk_... to smoke-test the bridge.")
        raise SystemExit(1)
    code, out, err = run_x402_agent_api(
        x402_private_key=pk,
        lsk=lsk,
        resource=os.environ.get("X402_RESOURCE", "programs"),
        method=os.environ.get("HTTP_METHOD", "GET"),
        query=os.environ.get("X402_QUERY") or None,
    )
    print(out)
    if err:
        print(err, file=__import__("sys").stderr)
    raise SystemExit(code)
