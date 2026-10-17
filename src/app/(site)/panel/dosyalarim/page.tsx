import type { Metadata } from "next";
import Link from "next/link";
import { FileStack, PlusCircle } from "lucide-react";
import { LinkButton } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/primitives";
import { formatBytes } from "@/components/upload/upload-client";
import { messages } from "@/i18n/config";
import { formatDate } from "@/lib/dates";
import { requireUser } from "@/server/auth/guards";
import { getEntitlements, getFiles } from "@/server/queries/customer";
import { entitlementState, PanelPage } from "../_components";

export const metadata: Metadata = { title: "Dosyalarım" };

export default function FilesPage() {
  return (
    <PanelPage title="Dosyalarım" description="Siparişlerin için yüklediğin dosyalar. Dosyaların yalnızca sana ve ekibimize açıktır.">
      <Files />
    </PanelPage>
  );
}

async function Files() {
  const user = await requireUser("/panel/dosyalarim");
  const files = await getFiles(user.id);
  const t = messages();
  if (!files.length) {
    // Kullanılabilir paket hakkı varsa doğrudan şarkı gönderme adımına, yoksa paketlere yönlendir
    const hasUsable = (await getEntitlements(user.id)).some((e) => entitlementState(e).usable);
    return (
      <EmptyState
        icon={<FileStack className="size-6" />}
        title="Henüz dosya yüklemedin"
        description={hasUsable ? "Yeni bir şarkı gönderirken yüklediğin dosyalar burada listelenir." : "Bir paket seçip şarkını gönderdiğinde yüklediğin dosyalar burada listelenir."}
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
    <div className="relative overflow-x-auto rounded-2xl border border-line bg-card">
      <table className="w-full min-w-[560px] text-left text-sm">
        <thead className="border-b border-line bg-canvas text-xs uppercase tracking-wide text-muted">
          <tr>
            <th className="px-4 py-3 font-semibold">Dosya</th>
            <th className="px-4 py-3 font-semibold">Tür</th>
            <th className="px-4 py-3 font-semibold">Sipariş</th>
            <th className="px-4 py-3 font-semibold">Tarih</th>
            <th className="px-4 py-3">
              <span className="sr-only">İşlem</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {files.map((f) => (
            <tr key={f.id}>
              <td className="max-w-[220px] truncate px-4 py-3 font-medium text-ink">
                {f.originalName}
                <span className="block text-xs font-normal text-muted">{formatBytes(Number(f.sizeBytes))}</span>
              </td>
              <td className="px-4 py-3 text-ink-soft">{t.enums.fileKind[f.kind]}</td>
              <td className="px-4 py-3">
                {f.order ? (
                  <Link href={`/panel/siparislerim/${f.order.number}`} className="font-medium text-brand hover:underline">
                    {f.order.number}
                  </Link>
                ) : (
                  <span className="text-muted">Bağlı değil</span>
                )}
              </td>
              <td className="px-4 py-3 text-muted">{formatDate(f.createdAt)}</td>
              <td className="px-4 py-3 text-right">
                <a href={`/api/files/${f.id}`} className="font-semibold text-brand hover:underline">
                  İndir
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
