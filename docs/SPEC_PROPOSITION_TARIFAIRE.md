# Spec Fonctionnelle — Proposition Tarifaire GED → Structure

**Version** : 1.2
**Date** : 2026-03-29
**Auteur** : Claude / LAID
**Statut** : Draft

---

## 1. Contexte & objectif

Aujourd'hui, l'admin GED peut créer des propositions tarifaires (`gd_propositions_tarifaires`) et générer un PDF "BON POUR ACCORD", mais :

- La structure sociale ne voit **rien** dans son portail (`/structure/[code]`)
- Aucun email n'est envoyé à la structure quand une proposition est prête
- La structure ne peut ni accepter ni refuser en ligne
- Aucune inscription définitive n'est créée automatiquement après acceptation

**Objectif** : créer un flux complet GED → Structure avec validation en ligne et inscription automatique, sans casser le parcours d'inscription existant ni créer un sentiment d'intrusion.

---

## 2. Parcours utilisateur cible

### 2.1 Flux principal

```
Admin GED crée proposition (existant)
        ↓
Admin clique "Envoyer à la structure"
        ↓
Email envoyé à la structure avec lien direct
        ↓
Structure ouvre son portail → nouvel onglet "Propositions"
        ↓
Voit la proposition, détail tarifaire, PDF
        ↓
2 boutons : ✅ Accepter / ❌ Refuser (+ motif optionnel)
        ↓
Si acceptée → inscription définitive créée automatiquement
        ↓
Email de confirmation envoyé (structure + admin)
        ↓
Compteur 48h : si aucune réponse → relance email auto
```

### 2.2 Positionnement UX — Onglet "Propositions"

**Principe** : l'onglet Propositions est **complémentaire** au tableau des inscriptions, jamais en compétition.

Dans le portail structure (`/structure/[code]`), on ajoute un système d'onglets :

| Onglet | Contenu | Badge |
|--------|---------|-------|
| **Inscriptions** (défaut) | Tableau actuel des inscriptions | Nombre total |
| **Propositions** | Propositions tarifaires en attente/historique | Nombre en attente (orange si > 0) |

**Pourquoi cet emplacement est stratégique :**

- Ne modifie pas le tableau des inscriptions existant → zéro régression
- Le badge orange attire l'attention sans bloquer le parcours
- La structure voit le devis comme une étape préalable naturelle, pas une intrusion
- Après acceptation, l'inscription apparaît automatiquement dans l'onglet Inscriptions → continuité fluide

---

## 3. Référentiel de numérotation unique

### 3.1 Principe : une seule référence de bout en bout

Aujourd'hui il n'y a **aucune référence** sur le PDF de proposition, et le `dossier_ref` de l'inscription est généré indépendamment (`DOS-YYYYMMDD-XXXXXXXX`). Il faut un **référentiel unique** qui relie proposition → inscription → facture.

**Format** : `PROP-YYYYMM-XXXX` (ex: `PROP-202604-0001`)

| Document | Référence affichée | Lien |
|----------|-------------------|------|
| **Proposition PDF** | `PROP-202604-0001` | Générée à la création de la proposition |
| **Inscription** | `PROP-202604-0001` (= `dossier_ref`) | Copié depuis la proposition à l'acceptation |
| **Facture** (futur) | `FACT-202604-0001` | Même suffixe, préfixe différent |

### 3.2 Implémentation

```sql
-- Nouveau champ ref sur la table propositions
ALTER TABLE gd_propositions_tarifaires
  ADD COLUMN IF NOT EXISTS proposition_ref TEXT UNIQUE;

-- Séquence auto-incrémentée par mois
CREATE SEQUENCE IF NOT EXISTS seq_proposition_ref START 1;
```

**Génération côté API** (dans le POST `/api/admin/propositions`) :

```typescript
// Générer la ref au format PROP-YYYYMM-XXXX
const now = new Date();
const prefix = `PROP-${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}`;
// Incrémenter via Supabase RPC ou comptage
const { count } = await supabase
  .from('gd_propositions_tarifaires')
  .select('id', { count: 'exact', head: true })
  .ilike('proposition_ref', `${prefix}%`);
const seq = String((count || 0) + 1).padStart(4, '0');
const propositionRef = `${prefix}-${seq}`;
```

