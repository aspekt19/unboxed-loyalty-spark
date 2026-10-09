import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { mcpToolText } from "./mcp-tool-result.ts";

Deno.test("an error envelope is a failed MCP tool call", () => {
  const out = mcpToolText('{"error":"Not authenticated"}');
  assertEquals(out.isError, true);
  assertEquals(out.content[0].text, '{"error":"Not authenticated"}');
});

Deno.test("a normal JSON payload is not a failed tool call", () => {
  const out = mcpToolText('{"agent_id":"1","name":"A"}');
  assertEquals(out.isError, undefined);
});

Deno.test("plain text and a null error field stay successful", () => {
  assertEquals(mcpToolText("ok").isError, undefined);
  assertEquals(mcpToolText('{"error":null,"ok":true}').isError, undefined);
});
