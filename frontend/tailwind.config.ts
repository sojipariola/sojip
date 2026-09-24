import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        terracotta: {
          50: "#fdf6f3", 100: "#fbe8e0", 200: "#f5c8b8", 300: "#eda58b",
          400: "#e07b5c", 500: "#c85a3a", 600: "#a84a2e", 700: "#853a24",
          800: "#5f2a1a", 900: "#3d1c12",
        },
        offwhite: "#faf8f5",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
    },
  },
  plugins: [],
};
export default config;
