"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Megaphone, X } from "lucide-react";
import { claimOverlay, readStore, releaseOverlay, writeStore } from "./overlay-coordinator";

export type AnnouncementData = {
  id: string;
  /** Duyuru güncellenirse tekrar gösterilir */
  version: string;
  title: string;
  body: string;
  linkLabel: string | null;
  linkUrl: string | null;
  display: "MODAL" | "BANNER" | "TOAST";
};

const OVERLAY_ID = "announcement";

/** Kapatılabilir duyuru: kapatıldığında aynı sürüm bu tarayıcıda tekrar gösterilmez. */
export function AnnouncementView({ announcement: a }: { announcement: AnnouncementData }) {
  const key = `al_announcement_${a.id}`;
  const [open, setOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (readStore(key) === a.version) return;
    const id = window.setTimeout(() => {
      if (a.display === "MODAL" && !claimOverlay(OVERLAY_ID)) return;
      setOpen(true);
    }, 0);
    return () => window.clearTimeout(id);
  }, [key, a.version, a.display]);

  useEffect(() => {
    if (!open || a.display !== "MODAL") return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && dismiss();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, a.display]);

  function dismiss() {
    writeStore(key, a.version);
    setOpen(false);
    if (a.display === "MODAL") releaseOverlay(OVERLAY_ID);
  }

  if (!open) return null;

  const link =
    a.linkUrl && a.linkLabel ? (
      <Link
        href={a.linkUrl}
        onClick={dismiss}
        className="inline-flex h-10 shrink-0 items-center justify-center rounded-xl bg-ink px-4 text-sm font-semibold text-white hover:bg-ink-soft"
      >
        {a.linkLabel}
      </Link>
    ) : null;

  if (a.display === "MODAL") {
    return (
      <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-ink/45" onClick={dismiss} aria-hidden />
        <div role="dialog" aria-modal="true" aria-labelledby="announcement-title" className="relative w-full max-w-lg rounded-3xl bg-card p-6 shadow-2xl motion-safe:animate-fade-up sm:p-8">
          <button ref={closeRef} type="button" onClick={dismiss} className="absolute right-3 top-3 rounded-full p-2 text-muted hover:bg-canvas" aria-label="Duyuruyu kapat">
            <X className="size-5" aria-hidden />
          </button>
          <span className="flex size-11 items-center justify-center rounded-2xl bg-lime text-ink">
            <Megaphone className="size-5" aria-hidden />
          </span>
          <h2 id="announcement-title" className="mt-4 text-xl font-extrabold text-ink">
            {a.title}
          </h2>
          <p className="mt-2 whitespace-pre-line text-ink-soft">{a.body}</p>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={dismiss} className="h-10 rounded-xl px-4 text-sm font-semibold text-ink-soft hover:bg-canvas">
              Kapat
            </button>
            {link}
          </div>
        </div>
      </div>
    );
  }

  if (a.display === "TOAST") {
    return (
      <div role="status" className="fixed bottom-20 left-4 right-4 z-50 rounded-2xl border border-line bg-card p-4 shadow-[0_20px_50px_-20px_rgb(15_23_42/0.45)] motion-safe:animate-fade-up sm:left-6 sm:right-auto sm:bottom-6 sm:max-w-sm">
        <div className="flex gap-3">
          <Megaphone className="mt-0.5 size-5 shrink-0 text-brand" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-ink">{a.title}</p>
            <p className="mt-1 text-sm text-ink-soft">{a.body}</p>
            {link && <div className="mt-3">{link}</div>}
          </div>
          <button type="button" onClick={dismiss} className="-m-1 h-fit rounded-full p-1 text-muted hover:bg-canvas" aria-label="Duyuruyu kapat">
            <X className="size-4" aria-hidden />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div role="region" aria-label="Duyuru" className="border-b border-[#dcef8a] bg-brand-tint">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:px-6">
        <Megaphone className="hidden size-5 shrink-0 text-brand sm:block" aria-hidden />
        <p className="min-w-0 flex-1 text-sm text-brand-ink">
          <strong className="font-semibold">{a.title}</strong> <span className="text-ink-soft">{a.body}</span>
        </p>
        <div className="flex items-center gap-2">
          {link}
          <button type="button" onClick={dismiss} className="rounded-full p-1.5 text-brand-ink/70 hover:bg-white" aria-label="Duyuruyu kapat">
            <X className="size-4" aria-hidden />
          </button>
        </div>
      </div>
    </div>
  );
}
