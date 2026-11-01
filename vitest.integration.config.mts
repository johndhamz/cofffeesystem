import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "src") },
  },
  test: {
    environment: "node",
    include: ["src/tests/integration/**/*.test.ts"],
    setupFiles: ["./src/tests/integration/setup.ts"],
    globals: false,
    // Integration tests touch a shared local database; run files serially.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
