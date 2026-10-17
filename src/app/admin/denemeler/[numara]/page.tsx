import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, ArrowLeft, Download } from "lucide-react";
import { OrderStatusBadge } from "@/components/order/status-badge";
import { Input, Select, Textarea } from "@/components/ui/field";
import { Alert, Badge, KeyValue } from "@/components/ui/primitives";
import { messages } from "@/i18n/config";
import { formatDateTime } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { TRIAL_STAGE_LABEL, TRIAL_STAGE_TONE, TRIAL_VIDEO_TRANSITIONS } from "@/lib/trial";
import { formatPhone } from "@/lib/phone";
import { requireAdmin } from "@/server/auth/guards";
import { db } from "@/server/db";
import type { TrialCheckReport } from "@/server/domain/trials";
import { publicFileRules } from "@/server/storage/file-rules";
import { ffmpegCapabilities } from "@/server/video/ffmpeg";
import { ActionForm } from "../../_forms";
import { AdminPage, customerHref, Section } from "../../_ui";
import {
  approvePreviewAction,
  assignVideoEditorAction,
  cancelTrialAction,
  generatePreviewAction,
  moveVideoAction,
  requestInfoAction,
  retryVideoAction,
  verifyFilesAction,
} from "../actions";
import { MasterUpload, PreviewUpload } from "./client";

export const metadata: Metadata = { title: "Deneme Başvurusu" };

const t = messages();

export default function AdminTrialPage({ params }: PageProps<"/admin/denemeler/[numara]">) {
  return (
    <div>
      <Link href="/admin/denemeler" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-brand">
        <ArrowLeft className="size-4" aria-hidden /> Deneme başvuruları
      </Link>
      <AdminPage title="Deneme Başvurusu">
        <TrialDetail params={params} />
      </AdminPage>
    </div>
  );
}

