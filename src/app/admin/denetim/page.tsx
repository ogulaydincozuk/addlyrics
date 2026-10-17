import type { Metadata } from "next";
import { formatDateTime } from "@/lib/dates";
import { requireAdmin } from "@/server/auth/guards";
import { db } from "@/server/db";
import { AdminPage, Table, Td, Th } from "../_ui";

export const metadata: Metadata = { title: "Denetim Kayıtları" };

export default function AuditPage({ searchParams }: PageProps<"/admin/denetim">) {
  return (
    <AdminPage title="Denetim Kayıtları" description="Yönetici işlemleri ve kritik sistem olayları (kod, komisyon, ödeme, ayar ve deneme işlemleri).">
      <Audit searchParams={searchParams} />
    </AdminPage>
  );
}

async function Audit({ searchParams }: Pick<PageProps<"/admin/denetim">, "searchParams">) {
  await requireAdmin();
  const sp = await searchParams;
  const entity = typeof sp.tur === "string" ? sp.tur.slice(0, 40) : null;
  const logs = await db.auditLog.findMany({
    where: entity ? { entityType: entity } : {},
    orderBy: { createdAt: "desc" },
    take: 300,
    include: { actor: { select: { name: true, email: true } } },
  });
  const types = await db.auditLog.groupBy({ by: ["entityType"], _count: { _all: true } });

  return (
    <div className="space-y-4">
      <form className="flex gap-2">
        <select name="tur" defaultValue={entity ?? ""} className="h-9 rounded-lg border border-line-strong bg-card px-2 text-sm" aria-label="Kayıt türü">
          <option value="">Tüm kayıtlar</option>
          {types.map((t) => (
            <option key={t.entityType} value={t.entityType}>
              {t.entityType} ({t._count._all})
            </option>
          ))}
        </select>
        <button type="submit" className="h-9 rounded-lg bg-ink px-3 text-sm font-semibold text-white">
          Filtrele
        </button>
      </form>
      <Table minWidth={900}>
        <thead>
          <tr>
            <Th>Zaman</Th>
            <Th>Kim</Th>
            <Th>İşlem</Th>
            <Th>Kayıt</Th>
            <Th>Özet</Th>
            <Th>IP</Th>
          </tr>
        </thead>
        <tbody>
          {logs.map((l) => (
            <tr key={l.id}>
              <Td className="whitespace-nowrap">{formatDateTime(l.createdAt)}</Td>
              <Td>{l.actor ? `${l.actor.name} (${l.actor.email})` : "Sistem"}</Td>
              <Td className="font-mono text-xs">{l.action}</Td>
              <Td className="text-xs">
                {l.entityType}
                <div className="font-mono text-muted">{l.entityId}</div>
              </Td>
              <Td className="max-w-sm text-xs">{l.summary}</Td>
              <Td className="text-xs text-muted">{l.ip ?? "—"}</Td>
            </tr>
          ))}
          {logs.length === 0 && (
            <tr>
              <Td className="py-8 text-muted">Kayıt yok.</Td>
            </tr>
          )}
        </tbody>
      </Table>
    </div>
  );
}
