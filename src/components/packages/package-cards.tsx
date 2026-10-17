import Link from "next/link";
import { CalendarRange, Check, Clapperboard, Film, Info, MessagesSquare, Truck } from "lucide-react";
import { LinkButton } from "@/components/ui/button";
import { Badge } from "@/components/ui/primitives";
import { messages } from "@/i18n/config";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/money";
import { FIRST_DELIVERY_RULE_TEXT, monthlyAllocation } from "@/lib/delivery-plan";
import { NO_REVISION_TEXT, PREPARATION_TEXT, videoCountLabel } from "@/lib/packages";
import type { PublicPackage } from "@/server/queries/public";

const UNAVAILABLE_TEXT = {
  not_published: "Bu paket şu anda satışta değil.",
  incomplete: "Paket koşulları yakında açıklanacak; satışlar kısa süre içinde açılacak.",
  sample: "Fiyat ve paket koşulları yakında açıklanacak.",
  payments_unavailable: "Online ödeme yakında aktif olacak.",
} as const;

export function PackageCards({ packages, headingLevel = "h3" }: { packages: PublicPackage[]; headingLevel?: "h2" | "h3" }) {
  const t = messages();
  if (!packages.length) {
    return (
      <div className="mx-auto max-w-xl rounded-2xl border border-dashed border-line-strong bg-card p-10 text-center">
        <p className="font-display text-lg font-bold text-ink">Paketlerimiz çok yakında burada.</p>
        <p className="mt-2 text-sm text-muted">
          Fiyatlandırmayı tamamladığımızda paketleri bu sayfada yayınlayacağız. Bilgi almak için{" "}
          <Link href="/iletisim" className="font-semibold text-brand hover:underline">
            bize yazabilirsin
          </Link>
          .
        </p>
      </div>
    );
  }
  const bestSaving = Math.max(0, ...packages.map((p) => p.savingsPercent ?? 0));
  const Heading = headingLevel;

  return (
    <div className={cn("grid gap-6", packages.length >= 3 ? "lg:grid-cols-3" : packages.length === 2 ? "md:grid-cols-2" : "mx-auto max-w-md")}>
      {packages.map((p) => {
        const highlighted = p.isFeatured || (bestSaving > 0 && p.savingsPercent === bestSaving);
        const priced = p.priceKurus != null && p.totalVideos != null;
        return (
          <article
            key={p.id}
            className={cn(
              "relative flex flex-col rounded-[1.4rem] border bg-card p-6 shadow-[var(--shadow-card)] sm:p-7",
              highlighted ? "border-brand ring-4 ring-brand-soft" : "border-line",
            )}
          >
            <div className="flex flex-wrap items-center gap-2">
              <Heading className="text-xl font-extrabold text-ink">{p.name}</Heading>
              {p.isSample && priced && <Badge tone="warning">{t.common.sampleData}</Badge>}
              {highlighted && p.savingsPercent ? <Badge tone="brand">En avantajlı</Badge> : null}
              {p.bonusVideoCount > 0 && <Badge tone="success">+{p.bonusVideoCount} bonus video</Badge>}
            </div>
            {p.tagline && <p className="mt-1.5 text-sm text-muted">{p.tagline}</p>}

            <div className="mt-6">
              {priced ? (
                <>
                  <p className="font-display text-[2.4rem] font-extrabold leading-none tracking-tight text-ink">
                    {formatMoney(p.priceKurus!, p.currency, { compact: p.priceKurus! % 100 === 0 })}
                  </p>
                  <p className="mt-2 text-sm text-muted">
                    Tek seferlik ödeme · {p.durationMonths} ay · toplam {p.totalVideos} video
                  </p>
                </>
              ) : (
                <>
                  <p className="font-display text-2xl font-bold text-ink">{t.common.priceSoon}</p>
                  <p className="mt-2 text-sm text-muted">{p.durationMonths} aylık paket</p>
                </>
              )}
            </div>

            {priced && p.perVideoKurus != null && (
              <div className="mt-5 rounded-xl bg-brand-tint px-4 py-3">
                <p className="text-sm text-brand-ink">
                  Video başına <strong className="font-bold">{formatMoney(p.perVideoKurus, p.currency)}</strong>
                  {p.bonusVideoCount > 0 && <span className="text-xs text-brand-ink/80"> (bonus dahil)</span>}
                </p>
                {p.savingsPercent ? (
                  <p className="mt-0.5 text-xs font-semibold text-success">1 aylık pakete göre video başına %{p.savingsPercent} daha uygun</p>
                ) : null}
                {p.perMonthKurus != null && p.durationMonths > 1 && (
                  <p className="mt-0.5 text-xs text-muted">Aylık ortalama {formatMoney(p.perMonthKurus, p.currency)}</p>
                )}
              </div>
            )}

            <ul className="mt-6 flex-1 space-y-3.5 text-sm">
              <Feature icon={CalendarRange} title="Paket süresi">
                {p.durationMonths} ay — ödeme onaylandığında başlar
              </Feature>
              <Feature icon={Film} title="Toplam video">
                {p.videoCount != null ? (
                  <>
                    {videoCountLabel(p.videoCount, p.bonusVideoCount)}
                    {p.bonusVideoCount > 0 && <span className="mt-0.5 block text-muted">Toplam {p.totalVideos} lyrics video teslim edilir</span>}
                  </>
                ) : (
                  "Yakında açıklanacak"
                )}
              </Feature>
              <Feature icon={Clapperboard} title="Video türü ve format">
                {p.includedStyles.length
                  ? p.includedStyles.map((s) => t.enums.videoStyleShort[s]).join(", ")
                  : "Yakında açıklanacak"}
                {p.includedFormats.length > 0 && (
                  <span className="mt-1.5 flex flex-wrap gap-1.5">
                    {p.includedFormats.map((f) => (
                      <span key={f} className="rounded-md bg-canvas px-2 py-0.5 text-xs font-medium text-ink-soft ring-1 ring-line">
                        {t.enums.videoFormat[f]}
                      </span>
                    ))}
                  </span>
                )}
              </Feature>
              <Feature icon={MessagesSquare} title="Hazırlık süreci">
                {PREPARATION_TEXT}
                <span className="mt-0.5 block text-muted">{NO_REVISION_TEXT}</span>
              </Feature>
              <Feature icon={Truck} title="Teslimat">
                {p.videoCount != null ? (
                  <>
                    {p.durationMonths > 1 ? "Aylık toplu teslim" : "Tek seferde toplu teslim"}
                    <span className="mt-1.5 flex flex-wrap gap-1.5">
                      {monthlyAllocation(p.videoCount, p.bonusVideoCount, p.durationMonths).map((n, i, arr) => (
                        <span
                          key={i}
                          className={cn(
                            "rounded-md px-2 py-0.5 text-xs font-medium ring-1",
                            i === arr.length - 1 && p.bonusVideoCount > 0 ? "bg-success-soft text-[#166534] ring-[#bbf7d0]" : "bg-canvas text-ink-soft ring-line",
                          )}
                        >
                          {arr.length > 1 ? `${i + 1}. teslim: ` : ""}
                          {n} video
                        </span>
                      ))}
                    </span>
                    <span className="mt-1.5 block text-xs text-muted">
                      {FIRST_DELIVERY_RULE_TEXT}
                      {p.durationMonths > 1 ? " Sonraki teslimler her ayın 1'inde." : ""}
                    </span>
                  </>
                ) : (
                  (p.deliveryTerms ?? "Yakında açıklanacak")
                )}
              </Feature>
              {p.features.map((f) => (
                <li key={f} className="flex gap-2.5 text-ink-soft">
                  <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
                  {f}
                </li>
              ))}
            </ul>

            <div className="mt-7">
              {p.saleState.purchasable ? (
                <LinkButton href={`/siparis/yeni?paket=${p.slug}`} block size="lg" variant={highlighted ? "primary" : "secondary"}>
                  Bu Paketi Seç
                </LinkButton>
              ) : (
                <div className="space-y-3">
                  <p className="flex items-start gap-2 rounded-xl bg-canvas px-3.5 py-3 text-sm text-muted ring-1 ring-line">
                    <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
                    {UNAVAILABLE_TEXT[p.saleState.reason]}
                  </p>
                  <LinkButton href="/iletisim?konu=paket" block variant="secondary">
                    Bilgi Al
                  </LinkButton>
                </div>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}

function Feature({ icon: Icon, title, children }: { icon: typeof Film; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <Icon className="mt-0.5 size-[18px] shrink-0 text-brand" aria-hidden />
      <div>
        <p className="font-semibold text-ink">{title}</p>
        <div className="text-ink-soft">{children}</div>
      </div>
    </li>
  );
}
