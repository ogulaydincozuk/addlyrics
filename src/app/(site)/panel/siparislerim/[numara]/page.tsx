import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft, CalendarClock, Download, FileText, MessagesSquare, PartyPopper } from "lucide-react";
import { OrderProgress } from "@/components/order/order-progress";
import { OrderStatusBadge, PaymentStatusBadge } from "@/components/order/status-badge";
import { LinkButton } from "@/components/ui/button";
import { Alert, Badge, Card, KeyValue, PageSkeleton } from "@/components/ui/primitives";
import { formatBytes } from "@/components/upload/upload-client";
import { messages } from "@/i18n/config";
import { formatDate, formatDateTime } from "@/lib/dates";
import type { CustomerFileKind } from "@/lib/enums";
import { formatMoney } from "@/lib/money";
import { missingRequiredItems, REQUIRED_ITEM_LABELS } from "@/lib/order-requirements";
import { CUSTOMER_EDITABLE_STATUSES } from "@/lib/order-status";
import { NO_REVISION_TEXT, PREPARATION_TEXT, type PackageSnapshot } from "@/lib/packages";
import { requireUser } from "@/server/auth/guards";
import { getOrderDetail } from "@/server/queries/customer";
import { publicFileRules } from "@/server/storage/file-rules";
import { LyricsForm, OrderFilesManager, OrderMessageForm } from "./client";

export const metadata: Metadata = { title: "Sipariş Detayı" };

