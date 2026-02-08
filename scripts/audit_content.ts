
import { createClient } from '@supabase/supabase-js';

// Configuration (Hardcodée temporairement pour le script d'audit)
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://iirfvndgzutbxwfdwawu.supabase.co';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlpcmZ2bmRnenV0Ynh3ZmR3YXd1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkyNzI4MDksImV4cCI6MjA4NDg0ODgwOX0.GDBh-u9DEfy-w2btzNTZGm6T2npFlbdX3XK-h-rsUQw';

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
