import type { Metadata } from "next";
import Link from "next/link";
import { Checkbox, Field, Input } from "@/components/ui/field";
import { Alert, Badge, KeyValue } from "@/components/ui/primitives";
import { requireAdmin } from "@/server/auth/guards";
import { db } from "@/server/db";
import { env, smsProvider, smtpConfigured } from "@/server/env";
import { readSystemSetting } from "@/server/system-settings";
import { ffmpegCapabilities, watermarkFile } from "@/server/video/ffmpeg";
import { ActionForm } from "../_forms";
import { AdminPage, Section } from "../_ui";
import { saveCommerceSettingsAction, saveTrialSettingsAction } from "./actions";

export const metadata: Metadata = { title: "Sistem Ayarları" };

export default function SettingsPage() {
  return (
    <AdminPage title="Sistem Ayarları ve Paket Kuralları" description="Ücretsiz deneme, ön izleme ve komisyon hesabına ilişkin işletme ayarları.">
      <Settings />
    </AdminPage>
  );
}

async function Settings() {
  await requireAdmin();
  const [trial, commerce, caps, packages] = await Promise.all([
    readSystemSetting("system.trial"),
    readSystemSetting("system.commerce"),
    ffmpegCapabilities(),
    db.package.findMany({ where: { status: { not: "ARCHIVED" } }, orderBy: { sortOrder: "asc" }, select: { id: true, name: true, trialCountsTowardPackage: true, trialConversionBusinessDays: true } }),
  ]);
  const sms = smsProvider();
  const e = env();

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className="min-w-0 space-y-6">
        <Section title="Ücretsiz deneme" description="Süreler dosya kontrolünün onaylandığı anda başlar. Kapasite dolunca yeni başvuru alınmaz ve sitedeki tanıtım gizlenir.">
          <ActionForm action={saveTrialSettingsAction} submitLabel="Kaydet">
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Ön izleme hedefi (saat)" htmlFor="previewTargetHours">
                <Input id="previewTargetHours" name="previewTargetHours" type="number" min={1} max={168} defaultValue={trial.previewTargetHours} />
              </Field>
              <Field label="Kesit uzunluğu (sn)" htmlFor="previewSeconds">
                <Input id="previewSeconds" name="previewSeconds" type="number" min={5} max={60} defaultValue={trial.previewSeconds} />
              </Field>
              <Field label="Kesit başlangıcı (sn)" htmlFor="previewStartSeconds">
                <Input id="previewStartSeconds" name="previewStartSeconds" type="number" min={0} max={600} defaultValue={trial.previewStartSeconds} />
              </Field>
              <Field label="Aynı anda açık deneme (kapasite)" htmlFor="maxOpenTrials">
                <Input id="maxOpenTrials" name="maxOpenTrials" type="number" min={1} max={1000} defaultValue={trial.maxOpenTrials} />
              </Field>
              <Field label="Satın almada kalan videolar (iş günü)" htmlFor="conversionBusinessDays" hint="Paket ayarı yoksa kullanılır.">
                <Input id="conversionBusinessDays" name="conversionBusinessDays" type="number" min={1} max={60} defaultValue={trial.conversionBusinessDays} />
              </Field>
              <Field label="Saklama süresi (gün)" htmlFor="retentionDays" hint="Satın alınmayan denemelerin dosyaları silinir.">
                <Input id="retentionDays" name="retentionDays" type="number" min={7} max={730} defaultValue={trial.retentionDays} />
              </Field>
            </div>
            <div className="flex flex-wrap gap-6">
              <Checkbox name="enabled" label="Yeni deneme başvurusu al" defaultChecked={trial.enabled} />
              <Checkbox name="watermark" label="Ön izlemeye logo filigranı ekle" defaultChecked={trial.watermark} />
              <Checkbox name="blur" label="Ön izlemeyi hafif bulanıklaştır" defaultChecked={trial.blur} />
            </div>
          </ActionForm>
        </Section>

        <Section
          title="Komisyon ve vergi"
          description="Komisyonun hangi tutar üzerinden hesaplanacağı her kodda ayrıca seçilir. Bu değerler varsayılan olarak doldurulmuştur; ticari anlaşmanıza göre kontrol edin."
        >
          <ActionForm action={saveCommerceSettingsAction} submitLabel="Kaydet">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="KDV oranı (%)" htmlFor="vatRatePercent" hint="Yalnızca “KDV hariç” tabanlı kodlarda kullanılır.">
                <Input id="vatRatePercent" name="vatRatePercent" inputMode="decimal" defaultValue={commerce.vatRatePercent} />
              </Field>
              <Field label="Komisyon onay bekleme süresi (gün)" htmlFor="commissionHoldDays" hint="Ödemeden sonra iade/cayma süresi dolmadan komisyon onaylanamaz.">
                <Input id="commissionHoldDays" name="commissionHoldDays" type="number" min={0} max={365} defaultValue={commerce.commissionHoldDays} />
              </Field>
            </div>
          </ActionForm>
        </Section>

        <Section title="Paket kuralları (deneme)" description="Deneme videolarının pakete sayılıp sayılmadığı ve kalan videoların teslim süresi paket bazında düzenlenir.">
          <ul className="divide-y divide-line text-sm">
            {packages.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span className="font-medium text-ink">{p.name}</span>
                <span className="text-muted">
                  {p.trialCountsTowardPackage ? "3 deneme videosu pakete dahil" : "Deneme videoları pakete ek"} ·{" "}
                  {p.trialConversionBusinessDays ? `${p.trialConversionBusinessDays} iş günü` : `sistem ayarı (${trial.conversionBusinessDays} iş günü)`}
                </span>
                <Link href={`/admin/paketler/${p.id}`} className="text-brand hover:underline">
                  Düzenle
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      </div>

      <aside className="min-w-0 space-y-6">
        <Section title="Entegrasyon durumu">
          <div className="space-y-4 text-sm">
            <KeyValue label="SMS doğrulama">
              {sms === "twilio" ? (
                <Badge tone="success">Twilio Verify</Badge>
              ) : sms === "console" ? (
                <Badge tone="warning">Konsol (yalnızca geliştirme)</Badge>
              ) : (
                <Badge tone="danger">Yapılandırılmadı</Badge>
              )}
            </KeyValue>
            {!sms && <Alert tone="warning">Telefon doğrulanamadığı için ücretsiz deneme başlatılamaz. SMS_PROVIDER ve sağlayıcı anahtarlarını tanımlayın.</Alert>}
            <KeyValue label="E-posta">
              {e.EMAIL_DRIVER === "smtp" && smtpConfigured() ? <Badge tone="success">SMTP</Badge> : <Badge tone="warning">Konsol (gönderilmiyor)</Badge>}
            </KeyValue>
            <KeyValue label="ffmpeg (ön izleme kesiti)">
              {caps.available ? <Badge tone="success">Hazır</Badge> : <Badge tone="warning">Yok — ön izleme elle yüklenir</Badge>}
              {caps.available && (
                <p className="mt-1 text-xs text-muted">
                  Filigran: {caps.filters.has("overlay") && caps.filters.has("scale2ref") && watermarkFile() ? "destekleniyor" : "desteklenmiyor (overlay/scale2ref filtresi veya assets/watermark.png yok)"} · Bulanıklık:{" "}
                  {caps.filters.has("boxblur") ? "destekleniyor" : "desteklenmiyor"}
                </p>
              )}
            </KeyValue>
            <KeyValue label="Dosya deposu">{e.STORAGE_DRIVER === "s3" ? "S3 uyumlu (imzalı, süreli bağlantılar)" : "Yerel disk (yetki kontrollü API)"}</KeyValue>
          </div>
        </Section>
      </aside>
    </div>
  );
}
