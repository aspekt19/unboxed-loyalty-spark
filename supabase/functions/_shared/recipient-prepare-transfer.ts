/**
 * Build ERC-20 transfer calldata for the wallet bound to rwk_ (holder sends loyalty tokens to any address).
 * Reuses the same encoding as merchant MCP `transfer_loyalty_tokens` (18 decimals, Builder Code suffix).
 */

import { appendBuilderCode, BUILDER_CODE } from "./loyalspark-agent-helpers.ts";

/** ERC-20 transfer(address,uint256) calldata with Base Builder Code suffix. Mirrors merchant MCP. */
function encodeTransferCalldata(to: string, amount: number): string {
  const paddedTo = to.toLowerCase().replace("0x", "").padStart(64, "0");
  const amtHex = BigInt(Math.floor(amount * 1e18)).toString(16).padStart(64, "0");
  return appendBuilderCode("0xa9059cbb" + paddedTo + amtHex);
}

export type PrepareHolderTransferResult =
  | { ok: true; body: Record<string, unknown> }
  | { ok: false; status: number; body: Record<string, unknown> };

/**
 * @param wallet Lowercase 0x wallet bound to the recipient agent (informational; signer must match on-chain)
 */
export async function prepareHolderLoyaltyTransfer(
  db: any,
  wallet: string,
  token_address: string,
  to: string,
  amount: number,
): Promise<PrepareHolderTransferResult> {
  if (!/^0x[a-fA-F0-9]{40}$/.test(token_address) || !/^0x[a-fA-F0-9]{40}$/.test(to)) {
    return { ok: false, status: 400, body: { error: "Invalid token_address or to" } };
  }
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) {
    return { ok: false, status: 400, body: { error: "amount must be a positive number (human units)" } };
  }

  const { data: prog, error } = await db
    .from("loyalty_programs")
    .select("id,name,symbol,status,token_address")
    .eq("token_address", token_address.toLowerCase())
    .maybeSingle();

  if (error) {
    return { ok: false, status: 500, body: { error: error.message } };
  }
  if (!prog) {
    return {
      ok: false,
      status: 404,
      body: { error: "Loyalty program not found for this token_address" },
    };
  }
  if (prog.status !== "active") {
    return {
      ok: false,
      status: 400,
      body: { error: `Program is ${prog.status}; only active programs can be used for transfer calldata` },
    };
  }

  const calldata = encodeTransferCalldata(to, amount);
  const token = token_address.toLowerCase();

  return {
    ok: true,
    body: {
      note:
        "Standard ERC-20 transfer from your wallet (msg.sender must be the bound wallet). Sign and broadcast on Base. Calldata uses 18 decimal places (same as merchant MCP transfer_loyalty_tokens). If your token uses different decimals, adjust off-chain before signing.",
      from_wallet: wallet.toLowerCase(),
      program: {
        name: prog.name,
        symbol: prog.symbol,
        status: prog.status,
      },
      contract_call: {
        to: token,
        function: "transfer(address,uint256)",
        args: [to, amount],
        calldata,
        chain: "Base (8453)",
        builder_code: BUILDER_CODE,
      },
    },
  };
}
