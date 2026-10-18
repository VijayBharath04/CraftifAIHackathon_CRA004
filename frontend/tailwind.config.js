/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        guardian: {
          bg: '#0A0E17',
          card: '#111827',
          panel: '#1A2234',
          border: '#243049',
          hover: '#1E293B',
          accent: '#38BDF8',
          success: '#10B981',
          warning: '#F59E0B',
          danger: '#EF4444',
          muted: '#64748B',
        }
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
