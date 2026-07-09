/**
 * B20 Factory calldata encoders for Deno edge functions.
 * Mirrors src/config/b20.ts on the frontend.
 *
 * B20 Factory: singleton precompile at 0xB20f000000000000000000000000000000000000
 * Docs: https://docs.base.org/get-started/launch-b20-token
 */
import {
  encodeAbiParameters,
  encodeFunctionData,
  parseAbiParameters,
  keccak256,
  encodePacked,
  toBytes,
  type Address,
  type Hex,
} from "npm:viem@2.46.0";
import { BUILDER_SUFFIX } from "./loyalspark-agent-helpers.ts";

export const B20_FACTORY_ADDRESS =
  "0xB20f000000000000000000000000000000000000" as Address;

export const B20_VARIANT = { ASSET: 0, STABLECOIN: 1 } as const;

/** keccak256("MINT_ROLE") — B20Constants.MINT_ROLE */
export const B20_MINT_ROLE =
  "0x154c00819833dac601ee5ddded6fda79d9d8b506b911b3dbd54cdb95fe6c3686" as Hex;

export const B20_CREATED_EVENT_TOPIC = keccak256(
  toBytes("B20Created(address,uint8,string,string,uint8,bytes)"),
);

const B20_FACTORY_ABI = [
  {
    type: "function",
    name: "createB20",
    stateMutability: "payable",
    inputs: [
      { name: "variant", type: "uint8" },
      { name: "salt", type: "bytes32" },
      { name: "params", type: "bytes" },
      { name: "initCalls", type: "bytes[]" },
    ],
    outputs: [{ name: "token", type: "address" }],
  },
] as const;

function appendBuilderSuffix(hex: Hex): Hex {
  return (hex + BUILDER_SUFFIX) as Hex;
}

/** ABI encode B20AssetCreateParams = (uint8 version=1, string, string, address, uint8). */
export function encodeB20AssetParams(
  name: string,
  symbol: string,
  admin: string,
  decimals = 18,
): Hex {
  // B20FactoryLib.encodeAssetCreateParams uses abi.encode(struct) — a dynamic
  // TUPLE, not raw positional args. Raw params make the precompile revert with
  // AbiDecodeFailed ("buffer overrun").
  return encodeAbiParameters(
    [
      {
        type: "tuple",
        components: [
          { name: "version", type: "uint8" },
          { name: "name", type: "string" },
          { name: "symbol", type: "string" },
          { name: "initialAdmin", type: "address" },
          { name: "decimals", type: "uint8" },
        ],
      },
    ],
    [{ version: 1, name, symbol, initialAdmin: admin as Address, decimals }],
  );
}

export function encodeGrantRoleCall(role: Hex, account: string): Hex {
  return encodeFunctionData({
    abi: [
      {
        type: "function",
        name: "grantRole",
        stateMutability: "nonpayable",
        inputs: [
          { name: "role", type: "bytes32" },
          { name: "account", type: "address" },
        ],
        outputs: [],
      },
    ],
    functionName: "grantRole",
    args: [role, account as Address],
  });
}

export function makeDeploySalt(admin: string, name: string, symbol: string): Hex {
  return keccak256(
    encodePacked(
      ["address", "uint256", "string", "string"],
      [admin as Address, BigInt(Date.now()), name, symbol],
    ),
  );
}

/**
 * Full createB20 asset calldata + Builder Code suffix (bc_wdmnog7m).
 * Merchant admin is granted MINT_ROLE atomically via initCalls. Additional
 * minters (e.g. the agent's CDP MPC wallet) can be granted MINT_ROLE in the
 * same transaction so autonomous agents can mint without a follow-up grant.
 */
export function encodeCreateB20Asset(
  admin: string,
  name: string,
  symbol: string,
  decimals = 18,
  extraMinters: readonly string[] = [],
): { data: Hex; salt: Hex; grantees: string[] } {
  const salt = makeDeploySalt(admin, name, symbol);
  const params = encodeB20AssetParams(name, symbol, admin, decimals);

  const seen = new Set<string>();
  const grantees: string[] = [];
  for (const addr of [admin, ...extraMinters]) {
    if (!addr || !/^0x[a-fA-F0-9]{40}$/.test(addr)) continue;
    const k = addr.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    grantees.push(addr);
  }
  const initCalls: Hex[] = grantees.map((g) => encodeGrantRoleCall(B20_MINT_ROLE, g));

  const base = encodeFunctionData({
    abi: B20_FACTORY_ABI,
    functionName: "createB20",
    args: [B20_VARIANT.ASSET, salt, params, initCalls],
  });

  return { data: appendBuilderSuffix(base), salt, grantees };
}
