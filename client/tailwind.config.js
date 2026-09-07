/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        blush: "#ff5c8a",
        blushDark: "#e0356a",
      },
    },
  },
  plugins: [],
};
