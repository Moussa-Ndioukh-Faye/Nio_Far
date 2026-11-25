/** @type {import('tailwindcss').Config} */
// Identité NIO FAR : nuit violette, rose -> corail, blanc, verre dépoli.
// L'accent (clay) est une variable CSS : on change de couleur en un clic
// (voir src/theme.ts) sans toucher aux classes.
const acc = (v) => `rgb(var(${v}) / <alpha-value>)`;

export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#070113", // fond nuit (logo)
        ink2: "#120722", // surface
        ink3: "#1F0E36", // surface relevée
        line: "#33204D", // bordures
        paper: "#FFF8FC", // texte principal
        sand: "#DCCBEA", // texte secondaire (lilas clair)
        mute: "#9C88B3", // texte discret
        clay: acc("--acc"), // accent principal (rose du logo par défaut)
        clayDeep: acc("--acc-deep"),
        coral: acc("--acc-2"), // second ton du dégradé (corail du « far »)
        bissap: "#FF4D5E", // erreur / désaccord
        saffron: "#FFB3D1", // surlignage (rose pâle)
        leaf: "#4ADE9B", // succès / accord
        night: "#1E0027", // cœurs décoratifs
      },
      fontFamily: {
        display: ["Fredoka Variable", "Fredoka", "ui-rounded", "system-ui", "sans-serif"],
        sans: ["Nunito Variable", "Nunito", "ui-rounded", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 0 rgba(255,255,255,0.10) inset, 0 20px 50px -28px rgba(0,0,0,0.9)",
        lift: "0 1px 0 rgba(255,255,255,0.14) inset, 0 30px 70px -30px rgba(0,0,0,0.95)",
        glowClay: "0 14px 40px -12px rgb(var(--acc) / 0.6)",
        glowSaffron: "0 10px 34px -12px rgba(255,179,209,0.45)",
        stamp: "0 0 0 2px rgb(var(--acc) / 0.75), 0 18px 44px -18px rgba(0,0,0,0.9)",
      },
      animation: {
        float: "float 7s ease-in-out infinite",
        "spin-slow": "spin 26s linear infinite",
        "pulse-soft": "pulseSoft 2.6s ease-in-out infinite",
        aurora: "aurora 22s ease-in-out infinite alternate",
        drift: "drift 18s ease-in-out infinite",
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
        aurora: {
          "0%": { transform: "translate3d(0,0,0) scale(1)" },
          "50%": { transform: "translate3d(6%,4%,0) scale(1.12)" },
          "100%": { transform: "translate3d(-5%,-3%,0) scale(0.95)" },
        },
        drift: {
          "0%, 100%": { transform: "translateY(0) rotate(-8deg)" },
          "50%": { transform: "translateY(-18px) rotate(6deg)" },
        },
      },
    },
  },
  plugins: [],
};
