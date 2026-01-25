import { supabase } from '@/lib/supabase';
import { Header } from '@/components/header';
import { BottomNav } from '@/components/bottom-nav';
import { StayCard } from '@/components/stay-card';

export const dynamic = 'force-dynamic';

export default async function SejoursPage() {
  const { data: activities, error } = await supabase
    .from("v_activity_with_sessions")
    .select("*")
    .eq("status", "published");

  if (error) {
    console.error('Error fetching activities:', error);
    return (
      <div className="min-h-screen bg-background pb-20 md:pb-0">
        <Header />
        <main className="container mx-auto px-4 py-6">
          <p className="text-center text-destructive">Erreur lors du chargement des séjours.</p>
        </main>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      <Header />
      <main className="container mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold mb-6">Nos séjours</h1>
        {activities && activities.length > 0 ? (
          <div className="grid grid-cols-1 gap-4">
            {activities.map((activity) => (
              <StayCard key={activity.id} stay={activity} />
            ))}
          </div>
        ) : (
          <p className="text-center text-muted-foreground">Aucun séjour disponible pour le moment.</p>
        )}
      </main>
      <BottomNav />
    </div>
  );
}