**À l'acceptation** : l'inscription créée dans `gd_inscriptions` reprend `dossier_ref = proposition_ref`.

**Sur le PDF** : la ref est imprimée en haut à droite sous la date (voir section 7.4).

### 3.3 Traçabilité email

Chaque envoi de proposition inclut :
- **À** : email de la structure
- **CC** : `contact@groupeetdecouverte.fr` (GED)
- **Sujet** : `Proposition ${proposition_ref} — [Enfant] — [Séjour]`
- **PJ** : PDF de la proposition en pièce jointe

GED dispose ainsi d'une copie mail avec la même ref que celle du PDF et de l'inscription future.

---

## 4. Modifications base de données

### 4.1 ALTER TABLE `gd_propositions_tarifaires`

```sql
-- Lier la proposition à une structure existante
ALTER TABLE gd_propositions_tarifaires
  ADD COLUMN IF NOT EXISTS structure_id UUID REFERENCES gd_structures(id) ON DELETE SET NULL;

-- Traçabilité envoi
ALTER TABLE gd_propositions_tarifaires
  ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sent_to_email TEXT;

-- Réponse structure
ALTER TABLE gd_propositions_tarifaires
  ADD COLUMN IF NOT EXISTS responded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS refusal_reason TEXT;

-- Token sécurisé pour lien direct (sans login)
ALTER TABLE gd_propositions_tarifaires
  ADD COLUMN IF NOT EXISTS access_token UUID DEFAULT gen_random_uuid();

-- Deadline 48h
ALTER TABLE gd_propositions_tarifaires
  ADD COLUMN IF NOT EXISTS deadline_at TIMESTAMPTZ;

-- Index
CREATE INDEX IF NOT EXISTS idx_propositions_structure_id
  ON gd_propositions_tarifaires(structure_id);
CREATE INDEX IF NOT EXISTS idx_propositions_access_token
  ON gd_propositions_tarifaires(access_token);
CREATE INDEX IF NOT EXISTS idx_propositions_deadline
  ON gd_propositions_tarifaires(deadline_at) WHERE status = 'envoyee';
```

### 4.2 Nouvelle RLS policy pour accès structure

```sql
-- Permettre à une structure de lire SES propositions via son structure_id
CREATE POLICY "Structure can read own propositions"
  ON gd_propositions_tarifaires
  FOR SELECT
  USING (
    structure_id IS NOT NULL
    AND structure_id = current_setting('app.current_structure_id', true)::uuid
  );
```

> Note : en pratique, l'accès se fera via service_role côté API (comme le reste du portail structure), donc cette policy est un filet de sécurité.

---

## 5. Nouveaux endpoints API

### 5.1 `PATCH /api/admin/propositions` — Enrichir pour l'envoi

Ajouter un cas `status = 'envoyee'` qui :

1. Résout `structure_id` depuis `structure_nom` + `structure_cp` (match sur `gd_structures`)
2. Si structure trouvée : récupère l'email, set `sent_to_email`, `sent_at`, `deadline_at = NOW() + 48h`
3. Si structure non trouvée : retourne 400 avec message "Structure non trouvée, vérifiez le nom"
4. Envoie l'email via Resend
5. Génère `access_token` si absent

### 5.2 `GET /api/structure/[code]/propositions` — Liste pour le portail

```
Response: {
  propositions: [{
    id, access_token,
    enfant_nom, enfant_prenom,
    sejour_titre, session_start, session_end,
    ville_depart, encadrement,
    prix_sejour, prix_transport, prix_encadrement, prix_total,
    status, sent_at, deadline_at,
    sejour_activites, adhesion, options, agrement_dscs
  }]
}
```

Filtre : `structure_id = structure.id` (résolu depuis le code).

### 5.3 `POST /api/structure/propositions/[id]/respond` — Accepter/Refuser

```
Body: {
  access_token: string,     // vérification
  action: 'accepter' | 'refuser',
  refusal_reason?: string   // optionnel si refus
}
```

**Si acceptation :**

1. `status → 'validee'`, `validated_at = NOW()`, `responded_at = NOW()`

