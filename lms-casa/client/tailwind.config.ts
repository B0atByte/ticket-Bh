import type { Config } from 'tailwindcss';
import animate from 'tailwindcss-animate';

export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: { '2xl': '1400px' },
    },
    extend: {
      fontFamily: {
        sans:    ['DM Sans', 'Sarabun', 'Noto Sans Thai', 'system-ui', 'sans-serif'],
        serif:   ['Cormorant Garamond', 'Georgia', 'serif'],
        thai:    ['Sarabun', 'Noto Sans Thai', 'system-ui', 'sans-serif'],
      },
      colors: {
        border: 'hsl(var(--border))',
        input:  'hsl(var(--input))',
        ring:   'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground:  'hsl(var(--foreground))',
        primary: {
          DEFAULT:    'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT:    'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT:    'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT:    'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT:    'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        card: {
          DEFAULT:    'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        /* Casa Lapin brand tokens (2024 rebrand: mint green / white / black) */
        cafe: {
          foam:   '#F4FAF7',
          mint:   '#C9E8DA',
          mid:    '#7FCBAA',
          green:  '#1B7E5D',
          deep:   '#14614A',
          dark:   '#1F1F1F',
          white:  '#FFFFFF',
        },
      },
      borderRadius: {
        lg:   '0px',
        md:   '0px',
        sm:   '0px',
        xl:   '0px',
        '2xl':'0px',
      },
      boxShadow: {
        'warm-sm':  '0 1px 3px rgba(16,38,30,0.06), 0 1px 8px rgba(16,38,30,0.04)',
        'warm':     '0 2px 8px rgba(16,38,30,0.07), 0 4px 20px rgba(16,38,30,0.05)',
        'warm-md':  '0 4px 16px rgba(16,38,30,0.09), 0 8px 32px rgba(16,38,30,0.06)',
        'warm-lg':  '0 8px 30px rgba(16,38,30,0.12), 0 20px 60px rgba(16,38,30,0.08)',
        'warm-xl':  '0 20px 60px rgba(16,38,30,0.16), 0 40px 80px rgba(16,38,30,0.10)',
        'inner-warm':'inset 0 1px 3px rgba(16,38,30,0.06)',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(16px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-in-left': {
          from: { opacity: '0', transform: 'translateX(-12px)' },
          to:   { opacity: '1', transform: 'translateX(0)' },
        },
        shake: {
          '0%,100%': { transform: 'translateX(0)' },
          '20%':     { transform: 'translateX(-6px)' },
          '40%':     { transform: 'translateX(6px)' },
          '60%':     { transform: 'translateX(-4px)' },
          '80%':     { transform: 'translateX(4px)' },
        },
        shimmer: {
          from: { backgroundPosition: '-200% 0' },
          to:   { backgroundPosition:  '200% 0' },
        },
      },
      animation: {
        'fade-in':       'fade-in 0.3s cubic-bezier(0.4,0,0.2,1)',
        'fade-up':       'fade-up 0.4s cubic-bezier(0.4,0,0.2,1)',
        'slide-in-left': 'slide-in-left 0.3s cubic-bezier(0.4,0,0.2,1)',
        shake:           'shake 0.4s ease-in-out',
        shimmer:         'shimmer 2s linear infinite',
      },
      transitionTimingFunction: {
        'luxury': 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
      transitionDuration: {
        '250': '250ms',
      },
      letterSpacing: {
        'widest-luxury': '0.2em',
      },
    },
  },
  plugins: [animate],
} satisfies Config;
