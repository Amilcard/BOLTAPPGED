'use client';

import Image from 'next/image';

interface LogoProps {
  variant?: 'default' | 'white' | 'compact';
  className?: string;
}

export function Logo({ variant = 'default', className = '' }: LogoProps) {
  if (variant === 'compact') {
    return (
      <div className={`flex items-center ${className}`}>
        <Image
          src="/logo_app_site.png"
          alt="G&D"
          width={140}
          height={24}
          priority
          className="h-6 w-auto object-contain"
        />
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
        className="h-8 xs:h-9 sm:h-10 md:h-11 lg:h-12 w-auto object-contain"
      />
    </div>
  );
}
