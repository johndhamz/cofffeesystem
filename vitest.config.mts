import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "src") },
  },
  test: {
    environment: "jsdom",
    include: ["src/tests/unit/**/*.test.{ts,tsx}"],
    setupFiles: ["./src/tests/unit/setup.ts"],
    globals: false,
    coverage: {
      provider: "v8",
      include: ["src/lib/**", "src/server/**", "src/features/**"],
    },
  },
});
