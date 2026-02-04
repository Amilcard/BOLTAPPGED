'use client';

import Image from 'next/image';

interface LogoProps {
  variant?: 'default' | 'white' | 'compact';
  className?: string;
}

export function Logo({ variant = 'default', className = '' }: LogoProps) {
  if (variant === 'compact') {
    return (
      <div className={`flex items-center gap-1 ${className}`}>
        <span className="text-lg font-extrabold italic text-accent">G</span>
        <span className="text-sm font-normal italic text-primary">&</span>
        <span className="text-lg font-extrabold italic text-accent">D</span>
      </div>
    );
  }

  return (
    <div className={`flex items-center ${className}`}>
      <Image
        src="/logo_app_site.png"
        alt="Groupe et Découverte - Colonies de vacances et séjours de distanciation"
        width={280}
        height={48}
        priority
        className="h-10 w-auto object-contain"
      />
    </div>
  );
}
