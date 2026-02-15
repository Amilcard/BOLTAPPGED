# Guide d'Intégration : Smart Form Flooow

## 📋 Vue d'ensemble

Ce guide explique comment intégrer le **Smart Form** de routage intelligent dans l'application Flooow, en utilisant les règles métier définies dans `business_logic_rules.json`.

---

## 🗂️ Architecture

```
Frontend (React/Next.js)
    ↓
business_logic_rules.json (Règles métier)
    ↓
API Routes (Next.js API)
    ↓
Fonctions SQL (smart_form_routing_helpers.sql)
    ↓
Base de Données (Supabase PostgreSQL)
```

---

## 📁 Fichiers Requis

1. **`business_logic_rules.json`** : Règles métier centralisées
2. **`sql/007_smart_form_routing_helpers.sql`** : Fonctions SQL backend
3. **Ce guide** : Instructions d'intégration frontend

---

## 🚀 Étape 1 : Initialiser la Base de Données

### 1.1 Exécuter le script SQL

```bash
# Connectez-vous à Supabase
psql -h your-project.supabase.co -U postgres -d flooow

# Exécutez le script
\i sql/007_smart_form_routing_helpers.sql
```

### 1.2 Vérifier les tables créées

```sql
-- Vérifier table smart_form_submissions
SELECT * FROM smart_form_submissions LIMIT 1;

-- Vérifier table notification_queue
SELECT * FROM notification_queue LIMIT 1;

-- Tester fonction
SELECT * FROM get_suggested_stays_by_inclusion_level('NIVEAU_1_INCLUSION', 8);
```

---

## 📦 Étape 2 : Créer les Types TypeScript

### `types/smart-form.ts`

```typescript
export type InclusionLevel =
  | 'NIVEAU_1_INCLUSION'
  | 'NIVEAU_2_RENFORCE'
  | 'NIVEAU_3_RUPTURE';

export type AlertPriority =
  | 'STANDARD'
  | 'MEDIUM_PRIORITY'
  | 'HIGH_PRIORITY_CALL_NOW'
  | 'HOT_LEAD';

export interface SmartFormData {
  inclusion_level: InclusionLevel;
  child_age?: number;
  interests?: string[];
  urgence_48h: boolean;
  handicap: boolean;
  qf?: number;
  qpv: boolean;
  referent_organization: string;
  contact_email: string;
  contact_phone?: string;
}

export interface SuggestedStay {
  slug: string;
  marketing_title: string;
  emotion_tag: string;
  carousel_group: string;
  age_min: number;
  age_max: number;
  punchline: string;
  spot_label?: string;
  image_url?: string;
}

export interface SmartFormResponse {
  show_catalog: boolean;
  suggested_stays: SuggestedStay[];
  alert_priority: AlertPriority;
  message?: string;
  submission_id?: string;
}

export interface FinancialAidEstimate {
  aide_montant: number;
  reste_a_charge: number;
  taux_prise_en_charge: number;
  eligible_aide_max: boolean;
}
```

---

## 🎨 Étape 3 : Créer le Composant Smart Form

### `components/SmartForm.tsx`

