// LOT 1: Wishlist page redirects to search engine (single page app)
import { redirect } from 'next/navigation';

export default function EnviesPage() {
  redirect('/sejours');
}
