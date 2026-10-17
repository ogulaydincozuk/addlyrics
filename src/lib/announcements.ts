// Duyuru seçimi (saf). Yayında ve tarih aralığında olan duyurulardan en öncelikli olanı döner;
// hiçbiri yoksa null — bu durumda sitede duyuru alanı hiç çizilmez.

export type AnnouncementLike = {
  id: string;
  status: "DRAFT" | "PUBLISHED" | "UNPUBLISHED";
  startsAt: Date | null;
  endsAt: Date | null;
  priority: number;
  publishedAt: Date | null;
  updatedAt: Date;
};

export function isAnnouncementLive(a: AnnouncementLike, now = new Date()) {
  if (a.status !== "PUBLISHED") return false;
  if (a.startsAt && a.startsAt > now) return false;
  if (a.endsAt && a.endsAt <= now) return false;
  return true;
}

export function pickActiveAnnouncement<T extends AnnouncementLike>(items: T[], now = new Date()): T | null {
  const live = items.filter((a) => isAnnouncementLive(a, now));
  live.sort(
    (a, b) =>
      b.priority - a.priority ||
      (b.publishedAt?.getTime() ?? b.updatedAt.getTime()) - (a.publishedAt?.getTime() ?? a.updatedAt.getTime()),
  );
  return live[0] ?? null;
}

export const ANNOUNCEMENT_DISPLAY_LABEL = { MODAL: "Açılır pencere", BANNER: "Üst bant", TOAST: "Küçük bildirim" } as const;
export const ANNOUNCEMENT_STATUS_LABEL = { DRAFT: "Taslak", PUBLISHED: "Yayında", UNPUBLISHED: "Yayından kaldırıldı" } as const;