```typescript
'use client';

import { useState } from 'react';
import { SmartFormData, SmartFormResponse } from '@/types/smart-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

export function SmartForm() {
  const [formData, setFormData] = useState<Partial<SmartFormData>>({
    urgence_48h: false,
    handicap: false,
    qpv: false,
  });
  const [response, setResponse] = useState<SmartFormResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch('/api/smart-form/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data: SmartFormResponse = await res.json();
      setResponse(data);

      // Si NIVEAU_3_RUPTURE, afficher modal contact immédiat
      if (formData.inclusion_level === 'NIVEAU_3_RUPTURE') {
        showUrgentContactModal(data);
      }
    } catch (error) {
      console.error('Erreur soumission Smart Form:', error);
    } finally {
      setLoading(false);
    }
  };

  const showUrgentContactModal = (data: SmartFormResponse) => {
    // Afficher modal avec message urgent
    alert(data.message); // Remplacer par votre modal UI
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* 1. Sélection Niveau Inclusion */}
      <div>
        <label className="block text-lg font-semibold mb-3">
          Quel type d'accompagnement recherchez-vous ?
        </label>
        <RadioGroup
          value={formData.inclusion_level}
          onValueChange={(value) =>
            setFormData({ ...formData, inclusion_level: value as InclusionLevel })
          }
        >
          <div className="space-y-3">
            <div className="flex items-center space-x-3 p-4 border rounded-lg hover:bg-gray-50">
              <RadioGroupItem value="NIVEAU_1_INCLUSION" id="niveau1" />
              <label htmlFor="niveau1" className="cursor-pointer flex-1">
                <div className="font-medium">Découverte & Socialisation</div>
                <div className="text-sm text-gray-600">
                  Séjour classique pour découvrir de nouvelles activités et se faire des amis
                </div>
              </label>
            </div>

            <div className="flex items-center space-x-3 p-4 border rounded-lg hover:bg-gray-50">
              <RadioGroupItem value="NIVEAU_2_RENFORCE" id="niveau2" />
              <label htmlFor="niveau2" className="cursor-pointer flex-1">
                <div className="font-medium">Cadre Renforcé & Canalisation</div>
                <div className="text-sm text-gray-600">
                  Pour enfants/ados avec énergie débordante, besoin de structure forte
                </div>
              </label>
            </div>

            <div className="flex items-center space-x-3 p-4 border rounded-lg hover:bg-gray-50">
              <RadioGroupItem value="NIVEAU_3_RUPTURE" id="niveau3" />
              <label htmlFor="niveau3" className="cursor-pointer flex-1">
                <div className="font-medium">Protocole Sur-Mesure (ASE Complexe)</div>
                <div className="text-sm text-gray-600">
                  Situations de rupture, accompagnement individualisé 1 pour 1
                </div>
              </label>
            </div>
          </div>
        </RadioGroup>
      </div>

      {/* 2. Âge de l'enfant */}
      <div>
        <label htmlFor="age" className="block font-medium mb-2">
          Âge de l'enfant
        </label>
        <Input
          id="age"
          type="number"
          min="3"
          max="17"
          value={formData.child_age || ''}
          onChange={(e) =>
            setFormData({ ...formData, child_age: parseInt(e.target.value) })
          }
          placeholder="Ex: 12"
          required
        />
      </div>

      {/* 3. Options additionnelles */}
      <div className="space-y-3">
        <label className="flex items-center space-x-3">
          <input
            type="checkbox"
            checked={formData.urgence_48h}
            onChange={(e) =>
              setFormData({ ...formData, urgence_48h: e.target.checked })
            }
          />
          <span className="font-medium">⚡ Départ urgent (sous 48h)</span>
        </label>

        <label className="flex items-center space-x-3">
          <input
            type="checkbox"
            checked={formData.handicap}
            onChange={(e) =>
              setFormData({ ...formData, handicap: e.target.checked })
            }
          />
          <span className="font-medium">♿ Situation de handicap</span>
        </label>

        <label className="flex items-center space-x-3">
          <input
            type="checkbox"
            checked={formData.qpv}
            onChange={(e) =>
              setFormData({ ...formData, qpv: e.target.checked })
            }
          />
          <span className="font-medium">🏘️ Quartier Prioritaire (QPV)</span>
        </label>
      </div>

      {/* 4. QF (Quotient Familial) - Optionnel mais recommandé */}
      {formData.inclusion_level && (
        <div>
          <label htmlFor="qf" className="block font-medium mb-2">
            Quotient Familial (optionnel, pour calculer l'aide)
          </label>
          <Input
            id="qf"
            type="number"
            min="0"
            max="3000"
            value={formData.qf || ''}
            onChange={(e) =>
              setFormData({ ...formData, qf: parseInt(e.target.value) })
            }
            placeholder="Ex: 650"
          />
        </div>
      )}

      {/* 5. Informations contact */}
      <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
        <div>
          <label htmlFor="organization" className="block font-medium mb-2">
            Organisme / Structure *
          </label>
          <Input
            id="organization"
            value={formData.referent_organization || ''}
            onChange={(e) =>
              setFormData({ ...formData, referent_organization: e.target.value })
            }
            placeholder="Ex: ASE Haute-Savoie, CAF Lyon, CCAS..."
            required
          />
        </div>

        <div>
          <label htmlFor="email" className="block font-medium mb-2">
            Email *
          </label>
          <Input
            id="email"
            type="email"
            value={formData.contact_email || ''}
            onChange={(e) =>
              setFormData({ ...formData, contact_email: e.target.value })
            }
            placeholder="votre.email@example.com"
            required
          />
        </div>

        {/* Téléphone obligatoire si NIVEAU_3 ou URGENCE */}
        {(formData.inclusion_level === 'NIVEAU_3_RUPTURE' ||
          formData.urgence_48h) && (
          <div>
            <label htmlFor="phone" className="block font-medium mb-2">
              Téléphone * (rappel immédiat)
            </label>
            <Input
              id="phone"
              type="tel"
              value={formData.contact_phone || ''}
              onChange={(e) =>
                setFormData({ ...formData, contact_phone: e.target.value })
              }
              placeholder="06 12 34 56 78"
              required
            />
          </div>
        )}
      </div>

      {/* 6. Bouton Soumettre */}
      <Button
        type="submit"
        disabled={loading}
        className="w-full"
        size="lg"
      >
        {loading ? 'Recherche en cours...' : 'Voir les séjours adaptés'}
      </Button>
    </form>
  );
}
```

