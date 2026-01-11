module.exports = {
  content: [
    './index.html',
    './App.tsx',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
    './pages/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        background: 'rgb(var(--c-background) / <alpha-value>)',
        surface: 'rgb(var(--c-surface) / <alpha-value>)',
        surfaceHighlight: 'rgb(var(--c-surface-highlight) / <alpha-value>)',
        primary: 'rgb(var(--c-primary) / <alpha-value>)',
        primaryHover: 'rgb(var(--c-primary-hover) / <alpha-value>)',
        onPrimary: 'rgb(var(--c-on-primary) / <alpha-value>)',
        secondary: 'rgb(var(--c-secondary) / <alpha-value>)',
        white: 'rgb(var(--c-text-main) / <alpha-value>)',
        black: 'rgb(var(--c-bg-contrast) / <alpha-value>)',
        gray: {
          300: 'rgb(var(--c-text-secondary) / <alpha-value>)',
          400: 'rgb(var(--c-text-muted) / <alpha-value>)',
          500: 'rgb(var(--c-text-faint) / <alpha-value>)',
        },
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};
