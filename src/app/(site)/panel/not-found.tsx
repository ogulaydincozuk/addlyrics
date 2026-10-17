import Link from "next/link";
import { SearchX } from "lucide-react";
import { LinkButton } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/primitives";

/** Panelde bulunamayan kayıtlar (ör. başka hesaba ait veya silinmiş sipariş). Site başlığı ve panel menüsü görünür kalır. */
export default function PanelNotFound() {
  return (
    <div className="space-y-4">
      <EmptyState
        icon={<SearchX className="size-6" aria-hidden />}
        title="Aradığın kayıt bulunamadı"
        description="Bağlantı değişmiş, kayıt kaldırılmış veya bu hesaba ait olmayabilir."
        action={
          <div className="flex flex-col gap-3 sm:flex-row">
            <LinkButton href="/panel/siparislerim">Siparişlerime dön</LinkButton>
            <LinkButton href="/panel" variant="secondary">
              Panelim
            </LinkButton>
          </div>
        }
      />
      <p className="text-center text-sm text-muted">
        Bir sorun olduğunu düşünüyorsan{" "}
        <Link href="/iletisim" className="font-semibold text-brand hover:underline">
          bize yaz
        </Link>
        .
      </p>
    </div>
  );
}