2. **Résolution structure (anti-doublon)** — même logique que `/api/inscriptions` :
   - Chercher `gd_structures` par `structure_id` de la proposition (si déjà lié)
   - Si pas de `structure_id` : chercher par `structure_nom` + `structure_cp` dans `gd_structures`
   - Si match trouvé → réutiliser `structure_id` existant (pas de création doublon)
   - Si aucun match → créer la structure dans `gd_structures`, générer le code 6 chars, envoyer email code
   - Si structures existantes sur le même CP → envoyer alerte admin (`sendNewEducateurAlert`)

3. **Créer l'inscription définitive** dans `gd_inscriptions` :
   - `jeune_nom`, `jeune_prenom` depuis la proposition
   - `sejour_slug`, `session_date = session_start`, `city_departure = ville_depart`
   - `price_total` = `prix_total` de la proposition
   - `status = 'validee'`
   - `payment_status = 'pending_payment'`
   - `source = 'proposition'`
   - `structure_id` = résolu à l'étape 2
   - `dossier_ref` = généré (`DOS-YYYYMMDD-XXXXXXXX`)
   - `suivi_token` = auto-généré par Supabase (DEFAULT gen_random_uuid())
   - `referent_nom` / `referent_email` = à renseigner (email structure ou contact proposition)

4. Mettre à jour `inscription_id` dans la proposition

5. **Envoyer les emails** :
   - Email confirmation structure avec :
     - `dossier_ref` de l'inscription
     - `suivi_token` → lien de suivi `/suivi/[token]`
     - Lien portail structure `/structure/[code]`
     - Prochaines étapes (compléter dossier, paiement)
   - Email notification admin

**Si refus :**

1. `status → 'refusee'`, `responded_at = NOW()`, `refusal_reason`
2. Envoyer email notification à l'admin

### 5.4 `GET /api/propositions/[token]` — Accès direct par token (lien email)

Permet d'afficher la proposition sans login, via le lien envoyé par email. Retourne les mêmes données que 4.2 mais pour une seule proposition, identifiée par `access_token`. Inclut les boutons Accepter/Refuser.

---

## 6. Logique anti-doublon structure & token inscription

### 6.1 Vérification structure existante (à l'envoi ET à l'acceptation)

Le système existant (`/api/inscriptions`) gère déjà la résolution de structure :

```
Si structureCode fourni (6 chars) :
  → Chercher gd_structures WHERE code = X AND status = 'active'
  → Si trouvé → rattacher
  → Si non trouvé → continuer sans bloquer

Si pas de code :
  → Chercher gd_structures WHERE postal_code = CP AND status = 'active'
  → Si match → alerte admin "structures existantes sur ce CP"
  → Créer nouvelle structure → générer code 6 chars → envoyer email code
```

**Pour les propositions, on réplique cette logique en 2 temps :**

**Temps 1 — À l'envoi (admin → `envoyee`)** :
- Chercher `gd_structures` par `structure_nom` (ilike) + `structure_cp` (eq)
- Si match unique → lier `structure_id`, récupérer `email` et `code`
- Si match multiple → proposer à l'admin de choisir (dropdown)
- Si aucun match → warning "Structure inconnue, elle sera créée à l'acceptation"

**Temps 2 — À l'acceptation (structure valide le devis)** :
- Si `structure_id` déjà lié (résolu au temps 1) → OK, réutiliser
- Si pas de `structure_id` → créer la structure, générer code, envoyer email code
- Vérifier doublon CP comme dans `/api/inscriptions`

### 6.2 Token de suivi et inscription définitive

Quand la proposition est acceptée, l'inscription créée dans `gd_inscriptions` dispose de :

| Champ | Valeur | Usage |
|-------|--------|-------|
| `dossier_ref` | `DOS-20260329-A1B2C3D4` | Référence unique du dossier |
| `suivi_token` | UUID v4 (auto Supabase) | Lien `/suivi/[token]` pour le référent |
| `structure_id` | UUID de la structure | Lien portail `/structure/[code]` |

**L'inscription apparaît immédiatement** dans :
- L'onglet "Inscriptions" du portail structure (`/structure/[code]`)
- La page de suivi individuelle (`/suivi/[token]`)
- L'admin GED (`/admin/inscriptions`)

**Emails envoyés à l'acceptation** :
- Structure reçoit : `dossier_ref` + lien suivi + lien portail + prochaines étapes
- Admin reçoit : notification avec récap proposition + inscription créée

