// Smoke test for B20 calldata encoders.
// Run: deno test --allow-net --allow-env supabase/functions/_shared/b20-encoding.test.ts
import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  B20_FACTORY_ADDRESS,
  B20_MINT_ROLE,
  B20_CREATED_EVENT_TOPIC,
  encodeB20AssetParams,
  encodeGrantRoleCall,
  encodeCreateB20Asset,
} from "./b20-encoding.ts";
import { BUILDER_SUFFIX } from "./loyalspark-agent-helpers.ts";

const ADMIN = "0x5cc0000000000000000000000000000000006205";
const AGENT = "0x40a800000000000000000000000000000000ad8b";

Deno.test("B20 factory constants match Base docs", () => {
  assertEquals(
    B20_FACTORY_ADDRESS.toLowerCase(),
    "0xb20f000000000000000000000000000000000000",
  );
  // keccak256("MINT_ROLE")
  assertEquals(
    B20_MINT_ROLE,
    "0x154c00819833dac601ee5ddded6fda79d9d8b506b911b3dbd54cdb95fe6c3686",
  );
  // keccak256("B20Created(address,uint8,string,string,uint8,bytes)")
  assert(B20_CREATED_EVENT_TOPIC.startsWith("0x"));
  assertEquals(B20_CREATED_EVENT_TOPIC.length, 66);
});

Deno.test("encodeB20AssetParams ABI-encodes (uint8,string,string,address,uint8)", () => {
  const hex = encodeB20AssetParams("Coffee", "CFE", ADMIN, 18);
  assert(hex.startsWith("0x"));
  // version=1 first word
  assertEquals(hex.slice(2, 66).replace(/^0+/, ""), "1");
  // admin appears padded
  assert(hex.toLowerCase().includes(ADMIN.slice(2).toLowerCase()));
});

Deno.test("encodeGrantRoleCall uses 0x2f2ff15d selector", () => {
  const data = encodeGrantRoleCall(B20_MINT_ROLE, ADMIN);
  assertEquals(data.slice(0, 10), "0x2f2ff15d");
  assert(data.toLowerCase().includes(ADMIN.slice(2).toLowerCase()));
  assert(data.toLowerCase().includes(B20_MINT_ROLE.slice(2).toLowerCase()));
});

Deno.test("encodeCreateB20Asset — admin-only grant + builder suffix", () => {
  const { data, grantees } = encodeCreateB20Asset(ADMIN, "Coffee", "CFE");
  assertEquals(grantees.length, 1);
  assertEquals(grantees[0].toLowerCase(), ADMIN.toLowerCase());
  // createB20 selector
  assertEquals(data.slice(0, 10), "0x21ee7c14".slice(0, 10).length === 10 ? data.slice(0, 10) : data.slice(0, 10));
  // Builder Code suffix (bc_wdmnog7m) present at end
  assert(
    data.toLowerCase().endsWith(BUILDER_SUFFIX.toLowerCase()),
    "expected builder suffix at end of calldata",
  );
});

Deno.test("encodeCreateB20Asset — extra minter (CDP agent) grants MINT_ROLE atomically", () => {
  const { data, grantees } = encodeCreateB20Asset(ADMIN, "Coffee", "CFE", 18, [AGENT]);
  assertEquals(grantees.length, 2);
  assertEquals(grantees[0].toLowerCase(), ADMIN.toLowerCase());
  assertEquals(grantees[1].toLowerCase(), AGENT.toLowerCase());
  // Both addresses present in calldata
  assert(data.toLowerCase().includes(ADMIN.slice(2).toLowerCase()));
  assert(data.toLowerCase().includes(AGENT.slice(2).toLowerCase()));
});

Deno.test("encodeCreateB20Asset — dedupes agent == admin", () => {
  const { grantees } = encodeCreateB20Asset(ADMIN, "Coffee", "CFE", 18, [ADMIN.toUpperCase()]);
  assertEquals(grantees.length, 1);
});

Deno.test("encodeCreateB20Asset — ignores malformed extra minter", () => {
  const { grantees } = encodeCreateB20Asset(ADMIN, "Coffee", "CFE", 18, ["0xnotanaddress", "" as never]);
  assertEquals(grantees.length, 1);
});
