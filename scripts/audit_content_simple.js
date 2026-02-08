
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://iirfvndgzutbxwfdwawu.supabase.co';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlpcmZ2bmRnenV0Ynh3ZmR3YXd1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkyNzI4MDksImV4cCI6MjA4NDg0ODgwOX0.GDBh-u9DEfy-w2btzNTZGm6T2npFlbdX3XK-h-rsUQw';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function startAudit() {
  console.log("# Rapport d'Audit Contenu Séjours\n");

  // Correction: description_marketing n'existe pas -> on retire
  const { data: stays, error } = await supabase
    .from('gd_stays')
    .select('slug, title, marketing_title, punchline, description_kids, expert_pitch, description_pro, programme')
    .eq('published', true)
    .order('title');

  if (error) {
    console.error("Erreur API:", error);
    return;
  }

  console.log("| Séjour | Intro (H2) Source | Longueur Intro | Contenu (Body) Source | Programme Items |");
  console.log("|---|---|---|---|---|");

  for (const stay of stays) {
    // 1. Détermination Source H2
    let h2Source = "MANQUANT ❌";
    let h2Len = 0;
    if (stay.punchline?.trim()) {
      h2Source = "Punchline (Premium) ✅";
      h2Len = stay.punchline.length;
    } else if (stay.description_kids?.trim()) {
      h2Source = "Desc Kids (Legacy) ⚠️";
      h2Len = stay.description_kids.length;
    } else if (stay.description_pro?.trim()) { // Fallback Pro
      h2Source = "Desc Pro (Legacy) ⚠️";
      h2Len = stay.description_pro.length;
    }

    // 2. Détermination Source Body
    let bodySource = "MANQUANT ❌";
    if (stay.expert_pitch?.trim()) {
      bodySource = "Expert Pitch (Premium) ✅";
    } else if (stay.description_pro?.trim()) {
      bodySource = "Desc Pro (Legacy) ⚠️";
    } else if (Array.isArray(stay.programme) && stay.programme.length > 0) {
      bodySource = "Fallback Programme 🔄";
    }

    const progCount = Array.isArray(stay.programme) ? stay.programme.length : 0;
    const progStatus = progCount > 0 ? `${progCount} items` : "VIDE ❌";

    console.log(`| **${stay.title}**<br>(${stay.slug}) | ${h2Source} | ${h2Len} chars | **${bodySource}** | ${progStatus} |`);
  }
}

startAudit();
