// LOT 1: Infos page redirects to vitrine (no internal infos in app)
import { redirect } from 'next/navigation';
import { VITRINE_LINKS } from '@/config/vitrineLinks';

export default function InfosPage() {
  // Redirect to home page of vitrine
  redirect(VITRINE_LINKS.HOME);
}