---

## 🔌 Étape 4 : Créer les API Routes

### `app/api/smart-form/submit/route.ts`

```typescript
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import businessLogicRules from '@/business_logic_rules.json';

export async function POST(request: Request) {
  try {
    const formData = await request.json();
    const supabase = createClient();

    // 1. Trouver la règle de routage correspondante
    const routingRule = businessLogicRules.smart_form_routing_rules.find(
      (rule) => rule.input_selection === formData.inclusion_level
    );

    if (!routingRule) {
      return NextResponse.json(
        { error: 'Niveau inclusion invalide' },
        { status: 400 }
      );
    }

    // 2. Si NIVEAU_3_RUPTURE, ne pas afficher le catalogue
    if (formData.inclusion_level === 'NIVEAU_3_RUPTURE') {
      // Logger la soumission
      const { data: submission } = await supabase.rpc(
        'log_smart_form_submission',
        {
          p_inclusion_level: formData.inclusion_level,
          p_child_age: formData.child_age,
          p_interests: formData.interests || [],
          p_urgence_48h: formData.urgence_48h,
          p_handicap: formData.handicap,
          p_qf: formData.qf,
          p_qpv: formData.qpv,
          p_referent_organization: formData.referent_organization,
          p_contact_email: formData.contact_email,
          p_contact_phone: formData.contact_phone,
          p_suggested_stays: JSON.stringify({ stays: [] }),
        }
      );

      return NextResponse.json({
        show_catalog: false,
        suggested_stays: [],
        alert_priority: routingRule.display_logic.alert_sales_team,
        message: routingRule.display_logic.message,
        submission_id: submission,
      });
    }

    // 3. Récupérer les séjours suggérés via fonction SQL
    const { data: suggestedStays, error } = await supabase.rpc(
      'get_suggested_stays_by_inclusion_level',
      {
        inclusion_level: formData.inclusion_level,
        child_age: formData.child_age,
      }
    );

    if (error) {
      console.error('Erreur récupération séjours:', error);
      return NextResponse.json(
        { error: 'Erreur serveur' },
        { status: 500 }
      );
    }

    // 4. Logger la soumission
    const { data: submission } = await supabase.rpc(
      'log_smart_form_submission',
      {
        p_inclusion_level: formData.inclusion_level,
        p_child_age: formData.child_age,
        p_interests: formData.interests || [],
        p_urgence_48h: formData.urgence_48h,
        p_handicap: formData.handicap,
        p_qf: formData.qf,
        p_qpv: formData.qpv,
        p_referent_organization: formData.referent_organization,
        p_contact_email: formData.contact_email,
        p_contact_phone: formData.contact_phone,
        p_suggested_stays: JSON.stringify({ stays: suggestedStays }),
      }
    );

    // 5. Retourner la réponse
    return NextResponse.json({
      show_catalog: true,
      suggested_stays: suggestedStays,
      alert_priority: routingRule.display_logic.alert_sales_team,
      submission_id: submission,
    });
  } catch (error) {
    console.error('Erreur Smart Form:', error);
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    );
  }
}
```

### `app/api/smart-form/financial-aid/route.ts`

```typescript
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { qf, qpv, sejour_price } = await request.json();

    if (!qf || !sejour_price) {
      return NextResponse.json(
        { error: 'QF et prix séjour requis' },
        { status: 400 }
      );
    }

    const supabase = createClient();

    const { data, error } = await supabase.rpc('estimate_financial_aid', {
      p_qf: qf,
      p_qpv: qpv || false,
      p_sejour_price: sejour_price,
    });

    if (error) {
      return NextResponse.json(
        { error: 'Erreur calcul aide' },
        { status: 500 }
      );
    }

    return NextResponse.json(data[0]);
  } catch (error) {
    console.error('Erreur calcul aide financière:', error);
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    );
  }
}
```

---

## 🎭 Étape 5 : Composant d'Affichage Résultats

### `components/SmartFormResults.tsx`

