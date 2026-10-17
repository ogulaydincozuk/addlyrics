import { cn } from "@/lib/cn";

/**
 * AddLyrics logosu (marka tasarımına sadık yeniden çizim):
 *   "Add"    → kalın grotesk, beyaz
 *   "Lyrics" → italik yüksek kontrastlı serif, logo yeşili (#DFFF4C)
 * Açık zeminli sayfalarda logonun özgün siyah zemini küçük bir rozet olarak korunur.
 */
export function Logo({ className, size = "md" }: { className?: string; size?: "sm" | "md" | "lg" }) {
  return (
    <span
      className={cn(
        "inline-flex items-baseline rounded-[0.6rem] bg-logo-black leading-none",
        size === "sm" && "px-2 pb-1 pt-1.5 text-[0.95rem]",
        size === "md" && "px-2.5 pb-1.5 pt-2 text-[1.2rem]",
        size === "lg" && "px-4 pb-2.5 pt-3 text-[2rem]",
        className,
      )}
      aria-label="AddLyrics"
      role="img"
    >
      <span aria-hidden className="font-sans font-black tracking-[-0.055em] text-white">
        Add
      </span>
      <span aria-hidden className="-ml-[0.04em] font-logo text-[1.12em] font-semibold italic tracking-[-0.01em] text-lime">
        Lyrics
      </span>
    </span>
  );
}

/** Kare marka işareti (favicon ve küçük alanlar için): siyah zemin üzerinde italik "L". */
export function LogoMark({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex size-9 items-center justify-center rounded-[0.6rem] bg-logo-black", className)} aria-hidden>
      <span className="font-logo text-[1.35rem] font-semibold italic leading-none text-lime">L</span>
    </span>
  );
}
