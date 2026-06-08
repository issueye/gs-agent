/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,vue}'],
  theme: {
    extend: {
      colors: {
        ink: '#090c13',
        panel: '#0f141d',
        panelSoft: '#151b26',
        line: '#242b38',
        accent: '#6ee7b7',
        accentStrong: '#34d399',
        muted: '#94a3b8',
        danger: '#f87171',
      },
      boxShadow: {
        shell: '0 22px 64px rgba(0, 0, 0, 0.38)',
      },
      fontFamily: {
        sans: ['"Segoe UI Variable"', '"Segoe UI"', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
