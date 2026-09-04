/**
 * Base JSON-RPC (`fetch`) double for on-chain verification tests.
 *
 * `_shared/base-rpc.ts` iterates over five providers, so a stub must decide per
 * provider whether it answers, HTTP-errors, JSON-RPC-errors, or throws.
 */

export type RpcOutcome =
  | { kind: "result"; result: unknown }
  | { kind: "rpcError"; message: string }
  | { kind: "httpError"; status: number }
  | { kind: "networkError"; message?: string };

export type RpcHandler = (ctx: { url: string; method: string; params: unknown[]; attempt: number }) => RpcOutcome;

export type RpcStub = {
  restore: () => void;
  /** Number of provider requests made (across failover). */
  requests: number;
};

/** Replaces `globalThis.fetch` for the duration of a test. Always call `restore()`. */
export function stubBaseRpc(handler: RpcHandler): RpcStub {
  const original = globalThis.fetch;
  let attempt = 0;

  const stub = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    attempt += 1;
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const body = JSON.parse(String(init?.body ?? "{}")) as { method?: string; params?: unknown[] };
    const outcome = handler({ url, method: body.method ?? "", params: body.params ?? [], attempt });

    switch (outcome.kind) {
      case "networkError":
        throw new Error(outcome.message ?? "network down");
      case "httpError":
        return new Response("upstream error", { status: outcome.status });
      case "rpcError":
        return Response.json({ jsonrpc: "2.0", id: 1, error: { message: outcome.message } });
      case "result":
        return Response.json({ jsonrpc: "2.0", id: 1, result: outcome.result });
    }
  };

  globalThis.fetch = stub as typeof fetch;
  return {
    restore: () => {
      globalThis.fetch = original;
    },
    get requests() {
      return attempt;
    },
  };
}

/** Every provider answers with the same receipt (or `null` for "not mined"). */
export function stubReceipt(receipt: unknown): RpcStub {
  return stubBaseRpc(() => ({ kind: "result", result: receipt }));
}

/** Every provider fails — `baseRpcCall` then throws. */
export function stubRpcDown(): RpcStub {
  return stubBaseRpc(() => ({ kind: "networkError", message: "Archive requests require a personal token" }));
}

const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const ZERO_TOPIC = "0x" + "0".repeat(64);

export function addressTopic(address: string): string {
  return "0x" + address.toLowerCase().replace("0x", "").padStart(64, "0");
}

/** ERC-20 Transfer log; `from: null` encodes a mint (from = zero address). */
export function transferLog(params: {
  token: string;
  from: string | null;
  to: string;
  valueWei: bigint;
}): { address: string; topics: string[]; data: string } {
  return {
    address: params.token,
    topics: [
      TRANSFER_TOPIC,
      params.from === null ? ZERO_TOPIC : addressTopic(params.from),
      addressTopic(params.to),
    ],
    data: "0x" + params.valueWei.toString(16),
  };
}

export function receipt(params: {
  status?: string;
  to?: string;
  logs?: Array<{ address: string; topics: string[]; data: string }>;
}) {
  return {
    status: params.status ?? "0x1",
    to: params.to ?? null,
    logs: params.logs ?? [],
  };
}
