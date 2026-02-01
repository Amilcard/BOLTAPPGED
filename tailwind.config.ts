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
        // Primary = Bleu #76C7EE
        primary: {
          DEFAULT: '#76C7EE',
          50: '#F4FAFD',
          100: '#E9F5FB',
          200: '#D3EBF7',
          300: '#B7E1F3',
          400: '#9BD7EF',
          500: '#76C7EE',
          600: '#5E9FBE',
          700: '#46778E',
          800: '#2E4F5E',
          900: '#17272F',
          foreground: '#FFFFFF',
        },
        // Secondary = Orange #FF6B35
        secondary: {
          DEFAULT: '#FF6B35',
          50: '#FFF4ED',
          100: '#FFE9DB',
          200: '#FFD3B7',
          300: '#FFBD93',
          400: '#FFA76F',
          500: '#FF6B35',
          600: '#CC5629',
          700: '#99411F',
          800: '#662C14',
          900: '#33170A',
          foreground: '#FFFFFF',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: '#F8F9FA',
          foreground: '#2D3436',
        },
        accent: {
          DEFAULT: '#FF6B35',
          foreground: '#FFFFFF',
        },
        popover: {
          DEFAULT: '#FFFFFF',
          foreground: '#2D3436',
        },
        card: {
          DEFAULT: '#FFFFFF',
          foreground: '#2D3436',
        },
        // Brand colors
        brand: {
          blue: '#76C7EE',
          orange: '#FF6B35',
          dark: '#2D3436',
          white: '#FFFFFF',
          light: '#F8F9FA',
        },
        // Legacy compatibility
        background: '#F8F9FA',
        foreground: '#2D3436',
      },
      fontFamily: {
        sans: ['Poppins', 'Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        sm: '0.5rem',
        md: '0.75rem',
        lg: '1rem',
        xl: '1.25rem',
        '2xl': '1.5rem',
        '3xl': '2rem',
        brand: '24px',
      },
      boxShadow: {
        sm: '0 1px 2px rgba(0, 0, 0, 0.05)',
        DEFAULT: '0 4px 6px rgba(0, 0, 0, 0.07), 0 2px 4px rgba(0, 0, 0, 0.06)',
        md: '0 10px 15px rgba(0, 0, 0, 0.1), 0 4px 6px rgba(0, 0, 0, 0.05)',
        lg: '0 20px 25px rgba(0, 0, 0, 0.1), 0 10px 10px rgba(0, 0, 0, 0.04)',
        card: '0 4px 12px rgba(0, 0, 0, 0.08)',
        'card-hover': '0 8px 24px rgba(0, 0, 0, 0.12)',
        // Brand shadows (Design System Vitrine)
        brand: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)',
        'brand-lg': '0 10px 15px -3px rgba(0, 0, 0, 0.08), 0 4px 6px -2px rgba(0, 0, 0, 0.04)',
        'brand-xl': '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
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
