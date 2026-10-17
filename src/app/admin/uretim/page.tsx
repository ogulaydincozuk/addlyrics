import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/primitives";
import { formatDateTime } from "@/lib/dates";
import { TRIAL_STAGE_LABEL, TRIAL_STAGE_TONE } from "@/lib/trial";
import { requireAdmin } from "@/server/auth/guards";
import { db } from "@/server/db";
import { ffmpegCapabilities } from "@/server/video/ffmpeg";
import { ActionForm } from "../_forms";
import { AdminPage, Section, Table, Td, Th } from "../_ui";
import { retryVideoAction } from "../denemeler/actions";

export const metadata: Metadata = { title: "Üretim Kuyruğu" };

export default function ProductionQueuePage() {
  return (
    <AdminPage title="Üretim Kuyruğu" description="Deneme videoları ve ücretli siparişlerin teslim tarihleri, gecikmeler ve hatalar.">
      <Queue />
    </AdminPage>
  );
}

async function Queue() {
  await requireAdmin();
  const now = new Date();
  const [trialVideos, projects, caps] = await Promise.all([
    db.trialVideo.findMany({
      where: { status: { in: ["QUEUED", "IN_PRODUCTION", "EDITOR_REVIEW", "FAILED"] }, trial: { status: { not: "CANCELLED" } } },
      include: { trial: { select: { number: true, previewDueAt: true } }, editor: { select: { name: true } } },
      orderBy: [{ trial: { previewDueAt: "asc" } }, { sequence: "asc" }],
      take: 300,
    }),
    db.project.findMany({
      where: { deliveredAt: null, order: { status: { notIn: ["CANCELLED", "PAYMENT_PENDING", "DELIVERED"] } } },
      include: {
        order: {
          select: { number: true, status: true, song: { select: { artistName: true, title: true } }, assignments: { where: { active: true }, select: { editor: { select: { name: true } } } } },
        },
        deliverables: { select: { id: true, releasedAt: true } },
      },
      orderBy: [{ dueDate: "asc" }, { sequence: "asc" }],
      take: 300,
    }),
    ffmpegCapabilities(),
  ]);
  const failed = trialVideos.filter((v) => v.status === "FAILED");
  const lateTrials = trialVideos.filter((v) => v.trial.previewDueAt && v.trial.previewDueAt < now);
  const lateProjects = projects.filter((p) => p.dueDate && p.dueDate < now);

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-4">
        {[
          ["Kuyruktaki deneme videosu", trialVideos.length, "neutral"],
          ["Hedefi geçen deneme videosu", lateTrials.length, lateTrials.length ? "danger" : "success"],
          ["Hatalı iş", failed.length, failed.length ? "danger" : "success"],
          ["Geciken ücretli video", lateProjects.length, lateProjects.length ? "danger" : "success"],
        ].map(([label, value, tone]) => (
          <div key={label as string} className="rounded-2xl border border-line bg-card p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
            <p className={tone === "danger" ? "mt-1 text-2xl font-extrabold text-danger" : "mt-1 text-2xl font-extrabold text-ink"}>{value as number}</p>
          </div>
        ))}
      </div>
      {!caps.available && (
        <p className="text-sm text-muted">Sunucuda ffmpeg yok ({caps.error}); deneme ön izlemeleri editör tarafından ayrı dışa aktarılıp yüklenmeli.</p>
      )}

      <Section title="Deneme videoları" description="Ön izleme hedefine göre sıralı. Hedef, dosya kontrolü onaylandığında başlar.">
        <Table minWidth={860}>
          <thead>
            <tr>
              <Th>Başvuru</Th>
              <Th>Video</Th>
              <Th>Durum</Th>
              <Th>Editör</Th>
              <Th>Hedef</Th>
              <Th>Hata / deneme</Th>
            </tr>
          </thead>
          <tbody>
            {trialVideos.map((v) => {
              const late = v.trial.previewDueAt && v.trial.previewDueAt < now;
              return (
                <tr key={v.id}>
                  <Td>
                    <Link href={`/admin/denemeler/${v.trial.number}`} className="font-semibold text-brand hover:underline">
                      {v.trial.number}
                    </Link>
                  </Td>
                  <Td>
                    {v.sequence}. {v.approach}
                  </Td>
                  <Td>
                    <Badge tone={TRIAL_STAGE_TONE[v.status]}>{TRIAL_STAGE_LABEL[v.status]}</Badge>
                  </Td>
                  <Td>{v.editor?.name ?? <span className="text-warning">Atanmadı</span>}</Td>
                  <Td className={late ? "font-semibold text-danger" : undefined}>{v.trial.previewDueAt ? formatDateTime(v.trial.previewDueAt) : "—"}</Td>
                  <Td>
                    {v.processingError ? <p className="max-w-xs truncate text-xs text-danger" title={v.processingError}>{v.processingError}</p> : null}
                    <span className="text-xs text-muted">{v.attempts} deneme</span>
                    {v.status === "FAILED" && (
                      <div className="mt-2">
                        <ActionForm action={retryVideoAction.bind(null, v.id)} submitLabel="Yeniden kuyruğa al" variant="secondary" />
                      </div>
                    )}
                  </Td>
                </tr>
              );
            })}
            {trialVideos.length === 0 && (
              <tr>
                <Td className="py-8 text-muted">Kuyrukta deneme videosu yok.</Td>
              </tr>
            )}
          </tbody>
        </Table>
      </Section>

      <Section title="Ücretli siparişlerdeki videolar" description="Teslim edilmemiş videolar, planlanan teslim tarihine göre.">
        <Table minWidth={860}>
          <thead>
            <tr>
              <Th>Sipariş</Th>
              <Th>Video</Th>
              <Th>Şarkı</Th>
              <Th>Editör</Th>
              <Th>Planlanan teslim</Th>
              <Th>Durum</Th>
            </tr>
          </thead>
          <tbody>
            {projects.map((p) => {
              const late = p.dueDate && p.dueDate < now;
              return (
                <tr key={p.id}>
                  <Td>
                    <Link href={`/admin/siparisler/${p.order.number}`} className="font-semibold text-brand hover:underline">
                      {p.order.number}
                    </Link>
                  </Td>
                  <Td>
                    {p.title}
                    {p.trialVideoId && <Badge className="ml-1">deneme</Badge>}
                  </Td>
                  <Td>
                    {p.order.song.artistName} – {p.order.song.title}
                  </Td>
                  <Td>{p.order.assignments[0]?.editor.name ?? <span className="text-warning">Atanmadı</span>}</Td>
                  <Td className={late ? "font-semibold text-danger" : undefined}>
                    {p.dueDate ? formatDateTime(p.dueDate) : <span className="text-muted">Dosya bekleniyor</span>}
                    {late && <div className="text-xs">Gecikti</div>}
                  </Td>
                  <Td>{p.deliverables.length ? `${p.deliverables.length} dosya, yayın bekliyor` : "Hazırlanıyor"}</Td>
                </tr>
              );
            })}
            {projects.length === 0 && (
              <tr>
                <Td className="py-8 text-muted">Bekleyen video yok.</Td>
              </tr>
            )}
          </tbody>
        </Table>
      </Section>
    </div>
  );
}
