import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { MailCheck } from "lucide-react";
import { Button, LinkButton } from "@/components/ui/button";
import { Alert, Card, Container } from "@/components/ui/primitives";
import { safeNextPath } from "@/server/auth/guards";
import { confirmEmailToken } from "@/server/verification/service";

export const metadata: Metadata = { title: "E-posta Doğrulama", robots: { index: false } };

/**
 * E-posta doğrulama bağlantısı. Belirteç, sayfa açılırken değil butona basılınca tüketilir;
 * böylece e-posta güvenlik tarayıcılarının bağlantıyı önceden açması doğrulamayı harcamaz.
 */
export default function ConfirmEmailPage({ searchParams }: PageProps<"/e-posta-dogrula">) {
  return (
    <Container className="max-w-xl py-16">
      <Card className="p-6 text-center sm:p-10">
        <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-lime text-ink">
          <MailCheck className="size-7" aria-hidden />
        </span>
        <h1 className="mt-5 text-2xl font-extrabold text-ink">E-posta adresini doğrula</h1>
        <Suspense fallback={<p className="mt-6 text-muted">Yükleniyor…</p>}>
          <ConfirmEmail searchParams={searchParams} />
        </Suspense>
      </Card>
    </Container>
  );
}

async function ConfirmEmail({ searchParams }: Pick<PageProps<"/e-posta-dogrula">, "searchParams">) {
  const sp = await searchParams;
  const token = typeof sp.token === "string" ? sp.token : "";
  const next = safeNextPath(typeof sp.next === "string" ? sp.next : null, "/panel");
  const failed = sp.hata === "1";
  // Hata sonrası da kullanıcı gitmek istediği sayfaya dönebilsin diye "next" korunur
  const nextQuery = typeof sp.next === "string" ? `next=${encodeURIComponent(next)}` : "";

  async function confirm() {
    "use server";
    const userId = await confirmEmailToken(token);
    if (!userId) redirect(`/e-posta-dogrula?hata=1${nextQuery ? `&${nextQuery}` : ""}`);
    redirect(`/panel/dogrulama?eposta=ok&next=${encodeURIComponent(next)}`);
  }

  if (failed || !token) {
    return (
      <div className="mt-6">
        <Alert tone="danger" className="text-left">
          Bu doğrulama bağlantısı geçersiz veya süresi dolmuş. Giriş yapıp hesap doğrulama sayfasından yeni bağlantı isteyebilirsin.
        </Alert>
        <LinkButton href={`/panel/dogrulama${nextQuery ? `?${nextQuery}` : ""}`} className="mt-6">
          Yeni doğrulama bağlantısı iste
        </LinkButton>
      </div>
    );
  }
  return (
    <form action={confirm} className="mt-6">
      <p className="mb-5 text-muted">Hesabını doğrulamak için aşağıdaki butona bas.</p>
      <Button type="submit" size="lg">
        E-postamı doğrula
      </Button>
    </form>
  );
}