export default function OrderDetailPage({ params, searchParams }: PageProps<"/panel/siparislerim/[numara]">) {
  return (
    <div>
      <Link href="/panel/siparislerim" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-brand">
        <ArrowLeft className="size-4" aria-hidden /> Siparişlerim
      </Link>
      <Suspense fallback={<PageSkeleton />}>
        <OrderDetail params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function OrderDetail({ params, searchParams }: PageProps<"/panel/siparislerim/[numara]">) {
  const { numara } = await params;
  const sp = await searchParams;
  const user = await requireUser(`/panel/siparislerim/${numara}`);
  const order = await getOrderDetail(user.id, numara);
  if (!order) notFound();

  const t = messages();
  const snapshot = order.packageSnapshot as unknown as PackageSnapshot;
  const MESSAGE_TYPES = ["NOTE", "CUSTOMER_MESSAGE"];
  const orderMessages = order.events.filter((e) => MESSAGE_TYPES.includes(e.type)).reverse();
  const history = order.events.filter((e) => !MESSAGE_TYPES.includes(e.type));
  const editable = CUSTOMER_EDITABLE_STATUSES.includes(order.status);
  const fileKinds = order.files.map((f) => f.kind);
  const missing = missingRequiredItems({ style: order.style, footageSource: order.footageSource, lyricsText: order.song.lyrics, fileKinds });

  const uploadKinds: CustomerFileKind[] = ["SONG_AUDIO", "LYRICS"];
  if (order.style === "MUSIC_VIDEO") uploadKinds.push("MUSIC_VIDEO");
  if (order.style === "FILM_EDIT" && order.footageSource === "CUSTOMER_PROVIDED") uploadKinds.push("FOOTAGE");
  uploadKinds.push("IMAGE");

  const initialFiles: Partial<Record<CustomerFileKind, Array<{ id: string; kind: CustomerFileKind; name: string; size: number }>>> = {};
  for (const f of order.files) {
    const kind = f.kind as CustomerFileKind;
    (initialFiles[kind] ??= []).push({ id: f.id, kind, name: f.originalName, size: Number(f.sizeBytes) });
  }

  return (
    <div className="space-y-6">
      {sp.olusturuldu === "1" && (
        <Alert tone="success" title="Siparişin oluşturuldu">
          Paket hakkından {order.videoCount} video kullanıldı. Süreci bu sayfadan takip edebilirsin.
        </Alert>
      )}

      <Card className="p-5 sm:p-7">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-medium text-muted">Sipariş {order.number}</p>
            <h1 className="mt-1 text-2xl font-extrabold text-ink">
              {order.song.artistName} – {order.song.title}
            </h1>
            <p className="mt-1 text-sm text-muted">
              {snapshot.name} · {order.videoCount} video · {formatDate(order.createdAt)}
            </p>
          </div>
          <OrderStatusBadge status={order.status} />
        </div>
        <p className="mt-4 text-sm text-ink-soft">{t.enums.orderStatusHelp[order.status]}</p>
        <div className="mt-5">
          <OrderProgress status={order.status} />
        </div>
        {order.dueDate && (
          <p className="mt-5 flex items-center gap-2 rounded-xl bg-brand-tint px-4 py-3 text-sm text-brand-ink">
            <CalendarClock className="size-4" aria-hidden /> Planlanan teslim tarihi: <strong>{formatDate(order.dueDate)}</strong>
          </p>
        )}
        {order.status === "PAYMENT_PENDING" && (
          <div className="mt-5 flex flex-col gap-3 rounded-xl border border-[#fde68a] bg-warning-soft p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-[#78350f]">Ödemen tamamlandığında paketin aktifleşir ve üretim başlar.</p>
            <LinkButton href={`/siparis/${order.number}/odeme`} size="sm">
              Ödemeyi Tamamla — {formatMoney(order.priceKurus, order.currency)}
            </LinkButton>
          </div>
        )}
      </Card>

      {/* Videolar */}
      {order.projects.length > 0 && (
        <section aria-labelledby="videolar">
          <h2 id="videolar" className="mb-3 text-lg font-bold text-ink">
            Videolar
          </h2>
          <div className="grid gap-4 xl:grid-cols-2">
            {order.projects.map((p) => {
              const latest = p.deliverables[0];
              return (
                <Card key={p.id} className="overflow-hidden">
                  {latest ? (
                    <video
                      controls
                      preload="metadata"
                      playsInline
                      className="aspect-video w-full bg-black"
                      src={`/api/files/${latest.file.id}?inline=1`}
                    />
                  ) : (
                    <div className="flex aspect-video items-center justify-center bg-canvas text-center text-sm text-muted">
                      <div>
                        <PartyPopper className="mx-auto mb-2 size-6 text-brand-soft" aria-hidden />
                        Video hazırlandığında burada görünecek
                      </div>
                    </div>
                  )}
                  <div className="space-y-3 p-5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold text-ink">
                        {p.title}
                        {p.format && <span className="ml-2 text-sm font-normal text-muted">{t.enums.videoFormat[p.format]}</span>}
                      </p>
                      {latest ? <Badge tone="success">Teslim edildi</Badge> : <Badge tone="neutral">Hazırlanıyor</Badge>}
                    </div>
                    {latest && (
                      <div className="flex flex-wrap items-center gap-3 text-sm">
                        <a href={`/api/files/${latest.file.id}`} className="inline-flex items-center gap-1.5 font-semibold text-brand hover:underline">
                          <Download className="size-4" aria-hidden /> İndir (v{latest.version}, {formatBytes(Number(latest.file.sizeBytes))})
                        </a>
                        {latest.note && <span className="text-muted">Editör notu: {latest.note}</span>}
                      </div>
                    )}
                    {!latest && p.dueDate && <p className="text-xs text-muted">Planlanan teslim: {formatDate(p.dueDate)}</p>}
                  </div>
                </Card>
              );
            })}
          </div>
        </section>
      )}

      {/* Dosyalar */}
      <Card className="p-5 sm:p-7">
        <h2 className="text-lg font-bold text-ink">Dosyalar</h2>
        {missing.length > 0 && order.status !== "CANCELLED" && (
          <Alert tone="warning" title="Üretim için eksik olanlar" className="mt-4">
            <ul className="list-disc pl-5">
              {missing.map((m) => (
                <li key={m}>{REQUIRED_ITEM_LABELS[m]}</li>
              ))}
            </ul>
          </Alert>
        )}
        <div className="mt-5">
          {editable ? (
            <OrderFilesManager orderId={order.id} kinds={uploadKinds} initial={initialFiles} rules={publicFileRules()} />
          ) : order.files.length ? (
            <ul className="space-y-2">
              {order.files.map((f) => (
                <li key={f.id} className="flex items-center justify-between gap-3 rounded-xl border border-line px-4 py-3 text-sm">
                  <span className="min-w-0 truncate">
                    <span className="text-muted">{t.enums.fileKind[f.kind]}:</span> {f.originalName}
                  </span>
                  <a href={`/api/files/${f.id}`} className="shrink-0 font-semibold text-brand hover:underline">
                    İndir
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">Bu siparişe dosya eklenmemiş.</p>
          )}
          {!editable && order.status !== "CANCELLED" && (
            <p className="mt-3 text-xs text-muted">Sipariş üretim aşamasında olduğu için dosya ekleme kapalı. Ek dosya için ekibimizle iletişime geç.</p>
          )}
        </div>
      </Card>

      {/* Sözler */}
      <Card className="p-5 sm:p-7">
        <h2 className="flex items-center gap-2 text-lg font-bold text-ink">
          <FileText className="size-5 text-brand" aria-hidden /> Şarkı sözleri
        </h2>
        <div className="mt-4">
          {editable ? (
            <LyricsForm orderNumber={order.number} initial={order.song.lyrics ?? ""} />
          ) : order.song.lyrics ? (
            <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-xl bg-canvas p-4 font-sans text-sm text-ink-soft ring-1 ring-line">{order.song.lyrics}</pre>
          ) : (
            <p className="text-sm text-muted">Sözler dosya olarak gönderildi.</p>
          )}
        </div>
      </Card>

      {/* Tercihler */}
      <Card className="p-5 sm:p-7">
        <h2 className="text-lg font-bold text-ink">Sipariş bilgileri</h2>
        <dl className="mt-5 grid gap-5 sm:grid-cols-2">
          <KeyValue label="Görsel tarz">
            {t.enums.videoStyle[order.style]}
            {order.footageSource && <span className="block text-muted">{t.enums.footageSource[order.footageSource]}</span>}
          </KeyValue>
          <KeyValue label="Formatlar">{order.formats.map((f) => t.enums.videoFormat[f]).join(", ")}</KeyValue>
          <KeyValue label="Platformlar">
            {order.platforms.map((p) => (p === "OTHER" && order.otherPlatform ? order.otherPlatform : t.enums.platform[p])).join(", ")}
          </KeyValue>
          <KeyValue label="Şarkı">
            {t.enums.releaseStatus[order.song.releaseStatus]} · {order.song.language}
          </KeyValue>
          {order.customStyleRequest && <KeyValue label="Özel tasarım talebi" className="sm:col-span-2">{order.customStyleRequest}</KeyValue>}
          {order.fontPreference && <KeyValue label="Font tercihi">{order.fontPreference}</KeyValue>}
          {order.colorPreference && <KeyValue label="Renk tercihi">{order.colorPreference}</KeyValue>}
          {order.referenceUrl && (
            <KeyValue label="Referans video">
              <a href={order.referenceUrl} target="_blank" rel="noopener noreferrer nofollow" className="break-all text-brand hover:underline">
                {order.referenceUrl}
              </a>
            </KeyValue>
          )}
          {order.notesForEditor && <KeyValue label="Editöre notlar" className="sm:col-span-2">{order.notesForEditor}</KeyValue>}
          <KeyValue label="Hazırlık süreci" className="sm:col-span-2">
            {PREPARATION_TEXT} {NO_REVISION_TEXT}
          </KeyValue>
          <KeyValue label="Teslimat koşulları" className="sm:col-span-2">{snapshot.deliveryTerms}</KeyValue>
        </dl>
      </Card>

      {/* Ekiple mesajlaşma: üretim öncesi sorular ve yanıtlar */}
      <Card className="p-5 sm:p-7">
        <h2 className="flex items-center gap-2 text-lg font-bold text-ink">
          <MessagesSquare className="size-5 text-brand" aria-hidden /> Mesajlar
        </h2>
        <p className="mt-1 text-sm text-muted">{PREPARATION_TEXT} Sorularımızı buradan yanıtlayabilirsin.</p>
        {orderMessages.length > 0 ? (
          <ol className="mt-5 space-y-3">
            {orderMessages.map((m) => {
              const mine = m.type === "CUSTOMER_MESSAGE";
              return (
                <li key={m.id} className={mine ? "flex justify-end" : "flex justify-start"}>
                  <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${mine ? "bg-brand-tint text-ink ring-1 ring-brand-soft" : "bg-canvas text-ink ring-1 ring-line"}`}>
                    <p className="text-xs font-semibold text-muted">{mine ? "Sen" : "AddLyrics ekibi"} · {formatDateTime(m.createdAt)}</p>
                    <p className="mt-1 whitespace-pre-wrap">{m.message}</p>
                  </div>
                </li>
              );
            })}
          </ol>
        ) : (
          <p className="mt-4 text-sm text-muted">Henüz mesaj yok.</p>
        )}
        {order.status !== "CANCELLED" && (
          <div className="mt-5 border-t border-line pt-5">
            <OrderMessageForm orderNumber={order.number} />
          </div>
        )}
      </Card>

      {/* Geçmiş ve ödeme */}
      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="p-5 sm:p-7">
          <h2 className="text-lg font-bold text-ink">Sipariş geçmişi</h2>
          <ol className="mt-5 space-y-4">
            {history.map((ev) => (
              <li key={ev.id} className="relative border-l-2 border-line pl-4">
                <span className="absolute -left-[5px] top-1.5 size-2 rounded-full bg-brand" aria-hidden />
                <p className="text-sm text-ink">
                  {ev.toStatus ? <strong>{t.enums.orderStatus[ev.toStatus]}</strong> : null}
                  {ev.toStatus && ev.message ? " — " : ""}
                  {ev.message}
                </p>
                <p className="text-xs text-muted">{formatDateTime(ev.createdAt)}</p>
              </li>
            ))}
          </ol>
        </Card>
        {order.kind === "PURCHASE" && (
          <Card className="p-5 sm:p-7">
            <h2 className="text-lg font-bold text-ink">Ödeme</h2>
            <p className="mt-3 font-display text-2xl font-extrabold text-ink">{formatMoney(order.priceKurus, order.currency)}</p>
            <ul className="mt-4 space-y-2">
              {order.payments.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-muted">
                    {formatDateTime(p.createdAt)} · {t.enums.paymentProvider[p.provider]}
                  </span>
                  <PaymentStatusBadge status={p.status} />
                </li>
              ))}
            </ul>
            {order.entitlement && (
              <p className="mt-4 text-sm text-muted">
                Paket hakkı: {order.entitlement.totalVideos - order.entitlement.usedVideos} / {order.entitlement.totalVideos} video kaldı · bitiş{" "}
                {formatDate(order.entitlement.endsAt)}
              </p>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}
