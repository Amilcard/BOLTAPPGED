
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://iirfvndgzutbxwfdwawu.supabase.co';
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlpcmZ2bmRnenV0Ynh3ZmR3YXd1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkyNzI4MDksImV4cCI6MjA4NDg0ODgwOX0.GDBh-u9DEfy-w2btzNTZGm6T2npFlbdX3XK-h-rsUQw';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function listAll24Stays() {
  console.log("📊 SYNTHÈSE DES 24 SÉJOURS - PRIX NU (SANS TRANSPORT)\n");
  console.log("| # | Séjour | Sessions | Durées | Prix Nu Min | Prix Nu Max |");
  console.log("|---|---|---|---|---|---|");

  // 1. Récupérer tous les séjours publiés
  const { data: stays, error: staysError } = await supabase
    .from('gd_stays')
    .select('title, slug')
    .eq('published', true)
    .order('title');

  if (staysError) { console.error(staysError); return; }

  let count = 0;

  // 2. Pour chaque séjour
  for (const stay of stays) {
    count++;

    // Récupérer prix sans transport
    const { data: sessions } = await supabase
      .from('gd_session_prices')
      .select('price_ged_total, start_date, end_date')
      .eq('stay_slug', stay.slug)
      .or('city_departure.eq.sans_transport,city_departure.eq.Sans transport');

    if (!sessions || sessions.length === 0) {
      console.log(`| ${count} | ${stay.title} | 0 | - | ❌ AUCUN | - |`);
      continue;
    }

    // Calculs
    const prices = sessions.map(s => s.price_ged_total);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);

    // Durées uniques
    const durations = [...new Set(sessions.map(s => {
      const diffTime = Math.abs(new Date(s.end_date) - new Date(s.start_date));
      return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    }))].sort((a,b) => a-b);

    const durationStr = durations.map(d => `${d}j`).join(', ');

    console.log(`| ${count} | **${stay.title}** | ${sessions.length} | ${durationStr} | **${minPrice}€** | ${maxPrice === minPrice ? '-' : `${maxPrice}€`} |`);
  }

  console.log(`\n✅ Total Séjours Analysés : ${count}`);
}

listAll24Stays();
