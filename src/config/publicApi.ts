// Single source of truth for public-facing API URLs shown to agents in docs.
// These must match public/.well-known/agent.json and public/openapi.json.
export const PUBLIC_API_BASE_URL = "https://api.loyalspark.online";

export const PUBLIC_REST_URL = `${PUBLIC_API_BASE_URL}/agent-api`;
export const PUBLIC_MCP_URL = `${PUBLIC_API_BASE_URL}/loyalty-mcp`;
export const PUBLIC_RECIPIENT_REST_URL = `${PUBLIC_API_BASE_URL}/recipient-api`;
export const PUBLIC_RECIPIENT_MCP_URL = `${PUBLIC_API_BASE_URL}/recipient-loyalty-mcp`;
export const PUBLIC_X402_URL = `${PUBLIC_API_BASE_URL}/x402-gateway`;
export const PUBLIC_MPP_URL = `${PUBLIC_API_BASE_URL}/mpp-gateway`;
export const PUBLIC_REGISTER_SIWE_URL = `${PUBLIC_API_BASE_URL}/agent-register-siwe`;
export const PUBLIC_SIWE_NONCE_URL = `${PUBLIC_API_BASE_URL}/siwe-nonce`;
