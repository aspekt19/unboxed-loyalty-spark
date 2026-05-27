import { walletHasEngagement } from "./recipient-queries.ts";

export type RecipientRedeemResult = { status: number; body: Record<string, unknown> };

/** Redeem reward for a wallet-bound recipient (same on-chain checks as merchant redeem, customer fixed to `wallet`). */
export async function recipientRedeemReward(
  serviceClient: any,
  wallet: string,
  reward_id: string,
  transaction_hash: string
): Promise<RecipientRedeemResult> {
  const customer_address = wallet.toLowerCase();

  const { data: reward, error: rewardError } = await serviceClient.from("rewards").select("*").eq("id", reward_id).single();

  if (rewardError || !reward) {
    return { status: 404, body: { error: "Reward not found" } };
  }

  if (!reward.is_active) {
    return { status: 400, body: { error: "Reward is not active" } };
  }

  const engaged = await walletHasEngagement(serviceClient, wallet, reward.token_address);
  if (!engaged) {
    return { status: 403, body: { error: "Your wallet has no activity on this loyalty program" } };
  }

  const { data: existingVoucher } = await serviceClient
    .from("vouchers")
    .select("id")
    .eq("transaction_hash", transaction_hash)
    .maybeSingle();

  if (existingVoucher) {
    return { status: 409, body: { error: "Voucher already created for this transaction" } };
  }

  const { data: program } = await serviceClient
    .from("loyalty_programs")
    .select("symbol")
    .eq("token_address", reward.token_address.toLowerCase())
    .maybeSingle();

  const merchAddr = (reward.merchant_address as string).toLowerCase();
  const rpcUrl = "https://base-rpc.publicnode.com";
  const normalizedTxHash = transaction_hash.startsWith("0x") ? transaction_hash : `0x${transaction_hash}`;

  let receipt: any = null;
  for (let attempt = 1; attempt <= 5; attempt++) {
    const resp = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_getTransactionReceipt", params: [normalizedTxHash] }),
    });
    const data = (await resp.json()) as any;
    receipt = data?.result ?? null;
    if (receipt) break;
    if (attempt < 5) await new Promise((r) => setTimeout(r, 2500));
  }

  if (!receipt) {
    return {
      status: 200,
      body: {
        success: false,
        retryable: true,
        retry_after_ms: 3000,
        error: "Transaction not confirmed yet. Retry later.",
      },
    };
  }

  if (receipt.status && receipt.status !== "0x1") {
    return { status: 400, body: { error: "Transaction failed on blockchain" } };
  }

  const ERC20_TRANSFER = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
  const logs = Array.isArray(receipt.logs) ? receipt.logs : [];
  const tokenAddr = reward.token_address.toLowerCase();
  const custAddr = customer_address;

  const requiredWei = BigInt(Math.round(Number(reward.cost) * 1e6)) * 10n ** 12n;
  let transferredWei = 0n;
  for (const log of logs) {
    const topics = Array.isArray(log?.topics) ? log.topics : [];
    if ((log?.address || "").toLowerCase() !== tokenAddr) continue;
    if (topics[0]?.toLowerCase() !== ERC20_TRANSFER || topics.length < 3) continue;
    const from = `0x${topics[1].slice(-40)}`.toLowerCase();
    const to = `0x${topics[2].slice(-40)}`.toLowerCase();
    if (from !== custAddr || to !== merchAddr) continue;
    try { transferredWei += BigInt(log?.data || "0x0"); } catch { /* ignore */ }
  }

  if (transferredWei < requiredWei) {
    return {
      status: 400,
      body: { error: `Insufficient token transfer: required ${reward.cost}, got ${(Number(transferredWei) / 1e18).toString()}` },
    };
  }

  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const code =
    "LOYAL-" +
    Array.from({ length: 4 }, () =>
      Array.from({ length: 4 }, () => chars.charAt(Math.floor(Math.random() * chars.length))).join("")
    ).join("-");

  const { data: voucher, error: voucherError } = await serviceClient
    .from("vouchers")
    .insert({
      code,
      reward_id: reward.id,
      reward_name: reward.name,
      reward_description: reward.description,
      token_address: reward.token_address.toLowerCase(),
      token_symbol: program?.symbol || "TOKEN",
      customer_address: custAddr,
      merchant_address: merchAddr,
      status: "active",
      cost: reward.cost,
      transaction_hash: normalizedTxHash,
    })
    .select()
    .single();

  if (voucherError) {
    return { status: 500, body: { error: "Failed to create voucher" } };
  }

  await serviceClient.from("customer_transactions").insert({
    customer_address: custAddr,
    token_address: reward.token_address.toLowerCase(),
    merchant_address: merchAddr,
    transaction_type: "redemption",
    amount: reward.cost,
    voucher_id: voucher.id,
  });

  return {
    status: 201,
    body: {
      voucher: {
        id: voucher.id,
        code: voucher.code,
        reward_name: voucher.reward_name,
        cost: voucher.cost,
        status: voucher.status,
        activated_at: voucher.activated_at,
        transaction_hash: voucher.transaction_hash,
      },
    },
  };
}
