/**
 * Утилита для работы с ценой ETH
 */

let cachedEthPrice = 3400; // Кэшированная цена ETH в USD
let lastFetchTime = 0;
const CACHE_DURATION = 60000; // 1 минута

/**
 * Получить текущую цену ETH в USD
 */
export async function getEthPrice(): Promise<number> {
  const now = Date.now();
  
  // Возвращаем кэшированное значение, если оно свежее
  if (now - lastFetchTime < CACHE_DURATION) {
    return cachedEthPrice;
  }

  try {
    const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd');
    const data = await response.json();
    
    if (data.ethereum?.usd) {
      cachedEthPrice = data.ethereum.usd;
      lastFetchTime = now;
    }
  } catch (error) {
    console.error('Failed to fetch ETH price:', error);
    // Используем кэшированное значение при ошибке
  }

  return cachedEthPrice;
}

/**
 * Конвертировать USD в ETH
 */
export function usdToEth(usdAmount: number, ethPrice: number): string {
  return (usdAmount / ethPrice).toFixed(18);
}

/**
 * Конвертировать ETH в USD
 */
export function ethToUsd(ethAmount: bigint, ethPrice: number): number {
  const ethValue = Number(ethAmount) / 1e18;
  return ethValue * ethPrice;
}

/**
 * Округлить USD сумму до целого числа в большую сторону
 */
export function roundUpUsd(usdAmount: number): number {
  return Math.ceil(usdAmount);
}
