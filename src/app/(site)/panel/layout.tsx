import type { Metadata } from "next";
import { Suspense } from "react";
import { LogOut } from "lucide-react";
import { Container } from "@/components/ui/primitives";
import { logout } from "../(auth)/actions";
import { PanelNav } from "./panel-nav";

export const metadata: Metadata = { title: { template: "%s | Müşteri Paneli", default: "Müşteri Paneli" }, robots: { index: false } };

export default function PanelLayout({ children }: { children: React.ReactNode }) {
  return (
    <Container className="py-6 sm:py-10">
      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[230px_minmax(0,1fr)] lg:gap-10">
        <aside className="min-w-0 lg:sticky lg:top-24 lg:self-start">
          <p className="mb-3 hidden px-3 text-xs font-semibold uppercase tracking-wide text-muted lg:block">Müşteri Paneli</p>
          <Suspense fallback={<PanelNav withActive={false} />}>
            <PanelNav />
          </Suspense>
          <form action={logout} className="mt-4 hidden border-t border-line pt-4 lg:block">
            <button type="submit" className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted hover:bg-card hover:text-danger">
              <LogOut className="size-[18px]" aria-hidden /> Çıkış Yap
            </button>
          </form>
        </aside>
        <div className="min-w-0">{children}</div>
      </div>
    </Container>
  );
}
