export const CONTRACTS = {
  LOYALTY_TOKEN_FACTORY: {
    address: '0x61b154cAE13F2312D33397419195753D3849F858' as `0x${string}`,
    abi: [
      {
        inputs: [],
        name: 'deployLoyaltyToken',
        outputs: [{ name: 'tokenAddress', type: 'address' }],
        stateMutability: 'nonpayable',
        type: 'function',
      },
      {
        anonymous: false,
        inputs: [
          { indexed: true, name: 'merchant', type: 'address' },
          { indexed: true, name: 'tokenAddress', type: 'address' },
        ],
        name: 'LoyaltyTokenCreated',
        type: 'event',
      },
    ] as const,
  },
  LOYAL_SPARK_ERC20: {
    address: '0xc46481b25a0E6161d87F84C0dd2B0721B891cB4e' as `0x${string}`,
    abi: [
      {
        inputs: [{ name: 'account', type: 'address' }],
        name: 'balanceOf',
        outputs: [{ name: '', type: 'uint256' }],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [
          { name: 'to', type: 'address' },
          { name: 'amount', type: 'uint256' },
        ],
        name: 'transfer',
        outputs: [{ name: '', type: 'bool' }],
        stateMutability: 'nonpayable',
        type: 'function',
      },
      {
        inputs: [
          { name: 'to', type: 'address' },
          { name: 'amount', type: 'uint256' },
        ],
        name: 'mint',
        outputs: [],
        stateMutability: 'nonpayable',
        type: 'function',
      },
      {
        inputs: [{ name: 'amount', type: 'uint256' }],
        name: 'burn',
        outputs: [],
        stateMutability: 'nonpayable',
        type: 'function',
      },
      {
        inputs: [],
        name: 'name',
        outputs: [{ name: '', type: 'string' }],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [],
        name: 'symbol',
        outputs: [{ name: '', type: 'string' }],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [],
        name: 'decimals',
        outputs: [{ name: '', type: 'uint8' }],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [],
        name: 'totalSupply',
        outputs: [{ name: '', type: 'uint256' }],
        stateMutability: 'view',
        type: 'function',
      },
    ] as const,
  },
} as const;

export const BASE_CHAIN_ID = 8453;
