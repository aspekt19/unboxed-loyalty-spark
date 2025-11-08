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
    }
    Functions: {
      check_program_expiration: { Args: never; Returns: undefined }
      migrate_wallet_profile: {
        Args: { p_new_user_id: string; p_wallet_address: string }
        Returns: undefined
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
      [_ in never]: never
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
    Enums: {},
  },
} as const
