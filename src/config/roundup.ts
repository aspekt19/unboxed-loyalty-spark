/**
 * Round-Up Vault Configuration
 * 
 * После деплоя контрактов в Base Sepolia:
 * 1. Обновить ROUND_UP_VAULT_ADDRESS
 * 2. Обновить ROUND_UP_VAULT_ABI
 * 3. Обновить STRATEGY_CONTRACT_ADDRESS (если отдельный)
 */

export const ROUND_UP_CONFIG = {
  // Контракт RoundUpVault на Base Sepolia
  VAULT_ADDRESS: '0x0000000000000000000000000000000000000000' as `0x${string}`,
  
  // Контракт Strategy (если отдельный)
  STRATEGY_ADDRESS: '0x0000000000000000000000000000000000000000' as `0x${string}`,
  
  // Минимальная сумма Round-Up
  MIN_ROUND_UP: '0.0001', // ETH
  
  // Максимальная сумма Round-Up за день (по умолчанию)
  DEFAULT_DAILY_LIMIT: '1.0', // ETH
  
  // Стратегии инвестирования
  STRATEGIES: {
    CONSERVATIVE: 0,
    BALANCED: 1,
    AGGRESSIVE: 2,
  } as const,
  
  // Chainlink Price Feed (ETH/USD) на Base Sepolia
  ETH_USD_PRICE_FEED: '0x1e6a7102e3A7A661D79E78028f8f2C86F76D0a94',
  
  // Aave V3 Pool на Base Sepolia
  AAVE_POOL: '0xA238Dd80C259a72e81d7e4664a9801593F98d1c5',
} as const;

// Placeholder ABI - будет обновлен после деплоя
export const ROUND_UP_VAULT_ABI = [
  // Структуры
  // {
  //   type: 'function',
  //   name: 'roundUp',
  //   inputs: [{ name: '_primaryTxValueUSD', type: 'uint256' }],
  //   outputs: [],
  //   stateMutability: 'payable',
  // },
  // ... остальные функции
] as const;

export const STRATEGY_ABI = [
  // Placeholder
] as const;
