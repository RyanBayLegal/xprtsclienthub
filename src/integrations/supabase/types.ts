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
      activity_time_entries: {
        Row: {
          activity_name: string
          client_profile_id: string
          created_at: string
          end_time: string | null
          entry_date: string
          id: string
          project_id: string
          remaining_hours: number | null
          staff_assigned: string
          start_time: string | null
          status: string
          target_hours: number | null
          total_hours: number | null
        }
        Insert: {
          activity_name?: string
          client_profile_id: string
          created_at?: string
          end_time?: string | null
          entry_date?: string
          id?: string
          project_id: string
          remaining_hours?: number | null
          staff_assigned: string
          start_time?: string | null
          status?: string
          target_hours?: number | null
          total_hours?: number | null
        }
        Update: {
          activity_name?: string
          client_profile_id?: string
          created_at?: string
          end_time?: string | null
          entry_date?: string
          id?: string
          project_id?: string
          remaining_hours?: number | null
          staff_assigned?: string
          start_time?: string | null
          status?: string
          target_hours?: number | null
          total_hours?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_time_entries_client_profile_id_fkey"
            columns: ["client_profile_id"]
            isOneToOne: false
            referencedRelation: "client_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_time_entries_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "client_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          client_profile_id: string | null
          created_at: string
          description: string | null
          entity_id: string
          entity_type: string
          field_name: string | null
          id: string
          new_value: string | null
          old_value: string | null
          user_id: string
          user_name: string | null
        }
        Insert: {
          action?: string
          client_profile_id?: string | null
          created_at?: string
          description?: string | null
          entity_id: string
          entity_type: string
          field_name?: string | null
          id?: string
          new_value?: string | null
          old_value?: string | null
          user_id: string
          user_name?: string | null
        }
        Update: {
          action?: string
          client_profile_id?: string | null
          created_at?: string
          description?: string | null
          entity_id?: string
          entity_type?: string
          field_name?: string | null
          id?: string
          new_value?: string | null
          old_value?: string | null
          user_id?: string
          user_name?: string | null
        }
        Relationships: []
      }
      branding_settings: {
        Row: {
          accent_color: string | null
          app_name: string | null
          id: string
          logo_url: string | null
          primary_color: string | null
          sidebar_color: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          accent_color?: string | null
          app_name?: string | null
          id?: string
          logo_url?: string | null
          primary_color?: string | null
          sidebar_color?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          accent_color?: string | null
          app_name?: string | null
          id?: string
          logo_url?: string | null
          primary_color?: string | null
          sidebar_color?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      client_attachments: {
        Row: {
          client_profile_id: string
          created_at: string
          file_name: string
          file_size: number | null
          file_type: string | null
          file_url: string
          id: string
          uploaded_by: string | null
        }
        Insert: {
          client_profile_id: string
          created_at?: string
          file_name: string
          file_size?: number | null
          file_type?: string | null
          file_url: string
          id?: string
          uploaded_by?: string | null
        }
        Update: {
          client_profile_id?: string
          created_at?: string
          file_name?: string
          file_size?: number | null
          file_type?: string | null
          file_url?: string
          id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_attachments_client_profile_id_fkey"
            columns: ["client_profile_id"]
            isOneToOne: false
            referencedRelation: "client_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      client_invoices: {
        Row: {
          amount: number | null
          client_profile_id: string
          created_at: string
          created_by: string | null
          due_date: string | null
          for_month: string | null
          id: string
          invoice_number: string
          notes: string | null
          paid_at: string | null
          payment_mode: string | null
          sent_at: string
          status: string
        }
        Insert: {
          amount?: number | null
          client_profile_id: string
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          for_month?: string | null
          id?: string
          invoice_number: string
          notes?: string | null
          paid_at?: string | null
          payment_mode?: string | null
          sent_at?: string
          status?: string
        }
        Update: {
          amount?: number | null
          client_profile_id?: string
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          for_month?: string | null
          id?: string
          invoice_number?: string
          notes?: string | null
          paid_at?: string | null
          payment_mode?: string | null
          sent_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_invoices_client_profile_id_fkey"
            columns: ["client_profile_id"]
            isOneToOne: false
            referencedRelation: "client_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      client_notes: {
        Row: {
          client_profile_id: string
          content: string
          created_at: string
          created_by: string
          created_by_name: string | null
          id: string
        }
        Insert: {
          client_profile_id: string
          content: string
          created_at?: string
          created_by: string
          created_by_name?: string | null
          id?: string
        }
        Update: {
          client_profile_id?: string
          content?: string
          created_at?: string
          created_by?: string
          created_by_name?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_notes_client_profile_id_fkey"
            columns: ["client_profile_id"]
            isOneToOne: false
            referencedRelation: "client_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      client_profiles: {
        Row: {
          attitude: string | null
          avatar_url: string | null
          birthday: string | null
          client_health_score: number | null
          company: string | null
          company_established_date: string | null
          created_at: string
          created_by: string | null
          discovery_notes: string | null
          discovery_source: string | null
          email: string | null
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
          phone: string | null
          practice_area: string | null
          repeat_customer_probability: string | null
          role: string | null
          schedule_color: string | null
          staff_start_date: string | null
          stage: string | null
          stage_changed_at: string | null
          stage_reason: string | null
          state: string | null
          timezone: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          attitude?: string | null
          avatar_url?: string | null
          birthday?: string | null
          client_health_score?: number | null
          company?: string | null
          company_established_date?: string | null
          created_at?: string
          created_by?: string | null
          discovery_notes?: string | null
          discovery_source?: string | null
          email?: string | null
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
          phone?: string | null
          practice_area?: string | null
          repeat_customer_probability?: string | null
          role?: string | null
          schedule_color?: string | null
          staff_start_date?: string | null
          stage?: string | null
          stage_changed_at?: string | null
          stage_reason?: string | null
          state?: string | null
          timezone?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          attitude?: string | null
          avatar_url?: string | null
          birthday?: string | null
          client_health_score?: number | null
          company?: string | null
          company_established_date?: string | null
          created_at?: string
          created_by?: string | null
          discovery_notes?: string | null
          discovery_source?: string | null
          email?: string | null
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
          phone?: string | null
          practice_area?: string | null
          repeat_customer_probability?: string | null
          role?: string | null
          schedule_color?: string | null
          staff_start_date?: string | null
          stage?: string | null
          stage_changed_at?: string | null
          stage_reason?: string | null
          state?: string | null
          timezone?: string | null
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
      client_projects: {
        Row: {
          category: string | null
          client_profile_id: string
          created_at: string
          created_by: string | null
          id: string
          name: string
          target_hours: number | null
        }
        Insert: {
          category?: string | null
          client_profile_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          target_hours?: number | null
        }
        Update: {
          category?: string | null
          client_profile_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          target_hours?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "client_projects_client_profile_id_fkey"
            columns: ["client_profile_id"]
            isOneToOne: false
            referencedRelation: "client_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      engagement_agreements: {
        Row: {
          agreement_url: string | null
          client_profile_id: string | null
          client_signature: string | null
          client_signed_at: string | null
          content_data: Json | null
          created_at: string
          id: string
          lead_id: string | null
          notes: string | null
          sent_at: string | null
          sent_by: string | null
          status: string
          updated_at: string
          xprts_signature: string | null
          xprts_signed_at: string | null
        }
        Insert: {
          agreement_url?: string | null
          client_profile_id?: string | null
          client_signature?: string | null
          client_signed_at?: string | null
          content_data?: Json | null
          created_at?: string
          id?: string
          lead_id?: string | null
          notes?: string | null
          sent_at?: string | null
          sent_by?: string | null
          status?: string
          updated_at?: string
          xprts_signature?: string | null
          xprts_signed_at?: string | null
        }
        Update: {
          agreement_url?: string | null
          client_profile_id?: string | null
          client_signature?: string | null
          client_signed_at?: string | null
          content_data?: Json | null
          created_at?: string
          id?: string
          lead_id?: string | null
          notes?: string | null
          sent_at?: string | null
          sent_by?: string | null
          status?: string
          updated_at?: string
          xprts_signature?: string | null
          xprts_signed_at?: string | null
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
      key_people: {
        Row: {
          client_profile_id: string
          contact_number: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          role: string | null
        }
        Insert: {
          client_profile_id: string
          contact_number?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          role?: string | null
        }
        Update: {
          client_profile_id?: string
          contact_number?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          role?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "key_people_client_profile_id_fkey"
            columns: ["client_profile_id"]
            isOneToOne: false
            referencedRelation: "client_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_sources: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
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
          referrer_name: string | null
          source: string | null
          stage: string
          stage_changed_at: string | null
          stage_reason: string | null
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
          referrer_name?: string | null
          source?: string | null
          stage?: string
          stage_changed_at?: string | null
          stage_reason?: string | null
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
          referrer_name?: string | null
          source?: string | null
          stage?: string
          stage_changed_at?: string | null
          stage_reason?: string | null
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
      placed_vas: {
        Row: {
          client_profile_id: string
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          start_date: string | null
          talent_id: string
        }
        Insert: {
          client_profile_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          start_date?: string | null
          talent_id: string
        }
        Update: {
          client_profile_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          start_date?: string | null
          talent_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "placed_vas_client_profile_id_fkey"
            columns: ["client_profile_id"]
            isOneToOne: false
            referencedRelation: "client_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "placed_vas_talent_id_fkey"
            columns: ["talent_id"]
            isOneToOne: false
            referencedRelation: "talent_pool"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          address: string | null
          avatar_url: string | null
          contact_number: string | null
          created_at: string
          date_of_birth: string | null
          full_name: string | null
          hired_date: string | null
          id: string
          is_active: boolean
          personal_email: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string | null
          avatar_url?: string | null
          contact_number?: string | null
          created_at?: string
          date_of_birth?: string | null
          full_name?: string | null
          hired_date?: string | null
          id?: string
          is_active?: boolean
          personal_email?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string | null
          avatar_url?: string | null
          contact_number?: string | null
          created_at?: string
          date_of_birth?: string | null
          full_name?: string | null
          hired_date?: string | null
          id?: string
          is_active?: boolean
          personal_email?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      roles_open: {
        Row: {
          agreement: string | null
          arrangement_hours: string | null
          client_profile_id: string
          created_at: string
          date_requested: string | null
          id: string
          is_signed: boolean | null
          pricing: string | null
          projected_start_date: string | null
          role_name: string
          role_status: string
        }
        Insert: {
          agreement?: string | null
          arrangement_hours?: string | null
          client_profile_id: string
          created_at?: string
          date_requested?: string | null
          id?: string
          is_signed?: boolean | null
          pricing?: string | null
          projected_start_date?: string | null
          role_name: string
          role_status?: string
        }
        Update: {
          agreement?: string | null
          arrangement_hours?: string | null
          client_profile_id?: string
          created_at?: string
          date_requested?: string | null
          id?: string
          is_signed?: boolean | null
          pricing?: string | null
          projected_start_date?: string | null
          role_name?: string
          role_status?: string
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
      schedule_blocks: {
        Row: {
          block_date: string | null
          client_id: string | null
          created_at: string
          day_of_week: number | null
          end_hour: number
          id: string
          label: string | null
          schedule_id: string
          start_hour: number
          user_id: string
        }
        Insert: {
          block_date?: string | null
          client_id?: string | null
          created_at?: string
          day_of_week?: number | null
          end_hour: number
          id?: string
          label?: string | null
          schedule_id: string
          start_hour: number
          user_id: string
        }
        Update: {
          block_date?: string | null
          client_id?: string | null
          created_at?: string
          day_of_week?: number | null
          end_hour?: number
          id?: string
          label?: string | null
          schedule_id?: string
          start_hour?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedule_blocks_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_blocks_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "staff_schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_clients: {
        Row: {
          color: string
          created_at: string
          id: string
          name: string
          timezone: string
          user_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          name: string
          timezone?: string
          user_id: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          name?: string
          timezone?: string
          user_id?: string
        }
        Relationships: []
      }
      scoping_questionnaires: {
        Row: {
          client_profile_id: string
          created_at: string
          created_by: string | null
          id: string
          section_data: Json
          updated_at: string
        }
        Insert: {
          client_profile_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          section_data?: Json
          updated_at?: string
        }
        Update: {
          client_profile_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          section_data?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "scoping_questionnaires_client_profile_id_fkey"
            columns: ["client_profile_id"]
            isOneToOne: false
            referencedRelation: "client_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_schedules: {
        Row: {
          base_timezone: string
          created_at: string
          display_timezones: Json
          hour_end: number
          hour_start: number
          id: string
          name: string
          user_id: string
        }
        Insert: {
          base_timezone?: string
          created_at?: string
          display_timezones?: Json
          hour_end?: number
          hour_start?: number
          id?: string
          name?: string
          user_id: string
        }
        Update: {
          base_timezone?: string
          created_at?: string
          display_timezones?: Json
          hour_end?: number
          hour_start?: number
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      systems_audits: {
        Row: {
          client_profile_id: string
          created_at: string
          created_by: string | null
          id: string
          section_data: Json
          updated_at: string
        }
        Insert: {
          client_profile_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          section_data?: Json
          updated_at?: string
        }
        Update: {
          client_profile_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          section_data?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "systems_audits_client_profile_id_fkey"
            columns: ["client_profile_id"]
            isOneToOne: false
            referencedRelation: "client_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      talent_attachments: {
        Row: {
          created_at: string
          file_name: string
          file_size: number | null
          file_type: string | null
          file_url: string
          id: string
          talent_id: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          file_name: string
          file_size?: number | null
          file_type?: string | null
          file_url: string
          id?: string
          talent_id: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          file_name?: string
          file_size?: number | null
          file_type?: string | null
          file_url?: string
          id?: string
          talent_id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "talent_attachments_talent_id_fkey"
            columns: ["talent_id"]
            isOneToOne: false
            referencedRelation: "talent_pool"
            referencedColumns: ["id"]
          },
        ]
      }
      talent_pool: {
        Row: {
          avatar_url: string | null
          contact_number: string | null
          country: string | null
          created_at: string
          created_by: string | null
          email: string | null
          full_name: string
          id: string
          links: Json | null
          notes: string | null
          rate_per_hour: number | null
          role: string | null
        }
        Insert: {
          avatar_url?: string | null
          contact_number?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          full_name: string
          id?: string
          links?: Json | null
          notes?: string | null
          rate_per_hour?: number | null
          role?: string | null
        }
        Update: {
          avatar_url?: string | null
          contact_number?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          full_name?: string
          id?: string
          links?: Json | null
          notes?: string | null
          rate_per_hour?: number | null
          role?: string | null
        }
        Relationships: []
      }
      task_attachments: {
        Row: {
          created_at: string
          file_name: string
          file_size: number | null
          file_type: string | null
          file_url: string
          id: string
          task_id: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          file_name: string
          file_size?: number | null
          file_type?: string | null
          file_url: string
          id?: string
          task_id: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          file_name?: string
          file_size?: number | null
          file_type?: string | null
          file_url?: string
          id?: string
          task_id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "task_attachments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          task_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          task_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          task_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_comments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assigned_to: string | null
          assigned_to_name: string | null
          client_profile_id: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          id: string
          lead_id: string | null
          links: Json | null
          priority: string
          stage: string | null
          status: string
          template_name: string | null
          title: string
          updated_at: string
          vendor_id: string | null
        }
        Insert: {
          assigned_to?: string | null
          assigned_to_name?: string | null
          client_profile_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          lead_id?: string | null
          links?: Json | null
          priority?: string
          stage?: string | null
          status?: string
          template_name?: string | null
          title: string
          updated_at?: string
          vendor_id?: string | null
        }
        Update: {
          assigned_to?: string | null
          assigned_to_name?: string | null
          client_profile_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          lead_id?: string | null
          links?: Json | null
          priority?: string
          stage?: string | null
          status?: string
          template_name?: string | null
          title?: string
          updated_at?: string
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tasks_client_profile_id_fkey"
            columns: ["client_profile_id"]
            isOneToOne: false
            referencedRelation: "client_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      team_links: {
        Row: {
          category: string | null
          created_at: string
          created_by: string | null
          created_by_name: string | null
          id: string
          title: string
          url: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          created_by?: string | null
          created_by_name?: string | null
          id?: string
          title: string
          url: string
        }
        Update: {
          category?: string | null
          created_at?: string
          created_by?: string | null
          created_by_name?: string | null
          id?: string
          title?: string
          url?: string
        }
        Relationships: []
      }
      time_off_requests: {
        Row: {
          block_date: string
          created_at: string
          end_hour: number
          id: string
          reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          start_hour: number
          status: string
          user_id: string
        }
        Insert: {
          block_date: string
          created_at?: string
          end_hour: number
          id?: string
          reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          start_hour: number
          status?: string
          user_id: string
        }
        Update: {
          block_date?: string
          created_at?: string
          end_hour?: number
          id?: string
          reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          start_hour?: number
          status?: string
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
      vendor_attachments: {
        Row: {
          created_at: string
          file_name: string
          file_size: number | null
          file_type: string | null
          file_url: string
          id: string
          uploaded_by: string | null
          vendor_id: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_size?: number | null
          file_type?: string | null
          file_url: string
          id?: string
          uploaded_by?: string | null
          vendor_id: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_size?: number | null
          file_type?: string | null
          file_url?: string
          id?: string
          uploaded_by?: string | null
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_attachments_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      vendors: {
        Row: {
          company_name: string | null
          created_at: string
          created_by: string | null
          description: string | null
          discovery_call_date: string | null
          email: string | null
          fee: string | null
          id: string
          main_contact: string | null
          name: string
          next_step: string | null
          notes: string | null
          owner: string | null
          phone: string | null
          pricing: string | null
          service_offered: string | null
          stage: string
          stage_changed_at: string | null
          subscribed_by: string | null
          subscribed_date: string | null
          updated_at: string
          vendor_type: string | null
        }
        Insert: {
          company_name?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          discovery_call_date?: string | null
          email?: string | null
          fee?: string | null
          id?: string
          main_contact?: string | null
          name: string
          next_step?: string | null
          notes?: string | null
          owner?: string | null
          phone?: string | null
          pricing?: string | null
          service_offered?: string | null
          stage?: string
          stage_changed_at?: string | null
          subscribed_by?: string | null
          subscribed_date?: string | null
          updated_at?: string
          vendor_type?: string | null
        }
        Update: {
          company_name?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          discovery_call_date?: string | null
          email?: string | null
          fee?: string | null
          id?: string
          main_contact?: string | null
          name?: string
          next_step?: string | null
          notes?: string | null
          owner?: string | null
          phone?: string | null
          pricing?: string | null
          service_offered?: string | null
          stage?: string
          stage_changed_at?: string | null
          subscribed_by?: string | null
          subscribed_date?: string | null
          updated_at?: string
          vendor_type?: string | null
        }
        Relationships: []
      }
      workflow_automation_logs: {
        Row: {
          action_type: string
          automation_id: string | null
          automation_name: string
          executed_at: string
          executed_by: string | null
          id: string
          lead_id: string | null
          lead_name: string
          result: string | null
          status: string
          trigger_stage: string
        }
        Insert: {
          action_type: string
          automation_id?: string | null
          automation_name: string
          executed_at?: string
          executed_by?: string | null
          id?: string
          lead_id?: string | null
          lead_name: string
          result?: string | null
          status?: string
          trigger_stage: string
        }
        Update: {
          action_type?: string
          automation_id?: string | null
          automation_name?: string
          executed_at?: string
          executed_by?: string | null
          id?: string
          lead_id?: string | null
          lead_name?: string
          result?: string | null
          status?: string
          trigger_stage?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_automation_logs_automation_id_fkey"
            columns: ["automation_id"]
            isOneToOne: false
            referencedRelation: "workflow_automations"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_automations: {
        Row: {
          action_config: Json
          action_type: string
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          name: string
          trigger_stage: string
        }
        Insert: {
          action_config?: Json
          action_type: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name: string
          trigger_stage: string
        }
        Update: {
          action_config?: Json
          action_type?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name?: string
          trigger_stage?: string
        }
        Relationships: []
      }
      workflow_templates: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          name: string
          stage: string
          tasks: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          stage: string
          tasks?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          stage?: string
          tasks?: Json
          updated_at?: string
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
      is_active_user: { Args: never; Returns: boolean }
    }
    Enums: {
      app_role: "team_admin" | "client" | "staff_member"
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
      app_role: ["team_admin", "client", "staff_member"],
    },
  },
} as const
