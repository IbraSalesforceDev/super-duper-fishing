import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        sea: {
          50: "#eef7fb",
          100: "#d4ecf5",
          200: "#a9d8ea",
          300: "#73bdd9",
          400: "#3f9cc2",
          500: "#2680a8",
          600: "#1f668a",
          700: "#1d5471",
          800: "#1d475e",
          900: "#1c3c50",
          950: "#122636",
        },
      },
    },
  },
  plugins: [],
};

export default config;
