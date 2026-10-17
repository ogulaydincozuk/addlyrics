"use client";

import Link from "next/link";
import { useEffect, useId, useState, type ReactNode } from "react";
import { Menu, X } from "lucide-react";
import { buttonClasses } from "@/components/ui/button";

export function MobileMenu({
  items,
  labels,
  children,
}: {
  items: Array<{ href: string; label: string }>;
  labels: { open: string; close: string; cta: string };
  children: ReactNode;
}) {
  // Menüdeki her bağlantı tıklandığında menüyü kapatır (usePathname kullanılmaz: dinamik
  // rotalarda ön-render'ı engellerdi)
  const [open, setOpen] = useState(false);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <div className="lg:hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex size-10 items-center justify-center rounded-xl border border-line bg-card text-ink"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={open ? labels.close : labels.open}
      >
        {open ? <X className="size-5" /> : <Menu className="size-5" />}
      </button>

      {open && (
        <div id={panelId} className="fixed inset-x-0 bottom-0 top-16 z-50 overflow-y-auto border-t border-line bg-white">
          <nav aria-label="Mobil menü" className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-4">
            {items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="rounded-xl px-3 py-3 text-base font-medium text-ink hover:bg-brand-tint"
              >
                {item.label}
              </Link>
            ))}
            <div className="my-2 h-px bg-line" />
            <div onClick={() => setOpen(false)}>{children}</div>
            <Link href="/paketler" onClick={() => setOpen(false)} className={buttonClasses({ block: true, size: "lg", className: "mt-3" })}>
              {labels.cta}
            </Link>
          </nav>
        </div>
      )}
    </div>
  );
}
