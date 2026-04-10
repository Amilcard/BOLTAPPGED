export const dynamic = 'force-dynamic';
export const revalidate = 60;

import { Header } from '@/components/header';
import { BottomNav } from '@/components/bottom-nav';
import { HomeContent } from '@/app/home-content';
import { getStaysData } from '@/lib/get-stays-data';

export default async function HomePage() {
  const staysData = await getStaysData();

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      <Header variant="minimal" />
      <HomeContent stays={staysData} viewMode="carousels" />
      <BottomNav />
    </div>
  );
}
