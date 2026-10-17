import "server-only";
import { headers } from "next/headers";
import type { Prisma } from "@prisma/client";
import { clientIpFromHeaders } from "./auth/session";
import { db, type Tx } from "./db";

export type AuditInput = {
  actorId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  summary?: string;
  data?: Record<string, unknown>;
};

async function requestIp() {
  try {
    return clientIpFromHeaders(await headers());
  } catch {
    return null; // istek bağlamı dışında (bakım görevi, test)
  }
}

/** Yönetici ve kritik sistem işlemlerini kaydeder. İşlem içinde çağrılabilir (tx). */
export async function audit(input: AuditInput, client: Tx | typeof db = db) {
  await client.auditLog.create({
    data: {
      actorId: input.actorId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      summary: input.summary?.slice(0, 500) ?? null,
      data: (input.data ?? undefined) as Prisma.InputJsonValue | undefined,
      ip: await requestIp(),
    },
  });
}
