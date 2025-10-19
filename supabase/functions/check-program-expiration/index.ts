import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('Checking program expirations...');

    // Вызываем функцию для обновления статусов программ
    const { error: updateError } = await supabase.rpc('check_program_expiration');
    
    if (updateError) {
      console.error('Error updating program statuses:', updateError);
      throw updateError;
    }

    // Получаем программы, которые истекли более 24 часов назад
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    
    const { data: expiredPrograms, error: fetchError } = await supabase
      .from('loyalty_programs')
      .select('*')
      .eq('status', 'expired')
      .lt('expiration_date', oneDayAgo);

    if (fetchError) {
      console.error('Error fetching expired programs:', fetchError);
      throw fetchError;
    }

    console.log(`Found ${expiredPrograms?.length || 0} programs to delete`);

    // Удаляем программы, которые истекли более 24 часов назад
    if (expiredPrograms && expiredPrograms.length > 0) {
      for (const program of expiredPrograms) {
        console.log(`Deleting program: ${program.name} (${program.token_address})`);

        // Деактивируем все награды
        await supabase
          .from('rewards')
          .update({ is_active: false })
          .eq('token_address', program.token_address.toLowerCase());

        // Закрываем все активные ваучеры
        await supabase
          .from('vouchers')
          .update({ status: 'expired' })
          .eq('token_address', program.token_address.toLowerCase())
          .eq('status', 'active');

        // Удаляем программу
        await supabase
          .from('loyalty_programs')
          .delete()
          .eq('id', program.id);
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
        deletedCount: expiredPrograms?.length || 0,
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
