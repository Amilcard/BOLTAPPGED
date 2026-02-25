'use client';

import Link from 'next/link';
import { Logo } from './logo';

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-white border-t border-gray-100 py-8 mt-auto">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex flex-col md:flex-row justify-between items-start gap-6 text-sm text-gray-500">
          {/* Logo + copyright */}
          <div className="text-center md:text-left flex flex-col items-center md:items-start gap-2">
            <Logo variant="default" className="h-8" />
            <p className="text-xs">© {currentYear} Association Groupe et Découverte. Tous droits réservés.</p>
            <p className="text-xs text-gray-400">SIREN 515 225 654 — Agrément J&amp;S 069ORG0667</p>
          </div>

          {/* Liens légaux */}
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-8">
            <div className="flex flex-col gap-1.5 text-center sm:text-left">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Légal</p>
              <Link href="/mentions-legales" className="text-xs hover:text-primary transition-colors">
                Mentions légales
              </Link>
              <Link href="/confidentialite" className="text-xs hover:text-primary transition-colors">
                Politique de confidentialité
              </Link>
              <Link href="/cgu" className="text-xs hover:text-primary transition-colors">
                Conditions d&apos;utilisation (CGU)
              </Link>
              <Link href="/cgv" className="text-xs hover:text-primary transition-colors">
                Conditions de vente (CGV)
              </Link>
            </div>

            <div className="flex flex-col gap-1.5 text-center sm:text-left">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Contact</p>
              <a
                href="mailto:groupeetdecouverte@gmail.com"
                className="text-xs hover:text-primary transition-colors"
              >
                groupeetdecouverte@gmail.com
              </a>
              <a
                href="tel:0423161671"
                className="text-xs hover:text-primary transition-colors"
              >
                04 23 16 16 71
              </a>
              <a
                href="https://www.groupeetdecouverte.fr"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs hover:text-primary transition-colors"
              >
                groupeetdecouverte.fr
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