---

## 7. Emails (Resend)

### 7.1 `sendPropositionToStructure()`

**Déclencheur** : admin passe le statut à `envoyee`

```
Sujet : Proposition [PROP-202604-0001] — [Prénom Nom enfant] — [Séjour titre]
De : noreply@groupeetdecouverte.fr
À : email de la structure
CC : contact@groupeetdecouverte.fr (+ ADMIN_NOTIFICATION_EMAIL)
PJ : Proposition_[NOM]_[Prenom].pdf (généré automatiquement)

Contenu :
- Header GED orange
- "Bonjour [Nom structure],"
- "Veuillez trouver ci-joint la proposition tarifaire réf. PROP-202604-0001
   pour [Prénom Nom] — séjour [Titre] du [date] au [date]."
- Récap prix (séjour + transport + encadrement si applicable = total)
- CTA principal : "Consulter et répondre en ligne" → lien /propositions/[access_token]
- CTA secondaire : "Accéder à votre espace structure" → lien /structure/[code]
- Mention "Vous disposez de 48h pour accepter ou refuser cette proposition"
- Footer contact GED
```

**Envoi PDF en PJ via Resend** :

```typescript
await resend.emails.send({
  from: FROM_EMAIL,
  to: structureEmail,
  cc: ADMIN_EMAIL,  // GED en copie
  subject: `Proposition ${propositionRef} — ${enfant} — ${sejour}`,
  html: emailHtml,
  attachments: [{
    filename: `Proposition_${enfantNom}_${enfantPrenom}.pdf`,
    content: Buffer.from(pdfBytes),  // PDF généré via pdf-lib
  }],
});
```

### 7.2 `sendPropositionReminder()`

**Déclencheur** : cron (ou n8n) après 24h si toujours `envoyee`

```
Sujet : Rappel — Proposition [PROP-202604-0001] en attente — [Enfant]
À : email structure
CC : contact@groupeetdecouverte.fr
PJ : même PDF (re-joint)
Contenu similaire avec mention "Il vous reste 24h pour répondre"
```

### 7.3 `sendPropositionAccepted()` (→ structure + admin)

```
Sujet : Proposition [PROP-202604-0001] acceptée — [Enfant] inscrit(e)
À : email structure
CC : contact@groupeetdecouverte.fr
Contenu :
- Confirmation de l'acceptation
- Réf dossier = PROP-202604-0001 (même ref sur proposition et inscription)
- Lien de suivi : /suivi/[token]
- Lien portail : /structure/[code]
- Prochaines étapes : compléter le dossier administratif, paiement
```

### 7.4 `sendPropositionRefused()` (→ admin uniquement)

```
Sujet : Proposition [PROP-202604-0001] refusée — [Structure]
À : contact@groupeetdecouverte.fr
Contenu : récap proposition + motif du refus si renseigné
```

### 7.5 Modification du PDF — Ajout de la référence

Le PDF existant (`/api/admin/propositions/pdf`) doit afficher la référence `proposition_ref` :

```
Emplacement : sous la date, aligné à gauche
Format : "Réf. : PROP-202604-0001"
Police : bold, 11pt, couleur ORANGE
```

Ajout dans `pdf/route.ts` après la ligne `w(LEFT, Y, ...)` de la date :

```typescript
Y += 14;
w(LEFT, Y, `Ref. : ${c(p.proposition_ref || '')}`, bold, 11, ORANGE);
```

Ainsi la même ref apparaît sur : le PDF → l'email (sujet + corps) → l'inscription (`dossier_ref`) → la future facture.

---

## 8. Modifications front-end

### 8.1 Portail structure — `/structure/[code]/page.tsx`

**Ajout d'un système d'onglets :**

```tsx
// État
const [activeTab, setActiveTab] = useState<'inscriptions' | 'devis'>('inscriptions');

// Fetch propositions en parallèle des inscriptions
const [propositions, setPropositions] = useState([]);

// Onglets dans le header, entre Stats et Recherche
<div className="flex gap-1 bg-gray-100 rounded-lg p-1 mb-4">
  <TabButton
    active={activeTab === 'inscriptions'}
    onClick={() => setActiveTab('inscriptions')}
    label="Inscriptions"
    count={inscriptions.length}
  />
  <TabButton
    active={activeTab === 'devis'}
    onClick={() => setActiveTab('devis')}
    label="Propositions"
    count={pendingPropositions.length}
    highlight={pendingPropositions.length > 0}  // badge orange
  />
</div>
```

