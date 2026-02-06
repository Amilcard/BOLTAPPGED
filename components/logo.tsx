'use client';

interface LogoProps {
  variant?: 'default' | 'white' | 'compact';
  className?: string;
}

export function Logo({ variant = 'default', className = '' }: LogoProps) {
  // Common Icon: Gold Square with White G&D
  const Icon = () => (
    <div className="flex items-center justify-center w-10 h-10 bg-[#FAB231] rounded-lg shadow-sm shrink-0">
      <span className="text-white font-extrabold italic text-sm tracking-tighter leading-none">
        G&D
      </span>
    </div>
  );

  // Compact: Just the Icon
  if (variant === 'compact') {
    return (
      <div className={className}>
        <Icon />
      </div>
    );
  }

  // Default: Icon + Text Horizontal
  const textColor = variant === 'white' ? 'text-white' : 'text-[#2E4053]';

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <Icon />
      <div className="flex flex-col leading-none">
        <span className={`text-base font-bold font-heading tracking-wide ${textColor}`}>
          GROUPE ET DÉCOUVERTE
        </span>
      </div>
    </div>
  );
}
