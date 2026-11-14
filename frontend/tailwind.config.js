/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: { extend: { colors: { forest: '#2b7554', ink: '#122e34', mint: '#ebf6ee' }, fontFamily: { sans: ['Plus Jakarta Sans', 'DM Sans', 'sans-serif'] } } },
  plugins: []
};