**Contenu onglet Propositions :**

Pour chaque proposition, une carte avec :

- Nom enfant, séjour, dates
- Détail tarif (séjour + transport + encadrement = total)
- Statut (en attente / acceptée / refusée)
- Si `envoyee` : boutons Accepter / Refuser + countdown 48h
- Si `validee` : lien "Voir l'inscription" vers l'onglet Inscriptions
- Télécharger le PDF

### 8.2 Admin propositions — `/admin/propositions/page.tsx`

**Modifications mineures :**

1. Bouton "Envoyer" actuel → appelle le PATCH avec résolution `structure_id` + envoi email
2. Ajouter colonnes `Envoyé le` et `Deadline` dans le tableau
3. Indicateur visuel si deadline dépassée (rouge)
4. Nouveau statut visuel "Expirée" si deadline passée sans réponse

### 8.3 Page accès direct — `/propositions/[token]/page.tsx` (nouvelle)

Page publique (pas de login) qui affiche :

- Header GED
- Détail complet de la proposition (même rendu que l'aperçu admin)
- Boutons Accepter / Refuser si `status === 'envoyee'`
- Message de confirmation si déjà répondu
- Countdown jusqu'à la deadline

---

## 9. Sécurité

| Risque | Mitigation |
|--------|-----------|
| Accès non autorisé à une proposition | Token UUID v4 dans l'URL (non devinable) |
| Modification après deadline | API vérifie `deadline_at` avant d'accepter la réponse |
| Double acceptation | API vérifie `status === 'envoyee'` avant traitement |
| Structure inexistante | Résolution `structure_id` obligatoire avant envoi |
| Spam email | Rate limit sur l'envoi, un seul reminder auto |
| Doublon structure | Match par nom+CP avant création ; alerte admin si CP existant |
| Inscription sans token | `suivi_token` auto-généré (DEFAULT gen_random_uuid) ; `dossier_ref` généré côté serveur |
| Structure accepte 2 fois | Vérifier `status === 'envoyee'` + `inscription_id IS NULL` avant traitement |

---

## 10. Plan d'implémentation (ordre recommandé)

| # | Tâche | Fichiers | Effort |
|---|-------|----------|--------|
| 1 | Migration SQL (ALTER TABLE) | `migration_propositions_v2.sql` | 15 min |
| 2 | API `GET /api/structure/[code]/propositions` | Nouveau fichier | 30 min |
| 3 | API `POST /api/structure/propositions/[id]/respond` | Nouveau fichier | 45 min |
| 4 | Enrichir `PATCH /api/admin/propositions` (envoi email + structure_id) | Existant | 30 min |
| 5 | Email templates (`sendPropositionToStructure`, etc.) | `lib/email.ts` | 30 min |
| 6 | Onglet Propositions dans portail structure | `/structure/[code]/page.tsx` | 1h |
| 7 | Page accès direct `/propositions/[token]` | Nouveau fichier | 45 min |
| 8 | Ajustements admin (colonnes, indicateurs) | `/admin/propositions/page.tsx` | 30 min |
| 9 | Cron relance 24h (n8n ou API cron) | n8n workflow ou Vercel cron | 30 min |
| 10 | Tests manuels E2E | — | 1h |

**Total estimé** : ~6h de développement

---

## 11. Hors périmètre (v1)

- Signature électronique du PDF (le "BON POUR ACCORD" en ligne remplace le PDF signé)
- Multi-enfants par proposition (1 proposition = 1 enfant)
- Négociation tarifaire (prix fixé par GED, pas de contre-offre)
- Notification push (email uniquement)
- Paiement en ligne directement depuis le devis (le paiement suit le flux inscription classique)

---

## 12. Métriques de succès

- Taux de réponse structure < 48h > 70%
- Taux de conversion devis → inscription > 60%
- Temps moyen entre envoi et réponse < 24h
- Zéro régression sur le parcours inscription existant