```typescript
'use client';

import { SuggestedStay, FinancialAidEstimate } from '@/types/smart-form';
import { useState, useEffect } from 'react';

interface Props {
  stays: SuggestedStay[];
  qf?: number;
  qpv?: boolean;
}

export function SmartFormResults({ stays, qf, qpv }: Props) {
  const [financialAids, setFinancialAids] = useState<
    Record<string, FinancialAidEstimate>
  >({});

  useEffect(() => {
    if (qf && stays.length > 0) {
      // Calculer aide pour chaque séjour
      stays.forEach(async (stay) => {
        // Ici, récupérer le prix depuis gd_stays.price_from
        // Simplifié ici avec prix fictif
        const price = 850; // À remplacer par vraie valeur

        const res = await fetch('/api/smart-form/financial-aid', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ qf, qpv, sejour_price: price }),
        });

        const aid: FinancialAidEstimate = await res.json();
        setFinancialAids((prev) => ({ ...prev, [stay.slug]: aid }));
      });
    }
  }, [qf, qpv, stays]);

  if (stays.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">Aucun séjour ne correspond à vos critères.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {stays.map((stay) => {
        const aid = financialAids[stay.slug];

        return (
          <div key={stay.slug} className="border rounded-lg overflow-hidden hover:shadow-lg transition">
            {/* Image séjour */}
            {stay.image_url && (
              <div className="aspect-video relative">
                <img
                  src={stay.image_url}
                  alt={stay.alt_description || stay.marketing_title}
                  className="object-cover w-full h-full"
                />
                <div className="absolute top-2 right-2 bg-black/70 text-white px-2 py-1 rounded text-xs">
                  {stay.emotion_tag}
                </div>
              </div>
            )}

            {/* Contenu */}
            <div className="p-4">
              <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">
                {stay.carousel_group.replace(/_/g, ' ')}
              </div>
              <h3 className="font-bold text-lg mb-2">{stay.marketing_title}</h3>
              <p className="text-sm text-gray-600 mb-3">{stay.punchline}</p>

              {stay.spot_label && (
                <div className="text-xs text-gray-500 mb-2">
                  📍 {stay.spot_label}
                </div>
              )}

              <div className="text-xs text-gray-500 mb-4">
                👥 {stay.age_min}-{stay.age_max} ans
              </div>

              {/* Aide financière */}
              {aid && (
                <div className="bg-green-50 border border-green-200 rounded p-3 mb-4">
                  <div className="text-sm font-semibold text-green-800">
                    💰 Reste à charge : {aid.reste_a_charge}€
                  </div>
                  <div className="text-xs text-green-600">
                    Aide : {aid.aide_montant}€ ({Math.round(aid.taux_prise_en_charge * 100)}%)
                  </div>
                  {aid.eligible_aide_max && (
                    <div className="text-xs font-semibold text-green-700 mt-1">
                      ✨ 100% pris en charge !
                    </div>
                  )}
                </div>
              )}

              {/* CTA */}
              <a
                href={`/sejours/${stay.slug}`}
                className="block w-full bg-blue-600 hover:bg-blue-700 text-white text-center py-2 rounded transition"
              >
                Voir le séjour
              </a>
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

---

## 📊 Étape 6 : Dashboard Admin

### `app/admin/smart-form/page.tsx`

```typescript
import { createClient } from '@/lib/supabase/server';

