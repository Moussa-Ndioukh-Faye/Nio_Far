/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#191210",
        ink2: "#221812",
        ink3: "#2E211A",
        line: "#3A2B20",
        paper: "#F4E9D8",
        sand: "#B4A286",
        mute: "#8E7E6A",
        clay: "#C74B2F",
        clayDeep: "#A63A22",
        bissap: "#E1372F",
        saffron: "#E6A837",
        leaf: "#6B8F6F",
      },
      fontFamily: {
        display: ["Fraunces", "ui-serif", "serif"],
        sans: ["Instrument Sans", "ui-sans-serif", "system-ui"],
      },
      boxShadow: {
        card: "0 1px 0 rgba(244,233,216,0.06) inset, 0 18px 40px -24px rgba(0,0,0,0.7)",
        lift: "0 2px 0 rgba(244,233,216,0.08) inset, 0 26px 60px -28px rgba(0,0,0,0.85)",
        glowClay: "0 14px 40px -12px rgba(199,75,47,0.55)",
        glowSaffron: "0 10px 34px -12px rgba(230,168,55,0.5)",
        stamp: "0 0 0 2px rgba(230,168,55,0.7), 0 18px 44px -18px rgba(0,0,0,0.8)",
      },
      animation: {
        float: "float 7s ease-in-out infinite",
        "spin-slow": "spin 26s linear infinite",
        "pulse-soft": "pulseSoft 2.6s ease-in-out infinite",
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-10px)" },
        },
        pulseSoft: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.45" },
        },
      },
    },
  },
  plugins: [],
};