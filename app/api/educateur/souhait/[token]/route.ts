export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase-server';
/**
 * GET /api/educateur/souhait/[token]
 * Retourne le souhait via educateur_token (magic link).
 * Passe automatiquement status de 'emis' → 'vu'.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(token)) {
      return NextResponse.json({ error: 'Lien invalide.' }, { status: 400 });
    }

    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('gd_souhaits')
      .select('id, kid_prenom, kid_prenom_referent, sejour_slug, sejour_titre, motivation, status, reponse_educateur, reponse_date, educateur_prenom, created_at')
      .eq('educateur_token', token)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'Souhait introuvable.' }, { status: 404 });
    }

    // Marquer comme vu si encore emis
    if (data.status === 'emis') {
      await supabase
        .from('gd_souhaits')
        .update({ status: 'vu' })
        .eq('educateur_token', token);
      data.status = 'vu';
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error('GET /api/educateur/souhait error:', err);
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 });
  }
}

/**
 * PATCH /api/educateur/souhait/[token]
 * Réponse éducateur : status + reponse_educateur optionnelle.
 * Valeurs status acceptées : 'en_discussion', 'valide', 'refuse'
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(token)) {
      return NextResponse.json({ error: 'Lien invalide.' }, { status: 400 });
    }

    const { status, reponseEducateur } = await req.json();

    const validStatuts = ['en_discussion', 'valide', 'refuse'];
    if (!validStatuts.includes(status)) {
      return NextResponse.json({ error: 'Statut invalide.' }, { status: 400 });
    }

    const supabase = getSupabase();

    // Bloquer la modification d'un souhait déjà traité
    const { data: current } = await supabase
      .from('gd_souhaits')
      .select('status')
      .eq('educateur_token', token)
      .single();

    if (current && ['valide', 'refuse'].includes(current.status)) {
      return NextResponse.json({ error: 'Ce souhait a déjà été traité.' }, { status: 409 });
    }

    const { error } = await supabase
      .from('gd_souhaits')
      .update({
        status,
        reponse_educateur: typeof reponseEducateur === 'string' ? reponseEducateur.trim() || null : null,
        reponse_date: new Date().toISOString(),
      })
      .eq('educateur_token', token);

    if (error) throw error;

    return NextResponse.json({ success: true, status });
  } catch (err) {
    console.error('PATCH /api/educateur/souhait error:', err);
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 });
  }
}
