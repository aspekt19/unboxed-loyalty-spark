import { supabase } from '@/integrations/supabase/client';

interface LocalReward {
  id: string;
  tokenAddress: string;
  merchantAddress: string;
  name: string;
  description: string;
  cost: number;
  createdAt: string;
  isActive: boolean;
}

interface LocalVoucher {
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
  cost: number;
  activatedAt: string;
  usedAt?: string;
}

export async function migrateRewardsFromLocalStorage(): Promise<{ success: boolean; count: number }> {
  try {
    const stored = localStorage.getItem('merchantRewards');
    if (!stored) {
      console.log('No rewards in localStorage to migrate');
      return { success: true, count: 0 };
    }

    const localRewards: LocalReward[] = JSON.parse(stored);
    if (localRewards.length === 0) {
      return { success: true, count: 0 };
    }

    console.log(`Migrating ${localRewards.length} rewards from localStorage to database...`);

    // Проверяем, какие награды уже есть в базе
    const { data: existingRewards } = await supabase
      .from('rewards')
      .select('id');

    const existingIds = new Set(existingRewards?.map(r => r.id) || []);

    // Фильтруем только новые награды
    const rewardsToMigrate = localRewards.filter(r => !existingIds.has(r.id));

    if (rewardsToMigrate.length === 0) {
      console.log('All rewards already migrated');
      return { success: true, count: 0 };
    }

    // Вставляем награды в базу данных
    const { error } = await supabase
      .from('rewards')
      .insert(
        rewardsToMigrate.map(r => ({
          id: r.id,
          token_address: r.tokenAddress,
          merchant_address: r.merchantAddress,
          name: r.name,
          description: r.description,
          cost: r.cost,
          is_active: r.isActive,
          created_at: r.createdAt,
        }))
      );

    if (error) {
      console.error('Error migrating rewards:', error);
      return { success: false, count: 0 };
    }

    console.log(`Successfully migrated ${rewardsToMigrate.length} rewards`);
    
    // Очищаем localStorage после успешной миграции
    localStorage.removeItem('merchantRewards');
    
    return { success: true, count: rewardsToMigrate.length };
  } catch (error) {
    console.error('Error in migrateRewardsFromLocalStorage:', error);
    return { success: false, count: 0 };
  }
}

export async function migrateVouchersFromLocalStorage(): Promise<{ success: boolean; count: number }> {
  try {
    const stored = localStorage.getItem('customerVouchers');
    if (!stored) {
      console.log('No vouchers in localStorage to migrate');
      return { success: true, count: 0 };
    }

    const localVouchers: LocalVoucher[] = JSON.parse(stored);
    if (localVouchers.length === 0) {
      return { success: true, count: 0 };
    }

    console.log(`Migrating ${localVouchers.length} vouchers from localStorage to database...`);

    // Проверяем, какие ваучеры уже есть в базе
    const { data: existingVouchers } = await supabase
      .from('vouchers')
      .select('id');

    const existingIds = new Set(existingVouchers?.map(v => v.id) || []);

    // Фильтруем только новые ваучеры
    const vouchersToMigrate = localVouchers.filter(v => !existingIds.has(v.id));

    if (vouchersToMigrate.length === 0) {
      console.log('All vouchers already migrated');
      return { success: true, count: 0 };
    }

    // Вставляем ваучеры в базу данных
    const { error } = await supabase
      .from('vouchers')
      .insert(
        vouchersToMigrate.map(v => ({
          id: v.id,
          code: v.code,
          reward_id: v.rewardId,
          reward_name: v.rewardName,
          reward_description: v.rewardDescription,
          token_address: v.tokenAddress,
          token_symbol: v.tokenSymbol,
          customer_address: v.customerAddress,
          merchant_address: v.merchantAddress,
          status: v.status,
          cost: v.cost,
          activated_at: v.activatedAt,
          used_at: v.usedAt,
        }))
      );

    if (error) {
      console.error('Error migrating vouchers:', error);
      return { success: false, count: 0 };
    }

    console.log(`Successfully migrated ${vouchersToMigrate.length} vouchers`);
    
    // Очищаем localStorage после успешной миграции
    localStorage.removeItem('customerVouchers');
    
    return { success: true, count: vouchersToMigrate.length };
  } catch (error) {
    console.error('Error in migrateVouchersFromLocalStorage:', error);
    return { success: false, count: 0 };
  }
}

export async function migrateAllData(): Promise<void> {
  console.log('Starting data migration from localStorage to database...');
  
  const rewardsResult = await migrateRewardsFromLocalStorage();
  const vouchersResult = await migrateVouchersFromLocalStorage();

  if (rewardsResult.success && vouchersResult.success) {
    const totalMigrated = rewardsResult.count + vouchersResult.count;
    if (totalMigrated > 0) {
      console.log(`Migration complete! Migrated ${rewardsResult.count} rewards and ${vouchersResult.count} vouchers.`);
      // Обновляем UI
      window.dispatchEvent(new Event('rewardsUpdated'));
      window.dispatchEvent(new Event('vouchersUpdated'));
    }
  } else {
    console.error('Migration failed');
  }
}
