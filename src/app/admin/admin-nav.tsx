"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BadgePercent,
  Banknote,
  ClipboardList,
  CreditCard,
  Factory,
  FileText,
  Gauge,
  Gift,
  Handshake,
  HelpCircle,
  History,
  Inbox,
  Layers,
  Megaphone,
  Package,
  PieChart,
  PlayCircle,
  Plug,
  Repeat,
  SlidersHorizontal,
  UserCog,
  Users,
} from "lucide-react";
import { cn } from "@/lib/cn";

export const ADMIN_LINKS = [
  { href: "/admin", label: "Gösterge Paneli", icon: Gauge },
  { href: "/admin/denemeler", label: "Deneme Başvuruları", icon: Gift },
  { href: "/admin/uretim", label: "Üretim Kuyruğu", icon: Factory },
  { href: "/admin/siparisler", label: "Siparişler", icon: ClipboardList },
  { href: "/admin/odemeler", label: "Ödemeler", icon: CreditCard },
  { href: "/admin/abonelikler", label: "Abonelikler ve Haklar", icon: Repeat },
  { href: "/admin/musteriler", label: "Müşteriler", icon: Users },
  { href: "/admin/is-ortaklari", label: "İş Ortakları", icon: Handshake },
  { href: "/admin/referans-kodlari", label: "Referans Kodları", icon: BadgePercent },
  { href: "/admin/komisyonlar", label: "Satış ve Komisyonlar", icon: PieChart },
  { href: "/admin/komisyon-odemeleri", label: "Komisyon Ödemeleri", icon: Banknote },
  { href: "/admin/paketler", label: "Paketler", icon: Package },
  { href: "/admin/editorler", label: "Editörler", icon: UserCog },
  { href: "/admin/duyurular", label: "Duyurular", icon: Megaphone },
  { href: "/admin/portfolyo", label: "Portfolyo", icon: PlayCircle },
  { href: "/admin/icerik", label: "Site İçerikleri", icon: Layers },
  { href: "/admin/sss", label: "SSS", icon: HelpCircle },
  { href: "/admin/sayfalar", label: "Sayfalar ve Yasal Metinler", icon: FileText },
  { href: "/admin/mesajlar", label: "Mesajlar", icon: Inbox },
  { href: "/admin/ayarlar", label: "Sistem Ayarları", icon: SlidersHorizontal },
  { href: "/admin/entegrasyonlar", label: "Entegrasyonlar", icon: Plug },
  { href: "/admin/denetim", label: "Denetim Kayıtları", icon: History },
] as const;

export function AdminNav({ withActive = true }: { withActive?: boolean }) {
  return withActive ? <Active /> : <List pathname={null} />;
}

function Active() {
  return <List pathname={usePathname()} />;
}

function List({ pathname }: { pathname: string | null }) {
  const active = (href: string) => (pathname ? (href === "/admin" ? pathname === "/admin" : pathname.startsWith(href)) : false);
  return (
    <nav aria-label="Yönetim menüsü">
      <ul className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:block lg:space-y-1 lg:px-0">
        {ADMIN_LINKS.map(({ href, label, icon: Icon }) => (
          <li key={href} className="shrink-0">
            <Link
              href={href}
              aria-current={active(href) ? "page" : undefined}
              className={cn(
                "flex items-center gap-2.5 whitespace-nowrap rounded-xl px-3 py-2 text-sm font-medium transition-colors lg:py-2.5",
                active(href) ? "bg-lime text-ink ring-1 ring-[#c4e534] lg:bg-brand-tint lg:text-brand lg:ring-0" : "bg-card text-ink-soft ring-1 ring-line hover:text-ink lg:bg-transparent lg:ring-0 lg:hover:bg-card",
              )}
            >
              <Icon className="size-[18px]" aria-hidden />
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
