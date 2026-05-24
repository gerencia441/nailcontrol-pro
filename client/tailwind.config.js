/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        blush: {
          25:  '#fffafb',
          50:  '#fff0f3',
          100: '#ffe1e8',
          200: '#ffb3c1',
          300: '#ff8fa3',
          400: '#ff6384',
          500: '#f43f5e',
          600: '#e11d48',
          700: '#be123c',
        },
        petal: {
          50:  '#fdf2f8',
          100: '#fce7f3',
          200: '#fbcfe8',
          300: '#f9a8d4',
          400: '#f472b6',
          500: '#ec4899',
        },
        mauve: {
          50:  '#f5f3ff',
          100: '#ede9fe',
          200: '#ddd6fe',
          300: '#c4b5fd',
          400: '#a78bfa',
          500: '#8b5cf6',
        },
      },
      fontFamily: {
        sans:    ['"DM Sans"', 'system-ui', 'sans-serif'],
        display: ['"DM Serif Display"', 'Georgia', 'serif'],
      },
      boxShadow: {
        soft:        '0 2px 8px rgba(244, 63, 94, 0.15)',
        card:        '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
        'card-hover':'0 4px 12px rgba(0,0,0,0.10)',
        modal:       '0 20px 60px rgba(0,0,0,0.15)',
      },
      backgroundImage: {
        'brand-gradient':  'linear-gradient(135deg, #f43f5e 0%, #f472b6 100%)',
        'sidebar-gradient':'linear-gradient(180deg, #fff0f3 0%, #ffffff 100%)',
        'card-rose':       'linear-gradient(135deg, #fecdd3 0%, #fda4af 100%)',
        'card-violet':     'linear-gradient(135deg, #ddd6fe 0%, #c4b5fd 100%)',
        'card-sky':        'linear-gradient(135deg, #bae6fd 0%, #7dd3fc 100%)',
        'card-amber':      'linear-gradient(135deg, #fde68a 0%, #fbbf24 100%)',
      },
    },
  },
  plugins: [],
};
