import type { Metadata } from "next";
import Link from "next/link";
import { Check, Minus } from "lucide-react";
import { PackageCards } from "@/components/packages/package-cards";
import { PageHeader } from "@/components/site/page-header";
import { Alert, Container, SectionHeading } from "@/components/ui/primitives";
import { messages } from "@/i18n/config";
import { VIDEO_FORMATS, VIDEO_STYLES } from "@/lib/enums";
import { allocationLabel, FIRST_DELIVERY_RULE_TEXT } from "@/lib/delivery-plan";
import { formatMoney } from "@/lib/money";
import { getPublicPackages, getSetting, type PublicPackage } from "@/server/queries/public";

export const metadata: Metadata = {
  title: "Lyrics Video Paketleri ve Fiyatlar",
  description:
    "1, 2 ve 3 aylık lyrics video paketlerini karşılaştır: toplam video sayısı, video başına maliyet ve aylık teslim planı. Tek seferlik ödeme, otomatik yenileme yok.",
  alternates: { canonical: "/paketler" },
};

export default async function PackagesPage() {
  const [packages, home] = await Promise.all([getPublicPackages(), getSetting("home")]);
  const anySample = packages.some((p) => p.isSample && p.priceKurus != null);

  return (
    <>
      <PageHeader eyebrow="Paketler" title={home.packagesTitle} description={home.packagesDescription} />
      <Container className="py-14 sm:py-20">
        {anySample && (
          <Alert tone="warning" title="Geliştirme ortamı: örnek fiyatlar" className="mx-auto mb-10 max-w-3xl">
            &quot;Örnek veri&quot; etiketli paketlerin fiyat ve koşulları gerçek değildir; yalnızca test için gösterilir. Üretim ortamında
            örnek paketler satışa açılmaz ve fiyatları gösterilmez.
          </Alert>
        )}
        <PackageCards packages={packages} headingLevel="h2" />
        <p className="mx-auto mt-8 max-w-2xl rounded-2xl border border-dashed border-line bg-card px-5 py-4 text-center text-sm text-ink-soft">
          Karar vermeden önce görmek mi istiyorsun?{" "}
          <Link href="/ucretsiz-deneme" className="font-semibold text-brand hover:underline">
            Şarkın için 3 videoyu ücretsiz dene
          </Link>
          .
        </p>

        {packages.length > 1 && <ComparisonTable packages={packages} />}

        <div className="mx-auto mt-16 grid max-w-4xl gap-6 sm:grid-cols-3">
          {[
            { title: "Tek seferlik ödeme", text: "Paketler tek seferde ödenir. Otomatik yenileme veya tekrarlayan kart tahsilatı yoktur." },
            { title: "Haklarını panelden izle", text: "Toplam, kullanılan ve kalan video haklarını müşteri panelinde görürsün." },
            { title: "Güvenli ödeme", text: "Kart bilgilerin ödeme kuruluşunun sayfasında girilir; AddLyrics kart bilgisi saklamaz." },
          ].map((item) => (
            <div key={item.title} className="rounded-2xl border border-line bg-card p-5">
              <p className="font-display font-bold text-ink">{item.title}</p>
              <p className="mt-2 text-sm leading-relaxed text-muted">{item.text}</p>
            </div>
          ))}
        </div>
        <p className="mt-10 text-center text-sm text-muted">
          Satın almadan önce{" "}
          <Link href="/iptal-ve-iade-politikasi" className="font-semibold text-brand hover:underline">
            İptal ve İade Politikası
          </Link>{" "}
          ile{" "}
          <Link href="/kullanim-kosullari" className="font-semibold text-brand hover:underline">
            Kullanım Koşulları
          </Link>
          &apos;nı inceleyebilirsin.
        </p>
      </Container>
    </>
  );
}

function ComparisonTable({ packages }: { packages: PublicPackage[] }) {
  const t = messages();
  const na = <span className="text-muted">Yakında</span>;
  const rows: Array<{ label: string; render: (p: PublicPackage) => React.ReactNode }> = [
    { label: "Paket süresi", render: (p) => `${p.durationMonths} ay` },
    { label: "Pakete dahil video", render: (p) => (p.videoCount != null ? `${p.videoCount} video` : na) },
    { label: "Bonus video", render: (p) => (p.videoCount == null ? na : p.bonusVideoCount > 0 ? <strong className="text-success">+{p.bonusVideoCount} video</strong> : <span className="text-muted">—</span>) },
    { label: "Teslim edilecek toplam video", render: (p) => (p.totalVideos != null ? <strong>{p.totalVideos} video</strong> : na) },
    { label: "Paket fiyatı", render: (p) => (p.priceKurus != null ? formatMoney(p.priceKurus, p.currency) : na) },
    {
      label: "Video başına maliyet",
      render: (p) =>
        p.perVideoKurus != null ? (
          <span>
            <strong>{formatMoney(p.perVideoKurus, p.currency)}</strong>
            {p.savingsPercent ? <span className="ml-1.5 text-xs font-semibold text-success">%{p.savingsPercent} daha uygun</span> : null}
          </span>
        ) : (
          na
        ),
    },
    { label: "Aylık ortalama", render: (p) => (p.perMonthKurus != null ? formatMoney(p.perMonthKurus, p.currency) : na) },
    {
      label: "Teslim planı",
      render: (p) => (p.videoCount != null ? allocationLabel(p.videoCount, p.bonusVideoCount, p.durationMonths) + " video" : na),
    },
    ...VIDEO_STYLES.map((s) => ({
      label: t.enums.videoStyleShort[s],
      render: (p: PublicPackage) => <Included yes={p.includedStyles.includes(s)} />,
    })),
    ...VIDEO_FORMATS.map((f) => ({
      label: t.enums.videoFormat[f],
      render: (p: PublicPackage) => <Included yes={p.includedFormats.includes(f)} />,
    })),
  ];

  return (
    <section id="karsilastirma" className="mt-20">
      <SectionHeading
        title="Paketleri Karşılaştır"
        description={`Video başına maliyet, paket fiyatının bonus videolar dahil teslim edilecek toplam video sayısına bölünmesiyle hesaplanır. ${FIRST_DELIVERY_RULE_TEXT} Sonraki teslimler her ayın 1'inde.`}
      />
      {/* relative: tablodaki sr-only (absolute) etiketler kaydırma kutusunun dışına taşmasın */}
      <div className="relative mt-10 overflow-x-auto rounded-2xl border border-line bg-card">
        <table className="w-full min-w-[640px] text-left text-sm">
          <caption className="sr-only">Paket karşılaştırma tablosu</caption>
          <thead>
            <tr className="border-b border-line bg-canvas">
              <th scope="col" className="px-5 py-4 font-semibold text-muted">
                Özellik
              </th>
              {packages.map((p) => (
                <th key={p.id} scope="col" className="px-5 py-4 font-display text-base font-bold text-ink">
                  {p.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((row) => (
              <tr key={row.label}>
                <th scope="row" className="px-5 py-3.5 font-medium text-ink-soft">
                  {row.label}
                </th>
                {packages.map((p) => (
                  <td key={p.id} className="px-5 py-3.5 text-ink">
                    {row.render(p)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Included({ yes }: { yes: boolean }) {
  return yes ? (
    <span className="inline-flex items-center gap-1 text-success">
      <Check className="size-4" aria-hidden /> <span className="sr-only">Dahil</span>
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-slate-400">
      <Minus className="size-4" aria-hidden /> <span className="sr-only">Dahil değil</span>
    </span>
  );
}
