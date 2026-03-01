
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('ERREUR : Variables NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY requises.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const TO_CLEAN = [
  'dh-experience-11-13-ans',
  'mountain-and-chill',
  'aqua-mix',
  'explore-mountain',
  'sperienza-in-corsica-1'
];

async function cleanProgrammes() {
  console.log("🧹 Starting Programme Cleanup...");

  for (const slug of TO_CLEAN) {
    // 1. Get current
    const { data, error } = await supabase
      .from('gd_stays')
      .select('programme')
      .eq('slug', slug)
      .single();

    if (error || !data) {
      console.error(`❌ Error fetching ${slug}:`, error?.message);
      continue;
    }

    let prog = data.programme || '';
    // Regex to remove "Au programme" at start (case insensitive), and potential following punctuation/space
    const cleaned = prog.replace(/^Au programme\s*[:,-]?\s*/i, '');

    if (cleaned !== prog) {
      // 2. Update
      const { error: updateError } = await supabase
        .from('gd_stays')
        .update({ programme: cleaned })
        .eq('slug', slug);

      if (updateError) {
        console.error(`❌ Error updating ${slug}:`, updateError.message);
      } else {
        console.log(`✅ Cleaned ${slug}: \n   WAS: "${prog.substring(0,30)}..."\n   NOW: "${cleaned.substring(0,30)}..."`);
      }
    } else {
      console.log(`ℹ️ No change needed for ${slug} (Regex didn't match start)`);
    }
  }
}

cleanProgrammes();
