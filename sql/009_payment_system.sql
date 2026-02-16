-- Migration 009: Payment System
-- Ajoute les champs nécessaires au système de paiement sécurisé
-- Date: 2026-02-15

-- Étape 1: Ajouter les colonnes de paiement
ALTER TABLE registrations
ADD COLUMN IF NOT EXISTS payment_method TEXT
  CHECK (payment_method IN ('stripe', 'transfer', 'check')),
ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pending_payment'
  CHECK (payment_status IN ('pending_payment', 'pending_transfer', 'pending_check', 'paid', 'failed')),
ADD COLUMN IF NOT EXISTS payment_reference TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT,
ADD COLUMN IF NOT EXISTS payment_validated_at TIMESTAMPTZ;

-- Étape 2: Créer les index pour performances
CREATE INDEX IF NOT EXISTS idx_registrations_payment_reference
  ON registrations(payment_reference);

CREATE INDEX IF NOT EXISTS idx_registrations_stripe_intent
  ON registrations(stripe_payment_intent_id);

CREATE INDEX IF NOT EXISTS idx_registrations_payment_status
  ON registrations(payment_status);

-- Étape 3: RLS Policy - Sécurité critique
-- Les utilisateurs peuvent voir uniquement leurs propres paiements
CREATE POLICY "Users can view own payment status"
  ON registrations
  FOR SELECT
  USING (auth.uid() = user_id OR email = auth.jwt()->>'email');

-- Seuls les admins peuvent modifier payment_status à 'paid'
-- (Les webhooks Stripe utilisent le service role qui bypass RLS)
CREATE POLICY "Only admins can mark as paid"
  ON registrations
  FOR UPDATE
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
    OR payment_status != 'paid'  -- Permet autres transitions
  );

-- Étape 4: Fonction de génération de référence unique
CREATE OR REPLACE FUNCTION generate_payment_reference()
RETURNS TEXT AS $$
DECLARE
  ref TEXT;
  exists BOOLEAN;
BEGIN
  LOOP
    -- Format: REF-YYYY-XXXXXXXX (année + 8 caractères aléatoires)
    ref := 'REF-' ||
           EXTRACT(YEAR FROM NOW())::TEXT || '-' ||
           UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 8));

    -- Vérifier unicité
    SELECT EXISTS(SELECT 1 FROM registrations WHERE payment_reference = ref) INTO exists;

    EXIT WHEN NOT exists;
  END LOOP;

  RETURN ref;
END;
$$ LANGUAGE plpgsql;

-- Étape 5: Trigger pour auto-générer payment_reference
CREATE OR REPLACE FUNCTION set_payment_reference()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.payment_reference IS NULL THEN
    NEW.payment_reference := generate_payment_reference();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_payment_reference
  BEFORE INSERT ON registrations
  FOR EACH ROW
  EXECUTE FUNCTION set_payment_reference();

-- Étape 6: Log des transitions de statut (audit trail)
CREATE TABLE IF NOT EXISTS payment_status_logs (
  id BIGSERIAL PRIMARY KEY,
  registration_id BIGINT REFERENCES registrations(id) ON DELETE CASCADE,
  old_status TEXT,
  new_status TEXT NOT NULL,
  changed_by UUID REFERENCES auth.users(id),
  changed_at TIMESTAMPTZ DEFAULT NOW(),
  note TEXT
);

CREATE INDEX IF NOT EXISTS idx_payment_logs_registration
  ON payment_status_logs(registration_id);

-- Trigger pour logger les changements de statut
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
        WHEN NEW.payment_status = 'paid' AND NEW.stripe_payment_intent_id IS NOT NULL
          THEN 'Stripe webhook validation'
        WHEN NEW.payment_status = 'paid'
          THEN 'Manual admin validation'
        ELSE NULL
      END
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_log_payment_status
  AFTER UPDATE ON registrations
  FOR EACH ROW
  EXECUTE FUNCTION log_payment_status_change();

-- Commentaires pour documentation
COMMENT ON COLUMN registrations.payment_method IS 'Payment method chosen: stripe (online), transfer (bank), or check';
COMMENT ON COLUMN registrations.payment_status IS 'Current payment status. Only webhooks/admin can set to paid';
COMMENT ON COLUMN registrations.payment_reference IS 'Unique reference for transfers/checks. Auto-generated.';
COMMENT ON COLUMN registrations.stripe_payment_intent_id IS 'Stripe Payment Intent ID for online payments';
COMMENT ON COLUMN registrations.payment_validated_at IS 'Timestamp when payment was confirmed as paid';
