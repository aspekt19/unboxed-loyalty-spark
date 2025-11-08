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
  VAULT_ADDRESS: '0x7F653c6f52Ad2e3D80f84e37da664cF81fbDaFf1' as `0x${string}`,
  
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

// RoundUpVault ABI
export const ROUND_UP_VAULT_ABI = [{"inputs":[{"internalType":"address","name":"_priceFeed","type":"address"},{"internalType":"address","name":"_strategy","type":"address"}],"stateMutability":"nonpayable","type":"constructor"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"user","type":"address"},{"indexed":false,"internalType":"uint256","name":"amount","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"investedValue","type":"uint256"}],"name":"Invested","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"user","type":"address"},{"indexed":false,"internalType":"uint256","name":"roundUpAmount","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"primaryTxValue","type":"uint256"}],"name":"RoundUpCollected","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"user","type":"address"},{"indexed":false,"internalType":"bool","name":"autoInvest","type":"bool"},{"indexed":false,"internalType":"uint256","name":"roundUpMultiplier","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"dailyLimit","type":"uint256"}],"name":"SettingsUpdated","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"newStrategy","type":"address"}],"name":"StrategyUpdated","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"user","type":"address"},{"indexed":false,"internalType":"uint256","name":"amount","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"ethReturned","type":"uint256"}],"name":"Withdrawn","type":"event"},{"inputs":[],"name":"MAX_DAILY_ROUND_UP","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"MIN_ROUND_UP","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"ONE_DAY","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"USD_DECIMALS","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"_ethAmount","type":"uint256"}],"name":"calculateRoundUp","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"emergencyWithdraw","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"getEthPrice","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"_user","type":"address"}],"name":"getUserInvestmentValue","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"initializeSettings","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"invest","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"owner","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"priceFeed","outputs":[{"internalType":"contract AggregatorV3Interface","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"_primaryTxValueUSD","type":"uint256"}],"name":"roundUp","outputs":[],"stateMutability":"payable","type":"function"},{"inputs":[],"name":"strategy","outputs":[{"internalType":"contract IInvestmentStrategy","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"bool","name":"_autoInvest","type":"bool"},{"internalType":"uint256","name":"_roundUpMultiplier","type":"uint256"},{"internalType":"uint256","name":"_dailyLimit","type":"uint256"}],"name":"updateSettings","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"_newStrategy","type":"address"}],"name":"updateStrategy","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"","type":"address"}],"name":"userBalances","outputs":[{"internalType":"uint256","name":"pendingRoundUp","type":"uint256"},{"internalType":"uint256","name":"invested","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"","type":"address"}],"name":"userSettings","outputs":[{"internalType":"bool","name":"autoInvest","type":"bool"},{"internalType":"uint256","name":"roundUpMultiplier","type":"uint256"},{"internalType":"uint256","name":"dailyLimit","type":"uint256"},{"internalType":"uint256","name":"lastResetTime","type":"uint256"},{"internalType":"uint256","name":"dailySpent","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"_amount","type":"uint256"}],"name":"withdraw","outputs":[],"stateMutability":"nonpayable","type":"function"},{"stateMutability":"payable","type":"receive"}] as const;

export const STRATEGY_ABI = [
  // Placeholder
] as const;
