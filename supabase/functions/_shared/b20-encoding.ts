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
  return encodeAbiParameters(
    parseAbiParameters("uint8, string, string, address, uint8"),
    [1, name, symbol, admin as Address, decimals],
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
 * Merchant admin is granted MINT_ROLE atomically via initCalls.
 */
export function encodeCreateB20Asset(
  admin: string,
  name: string,
  symbol: string,
  decimals = 18,
): { data: Hex; salt: Hex } {
  const salt = makeDeploySalt(admin, name, symbol);
  const params = encodeB20AssetParams(name, symbol, admin, decimals);
  const initCalls: Hex[] = [encodeGrantRoleCall(B20_MINT_ROLE, admin)];

  const base = encodeFunctionData({
    abi: B20_FACTORY_ABI,
    functionName: "createB20",
    args: [B20_VARIANT.ASSET, salt, params, initCalls],
  });

  return { data: appendBuilderSuffix(base), salt };
}
