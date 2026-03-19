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
      loyalty_programs: {
        Row: {
          created_at: string
          expiration_date: string
          expiration_warning_sent: boolean
          id: string
          merchant_address: string
          name: string
          status: string
          symbol: string
          token_address: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          expiration_date: string
          expiration_warning_sent?: boolean
          id?: string
          merchant_address: string
          name: string
          status?: string
          symbol: string
          token_address: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          expiration_date?: string
          expiration_warning_sent?: boolean
          id?: string
          merchant_address?: string
          name?: string
          status?: string
          symbol?: string
          token_address?: string
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
      notification_history: {
        Row: {
          campaign_id: string | null
          clicked: boolean | null
          created_at: string | null
          customer_address: string
          customer_email: string | null
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
          customer_email?: string | null
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
          customer_email?: string | null
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
      payment_settings: {
        Row: {
          admin_wallet_address: string
          created_at: string | null
          id: string
          updated_at: string | null
          usdc_price: number
        }
        Insert: {
          admin_wallet_address: string
          created_at?: string | null
          id?: string
          updated_at?: string | null
          usdc_price?: number
        }
        Update: {
          admin_wallet_address?: string
          created_at?: string | null
          id?: string
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
          created_at: string
          id: string
          role: string | null
          updated_at: string
          user_id: string
          wallet_address: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: string | null
          updated_at?: string
          user_id: string
          wallet_address: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: string | null
          updated_at?: string
          user_id?: string
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
      token_mint_history: {
        Row: {
          amount: number
          created_at: string
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
          created_at?: string
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
          created_at?: string
          id?: string
          merchant_address?: string
          recipient_address?: string
          token_address?: string
          token_name?: string
          token_symbol?: string
          transaction_hash?: string | null
        }
        Relationships: []
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
      activate_premium_subscription: {
        Args: { p_request_id: string; p_wallet_address: string }
        Returns: boolean
      }
      check_expiring_subscriptions: { Args: never; Returns: undefined }
      check_program_expiration: { Args: never; Returns: undefined }
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
      log_premium_activity: {
        Args: {
          p_activity_data?: Json
          p_activity_type: string
          p_wallet_address: string
        }
        Returns: undefined
      }
      mask_email: { Args: { email: string }; Returns: string }
      mask_phone: { Args: { phone: string }; Returns: string }
      migrate_wallet_profile: {
        Args: { p_new_user_id: string; p_wallet_address: string }
        Returns: {
          profile_id: string
          profile_role: string
          profile_user_id: string
          profile_wallet_address: string
        }[]
      }
      process_referral: {
        Args: {
          p_referee_address: string
          p_referral_code: string
          p_token_address: string
        }
        Returns: boolean
      }
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
    },
  },
} as const
