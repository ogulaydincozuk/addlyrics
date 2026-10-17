import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Download, Eye, EyeOff, MessageSquare } from "lucide-react";
import { OrderStatusBadge, PaymentStatusBadge } from "@/components/order/status-badge";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Alert, Badge, KeyValue } from "@/components/ui/primitives";
import { formatBytes } from "@/components/upload/upload-client";
import { messages } from "@/i18n/config";
import { formatDate, formatDateTime, toDateInputValue } from "@/lib/dates";
import { VIDEO_FORMATS } from "@/lib/enums";
import { formatMoney } from "@/lib/money";
import { MESSAGE_EVENT_TYPES, MESSAGE_THREAD_LABELS, MESSAGE_THREAD_TONES, messageThreadState } from "@/lib/order-messages";
import { cn } from "@/lib/cn";
import { missingRequiredItems, REQUIRED_ITEM_LABELS } from "@/lib/order-requirements";
import { allowedTransitions } from "@/lib/order-status";
import { snapshotTotalVideos, type PackageSnapshot } from "@/lib/packages";
import { COMMISSION_STATUS_LABEL } from "@/lib/referral";
import { requireAdmin } from "@/server/auth/guards";
import { db } from "@/server/db";
import { publicFileRules } from "@/server/storage/file-rules";
import { ActionForm } from "../../_forms";
import { AdminPage, customerHref, customerOrdersHref, Section } from "../../_ui";
import {
  assignEditorAction,
  changeStatusAction,
  customerNoteAction,
  internalNoteAction,
  markMessagesHandledAction,
  refundPaymentAction,
  releaseDeliverableAction,
  setDueDateAction,
  unassignEditorAction,
  updateProjectAction,
} from "../actions";
import { DeliverableUploader } from "./deliverable-uploader";

export const metadata: Metadata = { title: "Sipariş Yönetimi" };

export default function AdminOrderPage({ params }: PageProps<"/admin/siparisler/[numara]">) {
  return (
    <div>
      <Link href="/admin/siparisler" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-brand">
        <ArrowLeft className="size-4" aria-hidden /> Siparişler
      </Link>
      <AdminPage title="Sipariş yönetimi">
        <OrderAdmin params={params} />
      </AdminPage>
    </div>
  );
}

