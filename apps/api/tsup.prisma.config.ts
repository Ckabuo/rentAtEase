import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/prisma/client.ts"],
  tsconfig: "tsconfig.prisma.json",
  format: ["esm"],
  outDir: "prisma-client",
  dts: true,
  clean: true,
  sourcemap: true,
  outExtension: () => ({ js: ".mjs" }),
  external: ["@prisma/client", "@prisma/adapter-pg", "pg"],
});
