import { Reward, Voucher } from '@/types/rewards';
import { supabase } from '@/integrations/supabase/client';

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

// Создание награды в базе данных
export async function createReward(reward: Omit<Reward, 'id' | 'createdAt'>): Promise<Reward | null> {
  const { data, error } = await supabase
    .from('rewards')
    .insert({
      token_address: reward.tokenAddress.toLowerCase(),
      merchant_address: reward.merchantAddress.toLowerCase(),
      name: reward.name,
      description: reward.description,
      cost: reward.cost,
      is_active: reward.isActive,
    })
    .select()
    .single();

  if (error) {
    console.error('[createReward] Failed:', error.message, error.code);
    return null;
  }

  invalidateRewardsCache(reward.tokenAddress);

  return {
    id: data.id,
    tokenAddress: data.token_address,
    merchantAddress: data.merchant_address,
    name: data.name,
    description: data.description,
    cost: Number(data.cost),
    createdAt: data.created_at,
    isActive: data.is_active,
  };
}

// Загрузка всех наград
export async function loadRewards(): Promise<Reward[]> {
  const { data, error } = await supabase
    .from('rewards')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    return [];
  }

  return data.map(r => ({
    id: r.id,
    tokenAddress: r.token_address,
    merchantAddress: r.merchant_address,
    name: r.name,
    description: r.description || '',
    cost: Number(r.cost),
    createdAt: r.created_at,
    isActive: r.is_active,
  }));
}

/** Map a DB reward row to the app Reward type */
function mapRewardRow(r: any): Reward {
  return {
    id: r.id,
    tokenAddress: r.token_address,
    merchantAddress: r.merchant_address,
    name: r.name,
    description: r.description || '',
    cost: Number(r.cost),
    createdAt: r.created_at,
    isActive: r.is_active,
  };
}

/** Map a DB voucher row to the app Voucher type */
function mapVoucherRow(v: any): Voucher {
  return {
    id: v.id,
    code: v.code,
    rewardId: v.reward_id,
    rewardName: v.reward_name,
    rewardDescription: v.reward_description || '',
    tokenAddress: v.token_address,
    tokenSymbol: v.token_symbol,
    customerAddress: v.customer_address,
    merchantAddress: v.merchant_address,
    status: v.status as 'active' | 'used' | 'expired',
    cost: Number(v.cost),
    activatedAt: v.activated_at,
    usedAt: v.used_at,
  };
}

// Загрузка наград мерчанта (БЕЗ фильтрации по статусу программы)
export async function getMerchantRewards(merchantAddress: string): Promise<Reward[]> {
  const { data, error } = await supabase
    .from('rewards')
    .select('*')
    .eq('merchant_address', merchantAddress.toLowerCase())
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[getMerchantRewards] Error:', error.message);
    return [];
  }

  return (data || []).map(mapRewardRow);
}

// Простой in-memory кеш для наград с TTL
const rewardsCache = new Map<string, { data: Reward[]; timestamp: number }>();
const CACHE_TTL_MS = 30000;

// Кеш для статусов программ
const programStatusCache = new Map<string, { status: string; timestamp: number }>();

// Получение наград для конкретного токена (с кешированием)
export async function getRewardsByToken(tokenAddress: string): Promise<Reward[]> {
  const cacheKey = tokenAddress.toLowerCase();
  const now = Date.now();
  
  const cached = rewardsCache.get(cacheKey);
  if (cached && (now - cached.timestamp) < CACHE_TTL_MS) {
    return cached.data;
  }
  
  try {
    const { data: rewardsData, error: rewardsError } = await supabase
      .from('rewards')
      .select('*')
      .eq('token_address', cacheKey)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(50);
    
    if (rewardsError) {
      console.error('[getRewardsByToken] Error:', rewardsError.message);
      return [];
    }

    const rewards = (rewardsData || []).map(mapRewardRow);
    rewardsCache.set(cacheKey, { data: rewards, timestamp: now });
    return rewards;
  } catch (error: any) {
    console.error('[getRewardsByToken] Error:', error.message || error);
    return [];
  }
}

// Инвалидация кеша
export function invalidateRewardsCache(tokenAddress?: string): void {
  if (tokenAddress) {
    const key = tokenAddress.toLowerCase();
    rewardsCache.delete(key);
    programStatusCache.delete(key);
  } else {
    rewardsCache.clear();
    programStatusCache.clear();
  }
}