async function OrderAdmin({ params }: Pick<PageProps<"/admin/siparisler/[numara]">, "params">) {
  await requireAdmin();
  const { numara } = await params;
  const order = await db.order.findUnique({
    where: { number: numara },
    include: {
      user: { select: { id: true, name: true, email: true, phone: true, artistName: true } },
      song: true,
      entitlement: true,
      files: { where: { status: "UPLOADED", kind: { not: "DELIVERABLE" } }, orderBy: { createdAt: "asc" } },
      projects: {
        orderBy: { sequence: "asc" },
        include: {
          deliverables: { orderBy: { version: "desc" }, include: { file: { select: { id: true, originalName: true, sizeBytes: true } }, uploadedBy: { select: { name: true } } } },
        },
      },
      assignments: { orderBy: { assignedAt: "desc" }, include: { editor: true, assignedBy: { select: { name: true } } } },
      events: { orderBy: { createdAt: "desc" }, take: 100, include: { actor: { select: { name: true } } } },
      payments: { orderBy: { createdAt: "desc" } },
      referralCode: { select: { id: true, code: true } },
      partner: { select: { id: true, name: true } },
      commission: { select: { id: true, status: true, amountKurus: true, partnerId: true } },
      // Denemeden satın alma: ödeme bekleyen sipariş trialApplication, tamamlanan dönüşüm convertedTrial üzerinden bağlıdır
      trialApplication: { select: { number: true } },
      convertedTrial: { select: { number: true } },
    },
  });
  if (!order) notFound();
  const editors = await db.editor.findMany({ where: { active: true }, orderBy: { name: "asc" } });

  const t = messages();
  const snapshot = order.packageSnapshot as unknown as PackageSnapshot;
  const activeAssignment = order.assignments.find((a) => a.active);
  const transitions = allowedTransitions(order.status, "admin");
  const missing = missingRequiredItems({
    style: order.style,
    footageSource: order.footageSource,
    lyricsText: order.song.lyrics,
    fileKinds: order.files.map((f) => f.kind),
  });
  const deliverableRule = publicFileRules().DELIVERABLE;
  const canDeliver = !["PAYMENT_PENDING", "CANCELLED"].includes(order.status);
  // Müşteriyle mesajlaşma: olaylar yeniden eskiye sıralı gelir
  const threadState = messageThreadState(order.events.find((e) => (MESSAGE_EVENT_TYPES as readonly string[]).includes(e.type))?.type);
  const thread = order.events.filter((e) => e.type === "CUSTOMER_MESSAGE" || e.type === "NOTE").reverse();
  const lastCustomerMessage = order.events.find((e) => e.type === "CUSTOMER_MESSAGE");
  const trialNumber = order.trialApplication?.number ?? order.convertedTrial?.number ?? null;

  return (
    <div className="space-y-6">
      {/* Üst bilgi */}
      <div className="rounded-2xl border border-line bg-card p-5 shadow-[var(--shadow-card)] sm:p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <p className="text-sm text-muted">
              {order.number} · {order.kind === "PURCHASE" ? "Paket satın alma" : "Paket hakkından"} · {formatDateTime(order.createdAt)}
            </p>
            <h2 className="mt-1 text-xl font-extrabold text-ink">
              {order.song.artistName} – {order.song.title}
            </h2>
            <p className="mt-1 text-sm text-muted">
              <Link href={customerHref(order.user.email)} className="font-semibold text-ink hover:text-brand hover:underline">
                {order.user.name}
              </Link>{" "}
              · <a href={`mailto:${order.user.email}`} className="text-brand hover:underline">{order.user.email}</a>
              {order.user.phone ? ` · ${order.user.phone}` : ""} ·{" "}
              <Link href={customerOrdersHref(order.user.email)} className="text-brand hover:underline">
                Diğer siparişleri
              </Link>
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <OrderStatusBadge status={order.status} />
            {snapshot.isSample && <Badge tone="warning">Örnek paket</Badge>}
          </div>
        </div>
        <dl className="mt-5 grid gap-4 border-t border-line pt-5 sm:grid-cols-2 xl:grid-cols-4">
          <KeyValue label="Paket">{snapshot.name}</KeyValue>
          <KeyValue label="Bu siparişte">{order.videoCount} video</KeyValue>
          <KeyValue label="Paket hakkı">
            {order.entitlement ? `${order.entitlement.usedVideos}/${order.entitlement.totalVideos} kullanıldı · ${formatDate(order.entitlement.endsAt)}` : `Henüz tanımlanmadı (toplam ${snapshotTotalVideos(snapshot)})`}
          </KeyValue>
          <KeyValue label="Editör">{activeAssignment ? activeAssignment.editor.name : "Atanmadı"}</KeyValue>
          {order.kind === "PURCHASE" && (
            <KeyValue label="Tutar">
              {formatMoney(order.priceKurus, order.currency)}
              {order.discountKurus > 0 && (
                <span className="block text-xs text-muted">
                  Liste {formatMoney(order.listPriceKurus ?? order.priceKurus + order.discountKurus, order.currency)} · indirim −{formatMoney(order.discountKurus, order.currency)}
                </span>
              )}
            </KeyValue>
          )}
          {order.referralCode && (
            <KeyValue label="Referans kodu">
              <Link href={`/admin/referans-kodlari/${order.referralCode.id}`} className="font-semibold text-brand hover:underline">
                {order.referralCode.code}
              </Link>
            </KeyValue>
          )}
          {order.partner && (
            <KeyValue label="İş ortağı">
              <Link href={`/admin/is-ortaklari/${order.partner.id}`} className="text-brand hover:underline">
                {order.partner.name}
              </Link>
            </KeyValue>
          )}
          {order.commission && (
            <KeyValue label="Komisyon">
              <Link href={`/admin/komisyonlar?ortak=${order.commission.partnerId}`} className="text-brand hover:underline">
                {COMMISSION_STATUS_LABEL[order.commission.status]} · {formatMoney(order.commission.amountKurus)}
              </Link>
            </KeyValue>
          )}
          {trialNumber && (
            <KeyValue label="Deneme">
              <Link href={`/admin/denemeler/${trialNumber}`} className="text-brand hover:underline">
                {trialNumber}
              </Link>
            </KeyValue>
          )}
        </dl>
        {threadState === "AWAITING_REPLY" && lastCustomerMessage && (
          <Alert tone="warning" title="Müşteri yanıt bekliyor" className="mt-4">
            <span className="line-clamp-2">“{lastCustomerMessage.message}”</span>{" "}
            <a href="#mesajlar" className="font-semibold underline">
              Mesajlaşmaya git
            </a>
          </Alert>
        )}
        {missing.length > 0 && order.status !== "CANCELLED" && (
          <Alert tone="warning" title="Eksik dosyalar" className="mt-4">
            {missing.map((m) => REQUIRED_ITEM_LABELS[m]).join(" · ")}
          </Alert>
        )}
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 2xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          {/* Videolar ve teslimler */}
          <Section title="Videolar ve teslimler" description="Her video için yüklenen sürümler. Müşteri yalnızca teslim edilen sürümleri görür.">
            {order.projects.length === 0 ? (
              <p className="text-sm text-muted">Video işleri ödeme onaylandığında oluşturulur.</p>
            ) : (
              <div className="space-y-5">
                {order.projects.map((p) => {
                  return (
                    <div key={p.id} className="rounded-2xl border border-line p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-semibold text-ink">
                          {p.title} {p.format && <span className="text-sm font-normal text-muted">· {t.enums.videoFormat[p.format]}</span>}
                        </p>
                        <span className="text-xs text-muted">
                          {p.dueDate ? `Planlanan teslim ${formatDate(p.dueDate)}` : "Teslim tarihi yok"}
                          {p.deliveredAt ? ` · Teslim edildi ${formatDate(p.deliveredAt)}` : ""}
                        </span>
                      </div>

                      <ActionForm action={updateProjectAction.bind(null, p.id)} submitLabel="Planı kaydet" variant="secondary" inline className="mt-3">
                        <Input name="title" defaultValue={p.title} className="h-9 w-32 text-sm" aria-label="Video adı" />
                        <Select name="format" defaultValue={p.format ?? ""} className="h-9 w-36 text-sm" aria-label="Format">
                          <option value="">Format seç</option>
                          {VIDEO_FORMATS.map((f) => (
                            <option key={f} value={f}>
                              {t.enums.videoFormat[f]}
                            </option>
                          ))}
                        </Select>
                        <Input type="date" name="dueDate" defaultValue={toDateInputValue(p.dueDate)} className="h-9 w-40 text-sm" aria-label="Video teslim tarihi" />
                      </ActionForm>

                      {p.deliverables.length > 0 && (
                        <ul className="mt-4 space-y-2">
                          {p.deliverables.map((d) => (
                            <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-canvas px-3 py-2.5 text-sm ring-1 ring-line">
                              <span className="min-w-0">
                                <strong>v{d.version}</strong> · {d.file.originalName} ({formatBytes(Number(d.file.sizeBytes))}) · {d.uploadedBy.name}
                                {d.note && <span className="block text-xs text-muted">Not: {d.note}</span>}
                              </span>
                              <span className="flex items-center gap-3">
                                <a href={`/api/files/${d.file.id}?inline=1`} target="_blank" rel="noopener" className="inline-flex items-center gap-1 font-semibold text-brand hover:underline">
                                  İzle
                                </a>
                                {d.releasedAt ? (
                                  <Badge tone="success">
                                    <Eye className="size-3" aria-hidden /> Teslim edildi
                                  </Badge>
                                ) : (
                                  <>
                                    <Badge tone="neutral">
                                      <EyeOff className="size-3" aria-hidden /> Müşteriye kapalı
                                    </Badge>
                                    <ActionForm
                                      action={releaseDeliverableAction.bind(null, d.id)}
                                      submitLabel="Müşteriye teslim et"
                                      confirm="Bu video müşteriye açılacak ve e-posta ile bildirilecek. Devam edilsin mi?"
                                      inline
                                    />
                                  </>
                                )}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}

                      {canDeliver && (
                        <div className="mt-4">
                          <DeliverableUploader projectId={p.id} rule={deliverableRule} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </Section>

          {/* Müşteri dosyaları ve brif */}
          <Section title="Müşteri dosyaları">
            {order.files.length ? (
              <ul className="space-y-2">
                {order.files.map((f) => (
                  <li key={f.id} className="flex items-center justify-between gap-3 rounded-xl border border-line px-3 py-2.5 text-sm">
                    <span className="min-w-0 truncate">
                      <span className="text-muted">{t.enums.fileKind[f.kind]}:</span> {f.originalName}{" "}
                      <span className="text-xs text-muted">({formatBytes(Number(f.sizeBytes))})</span>
                    </span>
                    <span className="flex shrink-0 gap-3">
                      {(f.kind === "SONG_AUDIO" || f.kind === "MUSIC_VIDEO" || f.kind === "FOOTAGE" || f.kind === "IMAGE") && (
                        <a href={`/api/files/${f.id}?inline=1`} target="_blank" rel="noopener" className="font-semibold text-brand hover:underline">
                          Aç
                        </a>
                      )}
                      <a href={`/api/files/${f.id}`} className="inline-flex items-center gap-1 font-semibold text-brand hover:underline">
                        <Download className="size-3.5" aria-hidden /> İndir
                      </a>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">Dosya yok.</p>
            )}
          </Section>

          <Section title="Brif">
            <dl className="grid gap-4 sm:grid-cols-2">
              <KeyValue label="Tarz">
                {t.enums.videoStyle[order.style]}
                {order.footageSource && <span className="block text-muted">{t.enums.footageSource[order.footageSource]}</span>}
              </KeyValue>
              <KeyValue label="Formatlar">{order.formats.map((f) => t.enums.videoFormat[f]).join(", ")}</KeyValue>
              <KeyValue label="Platformlar">
                {order.platforms.map((p) => (p === "OTHER" && order.otherPlatform ? order.otherPlatform : t.enums.platform[p])).join(", ")}
              </KeyValue>
              <KeyValue label="Şarkı">
                {t.enums.releaseStatus[order.song.releaseStatus]} · {order.song.language}
                {order.song.streamingUrl && (
                  <a href={order.song.streamingUrl} target="_blank" rel="noopener noreferrer nofollow" className="block break-all text-brand hover:underline">
                    {order.song.streamingUrl}
                  </a>
                )}
              </KeyValue>
              {order.customStyleRequest && <KeyValue label="Özel tasarım talebi" className="sm:col-span-2">{order.customStyleRequest}</KeyValue>}
              {order.fontPreference && <KeyValue label="Font">{order.fontPreference}</KeyValue>}
              {order.colorPreference && <KeyValue label="Renk">{order.colorPreference}</KeyValue>}
              {order.referenceUrl && (
                <KeyValue label="Referans">
                  <a href={order.referenceUrl} target="_blank" rel="noopener noreferrer nofollow" className="break-all text-brand hover:underline">
                    {order.referenceUrl}
                  </a>
                </KeyValue>
              )}
              {order.notesForEditor && <KeyValue label="Editöre notlar" className="sm:col-span-2">{order.notesForEditor}</KeyValue>}
              <KeyValue label="Sözler" className="sm:col-span-2">
                {order.song.lyrics ? (
                  <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-xl bg-canvas p-3 font-sans text-sm ring-1 ring-line">{order.song.lyrics}</pre>
                ) : (
                  <span className="text-muted">Metin yok (dosya olarak gönderilmiş olabilir)</span>
                )}
              </KeyValue>
              <KeyValue label="Onaylar" className="sm:col-span-2">
                Koşullar {formatDateTime(order.termsAcceptedAt)} ({order.termsVersion}) · Kullanım hakkı beyanı {formatDateTime(order.rightsConfirmedAt)}
                {order.distanceSalesAcceptedAt && <> · Mesafeli satış {formatDateTime(order.distanceSalesAcceptedAt)}</>}
              </KeyValue>
            </dl>
          </Section>
        </div>

        <div className="space-y-6">
          <div id="mesajlar" className="scroll-mt-24">
            <Section
              title="Müşteriyle mesajlaşma"
              description="Üretim öncesi soruları buradan sor; müşteri panelinde ve e-postada görür, sipariş sayfasından yanıtlar."
              actions={threadState && <Badge tone={MESSAGE_THREAD_TONES[threadState]}>{MESSAGE_THREAD_LABELS[threadState]}</Badge>}
            >
              {thread.length ? (
                <ol className="mb-4 max-h-[420px] space-y-3 overflow-y-auto pr-1">
                  {thread.map((ev) => {
                    const fromCustomer = ev.type === "CUSTOMER_MESSAGE";
                    return (
                      <li key={ev.id} className={cn("flex", fromCustomer ? "justify-start" : "justify-end")}>
                        <div className={cn("max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm", fromCustomer ? "bg-canvas ring-1 ring-line" : "bg-brand-tint text-brand-ink")}>
                          <p className="text-xs font-semibold text-muted">
                            {fromCustomer ? `Müşteri · ${order.user.name}` : `Ekip${ev.actor ? ` · ${ev.actor.name}` : ""}`} · {formatDateTime(ev.createdAt)}
                          </p>
                          <p className="mt-1 whitespace-pre-wrap break-words text-ink">{ev.message}</p>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              ) : (
                <p className="mb-4 flex items-center gap-2 text-sm text-muted">
                  <MessageSquare className="size-4" aria-hidden /> Henüz mesaj yok.
                </p>
              )}
              <ActionForm action={customerNoteAction.bind(null, order.id)} submitLabel={threadState === "AWAITING_REPLY" ? "Yanıtı gönder" : "Gönder"}>
                <Textarea name="message" rows={3} aria-label="Müşteriye mesaj" placeholder={threadState === "AWAITING_REPLY" ? "Yanıtını yaz…" : "Müşteriye soru veya not yaz…"} />
              </ActionForm>
              {threadState === "AWAITING_REPLY" && (
                <ActionForm action={markMessagesHandledAction.bind(null, order.id)} submitLabel="Yanıt gerekmiyor" variant="ghost" className="mt-2" />
              )}
            </Section>
          </div>

          <Section title="Durum">
            {transitions.length ? (
              <ActionForm action={changeStatusAction.bind(null, order.id)} submitLabel="Durumu güncelle">
                <Field label="Yeni durum" htmlFor="to">
                  <Select id="to" name="to" defaultValue={transitions[0]}>
                    {transitions.map((s) => (
                      <option key={s} value={s}>
                        {t.enums.orderStatus[s]}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Müşteriye not" htmlFor="note" optional hint="Durum bildirimine eklenir.">
                  <Textarea id="note" name="note" rows={2} />
                </Field>
              </ActionForm>
            ) : (
              <p className="text-sm text-muted">
                {order.status === "PAYMENT_PENDING" ? "Ödeme bekleniyor. Paket hakkı yalnızca doğrulanmış ödemeyle tanımlanır." : "Bu durumdan geçiş yok."}
              </p>
            )}
            {order.status === "PAYMENT_PENDING" && (
              <ActionForm action={changeStatusAction.bind(null, order.id)} submitLabel="Siparişi iptal et" variant="danger" className="mt-3" confirm="Ödenmemiş sipariş iptal edilecek. Emin misin?">
                <input type="hidden" name="to" value="CANCELLED" />
              </ActionForm>
            )}
          </Section>

          <Section title="Editör ataması">
            {activeAssignment && (
              <div className="mb-3 flex items-center justify-between gap-2 rounded-xl bg-canvas px-3 py-2.5 text-sm ring-1 ring-line">
                <span>
                  <strong>{activeAssignment.editor.name}</strong>
                  <span className="block text-xs text-muted">
                    {formatDateTime(activeAssignment.assignedAt)} · {activeAssignment.assignedBy.name}
                  </span>
                </span>
                <ActionForm action={unassignEditorAction.bind(null, order.id)} submitLabel="Kaldır" variant="ghost" inline />
              </div>
            )}
            {editors.length ? (
              <ActionForm action={assignEditorAction.bind(null, order.id)} submitLabel={activeAssignment ? "Yeniden ata" : "Ata"}>
                <Select name="editorId" defaultValue="" aria-label="Editör">
                  <option value="" disabled>
                    Editör seç
                  </option>
                  {editors.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name}
                      {e.specialties.length ? ` (${e.specialties.map((s) => t.enums.videoStyleShort[s]).join(", ")})` : ""}
                    </option>
                  ))}
                </Select>
                <Input name="note" placeholder="Atama notu (iç)" aria-label="Atama notu" />
              </ActionForm>
            ) : (
              <p className="text-sm text-muted">
                Aktif editör yok.{" "}
                <Link href="/admin/editorler" className="font-semibold text-brand hover:underline">
                  Editör ekle
                </Link>
              </p>
            )}
          </Section>

          <Section title="Teslim tarihi">
            <ActionForm action={setDueDateAction.bind(null, order.id)} submitLabel="Kaydet" inline>
              <Input type="date" name="dueDate" defaultValue={toDateInputValue(order.dueDate)} className="w-44" aria-label="Planlanan teslim tarihi" />
            </ActionForm>
            <p className="mt-2 text-xs text-muted">Müşteri panelinde görünür. Boş bırakıp kaydedersen kaldırılır.</p>
          </Section>

          <Section title="İç not" description="Yalnızca ekip görür.">
            <ActionForm action={internalNoteAction.bind(null, order.id)} submitLabel="Not ekle" variant="secondary">
              <Textarea name="message" rows={2} aria-label="İç not" />
            </ActionForm>
          </Section>

          {order.payments.length > 0 && (
            <Section title="Ödemeler">
              <ul className="space-y-3">
                {order.payments.map((p) => (
                  <li key={p.id} className="rounded-xl border border-line p-3 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold">{formatMoney(p.amountKurus, p.currency)}</span>
                      <PaymentStatusBadge status={p.status} />
                    </div>
                    <p className="mt-1 text-xs text-muted">
                      {t.enums.paymentProvider[p.provider]} · {formatDateTime(p.createdAt)}
                      {p.providerPaymentId ? ` · Ref: ${p.providerPaymentId}` : ""}
                      {p.providerReference ? ` · ${p.providerReference}` : ""}
                    </p>
                    {p.failureReason && <p className="mt-1 text-xs text-danger">{p.failureReason}</p>}
                    {p.status === "SUCCEEDED" && (
                      <ActionForm
                        action={refundPaymentAction.bind(null, p.id)}
                        submitLabel="İade edildi olarak işaretle"
                        variant="secondary"
                        className="mt-2"
                        confirm="Ödeme iade edildi olarak işaretlenecek ve bu ödemeden doğan paket hakkı kapatılacak. Para iadesini sağlayıcı panelinden ayrıca yapmalısın. Devam?"
                      >
                        <Input name="reason" placeholder="İade nedeni" className="h-9 text-sm" aria-label="İade nedeni" />
                      </ActionForm>
                    )}
                  </li>
                ))}
              </ul>
            </Section>
          )}

          <Section title="Geçmiş">
            <ol className="max-h-[520px] space-y-3 overflow-y-auto pr-1">
              {order.events.map((ev) => (
                <li key={ev.id} className="border-l-2 border-line pl-3 text-sm">
                  <p className="text-ink">
                    {ev.type === "CUSTOMER_MESSAGE" && <strong className="text-brand">Müşteri: </strong>}
                    {ev.type === "NOTE" && <strong>Müşteriye: </strong>}
                    {ev.toStatus && <strong>{t.enums.orderStatus[ev.toStatus]}</strong>}
                    {ev.toStatus && ev.message ? " — " : ""}
                    {ev.message}
                    {!ev.visibleToCustomer && <span className="ml-1.5 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-slate-500">iç</span>}
                  </p>
                  <p className="text-xs text-muted">
                    {formatDateTime(ev.createdAt)}
                    {ev.actor ? ` · ${ev.actor.name}` : " · sistem"}
                  </p>
                </li>
              ))}
            </ol>
          </Section>
        </div>
      </div>
    </div>
  );
}
