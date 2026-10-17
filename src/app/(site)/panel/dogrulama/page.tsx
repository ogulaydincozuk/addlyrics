import type { Metadata } from "next";
import { ArrowRight, CheckCircle2, Mail, Smartphone } from "lucide-react";
import { LinkButton } from "@/components/ui/button";
import { Alert, Badge, Card } from "@/components/ui/primitives";
import { formatPhone, MAX_ACCOUNTS_PER_PHONE } from "@/lib/phone";
import { requireUser, safeNextPath } from "@/server/auth/guards";
import { verificationStatus } from "@/server/verification/service";
import { PanelPage } from "../_components";
import { EmailResend, PhoneVerification } from "./forms";

export const metadata: Metadata = { title: "Hesap Doğrulama" };

export default function VerificationPage({ searchParams }: PageProps<"/panel/dogrulama">) {
  return (
    <PanelPage title="Hesabını doğrula" description="Ücretsiz deneme ve hesap güvenliği için e-posta adresini ve telefon numaranı doğrula.">
      <Verification searchParams={searchParams} />
    </PanelPage>
  );
}

async function Verification({ searchParams }: Pick<PageProps<"/panel/dogrulama">, "searchParams">) {
  const user = await requireUser("/panel/dogrulama");
  const sp = await searchParams;
  const next = safeNextPath(typeof sp.next === "string" ? sp.next : null, "/panel");
  const status = await verificationStatus(user.id);
  const done = status.emailVerified && status.phoneVerified;
  // Paket satın almak doğrulama gerektirmez: kayıttan sonra siparişe/başka sayfaya dönüş her zaman açık
  const canSkip = !done && next !== "/panel" && !next.startsWith("/ucretsiz-deneme");

  return (
    <div className="space-y-6">
      {sp.eposta === "ok" && <Alert tone="success">E-posta adresin doğrulandı.</Alert>}
      {canSkip && (
        <Alert tone="info" title="Doğrulamayı sonra da yapabilirsin">
          Paket satın almak için doğrulama gerekmez; ücretsiz deneme için gereklidir.
          <div className="mt-2">
            <LinkButton href={next} size="sm" variant="secondary" icon={null}>
              Şimdilik atla, devam et <ArrowRight className="size-4" aria-hidden />
            </LinkButton>
          </div>
        </Alert>
      )}
      {done && (
        <Alert tone="success" title="Hesabın doğrulandı">
          <div className="mt-2">
            <LinkButton href={next} size="sm" icon={null}>
              Devam et <ArrowRight className="size-4" aria-hidden />
            </LinkButton>
          </div>
        </Alert>
      )}

      <Card className="p-5 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl bg-brand-tint text-brand">
              <Mail className="size-5" aria-hidden />
            </span>
            <div>
              <h2 className="text-lg font-bold text-ink">E-posta</h2>
              <p className="text-sm text-muted">{status.email}</p>
            </div>
          </div>
          {status.emailVerified ? (
            <Badge tone="success">
              <CheckCircle2 className="size-3.5" aria-hidden /> Doğrulandı
            </Badge>
          ) : (
            <Badge tone="warning">Doğrulanmadı</Badge>
          )}
        </div>
        {!status.emailVerified && (
          <div className="mt-5 space-y-3">
            <p className="text-sm text-ink-soft">E-posta adresine bir doğrulama bağlantısı gönderdik. Bağlantı 24 saat geçerlidir; gelen kutunu ve gereksiz klasörünü kontrol et.</p>
            <EmailResend next={next} />
          </div>
        )}
      </Card>

      <Card className="p-5 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl bg-brand-tint text-brand">
              <Smartphone className="size-5" aria-hidden />
            </span>
            <div>
              <h2 className="text-lg font-bold text-ink">Telefon</h2>
              <p className="text-sm text-muted">{status.phone ? formatPhone(status.phone) : "Telefon numarası eklenmedi"}</p>
            </div>
          </div>
          {status.phoneVerified ? (
            <Badge tone="success">
              <CheckCircle2 className="size-3.5" aria-hidden /> Doğrulandı
            </Badge>
          ) : (
            <Badge tone="warning">Doğrulanmadı</Badge>
          )}
        </div>
        {!status.phoneVerified && (
          <div className="mt-5 space-y-4">
            {!status.smsAvailable && (
              <Alert tone="warning" title="SMS doğrulaması henüz etkin değil">
                Telefon doğrulama altyapımız yapılandırılıyor. Etkinleştiğinde bu sayfadan numaranı doğrulayabileceksin; ücretsiz deneme için telefon doğrulaması gereklidir.
              </Alert>
            )}
            <PhoneVerification defaultPhone={status.phone ? formatPhone(status.phone) : ""} smsAvailable={status.smsAvailable} />
            <p className="text-xs text-muted">
              Güvenlik için bir telefon numarasıyla en fazla {MAX_ACCOUNTS_PER_PHONE} hesap doğrulanabilir. Numaran yalnızca hesap doğrulama ve sipariş
              iletişimi için kullanılır.
            </p>
          </div>
        )}
      </Card>
    </div>
  );
}
