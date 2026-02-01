// LOT 1: Redirect home to listings (app is search+booking focused)
import { redirect } from 'next/navigation';

export default function HomePage() {
  redirect('/sejours');
}
