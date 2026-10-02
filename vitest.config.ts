import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "node",
          environment: "node",
          include: [
            "packages/tokens/**/*.test.ts",
            "packages/journey-engine/**/*.test.ts",
            "packages/adapters/**/*.test.ts",
            "journeys/**/*.test.ts",
          ],
        },
      },
      {
        plugins: [react()],
        test: {
          name: "dom",
          environment: "jsdom",
          include: ["packages/design-system/**/*.test.tsx"],
          setupFiles: ["packages/design-system/test/setup.ts"],
        },
      },
    ],
  },
});
