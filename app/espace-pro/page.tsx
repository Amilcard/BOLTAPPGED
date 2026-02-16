// LOT 1: Pro space redirects to search engine (Pro mode via toggle, not separate page)
import { redirect } from 'next/navigation';

export default function EspaceProPage() {
  redirect('/sejours');
}
