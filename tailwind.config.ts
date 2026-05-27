import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#19202A",
        muted: "#667085",
        paper: "#F6F7F8",
        line: "#DDE1E7",
        teal: "#168C84",
        blue: "#2F5FD0",
        coral: "#D85B63",
        amber: "#B87924",
        focus: "#20835A",
        violet: "#6D5B9F"
      },
      boxShadow: {
        panel: "0 10px 28px rgba(26, 34, 46, 0.055)"
      },
      fontFamily: {
        sans: [
          "MiSans",
          "HarmonyOS Sans SC",
          "PingFang SC",
          "Microsoft YaHei UI",
          "Noto Sans CJK SC",
          "Source Han Sans SC",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "sans-serif"
        ]
      }
    }
  },
  plugins: []
} satisfies Config;
