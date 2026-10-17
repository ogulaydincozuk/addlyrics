import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      // "server-only" yalnızca Next.js sunucu derlemesinde anlamlıdır; testlerde boş modül
      "server-only": path.resolve(import.meta.dirname, "tests/stubs/server-only.ts"),
    },
  },
  test: {
    environment: "node",
    globalSetup: ["tests/global-setup.ts"],
    setupFiles: ["tests/setup.ts"],
    // Entegrasyon testleri aynı test veritabanını kullanır
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
