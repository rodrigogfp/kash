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
        ]
      }
      user_profiles: {
        Row: {
          biometric_enabled: boolean | null
          created_at: string
          id: string
          locale: string | null
          metadata: Json | null
          onboarding_completed: boolean | null
          onboarding_step: number | null
          timezone: string | null
          updated_at: string
        }
        Insert: {
          biometric_enabled?: boolean | null
          created_at?: string
          id: string
          locale?: string | null
          metadata?: Json | null
          onboarding_completed?: boolean | null
          onboarding_step?: number | null
          timezone?: string | null
          updated_at?: string
        }
        Update: {
          biometric_enabled?: boolean | null
          created_at?: string
          id?: string
          locale?: string | null
          metadata?: Json | null
          onboarding_completed?: boolean | null
          onboarding_step?: number | null
          timezone?: string | null
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
      [_ in never]: never
    }
    Functions: {
      is_service_role: { Args: never; Returns: boolean }
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
