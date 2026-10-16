import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { defineConfig } from "prisma/config";

config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../.env") });

const localDatabaseUrl = "postgresql://postgres:postgres@localhost:5432/rent_at_ease";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env.DATABASE_URL ?? localDatabaseUrl,
  },
});
