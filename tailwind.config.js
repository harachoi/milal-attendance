/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "Pretendard",
          "-apple-system",
          "BlinkMacSystemFont",
          "system-ui",
          "Noto Sans KR",
          "sans-serif",
        ],
      },
      colors: {
        team: {
          sarang: "#FFF4D6",
          mideum: "#FFE0E9",
          innae: "#DCEEFB",
          younggwang: "#DCF5E3",
          soman: "#EADCFB",
        },
      },
    },
  },
  plugins: [],
};
