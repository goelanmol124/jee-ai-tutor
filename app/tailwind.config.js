/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        serif: ['"Newsreader"', '"Source Serif 4"', 'Georgia', 'serif'],
        sans: ['"Inter"', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      colors: {
        paper: {
          DEFAULT: '#FAFAF9',
          50: '#FCFCFB',
          100: '#FAFAF9',
          200: '#F2F2F0',
          300: '#E6E6E3',
        },
        ink: {
          DEFAULT: '#1B1F2A',
          900: '#0F1320',
          700: '#2C3142',
          500: '#6B7280',
          400: '#9AA0AC',
          300: '#C7CAD2',
        },
        leaf: {
          DEFAULT: '#5B8A6E',
          50: '#EDF4EF',
          100: '#D6E5DB',
          300: '#A8D5B9',
          500: '#5B8A6E',
          700: '#3F6650',
        },
        amber: {
          DEFAULT: '#D4A574',
          50: '#FBF5EB',
          100: '#F5E6CB',
          300: '#E8C593',
          500: '#D4A574',
          700: '#A87C4D',
        },
        violet: {
          DEFAULT: '#6B4FA0',
          50: '#F1ECF7',
          100: '#E1D7EE',
          300: '#B7A3D6',
          500: '#8B7AB8',
          700: '#6B4FA0',
          900: '#4A3478',
        },
        navy: {
          DEFAULT: '#0F172A',
          800: '#16213A',
          700: '#1E2B45',
        },
      },
      boxShadow: {
        soft: '0 1px 2px rgba(27,31,42,0.04), 0 4px 16px rgba(27,31,42,0.04)',
        page: '0 1px 1px rgba(27,31,42,0.03), 0 8px 32px rgba(27,31,42,0.06)',
        coach: '0 2px 8px rgba(107,79,160,0.15), 0 8px 24px rgba(107,79,160,0.10)',
      },
      animation: {
        'twinkle': 'twinkle 3s ease-in-out infinite',
        'glow-in': 'glowIn 1.2s ease-out forwards',
        'fade-up': 'fadeUp 0.4s ease-out forwards',
        'underline-in': 'underlineIn 0.5s ease-out forwards',
      },
      keyframes: {
        twinkle: {
          '0%, 100%': { opacity: '0.6', transform: 'scale(1)' },
          '50%': { opacity: '1', transform: 'scale(1.15)' },
        },
        glowIn: {
          '0%': { opacity: '0', transform: 'scale(0.5)', filter: 'blur(4px)' },
          '60%': { opacity: '1', transform: 'scale(1.2)', filter: 'blur(0)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        fadeUp: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        underlineIn: {
          '0%': { transform: 'scaleX(0)', transformOrigin: 'left' },
          '100%': { transform: 'scaleX(1)', transformOrigin: 'left' },
        },
      },
    },
  },
  plugins: [],
};
