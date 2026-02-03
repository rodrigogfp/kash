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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      alerts: {
        Row: {
          action_url: string | null
          alert_type: string
          created_at: string
          dismissed: boolean
          expires_at: string | null
          id: string
          message: string | null
          payload: Json | null
          seen: boolean
          severity: string
          title: string
          user_id: string
        }
        Insert: {
          action_url?: string | null
          alert_type: string
          created_at?: string
          dismissed?: boolean
          expires_at?: string | null
          id?: string
          message?: string | null
          payload?: Json | null
          seen?: boolean
          severity?: string
          title: string
          user_id: string
        }
        Update: {
          action_url?: string | null
          alert_type?: string
          created_at?: string
          dismissed?: boolean
          expires_at?: string | null
          id?: string
          message?: string | null
          payload?: Json | null
          seen?: boolean
          severity?: string
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "alerts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      analytics_snapshots: {
        Row: {
          created_at: string
          currency: string
          expenses: number
          id: string
          income: number
          metadata: Json | null
          net: number
          period_end: string
          period_start: string
          period_type: string
          totals: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          currency?: string
          expenses?: number
          id?: string
          income?: number
          metadata?: Json | null
          net?: number
          period_end: string
          period_start: string
          period_type?: string
          totals?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          currency?: string
          expenses?: number
          id?: string
          income?: number
          metadata?: Json | null
          net?: number
          period_end?: string
          period_start?: string
          period_type?: string
          totals?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "analytics_snapshots_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          payload: Json | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          payload?: Json | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          payload?: Json | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      auth_providers: {
        Row: {
          created_at: string
          id: string
          provider: string
          provider_user_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          provider: string
          provider_user_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          provider?: string
          provider_user_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "auth_providers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_access_audit: {
        Row: {
          action: string
          bank_name: string | null
          connection_id: string | null
          created_at: string
          id: string
          ip_address: unknown
          metadata: Json | null
          performed_by: string | null
          provider_key: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          action: string
          bank_name?: string | null
          connection_id?: string | null
          created_at?: string
          id?: string
          ip_address?: unknown
          metadata?: Json | null
          performed_by?: string | null
          provider_key?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          action?: string
          bank_name?: string | null
          connection_id?: string | null
          created_at?: string
          id?: string
          ip_address?: unknown
          metadata?: Json | null
          performed_by?: string | null
          provider_key?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_access_audit_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "bank_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_access_audit_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "bank_connections_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_access_audit_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_accounts: {
        Row: {
          account_type: string
          available_balance: number | null
          connection_id: string
          created_at: string
          currency: string
          current_balance: number | null
          external_account_id: string
          id: string
          last_balance_update: string | null
          metadata: Json | null
          name: string
          updated_at: string
        }
        Insert: {
          account_type: string
          available_balance?: number | null
          connection_id: string
          created_at?: string
          currency?: string
          current_balance?: number | null
          external_account_id: string
          id?: string
          last_balance_update?: string | null
          metadata?: Json | null
          name: string
          updated_at?: string
        }
        Update: {
          account_type?: string
          available_balance?: number | null
          connection_id?: string
          created_at?: string
          currency?: string
          current_balance?: number | null
          external_account_id?: string
          id?: string
          last_balance_update?: string | null
          metadata?: Json | null
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_accounts_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "bank_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_accounts_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "bank_connections_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_connections: {
        Row: {
          access_token_encrypted: string | null
          created_at: string
          error_message: string | null
          external_connection_id: string
          id: string
          last_sync: string | null
          provider_key: string
          refresh_token_encrypted: string | null
          scopes: string[] | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token_encrypted?: string | null
          created_at?: string
          error_message?: string | null
          external_connection_id: string
          id?: string
          last_sync?: string | null
          provider_key: string
          refresh_token_encrypted?: string | null
          scopes?: string[] | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token_encrypted?: string | null
          created_at?: string
          error_message?: string | null
          external_connection_id?: string
          id?: string
          last_sync?: string | null
          provider_key?: string
          refresh_token_encrypted?: string | null
          scopes?: string[] | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_connections_provider_key_fkey"
            columns: ["provider_key"]
            isOneToOne: false
            referencedRelation: "supported_banks"
            referencedColumns: ["provider_key"]
          },
          {
            foreignKeyName: "bank_connections_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          auto_rules: Json | null
          color: string | null
          created_at: string
          icon: string | null
          id: string
          is_system: boolean | null
          name: string
          parent_id: string | null
          updated_at: string
        }
        Insert: {
          auto_rules?: Json | null
          color?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          is_system?: boolean | null
          name: string
          parent_id?: string | null
          updated_at?: string
        }
        Update: {
          auto_rules?: Json | null
          color?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          is_system?: boolean | null
          name?: string
          parent_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          content: string
          content_vector: number[] | null
          created_at: string
          deleted_at: string | null
          id: string
          metadata: Json | null
          role: string
          session_id: string
          tokens: number | null
        }
        Insert: {
          content: string
          content_vector?: number[] | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          metadata?: Json | null
          role: string
          session_id: string
          tokens?: number | null
        }
        Update: {
          content?: string
          content_vector?: number[] | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          metadata?: Json | null
          role?: string
          session_id?: string
          tokens?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "chat_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_sessions: {
        Row: {
          context: Json | null
          created_at: string
          id: string
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          context?: Json | null
          created_at?: string
          id?: string
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          context?: Json | null
          created_at?: string
          id?: string
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      goal_contributions: {
        Row: {
          amount: number
          contributed_at: string
          created_at: string
          goal_id: string
          id: string
          note: string | null
          transaction_id: string | null
        }
        Insert: {
          amount: number
          contributed_at?: string
          created_at?: string
          goal_id: string
          id?: string
          note?: string | null
          transaction_id?: string | null
        }
        Update: {
          amount?: number
          contributed_at?: string
          created_at?: string
          goal_id?: string
          id?: string
          note?: string | null
          transaction_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "goal_contributions_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goal_contributions_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      goals: {
        Row: {
          category: string | null
          created_at: string
          currency: string
          current_amount: number
          deadline: string | null
          id: string
          metadata: Json | null
          name: string
          status: string
          target_amount: number
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          currency?: string
          current_amount?: number
          deadline?: string | null
          id?: string
          metadata?: Json | null
          name: string
          status?: string
          target_amount: number
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string | null
          created_at?: string
          currency?: string
          current_amount?: number
          deadline?: string | null
          id?: string
          metadata?: Json | null
          name?: string
          status?: string
          target_amount?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "goals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount_cents: number
          created_at: string
          currency: string
          description: string | null
          hosted_invoice_url: string | null
          id: string
          invoice_provider_id: string | null
          metadata: Json | null
          paid_at: string | null
          pdf_url: string | null
          period_end: string | null
          period_start: string | null
          status: string
          subscription_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          currency?: string
          description?: string | null
          hosted_invoice_url?: string | null
          id?: string
          invoice_provider_id?: string | null
          metadata?: Json | null
          paid_at?: string | null
          pdf_url?: string | null
          period_end?: string | null
          period_start?: string | null
          status?: string
          subscription_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          currency?: string
          description?: string | null
          hosted_invoice_url?: string | null
          id?: string
          invoice_provider_id?: string | null
          metadata?: Json | null
          paid_at?: string | null
          pdf_url?: string | null
          period_end?: string | null
          period_start?: string | null
          status?: string
          subscription_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_settings: {
        Row: {
          alert_preferences: Json
          created_at: string
          daily_summary_enabled: boolean
          daily_summary_time: string | null
          email_enabled: boolean
          id: string
          push_enabled: boolean
          quiet_hours_end: string | null
          quiet_hours_start: string | null
          sms_enabled: boolean
          updated_at: string
          user_id: string
          weekly_report_enabled: boolean
        }
        Insert: {
          alert_preferences?: Json
          created_at?: string
          daily_summary_enabled?: boolean
          daily_summary_time?: string | null
          email_enabled?: boolean
          id?: string
          push_enabled?: boolean
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          sms_enabled?: boolean
          updated_at?: string
          user_id: string
          weekly_report_enabled?: boolean
        }
        Update: {
          alert_preferences?: Json
          created_at?: string
          daily_summary_enabled?: boolean
          daily_summary_time?: string | null
          email_enabled?: boolean
          id?: string
          push_enabled?: boolean
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          sms_enabled?: boolean
          updated_at?: string
          user_id?: string
          weekly_report_enabled?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "notification_settings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_methods: {
        Row: {
          billing_details: Json | null
          brand: string | null
          created_at: string
          exp_month: number | null
          exp_year: number | null
          id: string
          is_default: boolean
          last4: string | null
          provider: string
          provider_payment_method_id: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          billing_details?: Json | null
          brand?: string | null
          created_at?: string
          exp_month?: number | null
          exp_year?: number | null
          id?: string
          is_default?: boolean
          last4?: string | null
          provider?: string
          provider_payment_method_id: string
          type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          billing_details?: Json | null
          brand?: string | null
          created_at?: string
          exp_month?: number | null
          exp_year?: number | null
          id?: string
          is_default?: boolean
          last4?: string | null
          provider?: string
          provider_payment_method_id?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_methods_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      period_comparisons: {
        Row: {
          base_period_end: string
          base_period_start: string
          compare_period_end: string
          compare_period_start: string
          created_at: string
          currency: string
          expires_at: string | null
          id: string
          metrics: Json
          period_key: string
          user_id: string
        }
        Insert: {
          base_period_end: string
          base_period_start: string
          compare_period_end: string
          compare_period_start: string
          created_at?: string
          currency?: string
          expires_at?: string | null
          id?: string
          metrics?: Json
          period_key: string
          user_id: string
        }
        Update: {
          base_period_end?: string
          base_period_start?: string
          compare_period_end?: string
          compare_period_start?: string
          created_at?: string
          currency?: string
          expires_at?: string | null
          id?: string
          metrics?: Json
          period_key?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "period_comparisons_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          billing_interval: string
          created_at: string
          currency: string
          description: string | null
          display_name: string
          features: Json
          id: string
          is_active: boolean
          limits: Json
          price_cents: number
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          billing_interval?: string
          created_at?: string
          currency?: string
          description?: string | null
          display_name: string
          features?: Json
          id?: string
          is_active?: boolean
          limits?: Json
          price_cents?: number
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          billing_interval?: string
          created_at?: string
          currency?: string
          description?: string | null
          display_name?: string
          features?: Json
          id?: string
          is_active?: boolean
          limits?: Json
          price_cents?: number
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      quick_chips: {
        Row: {
          category: string
          created_at: string
          enabled: boolean
          id: string
          ordering: number
          text: string
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          enabled?: boolean
          id?: string
          ordering?: number
          text: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          enabled?: boolean
          id?: string
          ordering?: number
          text?: string
          updated_at?: string
        }
        Relationships: []
      }
      recurring_payments: {
        Row: {
          account_id: string | null
          amount: number
          amount_variance: number | null
          cadence: string
          category: string | null
          category_id: string | null
          confidence_score: number | null
          created_at: string
          currency: string
          detection_method: string | null
          id: string
          is_active: boolean
          is_essential: boolean
          last_payment_date: string | null
          merchant_name: string
          merchant_pattern: string | null
          metadata: Json | null
          next_due_date: string | null
          reminder_days_before: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id?: string | null
          amount: number
          amount_variance?: number | null
          cadence?: string
          category?: string | null
          category_id?: string | null
          confidence_score?: number | null
          created_at?: string
          currency?: string
          detection_method?: string | null
          id?: string
          is_active?: boolean
          is_essential?: boolean
          last_payment_date?: string | null
          merchant_name: string
          merchant_pattern?: string | null
          metadata?: Json | null
          next_due_date?: string | null
          reminder_days_before?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string | null
          amount?: number
          amount_variance?: number | null
          cadence?: string
          category?: string | null
          category_id?: string | null
          confidence_score?: number | null
          created_at?: string
          currency?: string
          detection_method?: string | null
          id?: string
          is_active?: boolean
          is_essential?: boolean
          last_payment_date?: string | null
          merchant_name?: string
          merchant_pattern?: string | null
          metadata?: Json | null
          next_due_date?: string | null
          reminder_days_before?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_payments_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_payments_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_payments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          created_at: string
          currency: string
          description: string | null
          error_message: string | null
          expires_at: string | null
          file_format: string
          file_path: string
          file_size: number | null
          finished_at: string | null
          generated_at: string
          id: string
          is_preserved: boolean
          metadata: Json | null
          period_end: string
          period_start: string
          report_type: string
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          currency?: string
          description?: string | null
          error_message?: string | null
          expires_at?: string | null
          file_format?: string
          file_path: string
          file_size?: number | null
          finished_at?: string | null
          generated_at?: string
          id?: string
          is_preserved?: boolean
          metadata?: Json | null
          period_end: string
          period_start: string
          report_type: string
          status?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          currency?: string
          description?: string | null
          error_message?: string | null
          expires_at?: string | null
          file_format?: string
          file_path?: string
          file_size?: number | null
          finished_at?: string | null
          generated_at?: string
          id?: string
          is_preserved?: boolean
          metadata?: Json | null
          period_end?: string
          period_start?: string
          report_type?: string
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean
          created_at: string
          current_period_end: string
          current_period_start: string
          id: string
          metadata: Json | null
          plan: string
          plan_id: string | null
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string
          current_period_start?: string
          id?: string
          metadata?: Json | null
          plan?: string
          plan_id?: string | null
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string
          current_period_start?: string
          id?: string
          metadata?: Json | null
          plan?: string
          plan_id?: string | null
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      supported_banks: {
        Row: {
          countries: string[] | null
          created_at: string
          display_name: string
          enabled: boolean | null
          id: string
          logo_url: string | null
          metadata: Json | null
          provider_key: string
          updated_at: string
        }
        Insert: {
          countries?: string[] | null
          created_at?: string
          display_name: string
          enabled?: boolean | null
          id?: string
          logo_url?: string | null
          metadata?: Json | null
          provider_key: string
          updated_at?: string
        }
        Update: {
          countries?: string[] | null
          created_at?: string
          display_name?: string
          enabled?: boolean | null
          id?: string
          logo_url?: string | null
          metadata?: Json | null
          provider_key?: string
          updated_at?: string
        }
        Relationships: []
      }
      sync_jobs: {
        Row: {
          attempts: number | null
          connection_id: string
          created_at: string
          error_message: string | null
          finished_at: string | null
          id: string
          job_type: string
          max_attempts: number | null
          payload: Json | null
          result: Json | null
          scheduled_at: string
          started_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          attempts?: number | null
          connection_id: string
          created_at?: string
          error_message?: string | null
          finished_at?: string | null
          id?: string
          job_type: string
          max_attempts?: number | null
          payload?: Json | null
          result?: Json | null
          scheduled_at?: string
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          attempts?: number | null
          connection_id?: string
          created_at?: string
          error_message?: string | null
          finished_at?: string | null
          id?: string
          job_type?: string
          max_attempts?: number | null
          payload?: Json | null
          result?: Json | null
          scheduled_at?: string
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sync_jobs_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "bank_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sync_jobs_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "bank_connections_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      transaction_categories_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          id: string
          new_category_id: string | null
          new_category_name: string | null
          old_category_id: string | null
          old_category_name: string | null
          transaction_id: string
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          id?: string
          new_category_id?: string | null
          new_category_name?: string | null
          old_category_id?: string | null
          old_category_name?: string | null
          transaction_id: string
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          id?: string
          new_category_id?: string | null
          new_category_name?: string | null
          old_category_id?: string | null
          old_category_name?: string | null
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transaction_categories_history_new_category_id_fkey"
            columns: ["new_category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_categories_history_old_category_id_fkey"
            columns: ["old_category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_categories_history_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          account_id: string
          amount: number
          category: string | null
          category_id: string | null
          created_at: string
          currency: string
          description: string | null
          external_transaction_id: string
          id: string
          imported_at: string
          merchant_name: string | null
          posted_at: string
          raw: Json | null
          transaction_date: string | null
          updated_at: string
        }
        Insert: {
          account_id: string
          amount: number
          category?: string | null
          category_id?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          external_transaction_id: string
          id?: string
          imported_at?: string
          merchant_name?: string | null
          posted_at: string
          raw?: Json | null
          transaction_date?: string | null
          updated_at?: string
        }
        Update: {
          account_id?: string
          amount?: number
          category?: string | null
          category_id?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          external_transaction_id?: string
          id?: string
          imported_at?: string
          merchant_name?: string | null
          posted_at?: string
          raw?: Json | null
          transaction_date?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      user_profiles: {
        Row: {
          biometric_enabled: boolean | null
          created_at: string
          id: string
          last_biometric_setup: string | null
          last_password_change: string | null
          locale: string | null
          metadata: Json | null
          onboarding_completed: boolean | null
          onboarding_step: number | null
          security_metadata: Json | null
          timezone: string | null
          two_factor_enabled: boolean | null
          updated_at: string
        }
        Insert: {
          biometric_enabled?: boolean | null
          created_at?: string
          id: string
          last_biometric_setup?: string | null
          last_password_change?: string | null
          locale?: string | null
          metadata?: Json | null
          onboarding_completed?: boolean | null
          onboarding_step?: number | null
          security_metadata?: Json | null
          timezone?: string | null
          two_factor_enabled?: boolean | null
          updated_at?: string
        }
        Update: {
          biometric_enabled?: boolean | null
          created_at?: string
          id?: string
          last_biometric_setup?: string | null
          last_password_change?: string | null
          locale?: string | null
          metadata?: Json | null
          onboarding_completed?: boolean | null
          onboarding_step?: number | null
          security_metadata?: Json | null
          timezone?: string | null
          two_factor_enabled?: boolean | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_profiles_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          granted_at: string
          granted_by: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          granted_at?: string
          granted_by?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          granted_at?: string
          granted_by?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          archived: boolean | null
          archived_at: string | null
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          preferred_name: string | null
          updated_at: string
        }
        Insert: {
          archived?: boolean | null
          archived_at?: string | null
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          preferred_name?: string | null
          updated_at?: string
        }
        Update: {
          archived?: boolean | null
          archived_at?: string | null
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          preferred_name?: string | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      bank_connections_safe: {
        Row: {
          created_at: string | null
          error_message: string | null
          external_connection_id: string | null
          id: string | null
          last_sync: string | null
          provider_key: string | null
          scopes: string[] | null
          status: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          error_message?: string | null
          external_connection_id?: string | null
          id?: string | null
          last_sync?: string | null
          provider_key?: string | null
          scopes?: string[] | null
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          error_message?: string | null
          external_connection_id?: string | null
          id?: string | null
          last_sync?: string | null
          provider_key?: string | null
          scopes?: string[] | null
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bank_connections_provider_key_fkey"
            columns: ["provider_key"]
            isOneToOne: false
            referencedRelation: "supported_banks"
            referencedColumns: ["provider_key"]
          },
          {
            foreignKeyName: "bank_connections_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_balances: {
        Row: {
          account_count: number | null
          last_sync: string | null
          total_available: number | null
          total_balance: number | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bank_connections_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      archive_old_alerts: { Args: { p_days_old?: number }; Returns: number }
      batch_update_goals_progress: {
        Args: never
        Returns: {
          alerts_created: number
          goals_updated: number
        }[]
      }
      calculate_user_total_balance: {
        Args: { p_user_id: string }
        Returns: {
          account_count: number
          currencies: Json
          total_available: number
          total_balance: number
        }[]
      }
      can_generate_report: {
        Args: { p_report_type: string; p_user_id: string }
        Returns: Json
      }
      check_goal_milestones: { Args: { p_user_id?: string }; Returns: number }
      check_low_balance_alerts: {
        Args: { p_threshold?: number }
        Returns: number
      }
      check_upcoming_bills: { Args: { p_days_ahead?: number }; Returns: number }
      cleanup_expired_reports: {
        Args: never
        Returns: {
          deleted_count: number
          freed_bytes: number
        }[]
      }
      compute_monthly_snapshot: {
        Args: {
          p_currency?: string
          p_month?: number
          p_user_id: string
          p_year?: number
        }
        Returns: string
      }
      compute_period_comparison: {
        Args: {
          p_base_end: string
          p_base_start: string
          p_compare_end: string
          p_compare_start: string
          p_currency?: string
          p_user_id: string
        }
        Returns: Json
      }
      compute_period_totals: {
        Args: {
          p_currency?: string
          p_end_date: string
          p_start_date: string
          p_user_id: string
        }
        Returns: Json
      }
      create_alert: {
        Args: {
          p_action_url?: string
          p_alert_type: string
          p_expires_at?: string
          p_message?: string
          p_payload?: Json
          p_severity?: string
          p_title: string
          p_user_id: string
        }
        Returns: string
      }
      create_pending_report: {
        Args: {
          p_file_format?: string
          p_metadata?: Json
          p_period_end: string
          p_period_start: string
          p_report_type: string
          p_title: string
          p_user_id: string
        }
        Returns: Json
      }
      detect_recurring_payments: {
        Args: { p_user_id: string }
        Returns: number
      }
      finalize_sync_job: {
        Args: { p_error_message?: string; p_job_id: string; p_result?: Json }
        Returns: undefined
      }
      get_monthly_analytics: {
        Args: {
          p_force_refresh?: boolean
          p_month?: number
          p_user_id: string
          p_year?: number
        }
        Returns: {
          cached_at: string
          expenses: number
          income: number
          is_cached: boolean
          net: number
          period_end: string
          period_start: string
          snapshot_id: string
          totals: Json
        }[]
      }
      get_monthly_trend: {
        Args: { p_months?: number; p_user_id: string }
        Returns: {
          expenses: number
          income: number
          month: string
          net: number
        }[]
      }
      get_period_summary: {
        Args: {
          p_currency?: string
          p_end_date: string
          p_start_date: string
          p_user_id: string
        }
        Returns: {
          by_category: Json
          net: number
          total_expenses: number
          total_income: number
          transaction_count: number
        }[]
      }
      get_report_download_url: {
        Args: { p_expires_in?: number; p_report_id: string }
        Returns: Json
      }
      get_security_overview: { Args: { p_user_id: string }; Returns: Json }
      get_spending_by_category: {
        Args: { p_end_date?: string; p_start_date?: string; p_user_id: string }
        Returns: {
          category: string
          category_id: string
          percentage: number
          total_amount: number
          transaction_count: number
        }[]
      }
      get_unread_alerts_count: { Args: { p_user_id: string }; Returns: number }
      get_user_balance: {
        Args: { user_uuid?: string }
        Returns: {
          account_count: number
          last_sync: string
          total_available: number
          total_balance: number
          user_id: string
        }[]
      }
      get_user_plan_limits: { Args: { p_user_id: string }; Returns: Json }
      get_user_reports: {
        Args: {
          p_limit?: number
          p_offset?: number
          p_report_type?: string
          p_user_id: string
          p_year?: number
        }
        Returns: {
          description: string
          expires_at: string
          file_format: string
          file_size: number
          generated_at: string
          id: string
          is_preserved: boolean
          period_end: string
          period_start: string
          report_type: string
          title: string
        }[]
      }
      get_user_subscription: { Args: { p_user_id: string }; Returns: Json }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_service_role: { Args: never; Returns: boolean }
      log_bank_access_event: {
        Args: {
          p_action: string
          p_bank_name?: string
          p_connection_id: string
          p_metadata?: Json
          p_provider_key?: string
          p_user_id: string
        }
        Returns: string
      }
      log_password_change: {
        Args: { p_method?: string; p_user_id: string }
        Returns: string
      }
      owns_bank_connection: {
        Args: { _connection_id: string }
        Returns: boolean
      }
      owns_chat_session: { Args: { _session_id: string }; Returns: boolean }
      owns_goal: { Args: { _goal_id: string }; Returns: boolean }
      predict_goal_completion: {
        Args: { p_goal_id: string; p_user_id: string }
        Returns: Json
      }
      refresh_user_aggregates: {
        Args: { p_user_id?: string }
        Returns: undefined
      }
      refresh_user_balances: { Args: never; Returns: undefined }
      run_scheduled_alert_scan: { Args: never; Returns: Json }
      run_scheduled_maintenance: { Args: never; Returns: Json }
      scan_for_bill_reminders: {
        Args: { p_batch_size?: number; p_days_ahead?: number }
        Returns: {
          alerts_created: number
          errors: number
          users_processed: number
        }[]
      }
      score_transaction_anomaly: {
        Args: { p_transaction_id: string }
        Returns: {
          anomaly_reasons: Json
          anomaly_score: number
          is_anomaly: boolean
          transaction_id: string
        }[]
      }
      update_biometric_settings: {
        Args: { p_device_info?: Json; p_enabled: boolean; p_user_id: string }
        Returns: Json
      }
      update_goal_progress: {
        Args: { p_goal_id: string; p_user_id: string }
        Returns: {
          current_amount: number
          days_remaining: number
          goal_id: string
          name: string
          on_track: boolean
          progress_pct: number
          status: string
          target_amount: number
        }[]
      }
      update_report_status: {
        Args: {
          p_error_message?: string
          p_file_size?: number
          p_report_id: string
          p_status: string
        }
        Returns: Json
      }
      upsert_transaction_from_provider: {
        Args: { p_connection_id: string; p_payload: Json }
        Returns: string
      }
      upsert_transactions_batch: {
        Args: { p_connection_id: string; p_transactions: Json }
        Returns: {
          error_count: number
          inserted_count: number
          updated_count: number
        }[]
      }
      user_has_premium: { Args: { p_user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
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
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
