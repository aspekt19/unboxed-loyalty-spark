/**
 * B20 Factory configuration and canonical calldata encoders.
 *
 * B20 is Base's native ERC-20 superset (precompile). Loyal Spark uses B20 for
 * all NEW loyalty programs; legacy ERC-20 programs continue via the old factory.
 *
 * Docs: https://docs.base.org/get-started/launch-b20-token
 *       https://github.com/base/base-std
 */
import {
  encodeAbiParameters,
  encodeFunctionData,
  parseAbiParameters,
  keccak256,
  toHex,
  encodePacked,
  toBytes,
  type Address,
  type Hex,
} from 'viem';
import { BUILDER_CODE_SUFFIX, BUILDER_CODE } from './builder-code';

/** Singleton B20 Factory precompile — same address on every Base network. */
export const B20_FACTORY_ADDRESS =
  '0xB20f000000000000000000000000000000000000' as Address;

/** B20Variant enum values. */
export const B20_VARIANT = {
  ASSET: 0,
  STABLECOIN: 1,
} as const;

/** keccak256("MINT_ROLE") — B20Constants.MINT_ROLE */
export const B20_MINT_ROLE =
  '0x154c00819833dac601ee5ddded6fda79d9d8b506b911b3dbd54cdb95fe6c3686' as Hex;

/** Signature: B20Created(address indexed token, uint8 indexed variant, string, string, uint8, bytes) */
export const B20_CREATED_EVENT_TOPIC = keccak256(
  toBytes('B20Created(address,uint8,string,string,uint8,bytes)'),
) as Hex;

/** Minimal ABI for createB20 write + address prediction view. */
export const B20_FACTORY_ABI = [
  {
    type: 'function',
    name: 'createB20',
    stateMutability: 'payable',
    inputs: [
      { name: 'variant', type: 'uint8' },
      { name: 'salt', type: 'bytes32' },
      { name: 'params', type: 'bytes' },
      { name: 'initCalls', type: 'bytes[]' },
    ],
    outputs: [{ name: 'token', type: 'address' }],
  },
  {
    type: 'function',
    name: 'getB20Address',
    stateMutability: 'view',
    inputs: [
      { name: 'variant', type: 'uint8' },
      { name: 'sender', type: 'address' },
      { name: 'salt', type: 'bytes32' },
    ],
    outputs: [{ type: 'address' }],
  },
  {
    type: 'function',
    name: 'isB20',
    stateMutability: 'view',
    inputs: [{ name: 'token', type: 'address' }],
    outputs: [{ type: 'bool' }],
  },
] as const;

/**
 * ABI-encode B20AssetCreateParams: (uint8 version=1, string name, string symbol, address admin, uint8 decimals).
 * Struct = tuple in ABI encoding.
 */
export function encodeB20AssetParams(
  name: string,
  symbol: string,
  admin: Address,
  decimals = 18,
): Hex {
  return encodeAbiParameters(
    parseAbiParameters('uint8, string, string, address, uint8'),
    [1, name, symbol, admin, decimals],
  );
}

/** grantRole(bytes32,address) calldata for B20 initCalls. */
export function encodeGrantRoleCall(role: Hex, account: Address): Hex {
  return encodeFunctionData({
    abi: [
      {
        type: 'function',
        name: 'grantRole',
        stateMutability: 'nonpayable',
        inputs: [
          { name: 'role', type: 'bytes32' },
          { name: 'account', type: 'address' },
        ],
        outputs: [],
      },
    ],
    functionName: 'grantRole',
    args: [role, account],
  });
}

/** Derive a per-deploy salt so the deterministic address never collides. */
export function makeDeploySalt(admin: Address, name: string, symbol: string): Hex {
  return keccak256(
    encodePacked(
      ['address', 'uint256', 'string', 'string'],
      [admin, BigInt(Date.now()), name, symbol],
    ),
  );
}

/**
 * Build full createB20 calldata + Builder Code suffix (bc_wdmnog7m attribution).
 * Returns hex ready for sendTransaction.
 */
export function encodeCreateB20Asset(
  admin: Address,
  name: string,
  symbol: string,
  decimals = 18,
): { data: Hex; salt: Hex } {
  const salt = makeDeploySalt(admin, name, symbol);
  const params = encodeB20AssetParams(name, symbol, admin, decimals);
  const initCalls: Hex[] = [encodeGrantRoleCall(B20_MINT_ROLE, admin)];

  const base = encodeFunctionData({
    abi: B20_FACTORY_ABI,
    functionName: 'createB20',
    args: [B20_VARIANT.ASSET, salt, params, initCalls],
  });

  const suffix =
    BUILDER_CODE_SUFFIX && BUILDER_CODE_SUFFIX !== '0x'
      ? BUILDER_CODE_SUFFIX.slice(2)
      : '';
  const data = (base + suffix) as Hex;

  console.log('[B20] Encoded createB20', {
    builder_code: BUILDER_CODE,
    admin,
    name,
    symbol,
    decimals,
    salt,
    dataLength: data.length,
  });

  return { data, salt };
}

/**
 * Extract the created token address from a B20 factory receipt.
 * `token` is indexed → topics[1] contains the padded address.
 */
export function extractB20TokenAddress(logs: readonly {
  address: string;
  topics: readonly string[];
}[]): Address | null {
  for (const log of logs) {
    if (log.address.toLowerCase() !== B20_FACTORY_ADDRESS.toLowerCase()) continue;
    if (!log.topics || log.topics.length < 2) continue;
    if (log.topics[0]?.toLowerCase() !== B20_CREATED_EVENT_TOPIC.toLowerCase()) continue;
    const topic = log.topics[1];
    if (!topic) continue;
    return ('0x' + topic.slice(-40)) as Address;
  }
  return null;
}
