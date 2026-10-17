"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Gift, Sparkles, X } from "lucide-react";
import { claimOverlay, overlayOwner, readStore, releaseOverlay, subscribeOverlay, writeStore } from "./overlay-coordinator";

const STORE_KEY = "al_trial_promo";
const OVERLAY_ID = "trial";
/** Açılır pencere ilk ziyarette, sayfa açıldıktan kısa süre sonra bir kez gösterilir */
const OPEN_DELAY_MS = 2500;
/** Bu sayfalarda tanıtım gösterilmez (başvuru, panel ve ödeme akışları) */
const HIDDEN_PREFIXES = ["/ucretsiz-deneme", "/panel", "/siparis", "/ortak", "/giris", "/kayit", "/sifre", "/e-posta-dogrula"];

type Phase = "idle" | "modal" | "tab" | "hidden";

/**
 * Ücretsiz deneme tanıtımı:
 *  - İlk ziyaret: kapatılabilir açılır pencere (yalnızca bir kez).
 *  - Kapatıldıktan sonra: masaüstünde sağ kenarda küçük sabit alan, mobilde alt kısımda ince çubuk.
 *  - Sabit alan da kapatılabilir; bu tercih yalnızca bu oturum için geçerlidir.
 */
export function TrialPromo() {
  const pathname = usePathname() ?? "/";
  const hiddenHere = HIDDEN_PREFIXES.some((p) => pathname.startsWith(p));
  const [phase, setPhase] = useState<Phase>("idle");
  const primaryRef = useRef<HTMLAnchorElement>(null);
  const lastFocus = useRef<HTMLElement | null>(null);

  // İlk durum yalnızca tarayıcıda belirlenir (sunucu çıktısı boş kalır → hidrasyon uyumsuzluğu yok)
  useEffect(() => {
    if (hiddenHere) return;
    let sessionHidden = false;
    try {
      sessionHidden = window.sessionStorage.getItem(`${STORE_KEY}_tab`) === "closed";
    } catch {
      /* yok sayılır */
    }
    const seen = readStore(STORE_KEY);
    if (seen) {
      const id = window.setTimeout(() => setPhase(sessionHidden ? "hidden" : "tab"), 0);
      return () => window.clearTimeout(id);
    }
    const tryOpen = () => {
      if (overlayOwner() && overlayOwner() !== OVERLAY_ID) return; // duyuru açıksa bekle
      if (claimOverlay(OVERLAY_ID)) {
        lastFocus.current = document.activeElement as HTMLElement | null;
        setPhase("modal");
        unsubscribe();
      }
    };
    const unsubscribe = subscribeOverlay(() => {
      if (!overlayOwner()) tryOpen();
    });
    const timer = window.setTimeout(tryOpen, OPEN_DELAY_MS);
    return () => {
      window.clearTimeout(timer);
      unsubscribe();
    };
  }, [hiddenHere]);

  useEffect(() => {
    if (phase !== "modal") return;
    primaryRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismiss();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [phase]);

  function dismiss() {
    writeStore(STORE_KEY, new Date().toISOString());
    releaseOverlay(OVERLAY_ID);
    setPhase("tab");
    lastFocus.current?.focus?.();
  }

  function closeTab() {
    try {
      window.sessionStorage.setItem(`${STORE_KEY}_tab`, "closed");
    } catch {
      /* yok sayılır */
    }
    setPhase("hidden");
  }

  function onStart() {
    writeStore(STORE_KEY, new Date().toISOString());
    releaseOverlay(OVERLAY_ID);
  }

  if (hiddenHere || phase === "idle" || phase === "hidden") return null;

  if (phase === "modal") {
    return (
      <div className="fixed inset-0 z-[60] flex items-end justify-center p-4 sm:items-center" role="presentation">
        <div className="absolute inset-0 bg-ink/45 backdrop-blur-[2px]" onClick={dismiss} aria-hidden />
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="trial-promo-title"
          aria-describedby="trial-promo-desc"
          className="relative w-full max-w-md overflow-hidden rounded-3xl bg-card shadow-[0_30px_80px_-20px_rgb(15_23_42/0.45)] motion-safe:animate-fade-up"
        >
          <div className="relative bg-logo-black px-6 pb-7 pt-8 text-white">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_80%_at_100%_0%,rgb(223_255_76/0.25),transparent_60%)]" />
            <button
              type="button"
              onClick={dismiss}
              className="absolute right-3 top-3 rounded-full p-2 text-white/70 hover:bg-white/10 hover:text-white"
              aria-label="Kapat"
            >
              <X className="size-5" aria-hidden />
            </button>
            <span className="relative inline-flex items-center gap-1.5 rounded-full bg-lime px-3 py-1 text-xs font-bold text-ink">
              <Gift className="size-3.5" aria-hidden /> 3 ücretsiz video
            </span>
            <h2 id="trial-promo-title" className="relative mt-4 text-2xl font-extrabold leading-tight">
              AddLyrics&apos;ı Ücretsiz Dene
            </h2>
            <p id="trial-promo-desc" className="relative mt-2 text-white/80">
              Şarkını gönder, sana özel hazırlanan 3 örnek lyric videoyu incele. Satın almadan önce sonucu gör.
            </p>
          </div>
          <div className="flex flex-col gap-2 p-5 sm:flex-row-reverse">
            <Link
              ref={primaryRef}
              href="/ucretsiz-deneme"
              onClick={onStart}
              className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-lime px-5 font-semibold text-ink shadow-[0_10px_24px_-12px_rgb(150_190_20/0.9)] hover:bg-lime-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              <Sparkles className="size-4" aria-hidden /> Ücretsiz Denemeyi Başlat
            </Link>
            <button type="button" onClick={dismiss} className="h-12 rounded-xl px-5 font-semibold text-ink-soft hover:bg-canvas">
              Şimdilik Geç
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Masaüstü: sağ kenarda dikey sekme */}
      <div className="fixed right-0 top-1/2 z-40 hidden -translate-y-1/2 md:block">
        <div className="group relative">
          <Link
            href="/ucretsiz-deneme"
            className="flex flex-col items-center gap-2 rounded-l-2xl bg-lime px-3 py-4 text-ink shadow-[0_12px_30px_-12px_rgb(15_23_42/0.45)] ring-1 ring-[#c4e534] transition-transform hover:-translate-x-1"
            aria-label="3 ücretsiz video dene"
          >
            <Gift className="size-5" aria-hidden />
            <span className="text-sm font-bold [writing-mode:vertical-rl] rotate-180">3 Ücretsiz Video Dene</span>
          </Link>
          <button
            type="button"
            onClick={closeTab}
            className="absolute -left-2.5 -top-2.5 hidden size-6 items-center justify-center rounded-full bg-ink text-white shadow group-hover:flex focus-visible:flex"
            aria-label="Ücretsiz deneme alanını gizle"
          >
            <X className="size-3.5" aria-hidden />
          </button>
        </div>
      </div>
      {/* Mobil: alt kısımda ince çubuk (sayfa içeriği altına boşluk bırakılır) */}
      <div className="h-16 md:hidden" aria-hidden />
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#c4e534] bg-lime/95 px-4 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2 backdrop-blur md:hidden">
        <div className="mx-auto flex max-w-md items-center gap-3">
          <Gift className="size-5 shrink-0 text-ink" aria-hidden />
          <p className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">3 ücretsiz örnek video</p>
          <Link href="/ucretsiz-deneme" className="shrink-0 rounded-lg bg-ink px-3 py-2 text-sm font-semibold text-white">
            Ücretsiz Dene
          </Link>
          <button type="button" onClick={closeTab} className="shrink-0 rounded-full p-1.5 text-ink/70 hover:bg-black/5" aria-label="Gizle">
            <X className="size-4" aria-hidden />
          </button>
        </div>
      </div>
    </>
  );
}
