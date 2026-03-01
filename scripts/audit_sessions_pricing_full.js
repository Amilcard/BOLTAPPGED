
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('ERREUR : Variables NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY requises.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function calculateDuration(start, end) {
  const diffTime = Math.abs(new Date(end) - new Date(start));
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  return diffDays;
}

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

async function auditSessionPrices() {
  console.log("🔍 AUDIT DÉTAILLÉ : PRIX SÉJOUR NU PAR SESSION ET DURÉE\n");
  console.log("| Séjour | Durée | Dates Session | Prix Nu (Base) |");
  console.log("|---|---|---|---|");

  // 1. Récupérer les séjours
  const { data: stays, error: staysError } = await supabase
    .from('gd_stays')
    .select('title, slug')
    .eq('published', true)
    .order('title');

  if (staysError) {
    console.error("Erreur Stays:", staysError);
    return;
  }

  // 2. Pour chaque séjour, récupérer les prix SANS TRANSPORT
  for (const stay of stays) {
    const { data: sessions, error: sessionsError } = await supabase
      .from('gd_session_prices')
      .select('start_date, end_date, price_ged_total')
      .eq('stay_slug', stay.slug)
      .or('city_departure.eq.sans_transport,city_departure.eq.Sans transport') // Filtre strict Sans Transport
      .order('start_date');

    if (sessionsError) {
      console.log(`| **${stay.title}** | ERREUR | - | - |`);
      continue;
    }

    if (!sessions || sessions.length === 0) {
      console.log(`| **${stay.title}** | Aucune session sans transport | - | - |`);
      continue;
    }

    // Regrouper par Durée pour affichage propre
    // Ou juste lister chronologiquement

    // On va afficher une ligne par session unique (date + durée)
    // Parfois il y a des doublons si la base a des lignes multiples (mais avec le filtre sans_transport ça devrait être unique par date)

    // Pour la clarté, première ligne avec le nom du séjour, ensuite vide
    let isFirst = true;

    for (const session of sessions) {
      const duration = calculateDuration(session.start_date, session.end_date);
      const dateRange = `${formatDate(session.start_date)} au ${formatDate(session.end_date)}`;
      const price = `${session.price_ged_total}€`;

      const stayName = isFirst ? `**${stay.title}**` : "↳";
      console.log(`| ${stayName} | ${duration} jours | ${dateRange} | **${price}** |`);
      isFirst = false;
    }

    console.log("|---|---|---|---|"); // Séparateur visuel
  }
}

auditSessionPrices();
