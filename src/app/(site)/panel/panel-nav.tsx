"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
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

/** Menüde dikkat işaretleri: sayı (ör. yanıt bekleyen soru) veya nokta (ör. doğrulama eksik). */
export type PanelNavMarks = Partial<Record<string, { count?: number; dot?: boolean; title?: string }>>;

function Mark({ mark }: { mark?: { count?: number; dot?: boolean; title?: string } }) {
  if (!mark) return null;
  if (mark.count) {
    return (
      <span className="ml-auto min-w-5 rounded-full bg-danger px-1.5 text-center text-[11px] font-bold leading-5 text-white" title={mark.title}>
        {mark.count}
      </span>
    );
  }
  if (mark.dot) return <span className="ml-auto size-2 shrink-0 rounded-full bg-warning" title={mark.title} aria-label={mark.title} />;
  return null;
}

function isActive(pathname: string | null, href: string) {
  if (!pathname) return false;
  return href === "/panel" ? pathname === "/panel" : pathname.startsWith(href);
}

export function PanelNav({ withActive = true, marks = {} }: { withActive?: boolean; marks?: PanelNavMarks }) {
  // usePathname yalnızca Suspense içinde çağrılır (layout'ta yedek olarak aktif durumsuz sürüm gösterilir)
  return withActive ? <ActiveNav marks={marks} /> : <NavList pathname={null} marks={marks} />;
}

function ActiveNav({ marks }: { marks: PanelNavMarks }) {
  const pathname = usePathname();
  return <NavList pathname={pathname} marks={marks} />;
}

function NavList({ pathname, marks }: { pathname: string | null; marks: PanelNavMarks }) {
  const mobileList = useRef<HTMLUListElement>(null);
  // Mobilde yatay sekmelerde etkin sayfa görünür alana kaydırılır
  useEffect(() => {
    const active = mobileList.current?.querySelector<HTMLElement>('[aria-current="page"]');
    active?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [pathname]);
  return (
    <nav aria-label="Müşteri paneli">
      {/* Mobil: yatay kaydırılabilir sekmeler */}
      <ul ref={mobileList} className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:hidden">
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
                <Mark mark={marks[href]} />
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
                <Mark mark={marks[href]} />
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
