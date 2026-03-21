import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname)
    }
  },
  test: {
    environment: "node",
    include: [
      "app/**/*.test.ts",
      "app/**/*.test.tsx",
      "lib/**/*.test.ts",
      "components/**/*.test.ts"
    ]
  }
});
