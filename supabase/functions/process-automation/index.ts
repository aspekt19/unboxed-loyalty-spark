import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AutomationRule {
  id: string;
  merchant_address: string;
  token_address: string;
  rule_type: string;
  trigger_condition: any;
  action_config: any;
}

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
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    console.log('Starting automation processing...');

    // Fetch all active automation rules
    const { data: rules, error: rulesError } = await supabase
      .from('automation_rules')
      .select('*')
      .eq('is_active', true);

    if (rulesError) {
      throw rulesError;
    }

    console.log(`Found ${rules?.length || 0} active automation rules`);

    let processedCount = 0;

    for (const rule of rules || []) {
      try {
        await processRule(supabase, rule);
        processedCount++;
      } catch (error) {
        console.error(`Error processing rule ${rule.id}:`, error);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed_rules: processedCount,
        total_rules: rules?.length || 0,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in automation processing:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

async function processRule(supabase: any, rule: AutomationRule) {
  console.log(`Processing rule: ${rule.rule_type} (${rule.id})`);

  switch (rule.rule_type) {
    case 'at_risk_offer':
      await processAtRiskOffers(supabase, rule);
      break;
    case 'tier_upgrade':
      await processTierUpgrades(supabase, rule);
      break;
    case 'voucher_expiring':
      await processVoucherExpiring(supabase, rule);
      break;
    case 'inactive_reminder':
      await processInactiveReminders(supabase, rule);
      break;
    case 'birthday_bonus':
      await processBirthdayBonuses(supabase, rule);
      break;
    default:
      console.log(`Unknown rule type: ${rule.rule_type}`);
  }
}

async function processAtRiskOffers(supabase: any, rule: AutomationRule) {
  // Find customers with "at_risk" RFM score
  const { data: customers } = await supabase
    .from('customer_profiles')
    .select('wallet_address, email, first_name, last_name')
    .eq('rfm_score', 'at_risk');

  if (!customers || customers.length === 0) return;

  console.log(`Found ${customers.length} at-risk customers for rule ${rule.id}`);

  for (const customer of customers) {
    // Check if offer already exists for this customer
    const { data: existingOffer } = await supabase
      .from('personalized_offers')
      .select('id')
      .eq('customer_address', customer.wallet_address)
      .eq('token_address', rule.token_address)
      .eq('is_active', true)
      .single();

    if (existingOffer) continue; // Skip if offer already exists

    // Create personalized offer
    const offerData = {
      merchant_address: rule.merchant_address,
      token_address: rule.token_address,
      customer_address: customer.wallet_address,
      title: rule.action_config.title || 'Special Offer for You!',
      description: rule.action_config.description || 'We miss you! Come back and get a special discount.',
      discount_percentage: rule.action_config.discount_percentage || 15,
      bonus_tokens: rule.action_config.bonus_tokens || 50,
      valid_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
      is_active: true,
    };

    const { error } = await supabase
      .from('personalized_offers')
      .insert(offerData);

    // Log trigger history
    await supabase.from('automation_triggers_history').insert({
      rule_id: rule.id,
      merchant_address: rule.merchant_address,
      customer_address: customer.wallet_address,
      action_taken: 'created_personalized_offer',
      result: { offer: offerData },
      success: !error,
    });

    if (error) {
      console.error('Error creating offer:', error);
    } else {
      console.log(`Created offer for ${customer.wallet_address}`);
    }
  }
}

async function processTierUpgrades(supabase: any, rule: AutomationRule) {
  // Find customers who recently upgraded their tier
  const { data: recentUpgrades } = await supabase
    .from('customer_tier_status')
    .select(`
      *,
      customer_tiers!inner(tier_name, tier_level, badge_color, welcome_bonus)
    `)
    .eq('token_address', rule.token_address)
    .gte('tier_achieved_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()); // Last 24 hours

  if (!recentUpgrades || recentUpgrades.length === 0) return;

  console.log(`Found ${recentUpgrades.length} recent tier upgrades for rule ${rule.id}`);

  for (const upgrade of recentUpgrades) {
    // Check if we already sent congratulations
    const { data: existingTrigger } = await supabase
      .from('automation_triggers_history')
      .select('id')
      .eq('rule_id', rule.id)
      .eq('customer_address', upgrade.customer_address)
      .eq('action_taken', 'sent_tier_upgrade_congratulations')
      .gte('triggered_at', upgrade.tier_achieved_at)
      .single();

    if (existingTrigger) continue;

    // Create congratulations offer
    const congratsOffer = {
      merchant_address: rule.merchant_address,
      token_address: rule.token_address,
      customer_address: upgrade.customer_address,
      title: `Congratulations on ${upgrade.customer_tiers.tier_name} Tier!`,
      description: `You've been upgraded to ${upgrade.customer_tiers.tier_name} tier! Here's a special bonus to celebrate.`,
      bonus_tokens: upgrade.customer_tiers.welcome_bonus || rule.action_config.bonus_tokens || 100,
      valid_until: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(), // 14 days
      is_active: true,
    };

    const { error } = await supabase
      .from('personalized_offers')
      .insert(congratsOffer);

    // Log trigger history
    await supabase.from('automation_triggers_history').insert({
      rule_id: rule.id,
      merchant_address: rule.merchant_address,
      customer_address: upgrade.customer_address,
      action_taken: 'sent_tier_upgrade_congratulations',
      result: { tier: upgrade.customer_tiers.tier_name, offer: congratsOffer },
      success: !error,
    });

    if (!error) {
      console.log(`Sent tier upgrade congratulations to ${upgrade.customer_address}`);
    }
  }
}

async function processVoucherExpiring(supabase: any, rule: AutomationRule) {
  // This would check for vouchers expiring soon (if we had expiration dates on vouchers)
  // For now, we'll skip this as vouchers don't have expiration dates
  console.log('Voucher expiring processing not implemented yet');
}

async function processInactiveReminders(supabase: any, rule: AutomationRule) {
  const daysInactive = rule.trigger_condition.days_inactive || 60;
  const inactiveDate = new Date(Date.now() - daysInactive * 24 * 60 * 60 * 1000).toISOString();

  // Find customers who haven't used vouchers recently
  const { data: inactiveCustomers } = await supabase
    .from('vouchers')
    .select('customer_address')
    .eq('merchant_address', rule.merchant_address)
    .eq('token_address', rule.token_address)
    .lt('activated_at', inactiveDate)
    .order('activated_at', { ascending: false });

  if (!inactiveCustomers || inactiveCustomers.length === 0) return;

  // Get unique customers
  const uniqueCustomers = [...new Set(inactiveCustomers.map((v: any) => v.customer_address))];
  console.log(`Found ${uniqueCustomers.length} inactive customers for rule ${rule.id}`);

  for (const customerAddress of uniqueCustomers) {
    // Check if we already sent a reminder recently
    const { data: recentReminder } = await supabase
      .from('automation_triggers_history')
      .select('id')
      .eq('rule_id', rule.id)
      .eq('customer_address', customerAddress)
      .eq('action_taken', 'sent_inactive_reminder')
      .gte('triggered_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
      .single();

    if (recentReminder) continue;

    // Create comeback offer
    const comebackOffer = {
      merchant_address: rule.merchant_address,
      token_address: rule.token_address,
      customer_address: customerAddress,
      title: rule.action_config.title || 'We Miss You!',
      description: rule.action_config.description || 'Come back and enjoy special rewards!',
      discount_percentage: rule.action_config.discount_percentage || 20,
      bonus_tokens: rule.action_config.bonus_tokens || 75,
      valid_until: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000).toISOString(), // 21 days
      is_active: true,
    };

    const { error } = await supabase
      .from('personalized_offers')
      .insert(comebackOffer);

    // Log trigger history
    await supabase.from('automation_triggers_history').insert({
      rule_id: rule.id,
      merchant_address: rule.merchant_address,
      customer_address: customerAddress,
      action_taken: 'sent_inactive_reminder',
      result: { offer: comebackOffer },
      success: !error,
    });

    if (!error) {
      console.log(`Sent inactive reminder to ${customerAddress}`);
    }
  }
}

async function processBirthdayBonuses(supabase: any, rule: AutomationRule) {
  // This would check for customer birthdays and send bonuses
  // Requires birthday field in customer_profiles
  console.log('Birthday bonus processing not implemented yet (requires birthday field)');
}
