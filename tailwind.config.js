/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: {
          base: '#0A0D14',
          surface: '#0F1320',
          elevated: '#141929',
          hover: '#1A2030',
        },
        lava: {
          50: '#fff1f3',
          100: '#ffe4e8',
          200: '#fecdd5',
          300: '#fda4b4',
          400: '#fb7185',
          500: '#f43f5e',
          600: '#e11d48',
          700: '#be123c',
          800: '#9f1239',
          900: '#881337',
          950: '#4c0519',
        },
        line: {
          subtle: '#1E2436',
          DEFAULT: '#252D40',
          strong: '#323B52',
        },
        muted: {
          400: '#8A93A6',
          500: '#6B7387',
          600: '#525A6E',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 2px 0 rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.02)',
        elevated: '0 8px 24px -4px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.02)',
        glow: '0 0 0 1px rgba(225,29,72,0.3), 0 8px 32px -8px rgba(225,29,72,0.25)',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-in': {
          '0%': { opacity: '0', transform: 'translateX(-8px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(0.97)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.3s ease-out',
        'slide-in': 'slide-in 0.25s ease-out',
        'scale-in': 'scale-in 0.2s ease-out',
        shimmer: 'shimmer 2s linear infinite',
      },
    },
  },
  plugins: [],
};
