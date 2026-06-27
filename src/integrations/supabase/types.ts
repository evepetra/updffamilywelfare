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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      aid_ledger: {
        Row: {
          aid_type: string
          amount: number
          created_at: string
          created_by: string | null
          disbursed_at: string | null
          id: string
          payout_account_name: string | null
          payout_account_number: string | null
          payout_method: string | null
          payout_provider: string | null
          reason: string | null
          recipient_name: string
          recipient_user_id: string
          region: string
          request_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          aid_type: string
          amount?: number
          created_at?: string
          created_by?: string | null
          disbursed_at?: string | null
          id?: string
          payout_account_name?: string | null
          payout_account_number?: string | null
          payout_method?: string | null
          payout_provider?: string | null
          reason?: string | null
          recipient_name: string
          recipient_user_id: string
          region: string
          request_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          aid_type?: string
          amount?: number
          created_at?: string
          created_by?: string | null
          disbursed_at?: string | null
          id?: string
          payout_account_name?: string | null
          payout_account_number?: string | null
          payout_method?: string | null
          payout_provider?: string | null
          reason?: string | null
          recipient_name?: string
          recipient_user_id?: string
          region?: string
          request_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "aid_ledger_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "support_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      aid_ledger_audit: {
        Row: {
          action: string
          actor_id: string | null
          amount: number | null
          created_at: string
          id: string
          ledger_id: string
          new_status: string | null
          old_status: string | null
          reason: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          amount?: number | null
          created_at?: string
          id?: string
          ledger_id: string
          new_status?: string | null
          old_status?: string | null
          reason?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          amount?: number | null
          created_at?: string
          id?: string
          ledger_id?: string
          new_status?: string | null
          old_status?: string | null
          reason?: string | null
        }
        Relationships: []
      }
      login_audit: {
        Row: {
          created_at: string
          email: string | null
          id: string
          ip_address: string | null
          outcome: string
          reason: string | null
          requested_role: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          ip_address?: string | null
          outcome: string
          reason?: string | null
          requested_role: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          ip_address?: string | null
          outcome?: string
          reason?: string | null
          requested_role?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          army_number: string | null
          created_at: string
          full_name: string | null
          id: string
          nin: string | null
          payout_account_name: string | null
          payout_account_number: string | null
          payout_method: string | null
          payout_provider: string | null
          rank: string | null
          region: string | null
          service: string | null
          service_number: string | null
          updated_at: string
        }
        Insert: {
          army_number?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          nin?: string | null
          payout_account_name?: string | null
          payout_account_number?: string | null
          payout_method?: string | null
          payout_provider?: string | null
          rank?: string | null
          region?: string | null
          service?: string | null
          service_number?: string | null
          updated_at?: string
        }
        Update: {
          army_number?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          nin?: string | null
          payout_account_name?: string | null
          payout_account_number?: string | null
          payout_method?: string | null
          payout_provider?: string | null
          rank?: string | null
          region?: string | null
          service?: string | null
          service_number?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      request_documents: {
        Row: {
          created_at: string
          file_name: string
          file_path: string
          id: string
          mime_type: string | null
          request_id: string
          size_bytes: number | null
          user_id: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_path: string
          id?: string
          mime_type?: string | null
          request_id: string
          size_bytes?: number | null
          user_id: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_path?: string
          id?: string
          mime_type?: string | null
          request_id?: string
          size_bytes?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "request_documents_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "support_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      request_status_audit: {
        Row: {
          actor_id: string | null
          created_at: string
          id: string
          new_status: string
          old_status: string | null
          reason: string | null
          request_id: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          id?: string
          new_status: string
          old_status?: string | null
          reason?: string | null
          request_id: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          id?: string
          new_status?: string
          old_status?: string | null
          reason?: string | null
          request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "request_status_audit_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "support_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      role_change_audit: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          target_user_id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          target_user_id: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          target_user_id?: string
        }
        Relationships: []
      }
      support_requests: {
        Row: {
          amount_approved: number | null
          created_at: string
          decision_reason: string | null
          details: string | null
          id: string
          request_type: string
          status: string
          title: string
          updated_at: string
          urgency: string
          user_id: string
        }
        Insert: {
          amount_approved?: number | null
          created_at?: string
          decision_reason?: string | null
          details?: string | null
          id?: string
          request_type: string
          status?: string
          title: string
          updated_at?: string
          urgency?: string
          user_id: string
        }
        Update: {
          amount_approved?: number | null
          created_at?: string
          decision_reason?: string | null
          details?: string | null
          id?: string
          request_type?: string
          status?: string
          title?: string
          updated_at?: string
          urgency?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_valid_nin: { Args: { _nin: string }; Returns: boolean }
    }
    Enums: {
      app_role: "family" | "officer" | "admin" | "soldier" | "system_admin"
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
      app_role: ["family", "officer", "admin", "soldier", "system_admin"],
    },
  },
} as const
