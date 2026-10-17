import "server-only";
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

/**
 * Çalışma zamanı bağlantı adresi. Vercel + Neon'da havuzlu (PgBouncer) bağlantı kullanılır; Prisma'nın
 * hazır sorgu (prepared statement) kullanmaması için `pgbouncer=true` gerekir. Migration'lar ise
 * scripts/vercel-build.mjs içinde doğrudan (havuzsuz) bağlantıyla çalışır.
 */
function runtimeDatabaseUrl() {
  const url = process.env.POSTGRES_PRISMA_URL || process.env.DATABASE_URL;
  if (!url) return undefined;
  if (url.includes("-pooler.") && !/[?&]pgbouncer=/.test(url)) return `${url}${url.includes("?") ? "&" : "?"}pgbouncer=true`;
  return url;
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasourceUrl: runtimeDatabaseUrl(),
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;

export type Db = typeof db;
export type Tx = Parameters<Parameters<typeof db.$transaction>[0]>[0];
