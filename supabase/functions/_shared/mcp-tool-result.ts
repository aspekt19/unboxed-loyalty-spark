/**
 * MCP tool payload. A JSON object with a string `error` is a failed tool call.
 * HTTP stays 200 so the MCP transport still delivers a JSON-RPC envelope.
 */
export function mcpToolText(text: string): {
  content: [{ type: "text"; text: string }];
  isError?: true;
} {
  let isError = false;
  try {
    const parsed = JSON.parse(text) as { error?: unknown };
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed) && typeof parsed.error === "string") {
      isError = true;
    }
  } catch {
    // Plain text is not an error envelope.
  }
  return {
    content: [{ type: "text", text }],
    ...(isError ? { isError: true as const } : {}),
  };
}
