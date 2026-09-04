/**
 * Minimal Supabase-client double for Edge Function unit tests.
 *
 * Not a *_test.ts file on purpose: it is a helper imported by the mint,
 * payment, voucher and escrow test suites, never run as a test itself.
 */

export type QueryOp = "select" | "insert" | "update" | "delete";

export type QueryState = {
  table: string;
  op: QueryOp;
  payload?: unknown;
  /** Chained filters in call order, e.g. `{ eq: ["id", "abc"] }`. */
  filters: Array<Record<string, unknown[]>>;
  /** True for `.select(col, { head: true, count: "exact" })`. */
  head: boolean;
  /** `single` | `maybeSingle` | null. */
  terminal: "single" | "maybeSingle" | null;
};

export type QueryResult = { data?: unknown; error?: unknown; count?: number | null };
export type Responder = (state: QueryState) => QueryResult | Promise<QueryResult>;
export type RpcResponder = (fn: string, args: Record<string, unknown>) => QueryResult | Promise<QueryResult>;

// Must stay assignable to the `Db` structural types used by the modules under
// test (e.g. agent-fee-ledger expects `{ data: any; error: any }`).
export type RpcResult = { data: any; error: any; count: number | null };

export type MockDb = {
  from: (table: string) => any;
  rpc: (fn: string, args: Record<string, unknown>) => Promise<RpcResult>;
  /** Every query the code under test issued, in order. */
  calls: QueryState[];
  rpcCalls: Array<{ fn: string; args: Record<string, unknown> }>;
};

const CHAIN_METHODS = [
  "eq",
  "neq",
  "gt",
  "gte",
  "lt",
  "lte",
  "in",
  "is",
  "not",
  "or",
  "order",
  "limit",
  "range",
  "filter",
  "contains",
  "ilike",
] as const;

function normalize(result: QueryResult): QueryResult {
  return { data: result.data ?? null, error: result.error ?? null, count: result.count ?? null };
}

export function mockDb(responder: Responder, rpcResponder?: RpcResponder): MockDb {
  const calls: QueryState[] = [];
  const rpcCalls: Array<{ fn: string; args: Record<string, unknown> }> = [];

  function builder(state: QueryState) {
    const run = async (): Promise<QueryResult> => {
      calls.push(state);
      return normalize(await responder(state));
    };

    const api: Record<string, unknown> = {
      select(_cols?: string, opts?: { head?: boolean; count?: string }) {
        if (opts?.head) state.head = true;
        return api;
      },
      insert(payload: unknown) {
        state.op = "insert";
        state.payload = payload;
        return api;
      },
      upsert(payload: unknown) {
        state.op = "insert";
        state.payload = payload;
        return api;
      },
      update(payload: unknown) {
        state.op = "update";
        state.payload = payload;
        return api;
      },
      delete() {
        state.op = "delete";
        return api;
      },
      single() {
        state.terminal = "single";
        return run();
      },
      maybeSingle() {
        state.terminal = "maybeSingle";
        return run();
      },
      then(onOk: (v: QueryResult) => unknown, onErr?: (e: unknown) => unknown) {
        return run().then(onOk, onErr);
      },
    };

    for (const method of CHAIN_METHODS) {
      api[method] = (...args: unknown[]) => {
        state.filters.push({ [method]: args });
        return api;
      };
    }

    return api;
  }

  return {
    calls,
    rpcCalls,
    from(table: string) {
      return builder({ table, op: "select", filters: [], head: false, terminal: null });
    },
    async rpc(fn: string, args: Record<string, unknown>) {
      rpcCalls.push({ fn, args });
      if (!rpcResponder) return normalize({ data: null, error: { message: `no rpc stub for ${fn}` } });
      return normalize(await rpcResponder(fn, args));
    },
  };
}

/** Convenience: table -> fixed result. Unlisted tables resolve to `{ data: null }`. */
export function tableResponder(map: Record<string, QueryResult | Responder>): Responder {
  return (state) => {
    const entry = map[state.table];
    if (entry === undefined) return { data: null, error: null };
    return typeof entry === "function" ? (entry as Responder)(state) : entry;
  };
}

/** Reads the value a chained `.eq(column, value)` was called with. */
export function filterValue(state: QueryState, method: string, column: string): unknown {
  for (const f of state.filters) {
    const args = f[method];
    if (args && args[0] === column) return args[1];
  }
  return undefined;
}
