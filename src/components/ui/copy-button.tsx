"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/cn";

/** Metni panoya kopyalar; kısa süre "Kopyalandı" gösterir. */
export function CopyButton({ text, label = "Kopyala", className }: { text: string; label?: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Pano izni yoksa metni seçilebilir bir pencerede göster
      window.prompt("Kopyalamak için seçin:", text);
      return;
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }
  return (
    <button
      type="button"
      onClick={copy}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold ring-1 transition-colors",
        copied ? "bg-success-soft text-[#166534] ring-[#bbf7d0]" : "bg-card text-ink ring-line hover:ring-brand-soft",
        className,
      )}
    >
      {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
      {copied ? "Kopyalandı" : label}
    </button>
  );
}
