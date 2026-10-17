import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, ArrowRight, CalendarClock, CheckCircle2, Clock3, PlayCircle, ShoppingBag } from "lucide-react";
import { Button, LinkButton } from "@/components/ui/button";
import { Alert, Badge, Card, EmptyState } from "@/components/ui/primitives";
import { formatDateTime } from "@/lib/dates";
import { messages } from "@/i18n/config";
import { cn } from "@/lib/cn";
import { TRIAL_JOURNEY, TRIAL_STAGE_LABEL, TRIAL_STAGE_TONE, trialJourneyStep } from "@/lib/trial";
import { requireUser } from "@/server/auth/guards";
import { trialEligibility } from "@/server/domain/trials";
import { getCustomerTrial } from "@/server/queries/trials";
import { publicFileRules } from "@/server/storage/file-rules";
import { readSystemSetting } from "@/server/system-settings";
import { PanelPage } from "../_components";
import { decideLaterAction } from "./actions";
import { TrialResubmitForm } from "./client";

export const metadata: Metadata = { title: "Ücretsiz Deneme" };

const t = messages();

export default function TrialPanelPage({ searchParams }: PageProps<"/panel/deneme">) {
  return (
    <PanelPage title="Ücretsiz Deneme" description="Başvurunun durumu, ön izlemelerin ve satın alma seçeneklerin.">
      <TrialPanel searchParams={searchParams} />
    </PanelPage>
  );
}

