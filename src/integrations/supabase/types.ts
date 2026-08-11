export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      agent_activity_log: {
        Row: {
          action: string
          agent_id: string
          created_at: string | null
          id: string
          ip_address: string | null
          request_body: Json | null
          response_body: Json | null
          response_status: number | null
        }
        Insert: {
          action: string
          agent_id: string
          created_at?: string | null
          id?: string
          ip_address?: string | null
          request_body?: Json | null
          response_body?: Json | null
          response_status?: number | null
        }
        Update: {
          action?: string
          agent_id?: string
          created_at?: string | null
          id?: string
          ip_address?: string | null
          request_body?: Json | null
          response_body?: Json | null
          response_status?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_activity_log_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agent_registry"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_api_rate_windows: {
        Row: {
          agent_id: string
          agent_kind: string
          request_count: number
          updated_at: string
          window_start: string
        }
        Insert: {
          agent_id: string
          agent_kind: string
          request_count?: number
          updated_at?: string
          window_start: string
        }
        Update: {
          agent_id?: string
          agent_kind?: string
          request_count?: number
          updated_at?: string
          window_start?: string
        }
        Relationships: []
      }
      agent_fee_log: {
        Row: {
          agent_id: string
          created_at: string | null
          fee_amount: number
          fee_percent: number
          id: string
          mint_amount: number
          operation: string
          recipient_address: string
          token_address: string
        }
        Insert: {
          agent_id: string
          created_at?: string | null
          fee_amount: number
          fee_percent: number
          id?: string
          mint_amount: number
          operation: string
          recipient_address: string
          token_address: string
        }
        Update: {
          agent_id?: string
          created_at?: string | null
          fee_amount?: number
          fee_percent?: number
          id?: string
          mint_amount?: number
          operation?: string
          recipient_address?: string
          token_address?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_fee_log_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agent_registry"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_fee_obligations: {
        Row: {
          agent_id: string
          created_at: string
          fee_amount: number
          fee_percent: number
          fee_tx_hash: string | null
          id: string
          last_verified_at: string | null
          mint_amount: number
          operation: string
          owner_address: string
          recipient_address: string
          recipient_tx_hash: string | null
          settled_at: string | null
          status: string
          token_address: string
          updated_at: string
          verification_attempts: number
        }
        Insert: {
          agent_id: string
          created_at?: string
          fee_amount: number
          fee_percent: number
          fee_tx_hash?: string | null
          id?: string
          last_verified_at?: string | null
          mint_amount: number
          operation?: string
          owner_address: string
          recipient_address: string
          recipient_tx_hash?: string | null
          settled_at?: string | null
          status?: string
          token_address: string
          updated_at?: string
          verification_attempts?: number
        }
        Update: {
          agent_id?: string
          created_at?: string
          fee_amount?: number
          fee_percent?: number
          fee_tx_hash?: string | null
          id?: string
          last_verified_at?: string | null
          mint_amount?: number
          operation?: string
          owner_address?: string
          recipient_address?: string
          recipient_tx_hash?: string | null
          settled_at?: string | null
          status?: string
          token_address?: string
          updated_at?: string
          verification_attempts?: number
        }
        Relationships: [
          {
            foreignKeyName: "agent_fee_obligations_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agent_registry"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_plan_subscriptions: {
        Row: {
          amount_usdc: number
          billing_cycle: string
          created_at: string | null
          expires_at: string | null
          id: string
          is_trial: boolean
          owner_address: string
          paid_at: string | null
          plan_id: string
          status: string
          transaction_hash: string | null
          updated_at: string | null
        }
        Insert: {
          amount_usdc: number
          billing_cycle?: string
          created_at?: string | null
          expires_at?: string | null
          id?: string
          is_trial?: boolean
          owner_address: string
          paid_at?: string | null
          plan_id: string
          status?: string
          transaction_hash?: string | null
          updated_at?: string | null
        }
        Update: {
          amount_usdc?: number
          billing_cycle?: string
          created_at?: string | null
          expires_at?: string | null
          id?: string
          is_trial?: boolean
          owner_address?: string
          paid_at?: string | null
          plan_id?: string
          status?: string
          transaction_hash?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_plan_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "agent_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_plans: {
        Row: {
          created_at: string | null
          description: string | null
          features: Json | null
          id: string
          is_active: boolean | null
          max_agents: number
          max_api_calls_monthly: number | null
          max_mint_amount_monthly: number | null
          name: string
          price_eth_monthly: number
          price_usdc_monthly: number
          slug: string
          transaction_fee_percent: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          features?: Json | null
          id?: string
          is_active?: boolean | null
          max_agents?: number
          max_api_calls_monthly?: number | null
          max_mint_amount_monthly?: number | null
          name: string
          price_eth_monthly?: number
          price_usdc_monthly?: number
          slug: string
          transaction_fee_percent?: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          features?: Json | null
          id?: string
          is_active?: boolean | null
          max_agents?: number
          max_api_calls_monthly?: number | null
          max_mint_amount_monthly?: number | null
          name?: string
          price_eth_monthly?: number
          price_usdc_monthly?: number
          slug?: string
          transaction_fee_percent?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      agent_registry: {
        Row: {
          agent_wallet_address: string | null
          api_key_hash: string
          api_key_prefix: string
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          last_request_at: string | null
          name: string
          owner_address: string
          plan_id: string | null
          rate_limit_per_minute: number | null
          scopes: string[] | null
          total_requests: number | null
          updated_at: string | null
        }
        Insert: {
          agent_wallet_address?: string | null
          api_key_hash: string
          api_key_prefix: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          last_request_at?: string | null
          name: string
          owner_address: string
          plan_id?: string | null
          rate_limit_per_minute?: number | null
          scopes?: string[] | null
          total_requests?: number | null
          updated_at?: string | null
        }
        Update: {
          agent_wallet_address?: string | null
          api_key_hash?: string
          api_key_prefix?: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          last_request_at?: string | null
          name?: string
          owner_address?: string
          plan_id?: string | null
          rate_limit_per_minute?: number | null
          scopes?: string[] | null
          total_requests?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_registry_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "agent_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_reports: {
        Row: {
          action_items: Json | null
          agent_name: string
          agent_role: string
          content: string
          created_at: string | null
          id: string
          metadata: Json | null
          owner_address: string | null
          priority: string | null
          report_type: string
          reviewed_at: string | null
          status: string | null
          title: string
        }
        Insert: {
          action_items?: Json | null
          agent_name: string
          agent_role: string
          content: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          owner_address?: string | null
          priority?: string | null
          report_type: string
          reviewed_at?: string | null
          status?: string | null
          title: string
        }
        Update: {
          action_items?: Json | null
          agent_name?: string
          agent_role?: string
          content?: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          owner_address?: string | null
          priority?: string | null
          report_type?: string
          reviewed_at?: string | null
          status?: string | null
          title?: string
        }
        Relationships: []
      }
      agent_usage: {
        Row: {
          api_calls_count: number | null
          created_at: string | null
          fees_collected_eth: number | null
          fees_collected_usdc: number | null
          id: string
          mint_operations_count: number | null
          mint_total_amount: number | null
          owner_address: string
          period_end: string
          period_start: string
          plan_id: string | null
          updated_at: string | null
        }
        Insert: {
          api_calls_count?: number | null
          created_at?: string | null
          fees_collected_eth?: number | null
          fees_collected_usdc?: number | null
          id?: string
          mint_operations_count?: number | null
          mint_total_amount?: number | null
          owner_address: string
          period_end: string
          period_start: string
          plan_id?: string | null
          updated_at?: string | null
        }
        Update: {
          api_calls_count?: number | null
          created_at?: string | null
          fees_collected_eth?: number | null
          fees_collected_usdc?: number | null
          id?: string
          mint_operations_count?: number | null
          mint_total_amount?: number | null
          owner_address?: string
          period_end?: string
          period_start?: string
          plan_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_usage_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "agent_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_wallets: {
        Row: {
          agent_id: string
          chain_id: number
          created_at: string | null
          id: string
          is_active: boolean | null
          updated_at: string | null
          wallet_address: string
          wallet_type: string
        }
        Insert: {
          agent_id: string
          chain_id?: number
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          updated_at?: string | null
          wallet_address: string
          wallet_type?: string
        }
        Update: {
          agent_id?: string
          chain_id?: number
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          updated_at?: string | null
          wallet_address?: string
          wallet_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_wallets_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agent_registry"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_rules: {
        Row: {
          action_config: Json
          created_at: string | null
          id: string
          is_active: boolean | null
          merchant_address: string
          rule_type: string
          token_address: string
          trigger_condition: Json
          updated_at: string | null
        }
        Insert: {
          action_config: Json
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          merchant_address: string
          rule_type: string
          token_address: string
          trigger_condition: Json
          updated_at?: string | null
        }
        Update: {
          action_config?: Json
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          merchant_address?: string
          rule_type?: string
          token_address?: string
          trigger_condition?: Json
          updated_at?: string | null
        }
        Relationships: []
      }
      automation_triggers_history: {
        Row: {
          action_taken: string
          customer_address: string
          id: string
          merchant_address: string
          result: Json | null
          rule_id: string | null
          success: boolean | null
          triggered_at: string | null
        }
        Insert: {
          action_taken: string
          customer_address: string
          id?: string
          merchant_address: string
          result?: Json | null
          rule_id?: string | null
          success?: boolean | null
          triggered_at?: string | null
        }
        Update: {
          action_taken?: string
          customer_address?: string
          id?: string
          merchant_address?: string
          result?: Json | null
          rule_id?: string | null
          success?: boolean | null
          triggered_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "automation_triggers_history_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "automation_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      blockchain_sync_status: {
        Row: {
          id: string
          last_synced_at: string | null
          last_synced_block: number
          token_address: string
          updated_at: string | null
        }
        Insert: {
          id?: string
          last_synced_at?: string | null
          last_synced_block?: number
          token_address: string
          updated_at?: string | null
        }
        Update: {
          id?: string
          last_synced_at?: string | null
          last_synced_block?: number
          token_address?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      customer_profiles: {
        Row: {
          cdp_wallet_address: string | null
          cdp_wallet_created_at: string | null
          created_at: string | null
          email: string | null
          first_name: string | null
          id: string
          last_name: string | null
          last_purchase_date: string | null
          phone: string | null
          rfm_score: string | null
          total_purchases: number | null
          total_spent: number | null
          updated_at: string | null
          wallet_address: string
        }
        Insert: {
          cdp_wallet_address?: string | null
          cdp_wallet_created_at?: string | null
          created_at?: string | null
          email?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          last_purchase_date?: string | null
          phone?: string | null
          rfm_score?: string | null
          total_purchases?: number | null
          total_spent?: number | null
          updated_at?: string | null
          wallet_address: string
        }
        Update: {
          cdp_wallet_address?: string | null
          cdp_wallet_created_at?: string | null
          created_at?: string | null
          email?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          last_purchase_date?: string | null
          phone?: string | null
          rfm_score?: string | null
          total_purchases?: number | null
          total_spent?: number | null
          updated_at?: string | null
          wallet_address?: string
        }
        Relationships: []
      }
      customer_tier_status: {
        Row: {
          created_at: string | null
          current_balance: number | null
          current_tier_id: string | null
          customer_address: string
          id: string
          last_calculated_at: string | null
          tier_achieved_at: string | null
          token_address: string
          tokens_earned_total: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          current_balance?: number | null
          current_tier_id?: string | null
          customer_address: string
          id?: string
          last_calculated_at?: string | null
          tier_achieved_at?: string | null
          token_address: string
          tokens_earned_total?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          current_balance?: number | null
          current_tier_id?: string | null
          customer_address?: string
          id?: string
          last_calculated_at?: string | null
          tier_achieved_at?: string | null
          token_address?: string
          tokens_earned_total?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_tier_status_current_tier_id_fkey"
            columns: ["current_tier_id"]
            isOneToOne: false
            referencedRelation: "customer_tiers"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_tiers: {
        Row: {
          badge_color: string | null
          cashback_multiplier: number | null
          created_at: string | null
          id: string
          min_tokens: number
          perks: Json | null
          tier_level: number
          tier_name: string
          token_address: string
          updated_at: string | null
          welcome_bonus: number | null
        }
        Insert: {
          badge_color?: string | null
          cashback_multiplier?: number | null
          created_at?: string | null
          id?: string
          min_tokens: number
          perks?: Json | null
          tier_level: number
          tier_name: string
          token_address: string
          updated_at?: string | null
          welcome_bonus?: number | null
        }
        Update: {
          badge_color?: string | null
          cashback_multiplier?: number | null
          created_at?: string | null
          id?: string
          min_tokens?: number
          perks?: Json | null
          tier_level?: number
          tier_name?: string
          token_address?: string
          updated_at?: string | null
          welcome_bonus?: number | null
        }
        Relationships: []
      }
      customer_transactions: {
        Row: {
          amount: number
          created_at: string | null
          customer_address: string
          id: string
          merchant_address: string
          token_address: string
          transaction_date: string | null
          transaction_type: string
          voucher_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          customer_address: string
          id?: string
          merchant_address: string
          token_address: string
          transaction_date?: string | null
          transaction_type: string
          voucher_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          customer_address?: string
          id?: string
          merchant_address?: string
          token_address?: string
          transaction_date?: string | null
          transaction_type?: string
          voucher_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_transactions_voucher_id_fkey"
            columns: ["voucher_id"]
            isOneToOne: false
            referencedRelation: "vouchers"
            referencedColumns: ["id"]
          },
        ]
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      gift_certificates: {
        Row: {
          code: string
          created_at: string
          description: string | null
          expires_at: string | null
          id: string
          image_url: string | null
          max_redemption_percent: number
          merchant_address: string
          mint_tx_hash: string | null
          points_per_dollar: number
          redeemed_at: string | null
          redeemed_by: string | null
          status: string
          title: string
          token_address: string
          token_amount: number
          token_symbol: string | null
          updated_at: string
          usd_amount: number
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          expires_at?: string | null
          id?: string
          image_url?: string | null
          max_redemption_percent?: number
          merchant_address: string
          mint_tx_hash?: string | null
          points_per_dollar: number
          redeemed_at?: string | null
          redeemed_by?: string | null
          status?: string
          title?: string
          token_address: string
          token_amount: number
          token_symbol?: string | null
          updated_at?: string
          usd_amount: number
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          expires_at?: string | null
          id?: string
          image_url?: string | null
          max_redemption_percent?: number
          merchant_address?: string
          mint_tx_hash?: string | null
          points_per_dollar?: number
          redeemed_at?: string | null
          redeemed_by?: string | null
          status?: string
          title?: string
          token_address?: string
          token_amount?: number
          token_symbol?: string | null
          updated_at?: string
          usd_amount?: number
        }
        Relationships: []
      }
      identity_links: {
        Row: {
          created_at: string
          id: string
          is_primary: boolean
          link_type: string
          linked_via: string
          user_id: string
          value: string
          value_normalized: string
          verified_at: string
          verified_via: string
          wallet_address: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_primary?: boolean
          link_type: string
          linked_via?: string
          user_id: string
          value: string
          value_normalized: string
          verified_at?: string
          verified_via: string
          wallet_address?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_primary?: boolean
          link_type?: string
          linked_via?: string
          user_id?: string
          value?: string
          value_normalized?: string
          verified_at?: string
          verified_via?: string
          wallet_address?: string | null
        }
        Relationships: []
      }
      loyalty_programs: {
        Row: {
          cashback_rate: number
          created_at: string
          expiration_date: string
          expiration_warning_sent: boolean
          id: string
          merchant_address: string
          name: string
          points_per_dollar: number
          status: string
          symbol: string
          token_address: string
          token_standard: string
          updated_at: string
        }
        Insert: {
          cashback_rate?: number
          created_at?: string
          expiration_date: string
          expiration_warning_sent?: boolean
          id?: string
          merchant_address: string
          name: string
          points_per_dollar?: number
          status?: string
          symbol: string
          token_address: string
          token_standard?: string
          updated_at?: string
        }
        Update: {
          cashback_rate?: number
          created_at?: string
          expiration_date?: string
          expiration_warning_sent?: boolean
          id?: string
          merchant_address?: string
          name?: string
          points_per_dollar?: number
          status?: string
          symbol?: string
          token_address?: string
          token_standard?: string
          updated_at?: string
        }
        Relationships: []
      }
      marketing_campaigns: {
        Row: {
          created_at: string | null
          id: string
          max_balance: number | null
          merchant_address: string
          message: string
          min_balance: number | null
          recipients_count: number | null
          scheduled_at: string | null
          sent_at: string | null
          status: string | null
          target_segment: string | null
          title: string
          token_address: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          max_balance?: number | null
          merchant_address: string
          message: string
          min_balance?: number | null
          recipients_count?: number | null
          scheduled_at?: string | null
          sent_at?: string | null
          status?: string | null
          target_segment?: string | null
          title: string
          token_address: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          max_balance?: number | null
          merchant_address?: string
          message?: string
          min_balance?: number | null
          recipients_count?: number | null
          scheduled_at?: string | null
          sent_at?: string | null
          status?: string | null
          target_segment?: string | null
          title?: string
          token_address?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      marketplace_offers: {
        Row: {
          completed_at: string | null
          completed_by: string | null
          created_at: string | null
          creator_address: string
          id: string
          offer_amount: number
          offer_token_address: string
          request_amount: number
          request_token_address: string
          status: string
          updated_at: string | null
        }
        Insert: {
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string | null
          creator_address: string
          id?: string
          offer_amount: number
          offer_token_address: string
          request_amount: number
          request_token_address: string
          status?: string
          updated_at?: string | null
        }
        Update: {
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string | null
          creator_address?: string
          id?: string
          offer_amount?: number
          offer_token_address?: string
          request_amount?: number
          request_token_address?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      merchant_branches: {
        Row: {
          branch_address: string | null
          branch_name: string
          created_at: string
          id: string
          is_active: boolean
          merchant_address: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          branch_address?: string | null
          branch_name: string
          created_at?: string
          id?: string
          is_active?: boolean
          merchant_address: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          branch_address?: string | null
          branch_name?: string
          created_at?: string
          id?: string
          is_active?: boolean
          merchant_address?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      merchant_employees: {
        Row: {
          branch_id: string | null
          created_at: string
          display_name: string | null
          employee_wallet_address: string
          id: string
          invited_by: string | null
          is_active: boolean
          joined_at: string | null
          merchant_address: string
          role: Database["public"]["Enums"]["merchant_employee_role"]
          updated_at: string
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          display_name?: string | null
          employee_wallet_address: string
          id?: string
          invited_by?: string | null
          is_active?: boolean
          joined_at?: string | null
          merchant_address: string
          role?: Database["public"]["Enums"]["merchant_employee_role"]
          updated_at?: string
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          display_name?: string | null
          employee_wallet_address?: string
          id?: string
          invited_by?: string | null
          is_active?: boolean
          joined_at?: string | null
          merchant_address?: string
          role?: Database["public"]["Enums"]["merchant_employee_role"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "merchant_employees_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "merchant_branches"
            referencedColumns: ["id"]
          },
        ]
      }
      merchant_invites: {
        Row: {
          branch_id: string | null
          created_at: string
          expires_at: string | null
          id: string
          invite_code: string | null
          merchant_address: string
          role: Database["public"]["Enums"]["merchant_employee_role"]
          status: string
          target_wallet_address: string | null
          used_at: string | null
          used_by: string | null
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          invite_code?: string | null
          merchant_address: string
          role?: Database["public"]["Enums"]["merchant_employee_role"]
          status?: string
          target_wallet_address?: string | null
          used_at?: string | null
          used_by?: string | null
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          invite_code?: string | null
          merchant_address?: string
          role?: Database["public"]["Enums"]["merchant_employee_role"]
          status?: string
          target_wallet_address?: string | null
          used_at?: string | null
          used_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "merchant_invites_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "merchant_branches"
            referencedColumns: ["id"]
          },
        ]
      }
      merchant_plan_subscriptions: {
        Row: {
          amount_usdc: number
          billing_cycle: string
          created_at: string | null
          expires_at: string | null
          id: string
          is_trial: boolean
          owner_address: string
          paid_at: string | null
          plan_id: string
          status: string
          transaction_hash: string | null
          updated_at: string | null
        }
        Insert: {
          amount_usdc: number
          billing_cycle?: string
          created_at?: string | null
          expires_at?: string | null
          id?: string
          is_trial?: boolean
          owner_address: string
          paid_at?: string | null
          plan_id: string
          status?: string
          transaction_hash?: string | null
          updated_at?: string | null
        }
        Update: {
          amount_usdc?: number
          billing_cycle?: string
          created_at?: string | null
          expires_at?: string | null
          id?: string
          is_trial?: boolean
          owner_address?: string
          paid_at?: string | null
          plan_id?: string
          status?: string
          transaction_hash?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "merchant_plan_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "merchant_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      merchant_plans: {
        Row: {
          created_at: string | null
          description: string | null
          features: Json | null
          id: string
          is_active: boolean | null
          name: string
          price_usdc_monthly: number
          slug: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          features?: Json | null
          id?: string
          is_active?: boolean | null
          name: string
          price_usdc_monthly?: number
          slug: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          features?: Json | null
          id?: string
          is_active?: boolean | null
          name?: string
          price_usdc_monthly?: number
          slug?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      merchant_profiles: {
        Row: {
          business_name: string
          category: string
          created_at: string
          description: string | null
          id: string
          location: string | null
          logo_url: string | null
          merchant_address: string
          merchant_plan_id: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          business_name: string
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          location?: string | null
          logo_url?: string | null
          merchant_address: string
          merchant_plan_id?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          business_name?: string
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          location?: string | null
          logo_url?: string | null
          merchant_address?: string
          merchant_plan_id?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "merchant_profiles_merchant_plan_id_fkey"
            columns: ["merchant_plan_id"]
            isOneToOne: false
            referencedRelation: "merchant_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_history: {
        Row: {
          campaign_id: string | null
          clicked: boolean | null
          created_at: string | null
          customer_address: string
          delivered_at: string | null
          id: string
          opened_at: string | null
          status: string | null
        }
        Insert: {
          campaign_id?: string | null
          clicked?: boolean | null
          created_at?: string | null
          customer_address: string
          delivered_at?: string | null
          id?: string
          opened_at?: string | null
          status?: string | null
        }
        Update: {
          campaign_id?: string | null
          clicked?: boolean | null
          created_at?: string | null
          customer_address?: string
          delivered_at?: string | null
          id?: string
          opened_at?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notification_history_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "marketing_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      notify_me_signups: {
        Row: {
          created_at: string
          email: string
          id: string
          source: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          source?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          source?: string | null
        }
        Relationships: []
      }
      payment_settings: {
        Row: {
          admin_wallet_address: string
          created_at: string | null
          id: string
          subscription_wallet_address: string | null
          updated_at: string | null
          usdc_price: number
        }
        Insert: {
          admin_wallet_address: string
          created_at?: string | null
          id?: string
          subscription_wallet_address?: string | null
          updated_at?: string | null
          usdc_price?: number
        }
        Update: {
          admin_wallet_address?: string
          created_at?: string | null
          id?: string
          subscription_wallet_address?: string | null
          updated_at?: string | null
          usdc_price?: number
        }
        Relationships: []
      }
      personalized_offers: {
        Row: {
          bonus_tokens: number | null
          created_at: string | null
          customer_address: string
          description: string | null
          discount_percentage: number | null
          id: string
          is_active: boolean | null
          is_used: boolean | null
          merchant_address: string
          min_purchase: number | null
          title: string
          token_address: string
          updated_at: string | null
          used_at: string | null
          valid_from: string | null
          valid_until: string
        }
        Insert: {
          bonus_tokens?: number | null
          created_at?: string | null
          customer_address: string
          description?: string | null
          discount_percentage?: number | null
          id?: string
          is_active?: boolean | null
          is_used?: boolean | null
          merchant_address: string
          min_purchase?: number | null
          title: string
          token_address: string
          updated_at?: string | null
          used_at?: string | null
          valid_from?: string | null
          valid_until: string
        }
        Update: {
          bonus_tokens?: number | null
          created_at?: string | null
          customer_address?: string
          description?: string | null
          discount_percentage?: number | null
          id?: string
          is_active?: boolean | null
          is_used?: boolean | null
          merchant_address?: string
          min_purchase?: number | null
          title?: string
          token_address?: string
          updated_at?: string | null
          used_at?: string | null
          valid_from?: string | null
          valid_until?: string
        }
        Relationships: []
      }
      platform_merchant_admin_wallets: {
        Row: {
          created_at: string
          note: string | null
          wallet_address: string
        }
        Insert: {
          created_at?: string
          note?: string | null
          wallet_address: string
        }
        Update: {
          created_at?: string
          note?: string | null
          wallet_address?: string
        }
        Relationships: []
      }
      premium_activity_log: {
        Row: {
          activity_data: Json | null
          activity_type: string
          created_at: string | null
          id: string
          wallet_address: string
        }
        Insert: {
          activity_data?: Json | null
          activity_type: string
          created_at?: string | null
          id?: string
          wallet_address: string
        }
        Update: {
          activity_data?: Json | null
          activity_type?: string
          created_at?: string | null
          id?: string
          wallet_address?: string
        }
        Relationships: []
      }
      premium_expiration_notifications: {
        Row: {
          created_at: string | null
          id: string
          notification_type: string
          sent_at: string | null
          subscription_id: string
          wallet_address: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          notification_type: string
          sent_at?: string | null
          subscription_id: string
          wallet_address: string
        }
        Update: {
          created_at?: string | null
          id?: string
          notification_type?: string
          sent_at?: string | null
          subscription_id?: string
          wallet_address?: string
        }
        Relationships: [
          {
            foreignKeyName: "premium_expiration_notifications_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "premium_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      premium_payment_requests: {
        Row: {
          amount: number
          created_at: string | null
          id: string
          payment_type: string
          status: string
          transaction_hash: string | null
          verified_at: string | null
          verified_by: string | null
          wallet_address: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          id?: string
          payment_type: string
          status?: string
          transaction_hash?: string | null
          verified_at?: string | null
          verified_by?: string | null
          wallet_address: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          id?: string
          payment_type?: string
          status?: string
          transaction_hash?: string | null
          verified_at?: string | null
          verified_by?: string | null
          wallet_address?: string
        }
        Relationships: []
      }
      premium_plans: {
        Row: {
          created_at: string | null
          discount_percentage: number | null
          duration_months: number
          features: Json | null
          id: string
          is_active: boolean | null
          name: string
          price_eth: number
          price_usdc: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          discount_percentage?: number | null
          duration_months: number
          features?: Json | null
          id?: string
          is_active?: boolean | null
          name: string
          price_eth: number
          price_usdc: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          discount_percentage?: number | null
          duration_months?: number
          features?: Json | null
          id?: string
          is_active?: boolean | null
          name?: string
          price_eth?: number
          price_usdc?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      premium_subscriptions: {
        Row: {
          created_at: string
          currency: string | null
          expires_at: string | null
          id: string
          is_active: boolean
          monthly_price: number | null
          plan_id: string | null
          price_id: string | null
          started_at: string | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          subscription_status: string | null
          subscription_type: string
          updated_at: string
          user_id: string
          wallet_address: string
        }
        Insert: {
          created_at?: string
          currency?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          monthly_price?: number | null
          plan_id?: string | null
          price_id?: string | null
          started_at?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_status?: string | null
          subscription_type?: string
          updated_at?: string
          user_id: string
          wallet_address: string
        }
        Update: {
          created_at?: string
          currency?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          monthly_price?: number | null
          plan_id?: string | null
          price_id?: string | null
          started_at?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_status?: string | null
          subscription_type?: string
          updated_at?: string
          user_id?: string
          wallet_address?: string
        }
        Relationships: [
          {
            foreignKeyName: "premium_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "premium_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          ban_reason: string | null
          banned_at: string | null
          banned_by: string | null
          created_at: string
          email: string | null
          id: string
          is_banned: boolean
          phone: string | null
          role: string | null
          updated_at: string
          user_id: string
          wallet_address: string
        }
        Insert: {
          ban_reason?: string | null
          banned_at?: string | null
          banned_by?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_banned?: boolean
          phone?: string | null
          role?: string | null
          updated_at?: string
          user_id: string
          wallet_address: string
        }
        Update: {
          ban_reason?: string | null
          banned_at?: string | null
          banned_by?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_banned?: boolean
          phone?: string | null
          role?: string | null
          updated_at?: string
          user_id?: string
          wallet_address?: string
        }
        Relationships: []
      }
      recipient_agent_activity_log: {
        Row: {
          action: string
          agent_id: string
          created_at: string
          id: string
          ip_address: string | null
          request_body: Json | null
          response_body: Json | null
          response_status: number | null
        }
        Insert: {
          action: string
          agent_id: string
          created_at?: string
          id?: string
          ip_address?: string | null
          request_body?: Json | null
          response_body?: Json | null
          response_status?: number | null
        }
        Update: {
          action?: string
          agent_id?: string
          created_at?: string
          id?: string
          ip_address?: string | null
          request_body?: Json | null
          response_body?: Json | null
          response_status?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "recipient_agent_activity_log_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "recipient_agent_registry"
            referencedColumns: ["id"]
          },
        ]
      }
      recipient_agent_registry: {
        Row: {
          api_key_hash: string
          api_key_prefix: string
          created_at: string
          id: string
          is_active: boolean
          last_request_at: string | null
          name: string
          rate_limit_per_minute: number
          total_requests: number
          updated_at: string
          wallet_address: string
        }
        Insert: {
          api_key_hash: string
          api_key_prefix: string
          created_at?: string
          id?: string
          is_active?: boolean
          last_request_at?: string | null
          name: string
          rate_limit_per_minute?: number
          total_requests?: number
          updated_at?: string
          wallet_address: string
        }
        Update: {
          api_key_hash?: string
          api_key_prefix?: string
          created_at?: string
          id?: string
          is_active?: boolean
          last_request_at?: string | null
          name?: string
          rate_limit_per_minute?: number
          total_requests?: number
          updated_at?: string
          wallet_address?: string
        }
        Relationships: []
      }
      referral_programs: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          max_referrals_per_user: number | null
          merchant_address: string
          min_purchase_required: number | null
          referee_bonus: number | null
          referrer_bonus: number | null
          token_address: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          max_referrals_per_user?: number | null
          merchant_address: string
          min_purchase_required?: number | null
          referee_bonus?: number | null
          referrer_bonus?: number | null
          token_address: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          max_referrals_per_user?: number | null
          merchant_address?: string
          min_purchase_required?: number | null
          referee_bonus?: number | null
          referrer_bonus?: number | null
          token_address?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      referrals: {
        Row: {
          bonus_claimed: boolean | null
          claimed_at: string | null
          created_at: string | null
          id: string
          merchant_address: string
          referee_address: string
          referee_bonus_amount: number | null
          referral_code: string
          referrer_address: string
          referrer_bonus_amount: number | null
          token_address: string
        }
        Insert: {
          bonus_claimed?: boolean | null
          claimed_at?: string | null
          created_at?: string | null
          id?: string
          merchant_address: string
          referee_address: string
          referee_bonus_amount?: number | null
          referral_code: string
          referrer_address: string
          referrer_bonus_amount?: number | null
          token_address: string
        }
        Update: {
          bonus_claimed?: boolean | null
          claimed_at?: string | null
          created_at?: string | null
          id?: string
          merchant_address?: string
          referee_address?: string
          referee_bonus_amount?: number | null
          referral_code?: string
          referrer_address?: string
          referrer_bonus_amount?: number | null
          token_address?: string
        }
        Relationships: []
      }
      review_responses: {
        Row: {
          created_at: string | null
          id: string
          merchant_address: string
          response_text: string
          review_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          merchant_address: string
          response_text: string
          review_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          merchant_address?: string
          response_text?: string
          review_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "review_responses_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: true
            referencedRelation: "reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          comment: string | null
          created_at: string | null
          customer_address: string
          id: string
          is_verified: boolean | null
          merchant_address: string
          rating: number
          token_address: string
          updated_at: string | null
          voucher_id: string | null
        }
        Insert: {
          comment?: string | null
          created_at?: string | null
          customer_address: string
          id?: string
          is_verified?: boolean | null
          merchant_address: string
          rating: number
          token_address: string
          updated_at?: string | null
          voucher_id?: string | null
        }
        Update: {
          comment?: string | null
          created_at?: string | null
          customer_address?: string
          id?: string
          is_verified?: boolean | null
          merchant_address?: string
          rating?: number
          token_address?: string
          updated_at?: string | null
          voucher_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reviews_voucher_id_fkey"
            columns: ["voucher_id"]
            isOneToOne: true
            referencedRelation: "vouchers"
            referencedColumns: ["id"]
          },
        ]
      }
      rewards: {
        Row: {
          cost: number
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          merchant_address: string
          name: string
          token_address: string
          updated_at: string
        }
        Insert: {
          cost: number
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          merchant_address: string
          name: string
          token_address: string
          updated_at?: string
        }
        Update: {
          cost?: number
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          merchant_address?: string
          name?: string
          token_address?: string
          updated_at?: string
        }
        Relationships: []
      }
      siwe_nonces: {
        Row: {
          created_at: string
          nonce: string
          used: boolean
        }
        Insert: {
          created_at?: string
          nonce: string
          used?: boolean
        }
        Update: {
          created_at?: string
          nonce?: string
          used?: boolean
        }
        Relationships: []
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      token_mint_history: {
        Row: {
          amount: number
          branch_id: string | null
          created_at: string
          employee_address: string | null
          id: string
          merchant_address: string
          recipient_address: string
          token_address: string
          token_name: string
          token_symbol: string
          transaction_hash: string | null
        }
        Insert: {
          amount: number
          branch_id?: string | null
          created_at?: string
          employee_address?: string | null
          id?: string
          merchant_address: string
          recipient_address: string
          token_address: string
          token_name: string
          token_symbol: string
          transaction_hash?: string | null
        }
        Update: {
          amount?: number
          branch_id?: string | null
          created_at?: string
          employee_address?: string | null
          id?: string
          merchant_address?: string
          recipient_address?: string
          token_address?: string
          token_name?: string
          token_symbol?: string
          transaction_hash?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "token_mint_history_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "merchant_branches"
            referencedColumns: ["id"]
          },
        ]
      }
      traffic_sources: {
        Row: {
          campaign_id: string | null
          created_at: string | null
          customer_address: string
          id: string
          merchant_address: string
          referral_code: string | null
          source: string
          token_address: string
          utm_campaign: string | null
          utm_medium: string | null
          utm_source: string | null
        }
        Insert: {
          campaign_id?: string | null
          created_at?: string | null
          customer_address: string
          id?: string
          merchant_address: string
          referral_code?: string | null
          source: string
          token_address: string
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Update: {
          campaign_id?: string | null
          created_at?: string | null
          customer_address?: string
          id?: string
          merchant_address?: string
          referral_code?: string | null
          source?: string
          token_address?: string
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "traffic_sources_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "marketing_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      user_moderation_log: {
        Row: {
          action: string
          created_at: string
          id: string
          metadata: Json | null
          performed_by_user_id: string | null
          performed_by_wallet: string
          reason: string | null
          target_role: string
          target_wallet_address: string
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          metadata?: Json | null
          performed_by_user_id?: string | null
          performed_by_wallet: string
          reason?: string | null
          target_role: string
          target_wallet_address: string
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          performed_by_user_id?: string | null
          performed_by_wallet?: string
          reason?: string | null
          target_role?: string
          target_wallet_address?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vouchers: {
        Row: {
          activated_at: string
          code: string
          cost: number
          customer_address: string
          id: string
          merchant_address: string
          reward_description: string | null
          reward_id: string
          reward_name: string
          status: string
          token_address: string
          token_symbol: string
          transaction_hash: string | null
          used_at: string | null
        }
        Insert: {
          activated_at?: string
          code: string
          cost: number
          customer_address: string
          id?: string
          merchant_address: string
          reward_description?: string | null
          reward_id: string
          reward_name: string
          status?: string
          token_address: string
          token_symbol: string
          transaction_hash?: string | null
          used_at?: string | null
        }
        Update: {
          activated_at?: string
          code?: string
          cost?: number
          customer_address?: string
          id?: string
          merchant_address?: string
          reward_description?: string | null
          reward_id?: string
          reward_name?: string
          status?: string
          token_address?: string
          token_symbol?: string
          transaction_hash?: string | null
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vouchers_reward_id_fkey"
            columns: ["reward_id"]
            isOneToOne: false
            referencedRelation: "rewards"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      merchant_analytics: {
        Row: {
          active_customers_30d: number | null
          active_customers_7d: number | null
          avg_voucher_cost: number | null
          merchant_address: string | null
          program_created_at: string | null
          program_name: string | null
          token_address: string | null
          token_symbol: string | null
          total_customers: number | null
          total_tokens_spent: number | null
          total_vouchers_issued: number | null
          vouchers_last_30d: number | null
          vouchers_redeemed: number | null
        }
        Relationships: []
      }
      merchant_customer_view: {
        Row: {
          created_at: string | null
          email: string | null
          first_name: string | null
          id: string | null
          last_name: string | null
          last_purchase_date: string | null
          merchant_address: string | null
          phone: string | null
          rfm_score: string | null
          total_purchases: number | null
          total_spent: number | null
          updated_at: string | null
          wallet_address: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      accept_merchant_invite: { Args: { p_invite_code: string }; Returns: Json }
      activate_premium_subscription: {
        Args: { p_request_id: string; p_wallet_address: string }
        Returns: boolean
      }
      admin_ban_user: {
        Args: {
          p_reason?: string
          p_target_role: string
          p_wallet_address: string
        }
        Returns: Json
      }
      admin_delete_user: {
        Args: {
          p_reason?: string
          p_target_role: string
          p_wallet_address: string
        }
        Returns: Json
      }
      admin_list_customers: {
        Args: never
        Returns: {
          ban_reason: string
          banned_at: string
          created_at: string
          email: string
          first_name: string
          is_banned: boolean
          last_name: string
          wallet_address: string
        }[]
      }
      admin_list_merchants: {
        Args: never
        Returns: {
          ban_reason: string
          banned_at: string
          business_name: string
          category: string
          created_at: string
          email: string
          is_banned: boolean
          wallet_address: string
        }[]
      }
      admin_unban_user: {
        Args: {
          p_reason?: string
          p_target_role: string
          p_wallet_address: string
        }
        Returns: Json
      }
      admin_user_moderation_history: {
        Args: { p_wallet: string }
        Returns: {
          action: string
          created_at: string
          id: string
          performed_by_wallet: string
          reason: string
          target_role: string
        }[]
      }
      agent_outstanding_fee_debt: {
        Args: { p_agent_id: string; p_grace_minutes?: number }
        Returns: {
          pending_count: number
          pending_fee_total: number
        }[]
      }
      agent_plan_change_allowed: {
        Args: { p_agent_id: string; p_owner_address: string; p_plan_id: string }
        Returns: boolean
      }
      cancel_stale_marketplace_offers: {
        Args: { p_max_age_days?: number }
        Returns: number
      }
      check_expiring_subscriptions: { Args: never; Returns: undefined }
      check_program_expiration: { Args: never; Returns: undefined }
      claim_gift_certificate: { Args: { p_code: string }; Returns: Json }
      consume_agent_rate_limit: {
        Args: {
          p_agent_id: string
          p_agent_kind: string
          p_limit: number
          p_window_seconds?: number
        }
        Returns: boolean
      }
      consume_siwe_nonce: { Args: { p_nonce: string }; Returns: string }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      email_queue_dispatch: { Args: never; Returns: undefined }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      expire_plan_subscriptions: { Args: never; Returns: undefined }
      generate_certificate_code: { Args: never; Returns: string }
      generate_referral_code: {
        Args: { p_referrer_address: string; p_token_address: string }
        Returns: string
      }
      get_customers_by_segment: {
        Args: {
          p_max_balance?: number
          p_merchant_address: string
          p_min_balance?: number
          p_segment: string
          p_token_address: string
        }
        Returns: {
          balance: number
          customer_address: string
          email: string
          first_name: string
          last_name: string
          rfm_score: string
        }[]
      }
      get_merchant_role: {
        Args: { p_merchant_address: string; p_wallet_address: string }
        Returns: Database["public"]["Enums"]["merchant_employee_role"]
      }
      get_my_identity_summary: { Args: never; Returns: Json }
      get_public_payment_info: {
        Args: never
        Returns: {
          admin_wallet_address: string
          subscription_wallet_address: string
          usdc_price: number
        }[]
      }
      has_premium_access: {
        Args: { p_wallet_address: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      is_current_user_banned: { Args: never; Returns: boolean }
      is_current_user_linked_wallet: {
        Args: { p_wallet: string }
        Returns: boolean
      }
      is_merchant_member: {
        Args: { p_merchant_address: string; p_wallet_address: string }
        Returns: boolean
      }
      is_unrestricted_merchant: { Args: { p_wallet: string }; Returns: boolean }
      is_wallet_banned: { Args: { p_wallet: string }; Returns: boolean }
      link_identity: {
        Args: { p_link_type: string; p_value: string; p_verified_via: string }
        Returns: Json
      }
      log_premium_activity: {
        Args: {
          p_activity_data?: Json
          p_activity_type: string
          p_wallet_address: string
        }
        Returns: undefined
      }
      lookup_certificate: {
        Args: { p_code: string }
        Returns: {
          code: string
          created_at: string
          description: string
          expires_at: string
          id: string
          image_url: string
          max_redemption_percent: number
          merchant_address: string
          points_per_dollar: number
          status: string
          title: string
          token_address: string
          token_amount: number
          token_symbol: string
          usd_amount: number
        }[]
      }
      mark_certificate_minted: {
        Args: { p_certificate_id: string; p_tx_hash: string }
        Returns: Json
      }
      mask_email: { Args: { email: string }; Returns: string }
      mask_phone: { Args: { phone: string }; Returns: string }
      merchant_plan_change_allowed: {
        Args: { p_merchant_address: string; p_plan_id: string }
        Returns: boolean
      }
      migrate_wallet_profile: {
        Args: { p_new_user_id: string; p_wallet_address: string }
        Returns: {
          profile_id: string
          profile_role: string
          profile_user_id: string
          profile_wallet_address: string
        }[]
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      process_referral: {
        Args: {
          p_referee_address: string
          p_referral_code: string
          p_token_address: string
        }
        Returns: boolean
      }
      profile_role_change_allowed: {
        Args: { p_role: string; p_user_id: string }
        Returns: boolean
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      set_primary_identity: {
        Args: { p_link_type: string; p_value: string }
        Returns: Json
      }
      set_primary_wallet: { Args: { p_wallet_address: string }; Returns: Json }
      start_agent_trial: { Args: { p_owner_address: string }; Returns: string }
      start_merchant_trial: {
        Args: { p_owner_address: string }
        Returns: string
      }
      unlink_identity: { Args: { p_id: string }; Returns: Json }
      update_customer_rfm_score: { Args: never; Returns: undefined }
      update_customer_tier: {
        Args: {
          p_current_balance: number
          p_customer_address: string
          p_token_address: string
        }
        Returns: string
      }
      update_program_status: {
        Args: {
          p_merchant_address: string
          p_new_status: string
          p_token_address: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
      merchant_employee_role: "cashier" | "branch_manager" | "admin"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user"],
      merchant_employee_role: ["cashier", "branch_manager", "admin"],
    },
  },
} as const
