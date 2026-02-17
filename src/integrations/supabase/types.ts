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
      client_profiles: {
        Row: {
          attitude: string | null
          client_health_score: number | null
          company: string | null
          created_at: string
          created_by: string | null
          discovery_notes: string | null
          discovery_source: string | null
          future_plans: string | null
          how_they_found_us: string | null
          id: string
          influences: string | null
          is_economic_buyer: boolean | null
          key_attributes: string | null
          lead_id: string | null
          meeting_preferences: string | null
          motivators: string | null
          name: string
          pain_points: string | null
          practice_area: string | null
          repeat_customer_probability: string | null
          role: string | null
          stage: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          attitude?: string | null
          client_health_score?: number | null
          company?: string | null
          created_at?: string
          created_by?: string | null
          discovery_notes?: string | null
          discovery_source?: string | null
          future_plans?: string | null
          how_they_found_us?: string | null
          id?: string
          influences?: string | null
          is_economic_buyer?: boolean | null
          key_attributes?: string | null
          lead_id?: string | null
          meeting_preferences?: string | null
          motivators?: string | null
          name: string
          pain_points?: string | null
          practice_area?: string | null
          repeat_customer_probability?: string | null
          role?: string | null
          stage?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          attitude?: string | null
          client_health_score?: number | null
          company?: string | null
          created_at?: string
          created_by?: string | null
          discovery_notes?: string | null
          discovery_source?: string | null
          future_plans?: string | null
          how_they_found_us?: string | null
          id?: string
          influences?: string | null
          is_economic_buyer?: boolean | null
          key_attributes?: string | null
          lead_id?: string | null
          meeting_preferences?: string | null
          motivators?: string | null
          name?: string
          pain_points?: string | null
          practice_area?: string | null
          repeat_customer_probability?: string | null
          role?: string | null
          stage?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_profiles_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      engagement_agreements: {
        Row: {
          agreement_url: string | null
          client_profile_id: string | null
          created_at: string
          id: string
          lead_id: string | null
          notes: string | null
          sent_at: string | null
          sent_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          agreement_url?: string | null
          client_profile_id?: string | null
          created_at?: string
          id?: string
          lead_id?: string | null
          notes?: string | null
          sent_at?: string | null
          sent_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          agreement_url?: string | null
          client_profile_id?: string | null
          created_at?: string
          id?: string
          lead_id?: string | null
          notes?: string | null
          sent_at?: string | null
          sent_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "engagement_agreements_client_profile_id_fkey"
            columns: ["client_profile_id"]
            isOneToOne: false
            referencedRelation: "client_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engagement_agreements_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          booked: boolean | null
          contact: string | null
          created_at: string
          created_by: string | null
          date_reached: string | null
          email_sent_with_info: boolean | null
          follow_up_date: string | null
          follow_up_email_after: string | null
          follow_up_email_sent: boolean | null
          id: string
          name: string
          needs: string | null
          next_steps: string | null
          notes: string | null
          source: string | null
          stage: string
          updated_at: string
          website: string | null
        }
        Insert: {
          booked?: boolean | null
          contact?: string | null
          created_at?: string
          created_by?: string | null
          date_reached?: string | null
          email_sent_with_info?: boolean | null
          follow_up_date?: string | null
          follow_up_email_after?: string | null
          follow_up_email_sent?: boolean | null
          id?: string
          name: string
          needs?: string | null
          next_steps?: string | null
          notes?: string | null
          source?: string | null
          stage?: string
          updated_at?: string
          website?: string | null
        }
        Update: {
          booked?: boolean | null
          contact?: string | null
          created_at?: string
          created_by?: string | null
          date_reached?: string | null
          email_sent_with_info?: boolean | null
          follow_up_date?: string | null
          follow_up_email_after?: string | null
          follow_up_email_sent?: boolean | null
          id?: string
          name?: string
          needs?: string | null
          next_steps?: string | null
          notes?: string | null
          source?: string | null
          stage?: string
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          lead_id: string | null
          message: string | null
          read: boolean
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          lead_id?: string | null
          message?: string | null
          read?: boolean
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          lead_id?: string | null
          message?: string | null
          read?: boolean
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      roles_open: {
        Row: {
          client_profile_id: string
          created_at: string
          id: string
          is_signed: boolean | null
          pricing: string | null
          role_name: string
        }
        Insert: {
          client_profile_id: string
          created_at?: string
          id?: string
          is_signed?: boolean | null
          pricing?: string | null
          role_name: string
        }
        Update: {
          client_profile_id?: string
          created_at?: string
          id?: string
          is_signed?: boolean | null
          pricing?: string | null
          role_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "roles_open_client_profile_id_fkey"
            columns: ["client_profile_id"]
            isOneToOne: false
            referencedRelation: "client_profiles"
            referencedColumns: ["id"]
          },
        ]
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
    }
    Enums: {
      app_role: "team_admin" | "client"
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
      app_role: ["team_admin", "client"],
    },
  },
} as const
