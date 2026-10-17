import { Suspense } from "react";
import { SiteFooter } from "@/components/site/footer";
import { TrialPromoSlot } from "@/components/site/promo-slots";
import { SiteHeader } from "@/components/site/header";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#icerik"
        className="sr-only z-50 rounded-lg bg-lime px-4 py-2 text-ink focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        İçeriğe geç
      </a>
      <SiteHeader />
      <main id="icerik" className="flex-1">
        {children}
      </main>
      <SiteFooter />
      <Suspense fallback={null}>
        <TrialPromoSlot />
      </Suspense>
    </div>
  );
}
