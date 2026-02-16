'use client';

interface LogoProps {
  variant?: 'default' | 'white' | 'compact';
  className?: string;
}

export function Logo({ variant = 'default', className = '' }: LogoProps) {
  // Pour le variant compact, on garde une version simplifiée ou on pourrait utiliser une icône si disponible
  if (variant === 'compact') {
    return (
      <div className={`flex items-center gap-1 ${className}`}>
        <span className="text-lg font-extrabold italic text-accent">G</span>
        <span className="text-sm font-normal italic text-primary">&</span>
        <span className="text-lg font-extrabold italic text-accent">D</span>
      </div>
    );
  }

  // Logo horizontal pour le header
  return (
    <div className={`flex items-center ${className}`}>
      <img 
        src="/GLOGO GED NEW.svg" 
        alt="Groupe et Découverte" 
        className={`h-10 sm:h-12 w-auto object-contain ${variant === 'white' ? 'brightness-0 invert' : ''}`}
        onError={(e) => {
          // Fallback au PNG si le SVG échoue (ou vice-versa)
          const target = e.target as HTMLImageElement;
          if (target.src.endsWith('.svg')) {
            target.src = '/GLOGO GED NEW.png';
          }
        }}
      />
    </div>
  );
}
