// Prisma 7 configuration file for Prisma CLI operations (migrations, schema validation)
// Runtime application queries use src/lib/prisma.ts with DATABASE_URL via @prisma/adapter-pg
import "dotenv/config";
import { defineConfig } from "prisma/config";

const directUrl = process.env["DIRECT_URL"];

if (!directUrl) {
  throw new Error(
    "DIRECT_URL is required in .env for Prisma CLI operations (migrations, schema engine). " +
    "Prisma CLI commands must use a direct (non-pooler) connection. " +
    "Please set DIRECT_URL in your .env file to your Neon direct connection string."
  );
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: directUrl,
  },
});

