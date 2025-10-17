import { Reward, Voucher } from '@/types/rewards';

// Генерация уникального кода ваучера
export function generateVoucherCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const segments = 4;
  const segmentLength = 4;
  
  const code = Array.from({ length: segments }, () => {
    return Array.from({ length: segmentLength }, () => 
      chars.charAt(Math.floor(Math.random() * chars.length))
    ).join('');
  }).join('-');
  
  return `LOYAL-${code}`;
}

// Сохранение наград в localStorage
export function saveRewards(rewards: Reward[]): void {
  localStorage.setItem('merchantRewards', JSON.stringify(rewards));
  window.dispatchEvent(new Event('rewardsUpdated'));
}

// Загрузка наград из localStorage
export function loadRewards(): Reward[] {
  const stored = localStorage.getItem('merchantRewards');
  return stored ? JSON.parse(stored) : [];
}

// Получение наград для конкретного токена
export function getRewardsByToken(tokenAddress: string): Reward[] {
  const rewards = loadRewards();
  return rewards.filter(r => r.tokenAddress.toLowerCase() === tokenAddress.toLowerCase() && r.isActive);
}

// Сохранение ваучеров в localStorage
export function saveVouchers(vouchers: Voucher[]): void {
  localStorage.setItem('customerVouchers', JSON.stringify(vouchers));
  window.dispatchEvent(new Event('vouchersUpdated'));
}

// Загрузка ваучеров из localStorage
export function loadVouchers(): Voucher[] {
  const stored = localStorage.getItem('customerVouchers');
  return stored ? JSON.parse(stored) : [];
}

// Получение ваучеров покупателя
export function getCustomerVouchers(customerAddress: string): Voucher[] {
  const vouchers = loadVouchers();
  return vouchers.filter(v => v.customerAddress.toLowerCase() === customerAddress.toLowerCase());
}

// Получение ваучеров мерчанта
export function getMerchantVouchers(merchantAddress: string): Voucher[] {
  const vouchers = loadVouchers();
  return vouchers.filter(v => v.merchantAddress.toLowerCase() === merchantAddress.toLowerCase());
}

// Получение награды по ID
export function getRewardById(rewardId: string): Reward | undefined {
  const rewards = loadRewards();
  return rewards.find(r => r.id === rewardId);
}
