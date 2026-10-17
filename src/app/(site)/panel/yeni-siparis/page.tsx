import type { Metadata } from "next";
import Link from "next/link";
import { CreditCard } from "lucide-react";
import { OrderWizard } from "@/components/order/order-wizard";
import { LinkButton } from "@/components/ui/button";
import { Card, EmptyState } from "@/components/ui/primitives";
import { formatDate } from "@/lib/dates";
import type { PackageSnapshot } from "@/lib/packages";
import { requireUser } from "@/server/auth/guards";
import { db } from "@/server/db";
import { publicFileRules } from "@/server/storage/file-rules";
import { submitEntitlementOrder } from "../../siparis/actions";
import { entitlementState, PanelPage } from "../_components";

export const metadata: Metadata = { title: "Yeni Şarkı Gönder" };

export default function NewEntitlementOrderPage({ searchParams }: PageProps<"/panel/yeni-siparis">) {
  return (
    <PanelPage title="Yeni Şarkı Gönder" description="Paketindeki kalan video haklarını yeni bir şarkı için kullan.">
      <Content searchParams={searchParams} />
    </PanelPage>
  );
}

async function Content({ searchParams }: Pick<PageProps<"/panel/yeni-siparis">, "searchParams">) {
  const user = await requireUser("/panel/yeni-siparis");
  const sp = await searchParams;
  const entitlements = await db.packageEntitlement.findMany({
    where: { userId: user.id },
    orderBy: { endsAt: "asc" },
    include: { package: { select: { name: true } }, sourceOrder: { select: { packageSnapshot: true } } },
  });
  const usable = entitlements.filter((e) => entitlementState(e).usable);

  if (!usable.length) {
    return (
      <EmptyState
        icon={<CreditCard className="size-6" />}
        title="Kullanılabilir video hakkın yok"
        description="Yeni şarkı göndermek için aktif ve hakkı kalmış bir paketin olmalı."
        action={<LinkButton href="/paketler">Paketleri İncele</LinkButton>}
      />
    );
  }

  const selectedId = typeof sp.hak === "string" ? sp.hak : usable.length === 1 ? usable[0]!.id : null;
  const selected = usable.find((e) => e.id === selectedId);

  if (!selected) {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        {usable.map((e) => (
          <Card key={e.id} className="p-5">
            <p className="font-display text-lg font-bold text-ink">{e.package.name}</p>
            <p className="mt-1 text-sm text-muted">
              {entitlementState(e).remaining} video hakkı · bitiş {formatDate(e.endsAt)}
            </p>
            <LinkButton href={`/panel/yeni-siparis?hak=${e.id}`} size="sm" className="mt-4">
              Bu paketi kullan
            </LinkButton>
          </Card>
        ))}
      </div>
    );
  }

  const snapshot = selected.sourceOrder.packageSnapshot as unknown as PackageSnapshot;
  const remaining = entitlementState(selected).remaining;
  return (
    <>
      {usable.length > 1 && (
        <p className="mb-4 text-sm text-muted">
          <Link href="/panel/yeni-siparis" className="font-semibold text-brand hover:underline">
            Başka bir paket seç
          </Link>
        </p>
      )}
      <OrderWizard
        mode="entitlement"
        pkg={{
          name: snapshot.name,
          durationMonths: snapshot.durationMonths,
          priceKurus: null,
          currency: snapshot.currency,
          totalVideos: selected.totalVideos,
          bonusVideos: snapshot.bonusVideoCount ?? 0,
          maxVideosForOrder: remaining,
          deliveryTerms: snapshot.deliveryTerms,
          deliveryDays: snapshot.deliveryDays,
          includedFormats: snapshot.includedFormats,
          includedStyles: snapshot.includedStyles,
          isSample: snapshot.isSample,
          endsAtLabel: formatDate(selected.endsAt),
        }}
        rules={publicFileRules()}
        defaultArtistName={user.artistName ?? ""}
        draftKey={`addlyrics-order:${user.id}:hak:${selected.id}`}
        submit={submitEntitlementOrder.bind(null, selected.id)}
      />
    </>
  );
}
