import type { Metadata } from "next";
import Link from "next/link";
import { Download, PlayCircle } from "lucide-react";
import { Card, EmptyState } from "@/components/ui/primitives";
import { formatBytes } from "@/components/upload/upload-client";
import { messages } from "@/i18n/config";
import { formatDate } from "@/lib/dates";
import { requireUser } from "@/server/auth/guards";
import { getDeliveries } from "@/server/queries/customer";
import { PanelPage } from "../_components";

export const metadata: Metadata = { title: "Teslim Edilen Videolar" };

export default function DeliveriesPage() {
  return (
    <PanelPage title="Teslim Edilen Videolar" description="Editörlerimizin hazırlayıp teslim ettiği tüm videolar.">
      <Deliveries />
    </PanelPage>
  );
}

async function Deliveries() {
  const user = await requireUser("/panel/teslimler");
  const list = await getDeliveries(user.id);
  const t = messages();
  if (!list.length) {
    return (
      <EmptyState
        icon={<PlayCircle className="size-6" />}
        title="Henüz teslim edilen video yok"
        description="Videoların hazır olduğunda burada izleyip indirebilirsin."
      />
    );
  }
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {list.map((d) => (
        <Card key={d.id} className="overflow-hidden">
          <video controls preload="metadata" playsInline className="aspect-video w-full bg-black" src={`/api/files/${d.file.id}?inline=1`} />
          <div className="p-4">
            <p className="font-semibold text-ink">
              {d.order.song.artistName} – {d.order.song.title}
            </p>
            <p className="text-sm text-muted">
              {d.project.title}
              {d.project.format ? ` · ${t.enums.videoFormat[d.project.format]}` : ""} · v{d.version} · {formatDate(d.releasedAt)}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
              <a href={`/api/files/${d.file.id}`} className="inline-flex items-center gap-1.5 font-semibold text-brand hover:underline">
                <Download className="size-4" aria-hidden /> İndir ({formatBytes(Number(d.file.sizeBytes))})
              </a>
              <Link href={`/panel/siparislerim/${d.order.number}`} className="font-medium text-muted hover:text-brand">
                Siparişe git
              </Link>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
