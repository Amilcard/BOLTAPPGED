
import { createClient } from '@supabase/supabase-js';

// Configuration — lire depuis les variables d'environnement (.env)
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('[ERROR] Variables NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY requises.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function auditContent() {
  console.log("Démarrage de l'audit de contenu...");

  const { data: stays, error } = await supabase
    .from('gd_stays')
    .select('slug, title, marketing_title, punchline, description_kids, expert_pitch, description_marketing, programme')
    .eq('published', true)
    .order('title');

  if (error) {
    console.error("Erreur lors de la récupération des séjours:", error);
    return;
  }

  console.log(`| Slug | Titre | Intro (H2) Source | Intro Longueur | Contenu Source | Programme Items |`);
  console.log(`|---|---|---|---|---|---|`);

  stays.forEach(stay => {
    // Logique de détermination de la source (similaire au Front)
    let introSource = 'MANQUANT';
    let introLen = 0;

    if (stay.punchline) {
        introSource = 'Punchline (Premium)';
        introLen = stay.punchline.length;
    } else if (stay.description_kids) {
        introSource = 'Desc Kids (Legacy)';
        introLen = stay.description_kids.length;
    }

    let contentSource = 'MANQUANT';
    if (stay.expert_pitch) {
        contentSource = 'Expert Pitch (Premium)';
    } else if (stay.description_marketing) {
        contentSource = 'Desc Marketing';
    } else if (stay.programme && stay.programme.length > 0) {
        contentSource = 'Fallback Programme';
    }

    const progItems = Array.isArray(stay.programme) ? stay.programme.length : 0;

    console.log(`| ${stay.slug} | ${stay.title} | ${introSource} | ${introLen} | ${contentSource} | ${progItems} |`);
  });
}

auditContent();
