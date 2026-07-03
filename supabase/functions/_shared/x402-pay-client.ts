// x402 pay-and-call client (EIP-3009 "exact" scheme).
//
// Given a target URL that returns HTTP 402 with x402 payment requirements,
// this helper:
//   1. probes the URL,
//   2. picks a compatible `accepts[]` entry (scheme=exact, chosen network),
//   3. delegates EIP-712 TransferWithAuthorization signing to a caller-supplied
//      `signer` function (the caller decides whether to use a CDP MPC wallet,
//      a local key, etc.),
//   4. base64-encodes the X-PAYMENT header per x402 spec, and
//   5. retries the request.
//
// Signing is kept OUT of this file so we can share the flow between the
// merchant and recipient MCPs without duplicating CDP JWT logic.
//
// x402 spec: https://x402.gitbook.io/x402/core-concepts/payment-payload
// exact scheme: EIP-3009 TransferWithAuthorization on the target ERC-20.

export interface X402Requirement {
  scheme: string;
  network: string;
  maxAmountRequired: string; // atomic units (USDC = 6 decimals)
  resource?: string;
  description?: string;
  mimeType?: string;
  payTo: string; // recipient address
  asset: string; // ERC-20 contract address
  maxTimeoutSeconds?: number;
  extra?: {
    name?: string;    // EIP-712 domain.name  (USDC: "USD Coin")
    version?: string; // EIP-712 domain.version (USDC on Base: "2")
    chainId?: number;
  };
}

export interface X402Authorization {
  from: string;
  to: string;
  value: string;       // atomic units as decimal string
  validAfter: string;  // unix seconds as decimal string
  validBefore: string; // unix seconds as decimal string
  nonce: string;       // 0x + 64 hex chars (bytes32)
}

export type TypedDataSigner = (args: {
  address: string;
  chainId: number;
  domain: { name: string; version: string; chainId: number; verifyingContract: string };
  types: Record<string, Array<{ name: string; type: string }>>;
  primaryType: string;
  message: Record<string, unknown>;
}) => Promise<{ ok: boolean; signature?: string; error?: string }>;

// Chain-id map — kept small on purpose. Callers can pass unknown networks
// through by supplying `extra.chainId` in the requirement.
const NETWORK_CHAIN_IDS: Record<string, number> = {
  base: 8453,
  "base-mainnet": 8453,
  "base-sepolia": 84532,
  ethereum: 1,
  "ethereum-mainnet": 1,
};

function chainIdForNetwork(network: string, extraChainId?: number): number | null {
  if (extraChainId && Number.isInteger(extraChainId)) return extraChainId;
  return NETWORK_CHAIN_IDS[network?.toLowerCase()] ?? null;
}