async function TrialPanel({ searchParams }: Pick<PageProps<"/panel/deneme">, "searchParams">) {
  const user = await requireUser("/panel/deneme");
  const sp = await searchParams;
  const trial = await getCustomerTrial(user.id);

  if (!trial) {
    const eligibility = await trialEligibility(user.id);
    return (
      <EmptyState
        icon={<PlayCircle className="size-6" aria-hidden />}
        title="Henüz ücretsiz deneme başlatmadın"
        description={eligibility.ok ? "Şarkını gönder, sana özel hazırlanan 3 örnek lyric videoyu incele." : eligibility.message}
        action={
          eligibility.ok || eligibility.reason === "EMAIL" || eligibility.reason === "PHONE" ? (
            <LinkButton href={eligibility.ok ? "/ucretsiz-deneme" : "/panel/dogrulama?next=/ucretsiz-deneme"} icon={null}>
              {eligibility.ok ? "Ücretsiz Denemeyi Başlat" : "Hesabını doğrula"} <ArrowRight className="size-4" aria-hidden />
            </LinkButton>
          ) : eligibility.reason === "CUSTOMER" ? (
            <LinkButton href="/panel/yeni-siparis" icon={null}>
              Yeni Şarkı Gönder <ArrowRight className="size-4" aria-hidden />
            </LinkButton>
          ) : eligibility.reason === "DISABLED" || eligibility.reason === "CAPACITY" ? (
            <LinkButton href="/paketler" icon={null}>
              Paketleri İncele <ArrowRight className="size-4" aria-hidden />
            </LinkButton>
          ) : undefined
        }
      />
    );
  }

  const settings = await readSystemSetting("system.trial");
  const converted = Boolean(trial.convertedOrderId);
  const step = trialJourneyStep(trial.status, converted);
  const ready = trial.status === "PREVIEW_READY" && !converted;
  const overdue = trial.previewDueAt && trial.previewDueAt < new Date() && ["QUEUED", "IN_PRODUCTION", "FAILED"].includes(trial.status);

  return (
    <div className="space-y-6">
      {sp.basvuru === "1" && (
        <Alert tone="success" title="Başvurun alındı">
          Dosyaların ekibimiz tarafından kontrol edilecek. Kontrol tamamlanınca ön izleme süresi başlar ve sana haber veririz.
        </Alert>
      )}

      <Card className="p-5 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm text-muted">Başvuru {trial.number}</p>
            <h2 className="mt-1 text-xl font-bold text-ink">
              {trial.song.artistName} – {trial.song.title}
            </h2>
          </div>
          <Badge tone={TRIAL_STAGE_TONE[trial.status]}>{converted ? "Pakete dönüştürüldü" : TRIAL_STAGE_LABEL[trial.status]}</Badge>
        </div>

        <ol className="mt-6 grid gap-2 sm:grid-cols-6">
          {TRIAL_JOURNEY.map((s, i) => (
            <li key={s.title} className="min-w-0">
              <div className={cn("h-1.5 rounded-full", i <= step ? "bg-brand" : "bg-line")} />
              <p className={cn("mt-2 text-xs font-semibold", i === step ? "text-ink" : "text-muted")}>{s.title}</p>
            </li>
          ))}
        </ol>

        <div className="mt-6 space-y-3 text-sm">
          {trial.status === "FILES_CHECK" || trial.status === "RECEIVED" ? (
            <p className="flex gap-2 text-ink-soft">
              <Clock3 className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden />
              Dosyaların kontrol ediliyor. Ön izleme süresi ({settings.previewTargetHours} saat) dosyaların onaylandığı anda başlar.
            </p>
          ) : null}
          {trial.previewDueAt && !trial.previewsReadyAt && !converted && trial.status !== "CANCELLED" && (
            <p className="flex gap-2 text-ink-soft">
              <CalendarClock className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden />
              Dosyaların {formatDateTime(trial.filesVerifiedAt)} tarihinde onaylandı. Ön izlemeler için hedef: <strong className="text-ink">{formatDateTime(trial.previewDueAt)}</strong>
            </p>
          )}
          {overdue && (
            <Alert tone="warning" title="Ön izlemelerin biraz gecikti">
              Hedeflediğimiz süre doldu ancak ön izlemelerin henüz hazır değil. Ekibimiz öncelikle ilgileniyor; hazır olduğunda e-postayla haber vereceğiz.
            </Alert>
          )}
          {trial.purgedAt && (
            <Alert tone="info">
              Saklama süresi dolduğu için bu denemenin dosyaları silindi. Yeni videolar için{" "}
              <Link href="/paketler" className="font-semibold underline">
                paketleri inceleyebilirsin
              </Link>
              .
            </Alert>
          )}
          {trial.status === "CANCELLED" && (
            <Alert tone="info">
              Bu deneme kapatıldı. {trial.cancelReason}{" "}
              <Link href="/iletisim" className="font-semibold underline">
                Sorun olduğunu düşünüyorsan bize yaz
              </Link>
              .
            </Alert>
          )}
        </div>
      </Card>

      {trial.status === "NEEDS_INFO" && (
        <Card className="p-5 sm:p-7">
          <Alert tone="warning" title="Üretime başlamadan önce bir eksik var">
            <p className="whitespace-pre-line">{trial.needsInfoMessage}</p>
          </Alert>
          <div className="mt-6">
            <TrialResubmitForm
              trialId={trial.id}
              lyrics={trial.song.lyrics ?? ""}
              notes={trial.notesForEditor ?? ""}
              rules={publicFileRules()}
              files={trial.files.map((f) => ({ id: f.id, kind: f.kind, name: f.originalName, size: Number(f.sizeBytes) }))}
            />
          </div>
        </Card>
      )}

      {trial.videos.length > 0 && (
        <section id="videolar" aria-labelledby="videolar-baslik">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
            <h2 id="videolar-baslik" className="text-lg font-bold text-ink">
              Üç örnek video
            </h2>
            {ready && <p className="text-sm text-muted">Ön izlemeleri yan yana karşılaştırabilirsin.</p>}
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {trial.videos.map((v) => (
              <Card key={v.id} className="overflow-hidden">
                <div className="relative aspect-[9/16] max-h-[440px] w-full bg-[#0b0b0f]">
                  {v.previewUrl ? (
                    <>
                      <video
                        className="size-full object-contain"
                        src={v.previewUrl}
                        poster={v.posterUrl ?? undefined}
                        controls
                        controlsList="nodownload noplaybackrate"
                        disablePictureInPicture
                        preload="none"
                        playsInline
                      />
                      {/* Görsel filigran: dosyaya da işlenir (sunucuda ffmpeg varsa) */}
                      <span className="pointer-events-none absolute right-3 top-3 rounded-md bg-black/55 px-2 py-1 text-[11px] font-bold text-white">
                        Add<span className="font-logo italic text-lime">Lyrics</span> · ön izleme
                      </span>
                    </>
                  ) : (
                    <div className="flex size-full flex-col items-center justify-center gap-3 p-6 text-center text-white/80">
                      <PlayCircle className="size-10 text-lime" aria-hidden />
                      <p className="text-sm font-semibold">{TRIAL_STAGE_LABEL[v.status]}</p>
                      <p className="text-xs text-white/60">Ön izleme hazır olduğunda burada oynatılabilir.</p>
                    </div>
                  )}
                </div>
                <div className="space-y-2 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-ink">Video {v.sequence}</p>
                    <Badge tone={TRIAL_STAGE_TONE[v.status]}>{TRIAL_STAGE_LABEL[v.status]}</Badge>
                  </div>
                  <p className="text-sm text-ink-soft">{v.approach}</p>
                  <p className="text-xs text-muted">
                    {t.enums.videoStyle[v.style]}
                    {v.previewReadyAt ? ` · Hazır: ${formatDateTime(v.previewReadyAt)}` : ""}
                    {v.previewSeconds ? ` · ${v.previewSeconds} sn kesit` : ""}
                  </p>
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}

      {ready && !trial.purgedAt && (
        <Card className="p-5 sm:p-7">
          <h2 className="text-lg font-bold text-ink">Beğendin mi?</h2>
          <div className="mt-3 grid gap-3 text-sm text-ink-soft sm:grid-cols-2">
            <p className="flex gap-2">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
              Ön izlemeler kısa ve filigranlıdır. Paket aldığında bu üç videonun tam, temiz ve indirilebilir sürümleri yeniden üretilmeden teslim edilir.
            </p>
            <p className="flex gap-2">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
              Paketindeki kalan videolar ödeme onayından sonra en geç {settings.conversionBusinessDays} iş günü içinde hazırlanır (paket koşullarında belirtilir).
            </p>
          </div>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <LinkButton href="#videolar" variant="secondary" icon={<PlayCircle className="size-4" aria-hidden />}>
              Videolarımı İncele
            </LinkButton>
            <LinkButton href="/panel/deneme/satin-al" icon={<ShoppingBag className="size-4" aria-hidden />}>
              Paketi Satın Al
            </LinkButton>
            {!trial.decideLaterAt && (
              <form action={decideLaterAction}>
                <Button type="submit" variant="ghost">
                  Daha Sonra Karar Ver
                </Button>
              </form>
            )}
          </div>
          {trial.decideLaterAt && (
            <p className="mt-3 text-xs text-muted">
              Karar vermek için acele etme. Ön izlemelerin {settings.retentionDays} gün saklanır; bu süre içinde dilediğin zaman paket alabilirsin.
            </p>
          )}
          {trial.purchaseOrders[0] && (
            <p className="mt-3 text-sm">
              Bekleyen ödemen var:{" "}
              <Link href={`/siparis/${trial.purchaseOrders[0].number}/odeme`} className="font-semibold text-brand hover:underline">
                {trial.purchaseOrders[0].number} ödemesine devam et
              </Link>
            </p>
          )}
        </Card>
      )}

      {converted && trial.convertedOrder && (
        <Alert tone="success" title="Denemen pakete dönüştürüldü">
          Üç videonun tam sürümleri ve paketindeki diğer videoların teslim planı siparişinde:{" "}
          <Link href={`/panel/siparislerim/${trial.convertedOrder.number}`} className="font-semibold underline">
            {trial.convertedOrder.number}
          </Link>
        </Alert>
      )}

      {trial.events.length > 0 && (
        <Card className="p-5 sm:p-7">
          <h2 className="mb-4 text-lg font-bold text-ink">Geçmiş</h2>
          <ol className="space-y-3">
            {trial.events.map((e) => (
              <li key={e.id} className="flex gap-3 text-sm">
                <span className="mt-1.5 size-2 shrink-0 rounded-full bg-brand" aria-hidden />
                <span>
                  <span className="block text-ink-soft">{e.message}</span>
                  <span className="text-xs text-muted">{formatDateTime(e.createdAt)}</span>
                </span>
              </li>
            ))}
          </ol>
        </Card>
      )}
      {trial.status === "FAILED" && !overdue && (
        <p className="flex items-center gap-2 text-sm text-muted">
          <AlertTriangle className="size-4 text-warning" aria-hidden /> Bir videoda teknik sorun oluştu; ekibimiz yeniden hazırlıyor.
        </p>
      )}
    </div>
  );
}
