

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        eco: {
          deep: "#0a3d2e",
          forest: "#0f6b4a",
          emerald: "#12a06a",
          mint: "#8fffc7",
          cream: "#f6fffa",
        },
      },
      boxShadow: {
        eco: "0 24px 60px rgba(15, 107, 74, 0.18)",
      },
    },
  },
  plugins: [],
};
