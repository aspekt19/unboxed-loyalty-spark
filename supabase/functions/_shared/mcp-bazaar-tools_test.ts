import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  getMcpBazaarTool,
  isMcpToolResource,
  MCP_BAZAAR_TOOLS,
} from "./mcp-bazaar-tools.ts";
import { RECIPIENT_MCP_BAZAAR_TOOLS } from "./recipient-mcp-bazaar-tools.ts";

Deno.test("merchant MCP tool names are unique", () => {
  const names = MCP_BAZAAR_TOOLS.map((t) => t.name);
  assertEquals(new Set(names).size, names.length);
});

Deno.test("every paid MCP tool has a parseable USD price and description", () => {
  for (const t of [...MCP_BAZAAR_TOOLS, ...RECIPIENT_MCP_BAZAAR_TOOLS]) {
    assert(/^\d+(\.\d+)?$/.test(t.price), `bad price for ${t.name}: ${t.price}`);
    assert(parseFloat(t.price) > 0, `non-positive price for ${t.name}`);
    assert(t.description.length > 10, `missing description for ${t.name}`);
    assert(
      typeof t.inputSchema === "object" && t.inputSchema !== null,
      `missing inputSchema for ${t.name}`,
    );
  }
});

Deno.test("getMcpBazaarTool / isMcpToolResource resolve known tools only", () => {
  const first = MCP_BAZAAR_TOOLS[0];
  assertEquals(getMcpBazaarTool(first.name)?.name, first.name);
  assertEquals(getMcpBazaarTool("definitely_not_a_tool"), undefined);
  assert(isMcpToolResource(`mcp-tools/${first.name}`));
  assertEquals(isMcpToolResource("mcp-tools/definitely_not_a_tool"), false);
  assertEquals(isMcpToolResource(first.name), false);
});
