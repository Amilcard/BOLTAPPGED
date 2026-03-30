'use client';

interface LogoProps {
  variant?: 'default' | 'white' | 'compact';
  className?: string;
}

export function Logo({ variant = 'default', className = '' }: LogoProps) {
  // Compact mobile : G & D
  if (variant === 'compact') {
    return (
      <div className={`flex items-center gap-1 ${className}`}>
        <span className="text-lg font-extrabold italic text-accent">G</span>
        <span className="text-sm font-normal italic text-primary">&</span>
        <span className="text-lg font-extrabold italic text-accent">D</span>
      </div>
    );
  }

  // Logo horizontal desktop nettoyé
  return (
    <div className={`flex items-center ${className}`}>
      <img
        src="/logo-clean.svg"
        alt="Groupe et Découverte"
        className={`w-[180px] sm:w-[230px] h-auto object-contain flex-shrink-0`}
        style={variant === 'white' ? { filter: 'brightness(0) invert(1)' } : {}}
      />
    </div>
  );
}
