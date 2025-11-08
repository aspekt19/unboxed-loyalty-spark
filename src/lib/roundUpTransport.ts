import { custom, type Transport, type Chain, type EIP1193RequestFn } from 'viem';
import { getEthPrice, ethToUsd, roundUpUsd, usdToEth } from './ethPrice';
import { toast } from 'sonner';
import { parseEther } from 'viem';

/**
 * Интерфейс для хранения информации о round-up
 */
interface RoundUpInfo {
  originalValue: bigint;
  roundedValue: bigint;
  roundUpAmount: bigint;
  usdAmount: number;
}

// Глобальное хранилище информации о последней round-up транзакции
let lastRoundUpInfo: RoundUpInfo | null = null;

/**
 * Получить информацию о последней round-up транзакции
 */
export function getLastRoundUpInfo(): RoundUpInfo | null {
  return lastRoundUpInfo;
}

/**
 * Очистить информацию о последней round-up транзакции
 */
export function clearLastRoundUpInfo(): void {
  lastRoundUpInfo = null;
}

/**
 * Создать кастомный транспорт с автоматическим round-up
 */
export function createRoundUpTransport(originalProvider: any): Transport {
  return custom({
    async request({ method, params }: { method: string; params?: any[] }) {
      // Перехватываем eth_sendTransaction
      if (method === 'eth_sendTransaction' && params && params[0]) {
        const txParams = params[0];
        
        // Проверяем, есть ли value в транзакции
        if (txParams.value && txParams.value !== '0x0') {
          try {
            const originalValue = BigInt(txParams.value);
            
            // Пропускаем очень маленькие суммы (< $0.01)
            const ethPrice = await getEthPrice();
            const usdAmount = ethToUsd(originalValue, ethPrice);
            
            if (usdAmount < 0.01) {
              // Не применяем round-up для очень маленьких сумм
              return originalProvider.request({ method, params });
            }
            
            // Округляем до целого доллара в большую сторону
            const roundedUsd = roundUpUsd(usdAmount);
            const roundUpUsdAmount = roundedUsd - usdAmount;
            
            // Если сумма уже целая, не применяем round-up
            if (roundUpUsdAmount < 0.01) {
              return originalProvider.request({ method, params });
            }
            
            // Конвертируем обратно в ETH
            const roundedEth = usdToEth(roundedUsd, ethPrice);
            const roundedValue = parseEther(roundedEth);
            
            // Сохраняем информацию о round-up
            lastRoundUpInfo = {
              originalValue,
              roundedValue,
              roundUpAmount: roundedValue - originalValue,
              usdAmount: roundUpUsdAmount,
            };
            
            // Показываем уведомление пользователю
            toast.info(
              `Round-Up: +$${roundUpUsdAmount.toFixed(2)}`,
              {
                description: `Original: $${usdAmount.toFixed(2)} → Rounded: $${roundedUsd.toFixed(2)}`,
              }
            );
            
            // Модифицируем параметры транзакции
            const modifiedParams = [
              {
                ...txParams,
                value: `0x${roundedValue.toString(16)}`,
              },
            ];
            
            console.log('Round-Up Transaction:', {
              originalUSD: usdAmount.toFixed(2),
              roundedUSD: roundedUsd.toFixed(2),
              roundUpUSD: roundUpUsdAmount.toFixed(2),
              originalValue: originalValue.toString(),
              roundedValue: roundedValue.toString(),
            });
            
            return originalProvider.request({ method, params: modifiedParams });
          } catch (error) {
            console.error('Round-Up calculation error:', error);
            // При ошибке отправляем оригинальную транзакцию
            return originalProvider.request({ method, params });
          }
        }
      }
      
      // Для всех остальных методов используем оригинальный провайдер
      return originalProvider.request({ method, params });
    },
  });
}
