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
        Relationships: [
          {
            foreignKeyName: "activity_sessions_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_sessions_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "v_activity_with_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      gd_dossier_enfant: {
        Row: {
          bulletin_complement: Json | null
          bulletin_completed: boolean | null
          created_at: string | null
          documents_joints: Json | null
          fiche_liaison_jeune: Json | null
          fiche_renseignements: Json | null
          fiche_sanitaire: Json | null
          ged_sent_at: string | null
          id: string
          inscription_id: string
          liaison_completed: boolean | null
          renseignements_completed: boolean | null
          renseignements_required: boolean | null
          sanitaire_completed: boolean | null
          updated_at: string | null
        }
        Insert: {
          bulletin_complement?: Json | null
          bulletin_completed?: boolean | null
          created_at?: string | null
          documents_joints?: Json | null
          fiche_liaison_jeune?: Json | null
          fiche_renseignements?: Json | null
          fiche_sanitaire?: Json | null
          ged_sent_at?: string | null
          id?: string
          inscription_id: string
          liaison_completed?: boolean | null
          renseignements_completed?: boolean | null
          renseignements_required?: boolean | null
          sanitaire_completed?: boolean | null
          updated_at?: string | null
        }
        Update: {
          bulletin_complement?: Json | null
          bulletin_completed?: boolean | null
          created_at?: string | null
          documents_joints?: Json | null
          fiche_liaison_jeune?: Json | null
          fiche_renseignements?: Json | null
          fiche_sanitaire?: Json | null
          ged_sent_at?: string | null
          id?: string
          inscription_id?: string
          liaison_completed?: boolean | null
          renseignements_completed?: boolean | null
          renseignements_required?: boolean | null
          sanitaire_completed?: boolean | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gd_dossier_enfant_inscription_id_fkey"
            columns: ["inscription_id"]
            isOneToOne: false
            referencedRelation: "gd_inscriptions"
            referencedColumns: ["id"]
          },
        ]
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
      gd_inscription_status_logs: {
        Row: {
          changed_at: string | null
          changed_by_email: string | null
          id: string
          inscription_id: string
          new_status: string
          old_status: string | null
        }
        Insert: {
          changed_at?: string | null
          changed_by_email?: string | null
          id?: string
          inscription_id: string
          new_status: string
          old_status?: string | null
        }
        Update: {
          changed_at?: string | null
          changed_by_email?: string | null
          id?: string
          inscription_id?: string
          new_status?: string
          old_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gd_inscription_status_logs_inscription_id_fkey"
            columns: ["inscription_id"]
            isOneToOne: false
            referencedRelation: "gd_inscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      gd_inscriptions: {
        Row: {
          besoins_pris_en_compte: boolean | null
          besoins_specifiques: string | null
          city_departure: string | null
          consent_at: string | null
          consignes_communication: string | null
          created_at: string | null
          documents_status: string | null
          dossier_ref: string | null
          equipe_informee: boolean | null
          id: string
          jeune_besoins: string | null
          jeune_date_naissance: string
          jeune_nom: string
          jeune_prenom: string
          note_pro: string | null
          options_educatives: string | null
          organisation: string | null
          payment_method: string | null
          payment_reference: string | null
          payment_status: string | null
          payment_validated_at: string | null
          pref_bilan_fin_sejour: boolean | null
          pref_canal_contact: string | null
          pref_nouvelles_sejour: string | null
          price_total: number | null
          price_locked: boolean | null
          price_source: string | null
          prix_sejour: number | null
          prix_transport: number | null
          prix_encadrement: number | null
          referent_email: string | null
          referent_fonction: string | null
          referent_nom: string | null
          referent_tel: string | null
          remarques: string | null
          sejour_slug: string | null
          session_date: string | null
          status: string | null
          stripe_payment_intent_id: string | null
          structure_address: string | null
          structure_city: string | null
          structure_domain: string | null
          structure_email: string | null
          structure_id: string | null
          structure_pending_name: string | null
          structure_postal_code: string | null
          structure_type: string | null
          suivi_token: string | null
          updated_at: string | null
        }
        Insert: {
          besoins_pris_en_compte?: boolean | null
          besoins_specifiques?: string | null
          city_departure?: string | null
          consent_at?: string | null
          consignes_communication?: string | null
          created_at?: string | null
          documents_status?: string | null
          dossier_ref?: string | null
          equipe_informee?: boolean | null
          id?: string
          jeune_besoins?: string | null
          jeune_date_naissance: string
          jeune_nom: string
          jeune_prenom: string
          note_pro?: string | null
          options_educatives?: string | null
          organisation?: string | null
          payment_method?: string | null
          payment_reference?: string | null
          payment_status?: string | null
          payment_validated_at?: string | null
          pref_bilan_fin_sejour?: boolean | null
          pref_canal_contact?: string | null
          pref_nouvelles_sejour?: string | null
          price_total?: number | null
          price_locked?: boolean | null
          price_source?: string | null
          prix_sejour?: number | null
          prix_transport?: number | null
          prix_encadrement?: number | null
          referent_email?: string | null
          referent_fonction?: string | null
          referent_nom?: string | null
          referent_tel?: string | null
          remarques?: string | null
          sejour_slug?: string | null
          session_date?: string | null
          status?: string | null
          stripe_payment_intent_id?: string | null
          structure_address?: string | null
          structure_city?: string | null
          structure_domain?: string | null
          structure_email?: string | null
          structure_id?: string | null
          structure_pending_name?: string | null
          structure_postal_code?: string | null
          structure_type?: string | null
          suivi_token?: string | null
          updated_at?: string | null
        }
        Update: {
          besoins_pris_en_compte?: boolean | null
          besoins_specifiques?: string | null
          city_departure?: string | null
          consent_at?: string | null
          consignes_communication?: string | null
          created_at?: string | null
          documents_status?: string | null
          dossier_ref?: string | null
          equipe_informee?: boolean | null
          id?: string
          jeune_besoins?: string | null
          jeune_date_naissance?: string
          jeune_nom?: string
          jeune_prenom?: string
          note_pro?: string | null
          options_educatives?: string | null
          organisation?: string | null
          payment_method?: string | null
          payment_reference?: string | null
          payment_status?: string | null
          payment_validated_at?: string | null
          pref_bilan_fin_sejour?: boolean | null
          pref_canal_contact?: string | null
          pref_nouvelles_sejour?: string | null
          price_total?: number | null
          price_locked?: boolean | null
          price_source?: string | null
          prix_sejour?: number | null
          prix_transport?: number | null
          prix_encadrement?: number | null
          referent_email?: string | null
          referent_fonction?: string | null
          referent_nom?: string | null
          referent_tel?: string | null
          remarques?: string | null
          sejour_slug?: string | null
          session_date?: string | null
          status?: string | null
          stripe_payment_intent_id?: string | null
          structure_address?: string | null
          structure_city?: string | null
          structure_domain?: string | null
          structure_email?: string | null
          structure_id?: string | null
          structure_pending_name?: string | null
          structure_postal_code?: string | null
          structure_type?: string | null
          suivi_token?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_inscriptions_stay"
            columns: ["sejour_slug"]
            isOneToOne: false
            referencedRelation: "gd_stays"
            referencedColumns: ["slug"]
          },
          {
            foreignKeyName: "fk_inscriptions_stay"
            columns: ["sejour_slug"]
            isOneToOne: false
            referencedRelation: "v_sejours_missing_images"
            referencedColumns: ["slug"]
          },
          {
            foreignKeyName: "gd_inscriptions_sejour_slug_fkey"
            columns: ["sejour_slug"]
            isOneToOne: false
            referencedRelation: "gd_stays"
            referencedColumns: ["slug"]
          },
          {
            foreignKeyName: "gd_inscriptions_sejour_slug_fkey"
            columns: ["sejour_slug"]
            isOneToOne: false
            referencedRelation: "v_sejours_missing_images"
            referencedColumns: ["slug"]
          },
          {
            foreignKeyName: "gd_inscriptions_structure_id_fkey"
            columns: ["structure_id"]
            isOneToOne: false
            referencedRelation: "gd_structures"
            referencedColumns: ["id"]
          },
        ]
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
      gd_propositions_tarifaires: {
        Row: {
          adhesion: string | null
          agrement_dscs: string | null
          created_at: string | null
          created_by: string | null
          encadrement: boolean
          enfant_nom: string
          enfant_prenom: string
          id: string
          inscription_id: string | null
          options: string | null
          pdf_storage_path: string | null
          prix_encadrement: number
          prix_sejour: number
          prix_total: number
          prix_transport: number
          sejour_activites: string | null
          sejour_slug: string
          sejour_titre: string
          session_end: string
          session_start: string
          status: string
          structure_adresse: string
          structure_cp: string
          structure_nom: string
          structure_ville: string
          updated_at: string | null
          validated_at: string | null
          ville_depart: string
        }
        Insert: {
          adhesion?: string | null
          agrement_dscs?: string | null
          created_at?: string | null
          created_by?: string | null
          encadrement?: boolean
          enfant_nom: string
          enfant_prenom: string
          id?: string
          inscription_id?: string | null
          options?: string | null
          pdf_storage_path?: string | null
          prix_encadrement?: number
          prix_sejour?: number
          prix_total?: number
          prix_transport?: number
          sejour_activites?: string | null
          sejour_slug: string
          sejour_titre: string
          session_end: string
          session_start: string
          status?: string
          structure_adresse: string
          structure_cp: string
          structure_nom: string
          structure_ville: string
          updated_at?: string | null
          validated_at?: string | null
          ville_depart: string
        }
        Update: {
          adhesion?: string | null
          agrement_dscs?: string | null
          created_at?: string | null
          created_by?: string | null
          encadrement?: boolean
          enfant_nom?: string
          enfant_prenom?: string
          id?: string
          inscription_id?: string | null
          options?: string | null
          pdf_storage_path?: string | null
          prix_encadrement?: number
          prix_sejour?: number
          prix_total?: number
          prix_transport?: number
          sejour_activites?: string | null
          sejour_slug?: string
          sejour_titre?: string
          session_end?: string
          session_start?: string
          status?: string
          structure_adresse?: string
          structure_cp?: string
          structure_nom?: string
          structure_ville?: string
          updated_at?: string | null
          validated_at?: string | null
          ville_depart?: string
        }
        Relationships: [
          {
            foreignKeyName: "gd_propositions_tarifaires_inscription_id_fkey"
            columns: ["inscription_id"]
            isOneToOne: false
            referencedRelation: "gd_inscriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gd_propositions_tarifaires_sejour_slug_fkey"
            columns: ["sejour_slug"]
            isOneToOne: false
            referencedRelation: "gd_stays"
            referencedColumns: ["slug"]
          },
          {
            foreignKeyName: "gd_propositions_tarifaires_sejour_slug_fkey"
            columns: ["sejour_slug"]
            isOneToOne: false
            referencedRelation: "v_sejours_missing_images"
            referencedColumns: ["slug"]
          },
        ]
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
          updated_at: string | null
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
          updated_at?: string | null
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
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_session_prices_stay"
            columns: ["stay_slug"]
            isOneToOne: false
            referencedRelation: "gd_stays"
            referencedColumns: ["slug"]
          },
          {
            foreignKeyName: "fk_session_prices_stay"
            columns: ["stay_slug"]
            isOneToOne: false
            referencedRelation: "v_sejours_missing_images"
            referencedColumns: ["slug"]
          },
          {
            foreignKeyName: "gd_session_prices_stay_fk"
            columns: ["stay_slug"]
            isOneToOne: false
            referencedRelation: "gd_stays"
            referencedColumns: ["slug"]
          },
          {
            foreignKeyName: "gd_session_prices_stay_fk"
            columns: ["stay_slug"]
            isOneToOne: false
            referencedRelation: "v_sejours_missing_images"
            referencedColumns: ["slug"]
          },
        ]
      }
      gd_session_prices_backup_align_enddate_2026_02_22: {
        Row: {
          base_price_eur: number | null
          city_departure: string | null
          currency: string | null
          end_date: string | null
          is_full: boolean | null
          price_ged_total: number | null
          start_date: string | null
          stay_slug: string | null
          transport_surcharge_ged: number | null
          transport_surcharge_ufoval: number | null
        }
        Insert: {
          base_price_eur?: number | null
          city_departure?: string | null
          currency?: string | null
          end_date?: string | null
          is_full?: boolean | null
          price_ged_total?: number | null
          start_date?: string | null
          stay_slug?: string | null
          transport_surcharge_ged?: number | null
          transport_surcharge_ufoval?: number | null
        }
        Update: {
          base_price_eur?: number | null
          city_departure?: string | null
          currency?: string | null
          end_date?: string | null
          is_full?: boolean | null
          price_ged_total?: number | null
          start_date?: string | null
          stay_slug?: string | null
          transport_surcharge_ged?: number | null
          transport_surcharge_ufoval?: number | null
        }
        Relationships: []
      }
      gd_souhaits: {
        Row: {
          created_at: string | null
          educateur_email: string
          educateur_prenom: string | null
          educateur_token: string | null
          id: string
          inscription_id: string | null
          kid_prenom: string
          kid_prenom_referent: string | null
          kid_session_token: string | null
          motivation: string | null
          reponse_date: string | null
          reponse_educateur: string | null
          sejour_slug: string
          sejour_titre: string | null
          status: string
          structure_domain: string | null
          structure_id: string | null
          suivi_token_kid: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          educateur_email: string
          educateur_prenom?: string | null
          educateur_token?: string | null
          id?: string
          inscription_id?: string | null
          kid_prenom: string
          kid_prenom_referent?: string | null
          kid_session_token?: string | null
          motivation?: string | null
          reponse_date?: string | null
          reponse_educateur?: string | null
          sejour_slug: string
          sejour_titre?: string | null
          status?: string
          structure_domain?: string | null
          structure_id?: string | null
          suivi_token_kid?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          educateur_email?: string
          educateur_prenom?: string | null
          educateur_token?: string | null
          id?: string
          inscription_id?: string | null
          kid_prenom?: string
          kid_prenom_referent?: string | null
          kid_session_token?: string | null
          motivation?: string | null
          reponse_date?: string | null
          reponse_educateur?: string | null
          sejour_slug?: string
          sejour_titre?: string | null
          status?: string
          structure_domain?: string | null
          structure_id?: string | null
          suivi_token_kid?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gd_souhaits_inscription_id_fkey"
            columns: ["inscription_id"]
            isOneToOne: false
            referencedRelation: "gd_inscriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gd_souhaits_structure_id_fkey"
            columns: ["structure_id"]
            isOneToOne: false
            referencedRelation: "gd_structures"
            referencedColumns: ["id"]
          },
        ]
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
          transport_included: boolean | null
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
          transport_included?: boolean | null
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
          transport_included?: boolean | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_stay_sessions_stay"
            columns: ["stay_slug"]
            isOneToOne: false
            referencedRelation: "gd_stays"
            referencedColumns: ["slug"]
          },
          {
            foreignKeyName: "fk_stay_sessions_stay"
            columns: ["stay_slug"]
            isOneToOne: false
            referencedRelation: "v_sejours_missing_images"
            referencedColumns: ["slug"]
          },
          {
            foreignKeyName: "gd_stay_sessions_stay_fk"
            columns: ["stay_slug"]
            isOneToOne: false
            referencedRelation: "gd_stays"
            referencedColumns: ["slug"]
          },
          {
            foreignKeyName: "gd_stay_sessions_stay_fk"
            columns: ["stay_slug"]
            isOneToOne: false
            referencedRelation: "v_sejours_missing_images"
            referencedColumns: ["slug"]
          },
        ]
      }
      gd_stay_sessions_backup_6jours_ptits_puisotins: {
        Row: {
          age_max: number | null
          age_min: number | null
          city_departure: string | null
          created_at: string | null
          end_date: string | null
          import_batch_ts: string | null
          price: number | null
          price_ged: number | null
          seats_left: number | null
          start_date: string | null
          stay_slug: string | null
          updated_at: string | null
        }
        Insert: {
          age_max?: number | null
          age_min?: number | null
          city_departure?: string | null
          created_at?: string | null
          end_date?: string | null
          import_batch_ts?: string | null
          price?: number | null
          price_ged?: number | null
          seats_left?: number | null
          start_date?: string | null
          stay_slug?: string | null
          updated_at?: string | null
        }
        Update: {
          age_max?: number | null
          age_min?: number | null
          city_departure?: string | null
          created_at?: string | null
          end_date?: string | null
          import_batch_ts?: string | null
          price?: number | null
          price_ged?: number | null
          seats_left?: number | null
          start_date?: string | null
          stay_slug?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      gd_stay_sessions_backup_8jours_20260217: {
        Row: {
          age_max: number | null
          age_min: number | null
          city_departure: string | null
          created_at: string | null
          end_date: string | null
          import_batch_ts: string | null
          price: number | null
          price_ged: number | null
          seats_left: number | null
          start_date: string | null
          stay_slug: string | null
          updated_at: string | null
        }
        Insert: {
          age_max?: number | null
          age_min?: number | null
          city_departure?: string | null
          created_at?: string | null
          end_date?: string | null
          import_batch_ts?: string | null
          price?: number | null
          price_ged?: number | null
          seats_left?: number | null
          start_date?: string | null
          stay_slug?: string | null
          updated_at?: string | null
        }
        Update: {
          age_max?: number | null
          age_min?: number | null
          city_departure?: string | null
          created_at?: string | null
          end_date?: string | null
          import_batch_ts?: string | null
          price?: number | null
          price_ged?: number | null
          seats_left?: number | null
          start_date?: string | null
          stay_slug?: string | null
          updated_at?: string | null
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
        Relationships: [
          {
            foreignKeyName: "gd_stay_themes_stay_slug_fkey"
            columns: ["stay_slug"]
            isOneToOne: false
            referencedRelation: "gd_stays"
            referencedColumns: ["slug"]
          },
          {
            foreignKeyName: "gd_stay_themes_stay_slug_fkey"
            columns: ["stay_slug"]
            isOneToOne: false
            referencedRelation: "v_sejours_missing_images"
            referencedColumns: ["slug"]
          },
        ]
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
          documents_requis: Json | null
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
          documents_requis?: Json | null
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
          documents_requis?: Json | null
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
      gd_structures: {
        Row: {
          address: string | null
          address_private: boolean
          city: string | null
          code: string | null
          created_at: string | null
          created_by_email: string | null
          domain: string | null
          email: string | null
          id: string
          name: string
          postal_code: string | null
          status: string
          type: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          address_private?: boolean
          city?: string | null
          code?: string | null
          created_at?: string | null
          created_by_email?: string | null
          domain?: string | null
          email?: string | null
          id?: string
          name: string
          postal_code?: string | null
          status?: string
          type?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          address_private?: boolean
          city?: string | null
          code?: string | null
          created_at?: string | null
          created_by_email?: string | null
          domain?: string | null
          email?: string | null
          id?: string
          name?: string
          postal_code?: string | null
          status?: string
          type?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      gd_waitlist: {
        Row: {
          created_at: string | null
          email: string
          id: string
          notified_at: string | null
          sejour_slug: string
        }
        Insert: {
          created_at?: string | null
          email: string
          id?: string
          notified_at?: string | null
          sejour_slug: string
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: string
          notified_at?: string | null
          sejour_slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "gd_waitlist_sejour_slug_fkey"
            columns: ["sejour_slug"]
            isOneToOne: false
            referencedRelation: "gd_stays"
            referencedColumns: ["slug"]
          },
          {
            foreignKeyName: "gd_waitlist_sejour_slug_fkey"
            columns: ["sejour_slug"]
            isOneToOne: false
            referencedRelation: "v_sejours_missing_images"
            referencedColumns: ["slug"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "gd_wishes_sejour_slug_fkey"
            columns: ["sejour_slug"]
            isOneToOne: false
            referencedRelation: "gd_stays"
            referencedColumns: ["slug"]
          },
          {
            foreignKeyName: "gd_wishes_sejour_slug_fkey"
            columns: ["sejour_slug"]
            isOneToOne: false
            referencedRelation: "v_sejours_missing_images"
            referencedColumns: ["slug"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "payment_status_logs_inscription_id_fkey"
            columns: ["inscription_id"]
            isOneToOne: false
            referencedRelation: "gd_inscriptions"
            referencedColumns: ["id"]
          },
        ]
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
          prompt_used: string | null
          public_url: string
          quality_score: number | null
          scene_type: string | null
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
          prompt_used?: string | null
          public_url: string
          quality_score?: number | null
          scene_type?: string | null
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
          prompt_used?: string | null
          public_url?: string
          quality_score?: number | null
          scene_type?: string | null
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
      v_activity_with_sessions: {
        Row: {
          accommodation: string | null
          age_max: number | null
          age_min: number | null
          category: string | null
          created_at: string | null
          description: string | null
          id: string | null
          location_name: string | null
          location_region: string | null
          period_type: string | null
          pro_price_note: string | null
          program_brief: Json | null
          program_detailed: Json | null
          sessions: Json | null
          short_description: string | null
          source_url: string | null
          status: string | null
          supervision: string | null
          tags: string[] | null
          title: string | null
          updated_at: string | null
          vacation_periods: string[] | null
        }
        Relationships: []
      }
      v_orphaned_records: {
        Row: {
          record_id: string | null
          ref_value: string | null
          type: string | null
        }
        Relationships: []
      }
      v_sejours_images_stats: {
        Row: {
          active_images: number | null
          avg_quality: number | null
          carousel_group: string | null
          from_pexels: number | null
          from_unsplash: number | null
          last_import_date: string | null
          marketing_title: string | null
          slug: string | null
          total_images: number | null
        }
        Relationships: []
      }
      v_sejours_missing_images: {
        Row: {
          carousel_group: string | null
          current_images: number | null
          marketing_title: string | null
          priority: string | null
          slug: string | null
        }
        Relationships: []
      }
      v_smart_form_stats: {
        Row: {
          avg_child_age: number | null
          avg_qf: number | null
          handicap_count: number | null
          inclusion_level: string | null
          last_submission: string | null
          qpv_count: number | null
          synced_to_crm: number | null
          total_submissions: number | null
          urgent_count: number | null
        }
        Relationships: []
      }
      v_smart_form_urgent_alerts: {
        Row: {
          alert_priority: string | null
          child_age: number | null
          contact_email: string | null
          contact_phone: string | null
          hours_since_submission: number | null
          id: string | null
          inclusion_level: string | null
          referent_organization: string | null
          submitted_at: string | null
        }
        Insert: {
          alert_priority?: string | null
          child_age?: number | null
          contact_email?: string | null
          contact_phone?: string | null
          hours_since_submission?: never
          id?: string | null
          inclusion_level?: string | null
          referent_organization?: string | null
          submitted_at?: string | null
        }
        Update: {
          alert_priority?: string | null
          child_age?: number | null
          contact_email?: string | null
          contact_phone?: string | null
          hours_since_submission?: never
          id?: string | null
          inclusion_level?: string | null
          referent_organization?: string | null
          submitted_at?: string | null
        }
        Relationships: []
      }
      v_top_sejours_images: {
        Row: {
          emotion_tag: string | null
          id: string | null
          marketing_title: string | null
          photographer_name: string | null
          public_url: string | null
          quality_score: number | null
          relevance_score: number | null
          slug: string | null
          source: string | null
          thumbnail_url: string | null
          usage_count: number | null
        }
        Insert: {
          emotion_tag?: string | null
          id?: string | null
          marketing_title?: string | null
          photographer_name?: string | null
          public_url?: string | null
          quality_score?: number | null
          relevance_score?: never
          slug?: string | null
          source?: string | null
          thumbnail_url?: string | null
          usage_count?: number | null
        }
        Update: {
          emotion_tag?: string | null
          id?: string | null
          marketing_title?: string | null
          photographer_name?: string | null
          public_url?: string | null
          quality_score?: number | null
          relevance_score?: never
          slug?: string | null
          source?: string | null
          thumbnail_url?: string | null
          usage_count?: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      estimate_financial_aid: {
        Args: { p_qf: number; p_qpv: boolean; p_sejour_price: number }
        Returns: {
          aide_montant: number
          eligible_aide_max: boolean
          reste_a_charge: number
          taux_prise_en_charge: number
        }[]
      }
      gd_check_session_capacity: {
        Args: { p_slug: string; p_start_date: string }
        Returns: Json
      }
      generate_structure_code: { Args: never; Returns: string }
      get_random_sejour_image: {
        Args: { sejour_slug: string }
        Returns: {
          alt_description: string
          id: string
          photographer_name: string
          photographer_url: string
          public_url: string
          thumbnail_url: string
        }[]
      }
      get_stay_carousel_images: {
        Args: { image_limit?: number; stay_slug: string }
        Returns: {
          alt_description: string
          color_palette: string
          id: string
          photographer_name: string
          photographer_url: string
          public_url: string
          quality_score: number
          thumbnail_url: string
          visual_mood: string
        }[]
      }
      get_stays_by_tags: {
        Args: {
          child_age?: number
          filter_tags: string[]
          limit_count?: number
        }
        Returns: {
          age_max: number
          age_min: number
          carousel_group: string
          emotion_tag: string
          image_url: string
          marketing_title: string
          match_score: number
          punchline: string
          slug: string
        }[]
      }
      get_top_sejour_images: {
        Args: { limit_count?: number; sejour_slug: string }
        Returns: {
          alt_description: string
          id: string
          photographer_name: string
          photographer_url: string
          public_url: string
          quality_score: number
          thumbnail_url: string
          usage_count: number
        }[]
      }
      increment_image_usage: { Args: { image_id: string }; Returns: undefined }
      list_published_activities_with_sessions: {
        Args: never
        Returns: {
          accommodation: string | null
          age_max: number | null
          age_min: number | null
          category: string | null
          created_at: string | null
          description: string | null
          id: string | null
          location_name: string | null
          location_region: string | null
          period_type: string | null
          pro_price_note: string | null
          program_brief: Json | null
          program_detailed: Json | null
          sessions: Json | null
          short_description: string | null
          source_url: string | null
          status: string | null
          supervision: string | null
          tags: string[] | null
          title: string | null
          updated_at: string | null
          vacation_periods: string[] | null
        }[]
        SetofOptions: {
          from: "*"
          to: "v_activity_with_sessions"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      log_smart_form_submission: {
        Args: {
          p_child_age: number
          p_contact_email: string
          p_contact_phone: string
          p_handicap: boolean
          p_inclusion_level: string
          p_interests: string[]
          p_qf: number
          p_qpv: boolean
          p_referent_organization: string
          p_suggested_stays: Json
          p_urgence_48h: boolean
        }
        Returns: string
      }
      merge_structures: {
        Args: { p_source_id: string; p_target_id: string }
        Returns: undefined
      }
      sync_stay_sessions: { Args: never; Returns: number }
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
