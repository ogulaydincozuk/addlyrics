"use server";

import { refresh, updateTag } from "next/cache";
import type { AnnouncementDisplay } from "@prisma/client";
import type { ActionState } from "@/lib/action-state";
import { parseDateInput } from "@/lib/dates";
import { requireAdmin } from "@/server/auth/guards";
import { deleteAnnouncement, saveAnnouncement, setAnnouncementStatus } from "@/server/domain/announcements";
import { DomainError, isDomainError } from "@/server/domain/errors";
import { CACHE_TAGS } from "@/server/queries/public";

async function run(fn: (admin: Awaited<ReturnType<typeof requireAdmin>>) => Promise<string>): Promise<ActionState> {
  const admin = await requireAdmin();
  try {
    const message = await fn(admin);
    updateTag(CACHE_TAGS.announcements);
    refresh();
    return { ok: true, message };
  } catch (err) {
    if (isDomainError(err)) return { ok: false, message: err.message };
    console.error("[admin:announcements]", err);
    return { ok: false, message: "İşlem tamamlanamadı." };
  }
}

function input(fd: FormData) {
  const str = (k: string) => String(fd.get(k) ?? "").trim();
  const display = str("display") as AnnouncementDisplay;
  if (!["MODAL", "BANNER", "TOAST"].includes(display)) throw new DomainError("Gösterim türünü seçin.");
  const priority = Number(str("priority") || "0");
  return {
    title: str("title").slice(0, 160),
    body: str("body").slice(0, 2000),
    linkLabel: str("linkLabel").slice(0, 40) || null,
    linkUrl: str("linkUrl").slice(0, 500) || null,
    display,
    startsAt: str("startsAt") ? parseDateInput(str("startsAt")) : null,
    endsAt: str("endsAt") ? parseDateInput(str("endsAt")) : null,
    priority: Number.isFinite(priority) ? Math.max(-100, Math.min(100, Math.round(priority))) : 0,
  };
}

export async function saveAnnouncementAction(id: string | null, _prev: ActionState, fd: FormData) {
  return run(async (admin) => {
    await saveAnnouncement(admin, id, input(fd));
    return id ? "Duyuru güncellendi." : "Taslak duyuru oluşturuldu.";
  });
}

export async function publishAnnouncementAction(id: string, publish: boolean, _prev: ActionState) {
  return run(async (admin) => {
    await setAnnouncementStatus(admin, id, publish);
    return publish ? "Duyuru yayınlandı." : "Duyuru yayından kaldırıldı.";
  });
}

export async function deleteAnnouncementAction(id: string, _prev: ActionState) {
  return run(async (admin) => {
    await deleteAnnouncement(admin, id);
    return "Taslak silindi.";
  });
}
