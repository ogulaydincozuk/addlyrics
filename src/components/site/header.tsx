import Link from "next/link";
import { Suspense } from "react";
import { LayoutDashboard, LogOut, ShieldCheck } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { LinkButton } from "@/components/ui/button";
import { messages } from "@/i18n/config";
import { logout } from "@/app/(site)/(auth)/actions";
import { getSessionUser } from "@/server/auth/session";
import { countUnreadNotifications } from "@/server/queries/customer";
import { MobileMenu } from "./mobile-menu";

export const NAV_ITEMS = [
  { href: "/", key: "home" },
  { href: "/#nasil-calisir", key: "howItWorks" },
  { href: "/ornekler", key: "examples" },
  { href: "/paketler", key: "packages" },
  { href: "/sss", key: "faq" },
] as const;

export function SiteHeader() {
  const t = messages();
  return (
    <header className="sticky top-0 z-40 border-b border-line/80 bg-white/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="shrink-0 rounded-lg" aria-label="AddLyrics ana sayfa">
          <Logo />
        </Link>

        <nav aria-label="Ana menü" className="hidden lg:block">
          <ul className="flex items-center gap-0.5 xl:gap-1">
            {NAV_ITEMS.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="whitespace-nowrap rounded-lg px-2.5 py-2 text-sm font-medium text-ink-soft transition-colors hover:bg-brand-tint hover:text-brand xl:px-3"
                >
                  {item.key === "faq" ? (
                    <>
                      <span className="xl:hidden" aria-hidden>
                        {t.nav.faqShort}
                      </span>
                      <span className="max-xl:sr-only">{t.nav.faq}</span>
                    </>
                  ) : (
                    t.nav[item.key]
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="hidden items-center gap-2 lg:flex">
          <Suspense fallback={<span className="h-9 w-20 rounded-lg bg-slate-100" aria-hidden />}>
            <HeaderAccount />
          </Suspense>
          <LinkButton href="/paketler" size="sm">
            {t.nav.browsePackages}
          </LinkButton>
        </div>

        <MobileMenu
          items={NAV_ITEMS.map((i) => ({ href: i.href, label: t.nav[i.key] }))}
          labels={{ open: t.nav.menu, close: t.nav.closeMenu, cta: t.nav.browsePackages }}
        >
          <Suspense fallback={null}>
            <HeaderAccount mobile />
          </Suspense>
        </MobileMenu>
      </div>
    </header>
  );
}

async function HeaderAccount({ mobile = false }: { mobile?: boolean }) {
  const t = messages();
  const user = await getSessionUser();
  const linkClass = mobile
    ? "flex items-center gap-2 rounded-xl px-3 py-3 text-base font-medium text-ink hover:bg-brand-tint"
    : "inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold text-ink-soft hover:bg-brand-tint hover:text-brand";
  if (!user) {
    return (
      <Link href="/giris" className={linkClass}>
        {t.nav.login}
      </Link>
    );
  }
  // Müşteride okunmamış bildirim sayısı panele giden bağlantıda gösterilir
  const unread = user.role === "PARTNER" ? 0 : await countUnreadNotifications(user.id);
  return (
    <>
      {user.role === "ADMIN" && (
        <Link href="/admin" className={linkClass}>
          <ShieldCheck className="size-4" aria-hidden />
          {t.nav.admin}
        </Link>
      )}
      <Link href={user.role === "PARTNER" ? "/ortak" : unread ? "/panel#bildirimler" : "/panel"} className={linkClass}>
        <LayoutDashboard className="size-4" aria-hidden />
        {user.role === "PARTNER" ? "İş Ortaklığı Paneli" : t.nav.myPanel}
        {unread > 0 && (
          <span className="min-w-5 rounded-full bg-danger px-1.5 text-center text-[11px] font-bold leading-5 text-white" aria-label={`${unread} okunmamış bildirim`}>
            {unread}
          </span>
        )}
      </Link>
      {mobile && (
        <form action={logout}>
          <button type="submit" className={`${linkClass} w-full text-muted`}>
            <LogOut className="size-4" aria-hidden />
            {t.nav.logout}
          </button>
        </form>
      )}
    </>
  );
}
