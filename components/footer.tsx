'use client';

import Link from 'next/link';

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-white border-t border-gray-100 py-12 mt-auto">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6 text-sm text-gray-500">
          <div className="text-center md:text-left">
            <p className="font-bold text-gray-900 mb-1">Groupe & Découverte</p>
            <p>© {currentYear} Tous droits réservés.</p>
          </div>
          
          <div className="flex items-center gap-8 font-medium">
            <a 
              href="https://www.groupeetdecouverte.fr/mentions-legales" 
              target="_blank" 
              rel="noopener noreferrer"
              className="hover:text-primary transition-colors"
            >
              Mentions légales
            </a>
            <a 
              href="https://www.groupeetdecouverte.fr/contact" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="hover:text-primary transition-colors"
            >
              Contact
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
