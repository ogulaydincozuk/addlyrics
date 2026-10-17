import type { Metadata } from "next";
import { CheckCircle2, CircleDashed, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/primitives";
import type { ActionState } from "@/lib/action-state";
import { requireAdmin } from "@/server/auth/guards";
import { db } from "@/server/db";
import { sendEmail } from "@/server/email";
import { renderEmail } from "@/server/email/templates";
import { appUrl, env, s3Configured, smtpConfigured } from "@/server/env";
import { activeProviderId, providerStatuses } from "@/server/payments/config";
import { shopifyAdminConfigured } from "@/server/payments/shopify";
import { ActionForm } from "../_forms";
import { AdminPage, Section } from "../_ui";

export const metadata: Metadata = { title: "Entegrasyonlar" };

async function sendTestEmail(_prev: ActionState, _fd: FormData): Promise<ActionState> {
  "use server";
  const admin = await requireAdmin();
  const ok = await sendEmail(
    renderEmail(admin.email, "AddLyrics test e-postası", {
      heading: "E-posta gönderimi çalışıyor",
      paragraphs: ["Bu, yönetim panelinden gönderilen bir test e-postasıdır."],
    }),
  );
  return ok
    ? { ok: true, message: env().EMAIL_DRIVER === "smtp" ? `Gönderildi: ${admin.email}` : "Konsol sürücüsü: e-posta sunucu günlüğüne yazıldı (gerçekte gönderilmedi)." }
    : { ok: false, message: "Gönderilemedi. Sunucu günlüğünü kontrol edin." };
}

export default function IntegrationsPage() {
  return (
    <AdminPage title="Entegrasyonlar" description="Ödeme, depolama ve e-posta bağlantılarının gerçek durumu. Gizli anahtarlar burada gösterilmez.">
      <Integrations />
    </AdminPage>
  );
}

function StatusIcon({ ok, selected }: { ok: boolean; selected?: boolean }) {
  if (ok) return <CheckCircle2 className="size-5 text-success" aria-label="Yapılandırıldı" />;
  if (selected) return <XCircle className="size-5 text-danger" aria-label="Eksik" />;
  return <CircleDashed className="size-5 text-muted" aria-label="Kullanılmıyor" />;
}

async function Integrations() {
  await requireAdmin();
  const e = env();
  const active = activeProviderId();
  const [lastWebhooks] = await Promise.all([
    db.webhookEvent.findMany({ orderBy: { receivedAt: "desc" }, take: 5, select: { provider: true, topic: true, receivedAt: true, processedAt: true, error: true } }),
  ]);

  return (
    <div className="space-y-6">
      <Section
        title="Ödeme"
        description={`Seçili sağlayıcı (PAYMENT_PROVIDER): ${e.PAYMENT_PROVIDER}. Etkin: ${active ?? "yok — paketler satın alınamaz"}.`}
      >
        <ul className="space-y-4">
          {providerStatuses().map((p) => (
            <li key={p.id} className="flex gap-3 rounded-xl border border-line p-4">
              <StatusIcon ok={p.configured} selected={p.selected} />
              <div className="min-w-0 text-sm">
                <p className="font-semibold text-ink">
                  {p.label} {p.selected && <Badge tone="brand">Seçili</Badge>}
                </p>
                <p className="text-muted">{p.configured ? "Yapılandırıldı." : `Bağlı değil. Eksik: ${p.missing.join(", ")}`}</p>
                {p.note && <p className="mt-1 text-xs text-muted">{p.note}</p>}
              </div>
            </li>
          ))}
        </ul>
        <div className="mt-5 space-y-2 rounded-xl bg-canvas p-4 text-sm ring-1 ring-line">
          <p className="font-semibold text-ink">Sağlayıcı panelinde tanımlanacak adresler</p>
          <p>
            iyzico dönüş (callback): <code className="break-all">{appUrl("/api/payments/iyzico/callback")}</code> (otomatik gönderilir)
          </p>
          <p>
            iyzico webhook: <code className="break-all">{appUrl("/api/payments/iyzico/webhook")}</code> — X-IYZ-SIGNATURE-V3 imzası iyzico tarafından hesapta
            açılmalıdır.
          </p>
          <p>
            Shopify webhook (orders/paid, refunds/create, orders/cancelled): <code className="break-all">{appUrl("/api/payments/shopify/webhook")}</code>
          </p>
          <p className="text-xs text-muted">
            Shopify sipariş doğrulaması: {shopifyAdminConfigured() ? "Admin API ile yeniden okunur." : "yalnızca imzalı webhook içeriğiyle (SHOPIFY_ADMIN_ACCESS_TOKEN önerilir)."}
          </p>
        </div>
        {lastWebhooks.length > 0 && (
          <div className="mt-4">
            <p className="mb-2 text-sm font-semibold text-ink">Son bildirimler</p>
            <ul className="space-y-1 text-xs text-muted">
              {lastWebhooks.map((w, i) => (
                <li key={i}>
                  {w.receivedAt.toISOString()} · {w.provider} · {w.topic ?? "—"} · {w.processedAt ? "işlendi" : w.error ? `hata: ${w.error}` : "bekliyor"}
                </li>
              ))}
            </ul>
          </div>
        )}
      </Section>

      <Section title="Dosya depolama" description={`STORAGE_DRIVER: ${e.STORAGE_DRIVER}`}>
        <div className="flex gap-3 text-sm">
          <StatusIcon ok={e.STORAGE_DRIVER === "s3" ? s3Configured() : true} selected />
          <div>
            {e.STORAGE_DRIVER === "s3" ? (
              <p>{s3Configured() ? `S3 uyumlu depolama: kova "${e.S3_BUCKET}"${e.S3_ENDPOINT ? ` (${new URL(e.S3_ENDPOINT).host})` : ""}.` : "S3 bilgileri eksik (S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY)."}</p>
            ) : (
              <p>
                Yerel disk ({e.STORAGE_LOCAL_DIR}). Yalnızca geliştirme veya tek sunuculu kurulum için uygundur; yedekleme ve ölçeklenme için S3/R2 önerilir.
              </p>
            )}
            <p className="mt-1 text-xs text-muted">
              Sınırlar: ses {e.UPLOAD_MAX_AUDIO_MB} MB · video {e.UPLOAD_MAX_VIDEO_MB} MB · görsel {e.UPLOAD_MAX_IMAGE_MB} MB · belge {e.UPLOAD_MAX_DOC_MB} MB
            </p>
          </div>
        </div>
      </Section>

      <Section title="E-posta" description={`EMAIL_DRIVER: ${e.EMAIL_DRIVER} · Gönderen: ${e.EMAIL_FROM}`}>
        <div className="flex gap-3 text-sm">
          <StatusIcon ok={e.EMAIL_DRIVER === "smtp" && smtpConfigured()} selected />
          <div className="space-y-3">
            <p>
              {e.EMAIL_DRIVER === "smtp"
                ? smtpConfigured()
                  ? `SMTP: ${e.SMTP_HOST}:${e.SMTP_PORT}`
                  : "SMTP_HOST tanımlı değil — e-postalar gönderilemez."
                : "Konsol sürücüsü: e-postalar gönderilmez, sunucu günlüğüne yazılır."}
            </p>
            <p className="text-xs text-muted">Ekip bildirim adresi: {e.ADMIN_NOTIFICATION_EMAIL ?? "tanımlı değil (yalnızca panel bildirimi)"}</p>
            <ActionForm action={sendTestEmail} submitLabel="Kendime test e-postası gönder" variant="secondary" />
          </div>
        </div>
      </Section>
    </div>
  );
}
