/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        plum: {
          50: '#f6f1f5',
          100: '#ecdfea',
          200: '#d6b9d1',
          300: '#b98aae',
          400: '#996288',
          500: '#7a4569',
          600: '#603352',
          700: '#4a2740',
          800: '#391e31',
          900: '#2b1626',
          950: '#1a0d17',
        },
        terracotta: {
          50: '#fdf3ee',
          100: '#fbe3d6',
          200: '#f6c4a7',
          300: '#eea073',
          400: '#e27c4a',
          500: '#cc5c30',
          600: '#af4823',
          700: '#8c391d',
          800: '#712f1b',
          900: '#5d2818',
        },
      },
      fontFamily: {
        sans: ['"Inter"', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 2px 0 rgba(43, 22, 38, 0.04), 0 2px 8px -2px rgba(43, 22, 38, 0.08)',
        'card-hover': '0 2px 4px 0 rgba(43, 22, 38, 0.06), 0 8px 20px -4px rgba(43, 22, 38, 0.14)',
        panel: '0 1px 3px 0 rgba(43, 22, 38, 0.06)',
      },
      keyframes: {
        'fade-in-up': {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
      animation: {
        'fade-in-up': 'fade-in-up 0.35s ease-out both',
        'fade-in': 'fade-in 0.2s ease-out both',
      },
    },
  },
  plugins: [],
};
