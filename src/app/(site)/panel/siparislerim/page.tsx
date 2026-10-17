import type { Metadata } from "next";
import { ListMusic } from "lucide-react";
import { LinkButton } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/primitives";
import { requireUser } from "@/server/auth/guards";
import { getOrders } from "@/server/queries/customer";
import { OrderRow, PanelPage } from "../_components";

export const metadata: Metadata = { title: "Siparişlerim" };

export default function OrdersPage() {
  return (
    <PanelPage title="Siparişlerim" description="Her şarkı için verdiğin siparişler ve durumları.">
      <Orders />
    </PanelPage>
  );
}

async function Orders() {
  const user = await requireUser("/panel/siparislerim");
  const orders = await getOrders(user.id);
  if (!orders.length) {
    return (
      <EmptyState
        icon={<ListMusic className="size-6" />}
        title="Henüz siparişin yok"
        description="Bir paket seçip şarkını gönderdiğinde siparişlerin burada listelenir."
        action={<LinkButton href="/paketler">Paketleri İncele</LinkButton>}
      />
    );
  }
  return (
    <div className="space-y-3">
      {orders.map((o) => (
        <OrderRow key={o.id} order={o} />
      ))}
    </div>
  );
}
