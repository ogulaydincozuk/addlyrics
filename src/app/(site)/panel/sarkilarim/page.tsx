import type { Metadata } from "next";
import Link from "next/link";
import { Music, PlusCircle } from "lucide-react";
import { OrderStatusBadge } from "@/components/order/status-badge";
import { LinkButton } from "@/components/ui/button";
import { Card, EmptyState } from "@/components/ui/primitives";
import { messages } from "@/i18n/config";
import { formatDate } from "@/lib/dates";
import { requireUser } from "@/server/auth/guards";
import { getEntitlements, getSongs } from "@/server/queries/customer";
import { entitlementState, PanelPage } from "../_components";

export const metadata: Metadata = { title: "Şarkılarım" };

export default function SongsPage() {
  return (
    <PanelPage title="Şarkılarım" description="Gönderdiğin şarkılar ve bağlı siparişler.">
      <Songs />
    </PanelPage>
  );
}

async function Songs() {
  const user = await requireUser("/panel/sarkilarim");
  const songs = await getSongs(user.id);
  const t = messages();
  if (!songs.length) {
    // Kullanılabilir paket hakkı varsa doğrudan şarkı gönderme adımına, yoksa paketlere yönlendir
    const hasUsable = (await getEntitlements(user.id)).some((e) => entitlementState(e).usable);
    return (
      <EmptyState
        icon={<Music className="size-6" />}
        title="Henüz şarkı göndermedin"
        description={hasUsable ? "Paketindeki video haklarını kullanarak ilk şarkını hemen gönderebilirsin." : "Bir paket seçerek ilk şarkını gönderebilirsin."}
        action={
          hasUsable ? (
            <LinkButton href="/panel/yeni-siparis" icon={<PlusCircle className="size-4" aria-hidden />}>
              Yeni Şarkı Gönder
            </LinkButton>
          ) : (
            <LinkButton href="/paketler">Paketleri İncele</LinkButton>
          )
        }
      />
    );
  }
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {songs.map((s) => (
        <Card key={s.id} className="p-5">
          <p className="font-display text-lg font-bold text-ink">{s.title}</p>
          <p className="text-sm text-muted">
            {s.artistName} · {s.language} · {t.enums.releaseStatus[s.releaseStatus]}
          </p>
          <p className="mt-1 text-xs text-muted">Eklenme: {formatDate(s.createdAt)}</p>
          {s.streamingUrl && (
            <a
              href={s.streamingUrl}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="mt-2 inline-block text-sm font-semibold text-brand hover:underline"
            >
              Dinle ↗
            </a>
          )}
          <ul className="mt-4 space-y-2 border-t border-line pt-4">
            {s.orders.map((o) => (
              <li key={o.number} className="flex items-center justify-between gap-2 text-sm">
                <Link href={`/panel/siparislerim/${o.number}`} className="font-medium text-ink hover:text-brand">
                  {o.number} · {o.videoCount} video
                </Link>
                <OrderStatusBadge status={o.status} />
              </li>
            ))}
          </ul>
        </Card>
      ))}
    </div>
  );
}
