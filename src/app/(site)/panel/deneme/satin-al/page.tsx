import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Gift, TicketPercent } from "lucide-react";
import { Alert, Badge, Card } from "@/components/ui/primitives";
import { formatMoney } from "@/lib/money";
import { perVideoKurus } from "@/lib/packages";
import { trialConversionPlan } from "@/lib/trial";
import { requireUser } from "@/server/auth/guards";
import { db } from "@/server/db";
import { packageSaleState, SALE_STATE_MESSAGES } from "@/server/domain/packages";
import { readSystemSetting } from "@/server/system-settings";
import { PanelPage } from "../../_components";
import { TrialPurchaseButton } from "../client";

export const metadata: Metadata = { title: "Denemeden Paket Satın Al" };

export default function TrialPurchasePage() {
  return (
    <PanelPage
      title="Paketini seç"
      description="Deneme videoların yeniden üretilmez; seçtiğin pakete dahil edilir."
      actions={
        <Link href="/panel/deneme" className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand hover:underline">
          <ArrowLeft className="size-4" aria-hidden /> Denemeye dön
        </Link>
      }
    >
      <Choose />
    </PanelPage>
  );
}

async function Choose() {
  const user = await requireUser("/panel/deneme/satin-al");
  const trial = await db.trialApplication.findUnique({ where: { userId: user.id }, select: { status: true, convertedOrderId: true, purgedAt: true } });
  if (!trial || trial.status !== "PREVIEW_READY" || trial.convertedOrderId || trial.purgedAt) {
    return (
      <Alert tone="info">
        Üç ön izlemen hazır olduğunda buradan paket seçebilirsin.{" "}
        <Link href="/panel/deneme" className="font-semibold underline">
          Deneme durumuna git
        </Link>
      </Alert>
    );
  }
  const [packages, settings] = await Promise.all([
    db.package.findMany({ where: { status: "PUBLISHED" }, include: { channelListings: true }, orderBy: [{ sortOrder: "asc" }, { durationMonths: "asc" }] }),
    readSystemSetting("system.trial"),
  ]);

  return (
    <div className="space-y-5">
      <p className="flex items-start gap-2 rounded-xl border border-dashed border-line bg-card px-4 py-3 text-sm text-ink-soft">
        <TicketPercent className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden />
        <span>
          <strong className="text-ink">Referans veya indirim kodun var mı?</strong> Paketini seçtikten sonra açılan ödeme sayfasının en üstünde
          girebilirsin; indirim toplam tutara hemen yansır.
        </span>
      </p>
      <div className="grid gap-4 lg:grid-cols-3">
        {packages.map((p) => {
          const state = packageSaleState(p);
          if (p.videoCount == null || p.priceKurus == null) return null;
          const plan = trialConversionPlan({
            videoCount: p.videoCount,
            bonusVideoCount: p.bonusVideoCount,
            durationMonths: p.durationMonths,
            countsTowardPackage: p.trialCountsTowardPackage,
          });
          const days = p.trialConversionBusinessDays ?? settings.conversionBusinessDays;
          const perVideo = perVideoKurus(p);
          return (
            <Card key={p.id} className={p.isFeatured ? "border-2 border-[#c4e534] p-5" : "p-5"}>
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-lg font-bold text-ink">{p.name}</h2>
                {p.isFeatured && <Badge tone="brand">En avantajlı</Badge>}
              </div>
              <p className="mt-3 text-3xl font-extrabold text-ink">{formatMoney(p.priceKurus, p.currency, { compact: true })}</p>
              {perVideo != null && <p className="text-sm text-muted">Video başına {formatMoney(perVideo, p.currency)}</p>}
              <ul className="mt-4 space-y-2 text-sm text-ink-soft">
                <li className="flex gap-2">
                  <Gift className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden />
                  <span>
                    <strong className="text-ink">3 deneme videon</strong> tam ve temiz sürüm olarak teslim edilir (son kalite kontrolünden sonra).
                  </span>
                </li>
                <li className="flex gap-2">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
                  <span>
                    İlk teslimde <strong className="text-ink">{plan.newVideos} yeni video</strong>, ödeme onayından itibaren en geç {days} iş günü içinde.
                  </span>
                </li>
                <li className="flex gap-2">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
                  <span>
                    {plan.entitlementTotal === plan.packageTotal
                      ? `Toplam ${plan.packageTotal} farklı video (3 deneme videosu pakete dahildir).`
                      : `Toplam ${plan.entitlementTotal} video (paketin ${plan.packageTotal} videosu + 3 deneme videosu).`}
                  </span>
                </li>
                {p.durationMonths > 1 && (
                  <li className="flex gap-2">
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
                    <span>Kalan videolar paket süresince aylık teslim planına göre ayın 1&apos;inde teslim edilir.</span>
                  </li>
                )}
              </ul>
              <div className="mt-5">
                {state.purchasable ? (
                  <TrialPurchaseButton packageSlug={p.slug} label={`${p.name} Satın Al`} featured={p.isFeatured} />
                ) : (
                  <p className="text-sm text-muted">{SALE_STATE_MESSAGES[state.reason]}</p>
                )}
              </div>
            </Card>
          );
        })}
      </div>
      <p className="text-xs text-muted">Tek seferlik ödeme, otomatik yenileme yok.</p>
    </div>
  );
}
