"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BadgeCheck,
  CreditCard,
  FileStack,
  Gift,
  LayoutDashboard,
  ListMusic,
  Music,
  Package,
  PlayCircle,
  PlusCircle,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/cn";

export const PANEL_LINKS = [
  { href: "/panel", label: "Genel Bakış", icon: LayoutDashboard },
  { href: "/panel/yeni-siparis", label: "Yeni Şarkı Gönder", icon: PlusCircle },
  { href: "/panel/deneme", label: "Ücretsiz Deneme", icon: Gift },
  { href: "/panel/paketlerim", label: "Paketlerim", icon: Package },
  { href: "/panel/siparislerim", label: "Siparişlerim", icon: ListMusic },
  { href: "/panel/sarkilarim", label: "Şarkılarım", icon: Music },
  { href: "/panel/dosyalarim", label: "Dosyalarım", icon: FileStack },
  { href: "/panel/teslimler", label: "Teslim Edilen Videolar", icon: PlayCircle },
  { href: "/panel/odemeler", label: "Ödeme Geçmişi", icon: CreditCard },
  { href: "/panel/dogrulama", label: "Hesap Doğrulama", icon: BadgeCheck },
  { href: "/panel/hesap", label: "Hesap Ayarları", icon: Settings },
] as const;

function isActive(pathname: string | null, href: string) {
  if (!pathname) return false;
  return href === "/panel" ? pathname === "/panel" : pathname.startsWith(href);
}

export function PanelNav({ withActive = true }: { withActive?: boolean }) {
  // usePathname yalnızca Suspense içinde çağrılır (layout'ta yedek olarak aktif durumsuz sürüm gösterilir)
  return withActive ? <ActiveNav /> : <NavList pathname={null} />;
}

function ActiveNav() {
  const pathname = usePathname();
  return <NavList pathname={pathname} />;
}

function NavList({ pathname }: { pathname: string | null }) {
  return (
    <nav aria-label="Müşteri paneli">
      {/* Mobil: yatay kaydırılabilir sekmeler */}
      <ul className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:hidden">
        {PANEL_LINKS.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <li key={href} className="shrink-0">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-semibold",
                  active ? "bg-lime text-ink ring-1 ring-[#c4e534]" : "bg-card text-ink-soft ring-1 ring-line",
                )}
              >
                <Icon className="size-4" aria-hidden />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
      {/* Masaüstü: kenar menü */}
      <ul className="hidden space-y-1 lg:block">
        {PANEL_LINKS.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                  active ? "bg-brand-tint font-semibold text-brand" : "text-ink-soft hover:bg-card hover:text-ink",
                )}
              >
                <Icon className="size-[18px]" aria-hidden />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
