/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,vue}'],
  theme: {
    extend: {
      colors: {
        ink: '#222222',
        panel: '#ffffff',
        panelSoft: '#f7fafd',
        line: '#d9e0ea',
        accent: '#0088ff',
        accentStrong: '#006ed0',
        muted: '#6b7280',
        danger: '#c92a2a',
      },
      boxShadow: {
        shell: '0 18px 46px rgba(15, 23, 42, 0.08)',
      },
      fontFamily: {
        sans: ['"Segoe UI Variable"', '"Segoe UI"', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
