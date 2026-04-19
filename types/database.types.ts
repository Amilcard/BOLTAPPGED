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
      gd_admin_2fa: {
        Row: {
          created_at: string | null
          enabled: boolean | null
          totp_secret: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          enabled?: boolean | null
          totp_secret: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          enabled?: boolean | null
          totp_secret?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      gd_audit_log: {
        Row: {
          action: string
          actor_id: string | null
          actor_type: string
          created_at: string
          id: string
          inscription_id: string | null
          integrity_hash: string | null
          ip_address: string | null
          metadata: Json | null
          resource_id: string
          resource_type: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_type: string
          created_at?: string
          id?: string
          inscription_id?: string | null
          integrity_hash?: string | null
          ip_address?: string | null
          metadata?: Json | null
          resource_id: string
          resource_type: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_type?: string
          created_at?: string
          id?: string
          inscription_id?: string | null
          integrity_hash?: string | null
          ip_address?: string | null
          metadata?: Json | null
          resource_id?: string
          resource_type?: string
        }
        Relationships: []
      }
      gd_calls: {
        Row: {
          call_date: string
          call_type: string
          created_at: string
          created_by: string
          direction: string
          id: string
          inscription_id: string | null
          interlocuteur: string
          parent_accord: boolean | null
          resume: string
          structure_id: string
        }
        Insert: {
          call_date?: string
          call_type: string
          created_at?: string
          created_by: string
          direction: string
          id?: string
          inscription_id?: string | null
          interlocuteur: string
          parent_accord?: boolean | null
          resume: string
          structure_id: string
        }
        Update: {
          call_date?: string
          call_type?: string
          created_at?: string
          created_by?: string
          direction?: string
          id?: string
          inscription_id?: string | null
          interlocuteur?: string
          parent_accord?: boolean | null
          resume?: string
          structure_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gd_calls_inscription_id_fkey"
            columns: ["inscription_id"]
            isOneToOne: false
            referencedRelation: "gd_inscriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gd_calls_inscription_id_fkey"
            columns: ["inscription_id"]
            isOneToOne: false
            referencedRelation: "v_inscriptions_production"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gd_calls_structure_id_fkey"
            columns: ["structure_id"]
            isOneToOne: false
            referencedRelation: "gd_structures"
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
          {
            foreignKeyName: "gd_dossier_enfant_inscription_id_fkey"
            columns: ["inscription_id"]
            isOneToOne: false
            referencedRelation: "v_inscriptions_production"
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
      gd_educateur_emails: {
        Row: {
          actif: boolean | null
          created_at: string | null
          email_perso: string | null
          email_pro: string
          id: string
          nom: string | null
          prenom: string | null
          structure_id: string | null
        }
        Insert: {
          actif?: boolean | null
          created_at?: string | null
          email_perso?: string | null
          email_pro: string
          id?: string
          nom?: string | null
          prenom?: string | null
          structure_id?: string | null
        }
        Update: {
          actif?: boolean | null
          created_at?: string | null
          email_perso?: string | null
          email_pro?: string
          id?: string
          nom?: string | null
          prenom?: string | null
          structure_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gd_educateur_emails_structure_id_fkey"
            columns: ["structure_id"]
            isOneToOne: false
            referencedRelation: "gd_structures"
            referencedColumns: ["id"]
          },
        ]
      }
      gd_facture_lignes: {
        Row: {
          enfant_nom: string
          enfant_prenom: string
          facture_id: string
          id: string
          inscription_id: string | null
          prix_encadrement: number | null
          prix_ligne_total: number | null
          prix_sejour: number | null
          prix_transport: number | null
          sejour_titre: string
          session_end: string | null
          session_start: string | null
          ville_depart: string | null
        }
        Insert: {
          enfant_nom: string
          enfant_prenom: string
          facture_id: string
          id?: string
          inscription_id?: string | null
          prix_encadrement?: number | null
          prix_ligne_total?: number | null
          prix_sejour?: number | null
          prix_transport?: number | null
          sejour_titre: string
          session_end?: string | null
          session_start?: string | null
          ville_depart?: string | null
        }
        Update: {
          enfant_nom?: string
          enfant_prenom?: string
          facture_id?: string
          id?: string
          inscription_id?: string | null
          prix_encadrement?: number | null
          prix_ligne_total?: number | null
          prix_sejour?: number | null
          prix_transport?: number | null
          sejour_titre?: string
          session_end?: string | null
          session_start?: string | null
          ville_depart?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gd_facture_lignes_facture_id_fkey"
            columns: ["facture_id"]
            isOneToOne: false
            referencedRelation: "gd_factures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gd_facture_lignes_inscription_id_fkey"
            columns: ["inscription_id"]
            isOneToOne: false
            referencedRelation: "gd_inscriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gd_facture_lignes_inscription_id_fkey"
            columns: ["inscription_id"]
            isOneToOne: false
            referencedRelation: "v_inscriptions_production"
            referencedColumns: ["id"]
          },
        ]
      }
      gd_facture_paiements: {
        Row: {
          created_at: string | null
          date_paiement: string
          facture_id: string
          id: string
          methode: string
          montant: number
          note: string | null
          reference: string | null
        }
        Insert: {
          created_at?: string | null
          date_paiement: string
          facture_id: string
          id?: string
          methode: string
          montant: number
          note?: string | null
          reference?: string | null
        }
        Update: {
          created_at?: string | null
          date_paiement?: string
          facture_id?: string
          id?: string
          methode?: string
          montant?: number
          note?: string | null
          reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gd_facture_paiements_facture_id_fkey"
            columns: ["facture_id"]
            isOneToOne: false
            referencedRelation: "gd_factures"
            referencedColumns: ["id"]
          },
        ]
      }
      gd_factures: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          montant_total: number
          numero: string
          statut: string
          structure_adresse: string | null
          structure_cp: string | null
          structure_id: string | null
          structure_nom: string
          structure_ville: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          montant_total?: number
          numero?: string
          statut?: string
          structure_adresse?: string | null
          structure_cp?: string | null
          structure_id?: string | null
          structure_nom: string
          structure_ville?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          montant_total?: number
          numero?: string
          statut?: string
          structure_adresse?: string | null
          structure_cp?: string | null
          structure_id?: string | null
          structure_nom?: string
          structure_ville?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gd_factures_structure_id_fkey"
            columns: ["structure_id"]
            isOneToOne: false
            referencedRelation: "gd_structures"
            referencedColumns: ["id"]
          },
        ]
      }
      gd_incidents: {
        Row: {
          category: string
          created_at: string
          created_by: string
          description: string
          id: string
          inscription_id: string
          resolution_note: string | null
          resolved_at: string | null
          severity: string
          status: string
          structure_id: string
          titre: string | null
          updated_at: string
          vu_at: string | null
          vu_by_code: string | null
        }
        Insert: {
          category: string
          created_at?: string
          created_by: string
          description: string
          id?: string
          inscription_id: string
          resolution_note?: string | null
          resolved_at?: string | null
          severity: string
          status?: string
          structure_id: string
          titre?: string | null
          updated_at?: string
          vu_at?: string | null
          vu_by_code?: string | null
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string
          description?: string
          id?: string
          inscription_id?: string
          resolution_note?: string | null
          resolved_at?: string | null
          severity?: string
          status?: string
          structure_id?: string
          titre?: string | null
          updated_at?: string
          vu_at?: string | null
          vu_by_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gd_incidents_inscription_id_fkey"
            columns: ["inscription_id"]
            isOneToOne: false
            referencedRelation: "gd_inscriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gd_incidents_inscription_id_fkey"
            columns: ["inscription_id"]
            isOneToOne: false
            referencedRelation: "v_inscriptions_production"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gd_incidents_structure_id_fkey"
            columns: ["structure_id"]
            isOneToOne: false
            referencedRelation: "gd_structures"
            referencedColumns: ["id"]
          },
        ]
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
          {
            foreignKeyName: "gd_inscription_status_logs_inscription_id_fkey"
            columns: ["inscription_id"]
            isOneToOne: false
            referencedRelation: "v_inscriptions_production"
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
          deleted_at: string | null
          documents_status: string | null
          dossier_ref: string | null
          email_pro_attendu: string | null
          email_type: string | null
          equipe_informee: boolean | null
          id: string
          inscription_urgence: boolean | null
          jeune_besoins: string | null
          jeune_date_naissance: string
          jeune_nom: string
          jeune_prenom: string
          jeune_sexe: string | null
          last_relance_at: string | null
          note_pro: string | null
          options_educatives: string | null
          organisation: string | null
          parental_consent_at: string | null
          parental_consent_version: string | null
          payment_method: string | null
          payment_reference: string | null
          payment_status: string | null
          payment_validated_at: string | null
          pref_bilan_fin_sejour: boolean | null
          pref_canal_contact: string | null
          pref_nouvelles_sejour: string | null
          price_total: number | null
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
          structure_validation_statut: string | null
          structure_validee_at: string | null
          structure_validee_par: string | null
          suivi_token: string | null
          suivi_token_expires_at: string | null
          updated_at: string | null
        }
        Insert: {
          besoins_pris_en_compte?: boolean | null
          besoins_specifiques?: string | null
          city_departure?: string | null
          consent_at?: string | null
          consignes_communication?: string | null
          created_at?: string | null
          deleted_at?: string | null
          documents_status?: string | null
          dossier_ref?: string | null
          email_pro_attendu?: string | null
          email_type?: string | null
          equipe_informee?: boolean | null
          id?: string
          inscription_urgence?: boolean | null
          jeune_besoins?: string | null
          jeune_date_naissance: string
          jeune_nom: string
          jeune_prenom: string
          jeune_sexe?: string | null
          last_relance_at?: string | null
          note_pro?: string | null
          options_educatives?: string | null
          organisation?: string | null
          parental_consent_at?: string | null
          parental_consent_version?: string | null
          payment_method?: string | null
          payment_reference?: string | null
          payment_status?: string | null
          payment_validated_at?: string | null
          pref_bilan_fin_sejour?: boolean | null
          pref_canal_contact?: string | null
          pref_nouvelles_sejour?: string | null
          price_total?: number | null
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
          structure_validation_statut?: string | null
          structure_validee_at?: string | null
          structure_validee_par?: string | null
          suivi_token?: string | null
          suivi_token_expires_at?: string | null
          updated_at?: string | null
        }
        Update: {
          besoins_pris_en_compte?: boolean | null
          besoins_specifiques?: string | null
          city_departure?: string | null
          consent_at?: string | null
          consignes_communication?: string | null
          created_at?: string | null
          deleted_at?: string | null
          documents_status?: string | null
          dossier_ref?: string | null
          email_pro_attendu?: string | null
          email_type?: string | null
          equipe_informee?: boolean | null
          id?: string
          inscription_urgence?: boolean | null
          jeune_besoins?: string | null
          jeune_date_naissance?: string
          jeune_nom?: string
          jeune_prenom?: string
          jeune_sexe?: string | null
          last_relance_at?: string | null
          note_pro?: string | null
          options_educatives?: string | null
          organisation?: string | null
          parental_consent_at?: string | null
          parental_consent_version?: string | null
          payment_method?: string | null
          payment_reference?: string | null
          payment_status?: string | null
          payment_validated_at?: string | null
          pref_bilan_fin_sejour?: boolean | null
          pref_canal_contact?: string | null
          pref_nouvelles_sejour?: string | null
          price_total?: number | null
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
          structure_validation_statut?: string | null
          structure_validee_at?: string | null
          structure_validee_par?: string | null
          suivi_token?: string | null
          suivi_token_expires_at?: string | null
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
      gd_login_attempts: {
        Row: {
          attempt_count: number
          ip: string
          window_start: string
        }
        Insert: {
          attempt_count?: number
          ip: string
          window_start?: string
        }
        Update: {
          attempt_count?: number
          ip?: string
          window_start?: string
        }
        Relationships: []
      }
      gd_medical_events: {
        Row: {
          created_at: string
          created_by: string
          description: string
          event_type: string
          id: string
          inscription_id: string
          structure_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description: string
          event_type: string
          id?: string
          inscription_id: string
          structure_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string
          event_type?: string
          id?: string
          inscription_id?: string
          structure_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gd_medical_events_inscription_id_fkey"
            columns: ["inscription_id"]
            isOneToOne: false
            referencedRelation: "gd_inscriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gd_medical_events_inscription_id_fkey"
            columns: ["inscription_id"]
            isOneToOne: false
            referencedRelation: "v_inscriptions_production"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gd_medical_events_structure_id_fkey"
            columns: ["structure_id"]
            isOneToOne: false
            referencedRelation: "gd_structures"
            referencedColumns: ["id"]
          },
        ]
      }
      gd_notes: {
        Row: {
          content: string
          created_at: string
          created_by: string
          id: string
          inscription_id: string
          structure_id: string
        }
        Insert: {
          content: string
          created_at?: string
          created_by: string
          id?: string
          inscription_id: string
          structure_id: string
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string
          id?: string
          inscription_id?: string
          structure_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gd_notes_inscription_id_fkey"
            columns: ["inscription_id"]
            isOneToOne: false
            referencedRelation: "gd_inscriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gd_notes_inscription_id_fkey"
            columns: ["inscription_id"]
            isOneToOne: false
            referencedRelation: "v_inscriptions_production"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gd_notes_structure_id_fkey"
            columns: ["structure_id"]
            isOneToOne: false
            referencedRelation: "gd_structures"
            referencedColumns: ["id"]
          },
        ]
      }
      gd_parametres_ged: {
        Row: {
          email_contact: string | null
          id: string
          nom_directeur: string | null
          tel_astreinte: string | null
          tel_directeur_colo: string | null
          updated_at: string | null
        }
        Insert: {
          email_contact?: string | null
          id?: string
          nom_directeur?: string | null
          tel_astreinte?: string | null
          tel_directeur_colo?: string | null
          updated_at?: string | null
        }
        Update: {
          email_contact?: string | null
          id?: string
          nom_directeur?: string | null
          tel_astreinte?: string | null
          tel_directeur_colo?: string | null
          updated_at?: string | null
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
      gd_propositions_tarifaires: {
        Row: {
          adhesion: string | null
          agrement_dscs: string | null
          created_at: string | null
          created_by: string | null
          demandeur_email: string | null
          demandeur_nom: string | null
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
          demandeur_email?: string | null
          demandeur_nom?: string | null
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
          sejour_slug: string
          sejour_titre: string
          session_end: string
          session_start: string
          status?: string
          structure_adresse?: string
          structure_cp?: string
          structure_nom: string
          structure_ville?: string
          updated_at?: string | null
          validated_at?: string | null
          ville_depart: string
        }
        Update: {
          adhesion?: string | null
          agrement_dscs?: string | null
          created_at?: string | null
          created_by?: string | null
          demandeur_email?: string | null
          demandeur_nom?: string | null
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
            foreignKeyName: "gd_propositions_tarifaires_inscription_id_fkey"
            columns: ["inscription_id"]
            isOneToOne: false
            referencedRelation: "v_inscriptions_production"
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
      gd_rappels_internes: {
        Row: {
          canal: string
          created_at: string | null
          destinataire_email: string
          expediteur_email: string
          expediteur_role: string
          id: string
          inscription_id: string | null
          lu: boolean | null
          lu_at: string | null
          message: string
          pieces_manquantes: string[] | null
          structure_id: string | null
          type: string
        }
        Insert: {
          canal: string
          created_at?: string | null
          destinataire_email: string
          expediteur_email: string
          expediteur_role: string
          id?: string
          inscription_id?: string | null
          lu?: boolean | null
          lu_at?: string | null
          message: string
          pieces_manquantes?: string[] | null
          structure_id?: string | null
          type: string
        }
        Update: {
          canal?: string
          created_at?: string | null
          destinataire_email?: string
          expediteur_email?: string
          expediteur_role?: string
          id?: string
          inscription_id?: string | null
          lu?: boolean | null
          lu_at?: string | null
          message?: string
          pieces_manquantes?: string[] | null
          structure_id?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "gd_rappels_internes_inscription_id_fkey"
            columns: ["inscription_id"]
            isOneToOne: false
            referencedRelation: "gd_inscriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gd_rappels_internes_inscription_id_fkey"
            columns: ["inscription_id"]
            isOneToOne: false
            referencedRelation: "v_inscriptions_production"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gd_rappels_internes_structure_id_fkey"
            columns: ["structure_id"]
            isOneToOne: false
            referencedRelation: "gd_structures"
            referencedColumns: ["id"]
          },
        ]
      }
      gd_revoked_tokens: {
        Row: {
          expires_at: string
          jti: string
          revoked_at: string | null
        }
        Insert: {
          expires_at: string
          jti: string
          revoked_at?: string | null
        }
        Update: {
          expires_at?: string
          jti?: string
          revoked_at?: string | null
        }
        Relationships: []
      }
      gd_session_deletion_log: {
        Row: {
          deleted_at: string | null
          deleted_by: string | null
          end_date: string
          id: string
          old_data: Json | null
          start_date: string
          stay_slug: string
        }
        Insert: {
          deleted_at?: string | null
          deleted_by?: string | null
          end_date: string
          id?: string
          old_data?: Json | null
          start_date: string
          stay_slug: string
        }
        Update: {
          deleted_at?: string | null
          deleted_by?: string | null
          end_date?: string
          id?: string
          old_data?: Json | null
          start_date?: string
          stay_slug?: string
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
        ]
      }
      gd_souhaits: {
        Row: {
          choix_mode: string | null
          created_at: string | null
          educateur_email: string
          educateur_prenom: string | null
          educateur_token: string | null
          educateur_token_expires_at: string | null
          id: string
          inscription_id: string | null
          kid_prenom: string | null
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
          choix_mode?: string | null
          created_at?: string | null
          educateur_email: string
          educateur_prenom?: string | null
          educateur_token?: string | null
          educateur_token_expires_at?: string | null
          id?: string
          inscription_id?: string | null
          kid_prenom?: string | null
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
          choix_mode?: string | null
          created_at?: string | null
          educateur_email?: string
          educateur_prenom?: string | null
          educateur_token?: string | null
          educateur_token_expires_at?: string | null
          id?: string
          inscription_id?: string | null
          kid_prenom?: string | null
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
            foreignKeyName: "gd_souhaits_inscription_id_fkey"
            columns: ["inscription_id"]
            isOneToOne: false
            referencedRelation: "v_inscriptions_production"
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
      gd_structure_access_codes: {
        Row: {
          activated_at: string | null
          active: boolean | null
          code: string
          created_at: string | null
          email: string | null
          expires_at: string | null
          id: string
          invitation_expires_at: string | null
          invitation_token: string | null
          invited_by_email: string | null
          label: string | null
          last_jti: string | null
          last_jti_exp: string | null
          nom: string | null
          password_hash: string | null
          prenom: string | null
          role: string
          roles: string[] | null
          structure_id: string | null
        }
        Insert: {
          activated_at?: string | null
          active?: boolean | null
          code: string
          created_at?: string | null
          email?: string | null
          expires_at?: string | null
          id?: string
          invitation_expires_at?: string | null
          invitation_token?: string | null
          invited_by_email?: string | null
          label?: string | null
          last_jti?: string | null
          last_jti_exp?: string | null
          nom?: string | null
          password_hash?: string | null
          prenom?: string | null
          role: string
          roles?: string[] | null
          structure_id?: string | null
        }
        Update: {
          activated_at?: string | null
          active?: boolean | null
          code?: string
          created_at?: string | null
          email?: string | null
          expires_at?: string | null
          id?: string
          invitation_expires_at?: string | null
          invitation_token?: string | null
          invited_by_email?: string | null
          label?: string | null
          last_jti?: string | null
          last_jti_exp?: string | null
          nom?: string | null
          password_hash?: string | null
          prenom?: string | null
          role?: string
          roles?: string[] | null
          structure_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gd_structure_access_codes_structure_id_fkey"
            columns: ["structure_id"]
            isOneToOne: false
            referencedRelation: "gd_structures"
            referencedColumns: ["id"]
          },
        ]
      }
      gd_structures: {
        Row: {
          address: string | null
          address_private: boolean
          city: string | null
          code: string | null
          code_directeur: string | null
          code_directeur_expires_at: string | null
          code_directeur_generated_at: string | null
          code_directeur_revoked_at: string | null
          code_expires_at: string | null
          code_generated_at: string | null
          code_revoked_at: string | null
          created_at: string | null
          created_by_email: string | null
          delegated_to_email: string | null
          delegation_active_from: string | null
          delegation_active_until: string | null
          domain: string | null
          email: string | null
          id: string
          is_test: boolean | null
          name: string
          postal_code: string | null
          rgpd_accepted_at: string | null
          rgpd_accepted_by: string | null
          status: string
          type: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          address_private?: boolean
          city?: string | null
          code?: string | null
          code_directeur?: string | null
          code_directeur_expires_at?: string | null
          code_directeur_generated_at?: string | null
          code_directeur_revoked_at?: string | null
          code_expires_at?: string | null
          code_generated_at?: string | null
          code_revoked_at?: string | null
          created_at?: string | null
          created_by_email?: string | null
          delegated_to_email?: string | null
          delegation_active_from?: string | null
          delegation_active_until?: string | null
          domain?: string | null
          email?: string | null
          id?: string
          is_test?: boolean | null
          name: string
          postal_code?: string | null
          rgpd_accepted_at?: string | null
          rgpd_accepted_by?: string | null
          status?: string
          type?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          address_private?: boolean
          city?: string | null
          code?: string | null
          code_directeur?: string | null
          code_directeur_expires_at?: string | null
          code_directeur_generated_at?: string | null
          code_directeur_revoked_at?: string | null
          code_expires_at?: string | null
          code_generated_at?: string | null
          code_revoked_at?: string | null
          created_at?: string | null
          created_by_email?: string | null
          delegated_to_email?: string | null
          delegation_active_from?: string | null
          delegation_active_until?: string | null
          domain?: string | null
          email?: string | null
          id?: string
          is_test?: boolean | null
          name?: string
          postal_code?: string | null
          rgpd_accepted_at?: string | null
          rgpd_accepted_by?: string | null
          status?: string
          type?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      gd_suivi_appels: {
        Row: {
          created_at: string | null
          direction: string
          duree_minutes: number | null
          emetteur: string
          id: string
          inscription_id: string | null
          motif: string | null
          recepteur: string
          resume: string | null
          saisi_par: string | null
        }
        Insert: {
          created_at?: string | null
          direction: string
          duree_minutes?: number | null
          emetteur: string
          id?: string
          inscription_id?: string | null
          motif?: string | null
          recepteur: string
          resume?: string | null
          saisi_par?: string | null
        }
        Update: {
          created_at?: string | null
          direction?: string
          duree_minutes?: number | null
          emetteur?: string
          id?: string
          inscription_id?: string | null
          motif?: string | null
          recepteur?: string
          resume?: string | null
          saisi_par?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gd_suivi_appels_inscription_id_fkey"
            columns: ["inscription_id"]
            isOneToOne: false
            referencedRelation: "gd_inscriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gd_suivi_appels_inscription_id_fkey"
            columns: ["inscription_id"]
            isOneToOne: false
            referencedRelation: "v_inscriptions_production"
            referencedColumns: ["id"]
          },
        ]
      }
      gd_suivi_incidents: {
        Row: {
          clos: boolean | null
          clos_at: string | null
          clos_par: string | null
          created_at: string | null
          date_incident: string
          description: string
          famille_informee: boolean | null
          famille_informee_at: string | null
          gravite: string
          id: string
          inscription_id: string | null
          lieu: string | null
          mesures_prises: string | null
          rapatriement_accompagnant: string | null
          rapatriement_destination: string | null
          rapatriement_motif: string | null
          saisi_par: string | null
          signale_par: string | null
          signale_par_nom: string | null
          structure_id: string | null
          structure_informee: boolean | null
          structure_informee_at: string | null
          suite_donnee: string | null
          updated_at: string | null
        }
        Insert: {
          clos?: boolean | null
          clos_at?: string | null
          clos_par?: string | null
          created_at?: string | null
          date_incident: string
          description: string
          famille_informee?: boolean | null
          famille_informee_at?: string | null
          gravite: string
          id?: string
          inscription_id?: string | null
          lieu?: string | null
          mesures_prises?: string | null
          rapatriement_accompagnant?: string | null
          rapatriement_destination?: string | null
          rapatriement_motif?: string | null
          saisi_par?: string | null
          signale_par?: string | null
          signale_par_nom?: string | null
          structure_id?: string | null
          structure_informee?: boolean | null
          structure_informee_at?: string | null
          suite_donnee?: string | null
          updated_at?: string | null
        }
        Update: {
          clos?: boolean | null
          clos_at?: string | null
          clos_par?: string | null
          created_at?: string | null
          date_incident?: string
          description?: string
          famille_informee?: boolean | null
          famille_informee_at?: string | null
          gravite?: string
          id?: string
          inscription_id?: string | null
          lieu?: string | null
          mesures_prises?: string | null
          rapatriement_accompagnant?: string | null
          rapatriement_destination?: string | null
          rapatriement_motif?: string | null
          saisi_par?: string | null
          signale_par?: string | null
          signale_par_nom?: string | null
          structure_id?: string | null
          structure_informee?: boolean | null
          structure_informee_at?: string | null
          suite_donnee?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gd_suivi_incidents_inscription_id_fkey"
            columns: ["inscription_id"]
            isOneToOne: false
            referencedRelation: "gd_inscriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gd_suivi_incidents_inscription_id_fkey"
            columns: ["inscription_id"]
            isOneToOne: false
            referencedRelation: "v_inscriptions_production"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gd_suivi_incidents_structure_id_fkey"
            columns: ["structure_id"]
            isOneToOne: false
            referencedRelation: "gd_structures"
            referencedColumns: ["id"]
          },
        ]
      }
      gd_suivi_medical: {
        Row: {
          created_at: string | null
          date_consultation: string
          famille_informee: boolean | null
          famille_informee_at: string | null
          id: string
          inscription_id: string | null
          lieu: string | null
          motif: string
          praticien: string | null
          saisi_par: string | null
          structure_informee: boolean | null
          suite_donnee: string | null
          traitement_prescrit: string | null
        }
        Insert: {
          created_at?: string | null
          date_consultation: string
          famille_informee?: boolean | null
          famille_informee_at?: string | null
          id?: string
          inscription_id?: string | null
          lieu?: string | null
          motif: string
          praticien?: string | null
          saisi_par?: string | null
          structure_informee?: boolean | null
          suite_donnee?: string | null
          traitement_prescrit?: string | null
        }
        Update: {
          created_at?: string | null
          date_consultation?: string
          famille_informee?: boolean | null
          famille_informee_at?: string | null
          id?: string
          inscription_id?: string | null
          lieu?: string | null
          motif?: string
          praticien?: string | null
          saisi_par?: string | null
          structure_informee?: boolean | null
          suite_donnee?: string | null
          traitement_prescrit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gd_suivi_medical_inscription_id_fkey"
            columns: ["inscription_id"]
            isOneToOne: false
            referencedRelation: "gd_inscriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gd_suivi_medical_inscription_id_fkey"
            columns: ["inscription_id"]
            isOneToOne: false
            referencedRelation: "v_inscriptions_production"
            referencedColumns: ["id"]
          },
        ]
      }
      gd_suivi_messages: {
        Row: {
          auteur: string
          auteur_nom: string | null
          auteur_role: string | null
          created_at: string | null
          id: string
          inscription_id: string | null
          lu: boolean | null
          lu_at: string | null
          message: string
        }
        Insert: {
          auteur: string
          auteur_nom?: string | null
          auteur_role?: string | null
          created_at?: string | null
          id?: string
          inscription_id?: string | null
          lu?: boolean | null
          lu_at?: string | null
          message: string
        }
        Update: {
          auteur?: string
          auteur_nom?: string | null
          auteur_role?: string | null
          created_at?: string | null
          id?: string
          inscription_id?: string | null
          lu?: boolean | null
          lu_at?: string | null
          message?: string
        }
        Relationships: [
          {
            foreignKeyName: "gd_suivi_messages_inscription_id_fkey"
            columns: ["inscription_id"]
            isOneToOne: false
            referencedRelation: "gd_inscriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gd_suivi_messages_inscription_id_fkey"
            columns: ["inscription_id"]
            isOneToOne: false
            referencedRelation: "v_inscriptions_production"
            referencedColumns: ["id"]
          },
        ]
      }
      gd_suivi_sejour: {
        Row: {
          bilan_attention: string | null
          bilan_positifs: string | null
          consultation_medicale: boolean | null
          consultation_medicale_date: string | null
          consultation_medicale_motif: string | null
          consultation_medicale_suite: string | null
          created_at: string | null
          dernier_contact: string | null
          fiche_liaison_validee: boolean | null
          fiche_liaison_validee_at: string | null
          id: string
          inscription_id: string | null
          nb_appels: number | null
          nb_mails: number | null
          points_attention: string | null
          structure_id: string | null
          updated_at: string | null
        }
        Insert: {
          bilan_attention?: string | null
          bilan_positifs?: string | null
          consultation_medicale?: boolean | null
          consultation_medicale_date?: string | null
          consultation_medicale_motif?: string | null
          consultation_medicale_suite?: string | null
          created_at?: string | null
          dernier_contact?: string | null
          fiche_liaison_validee?: boolean | null
          fiche_liaison_validee_at?: string | null
          id?: string
          inscription_id?: string | null
          nb_appels?: number | null
          nb_mails?: number | null
          points_attention?: string | null
          structure_id?: string | null
          updated_at?: string | null
        }
        Update: {
          bilan_attention?: string | null
          bilan_positifs?: string | null
          consultation_medicale?: boolean | null
          consultation_medicale_date?: string | null
          consultation_medicale_motif?: string | null
          consultation_medicale_suite?: string | null
          created_at?: string | null
          dernier_contact?: string | null
          fiche_liaison_validee?: boolean | null
          fiche_liaison_validee_at?: string | null
          id?: string
          inscription_id?: string | null
          nb_appels?: number | null
          nb_mails?: number | null
          points_attention?: string | null
          structure_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gd_suivi_sejour_inscription_id_fkey"
            columns: ["inscription_id"]
            isOneToOne: true
            referencedRelation: "gd_inscriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gd_suivi_sejour_inscription_id_fkey"
            columns: ["inscription_id"]
            isOneToOne: true
            referencedRelation: "v_inscriptions_production"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gd_suivi_sejour_structure_id_fkey"
            columns: ["structure_id"]
            isOneToOne: false
            referencedRelation: "gd_structures"
            referencedColumns: ["id"]
          },
        ]
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
      gd_structure_members: {
        Row: {
          activated_at: string | null
          active: boolean | null
          code: string | null
          created_at: string | null
          email: string | null
          expires_at: string | null
          id: string | null
          invitation_expires_at: string | null
          invited_by_email: string | null
          label: string | null
          last_jti: string | null
          last_jti_exp: string | null
          nom: string | null
          prenom: string | null
          role: string | null
          roles: string[] | null
          structure_id: string | null
        }
        Insert: {
          activated_at?: string | null
          active?: boolean | null
          code?: string | null
          created_at?: string | null
          email?: string | null
          expires_at?: string | null
          id?: string | null
          invitation_expires_at?: string | null
          invited_by_email?: string | null
          label?: string | null
          last_jti?: string | null
          last_jti_exp?: string | null
          nom?: string | null
          prenom?: string | null
          role?: string | null
          roles?: string[] | null
          structure_id?: string | null
        }
        Update: {
          activated_at?: string | null
          active?: boolean | null
          code?: string | null
          created_at?: string | null
          email?: string | null
          expires_at?: string | null
          id?: string | null
          invitation_expires_at?: string | null
          invited_by_email?: string | null
          label?: string | null
          last_jti?: string | null
          last_jti_exp?: string | null
          nom?: string | null
          prenom?: string | null
          role?: string | null
          roles?: string[] | null
          structure_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gd_structure_access_codes_structure_id_fkey"
            columns: ["structure_id"]
            isOneToOne: false
            referencedRelation: "gd_structures"
            referencedColumns: ["id"]
          },
        ]
      }
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
      v_inscriptions_production: {
        Row: {
          besoins_pris_en_compte: boolean | null
          besoins_specifiques: string | null
          city_departure: string | null
          consent_at: string | null
          consignes_communication: string | null
          created_at: string | null
          deleted_at: string | null
          documents_status: string | null
          dossier_ref: string | null
          email_pro_attendu: string | null
          email_type: string | null
          equipe_informee: boolean | null
          id: string | null
          inscription_urgence: boolean | null
          jeune_besoins: string | null
          jeune_date_naissance: string | null
          jeune_nom: string | null
          jeune_prenom: string | null
          jeune_sexe: string | null
          note_pro: string | null
          options_educatives: string | null
          organisation: string | null
          parental_consent_at: string | null
          parental_consent_version: string | null
          payment_method: string | null
          payment_reference: string | null
          payment_status: string | null
          payment_validated_at: string | null
          pref_bilan_fin_sejour: boolean | null
          pref_canal_contact: string | null
          pref_nouvelles_sejour: string | null
          price_total: number | null
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
          structure_validation_statut: string | null
          structure_validee_at: string | null
          structure_validee_par: string | null
          suivi_token: string | null
          suivi_token_expires_at: string | null
          updated_at: string | null
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
      check_rate_limit: {
        Args: { p_key: string; p_limit: number; p_window_minutes: number }
        Returns: boolean
      }
      estimate_financial_aid: {
        Args: { p_qf: number; p_qpv: boolean; p_sejour_price: number }
        Returns: {
          aide_montant: number
          eligible_aide_max: boolean
          reste_a_charge: number
          taux_prise_en_charge: number
        }[]
      }
      gd_check_and_decrement_capacity: {
        Args: { p_slug: string; p_start_date: string }
        Returns: Json
      }
      gd_check_session_capacity: {
        Args: { p_slug: string; p_start_date: string }
        Returns: Json
      }
      gd_get_expired_linked_medical_events: {
        Args: { threshold: string }
        Returns: {
          id: string
        }[]
      }
      gd_get_medical_events_null_session_date: {
        Args: { threshold: string }
        Returns: {
          id: string
        }[]
      }
      gd_increment_capacity: {
        Args: { p_slug: string; p_start_date: string }
        Returns: Json
      }
      gd_purge_expired_audit_logs: { Args: never; Returns: number }
      gd_purge_expired_calls: { Args: never; Returns: number }
      gd_purge_expired_medical_data: { Args: never; Returns: number }
      gd_purge_expired_notes: { Args: never; Returns: number }
      generate_director_code: { Args: never; Returns: string }
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
      purge_old_audit_logs: { Args: never; Returns: undefined }
      purge_old_login_attempts: { Args: never; Returns: undefined }
      purge_revoked_tokens: { Args: never; Returns: undefined }
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
