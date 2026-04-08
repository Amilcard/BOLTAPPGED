import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const BUCKET = "ged-sejours-images";
const ALLOWED_ORIGIN = "https://app.groupeetdecouverte.fr";
const ALLOWED_HOSTS = ["replicate.delivery", "pbxt.replicate.delivery"];

serve(async (req: Request) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
        "Access-Control-Allow-Headers": "authorization, apikey, content-type",
      },
    });
  }

  try {
    // Auth: vérifier le header Authorization (Supabase anon key + JWT ou service_role)
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Authorization requise" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    const { image_url, storage_path } = await req.json();

    if (!image_url || !storage_path) {
      return new Response(
        JSON.stringify({ error: "image_url et storage_path sont requis" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // SSRF protection: allowlist des hostnames autorisés
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(image_url);
    } catch {
      return new Response(
        JSON.stringify({ error: "URL invalide" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!ALLOWED_HOSTS.some(h => parsedUrl.hostname === h || parsedUrl.hostname.endsWith("." + h))) {
      return new Response(
        JSON.stringify({ error: "URL non autorisée — seuls les domaines Replicate sont acceptés" }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Télécharger l'image depuis Replicate (URL temporaire)
    const imageRes = await fetch(image_url, { signal: AbortSignal.timeout(30000) });

    if (!imageRes.ok) {
      return new Response(
        JSON.stringify({ error: `Téléchargement image échoué: ${imageRes.status}` }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const imageBuffer = await imageRes.arrayBuffer();
    const contentType = imageRes.headers.get("content-type") || "image/jpeg";

    // Upload dans Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(storage_path, imageBuffer, {
        contentType,
        upsert: true,
      });

    if (uploadError) {
      return new Response(
        JSON.stringify({ error: uploadError.message }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // Retourner l'URL publique
    const { data: { publicUrl } } = supabase.storage
      .from(BUCKET)
      .getPublicUrl(storage_path);

    return new Response(
      JSON.stringify({ public_url: publicUrl, storage_path }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
        },
      }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erreur serveur";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
