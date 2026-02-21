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
      activities: {
        Row: {
          accommodation: string | null
          age_max: number
          age_min: number
          category: string
          created_at: string
          description: string | null
          id: string
          import_run_id: string | null
          location_name: string | null
          location_region: string | null
          period_type: string
          pro_price_note: string | null
          program_brief: Json
          program_detailed: Json
          short_description: string | null
          source: string | null
          source_url: string | null
          status: string
          supervision: string | null
          tags: string[]
          title: string
          updated_at: string
          vacation_periods: string[]
        }
        Insert: {
          accommodation?: string | null
          age_max: number
          age_min: number
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          import_run_id?: string | null
          location_name?: string | null
          location_region?: string | null
          period_type?: string
          pro_price_note?: string | null
          program_brief?: Json
          program_detailed?: Json
          short_description?: string | null
          source?: string | null
          source_url?: string | null
          status?: string
          supervision?: string | null
          tags?: string[]
          title: string
          updated_at?: string
          vacation_periods?: string[]
        }
        Update: {
          accommodation?: string | null
          age_max?: number
          age_min?: number
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          import_run_id?: string | null
          location_name?: string | null
          location_region?: string | null
          period_type?: string
          pro_price_note?: string | null
          program_brief?: Json
          program_detailed?: Json
          short_description?: string | null
          source?: string | null
          source_url?: string | null
          status?: string
          supervision?: string | null
          tags?: string[]
          title?: string
          updated_at?: string
          vacation_periods?: string[]
        }
        Relationships: []
      }
      activity_sessions: {
        Row: {
          activity_id: string
          capacity_remaining: number | null
          capacity_total: number | null
          created_at: string
          end_date: string
          id: string
          price_base: number | null
          price_unit: string
          start_date: string
          status: string
          updated_at: string
        }
        Insert: {
          activity_id: string
          capacity_remaining?: number | null
          capacity_total?: number | null
          created_at?: string
          end_date: string
          id?: string
          price_base?: number | null
          price_unit?: string
          start_date: string
          status?: string
          updated_at?: string
        }
        Update: {
          activity_id?: string
          capacity_remaining?: number | null
          capacity_total?: number | null
          created_at?: string
          end_date?: string
          id?: string
          price_base?: number | null
          price_unit?: string
          start_date?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      gd_educ_options: {
        Row: {
          code: string
          extra_eur: number
          is_active: boolean
          label: string
        }
        Insert: {
          code: string
          extra_eur: number
          is_active?: boolean
          label: string
        }
        Update: {
          code?: string
          extra_eur?: number
          is_active?: boolean
          label?: string
        }
        Relationships: []
      }
      gd_inscriptions: {
        Row: {
          city_departure: string | null
          created_at: string | null
          id: string
          jeune_besoins: string | null
          jeune_date_naissance: string
          jeune_nom: string
          jeune_prenom: string
          options_educatives: string | null
          payment_method: string | null
          payment_reference: string | null
          payment_status: string | null
          payment_validated_at: string | null
          price_total: number | null
          referent_email: string | null
          referent_nom: string | null
          referent_tel: string | null
          remarques: string | null
          sejour_slug: string | null
          session_date: string | null
          status: string | null
          stripe_payment_intent_id: string | null
        }
        Insert: {
          city_departure?: string | null
          created_at?: string | null
          id?: string
          jeune_besoins?: string | null
          jeune_date_naissance: string
          jeune_nom: string
          jeune_prenom: string
          options_educatives?: string | null
          payment_method?: string | null
          payment_reference?: string | null
          payment_status?: string | null
          payment_validated_at?: string | null
          price_total?: number | null
          referent_email?: string | null
          referent_nom?: string | null
          referent_tel?: string | null
          remarques?: string | null
          sejour_slug?: string | null
          session_date?: string | null
          status?: string | null
          stripe_payment_intent_id?: string | null
        }
        Update: {
          city_departure?: string | null
          created_at?: string | null
          id?: string
          jeune_besoins?: string | null
          jeune_date_naissance?: string
          jeune_nom?: string
          jeune_prenom?: string
          options_educatives?: string | null
          payment_method?: string | null
          payment_reference?: string | null
          payment_status?: string | null
          payment_validated_at?: string | null
          price_total?: number | null
          referent_email?: string | null
          referent_nom?: string | null
          referent_tel?: string | null
          remarques?: string | null
          sejour_slug?: string | null
          session_date?: string | null
          status?: string | null
          stripe_payment_intent_id?: string | null
        }
        Relationships: []
      }
      gd_processed_events: {
        Row: {
          event_id: string
          event_type: string
          id: string
          processed_at: string | null
        }
        Insert: {
          event_id: string
          event_type: string
          id?: string
          processed_at?: string | null
        }
        Update: {
          event_id?: string
          event_type?: string
          id?: string
          processed_at?: string | null
        }
        Relationships: []
      }
      gd_session_prices: {
        Row: {
          base_price_eur: number
          city_departure: string
          currency: string
          end_date: string
          is_full: boolean | null
          price_ged_total: number | null
          start_date: string
          stay_slug: string
          transport_surcharge_ged: number | null
          transport_surcharge_ufoval: number
        }
        Insert: {
          base_price_eur: number
          city_departure?: string
          currency?: string
          end_date: string
          is_full?: boolean | null
          price_ged_total?: number | null
          start_date: string
          stay_slug: string
          transport_surcharge_ged?: number | null
          transport_surcharge_ufoval?: number
        }
        Update: {
          base_price_eur?: number
          city_departure?: string
          currency?: string
          end_date?: string
          is_full?: boolean | null
          price_ged_total?: number | null
          start_date?: string
          stay_slug?: string
          transport_surcharge_ged?: number | null
          transport_surcharge_ufoval?: number
        }
        Relationships: []
      }
      gd_stay_sessions: {
        Row: {
          age_max: number | null
          age_min: number | null
          city_departure: string | null
          created_at: string
          end_date: string
          import_batch_ts: string | null
          is_full: boolean | null
          price: number | null
          price_ged: number | null
          seats_left: number | null
          start_date: string
          stay_slug: string
          updated_at: string
        }
        Insert: {
          age_max?: number | null
          age_min?: number | null
          city_departure?: string | null
          created_at?: string
          end_date: string
          import_batch_ts?: string | null
          is_full?: boolean | null
          price?: number | null
          price_ged?: number | null
          seats_left?: number | null
          start_date: string
          stay_slug: string
          updated_at?: string
        }
        Update: {
          age_max?: number | null
          age_min?: number | null
          city_departure?: string | null
          created_at?: string
          end_date?: string
          import_batch_ts?: string | null
          is_full?: boolean | null
          price?: number | null
          price_ged?: number | null
          seats_left?: number | null
          start_date?: string
          stay_slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      gd_stay_themes: {
        Row: {
          stay_slug: string
          theme: string
        }
        Insert: {
          stay_slug: string
          theme: string
        }
        Update: {
          stay_slug?: string
          theme?: string
        }
        Relationships: []
      }
      gd_stays: {
        Row: {
          accroche: string | null
          age_max: number | null
          age_min: number | null
          carousel_group: string | null
          centre_name: string | null
          centre_url: string | null
          created_at: string
          description_kids: string | null
          description_pro: string | null
          duration_days: number | null
          emotion_tag: string | null
          expert_pitch: string | null
          expertise_label: string | null
          ged_theme: string | null
          images: Json | null
          import_batch_ts: string | null
          inclusions_json: Json | null
          intensity_label: string | null
          is_full: boolean | null
          location_city: string | null
          location_region: string | null
          logistics_json: Json | null
          marketing_title: string | null
          pdf_url: string | null
          price_includes_features: Json | null
          programme: string | null
          programme_json: Json | null
          published: boolean
          punchline: string | null
          season: string | null
          sessions_json: Json | null
          slug: string
          source_url: string | null
          spot_label: string | null
          standing_label: string | null
          tags: Json | null
          title: string | null
          title_kids: string | null
          title_pro: string | null
          updated_at: string
          villes_depart: Json | null
        }
        Insert: {
          accroche?: string | null
          age_max?: number | null
          age_min?: number | null
          carousel_group?: string | null
          centre_name?: string | null
          centre_url?: string | null
          created_at?: string
          description_kids?: string | null
          description_pro?: string | null
          duration_days?: number | null
          emotion_tag?: string | null
          expert_pitch?: string | null
          expertise_label?: string | null
          ged_theme?: string | null
          images?: Json | null
          import_batch_ts?: string | null
          inclusions_json?: Json | null
          intensity_label?: string | null
          is_full?: boolean | null
          location_city?: string | null
          location_region?: string | null
          logistics_json?: Json | null
          marketing_title?: string | null
          pdf_url?: string | null
          price_includes_features?: Json | null
          programme?: string | null
          programme_json?: Json | null
          published?: boolean
          punchline?: string | null
          season?: string | null
          sessions_json?: Json | null
          slug: string
          source_url?: string | null
          spot_label?: string | null
          standing_label?: string | null
          tags?: Json | null
          title?: string | null
          title_kids?: string | null
          title_pro?: string | null
          updated_at?: string
          villes_depart?: Json | null
        }
        Update: {
          accroche?: string | null
          age_max?: number | null
          age_min?: number | null
          carousel_group?: string | null
          centre_name?: string | null
          centre_url?: string | null
          created_at?: string
          description_kids?: string | null
          description_pro?: string | null
          duration_days?: number | null
          emotion_tag?: string | null
          expert_pitch?: string | null
          expertise_label?: string | null
          ged_theme?: string | null
          images?: Json | null
          import_batch_ts?: string | null
          inclusions_json?: Json | null
          intensity_label?: string | null
          is_full?: boolean | null
          location_city?: string | null
          location_region?: string | null
          logistics_json?: Json | null
          marketing_title?: string | null
          pdf_url?: string | null
          price_includes_features?: Json | null
          programme?: string | null
          programme_json?: Json | null
          published?: boolean
          punchline?: string | null
          season?: string | null
          sessions_json?: Json | null
          slug?: string
          source_url?: string | null
          spot_label?: string | null
          standing_label?: string | null
          tags?: Json | null
          title?: string | null
          title_kids?: string | null
          title_pro?: string | null
          updated_at?: string
          villes_depart?: Json | null
        }
        Relationships: []
      }
      gd_wishes: {
        Row: {
          city_departure: string | null
          created_at: string | null
          date_naissance: string
          id: string
          motivation: string | null
          prenom: string
          sejour_slug: string | null
          session_date: string | null
          status: string | null
        }
        Insert: {
          city_departure?: string | null
          created_at?: string | null
          date_naissance: string
          id?: string
          motivation?: string | null
          prenom: string
          sejour_slug?: string | null
          session_date?: string | null
          status?: string | null
        }
        Update: {
          city_departure?: string | null
          created_at?: string | null
          date_naissance?: string
          id?: string
          motivation?: string | null
          prenom?: string
          sejour_slug?: string | null
          session_date?: string | null
          status?: string | null
        }
        Relationships: []
      }
      import_logs: {
        Row: {
          created_at: string | null
          details: Json | null
          id: string
          total_items: number
          type: string
        }
        Insert: {
          created_at?: string | null
          details?: Json | null
          id?: string
          total_items?: number
          type: string
        }
        Update: {
          created_at?: string | null
          details?: Json | null
          id?: string
          total_items?: number
          type?: string
        }
        Relationships: []
      }
      notification_queue: {
        Row: {
          created_at: string | null
          error_message: string | null
          id: string
          payload: Json | null
          priority: string
          recipient: string
          sent_at: string | null
          status: string | null
          subject: string | null
          type: string
        }
        Insert: {
          created_at?: string | null
          error_message?: string | null
          id?: string
          payload?: Json | null
          priority: string
          recipient: string
          sent_at?: string | null
          status?: string | null
          subject?: string | null
          type: string
        }
        Update: {
          created_at?: string | null
          error_message?: string | null
          id?: string
          payload?: Json | null
          priority?: string
          recipient?: string
          sent_at?: string | null
          status?: string | null
          subject?: string | null
          type?: string
        }
        Relationships: []
      }
      payment_status_logs: {
        Row: {
          changed_at: string | null
          id: string
          inscription_id: string | null
          new_status: string
          note: string | null
          old_status: string | null
        }
        Insert: {
          changed_at?: string | null
          id?: string
          inscription_id?: string | null
          new_status: string
          note?: string | null
          old_status?: string | null
        }
        Update: {
          changed_at?: string | null
          id?: string
          inscription_id?: string | null
          new_status?: string
          note?: string | null
          old_status?: string | null
        }
        Relationships: []
      }
      sejours_images: {
        Row: {
          age_range: string
          alt_description: string | null
          carousel_group: string
          color: string | null
          emotion_tag: string
          height: number
          id: string
          imported_at: string | null
          keyword_used: string | null
          last_used_at: string | null
          likes: number | null
          manual_selection: boolean | null
          marketing_title: string
          photographer_name: string
          photographer_portfolio: string | null
          photographer_url: string | null
          public_url: string
          quality_score: number | null
          slug: string
          source: string
          source_id: string
          status: string | null
          storage_path: string
          thumbnail_url: string | null
          updated_at: string | null
          usage_count: number | null
          width: number
        }
        Insert: {
          age_range: string
          alt_description?: string | null
          carousel_group: string
          color?: string | null
          emotion_tag: string
          height: number
          id?: string
          imported_at?: string | null
          keyword_used?: string | null
          last_used_at?: string | null
          likes?: number | null
          manual_selection?: boolean | null
          marketing_title: string
          photographer_name: string
          photographer_portfolio?: string | null
          photographer_url?: string | null
          public_url: string
          quality_score?: number | null
          slug: string
          source: string
          source_id: string
          status?: string | null
          storage_path: string
          thumbnail_url?: string | null
          updated_at?: string | null
          usage_count?: number | null
          width: number
        }
        Update: {
          age_range?: string
          alt_description?: string | null
          carousel_group?: string
          color?: string | null
          emotion_tag?: string
          height?: number
          id?: string
          imported_at?: string | null
          keyword_used?: string | null
          last_used_at?: string | null
          likes?: number | null
          manual_selection?: boolean | null
          marketing_title?: string
          photographer_name?: string
          photographer_portfolio?: string | null
          photographer_url?: string | null
          public_url?: string
          quality_score?: number | null
          slug?: string
          source?: string
          source_id?: string
          status?: string | null
          storage_path?: string
          thumbnail_url?: string | null
          updated_at?: string | null
          usage_count?: number | null
          width?: number
        }
        Relationships: []
      }
      smart_form_submissions: {
        Row: {
          alert_priority: string | null
          child_age: number | null
          contact_email: string | null
          contact_phone: string | null
          crm_lead_id: string | null
          crm_synced_at: string | null
          handicap: boolean | null
          id: string
          inclusion_level: string | null
          interests: string[] | null
          qf: number | null
          qpv: boolean | null
          referent_organization: string | null
          submitted_at: string | null
          suggested_stays: Json | null
          urgence_48h: boolean | null
        }
        Insert: {
          alert_priority?: string | null
          child_age?: number | null
          contact_email?: string | null
          contact_phone?: string | null
          crm_lead_id?: string | null
          crm_synced_at?: string | null
          handicap?: boolean | null
          id?: string
          inclusion_level?: string | null
          interests?: string[] | null
          qf?: number | null
          qpv?: boolean | null
          referent_organization?: string | null
          submitted_at?: string | null
          suggested_stays?: Json | null
          urgence_48h?: boolean | null
        }
        Update: {
          alert_priority?: string | null
          child_age?: number | null
          contact_email?: string | null
          contact_phone?: string | null
          crm_lead_id?: string | null
          crm_synced_at?: string | null
          handicap?: boolean | null
          id?: string
          inclusion_level?: string | null
          interests?: string[] | null
          qf?: number | null
          qpv?: boolean | null
          referent_organization?: string | null
          submitted_at?: string | null
          suggested_stays?: Json | null
          urgence_48h?: boolean | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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

export type Tables<T extends keyof DefaultSchema["Tables"]> =
  DefaultSchema["Tables"][T]["Row"]

export type TablesInsert<T extends keyof DefaultSchema["Tables"]> =
  DefaultSchema["Tables"][T]["Insert"]

export type TablesUpdate<T extends keyof DefaultSchema["Tables"]> =
  DefaultSchema["Tables"][T]["Update"]
