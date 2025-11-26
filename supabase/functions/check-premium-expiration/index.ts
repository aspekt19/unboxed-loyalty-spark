import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase environment variables');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Starting premium subscription expiration check...');

    // Вызываем функцию проверки истекающих подписок
    const { error: checkError } = await supabase.rpc('check_expiring_subscriptions');

    if (checkError) {
      console.error('Error checking expiring subscriptions:', checkError);
      throw checkError;
    }

    // Получаем новые уведомления для отправки
    const { data: notifications, error: notifError } = await supabase
      .from('premium_expiration_notifications')
      .select(`
        *,
        premium_subscriptions (
          wallet_address,
          expires_at
        )
      `)
      .gte('sent_at', new Date(Date.now() - 5 * 60 * 1000).toISOString()) // За последние 5 минут
      .order('sent_at', { ascending: false });

    if (notifError) {
      console.error('Error fetching notifications:', notifError);
      throw notifError;
    }

    console.log(`Found ${notifications?.length || 0} new notifications`);

    const result = {
      success: true,
      notifications_sent: notifications?.length || 0,
      timestamp: new Date().toISOString(),
    };

    return new Response(
      JSON.stringify(result),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error in check-premium-expiration:', error);
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