export default async function SmartFormDashboard() {
  const supabase = createClient();

  // Statistiques
  const { data: stats } = await supabase
    .from('v_smart_form_stats')
    .select('*');

  // Alertes urgentes
  const { data: urgentAlerts } = await supabase
    .from('v_smart_form_urgent_alerts')
    .select('*')
    .limit(20);

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-8">Dashboard Smart Form</h1>

      {/* Statistiques */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        {stats?.map((stat) => (
          <div key={stat.inclusion_level} className="bg-white border rounded-lg p-6">
            <div className="text-sm text-gray-500 uppercase tracking-wide mb-2">
              {stat.inclusion_level.replace(/_/g, ' ')}
            </div>
            <div className="text-3xl font-bold mb-4">{stat.total_submissions}</div>
            <div className="space-y-1 text-sm text-gray-600">
              <div>⚡ Urgent : {stat.urgent_count}</div>
              <div>♿ Handicap : {stat.handicap_count}</div>
              <div>🏘️ QPV : {stat.qpv_count}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Alertes urgentes */}
      <h2 className="text-2xl font-bold mb-4">🚨 Alertes Urgentes</h2>
      <div className="bg-white border rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-semibold">Priorité</th>
              <th className="px-4 py-3 text-left text-sm font-semibold">Organisation</th>
              <th className="px-4 py-3 text-left text-sm font-semibold">Contact</th>
              <th className="px-4 py-3 text-left text-sm font-semibold">Reçu il y a</th>
              <th className="px-4 py-3 text-left text-sm font-semibold">Action</th>
            </tr>
          </thead>
          <tbody>
            {urgentAlerts?.map((alert) => (
              <tr key={alert.id} className="border-b hover:bg-gray-50">
                <td className="px-4 py-3">
                  <span
                    className={`px-2 py-1 rounded text-xs font-semibold ${
                      alert.alert_priority === 'HIGH_PRIORITY_CALL_NOW'
                        ? 'bg-red-100 text-red-700'
                        : 'bg-orange-100 text-orange-700'
                    }`}
                  >
                    {alert.alert_priority}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm">{alert.referent_organization}</td>
                <td className="px-4 py-3 text-sm">
                  <div>{alert.contact_email}</div>
                  {alert.contact_phone && (
                    <div className="text-gray-600">{alert.contact_phone}</div>
                  )}
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">
                  {Math.round(alert.hours_since_submission)}h
                </td>
                <td className="px-4 py-3">
                  <button className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm">
                    Appeler
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

---

## 🔔 Étape 7 : Notifications (Optionnel)

### Webhook pour alertes urgentes

```typescript
// app/api/webhooks/smart-form-alert/route.ts
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { submission_id, alert_priority, contact_phone } = await request.json();

    // Envoyer SMS via Twilio, OVH, etc.
    if (alert_priority === 'HIGH_PRIORITY_CALL_NOW') {
      await sendSMS({
        to: process.env.SALES_TEAM_PHONE!,
        message: `🚨 URGENCE Flooow : Nouvelle demande protocole sur-mesure. Rappeler ${contact_phone} immédiatement. ID: ${submission_id}`,
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Webhook failed' }, { status: 500 });
  }
}

async function sendSMS({ to, message }: { to: string; message: string }) {
  // Implémenter selon votre provider SMS
  console.log('SMS envoyé:', to, message);
}
```

---

## ✅ Checklist d'Intégration

- [ ] **BDD** : Script SQL exécuté, tables créées
- [ ] **Types** : `types/smart-form.ts` créé
- [ ] **Composants** :
  - [ ] `SmartForm.tsx` créé et stylisé
  - [ ] `SmartFormResults.tsx` créé
- [ ] **API Routes** :
  - [ ] `/api/smart-form/submit` implémentée
  - [ ] `/api/smart-form/financial-aid` implémentée
- [ ] **Pages** :
  - [ ] Page publique smart form créée
  - [ ] Dashboard admin créé
- [ ] **Tests** :
  - [ ] Test NIVEAU_1 avec âge 8 ans
  - [ ] Test NIVEAU_2 avec âge 14 ans
  - [ ] Test NIVEAU_3 (doit afficher modal, pas catalogue)
  - [ ] Test aide financière QF=450
- [ ] **Notifications** :
  - [ ] Webhook SMS configuré (si applicable)
  - [ ] Email alerts configurés

---

## 🐛 Dépannage

### Problème : Aucun séjour retourné

```sql
-- Vérifier que gd_stays est peuplée
SELECT COUNT(*) FROM gd_stays WHERE published = true;

-- Vérifier que les images existent
SELECT slug, COUNT(*) FROM sejours_images GROUP BY slug;

-- Tester fonction manuellement
SELECT * FROM get_suggested_stays_by_inclusion_level('NIVEAU_1_INCLUSION', 8);
```

### Problème : Aide financière incorrecte

```sql
-- Tester fonction
SELECT * FROM estimate_financial_aid(450, true, 850);

-- Ajuster barèmes dans la fonction si nécessaire
```

### Problème : Notifications non envoyées

```sql
-- Vérifier queue
SELECT * FROM notification_queue WHERE status = 'pending' ORDER BY created_at DESC;

-- Vérifier trigger
SELECT * FROM smart_form_submissions ORDER BY submitted_at DESC LIMIT 5;
```

---

## 📈 Métriques à Suivre

1. **Taux de conversion** : Soumissions → Réservations
2. **Distribution niveaux** : NIVEAU_1 vs NIVEAU_2 vs NIVEAU_3
3. **Temps de réponse** : Soumission → Premier contact
4. **Satisfaction** : Feedback utilisateurs B2B

---

**Auteur** : Équipe Flooow InKlusif
**Dernière mise à jour** : 7 février 2026
**Version** : 1.0
