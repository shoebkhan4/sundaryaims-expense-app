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
          blue: "#0F2C59",
          navy: "#0A192F",
          accent: "#0066FF",
          light: "#F8FAFC",
          gold: "#D4AF37"
        }
      }
    },
  },
  plugins: [],
}
