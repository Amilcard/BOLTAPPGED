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
        // Primary = TITRES (#2a383f - Gris-Bleu Foncé du logo)
        primary: {
          DEFAULT: '#2a383f',
          50: '#f4f7f8',
          100: '#e0e7ea',
          200: '#c4d1d7',
          300: '#9bb0ba',
          400: '#6b8a97',
          500: '#2a383f',     // Main Title Color (logo dark)
          600: '#233038',
          700: '#1c272e',
          800: '#151e24',
          900: '#0e151a',
          foreground: '#FFFFFF',
        },
        // Secondary = CTA / ACTIONS (#de7356 - Terracotta du logo)
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
        // Accent = Gris-Bleu Clair (dérivé du logo, remplace le violet)
        accent: {
          DEFAULT: '#3d5260',
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
        // Brand aliases (Legacy support - aligned with new logo)
        brand: {
          dark: '#2a383f',   // Titles (logo dark color)
          gold: '#de7356',   // Terracotta (logo main color)
          teal: '#3d5260',   // Accent (derived from logo)
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
