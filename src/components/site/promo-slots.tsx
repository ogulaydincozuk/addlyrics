import { getSessionUser } from "@/server/auth/session";
import { db } from "@/server/db";
import { getActiveAnnouncement, getTrialPromoAvailability } from "@/server/queries/public";
import { AnnouncementView } from "./announcement-view";
import { TrialPromo } from "./trial-promo";

/**
 * Ücretsiz deneme tanıtımı (pencere + sabit alan). Deneme kapalıysa, kapasite doluysa veya kullanıcının
 * zaten denemesi / paketi varsa hiç çizilmez.
 */
export async function TrialPromoSlot() {
  if (!(await getTrialPromoAvailability())) return null;
  const user = await getSessionUser();
  if (user) {
    if (user.role !== "CUSTOMER") return null;
    const state = await db.user.findUnique({
      where: { id: user.id },
      select: { trialApplication: { select: { id: true } }, _count: { select: { entitlements: true } } },
    });
    if (!state || state.trialApplication || state._count.entitlements > 0) return null;
  }
  return <TrialPromo />;
}

/** Ana sayfa duyurusu. Yayında aktif duyuru yoksa hiçbir şey (boş kutu dahil) çizilmez. */
export async function AnnouncementSlot() {
  const a = await getActiveAnnouncement();
  if (!a) return null;
  return (
    <AnnouncementView
      announcement={{
        id: a.id,
        version: a.updatedAt.toISOString(),
        title: a.title,
        body: a.body,
        linkLabel: a.linkLabel,
        linkUrl: a.linkUrl,
        display: a.display,
      }}
    />
  );
}
