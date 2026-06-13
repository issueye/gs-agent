/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,js}'],
  theme: {
    extend: {
      colors: {
        ink: '#172033',
        field: '#f5f7fb',
        line: '#d9e0ea',
        success: '#14875d',
        warning: '#b7791f',
        danger: '#c2414b',
        accent: '#2563eb',
      },
      boxShadow: {
        panel: '0 10px 30px rgba(23, 32, 51, 0.08)',
      },
    },
  },
  plugins: [],
}

