/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./**/*.php'],
  theme: {
    extend: {
      screens: { xs: '400px' },
      fontFamily: {
        sans: ['"IBM Plex Sans Thai"', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        num: ['Inter', '"IBM Plex Sans Thai"', 'sans-serif'],
      },
      colors: {
        brand: { 50: '#f0fdf4', 100: '#dcfce7', 200: '#bbf7d0', 300: '#86efac', 400: '#4ade80', 500: '#22c55e', 600: '#16a34a', 700: '#15803d', 800: '#166534', 900: '#14532d' },
        accent: { 50: '#fff7ed', 100: '#ffedd5', 200: '#fed7aa', 300: '#fdba74', 400: '#fb923c', 500: '#f97316' },
      },
      boxShadow: {
        soft: '0 1px 2px rgba(2,6,23,.04), 0 8px 24px rgba(2,6,23,.05)',
        lift: '0 10px 34px rgba(2,6,23,.12)',
      },
    },
  },
  plugins: [],
}