// Обновление награды
export async function updateReward(rewardId: string, updates: Partial<Reward>, tokenAddress?: string): Promise<boolean> {
  const dbUpdates: any = {};
  
  if (updates.name !== undefined) dbUpdates.name = updates.name;
  if (updates.description !== undefined) dbUpdates.description = updates.description;
  if (updates.cost !== undefined) dbUpdates.cost = updates.cost;
  if (updates.isActive !== undefined) dbUpdates.is_active = updates.isActive;

  const { error } = await supabase
    .from('rewards')
    .update(dbUpdates)
    .eq('id', rewardId);

  if (error) {
    return false;
  }

  invalidateRewardsCache(tokenAddress);
  return true;
}

// Удаление награды
export async function deleteReward(rewardId: string, tokenAddress?: string): Promise<boolean> {
  const { error } = await supabase
    .from('rewards')
    .delete()
    .eq('id', rewardId);

  if (error) {
    console.error('[deleteReward] failed', error);
    return false;
  }


  invalidateRewardsCache(tokenAddress);
  return true;
}

// Создание ваучера в базе данных
export async function createVoucher(voucher: Omit<Voucher, 'id' | 'activatedAt'>): Promise<Voucher | null> {
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  
  if (sessionError || !session) {
    console.error('[createVoucher] No active session');
    return null;
  }
  
  // Проверяем профиль пользователя
  const { data: profileCheck, error: profileError } = await supabase
    .from('profiles')
    .select('wallet_address, user_id')
    .eq('wallet_address', voucher.customerAddress.toLowerCase())
    .maybeSingle();

  if (profileError) {
    console.error('[createVoucher] Profile check error:', profileError.message);
    return null;
  }

  if (!profileCheck) {
    console.error('[createVoucher] Profile not found for:', voucher.customerAddress);
    return null;
  }

  const { data, error } = await supabase
    .from('vouchers')
    .insert({
      code: voucher.code,
      reward_id: voucher.rewardId,
      reward_name: voucher.rewardName,
      reward_description: voucher.rewardDescription,
      token_address: voucher.tokenAddress.toLowerCase(),
      token_symbol: voucher.tokenSymbol,
      customer_address: voucher.customerAddress.toLowerCase(),
      merchant_address: voucher.merchantAddress.toLowerCase(),
      status: voucher.status,
      cost: voucher.cost,
      used_at: voucher.usedAt,
    })
    .select()
    .single();

  if (error) {
    console.error('[createVoucher] Insert error:', error.message, error.code);
    return null;
  }

  return mapVoucherRow(data);
}

// Загрузка ваучеров покупателя (фильтруем по статусу программы)
export async function getCustomerVouchers(customerAddress: string): Promise<Voucher[]> {
  const { data: allVouchers, error } = await supabase
    .from('vouchers')
    .select('*')
    .eq('customer_address', customerAddress.toLowerCase())
    .order('activated_at', { ascending: false });

  if (error) {
    console.error('[getCustomerVouchers] Error:', error.message);
    return [];
  }
  
  if (!allVouchers || allVouchers.length === 0) {
    return [];
  }
  
  return allVouchers.map(mapVoucherRow);
}

// Загрузка ваучеров мерчанта (БЕЗ фильтрации по статусу программы)
export async function getMerchantVouchers(merchantAddress: string): Promise<Voucher[]> {
  try {
    const { data: allVouchers, error } = await supabase
      .from('vouchers')
      .select('*')
      .eq('merchant_address', merchantAddress.toLowerCase())
      .order('activated_at', { ascending: false });

    if (error) {
      console.error('[getMerchantVouchers] Error:', error.message);
      throw error;
    }
    
    if (!allVouchers || allVouchers.length === 0) {
      return [];
    }
    
    return allVouchers.map(mapVoucherRow);
  } catch (error) {
    console.error('[getMerchantVouchers] Failed:', error);
    return [];
  }
}

// Обновление статуса ваучера
export async function updateVoucherStatus(
  voucherId: string,
  status: 'active' | 'used' | 'expired'
): Promise<boolean> {
  const updates: any = { status };
  if (status === 'used') {
    updates.used_at = new Date().toISOString();
  }

  const { error } = await supabase
    .from('vouchers')
    .update(updates)
    .eq('id', voucherId);

  return !error;
}

// Получение награды по ID
export async function getRewardById(rewardId: string): Promise<Reward | null> {
  const { data, error } = await supabase
    .from('rewards')
    .select('*')
    .eq('id', rewardId)
    .single();

  if (error) {
    return null;
  }

  return mapRewardRow(data);
}
