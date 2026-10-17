import type { Metadata } from "next";
import { Suspense } from "react";
import { LogOut } from "lucide-react";
import { Container } from "@/components/ui/primitives";
import { getSessionUser } from "@/server/auth/session";
import { getPanelAttention } from "@/server/queries/customer";
import { logout } from "../(auth)/actions";
import { PanelNav, type PanelNavMarks } from "./panel-nav";

export const metadata: Metadata = { title: { template: "%s | Müşteri Paneli", default: "Müşteri Paneli" }, robots: { index: false } };

export default function PanelLayout({ children }: { children: React.ReactNode }) {
  return (
    <Container className="py-6 sm:py-10">
      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[230px_minmax(0,1fr)] lg:gap-10">
        <aside className="min-w-0 lg:sticky lg:top-24 lg:self-start">
          <p className="mb-3 hidden px-3 text-xs font-semibold uppercase tracking-wide text-muted lg:block">Müşteri Paneli</p>
          <Suspense fallback={<PanelNav withActive={false} />}>
            <PanelNavWithMarks />
          </Suspense>
          <form action={logout} className="mt-4 hidden border-t border-line pt-4 lg:block">
            <button type="submit" className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted hover:bg-card hover:text-danger">
              <LogOut className="size-[18px]" aria-hidden /> Çıkış Yap
            </button>
          </form>
        </aside>
        <div className="min-w-0">{children}</div>
      </div>
      {/* Mobilde çıkış: masaüstü menüdeki düğme gizli olduğu için sayfa sonunda gösterilir */}
      <form action={logout} className="mt-10 border-t border-line pt-4 text-center lg:hidden">
        <button type="submit" className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-muted hover:text-danger">
          <LogOut className="size-4" aria-hidden /> Çıkış Yap
        </button>
      </form>
    </Container>
  );
}

/** Menüde dikkat işaretleri: ekibin yanıt bekleyen soruları, okunmamış bildirimler, eksik doğrulama, hazır ön izlemeler. */
async function PanelNavWithMarks() {
  const user = await getSessionUser();
  if (!user) return <PanelNav />;
  const a = await getPanelAttention(user.id);
  const marks: PanelNavMarks = {
    "/panel": a.unreadNotifications ? { count: a.unreadNotifications, title: "Okunmamış bildirim" } : undefined,
    "/panel/siparislerim": a.awaitingReply.length ? { count: a.awaitingReply.length, title: "Ekibin yanıtını beklediği soru" } : undefined,
    "/panel/dogrulama": !(a.emailVerified && a.phoneVerified) ? { dot: true, title: "Doğrulama tamamlanmadı" } : undefined,
    "/panel/deneme":
      a.trial && (a.trial.status === "PREVIEW_READY" || a.trial.status === "NEEDS_INFO")
        ? { dot: true, title: a.trial.status === "PREVIEW_READY" ? "Ön izlemelerin hazır" : "Eksik bilgi bekleniyor" }
        : undefined,
  };
  return <PanelNav marks={marks} />;
}
