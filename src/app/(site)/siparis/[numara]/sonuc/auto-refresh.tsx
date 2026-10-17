"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

/** Ödeme doğrulaması beklenirken sayfayı kısa aralıklarla yeniler (en fazla ~2 dakika). */
export function AutoRefresh({ intervalMs = 3000, maxTries = 40 }: { intervalMs?: number; maxTries?: number }) {
  const router = useRouter();
  const [tries, setTries] = useState(0);
  useEffect(() => {
    if (tries >= maxTries) return;
    const id = setTimeout(() => {
      router.refresh();
      setTries((n) => n + 1);
    }, intervalMs);
    return () => clearTimeout(id);
  }, [tries, maxTries, intervalMs, router]);
  return tries >= maxTries ? (
    <p className="mt-4 text-sm text-muted">Doğrulama beklenenden uzun sürdü. Ödemen onaylandığında e-posta ile bilgilendireceğiz.</p>
  ) : (
    <div className="mx-auto mt-6 h-1.5 w-40 overflow-hidden rounded-full bg-brand-soft">
      <div className="h-full w-1/3 animate-[indeterminate_1.4s_ease-in-out_infinite] rounded-full bg-brand" />
    </div>
  );
}
