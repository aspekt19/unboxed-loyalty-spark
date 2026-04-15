/**
 * Resolve agent API keys from HTTP headers for MCP (Streamable HTTP) entrypoints.
 *
 * Some orchestrators (e.g. OpenServ) attach the key only as `Authorization: Bearer …`
 * and do not forward custom `x-api-key` on every JSON-RPC POST. Supabase still receives
 * the request, but `x-api-key` is empty → treat Bearer the same when the token matches
 * the expected prefix.
 */
export function resolveMcpApiKey(get: (name: string) => string | undefined, prefix: "lsk_" | "rwk_"): string | undefined {
  const x = get("x-api-key")?.trim();
  if (x?.startsWith(prefix)) return x;

  const auth = get("authorization")?.trim();
  if (auth?.toLowerCase().startsWith("bearer ")) {
    const token = auth.slice(7).trim();
    if (token.startsWith(prefix)) return token;
  }

  return undefined;
}
