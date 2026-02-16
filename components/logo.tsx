'use client';

import Image from 'next/image';

interface LogoProps {
  variant?: 'default' | 'white' | 'compact';
  className?: string;
}

export function Logo({ variant = 'default', className = '' }: LogoProps) {
  // Compact variant: Terracotta "gd" on dark background (matches favicon)
  if (variant === 'compact') {
    return (
      <div className={`flex items-center justify-center w-10 h-10 bg-[#2a383f] rounded-lg shadow-sm shrink-0 ${className}`}>
        <span className="text-[#de7356] font-extrabold text-sm tracking-tighter leading-none">
          gd
        </span>
      </div>
    );
  }

  // White variant: Use the full SVG logo with brightness filter for light version
  if (variant === 'white') {
    return (
      <div className={`relative ${className}`}>
        <Image
          src="/logo-ged.svg"
          alt="Groupe et Découverte"
          width={220}
          height={73}
          className="h-10 w-auto brightness-0 invert"
          priority
        />
      </div>
    );
  }

  // Default variant: Use the actual new SVG logo
  return (
    <div className={`relative ${className}`}>
      <Image
        src="/logo-ged.svg"
        alt="Groupe et Découverte"
        width={220}
        height={73}
        className="h-10 w-auto"
        priority
      />
    </div>
  );
}
