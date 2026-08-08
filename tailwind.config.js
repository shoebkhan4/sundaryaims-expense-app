/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        aims: {
          cyan: "#00A3E0",
          yellow: "#FFC20E",
          navy: "#0F2C59",
          blue: "#0066FF",
          light: "#F8FAFC",
          gold: "#D4AF37"
        }
      }
    },
  },
  plugins: [],
}
