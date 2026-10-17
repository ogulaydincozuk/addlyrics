import type { Metadata } from "next";
import { CreditCard, PlusCircle, ShoppingBag } from "lucide-react";
import { LinkButton } from "@/components/ui/button";
import { Alert, EmptyState } from "@/components/ui/primitives";
import { requireUser } from "@/server/auth/guards";
import { getEntitlements } from "@/server/queries/customer";
import { EntitlementCard, entitlementState, PanelPage } from "../_components";

export const metadata: Metadata = { title: "Paketlerim" };

export default function PackagesPage() {
  return (
    <PanelPage title="Paketlerim" description="Paket sürelerin ve video hakların. Haklar paket süresi içinde kullanılabilir.">
      <Entitlements />
    </PanelPage>
  );
}

async function Entitlements() {
  const user = await requireUser("/panel/paketlerim");
  const list = await getEntitlements(user.id);
  if (!list.length) {
    return (
      <EmptyState
        icon={<CreditCard className="size-6" />}
        title="Henüz paketin yok"
        description="Ödemesi tamamlanan paketlerin burada görünür."
        action={<LinkButton href="/paketler">Paketleri İncele</LinkButton>}
      />
    );
  }
  // Hiçbir paketin kullanılabilir hakkı kalmadıysa (süresi dolmuş / haklar bitmiş) yeni paket almaya yönlendir
  const noneUsable = !list.some((e) => entitlementState(e).usable);
  return (
    <div className="space-y-4">
      {noneUsable && (
        <Alert tone="info" title="Kullanılabilir video hakkın kalmadı">
          Yeni şarkıların için bir paket daha alabilirsin.
          <div className="mt-3">
            <LinkButton href="/paketler" size="sm" icon={<ShoppingBag className="size-4" aria-hidden />}>
              Yeni paket al
            </LinkButton>
          </div>
        </Alert>
      )}
      <div className="grid gap-4 xl:grid-cols-2">
        {list.map((e) => (
          <EntitlementCard
            key={e.id}
            e={e}
            action={
              <LinkButton href={`/panel/yeni-siparis?hak=${e.id}`} size="sm" icon={<PlusCircle className="size-4" aria-hidden />}>
                Bu paketten yeni şarkı gönder
              </LinkButton>
            }
          />
        ))}
      </div>
    </div>
  );
}
