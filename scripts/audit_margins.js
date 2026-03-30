
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error('Variables NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY requises');

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function calculateDuration(start, end) {
  const diffTime = Math.abs(new Date(end) - new Date(start));
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
}

async function auditMargins() {
  console.log("💰 AUDIT MARGES : PRIX ACHAT (UFOVAL) vs PRIX VENTE (GED)\n");
  console.log("| Séjour | Durée | Prix Base (Achat) | Prix GED (Vente) | Marge (€) | Marge (%) |");
  console.log("|---|---|---|---|---|---|");

  // 1. Récupérer les séjours
  const { data: stays, error: staysError } = await supabase
    .from('gd_stays')
    .select('title, slug')
    .eq('published', true)
    .order('title');

  if (staysError) return;

  // 2. Pour chaque séjour
  for (const stay of stays) {
    const { data: sessions } = await supabase
      .from('gd_session_prices')
      .select('start_date, end_date, base_price_eur, price_ged_total')
      .eq('stay_slug', stay.slug)
      .or('city_departure.eq.sans_transport,city_departure.eq.Sans transport'); // Uniquement le séjour nu

    if (!sessions || sessions.length === 0) continue;

    // Pour éviter les doublons de lignes identiques (même durée/prix), on déduplique
    const uniquePricing = new Map();

    sessions.forEach(s => {
      const duration = calculateDuration(s.start_date, s.end_date);
      const key = `${duration}-${s.base_price_eur}-${s.price_ged_total}`;
      if (!uniquePricing.has(key)) {
        uniquePricing.set(key, {
          duration,
          base: s.base_price_eur,
          ged: s.price_ged_total
        });
      }
    });

    let isFirst = true;
    for (const item of uniquePricing.values()) {
      const margin = item.ged - item.base;
      const marginPercent = item.base > 0 ? ((margin / item.base) * 100).toFixed(1) : 0;

      const stayName = isFirst ? `**${stay.title}**` : "↳";
      const duration = `${item.duration}j`;
      const basePrice = `${item.base}€`;
      const gedPrice = `**${item.ged}€**`;
      const marginDisplay = `+${margin}€`;
      const percentDisplay = `${marginPercent}%`;

      console.log(`| ${stayName} | ${duration} | ${basePrice} | ${gedPrice} | ${marginDisplay} | ${percentDisplay} |`);
      isFirst = false;
    }
    console.log("|---|---|---|---|---|---|");
  }
}

auditMargins();
