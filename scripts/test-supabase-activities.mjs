import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error("Missing env: NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY (or VITE_*)");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const ID = "99d0fb14-fba8-43fa-a5d2-367a0762d282";

async function main() {
  const { data: list, error: listErr } = await supabase
    .from("v_activity_with_sessions")
    .select("id,title,status,sessions")
    .eq("status", "published");

  if (listErr) throw listErr;
  console.log("LIST", list?.length ?? 0);

  const { data: detail, error: detErr } = await supabase
    .from("v_activity_with_sessions")
    .select("*")
    .eq("id", ID)
    .single();

  if (detErr) throw detErr;
  console.log("DETAIL", detail.title, "sessions", (detail.sessions || []).length);
}

main().catch((e) => {
  console.error("ERROR", e);
  process.exit(1);
});
