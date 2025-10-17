export interface Reward {
  id: string;
  tokenAddress: string;
  merchantAddress: string;
  name: string;
  description: string;
  cost: number; // количество токенов
  createdAt: string;
  isActive: boolean;
}

export interface Voucher {
  id: string;
  code: string;
  rewardId: string;
  rewardName: string;
  rewardDescription: string;
  tokenAddress: string;
  tokenSymbol: string;
  customerAddress: string;
  merchantAddress: string;
  status: 'active' | 'used' | 'expired';
  cost: number; // сколько токенов было потрачено
  activatedAt: string;
  usedAt?: string;
}

export interface RewardWithToken extends Reward {
  tokenName: string;
  tokenSymbol: string;
}
