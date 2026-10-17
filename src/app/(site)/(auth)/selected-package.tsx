import { CheckCircle2, Lock } from "lucide-react";
import { Badge, Card } from "@/components/ui/primitives";
import { formatMoney } from "@/lib/money";
import { getPublicPackage } from "@/server/queries/public";

/** Kayıt/giriş sırasında seçilen paketi hatırlatır; böylece müşteri bağlamı kaybetmez. */
export async function SelectedPackageAside({ next }: { next: string }) {
  let slug: string | null = null;
  try {
    slug = next ? new URL(next, "http://x").searchParams.get("paket") : null;
  } catch {
    slug = null;
  }
  const pkg = slug ? await getPublicPackage(slug) : null;

  return (
    <div className="space-y-4">
      {pkg && (
        <Card className="p-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Seçtiğin paket</p>
          <div className="mt-2 flex items-center gap-2">
            <p className="font-display text-xl font-bold text-ink">{pkg.name}</p>
            {pkg.isSample && <Badge tone="warning">Örnek veri</Badge>}
          </div>
          {pkg.priceKurus != null && (
            <p className="mt-1 text-sm text-muted">
              {formatMoney(pkg.priceKurus, pkg.currency)} · {pkg.durationMonths} ay · {pkg.totalVideos} video
            </p>
          )}
          <p className="mt-4 text-sm text-ink-soft">Hesabını oluşturduktan sonra şarkı bilgilerini girerek siparişine devam edeceksin.</p>
        </Card>
      )}
      <ul className="space-y-3 px-1 text-sm text-ink-soft">
        {[
          "Siparişlerini ve teslim edilen videolarını tek panelden takip et",
          "Dosyalarını istediğin zaman yükle",
          "Kalan video haklarını her zaman gör",
        ].map((item) => (
          <li key={item} className="flex gap-2.5">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
            {item}
          </li>
        ))}
        <li className="flex gap-2.5 text-muted">
          <Lock className="mt-0.5 size-4 shrink-0" aria-hidden />
          Şifren güvenli biçimde (Argon2) saklanır.
        </li>
      </ul>
    </div>
  );
}
