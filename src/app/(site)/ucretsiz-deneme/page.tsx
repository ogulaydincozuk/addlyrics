import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowRight, Clock3, EyeOff, Gift, ShieldCheck } from "lucide-react";
import { LinkButton } from "@/components/ui/button";
import { Alert, Card, Container, Skeleton } from "@/components/ui/primitives";
import { TrialWizard } from "@/components/trial/trial-wizard";
import { TRIAL_JOURNEY } from "@/lib/trial";
import { getSessionUser } from "@/server/auth/session";
import { trialEligibility } from "@/server/domain/trials";
import { publicFileRules } from "@/server/storage/file-rules";
import { readSystemSetting } from "@/server/system-settings";

export const metadata: Metadata = {
  title: "AddLyrics'ı Ücretsiz Dene",
  description: "Şarkını gönder, sana özel hazırlanan 3 örnek lyric videoyu incele. Satın almadan önce sonucu gör.",
};

export default function FreeTrialPage() {
  return (
    <Container className="py-10 sm:py-14">
      <div className="mx-auto max-w-3xl text-center">
        <p className="inline-flex items-center gap-2 rounded-full border border-brand-soft bg-white px-3 py-1 text-xs font-semibold text-brand-ink shadow-sm">
          <Gift className="size-3.5 text-brand" aria-hidden /> 3 ücretsiz örnek video
        </p>
        <h1 className="mt-4 text-3xl font-extrabold leading-tight text-ink sm:text-[2.6rem]">AddLyrics&apos;ı Ücretsiz Dene</h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-muted">
          Şarkını gönder, sana özel hazırlanan 3 örnek lyric videoyu incele. Satın almadan önce sonucu gör.
        </p>
      </div>

      <ol className="mx-auto mt-10 grid max-w-5xl gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {TRIAL_JOURNEY.map((s, i) => (
          <li key={s.title} className="flex gap-3 rounded-2xl border border-line bg-card p-4">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-lime text-sm font-extrabold text-ink">{i + 1}</span>
            <span>
              <span className="block font-semibold text-ink">{s.title}</span>
              <span className="block text-sm text-muted">{s.text}</span>
            </span>
          </li>
        ))}
      </ol>

      <div className="mx-auto mt-6 grid max-w-5xl gap-3 text-sm sm:grid-cols-3">
        <p className="flex gap-2 rounded-xl bg-brand-tint p-3 text-brand-ink">
          <Clock3 className="mt-0.5 size-4 shrink-0" aria-hidden />
          Süre, dosyaların ekibimizce onaylandığı anda başlar.
        </p>
        <p className="flex gap-2 rounded-xl bg-brand-tint p-3 text-brand-ink">
          <EyeOff className="mt-0.5 size-4 shrink-0" aria-hidden />
          Ön izlemeler kısa ve filigranlıdır; tam sürümler satın almada açılır.
        </p>
        <p className="flex gap-2 rounded-xl bg-brand-tint p-3 text-brand-ink">
          <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
          Ödeme yok, kart bilgisi istenmez. Deneme hesap başına bir kez.
        </p>
      </div>

      <Card className="mx-auto mt-10 max-w-3xl p-5 sm:p-8">
        <Suspense fallback={<Skeleton className="h-64" />}>
          <TrialEntry />
        </Suspense>
      </Card>
      <p className="mx-auto mt-4 max-w-3xl text-center text-xs text-muted">
        Ayrıntılar için{" "}
        <Link href="/ucretsiz-deneme-kosullari" className="font-semibold text-brand hover:underline">
          ücretsiz deneme koşulları
        </Link>
        .
      </p>
    </Container>
  );
}

async function TrialEntry() {
  const user = await getSessionUser();
  const eligibility = await trialEligibility(user?.id ?? null);
  const settings = await readSystemSetting("system.trial");

  if (eligibility.ok) {
    return (
      <>
        <h2 className="mb-6 text-xl font-bold text-ink">Deneme başvurusu</h2>
        <TrialWizard rules={publicFileRules()} previewHours={settings.previewTargetHours} />
      </>
    );
  }

  switch (eligibility.reason) {
    case "LOGIN":
      return (
        <div className="text-center">
          <h2 className="text-xl font-bold text-ink">Önce hesabını oluştur</h2>
          <p className="mt-2 text-muted">Başvurun ve ön izlemelerin hesabına bağlanır. Hesap oluştururken e-posta ve telefon numaran doğrulanır.</p>
          <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
            <LinkButton href="/kayit?next=/ucretsiz-deneme" icon={null}>
              Hesap oluştur <ArrowRight className="size-4" aria-hidden />
            </LinkButton>
            <LinkButton href="/giris?next=/ucretsiz-deneme" variant="secondary">
              Giriş yap
            </LinkButton>
          </div>
        </div>
      );
    case "EMAIL":
    case "PHONE":
      return (
        <div className="text-center">
          <h2 className="text-xl font-bold text-ink">Hesabını doğrula</h2>
          <p className="mt-2 text-muted">{eligibility.message} Ücretsiz deneme için e-posta ve telefon doğrulaması gereklidir.</p>
          <LinkButton href="/panel/dogrulama?next=/ucretsiz-deneme" className="mt-6" icon={null}>
            Doğrulamaya git <ArrowRight className="size-4" aria-hidden />
          </LinkButton>
        </div>
      );
    case "EXISTS":
      return (
        <div className="text-center">
          <h2 className="text-xl font-bold text-ink">Denemen devam ediyor</h2>
          <p className="mt-2 text-muted">Başvurunun durumunu ve ön izlemelerini panelinden takip edebilirsin.</p>
          <LinkButton href="/panel/deneme" className="mt-6" icon={null}>
            Denememi görüntüle <ArrowRight className="size-4" aria-hidden />
          </LinkButton>
        </div>
      );
    default:
      return (
        <Alert tone={eligibility.reason === "CAPACITY" ? "warning" : "info"} title="Şu an deneme başlatılamıyor">
          {eligibility.message}{" "}
          <Link href="/paketler" className="font-semibold underline">
            Paketleri incele
          </Link>
        </Alert>
      );
  }
}
