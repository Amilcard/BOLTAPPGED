-- Migration 010: Remove Stripe, Prepare for Lyra (PayZen)
-- Date: 2026-02-17
-- Objectif: Supprimer les colonnes/contraintes Stripe et préparer l'intégration Lyra

-- ============================================
-- PHASE 1: VÉRIFICATION PRÉ-MIGRATION
-- ============================================

-- Vérifier qu'aucun paiement Stripe n'existe en production
DO $$
DECLARE
  stripe_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO stripe_count
  FROM gd_inscriptions
  WHERE payment_method = 'stripe';

  IF stripe_count > 0 THEN
    RAISE EXCEPTION 'ABORT: % paiements Stripe détectés. Migration impossible.', stripe_count;
  ELSE
    RAISE NOTICE 'OK: Aucun paiement Stripe. Migration sécurisée.';
  END IF;
END $$;

-- ============================================
-- PHASE 2: SUPPRESSION INDEX STRIPE
-- ============================================

-- Supprimer l'index sur stripe_payment_intent_id (plus utilisé)
DROP INDEX IF EXISTS idx_registrations_stripe_intent;

RAISE NOTICE 'Index idx_registrations_stripe_intent supprimé';

-- ============================================
-- PHASE 3: SUPPRESSION COLONNE STRIPE
-- ============================================

-- Supprimer la colonne stripe_payment_intent_id (plus nécessaire avec Lyra)
ALTER TABLE gd_inscriptions
DROP COLUMN IF EXISTS stripe_payment_intent_id;

RAISE NOTICE 'Colonne stripe_payment_intent_id supprimée';

-- ============================================
-- PHASE 4: MISE À JOUR CONTRAINTE PAYMENT_METHOD
-- ============================================

-- Supprimer l'ancienne contrainte avec 'stripe'
ALTER TABLE gd_inscriptions
DROP CONSTRAINT IF EXISTS registrations_payment_method_check;

ALTER TABLE gd_inscriptions
DROP CONSTRAINT IF EXISTS gd_inscriptions_payment_method_check;

RAISE NOTICE 'Anciennes contraintes payment_method supprimées';

-- Ajouter la nouvelle contrainte avec 'lyra' au lieu de 'stripe'
ALTER TABLE gd_inscriptions
ADD CONSTRAINT gd_inscriptions_payment_method_check
CHECK (payment_method IN ('lyra', 'transfer', 'check'));

RAISE NOTICE 'Nouvelle contrainte payment_method ajoutée (lyra, transfer, check)';

-- ============================================
-- PHASE 5: MISE À JOUR TRIGGER LOG_PAYMENT_STATUS_CHANGE
-- ============================================

-- Recréer la fonction de log sans la logique Stripe
CREATE OR REPLACE FUNCTION log_payment_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.payment_status IS DISTINCT FROM NEW.payment_status THEN
    INSERT INTO payment_status_logs (
      registration_id,
      old_status,
      new_status,
      changed_by,
      note
    ) VALUES (
      NEW.id,
      OLD.payment_status,
      NEW.payment_status,
      auth.uid(),
      CASE
        WHEN NEW.payment_status = 'paid'
          THEN 'Payment validated'
        ELSE NULL
      END
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

RAISE NOTICE 'Fonction log_payment_status_change mise à jour (Stripe logic removed)';

-- ============================================
-- PHASE 6: MISE À JOUR COMMENTAIRES
-- ============================================

-- Mettre à jour les commentaires de colonnes
COMMENT ON COLUMN gd_inscriptions.payment_method IS 'Payment method: lyra (online CB via Lyra/PayZen), transfer (bank), or check';
COMMENT ON COLUMN gd_inscriptions.payment_status IS 'Current payment status. Only webhooks/admin can set to paid';

RAISE NOTICE 'Commentaires mis à jour';

-- ============================================
-- PHASE 7: AJOUT COLONNE LYRA (OPTIONNEL)
-- ============================================

-- Ajouter colonne pour stocker transaction_id Lyra (équivalent de payment_intent_id)
ALTER TABLE gd_inscriptions
ADD COLUMN IF NOT EXISTS lyra_transaction_id TEXT;

-- Index pour performances
CREATE INDEX IF NOT EXISTS idx_inscriptions_lyra_transaction
  ON gd_inscriptions(lyra_transaction_id);

COMMENT ON COLUMN gd_inscriptions.lyra_transaction_id IS 'Lyra (PayZen) transaction ID for online CB payments';

RAISE NOTICE 'Colonne lyra_transaction_id ajoutée';

-- ============================================
-- PHASE 8: VÉRIFICATION POST-MIGRATION
-- ============================================

DO $$
DECLARE
  column_exists BOOLEAN;
BEGIN
  -- Vérifier que stripe_payment_intent_id n'existe plus
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'gd_inscriptions'
    AND column_name = 'stripe_payment_intent_id'
  ) INTO column_exists;

  IF column_exists THEN
    RAISE EXCEPTION 'ERREUR: Colonne stripe_payment_intent_id toujours présente';
  ELSE
    RAISE NOTICE '✅ Migration 010 terminée avec succès';
  END IF;
END $$;

-- ============================================
-- RÉSUMÉ MIGRATION 010
-- ============================================

-- Supprimé:
--   ✅ Index idx_registrations_stripe_intent
--   ✅ Colonne stripe_payment_intent_id
--   ✅ Contrainte avec valeur 'stripe'
--   ✅ Logique Stripe dans trigger log_payment_status_change

-- Ajouté:
--   ✅ Contrainte payment_method avec 'lyra'
--   ✅ Colonne lyra_transaction_id
--   ✅ Index idx_inscriptions_lyra_transaction

-- Prochaine étape: Implémenter API Lyra (PayZen) dans app/api/payment/lyra/
