import type { Metadata } from "next";
import Link from "next/link";
import type { Prisma, TrialStage } from "@prisma/client";
import { Search } from "lucide-react";
import { Badge } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/dates";
import { TRIAL_STAGE_LABEL, TRIAL_STAGE_TONE, TRIAL_STAGES, type TrialStageValue } from "@/lib/trial";
import { requireAdmin } from "@/server/auth/guards";
import { db } from "@/server/db";
import { AdminPage, Table, Td, Th } from "../_ui";

export const metadata: Metadata = { title: "Deneme Başvuruları" };

export default function AdminTrialsPage({ searchParams }: PageProps<"/admin/denemeler">) {
  return (
    <AdminPage title="Deneme Başvuruları" description="Ücretsiz deneme başvuruları, dosya kontrolleri, ön izleme süreleri ve satın almaya dönüşüm.">
      <Trials searchParams={searchParams} />
    </AdminPage>
  );
}

async function Trials({ searchParams }: Pick<PageProps<"/admin/denemeler">, "searchParams">) {
  await requireAdmin();
  const sp = await searchParams;
  const durum = typeof sp.durum === "string" && (TRIAL_STAGES as readonly string[]).includes(sp.durum) ? (sp.durum as TrialStageValue) : null;
  const overdue = sp.gecikmis === "1";
  // Satın almaya dönüşen denemeler (gösterge panelindeki "Deneme → satın alma" kartı)
  const converted = sp.donusen === "1";
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 80) : "";
  // Telefon kayıtları E.164 biçiminde (+905…); "0532 …" gibi yazımlar da bulunsun
  const qPhone = /^[\d\s()+.\-]+$/.test(q) ? q.replace(/\D/g, "").replace(/^0+/, "") : "";
  const now = new Date();

  const where: Prisma.TrialApplicationWhereInput = {
    ...(durum ? { status: durum as TrialStage } : {}),
    ...(overdue ? { previewDueAt: { lt: now }, status: { in: ["QUEUED", "IN_PRODUCTION", "FAILED"] } } : {}),
    ...(converted ? { convertedOrderId: { not: null } } : {}),
    ...(q
      ? {
          OR: [
            { number: { contains: q, mode: "insensitive" } },
            { contactEmail: { contains: q, mode: "insensitive" } },
            { contactName: { contains: q, mode: "insensitive" } },
            { song: { title: { contains: q, mode: "insensitive" } } },
            { user: { email: { contains: q, mode: "insensitive" } } },
            ...(qPhone.length >= 4 ? [{ contactPhone: { contains: qPhone } }, { user: { phone: { contains: qPhone } } }] : []),
          ],
        }
      : {}),
  };
  const [trials, counts, overdueCount, convertedCount] = await Promise.all([
    db.trialApplication.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 200,
      include: {
        song: { select: { artistName: true, title: true } },
        user: { select: { emailVerifiedAt: true, phoneVerifiedAt: true } },
        convertedOrder: { select: { number: true } },
        videos: { select: { status: true } },
      },
    }),
    db.trialApplication.groupBy({ by: ["status"], _count: { _all: true } }),
    db.trialApplication.count({ where: { previewDueAt: { lt: now }, status: { in: ["QUEUED", "IN_PRODUCTION", "FAILED"] } } }),
    db.trialApplication.count({ where: { convertedOrderId: { not: null } } }),
  ]);
  const countOf = (s: string) => counts.find((c) => c.status === s)?._count._all ?? 0;
  // Sekmeler arama metnini korur
  const withQ = (params: string) => {
    const search = new URLSearchParams(params);
    if (q) search.set("q", q);
    const s = search.toString();
    return s ? `/admin/denemeler?${s}` : "/admin/denemeler";
  };
  const tabs = [
    { label: "Tümü", href: withQ(""), on: !durum && !overdue && !converted },
    ...TRIAL_STAGES.filter((s) => s !== "EDITOR_REVIEW").map((s) => ({
      label: `${TRIAL_STAGE_LABEL[s]} (${countOf(s)})`,
      href: withQ(`durum=${s}`),
      on: durum === s,
    })),
    { label: `Gecikenler (${overdueCount})`, href: withQ("gecikmis=1"), on: overdue },
    { label: `Satın alınan (${convertedCount})`, href: withQ("donusen=1"), on: converted },
  ];

  return (
    <div className="space-y-4">
      <form className="relative max-w-md" role="search">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
        <input
          name="q"
          defaultValue={q}
          placeholder="Başvuru no, e-posta, ad, telefon veya şarkı ara"
          aria-label="Denemelerde ara"
          className="h-11 w-full rounded-xl border border-line-strong bg-card pl-10 pr-3 text-sm outline-none focus:border-brand focus:ring-4 focus:ring-brand-soft"
        />
        {durum && <input type="hidden" name="durum" value={durum} />}
        {overdue && <input type="hidden" name="gecikmis" value="1" />}
        {converted && <input type="hidden" name="donusen" value="1" />}
      </form>
      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className={cn("rounded-full px-3 py-1.5 text-xs font-semibold ring-1", t.on ? "bg-lime text-ink ring-[#c4e534]" : "bg-card text-ink-soft ring-line hover:text-ink")}
          >
            {t.label}
          </Link>
        ))}
      </div>
      <Table minWidth={980}>
        <thead>
          <tr>
            <Th>Başvuru</Th>
            <Th>Müşteri</Th>
            <Th>Şarkı</Th>
            <Th>Durum</Th>
            <Th>Ön izleme hedefi</Th>
            <Th>Videolar</Th>
            <Th>Dönüşüm</Th>
          </tr>
        </thead>
        <tbody>
          {trials.map((t) => {
            const late = t.previewDueAt && t.previewDueAt < now && ["QUEUED", "IN_PRODUCTION", "FAILED"].includes(t.status);
            const ready = t.videos.filter((v) => v.status === "PREVIEW_READY" || v.status === "COMPLETED").length;
            return (
              <tr key={t.id}>
                <Td>
                  <Link href={`/admin/denemeler/${t.number}`} className="font-semibold text-brand hover:underline">
                    {t.number}
                  </Link>
                  <div className="text-xs text-muted">{formatDateTime(t.createdAt)}</div>
                </Td>
                <Td>
                  <div className="font-medium text-ink">{t.contactName}</div>
                  <div className="text-xs text-muted">{t.contactEmail}</div>
                  <div className="mt-1 flex gap-1">
                    <Badge tone={t.user.emailVerifiedAt ? "success" : "warning"}>E-posta</Badge>
                    <Badge tone={t.user.phoneVerifiedAt ? "success" : "warning"}>Telefon</Badge>
                  </div>
                </Td>
                <Td>
                  {t.song.artistName} – {t.song.title}
                </Td>
                <Td>
                  <Badge tone={TRIAL_STAGE_TONE[t.status]}>{TRIAL_STAGE_LABEL[t.status]}</Badge>
                </Td>
                <Td className={late ? "font-semibold text-danger" : undefined}>
                  {t.previewDueAt ? formatDateTime(t.previewDueAt) : <span className="text-muted">Dosya kontrolü bekliyor</span>}
                  {late && <div className="text-xs">Gecikti</div>}
                </Td>
                <Td>
                  {ready}/{t.videos.length} hazır
                </Td>
                <Td>
                  {t.convertedOrder ? (
                    <Link href={`/admin/siparisler/${t.convertedOrder.number}`} className="text-brand hover:underline">
                      {t.convertedOrder.number}
                    </Link>
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                </Td>
              </tr>
            );
          })}
          {trials.length === 0 && (
            <tr>
              <Td className="py-10 text-center text-muted">Kayıt bulunamadı.</Td>
            </tr>
          )}
        </tbody>
      </Table>
    </div>
  );
}
