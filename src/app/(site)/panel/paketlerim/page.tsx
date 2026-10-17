import type { Metadata } from "next";
import { CreditCard, PlusCircle } from "lucide-react";
import { LinkButton } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/primitives";
import { requireUser } from "@/server/auth/guards";
import { getEntitlements } from "@/server/queries/customer";
import { EntitlementCard, PanelPage } from "../_components";

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
  return (
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
  );
}
