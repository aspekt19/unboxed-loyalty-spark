/**
 * Round-Up Vault Configuration
 * 
 * ⚠️ ВАЖНО: После деплоя нового контракта:
 * 1. Обновить VAULT_ADDRESS на адрес нового контракта
 * 2. Экспортировать новый ABI из Remix и заменить ROUND_UP_VAULT_ABI
 * 3. Убедиться что STRATEGY_ADDRESS корректен
 * 
 * Новый контракт поддерживает:
 * - ✅ Нет ограничений по MIN/MAX сумме
 * - ✅ Поддержка ERC20 токенов
 * - ✅ Управление списком токенов через addSupportedToken()
 */

export const ROUND_UP_CONFIG = {
  // ⚠️ ОБНОВИТЬ после деплоя нового контракта!
  VAULT_ADDRESS: '0x7F653c6f52Ad2e3D80f84e37da664cF81fbDaFf1' as `0x${string}`,
  
  // Контракт Strategy (AaveStrategy)
  STRATEGY_ADDRESS: '0x708030C71A910504b03388f6b32d99A414b2835C' as `0x${string}`,
  
  // Chainlink Price Feed (ETH/USD) на Base Sepolia
  ETH_USD_PRICE_FEED: '0x4aDC67696bA383F43DD60A9e78F2C97Fbbfc7cb1' as `0x${string}`,
  
  // Aave V3 Pool на Base Sepolia
  AAVE_POOL: '0xA238Dd80C259a72e81d7e4664a9801593F98d1c5' as `0x${string}`,
  
  // Native token address (для ETH)
  NATIVE_TOKEN: '0x0000000000000000000000000000000000000000' as `0x${string}`,
} as const;

// ⚠️ ВРЕМЕННЫЙ ABI - ЗАМЕНИТЬ после деплоя нового контракта!
// После деплоя экспортируйте ABI из Remix и замените этот массив
// 
// Новые функции в контракте:
// - addSupportedToken(address token, address priceFeed)
// - removeSupportedToken(address token)
// - roundUpToken(address token, uint256 amount, uint256 primaryTxValueUSD)
// - withdrawToken(address token, uint256 amount)
// - getTokenPrice(address token)
// - calculateRoundUp(address token, uint256 amount)
// - getUserTokenBalance(address user, address token)
//
export const ROUND_UP_VAULT_ABI = [{"inputs":[{"internalType":"address","name":"_priceFeed","type":"address"},{"internalType":"address","name":"_strategy","type":"address"}],"stateMutability":"nonpayable","type":"constructor"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"user","type":"address"},{"indexed":false,"internalType":"uint256","name":"amount","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"investedValue","type":"uint256"}],"name":"Invested","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"user","type":"address"},{"indexed":false,"internalType":"uint256","name":"roundUpAmount","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"primaryTxValue","type":"uint256"}],"name":"RoundUpCollected","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"user","type":"address"},{"indexed":false,"internalType":"bool","name":"autoInvest","type":"bool"},{"indexed":false,"internalType":"uint256","name":"roundUpMultiplier","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"dailyLimit","type":"uint256"}],"name":"SettingsUpdated","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"newStrategy","type":"address"}],"name":"StrategyUpdated","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"user","type":"address"},{"indexed":false,"internalType":"uint256","name":"amount","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"ethReturned","type":"uint256"}],"name":"Withdrawn","type":"event"},{"inputs":[],"name":"MAX_DAILY_ROUND_UP","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"MIN_ROUND_UP","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"ONE_DAY","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"USD_DECIMALS","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"_ethAmount","type":"uint256"}],"name":"calculateRoundUp","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"emergencyWithdraw","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"getEthPrice","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"_user","type":"address"}],"name":"getUserInvestmentValue","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"initializeSettings","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"invest","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"owner","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"priceFeed","outputs":[{"internalType":"contract AggregatorV3Interface","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"_primaryTxValueUSD","type":"uint256"}],"name":"roundUp","outputs":[],"stateMutability":"payable","type":"function"},{"inputs":[],"name":"strategy","outputs":[{"internalType":"contract IInvestmentStrategy","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"bool","name":"_autoInvest","type":"bool"},{"internalType":"uint256","name":"_roundUpMultiplier","type":"uint256"},{"internalType":"uint256","name":"_dailyLimit","type":"uint256"}],"name":"updateSettings","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"_newStrategy","type":"address"}],"name":"updateStrategy","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"","type":"address"}],"name":"userBalances","outputs":[{"internalType":"uint256","name":"pendingRoundUp","type":"uint256"},{"internalType":"uint256","name":"invested","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"","type":"address"}],"name":"userSettings","outputs":[{"internalType":"bool","name":"autoInvest","type":"bool"},{"internalType":"uint256","name":"roundUpMultiplier","type":"uint256"},{"internalType":"uint256","name":"dailyLimit","type":"uint256"},{"internalType":"uint256","name":"lastResetTime","type":"uint256"},{"internalType":"uint256","name":"dailySpent","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"_amount","type":"uint256"}],"name":"withdraw","outputs":[],"stateMutability":"nonpayable","type":"function"},{"stateMutability":"payable","type":"receive"}] as const;

export const STRATEGY_ABI = [{"inputs":[{"internalType":"address","name":"_vault","type":"address"}],"stateMutability":"nonpayable","type":"constructor"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"user","type":"address"},{"indexed":false,"internalType":"uint256","name":"ethAmount","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"usdcAmount","type":"uint256"}],"name":"Deposited","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"user","type":"address"},{"indexed":false,"internalType":"uint256","name":"usdcAmount","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"ethAmount","type":"uint256"}],"name":"Withdrawn","type":"event"},{"inputs":[],"name":"AAVE_POOL","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"DEX_ROUTER","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"USDC","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"WETH","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"_user","type":"address"}],"name":"deposit","outputs":[{"internalType":"uint256","name":"amountInvested","type":"uint256"}],"stateMutability":"payable","type":"function"},{"inputs":[{"internalType":"address","name":"_user","type":"address"}],"name":"getUserValue","outputs":[{"internalType":"uint256","name":"currentValue","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"","type":"address"}],"name":"userDeposits","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"vault","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"_user","type":"address"},{"internalType":"uint256","name":"_amount","type":"uint256"}],"name":"withdraw","outputs":[{"internalType":"uint256","name":"ethReturned","type":"uint256"}],"stateMutability":"nonpayable","type":"function"},{"stateMutability":"payable","type":"receive"}] as const;