function randomNonceBytes32(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return "0x" + Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function base64EncodeUtf8(input: string): string {
  const bytes = new TextEncoder().encode(input);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

export interface PayAndCallOpts {
  url: string;
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  headers?: Record<string, string>;
  fromAddress: string;
  signer: TypedDataSigner;
  // Safety caps.
  maxUsdc?: number;             // human units, e.g. 0.25 → 250_000 atomic
  allowedNetworks?: string[];   // default: ["base"]
  allowedSchemes?: string[];    // default: ["exact"]
  // Advanced.
  validForSeconds?: number;     // default 600
  x402Version?: number;         // default 1
}

export interface PayAndCallResult {
  paid: boolean;
  status: number;
  contentType: string | null;
  body: unknown;
  selected_requirement?: X402Requirement;
  payment?: { authorization: X402Authorization; signature: string };
  reason?: string;
  probe?: { status: number; accepts?: X402Requirement[]; body?: unknown };
}

async function readBody(res: Response) {
  const ct = res.headers.get("content-type");
  const text = await res.text();
  let parsed: unknown = text;
  if (ct && ct.includes("application/json")) {
    try { parsed = JSON.parse(text); } catch { /* leave as text */ }
  }
  return { contentType: ct, body: parsed, raw: text };
}

export async function payAndCall(opts: PayAndCallOpts): Promise<PayAndCallResult> {
  const method = (opts.method || "GET").toUpperCase() as PayAndCallOpts["method"];
  const allowedNetworks = (opts.allowedNetworks || ["base"]).map((n) => n.toLowerCase());
  const allowedSchemes = (opts.allowedSchemes || ["exact"]).map((s) => s.toLowerCase());
  const validFor = Math.max(60, Math.min(3600, opts.validForSeconds || 600));
  const x402Version = opts.x402Version || 1;

  let u: URL;
  try { u = new URL(opts.url); } catch { return { paid: false, status: 0, contentType: null, body: null, reason: "invalid_url" }; }
  if (u.protocol !== "https:") return { paid: false, status: 0, contentType: null, body: null, reason: "https_required" };

  const baseHeaders: Record<string, string> = {
    Accept: "application/json",
    ...(opts.headers || {}),
  };
  const hasBody = opts.body !== undefined && method !== "GET";
  const bodyString = hasBody ? JSON.stringify(opts.body) : undefined;
  if (hasBody && !baseHeaders["Content-Type"] && !baseHeaders["content-type"]) {
    baseHeaders["Content-Type"] = "application/json";
  }

  // 1. Probe.
  const probeRes = await fetch(u.toString(), { method, headers: baseHeaders, body: bodyString });
  const probed = await readBody(probeRes);
  if (probeRes.status !== 402) {
    return {
      paid: false,
      status: probeRes.status,
      contentType: probed.contentType,
      body: probed.body,
      reason: probeRes.ok ? "not_paid_resource" : "upstream_error_no_402",
    };
  }

  const accepts: X402Requirement[] = (probed.body as any)?.accepts || [];
  if (!Array.isArray(accepts) || accepts.length === 0) {
    return { paid: false, status: 402, contentType: probed.contentType, body: probed.body, reason: "no_accepts" };
  }

  // 2. Pick a compatible requirement.
  const candidate = accepts.find((r) =>
    r && allowedSchemes.includes(String(r.scheme || "").toLowerCase()) &&
    allowedNetworks.includes(String(r.network || "").toLowerCase())
  );
  if (!candidate) {
    return {
      paid: false, status: 402, contentType: probed.contentType, body: probed.body,
      reason: "no_compatible_requirement",
      probe: { status: 402, accepts },
    };
  }

  const chainId = chainIdForNetwork(candidate.network, candidate.extra?.chainId);
  if (!chainId) {
    return { paid: false, status: 402, contentType: probed.contentType, body: probed.body, reason: "unknown_chain", probe: { status: 402, accepts } };
  }

  // 3. Enforce max_usdc cap (assumes 6-decimal token — true for USDC).
  const amountAtomic = BigInt(candidate.maxAmountRequired || "0");
  if (opts.maxUsdc !== undefined) {
    const capAtomic = BigInt(Math.floor(opts.maxUsdc * 1_000_000));
    if (amountAtomic > capAtomic) {
      return {
        paid: false, status: 402, contentType: probed.contentType, body: probed.body,
        reason: `amount_exceeds_max_usdc:${(Number(amountAtomic) / 1_000_000).toFixed(6)}>${opts.maxUsdc}`,
        probe: { status: 402, accepts },
        selected_requirement: candidate,
      };
    }
  }

  // 4. Build EIP-712 TransferWithAuthorization.
  const now = Math.floor(Date.now() / 1000);
  const authorization: X402Authorization = {
    from: opts.fromAddress,
    to: candidate.payTo,
    value: amountAtomic.toString(),
    validAfter: String(now - 60),
    validBefore: String(now + validFor),
    nonce: randomNonceBytes32(),
  };

  const domain = {
    name: candidate.extra?.name || "USD Coin",
    version: candidate.extra?.version || "2",
    chainId,
    verifyingContract: candidate.asset,
  };

  const types = {
    TransferWithAuthorization: [
      { name: "from", type: "address" },
      { name: "to", type: "address" },
      { name: "value", type: "uint256" },
      { name: "validAfter", type: "uint256" },
      { name: "validBefore", type: "uint256" },
      { name: "nonce", type: "bytes32" },
    ],
  };

  const signed = await opts.signer({
    address: opts.fromAddress,
    chainId,
    domain,
    types,
    primaryType: "TransferWithAuthorization",
    message: { ...authorization },
  });

  if (!signed.ok || !signed.signature) {
    return {
      paid: false, status: 402, contentType: probed.contentType, body: probed.body,
      reason: `sign_failed:${signed.error || "unknown"}`,
      probe: { status: 402, accepts },
      selected_requirement: candidate,
    };
  }

  // 5. Build X-PAYMENT header and retry.
  const paymentPayload = {
    x402Version,
    scheme: candidate.scheme,
    network: candidate.network,
    payload: { signature: signed.signature, authorization },
  };
  const xPayment = base64EncodeUtf8(JSON.stringify(paymentPayload));

  const paidRes = await fetch(u.toString(), {
    method,
    headers: { ...baseHeaders, "X-PAYMENT": xPayment },
    body: bodyString,
  });
  const paidBody = await readBody(paidRes);

  return {
    paid: paidRes.ok,
    status: paidRes.status,
    contentType: paidBody.contentType,
    body: paidBody.body,
    selected_requirement: candidate,
    payment: { authorization, signature: signed.signature },
    reason: paidRes.ok ? undefined : "upstream_error_after_payment",
  };
}
