/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'rgb(var(--color-bg) / <alpha-value>)',
        panel: 'rgb(var(--color-panel) / <alpha-value>)',
        panel2: 'rgb(var(--color-panel) / 0.6)',
        border: 'rgb(var(--color-border) / <alpha-value>)',
        text: 'rgb(var(--color-text) / <alpha-value>)',
        muted: 'rgb(var(--color-muted) / <alpha-value>)',
        cyan: 'rgb(var(--color-cyan) / <alpha-value>)',
        amber: 'rgb(var(--color-amber) / <alpha-value>)',
        red: 'rgb(var(--color-red) / <alpha-value>)',
        green: 'rgb(var(--color-green) / <alpha-value>)',
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      backgroundImage: {
        'grid-fade': 'linear-gradient(180deg, rgba(79,209,197,0.06) 0%, rgba(79,209,197,0) 60%)',
      },
    },
  },
  plugins: [],
}