async function TrialDetail({ params }: Pick<PageProps<"/admin/denemeler/[numara]">, "params">) {
  await requireAdmin();
  const { numara } = await params;
  const trial = await db.trialApplication.findUnique({
    where: { number: numara },
    include: {
      user: { select: { email: true, phone: true, emailVerifiedAt: true, phoneVerifiedAt: true, createdAt: true } },
      song: true,
      files: { where: { status: { not: "DELETED" } }, orderBy: { createdAt: "asc" } },
      videos: {
        orderBy: { sequence: "asc" },
        include: { editor: { select: { id: true, name: true } }, masterFile: true, previewFile: true, posterFile: true, qcBy: { select: { name: true } } },
      },
      events: { orderBy: { createdAt: "desc" }, take: 60, include: { actor: { select: { name: true } } } },
      convertedOrder: { select: { number: true, status: true } },
      filesVerifiedBy: { select: { name: true } },
      // Bu denemeden başlatılan satın alma siparişleri (ödeme bekleyen / iptal edilen ödeme denemeleri dahil)
      purchaseOrders: { orderBy: { createdAt: "desc" }, select: { id: true, number: true, status: true, createdAt: true, priceKurus: true, currency: true } },
    },
  });
  if (!trial) notFound();
  const otherPurchaseOrders = trial.purchaseOrders.filter((o) => o.id !== trial.convertedOrderId);
  const [editors, caps] = await Promise.all([db.editor.findMany({ where: { active: true }, orderBy: { name: "asc" } }), ffmpegCapabilities()]);
  const rules = publicFileRules();
  const report = trial.checkReport as TrialCheckReport | null;
  const customerFiles = trial.files.filter((f) => ["SONG_AUDIO", "LYRICS", "MUSIC_VIDEO", "IMAGE", "FOOTAGE"].includes(f.kind));
  const now = new Date();
  const late = trial.previewDueAt && trial.previewDueAt < now && ["QUEUED", "IN_PRODUCTION", "FAILED"].includes(trial.status);
  const canCheck = trial.status === "FILES_CHECK" || trial.status === "RECEIVED";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-xl font-extrabold text-ink">{trial.number}</h2>
        <Badge tone={TRIAL_STAGE_TONE[trial.status]}>{TRIAL_STAGE_LABEL[trial.status]}</Badge>
        {late && (
          <Badge tone="danger">
            <AlertTriangle className="size-3.5" aria-hidden /> Ön izleme hedefi geçti
          </Badge>
        )}
        {trial.convertedOrder && (
          <Link href={`/admin/siparisler/${trial.convertedOrder.number}`} className="text-sm font-semibold text-brand hover:underline">
            Satın alma: {trial.convertedOrder.number}
          </Link>
        )}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 space-y-6">
          <Section title="Başvuru ve dosyalar">
            <div className="grid gap-4 sm:grid-cols-2">
              <KeyValue label="Müşteri">
                <Link href={customerHref(trial.user.email)} className="font-semibold text-brand hover:underline">
                  {trial.contactName}
                </Link>{" "}
                · {trial.contactEmail}
                {trial.user.email.toLowerCase() !== trial.contactEmail.toLowerCase() && <span className="block text-xs text-muted">Hesap: {trial.user.email}</span>}
              </KeyValue>
              <KeyValue label="Telefon">{formatPhone(trial.contactPhone)}</KeyValue>
              <KeyValue label="Doğrulama">
                <span className="flex gap-1">
                  <Badge tone={trial.user.emailVerifiedAt ? "success" : "warning"}>E-posta</Badge>
                  <Badge tone={trial.user.phoneVerifiedAt ? "success" : "warning"}>Telefon</Badge>
                </span>
              </KeyValue>
              <KeyValue label="Şarkı">
                {trial.song.artistName} – {trial.song.title} ({trial.song.language})
              </KeyValue>
              <KeyValue label="Formatlar">{trial.formats.map((f) => t.enums.videoFormat[f]).join(", ")}</KeyValue>
              <KeyValue label="Görüntü kaynağı">{trial.footageSource ? t.enums.footageSource[trial.footageSource] : "—"}</KeyValue>
              <KeyValue label="Dosya kontrolü">
                {trial.filesVerifiedAt ? `${formatDateTime(trial.filesVerifiedAt)} · ${trial.filesVerifiedBy?.name ?? ""}` : "Bekliyor"}
              </KeyValue>
              <KeyValue label="Ön izleme hedefi">{trial.previewDueAt ? formatDateTime(trial.previewDueAt) : "Dosya kontrolünden sonra başlar"}</KeyValue>
            </div>
            {trial.notesForEditor && (
              <p className="mt-4 whitespace-pre-line rounded-xl bg-canvas p-3 text-sm text-ink-soft">
                <strong className="text-ink">Editöre not:</strong> {trial.notesForEditor}
              </p>
            )}
            <details className="mt-4 rounded-xl border border-line p-3 text-sm">
              <summary className="cursor-pointer font-semibold text-ink">Şarkı sözleri</summary>
              <pre className="mt-3 whitespace-pre-wrap font-sans text-ink-soft">{trial.song.lyrics}</pre>
            </details>
            <ul className="mt-4 divide-y divide-line rounded-xl border border-line text-sm">
              {customerFiles.map((f) => (
                <li key={f.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                  <span>
                    <Badge>{t.enums.fileKind[f.kind]}</Badge> <span className="ml-1 text-ink">{f.originalName}</span>
                    <span className="ml-2 text-xs text-muted">{(Number(f.sizeBytes) / 1024 / 1024).toFixed(1)} MB</span>
                  </span>
                  {f.status === "UPLOADED" ? (
                    <a href={`/api/files/${f.id}`} className="inline-flex items-center gap-1 text-brand hover:underline">
                      <Download className="size-4" aria-hidden /> İndir
                    </a>
                  ) : (
                    <Badge tone="warning">{f.status}</Badge>
                  )}
                </li>
              ))}
            </ul>
            {report && !report.ok && (
              <Alert tone="warning" title="Otomatik kontrol sorunları" className="mt-4">
                <ul className="list-disc pl-4">
                  {report.problems.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              </Alert>
            )}
            {trial.needsInfoMessage && trial.status === "NEEDS_INFO" && (
              <Alert tone="info" title="Müşteriden istenen" className="mt-4">
                <p className="whitespace-pre-line">{trial.needsInfoMessage}</p>
              </Alert>
            )}
          </Section>

          {trial.videos.map((v) => {
            const transitions = TRIAL_VIDEO_TRANSITIONS[v.status] ?? [];
            const canProduce = Boolean(trial.filesVerifiedAt) && trial.status !== "CANCELLED";
            return (
              <Section
                key={v.id}
                title={`Video ${v.sequence} · ${v.approach}`}
                description={`${t.enums.videoStyle[v.style]} · deneme sayısı: ${v.attempts}${v.previewReadyAt ? ` · hazır: ${formatDateTime(v.previewReadyAt)}` : ""}`}
                actions={<Badge tone={TRIAL_STAGE_TONE[v.status]}>{TRIAL_STAGE_LABEL[v.status]}</Badge>}
              >
                {!canProduce ? (
                  <p className="text-sm text-muted">Dosya kontrolü tamamlanınca üretim işlemleri açılır.</p>
                ) : (
                  <div className="space-y-5">
                    {v.processingError && (
                      <Alert tone="danger" title="Hata">
                        <p className="whitespace-pre-line break-words">{v.processingError}</p>
                      </Alert>
                    )}
                    <div className="grid gap-4 sm:grid-cols-2">
                      <ActionForm action={assignVideoEditorAction.bind(null, v.id)} submitLabel="Editörü kaydet" inline>
                        <Select name="editorId" defaultValue={v.editor?.id ?? ""} aria-label="Editör" className="w-56">
                          <option value="">Atanmadı</option>
                          {editors.map((e) => (
                            <option key={e.id} value={e.id}>
                              {e.name}
                            </option>
                          ))}
                        </Select>
                      </ActionForm>
                      {transitions.length > 0 && (
                        <ActionForm action={moveVideoAction.bind(null, v.id)} submitLabel="Durumu değiştir" inline variant="secondary">
                          <Select name="to" aria-label="Yeni durum" className="w-48">
                            {transitions.map((s) => (
                              <option key={s} value={s}>
                                {TRIAL_STAGE_LABEL[s]}
                              </option>
                            ))}
                          </Select>
                          <Input name="note" placeholder="Not (isteğe bağlı)" className="w-48" aria-label="Not" />
                        </ActionForm>
                      )}
                    </div>

                    <div className="grid gap-5 lg:grid-cols-2">
                      <div className="space-y-2">
                        <p className="text-sm font-semibold text-ink">Ana dosya</p>
                        {v.masterFile ? (
                          <p className="text-sm text-ink-soft">
                            {v.masterFile.originalName} ·{" "}
                            <a href={`/api/files/${v.masterFile.id}?inline=1`} target="_blank" className="text-brand hover:underline">
                              izle
                            </a>
                          </p>
                        ) : (
                          <p className="text-sm text-muted">Henüz yüklenmedi.</p>
                        )}
                        {v.status !== "COMPLETED" && v.status !== "PREVIEW_READY" && <MasterUpload videoId={v.id} rule={rules.TRIAL_MASTER} />}
                      </div>
                      <div className="space-y-2">
                        <p className="text-sm font-semibold text-ink">Ön izleme</p>
                        {v.previewFile ? (
                          <>
                            <video
                              src={`/api/deneme-medya/${v.id}/preview`}
                              poster={v.posterFile ? `/api/deneme-medya/${v.id}/poster` : undefined}
                              controls
                              preload="none"
                              className="aspect-video w-full rounded-xl bg-black"
                            />
                            <p className="text-xs text-muted">
                              Kaynak: {v.previewSource === "ffmpeg" ? "sunucuda otomatik" : "editör yüklemesi"} · {v.watermarked ? "filigranlı" : "filigransız — dikkat"}
                              {v.blurred ? " · bulanık" : ""}
                              {v.qcApprovedAt ? ` · KK onayı: ${formatDateTime(v.qcApprovedAt)} (${v.qcBy?.name ?? ""})` : ""}
                            </p>
                          </>
                        ) : (
                          <p className="text-sm text-muted">Henüz yok.</p>
                        )}
                        {v.status !== "COMPLETED" && v.status !== "PREVIEW_READY" && (
                          <div className="space-y-3">
                            {caps.available && v.masterFile && (
                              <ActionForm action={generatePreviewAction.bind(null, v.id)} submitLabel="Ön izlemeyi ana dosyadan üret (ffmpeg)" pendingLabel="Üretiliyor…" variant="secondary" />
                            )}
                            {!caps.available && (
                              <p className="text-xs text-muted">Sunucuda ffmpeg tanımlı değil; ön izlemeyi editörün dışa aktardığı kısa kesitle yükleyin.</p>
                            )}
                            <details>
                              <summary className="cursor-pointer text-sm font-semibold text-brand">Ön izlemeyi elle yükle</summary>
                              <div className="mt-3">
                                <PreviewUpload videoId={v.id} previewRule={rules.TRIAL_PREVIEW} posterRule={rules.TRIAL_POSTER} />
                              </div>
                            </details>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-3 border-t border-line pt-4">
                      {v.status === "EDITOR_REVIEW" && (
                        <ActionForm
                          action={approvePreviewAction.bind(null, v.id)}
                          submitLabel="Kalite kontrol: onayla ve müşteriye aç"
                          confirm="Ön izleme müşteriye açılacak. Ana dosya ve kesit kontrol edildi mi?"
                        />
                      )}
                      {v.status === "FAILED" && <ActionForm action={retryVideoAction.bind(null, v.id)} submitLabel="Yeniden kuyruğa al" variant="secondary" />}
                    </div>
                  </div>
                )}
              </Section>
            );
          })}
        </div>

        <aside className="min-w-0 space-y-6">
          {canCheck && (
            <Section title="Dosya kontrolü" description="Dosyalar ve sözler uygunsa onaylayın; ön izleme süresi bu anda başlar.">
              <div className="space-y-4">
                <ActionForm action={verifyFilesAction.bind(null, trial.id)} submitLabel="Dosyalar uygun — kuyruğa al" confirm="Dosyalar ve sözler kontrol edildi mi? Ön izleme süresi başlayacak." />
                <ActionForm action={requestInfoAction.bind(null, trial.id)} submitLabel="Müşteriden ek bilgi iste" variant="secondary">
                  <Textarea name="message" rows={3} placeholder="Ör. Ses dosyası ile sözler farklı şarkıya ait görünüyor; doğru ses dosyasını yükler misin?" aria-label="Müşteriye mesaj" />
                </ActionForm>
              </div>
            </Section>
          )}
          {otherPurchaseOrders.length > 0 && (
            <Section
              title={trial.convertedOrderId ? "Diğer satın alma denemeleri" : "Satın alma denemeleri"}
              description="Bu denemeden başlatılmış, satın almaya dönüşmemiş siparişler (ör. ödeme bekleyen)."
            >
              <ul className="space-y-2 text-sm">
                {otherPurchaseOrders.map((o) => (
                  <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line px-3 py-2">
                    <span>
                      <Link href={`/admin/siparisler/${o.number}`} className="font-semibold text-brand hover:underline">
                        {o.number}
                      </Link>
                      <span className="block text-xs text-muted">
                        {formatDateTime(o.createdAt)} · {formatMoney(o.priceKurus, o.currency)}
                      </span>
                    </span>
                    <OrderStatusBadge status={o.status} />
                  </li>
                ))}
              </ul>
            </Section>
          )}
          {!trial.convertedOrderId && trial.status !== "CANCELLED" && (
            <Section title="Başvuruyu kapat">
              <ActionForm action={cancelTrialAction.bind(null, trial.id)} submitLabel="Denemeyi iptal et" variant="danger" confirm="Deneme iptal edilecek ve müşteri bilgilendirilecek.">
                <Input name="reason" placeholder="Gerekçe (müşteriye gösterilir)" aria-label="Gerekçe" />
              </ActionForm>
            </Section>
          )}
          <Section title="Geçmiş">
            <ol className="space-y-3 text-sm">
              {trial.events.map((e) => (
                <li key={e.id}>
                  <p className="text-ink-soft">
                    {e.message} {!e.visibleToCustomer && <Badge>iç</Badge>}
                  </p>
                  <p className="text-xs text-muted">
                    {formatDateTime(e.createdAt)}
                    {e.actor ? ` · ${e.actor.name}` : ""}
                  </p>
                </li>
              ))}
            </ol>
          </Section>
        </aside>
      </div>
    </div>
  );
}
