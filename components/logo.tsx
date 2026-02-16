'use client';

interface LogoProps {
  variant?: 'default' | 'white' | 'compact';
  className?: string;
}

export function Logo({ variant = 'default', className = '' }: LogoProps) {
  const isWhite = variant === 'white';
  const textColor = isWhite ? 'text-white' : 'text-primary';
  const borderColor = isWhite ? 'border-white' : 'border-primary';
  const suffixColor = isWhite ? 'text-white/80' : 'text-secondary';

  // Compact variant: Gold square with G&D
  if (variant === 'compact') {
    return (
      <div className={`flex items-center justify-center w-10 h-10 bg-[#FAB231] rounded-lg shadow-sm shrink-0 ${className}`}>
        <span className="text-white font-extrabold italic text-sm tracking-tighter leading-none">
          G&D
        </span>
      </div>
    );
  }

  // Default & White variants: Rectangular bordered logo with suffix
  return (
    <div className={`relative inline-flex flex-col ${className}`}>
      {/* Rectangular Container matching the new brand identity */}
      <div className={`border-2 ${borderColor} px-4 py-2 flex items-baseline gap-2 group transition-all duration-300`}>
        <span className={`${textColor} font-black text-lg md:text-xl font-heading tracking-[0.05em] whitespace-nowrap`}>
          GROUPE ET DÉCOUVERTE
        </span>
        <div className="flex items-center gap-1">
          <span className={`${suffixColor} text-xs font-bold font-sans opacity-90`}>
            . mon app
          </span>
        </div>
      </div>
      
      {/* Subtle offset shadow for premium feel */}
      <div className="absolute -bottom-1 -right-1 w-full h-full border border-primary/5 -z-10 group-hover:translate-x-0.5 group-hover:translate-y-0.5 transition-transform" />
    </div>
  );
}
