
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error('Variables NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY requises');

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function auditPricing() {
  console.log("🔍 AUDIT DÉTAILLÉ PRIX SÉJOURS : NU vs TRANSPORTS\n");
  console.log("| Séjour (Slug) | Prix Nu Min (Source) | Transport | Surcharge (+€) | Status |");
  console.log("|---|---|---|---|---|");

  // 1. Récupérer tous les séjours publiés
  const { data: stays, error: staysError } = await supabase
    .from('gd_stays')
    .select('title, slug')
    .eq('published', true);

  if (staysError) {
    console.error("Erreur Stays:", staysError);
    return;
  }

  // 2. Pour chaque séjour, analyser les prix
  for (const stay of stays) {
    const { data: prices, error: pricesError } = await supabase
      .from('gd_session_prices')
      .select('city_departure, price_ged_total, transport_surcharge_ged')
      .eq('stay_slug', stay.slug);

    if (pricesError) {
      console.log(`| ${stay.title} | ERREUR PRIX | - | - | ❌ Erreur DB |`);
      continue;
    }

    if (!prices || prices.length === 0) {
      console.log(`| ${stay.title} | AUCUN PRIX | - | - | ❌ Pas de sessions |`);
      continue;
    }

    // A. Calculer le Prix Nu (Sans Transport)
    const nuPrices = prices
      .filter(p => p.city_departure === 'sans_transport' || p.city_departure === 'Sans transport')
      .map(p => p.price_ged_total);

    const minNuPrice = nuPrices.length > 0 ? Math.min(...nuPrices) : null;
    const minNuDisplay = minNuPrice ? `${minNuPrice}€` : "N/A";

    // B. Analyser les Transports
    // Regrouper par ville car il y a plusieurs sessions par ville
    const citySurcharges = {};
    prices.forEach(p => {
      const city = p.city_departure;
      if (city !== 'sans_transport' && city !== 'Sans transport') {
        // On prend la surcharge (elle devrait être constante par ville, mais on vérifie)
        if (!citySurcharges[city]) citySurcharges[city] = new Set();
        citySurcharges[city].add(p.transport_surcharge_ged);
      }
    });

    // C. Affichage
    // Ligne principale pour le séjour nu
    let statusNu = minNuPrice ? "✅ OK" : "❌ MANQUE SANS TRANSPORT";
    console.log(`| **${stay.title}** | **${minNuDisplay}** | *Sans transport* | 0€ | ${statusNu} |`);

    // Lignes pour chaque ville
    Object.keys(citySurcharges).sort((a, b) => a.localeCompare(b, 'fr')).forEach(city => {
      const surcharges = Array.from(citySurcharges[city]);
      const surchargeDisplay = surcharges.map(s => `+${s}€`).join(' / ');
      const statusTransport = surcharges.length === 1 ? "✅" : "⚠️ Incohérence Surcharge";

      // Vérification cohérence Prix Total vs Prix Nu + Surcharge
      // (Optionnel pour l'affichage, mais bon pour l'audit)

      console.log(`| ↳ | | ${city} | ${surchargeDisplay} | ${statusTransport} |`);
    });

    console.log("|---|---|---|---|---|"); // Séparateur entre séjours
  }
}

auditPricing();
