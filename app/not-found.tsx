import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { MapPinOff } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-[80vh] flex items-center justify-center bg-gray-50/50 p-4">
      <div className="max-w-md w-full bg-white p-8 rounded-brand shadow-brand-lg text-center border border-gray-100/50">
        <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6">
          <MapPinOff className="w-8 h-8 text-gray-400" />
        </div>

        <h1 className="text-4xl font-bold text-primary mb-2">404</h1>
        
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          Page non trouvée
        </h2>
        
        <p className="text-gray-500 mb-8 leading-relaxed">
          La page que vous recherchez semble introuvable. Elle a peut-être été déplacée ou supprimée.
        </p>

        <Button asChild size="lg" className="w-full sm:w-auto">
          <Link href="/">
            Retour à l'accueil
          </Link>
        </Button>
      </div>
    </div>
  );
}
