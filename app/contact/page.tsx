// LOT 1: Contact page redirects to vitrine (no internal contact in app)
import { redirect } from 'next/navigation';
import { VITRINE_LINKS } from '@/config/vitrineLinks';

export default function ContactPage() {
  // Redirect to contact page of vitrine
  redirect(VITRINE_LINKS.CONTACT);
}
