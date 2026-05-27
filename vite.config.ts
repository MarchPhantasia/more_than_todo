import react from "@vitejs/plugin-react";
import { defineConfig, type UserConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
    globals: true
  }
} as UserConfig & {
  test: {
    environment: string;
    setupFiles: string;
    globals: boolean;
  };
});
