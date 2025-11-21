export const ROUNDUP_CONTRACTS = {
  ROUND_UP_VAULT: {
    address: '0x9102ada6805DB9100CaE03448B23f2b2668EcFe8' as `0x${string}`,
    abi: [
      {
        inputs: [
          { name: '_ethPriceFeed', type: 'address' },
          { name: '_aaveStrategy', type: 'address' },
          { name: '_compoundStrategy', type: 'address' }
        ],
        stateMutability: 'nonpayable',
        type: 'constructor'
      },
      {
        anonymous: false,
        inputs: [
          { indexed: true, name: 'user', type: 'address' },
          { indexed: false, name: 'autoInvest', type: 'bool' },
          { indexed: false, name: 'multiplier', type: 'uint256' },
          { indexed: false, name: 'strategy', type: 'uint8' }
        ],
        name: 'SettingsInitialized',
        type: 'event'
      },
      {
        anonymous: false,
        inputs: [
          { indexed: true, name: 'user', type: 'address' },
          { indexed: false, name: 'amount', type: 'uint256' },
          { indexed: false, name: 'recipient', type: 'address' }
        ],
        name: 'RoundedUp',
        type: 'event'
      },
      {
        anonymous: false,
        inputs: [
          { indexed: true, name: 'user', type: 'address' },
          { indexed: false, name: 'strategy', type: 'uint8' },
          { indexed: false, name: 'amount', type: 'uint256' }
        ],
        name: 'Invested',
        type: 'event'
      },
      {
        inputs: [
          { name: '_autoInvest', type: 'bool' },
          { name: '_multiplier', type: 'uint256' },
          { name: '_preferredStrategy', type: 'uint8' }
        ],
        name: 'initializeSettings',
        outputs: [],
        stateMutability: 'nonpayable',
        type: 'function'
      },
      {
        inputs: [
          { name: '_autoInvest', type: 'bool' },
          { name: '_multiplier', type: 'uint256' },
          { name: '_preferredStrategy', type: 'uint8' }
        ],
        name: 'updateSettings',
        outputs: [],
        stateMutability: 'nonpayable',
        type: 'function'
      },
      {
        inputs: [{ name: '_recipient', type: 'address' }],
        name: 'roundUp',
        outputs: [],
        stateMutability: 'payable',
        type: 'function'
      },
      {
        inputs: [],
        name: 'directDeposit',
        outputs: [],
        stateMutability: 'payable',
        type: 'function'
      },
      {
        inputs: [{ name: '_strategy', type: 'uint8' }],
        name: 'invest',
        outputs: [],
        stateMutability: 'nonpayable',
        type: 'function'
      },
      {
        inputs: [
          { name: '_strategy', type: 'uint8' },
          { name: '_amount', type: 'uint256' }
        ],
        name: 'withdraw',
        outputs: [],
        stateMutability: 'nonpayable',
        type: 'function'
      },
      {
        inputs: [{ name: '_user', type: 'address' }],
        name: 'getUserPendingBalance',
        outputs: [{ name: '', type: 'uint256' }],
        stateMutability: 'view',
        type: 'function'
      },
      {
        inputs: [
          { name: '_user', type: 'address' },
          { name: '_strategy', type: 'uint8' }
        ],
        name: 'getUserInvestedAmount',
        outputs: [{ name: '', type: 'uint256' }],
        stateMutability: 'view',
        type: 'function'
      },
      {
        inputs: [
          { name: '_user', type: 'address' },
          { name: '_strategy', type: 'uint8' }
        ],
        name: 'getUserInvestmentValue',
        outputs: [{ name: '', type: 'uint256' }],
        stateMutability: 'view',
        type: 'function'
      },
      {
        inputs: [{ name: '_user', type: 'address' }],
        name: 'getUserTotalInvestmentValue',
        outputs: [{ name: '', type: 'uint256' }],
        stateMutability: 'view',
        type: 'function'
      }
    ] as const
  },
  STRATEGIES: {
    AAVE: 0,
    COMPOUND: 1
  }
} as const;

export const STRATEGY_NAMES = {
  0: 'Aave Conservative',
  1: 'Compound Lending Plus'
} as const;

export type StrategyType = 0 | 1;
