import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ExternalLink, LogOut } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { requireAdmin } from "@/server/auth/guards";
import { logout } from "../(site)/(auth)/actions";
import { AdminNav } from "./admin-nav";

export const metadata: Metadata = {
  title: { template: "%s | AddLyrics Yönetim", default: "AddLyrics Yönetim" },
  robots: { index: false, follow: false },
};

// Yönetim alanı özeldir: yetki kontrolü tamamlanmadan hiçbir şey gönderilmez (engelleyici render).
// Böylece yetkisiz kullanıcılar panel iskeletini bile görmez ve gerçek 404 durum kodu alır.
export const instant = false;

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  return (
    <div className="min-h-dvh bg-canvas">
      <header className="sticky top-0 z-40 border-b border-line bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-[1400px] items-center justify-between gap-4 px-4 sm:px-6">
          <Link href="/admin" className="flex items-center gap-2">
            <Logo size="sm" />
            <span className="rounded-md bg-ink px-2 py-0.5 text-xs font-bold text-white">Yönetim</span>
          </Link>
          <div className="flex items-center gap-1">
            <span className="hidden px-2 text-sm text-muted md:inline">{admin.name}</span>
            <Link href="/" className="hidden items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-ink-soft hover:bg-brand-tint sm:flex">
              Siteyi aç <ExternalLink className="size-3.5" aria-hidden />
            </Link>
            <form action={logout}>
              <button type="submit" className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-ink-soft hover:bg-danger-soft hover:text-danger">
                <LogOut className="size-4" aria-hidden />
                <span className="hidden sm:inline">Çıkış</span>
              </button>
            </form>
          </div>
        </div>
      </header>
      <div className="mx-auto grid max-w-[1400px] grid-cols-[minmax(0,1fr)] gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-8">
        <aside className="min-w-0 lg:sticky lg:top-20 lg:self-start">
          <Suspense fallback={<AdminNav withActive={false} />}>
            <AdminNav />
          </Suspense>
        </aside>
        <main className="min-w-0">{children}</main>
      </div>
    </div>
  );
}
