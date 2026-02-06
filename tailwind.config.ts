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
        // Primary = Dark Blue Gray #2E4053 (Textes, Titres, Identité)
        primary: {
          DEFAULT: '#2E4053',
          50: '#F4F6F7',
          100: '#E1E5E8',
          200: '#CED4D9',
          300: '#BCC4C9',
          400: '#5D6D7E',
          500: '#2E4053',     // Main Text Color
          600: '#283747',
          700: '#212F3C',
          800: '#1B2631',
          900: '#154360',
          foreground: '#FFFFFF',
        },
        // Secondary = Golden Yellow #FAB231 (Action - CTA, Prix, Focus)
        secondary: {
          DEFAULT: '#FAB231', // Gold Action
          50: '#FEF9E7',
          100: '#FCF3CF',
          200: '#F9E79F',
          300: '#F7DC6F',
          400: '#F4D03F',
          500: '#FAB231',     // Main Action Color
          600: '#D4AC0D',
          700: '#B7950B',
          800: '#9A7D0A',
          900: '#7D6608',
          foreground: '#2E4053', // Contrast Text on Gold
        },
        // Accent = Teal Green #00D49C (Active states, Success)
        accent: {
          DEFAULT: '#00D49C',
          foreground: '#FFFFFF',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: '#F8F9FA', // Neutral BG
          foreground: '#6B7280',
        },
        popover: {
          DEFAULT: '#FFFFFF',
          foreground: '#2E4053',
        },
        card: {
          DEFAULT: '#FFFFFF',
          foreground: '#2E4053',
        },
        // Brand aliases
        brand: {
          dark: '#2E4053',
          gold: '#FAB231',
          teal: '#00D49C',
          white: '#FFFFFF',
          light: '#F8F9FA', // Neutral Light
          border: '#D0D5D7',
        },
      },
      fontFamily: {
        heading: ['var(--font-roboto)', 'sans-serif'],
        sans: ['var(--font-nunito)', 'sans-serif'],
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
