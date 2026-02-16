import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    screens: {
      'xs': '375px',
      'sm': '640px',
      'md': '768px',
      'lg': '1024px',
      'xl': '1280px',
      '2xl': '1536px',
    },
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        // Primary = TITRES (#1d1e20 - Noir Charbon)
        primary: {
          DEFAULT: '#1d1e20',
          50: '#f4f4f5',
          100: '#e4e4e7',
          200: '#d1d5db',
          300: '#9ca3af',
          400: '#6b7280',
          500: '#1d1e20',     // Main Title Color
          600: '#1f2937',
          700: '#111827',
          800: '#0f172a',
          900: '#020617',
          foreground: '#FFFFFF',
        },
        // Secondary = CTA / ACTIONS (#de7356 - Terracotta)
        secondary: {
          DEFAULT: '#de7356', // Terracotta Action
          50: '#fdf8f6',
          100: '#fbeee9',
          200: '#f6dcd3',
          300: '#f0c2b4',
          400: '#e9a08d',
          500: '#de7356',     // Main Button Color
          600: '#c5583b',
          700: '#a34831',
          800: '#843d2d',
          900: '#6d3529',
          foreground: '#FFFFFF', // White text on Terracotta
        },
        // Accent = VIOLET / SECONDAIRE (#7C5295 - Estimé Hostinger, harmonisé)
        accent: {
          DEFAULT: '#7C5295',
          foreground: '#FFFFFF',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: '#f1f1f1', // SECTION GRIS (#f1f1f1)
          foreground: '#64748b',
        },
        popover: {
          DEFAULT: '#FFFFFF',
          foreground: '#1a1a1a',
        },
        card: {
          DEFAULT: '#FFFFFF',
          foreground: '#1a1a1a',
        },
        // Brand aliases (Legacy support mapped to new chart)
        brand: {
          dark: '#1d1e20',   // Titles
          gold: '#de7356',   // Mapped to Terracotta
          teal: '#7C5295',   // Mapped to Accent
          white: '#FFFFFF',
          light: '#f1f1f1',  // Sections
          border: '#e5e7eb',
        },
      },
      fontFamily: {
        heading: ['var(--font-rubik)', 'sans-serif'],
        sans: ['var(--font-rubik)', 'sans-serif'],
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
        brand: '16px', // Keep for cards
        pill: '50px',  // NEW: Button Pill Shape
      },
      boxShadow: {
        sm: '0 1px 2px rgba(0, 0, 0, 0.05)',
        DEFAULT: '0 4px 6px rgba(0, 0, 0, 0.07), 0 2px 4px rgba(0, 0, 0, 0.06)',
        md: '0 10px 15px rgba(0, 0, 0, 0.1), 0 4px 6px rgba(0, 0, 0, 0.05)',
        lg: '0 20px 25px rgba(0, 0, 0, 0.1), 0 10px 10px rgba(0, 0, 0, 0.04)',
        card: '0 4px 12px rgba(0, 0, 0, 0.08)',
        'card-hover': '0 8px 24px rgba(0, 0, 0, 0.12)',
        'brand': '0 4px 6px -1px rgba(46, 64, 83, 0.1), 0 2px 4px -1px rgba(46, 64, 83, 0.06)',
        'brand-lg': '0 10px 15px -3px rgba(46, 64, 83, 0.1), 0 4px 6px -2px rgba(46, 64, 83, 0.05)',
        'brand-xl': '0 20px 25px -5px rgba(46, 64, 83, 0.1), 0 10px 10px -5px rgba(46, 64, 83, 0.04)',
      },
      spacing: {
        section: '120px',
        card: '80px',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

export default config;
