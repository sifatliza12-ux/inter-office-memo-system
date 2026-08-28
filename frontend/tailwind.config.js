/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Stage 4a: blue + tangerine brand identity, replacing Stage 1's
        // plum/terracotta. `blue` mirrors Tailwind's own professionally
        // tuned blue scale (explicit here, not left implicit, since it is
        // now a deliberate brand token used everywhere from the nav to
        // workflow-status "in progress" tones — not an incidental default).
        blue: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
          950: '#172554',
        },
        tangerine: {
          50: '#fff7ed',
          100: '#ffedd5',
          200: '#fed7aa',
          300: '#fdba74',
          400: '#fb923c',
          500: '#f97316',
          600: '#ea580c',
          700: '#c2410c',
          800: '#9a3412',
          900: '#7c2d12',
          950: '#431407',
        },
      },
      fontFamily: {
        sans: ['"Inter"', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 2px 0 rgba(30, 58, 138, 0.04), 0 2px 8px -2px rgba(30, 58, 138, 0.08)',
        'card-hover': '0 2px 4px 0 rgba(30, 58, 138, 0.06), 0 8px 20px -4px rgba(30, 58, 138, 0.14)',
        panel: '0 1px 3px 0 rgba(30, 58, 138, 0.06)',
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
        // Very slow, subtle drift for the login page's background geometry
        // — never fast/bouncy enough to read as "animated background".
        drift: {
          '0%, 100%': { transform: 'translate(0, 0)' },
          '50%': { transform: 'translate(-2%, 2%)' },
        },
      },
      animation: {
        'fade-in-up': 'fade-in-up 0.35s ease-out both',
        'fade-in': 'fade-in 0.2s ease-out both',
        drift: 'drift 22s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
