import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: "node",
    globals: true,
    include: ["tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: [
        "lib/auth/**",
        "lib/validations/**",
        "lib/validators/**",
        "lib/schemas/**",
      ],
      reporter: ["text", "json-summary"],
    },
  },
});
