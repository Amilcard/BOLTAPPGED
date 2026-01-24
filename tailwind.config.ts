import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#1F3B57',
          50: '#E8EDF2',
          100: '#D1DBE5',
          200: '#A3B7CB',
          300: '#7593B1',
          400: '#476F97',
          500: '#1F3B57',
          600: '#1A3249',
          700: '#15283B',
          800: '#101F2D',
          900: '#0B151F',
        },
        accent: {
          DEFAULT: '#F59E0B',
          50: '#FEF3E2',
          100: '#FDE7C5',
          200: '#FBCF8B',
          300: '#F9B751',
          400: '#F7A017',
          500: '#F59E0B',
          600: '#C47F09',
          700: '#936007',
          800: '#624005',
          900: '#312003',
        },
        background: '#F5F7FA',
        foreground: '#0F172A',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        lg: '0.75rem',
        md: '0.5rem',
        sm: '0.25rem',
      },
      boxShadow: {
        card: '0 2px 8px rgba(31, 59, 87, 0.08)',
        'card-hover': '0 4px 16px rgba(31, 59, 87, 0.12)',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

export default config;
