import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Auth check: only allow calls with service role key
  const authHeader = req.headers.get('Authorization')?.replace('Bearer ', '');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!serviceRoleKey || authHeader !== serviceRoleKey) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('Checking program expirations...');

    // Вызываем функцию для обновления статусов программ
    // Программы, истекающие в течение 24 часов, помечаются как 'expiring_soon'
    // Программы, которые истекли, помечаются как 'expired'
    const { error: updateError } = await supabase.rpc('check_program_expiration');
    
    if (updateError) {
      console.error('Error updating program statuses:', updateError);
      throw updateError;
    }

    // Получаем все истекшие программы для обработки
    const { data: expiredPrograms, error: fetchError } = await supabase
      .from('loyalty_programs')
      .select('*')
      .eq('status', 'expired');

    if (fetchError) {
      console.error('Error fetching expired programs:', fetchError);
      throw fetchError;
    }

    console.log(`Found ${expiredPrograms?.length || 0} expired programs to process`);

    // Обрабатываем истекшие программы - деактивируем награды и ваучеры
    // НЕ удаляем программу, она остается в статусе expired и может быть реактивирована
    if (expiredPrograms && expiredPrograms.length > 0) {
      for (const program of expiredPrograms) {
        console.log(`Processing expired program: ${program.name} (${program.token_address})`);

        // Деактивируем все награды для этой программы (безопасная идемпотентная операция)
        const { error: rewardsError } = await supabase
          .from('rewards')
          .update({ is_active: false })
          .eq('token_address', program.token_address.toLowerCase())
          .eq('is_active', true); // Обновляем только активные

        if (rewardsError) {
          console.error(`Error deactivating rewards for ${program.token_address}:`, rewardsError);
        } else {
          console.log(`Rewards deactivated for ${program.name}`);
        }

        // Закрываем все активные ваучеры (безопасная идемпотентная операция)
        const { error: vouchersError } = await supabase
          .from('vouchers')
          .update({ status: 'expired' })
          .eq('token_address', program.token_address.toLowerCase())
          .eq('status', 'active'); // Обновляем только активные

        if (vouchersError) {
          console.error(`Error expiring vouchers for ${program.token_address}:`, vouchersError);
        } else {
          console.log(`Vouchers expired for ${program.name}`);
        }

        console.log(`Expired program ${program.name} processed. Program remains in database.`);
      }
    }

    // Получаем программы, которым нужно отправить предупреждение
    const { data: expiringPrograms, error: expiringError } = await supabase
      .from('loyalty_programs')
      .select('*')
      .eq('status', 'expiring_soon')
      .eq('expiration_warning_sent', false);

    if (expiringError) {
      console.error('Error fetching expiring programs:', expiringError);
      throw expiringError;
    }

    console.log(`Found ${expiringPrograms?.length || 0} programs needing warnings`);

    // Помечаем, что предупреждения отправлены
    if (expiringPrograms && expiringPrograms.length > 0) {
      for (const program of expiringPrograms) {
        await supabase
          .from('loyalty_programs')
          .update({ expiration_warning_sent: true })
          .eq('id', program.id);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        processedCount: expiredPrograms?.length || 0,
        warningsCount: expiringPrograms?.length || 0,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error in check-program-expiration:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
