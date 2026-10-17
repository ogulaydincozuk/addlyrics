"use client";

import { useEffect, useState } from "react";
import { TicketPercent, X } from "lucide-react";
import { REFERRAL_QUERY_PARAM, storeReferralCode } from "@/lib/referral-link";

/**
 * Paylaşım bağlantısıyla (?kod=KOD) gelen ziyaretçinin kodunu hatırlar ve kısa bir bilgi gösterir.
 * Kod, sipariş özetinde otomatik doldurulur; geçerliliği ve indirimi sunucu belirler.
 */
// Bağlantıdan alınan ve henüz gösterilmemiş kod (efekt geliştirme modunda iki kez çalışsa da bilgi kaybolmasın)
let pendingNotice: string | null = null;

export function ReferralCapture() {
  const [code, setCode] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get(REFERRAL_QUERY_PARAM);
    if (raw) {
      pendingNotice = storeReferralCode(raw);
      // Bağlantıyı temizle (yeniden paylaşımda kod tekrar eklenmesin, adres sade kalsın)
      params.delete(REFERRAL_QUERY_PARAM);
      const rest = params.toString();
      window.history.replaceState(window.history.state, "", `${window.location.pathname}${rest ? `?${rest}` : ""}${window.location.hash}`);
    }
    const saved = pendingNotice;
    if (!saved) return;
    // Bilgi şeridi bir sonraki karede gösterilir (efekt içinde eşzamanlı durum güncellemesi yapılmaz)
    const show = window.setTimeout(() => {
      pendingNotice = null;
      setCode(saved);
    }, 0);
    const hide = window.setTimeout(() => setCode(null), 12000);
    return () => {
      window.clearTimeout(show);
      window.clearTimeout(hide);
    };
  }, []);

  if (!code) return null;
  return (
    <div role="status" className="fixed inset-x-4 top-20 z-50 mx-auto flex max-w-lg items-start gap-3 rounded-2xl bg-ink px-4 py-3 text-sm text-white shadow-lg">
      <TicketPercent className="mt-0.5 size-5 shrink-0 text-lime" aria-hidden />
      <p className="flex-1">
        <strong className="font-mono">{code}</strong> kodun kaydedildi. Paketini seçip sipariş verdiğinde indirimin sipariş özetinde otomatik uygulanır.
      </p>
      <button type="button" onClick={() => setCode(null)} className="rounded-md p-0.5 text-white/70 hover:text-white" aria-label="Kapat">
        <X className="size-4" aria-hidden />
      </button>
    </div>
  );
}
