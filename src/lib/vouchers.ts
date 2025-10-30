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
    console.error('Failed to create reward - Supabase error:', {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
    });
    return null;
  }

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

// Загрузка наград мерчанта (БЕЗ фильтрации по статусу программы - мерчанты видят все свои награды)
export async function getMerchantRewards(merchantAddress: string): Promise<Reward[]> {
  const { data: allRewards, error } = await supabase
    .from('rewards')
    .select('*')
    .eq('merchant_address', merchantAddress.toLowerCase())
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching merchant rewards:', error);
    return [];
  }
  
  console.log('getMerchantRewards: Found', allRewards?.length || 0, 'total rewards');
  
  if (!allRewards || allRewards.length === 0) {
    return [];
  }
  
  // Мерчанты видят все свои награды независимо от статуса программы
  return allRewards.map(r => ({
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

// Получение наград для конкретного токена
export async function getRewardsByToken(tokenAddress: string): Promise<Reward[]> {
  // Сначала проверяем статус программы лояльности
  const { data: program, error: programError } = await supabase
    .from('loyalty_programs')
    .select('status')
    .eq('token_address', tokenAddress.toLowerCase())
    .maybeSingle();
  
  if (programError) {
    console.error('Error fetching program status:', programError);
    return [];
  }
  
  // Если программа неактивна (expired, paused и т.д.), не показываем награды
  if (!program || !['active', 'expiring_soon'].includes(program.status)) {
    console.log(`Program ${tokenAddress} is not active, status:`, program?.status);
    return [];
  }

  const { data, error } = await supabase
    .from('rewards')
    .select('*')
    .eq('token_address', tokenAddress.toLowerCase())
    .eq('is_active', true)
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

// Обновление награды
export async function updateReward(rewardId: string, updates: Partial<Reward>): Promise<boolean> {
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

  return true;
}

// Удаление награды
export async function deleteReward(rewardId: string): Promise<boolean> {
  const { error } = await supabase
    .from('rewards')
    .delete()
    .eq('id', rewardId);

  if (error) {
    return false;
  }

  return true;
}

// Создание ваучера в базе данных
export async function createVoucher(voucher: Omit<Voucher, 'id' | 'activatedAt'>): Promise<Voucher | null> {
  // Проверяем, что профиль пользователя существует перед созданием ваучера
  const { data: profileCheck, error: profileError } = await supabase
    .from('profiles')
    .select('wallet_address')
    .eq('wallet_address', voucher.customerAddress.toLowerCase())
    .maybeSingle();

  if (profileError) {
    console.error('[createVoucher] Error checking profile:', profileError);
    return null;
  }

  if (!profileCheck) {
    console.error('[createVoucher] Profile not found for address:', voucher.customerAddress);
    return null;
  }

  console.log('[createVoucher] Creating voucher:', {
    code: voucher.code,
    rewardId: voucher.rewardId,
    customerAddress: voucher.customerAddress.toLowerCase(),
    merchantAddress: voucher.merchantAddress.toLowerCase(),
    cost: voucher.cost,
  });

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
    console.error('[createVoucher] Error creating voucher:', error);
    console.error('[createVoucher] Error details:', {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
    return null;
  }

  console.log('[createVoucher] Voucher created successfully:', data.id);

  return {
    id: data.id,
    code: data.code,
    rewardId: data.reward_id,
    rewardName: data.reward_name,
    rewardDescription: data.reward_description || '',
    tokenAddress: data.token_address,
    tokenSymbol: data.token_symbol,
    customerAddress: data.customer_address,
    merchantAddress: data.merchant_address,
    status: data.status as 'active' | 'used' | 'expired',
    cost: Number(data.cost),
    activatedAt: data.activated_at,
    usedAt: data.used_at,
  };
}

// Загрузка ваучеров покупателя (фильтруем по статусу программы)
export async function getCustomerVouchers(customerAddress: string): Promise<Voucher[]> {
  const { data: allVouchers, error } = await supabase
    .from('vouchers')
    .select('*')
    .eq('customer_address', customerAddress.toLowerCase())
    .order('activated_at', { ascending: false });

  if (error) {
    console.error('Error fetching customer vouchers:', error);
    return [];
  }
  
  if (!allVouchers || allVouchers.length === 0) {
    return [];
  }
  
  // Проверяем статус программы для каждого ваучера
  const vouchersWithStatus = await Promise.all(
    allVouchers.map(async (voucher) => {
      const { data: program, error: programError } = await supabase
        .from('loyalty_programs')
        .select('status')
        .eq('token_address', voucher.token_address.toLowerCase())
        .maybeSingle();
      
      if (programError) {
        console.error('Error fetching program for customer voucher:', programError);
      }
      
      return {
        ...voucher,
        programStatus: program?.status
      };
    })
  );
  
  // Возвращаем только ваучеры активных или истекающих программ
  const activeVouchers = vouchersWithStatus.filter(v => 
    v.programStatus === 'active' || v.programStatus === 'expiring_soon'
  );
  
  return activeVouchers.map(v => ({
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
  }));
}

// Загрузка ваучеров мерчанта (БЕЗ фильтрации по статусу программы - мерчанты видят все свои ваучеры)
export async function getMerchantVouchers(merchantAddress: string): Promise<Voucher[]> {
  try {
    console.log('getMerchantVouchers called for:', merchantAddress);
    
    const { data: allVouchers, error } = await supabase
      .from('vouchers')
      .select('*')
      .eq('merchant_address', merchantAddress.toLowerCase())
      .order('activated_at', { ascending: false });

    if (error) {
      console.error('Error loading merchant vouchers:', error);
      throw error;
    }
    
    console.log('Merchant vouchers data:', allVouchers?.length || 0, 'rows');
    
    if (!allVouchers || allVouchers.length === 0) {
      return [];
    }
    
    // Мерчанты видят все свои ваучеры независимо от статуса программы
    return allVouchers.map(v => ({
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
    }));
  } catch (error) {
    console.error('Failed to load merchant vouchers:', error);
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

  if (error) {
    return false;
  }

  return true;
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

  return {
    id: data.id,
    tokenAddress: data.token_address,
    merchantAddress: data.merchant_address,
    name: data.name,
    description: data.description || '',
    cost: Number(data.cost),
    createdAt: data.created_at,
    isActive: data.is_active,
  };
}
